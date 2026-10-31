// Gravação do áudio do sistema (loopback) e do microfone via WASAPI (porte do
// record.rs do VOLP). WAV em PCM 16-bit: ~1 GB/h em vez de ~2 GB/h.
use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::{AppHandle, Emitter};

use super::sidecar::{self, JobCtx, JobError};
use super::{
    auto_stop, db, item_dir, mincer_root, toast, AutoStop, MincerJobOptions, MincerLevelEvent,
    MincerRecordStatus, MincerRecording, EVENT_LEVEL,
};
use crate::documents::now_ms;

const SAMPLE_RATE: usize = 48000;
const CAPTURE_BITS: usize = 32;
const LOOPBACK_WAV: &str = "loopback.wav";
const MIC_WAV: &str = "mic.wav";
const OPTIONS_FILE: &str = "options.json";
const KEEP_FILE: &str = "keep_secs.txt";
// ~4 eventos de nível por segundo.
const LEVEL_INTERVAL: Duration = Duration::from_millis(250);
// Pico abaixo disso (~-44 dBFS) conta como silêncio: o loopback não manda
// nada no silêncio, mas o microfone sempre pega algum ruído ambiente.
const SILENCE_PEAK: f32 = 0.006;
// Margem mantida depois do último áudio quando a parada é por silêncio.
const KEEP_MARGIN: Duration = Duration::from_secs(30);
const MINUTE: Duration = Duration::from_secs(60);
// Cada "+30 min" estende o teto da gravação em curso.
pub(crate) const EXTEND_MINUTES: u32 = 30;

// Parada automática (Settings › Mincer); 0 desliga a regra.
#[derive(Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecordLimits {
    silence_stop_minutes: u32,
    max_minutes: u32,
}

// Aviso alguns minutos antes de parar: 5 min antes, ou na metade em prazos curtos.
fn warn_point(limit: Duration) -> Duration {
    if limit > 10 * MINUTE {
        limit - 5 * MINUTE
    } else {
        limit / 2
    }
}

fn minutes_label(d: Duration) -> String {
    let m = (d.as_secs() + 30) / 60;
    match (m / 60, m % 60) {
        (0, min) => format!("{} min", min),
        (h, 0) => format!("{} h", h),
        (h, min) => format!("{} h {} min", h, min),
    }
}

// Decide a parada automática a cada leitura de nível (thread da gravação).
struct AutoStopWatch {
    silence_stop_minutes: u32,
    max_minutes: Arc<AtomicU32>,
    seen_max_minutes: u32,
    started: Instant,
    last_audio: Instant,
    had_audio: bool,
    silence_warned: bool,
    max_warned: bool,
    fired: bool,
}

impl AutoStopWatch {
    fn new(silence_stop_minutes: u32, max_minutes: Arc<AtomicU32>) -> Self {
        let now = Instant::now();
        let seen_max_minutes = max_minutes.load(Ordering::Relaxed);
        Self {
            silence_stop_minutes,
            max_minutes,
            seen_max_minutes,
            started: now,
            last_audio: now,
            had_audio: false,
            silence_warned: false,
            max_warned: false,
            fired: false,
        }
    }

    fn tick(&mut self, app: &AppHandle, started_at: i64, system: f32, mic: Option<f32>) {
        let now = Instant::now();
        if system > SILENCE_PEAK || mic.unwrap_or(0.0) > SILENCE_PEAK {
            self.last_audio = now;
            self.had_audio = true;
            self.silence_warned = false;
        }
        if self.fired {
            return;
        }

        if self.silence_stop_minutes > 0 {
            let limit = MINUTE * self.silence_stop_minutes;
            let silent = now - self.last_audio;
            if !self.silence_warned && silent >= warn_point(limit) {
                self.silence_warned = true;
                toast(
                    app,
                    &format!("Mincer: no audio for {}", minutes_label(silent)),
                    &format!(
                        "The recording stops in {} unless audio returns.",
                        minutes_label(limit.saturating_sub(silent))
                    ),
                );
            }
            if silent >= limit {
                self.fired = true;
                // Sem nenhum áudio desde o início não há o que processar.
                let keep_secs = self
                    .had_audio
                    .then(|| (self.last_audio - self.started + KEEP_MARGIN).as_secs());
                auto_stop(
                    app.clone(),
                    started_at,
                    AutoStop::Silence { label: minutes_label(limit), keep_secs },
                );
                return;
            }
        }

        let max_minutes = self.max_minutes.load(Ordering::Relaxed);
        if max_minutes != self.seen_max_minutes {
            // Estendida: o aviso vale de novo para o novo teto.
            self.seen_max_minutes = max_minutes;
            self.max_warned = false;
        }
        if max_minutes > 0 {
            let limit = MINUTE * max_minutes;
            let elapsed = now - self.started;
            if !self.max_warned && limit > 10 * MINUTE && elapsed >= limit - 5 * MINUTE {
                self.max_warned = true;
                toast(
                    app,
                    "Mincer: recording stops in 5 min",
                    &format!(
                        "It reaches the {} limit. To keep recording, open Mincer and click +30 min.",
                        minutes_label(limit)
                    ),
                );
            }
            if elapsed >= limit {
                self.fired = true;
                auto_stop(app.clone(), started_at, AutoStop::Limit { label: minutes_label(limit) });
            }
        }
    }
}

