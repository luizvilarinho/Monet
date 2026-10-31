// Transcrição em pedaços com cache por pedaço (porte do transcribe.rs do VOLP).
// Tudo fica na pasta do item, então a retomada sobrevive a fechar o app.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine as _};

use super::sidecar::{self, JobCtx, JobError};
use super::{api_error, network_error, MincerModel};

// 18 MB no MP3 → ~24 MB em base64, dentro do limite do gateway.
const CHUNK_SIZE_LIMIT: u64 = 18 * 1024 * 1024;
const SEGMENT_SECONDS: &str = "1200";
const MAX_ATTEMPTS: u32 = 3;
const TRANSCRIBE_URL: &str = "https://openrouter.ai/api/v1/audio/transcriptions";

// Timeout longo: um pedaço de 20 min pode demorar. O documents::http_client()
// tem 60 s, curto demais aqui.
pub(crate) fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(600))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

enum TranscribeError {
    Transient(String),
    Permanent(String),
    Cancelled,
}

fn chunk_path(dir: &Path, index: usize, ext: &str) -> PathBuf {
    dir.join(format!("chunk_{:03}.{}", index, ext))
}

fn remove_chunk_files(dir: &Path) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("chunk_") && (name.ends_with(".mp3") || name.ends_with(".txt")) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

// Pedaços em sequência a partir do 000 (vale o .mp3 ou o cache .txt).
fn count_chunks(dir: &Path) -> usize {
    let mut i = 0;
    while chunk_path(dir, i, "mp3").exists() || chunk_path(dir, i, "txt").exists() {
        i += 1;
    }
    i
}

async fn prepare_chunks(ctx: &JobCtx, input: Option<&Path>, dir: &Path) -> Result<(), JobError> {
    let ffmpeg = sidecar::resolve("ffmpeg")?;
    let audio = dir.join("audio.mp3");
    let done_marker = dir.join("chunks.done");
    // O audio.mp3 só some depois que os pedaços ficam prontos: se ele não existe
    // e há pedaços, o app fechou entre o split e o marcador.
    if !audio.exists() && count_chunks(dir) > 0 {
        fs::write(&done_marker, b"").map_err(|e| format!("Could not save progress: {}", e))?;
        return Ok(());
    }
    if !audio.exists() {
        let input = input.ok_or_else(|| JobError::Failed("The source audio is missing.".into()))?;
        ctx.progress("extracting", 0, 0);
        let tmp = dir.join("audio.tmp.mp3");
        let mut cmd = sidecar::command(&ffmpeg);
        cmd.arg("-i")
            .arg(input)
            .args(["-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k"])
            .arg(&tmp)
            .arg("-y");
        sidecar::run(ctx, cmd)
            .await
            .map_err(|e| e.context("ffmpeg could not extract the audio"))?;
        fs::rename(&tmp, &audio).map_err(|e| format!("Could not save the audio: {}", e))?;
    }

    ctx.progress("splitting", 0, 0);
    remove_chunk_files(dir);
    let size = fs::metadata(&audio).map(|m| m.len()).unwrap_or(0);
    if size <= CHUNK_SIZE_LIMIT {
        fs::rename(&audio, chunk_path(dir, 0, "mp3"))
            .map_err(|e| format!("Could not save the audio: {}", e))?;
    } else {
        let mut cmd = sidecar::command(&ffmpeg);
        cmd.arg("-i")
            .arg(&audio)
            .args(["-f", "segment", "-segment_time", SEGMENT_SECONDS])
            .args(["-c:a", "libmp3lame", "-b:a", "64k"])
            .arg(dir.join("chunk_%03d.mp3"))
            .arg("-y");
        sidecar::run(ctx, cmd)
            .await
            .map_err(|e| e.context("ffmpeg could not split the audio"))?;
        let _ = fs::remove_file(&audio);
        if count_chunks(dir) == 0 {
            return Err(JobError::Failed("ffmpeg produced no audio chunks".into()));
        }
    }
    fs::write(&done_marker, b"").map_err(|e| format!("Could not save progress: {}", e))?;
    Ok(())
}