pub(crate) struct RecordingHandle {
    stop_flag: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    started_at: i64,
    errors: Arc<Mutex<Vec<String>>>,
    silence_stop_minutes: u32,
    // Teto atual (Settings + extensões); lido pela thread a cada leitura de nível.
    max_minutes: Arc<AtomicU32>,
}

struct StreamConfig {
    direction: wasapi::Direction,
    channels: usize,
    path: PathBuf,
    // Pico desde a última leitura, em bits de f32 (>= 0, então a ordem dos
    // bits é a ordem numérica e fetch_max funciona).
    peak: Arc<AtomicU32>,
}

fn capture_stream(config: StreamConfig, stop_flag: Arc<AtomicBool>) -> Result<(), String> {
    wasapi::initialize_mta()
        .ok()
        .map_err(|e| format!("could not initialize COM: {:?}", e))?;

    let device = wasapi::get_default_device(&config.direction)
        .map_err(|e| format!("default device unavailable: {}", e))?;

    let mut audio_client = device
        .get_iaudioclient()
        .map_err(|e| format!("could not get IAudioClient: {}", e))?;

    let desired_format = wasapi::WaveFormat::new(
        CAPTURE_BITS,
        CAPTURE_BITS,
        &wasapi::SampleType::Float,
        SAMPLE_RATE,
        config.channels,
        None,
    );

    let (_def_time, min_time) = audio_client
        .get_periods()
        .map_err(|e| format!("could not get device periods: {}", e))?;

    audio_client
        .initialize_client(
            &desired_format,
            min_time,
            &wasapi::Direction::Capture,
            &wasapi::ShareMode::Shared,
            true,
        )
        .map_err(|e| format!("could not initialize the client: {}", e))?;

    let h_event = audio_client
        .set_get_eventhandle()
        .map_err(|e| format!("could not create the event handle: {}", e))?;

    let capture_client = audio_client
        .get_audiocaptureclient()
        .map_err(|e| format!("could not get the capture client: {}", e))?;

    let spec = hound::WavSpec {
        channels: config.channels as u16,
        sample_rate: SAMPLE_RATE as u32,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::create(&config.path, spec)
        .map_err(|e| format!("could not create the WAV file: {}", e))?;

    let mut sample_queue: VecDeque<u8> = VecDeque::with_capacity(16384);

    audio_client
        .start_stream()
        .map_err(|e| format!("could not start the stream: {}", e))?;

    while !stop_flag.load(Ordering::Relaxed) {
        capture_client
            .read_from_device_to_deque(&mut sample_queue)
            .map_err(|e| format!("could not read from the device: {}", e))?;

        let samples = sample_queue.len() / 4;
        let mut chunk_peak = 0.0f32;
        for _ in 0..samples {
            let mut buf = [0u8; 4];
            for b in buf.iter_mut() {
                *b = sample_queue.pop_front().unwrap_or(0);
            }
            let sample = f32::from_le_bytes(buf);
            chunk_peak = chunk_peak.max(sample.abs().min(1.0));
            let pcm = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
            writer
                .write_sample(pcm)
                .map_err(|e| format!("could not write the WAV file: {}", e))?;
        }
        config.peak.fetch_max(chunk_peak.to_bits(), Ordering::Relaxed);

        if h_event.wait_for_event(200).is_err() {
            continue;
        }
    }

    let _ = audio_client.stop_stream();
    writer
        .finalize()
        .map_err(|e| format!("could not finish the WAV file: {}", e))?;

    Ok(())
}

fn spawn_capture(
    config: StreamConfig,
    stop_flag: Arc<AtomicBool>,
    errors: Arc<Mutex<Vec<String>>>,
    label: &'static str,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        if let Err(e) = capture_stream(config, stop_flag) {
            if let Ok(mut list) = errors.lock() {
                list.push(format!("{}: {}", label, e));
            }
        }
    })
}

fn recording_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = mincer_root(app)?.join("recording");
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create the recording folder: {}", e))?;
    Ok(dir)
}

// Um WAV só é utilizável se tem mais que o cabeçalho.
fn usable(path: &Path) -> bool {
    fs::metadata(path).map(|m| m.len() > 1024).unwrap_or(false)
}

pub(crate) fn has_pending_recording(app: &AppHandle) -> bool {
    mincer_root(app)
        .map(|root| {
            let dir = root.join("recording");
            usable(&dir.join(LOOPBACK_WAV)) || usable(&dir.join(MIC_WAV))
        })
        .unwrap_or(false)
}

pub(crate) fn start(
    app: &AppHandle,
    state: &MincerRecording,
    options: &MincerJobOptions,
    limits: RecordLimits,
) -> Result<i64, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("A recording is already in progress.".to_string());
    }

    let dir = recording_dir(app)?;
    let loopback_path = dir.join(LOOPBACK_WAV);
    let mic_path = dir.join(MIC_WAV);
    let _ = fs::remove_file(&loopback_path);
    let _ = fs::remove_file(&mic_path);
    let options_json = serde_json::to_string(options).map_err(|e| e.to_string())?;
    fs::write(dir.join(OPTIONS_FILE), options_json)
        .map_err(|e| format!("Could not save the recording options: {}", e))?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    let errors = Arc::new(Mutex::new(Vec::new()));
    let stop_thread = stop_flag.clone();
    let errors_thread = errors.clone();
    let app_thread = app.clone();
    let started_at = now_ms();
    let max_minutes = Arc::new(AtomicU32::new(limits.max_minutes));
    let max_thread = max_minutes.clone();

    // COM inicializado nesta thread própria, não numa worker do tokio.
    let thread = std::thread::spawn(move || {
        let mic_available = {
            let _ = wasapi::initialize_mta().ok();
            wasapi::get_default_device(&wasapi::Direction::Capture).is_ok()
        };
        let system_peak = Arc::new(AtomicU32::new(0));
        let mic_peak = Arc::new(AtomicU32::new(0));
        let loopback = spawn_capture(
            StreamConfig {
                direction: wasapi::Direction::Render,
                channels: 2,
                path: loopback_path,
                peak: system_peak.clone(),
            },
            stop_thread.clone(),
            errors_thread.clone(),
            "System audio",
        );
        let mic = mic_available.then(|| {
            spawn_capture(
                StreamConfig {
                    direction: wasapi::Direction::Capture,
                    channels: 1,
                    path: mic_path,
                    peak: mic_peak.clone(),
                },
                stop_thread.clone(),
                errors_thread.clone(),
                "Microphone",
            )
        });
        // Nível de cada faixa para a tela de gravação (sem tocar no banco) e
        // a parada automática por silêncio/limite.
        let mut watch = AutoStopWatch::new(limits.silence_stop_minutes, max_thread);
        while !stop_thread.load(Ordering::Relaxed) {
            std::thread::sleep(LEVEL_INTERVAL);
            let level = |peak: &AtomicU32| f32::from_bits(peak.swap(0, Ordering::Relaxed));
            let system = level(&system_peak);
            let mic = mic_available.then(|| level(&mic_peak));
            let _ = app_thread.emit(EVENT_LEVEL, MincerLevelEvent { system, mic });
            watch.tick(&app_thread, started_at, system, mic);
        }
        let _ = loopback.join();
        if let Some(h) = mic {
            let _ = h.join();
        }
    });

    *guard = Some(RecordingHandle {
        stop_flag,
        thread: Some(thread),
        started_at,
        errors,
        silence_stop_minutes: limits.silence_stop_minutes,
        max_minutes,
    });
    Ok(started_at)
}

// "+30 min": estende o teto da gravação em curso; devolve o teto novo.
pub(crate) fn extend(state: &MincerRecording) -> Result<u32, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let handle = guard.as_ref().ok_or_else(|| "No recording in progress.".to_string())?;
    if handle.max_minutes.load(Ordering::Relaxed) == 0 {
        return Err("This recording has no length limit.".to_string());
    }
    Ok(handle.max_minutes.fetch_add(EXTEND_MINUTES, Ordering::Relaxed) + EXTEND_MINUTES)
}

pub(crate) fn started_at(handle: &RecordingHandle) -> i64 {
    handle.started_at
}

pub(crate) fn stop_handle(mut handle: RecordingHandle) -> Vec<String> {
    handle.stop_flag.store(true, Ordering::Relaxed);
    if let Some(t) = handle.thread.take() {
        let _ = t.join();
    }
    handle.errors.lock().map(|e| e.clone()).unwrap_or_default()
}