pub(crate) async fn transcribe_media(
    ctx: &JobCtx,
    input: Option<&Path>,
    dir: &Path,
    model: &str,
    key: &str,
) -> Result<String, JobError> {
    if !dir.join("chunks.done").exists() {
        prepare_chunks(ctx, input, dir).await?;
    }

    let total = count_chunks(dir);
    if total == 0 {
        return Err(JobError::Failed("The audio chunks are missing.".into()));
    }

    let mut texts = Vec::with_capacity(total);
    for i in 0..total {
        if ctx.is_cancelled() {
            return Err(JobError::Cancelled);
        }
        let cache = chunk_path(dir, i, "txt");
        if let Ok(text) = fs::read_to_string(&cache) {
            texts.push(text);
            continue;
        }
        ctx.progress("transcribing", i as i64, total as i64);
        let text = transcribe_with_retry(ctx, &chunk_path(dir, i, "mp3"), model, key).await?;
        fs::write(&cache, &text).map_err(|e| format!("Could not save progress: {}", e))?;
        texts.push(text);
    }
    ctx.progress("transcribing", total as i64, total as i64);
    Ok(texts.join("\n\n"))
}

async fn transcribe_once(
    ctx: &JobCtx,
    path: &Path,
    model: &str,
    key: &str,
) -> Result<String, TranscribeError> {
    // Até 18 MB: leitura e base64 fora da worker async.
    let owned = path.to_path_buf();
    let b64 = tokio::task::spawn_blocking(move || fs::read(&owned).map(|bytes| STANDARD.encode(bytes)))
        .await
        .map_err(|e| TranscribeError::Permanent(e.to_string()))?
        .map_err(|e| TranscribeError::Permanent(format!("Could not read the audio chunk: {}", e)))?;

    let body = serde_json::json!({
        "model": model,
        "input_audio": { "data": b64, "format": "mp3" }
    });

    let request = async {
        let response = http_client()
            .post(TRANSCRIBE_URL)
            .bearer_auth(key)
            .header("HTTP-Referer", "https://monet.local")
            .header("X-Title", "Monet")
            .json(&body)
            .send()
            .await
            .map_err(|e| TranscribeError::Transient(network_error(&e)))?;

        let status = response.status();
        if !status.is_success() {
            let err_body = response.text().await.unwrap_or_default();
            let message = api_error(status, &err_body, model);
            if status.as_u16() == 429 || status.is_server_error() {
                return Err(TranscribeError::Transient(message));
            }
            return Err(TranscribeError::Permanent(message));
        }

        #[derive(serde::Deserialize)]
        struct TranscribeResponse {
            text: String,
        }
        let parsed: TranscribeResponse = response
            .json()
            .await
            .map_err(|e| TranscribeError::Transient(format!("Invalid transcription response: {}", e)))?;
        Ok(parsed.text)
    };

    tokio::select! {
        r = request => r,
        _ = ctx.cancelled() => Err(TranscribeError::Cancelled),
    }
}

async fn transcribe_with_retry(
    ctx: &JobCtx,
    path: &Path,
    model: &str,
    key: &str,
) -> Result<String, JobError> {
    let mut last = String::new();
    for attempt in 1..=MAX_ATTEMPTS {
        match transcribe_once(ctx, path, model, key).await {
            Ok(text) => return Ok(text),
            Err(TranscribeError::Cancelled) => return Err(JobError::Cancelled),
            Err(TranscribeError::Permanent(m)) => return Err(JobError::Failed(m)),
            Err(TranscribeError::Transient(m)) => {
                last = m;
                if attempt < MAX_ATTEMPTS {
                    let delay = Duration::from_secs(1u64 << (attempt - 1));
                    tokio::select! {
                        _ = tokio::time::sleep(delay) => {}
                        _ = ctx.cancelled() => return Err(JobError::Cancelled),
                    }
                }
            }
        }
    }
    // O sufixo vai na frase, antes do detalhe (o toast mostra só a frase).
    let message = match last.split_once("\n\n") {
        Some((sentence, detail)) => format!("{} (after {} attempts)\n\n{}", sentence, MAX_ATTEMPTS, detail),
        None => format!("{} (after {} attempts)", last, MAX_ATTEMPTS),
    };
    Err(JobError::Failed(message))
}

pub(crate) async fn list_transcription_models(key: &str) -> Result<Vec<MincerModel>, String> {
    let response = http_client()
        .get("https://openrouter.ai/api/v1/models?input_modalities=audio&output_modalities=transcription")
        .bearer_auth(key)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Could not load the models: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("Could not load the models: {}", response.status()));
    }
    let raw: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Could not load the models: {}", e))?;
    let data = raw["data"]
        .as_array()
        .ok_or_else(|| "Unexpected response from OpenRouter.".to_string())?;
    Ok(data
        .iter()
        .filter_map(|item| {
            let id = item["id"].as_str()?.to_string();
            let name = item["name"].as_str().unwrap_or(&id).to_string();
            Some(MincerModel { id, name })
        })
        .collect())
}