pub(crate) fn status(state: &MincerRecording) -> MincerRecordStatus {
    let guard = state.0.lock();
    match guard.as_ref().ok().and_then(|g| g.as_ref()) {
        Some(h) => MincerRecordStatus {
            active: true,
            started_at: Some(h.started_at),
            errors: h.errors.lock().map(|e| e.clone()).unwrap_or_default(),
            silence_stop_minutes: h.silence_stop_minutes,
            max_minutes: h.max_minutes.load(Ordering::Relaxed),
        },
        None => MincerRecordStatus {
            active: false,
            started_at: None,
            errors: Vec::new(),
            silence_stop_minutes: 0,
            max_minutes: 0,
        },
    }
}

// Descarta a gravação parada: apaga os WAVs e as opções.
pub(crate) fn discard_files(app: &AppHandle) {
    if let Ok(dir) = recording_dir(app) {
        let _ = fs::remove_file(dir.join(LOOPBACK_WAV));
        let _ = fs::remove_file(dir.join(MIC_WAV));
        let _ = fs::remove_file(dir.join(OPTIONS_FILE));
    }
}

fn move_file(from: &Path, to: &Path) -> Result<(), String> {
    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    fs::copy(from, to).map_err(|e| format!("Could not move the recording: {}", e))?;
    let _ = fs::remove_file(from);
    Ok(())
}

// O item nasce enfileirado; quem chama depois chama jobs::start_next.
// keep_secs corta o fim da gravação na mixagem (silêncio depois da reunião).
pub(crate) fn finalize_into_item(
    app: &AppHandle,
    errors: &[String],
    keep_secs: Option<u64>,
) -> Result<String, String> {
    let dir = recording_dir(app)?;
    let options_path = dir.join(OPTIONS_FILE);
    let options: MincerJobOptions = fs::read_to_string(&options_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let wavs: Vec<&str> = [LOOPBACK_WAV, MIC_WAV]
        .into_iter()
        .filter(|name| usable(&dir.join(name)))
        .collect();
    if wavs.is_empty() {
        let _ = fs::remove_file(dir.join(LOOPBACK_WAV));
        let _ = fs::remove_file(dir.join(MIC_WAV));
        let _ = fs::remove_file(&options_path);
        let mut message = "No audio was captured.".to_string();
        if !errors.is_empty() {
            message.push(' ');
            message.push_str(&errors.join(" "));
        }
        return Err(message);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let target = item_dir(app, &id)?;
    for name in &wavs {
        move_file(&dir.join(name), &target.join(name))?;
    }
    if let Some(secs) = keep_secs {
        fs::write(target.join(KEEP_FILE), secs.to_string())
            .map_err(|e| format!("Could not save the recording: {}", e))?;
    }
    let title = format!("Recording {}", chrono::Local::now().format("%Y-%m-%d %H:%M"));
    db::insert_queued(app, &id, "record", &title, None, None, &options)?;
    let _ = fs::remove_file(dir.join(LOOPBACK_WAV));
    let _ = fs::remove_file(dir.join(MIC_WAV));
    let _ = fs::remove_file(&options_path);
    Ok(id)
}

// Mixa as faixas gravadas em audio.mp3 (mono, 16 kHz) dentro do job.
pub(crate) async fn mix(ctx: &JobCtx, dir: &Path) -> Result<(), JobError> {
    let loopback = dir.join(LOOPBACK_WAV);
    let mic = dir.join(MIC_WAV);
    let inputs: Vec<&PathBuf> = [&loopback, &mic].into_iter().filter(|p| usable(p)).collect();
    if inputs.is_empty() {
        return Err(JobError::Failed("The recording files are missing.".into()));
    }

    ctx.progress("mixing", 0, 0);
    let ffmpeg = sidecar::resolve("ffmpeg")?;
    let tmp = dir.join("audio.tmp.mp3");
    let mut cmd = sidecar::command(&ffmpeg);
    for input in &inputs {
        cmd.arg("-i").arg(input);
    }
    if inputs.len() == 2 {
        cmd.args(["-filter_complex", "[0:a][1:a]amix=inputs=2:duration=longest"]);
    }
    let keep_secs = fs::read_to_string(dir.join(KEEP_FILE))
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok());
    if let Some(secs) = keep_secs {
        cmd.arg("-t").arg(secs.to_string());
    }
    cmd.args(["-codec:a", "libmp3lame", "-b:a", "64k", "-ar", "16000", "-ac", "1"])
        .arg(&tmp)
        .arg("-y");
    sidecar::run(ctx, cmd)
        .await
        .map_err(|e| e.context("ffmpeg could not mix the recording"))?;
    fs::rename(&tmp, dir.join("audio.mp3")).map_err(|e| format!("Could not save the audio: {}", e))?;
    let _ = fs::remove_file(&loopback);
    let _ = fs::remove_file(&mic);
    let _ = fs::remove_file(dir.join(KEEP_FILE));
    Ok(())
}
