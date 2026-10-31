// Mincer: processa grandes volumes (áudio, vídeo, YouTube, páginas, texto) em
// background. Os comandos só enfileiram; o worker de jobs.rs faz o trabalho.
mod db;
mod jobs;
mod record;
mod sidecar;
mod summarize;
mod transcribe;
mod webpage;
mod youtube;

pub use jobs::{on_startup, shutdown};
pub use record::RecordLimits;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::TimeZone;
use serde::{Deserialize, Serialize};
use tauri::menu::MenuItem;
use tauri::{AppHandle, Emitter, Manager, State, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::watch;

pub(crate) const EVENT_PROGRESS: &str = "mincer://progress";
pub(crate) const EVENT_DONE: &str = "mincer://done";
pub(crate) const EVENT_ERROR: &str = "mincer://error";
pub(crate) const EVENT_RECORD: &str = "mincer://record";
pub(crate) const EVENT_LEVEL: &str = "mincer://level";

const MEDIA_EXTS: [&str; 12] = [
    "mp4", "mp3", "m4a", "wav", "ogg", "opus", "webm", "flac", "aac", "mkv", "mov", "avi",
];
const MAX_TEXT_FILE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_MEDIA_FILE_BYTES: u64 = 500 * 1024 * 1024;
const MAX_PDF_FILE_BYTES: u64 = 100 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MincerItemSummary {
    id: String,
    kind: String,
    title: String,
    status: String,
    stage: Option<String>,
    progress_current: i64,
    progress_total: i64,
    error: Option<String>,
    created_at: i64,
    updated_at: i64,
    unseen: bool,
    sent_to_notebook_at: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MincerItem {
    id: String,
    kind: String,
    title: String,
    source: Option<String>,
    status: String,
    stage: Option<String>,
    progress_current: i64,
    progress_total: i64,
    error: Option<String>,
    preset: Option<String>,
    summary_prompt: Option<String>,
    transcription_model: Option<String>,
    summary_model: Option<String>,
    transcript: Option<String>,
    summary: Option<String>,
    created_at: i64,
    updated_at: i64,
    unseen: bool,
    sent_to_notebook_at: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MincerJobOptions {
    transcription_model: Option<String>,
    summary_model: Option<String>,
    preset: Option<String>,
    summary_prompt: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MincerStartInput {
    kind: String,
    source: Option<String>,
    text: Option<String>,
    options: MincerJobOptions,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MincerModel {
    id: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MincerRecordStatus {
    active: bool,
    started_at: Option<i64>,
    errors: Vec<String>,
    // Regras da gravação em curso (0 = desligada); o teto já inclui os "+30 min".
    silence_stop_minutes: u32,
    max_minutes: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MincerProgressEvent {
    item_id: String,
    stage: String,
    current: i64,
    total: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MincerDoneEvent {
    item_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MincerErrorEvent {
    item_id: String,
    message: String,
    cancelled: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MincerRecordEvent {
    active: bool,
}

// Pico de cada faixa (0..1) desde o último evento; mic None sem microfone.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MincerLevelEvent {
    system: f32,
    mic: Option<f32>,
}

// Só o job ativo; a fila fica no banco.
pub(crate) struct ActiveJob {
    item_id: String,
    cancel: watch::Sender<bool>,
    child_job: Arc<Mutex<Option<sidecar::ProcessJob>>>,
}

#[derive(Default)]
pub struct MincerJobs(Mutex<Option<ActiveJob>>);

#[derive(Default)]
pub struct MincerRecording(Mutex<Option<record::RecordingHandle>>);

// Item "Stop recording" do menu do tray, habilitado só durante a gravação.
pub struct MincerTrayStop(pub MenuItem<Wry>);

pub const TRAY_ID: &str = "main";
pub const TRAY_STOP_ID: &str = "mincer_stop";
const TRAY_TOOLTIP: &str = "Monet";

// Ctrl+Alt+R para a gravação de qualquer lugar; só fica registrado enquanto grava.
pub fn stop_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyR)
}

pub(crate) fn toast(app: &AppHandle, title: &str, body: &str) {
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        eprintln!("mincer notification: {}", e);
    }
}

fn record_started(app: &AppHandle, started_at: i64) {
    if let Some(item) = app.try_state::<MincerTrayStop>() {
        let _ = item.0.set_enabled(true);
    }
    let shortcut = app.global_shortcut().register(stop_shortcut()).is_ok();
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let since = chrono::Local
            .timestamp_millis_opt(started_at)
            .single()
            .map(|t| t.format("%H:%M").to_string())
            .unwrap_or_default();
        let hint = if shortcut { " — Ctrl+Alt+R stops" } else { "" };
        let _ = tray.set_tooltip(Some(format!("Monet — Mincer recording since {}{}", since, hint)));
    }
    let _ = app.emit(EVENT_RECORD, MincerRecordEvent { active: true });
}

fn record_ended(app: &AppHandle) {
    if let Some(item) = app.try_state::<MincerTrayStop>() {
        let _ = item.0.set_enabled(false);
    }
    let _ = app.global_shortcut().unregister(stop_shortcut());
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(TRAY_TOOLTIP));
    }
    let _ = app.emit(EVENT_RECORD, MincerRecordEvent { active: false });
}

// Tira o handle da gravação; com expected_start, só se ainda for a mesma
// gravação (a parada automática não pode encerrar uma gravação nova).
fn take_recording(app: &AppHandle, expected_start: Option<i64>) -> Result<record::RecordingHandle, String> {
    let state = app.state::<MincerRecording>();
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(h) if expected_start.is_none_or(|s| s == record::started_at(h)) => {}
        _ => return Err("No recording in progress.".to_string()),
    }
    guard.take().ok_or_else(|| "No recording in progress.".to_string())
}

// Para e enfileira o item (botão, tray, atalho e parada automática).
async fn stop_recording(
    app: &AppHandle,
    expected_start: Option<i64>,
    keep_secs: Option<u64>,
) -> Result<String, String> {
    let handle = take_recording(app, expected_start)?;
    let errors = tokio::task::spawn_blocking(move || record::stop_handle(handle))
        .await
        .map_err(|e| e.to_string())?;
    let result = record::finalize_into_item(app, &errors, keep_secs);
    record_ended(app);
    let id = result?;
    jobs::start_next(app);
    Ok(id)
}

async fn discard_recording(app: &AppHandle, expected_start: Option<i64>) -> Result<(), String> {
    let handle = take_recording(app, expected_start)?;
    let app_handle = app.clone();
    tokio::task::spawn_blocking(move || {
        record::stop_handle(handle);
        record::discard_files(&app_handle);
    })
    .await
    .map_err(|e| e.to_string())?;
    record_ended(app);
    Ok(())
}

pub(crate) enum AutoStop {
    // keep_secs None: nenhum áudio desde o início, nada a processar.
    Silence { label: String, keep_secs: Option<u64> },
    Limit { label: String },
}

// Chamado da thread da gravação; a parada roda numa task para não fazer a
// thread esperar por ela mesma (stop_handle faz join dela).
pub(crate) fn auto_stop(app: AppHandle, started_at: i64, reason: AutoStop) {
    tauri::async_runtime::spawn(async move {
        let (result, body) = match reason {
            AutoStop::Silence { label, keep_secs: Some(keep) } => (
                stop_recording(&app, Some(started_at), Some(keep)).await.map(|_| ()),
                format!("No audio for {}. Processing the recording now.", label),
            ),
            AutoStop::Silence { label, keep_secs: None } => (
                discard_recording(&app, Some(started_at)).await,
                format!("No audio was detected in {}, so nothing was saved.", label),
            ),
            AutoStop::Limit { label } => (
                stop_recording(&app, Some(started_at), None).await.map(|_| ()),
                format!("Reached the {} limit set in Settings. Processing the recording now.", label),
            ),
        };
        match result {
            Ok(()) => toast(&app, "Mincer: recording stopped", &body),
            // Já parada pelo usuário no mesmo instante: nada a avisar.
            Err(e) if e == "No recording in progress." => {}
            Err(e) => toast(&app, "Mincer: recording failed", &e),
        }
    });
}

// Tray e atalho global: a janela pode estar escondida, então o retorno é um toast.
pub fn stop_recording_from_outside(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match stop_recording(&app, None, None).await {
            Ok(_) => toast(&app, "Mincer: recording stopped", "Processing the recording now."),
            Err(e) if e == "No recording in progress." => {}
            Err(e) => toast(&app, "Mincer: recording failed", &e),
        }
    });
}

pub(crate) fn mincer_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("mincer"))
        .map_err(|e| format!("app data dir unavailable: {}", e))
}

pub(crate) fn item_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let dir = mincer_root(app)?.join(id);
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create the work folder: {}", e))?;
    Ok(dir)
}

const PENDING_SUMMARY_FILE: &str = "regenerate.json";

// Opções de um Regenerate que ainda não gerou o resumo novo. Só vão para o item
// junto com o resumo (a pasta some no done), então um Regenerate que falha ou é
// cancelado não muda o rótulo do resumo atual.
fn save_pending_summary(app: &AppHandle, id: &str, options: &MincerJobOptions) -> Result<(), String> {
    let json = serde_json::to_string(options).map_err(|e| e.to_string())?;
    fs::write(item_dir(app, id)?.join(PENDING_SUMMARY_FILE), json)
        .map_err(|e| format!("Could not save the summary options: {}", e))
}

pub(crate) fn load_pending_summary(app: &AppHandle, id: &str) -> Option<MincerJobOptions> {
    let path = mincer_root(app).ok()?.join(id).join(PENDING_SUMMARY_FILE);
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

fn non_empty(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

fn truncate_chars(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

const ERROR_BODY_CHARS: usize = 500;

// Erro da API do OpenRouter em frase acionável. O detalhe técnico vem depois
// de uma linha em branco: a UI o recolhe e o toast mostra só a frase.
pub(crate) fn api_error(status: reqwest::StatusCode, body: &str, model: &str) -> String {
    let lower = body.to_lowercase();
    let friendly = match status.as_u16() {
        401 => "OpenRouter rejected your API key. Check it in Settings, then Resume.".to_string(),
        402 => "Your OpenRouter credits are out. Add credits, then Resume.".to_string(),
        429 => "Too many requests to OpenRouter. Wait a moment, then Resume.".to_string(),
        _ if lower.contains("context length") || lower.contains("context_length") || lower.contains("too long") => {
            format!(
                "The model {} can't take a text this long. Choose another model in Settings, then Resume.",
                model
            )
        }
        _ if lower.contains("not a valid model") || lower.contains("no endpoints found") => format!(
            "The model {} is not available on OpenRouter. Choose another one in Settings, then Resume.",
            model
        ),
        s if s >= 500 => "OpenRouter is having trouble right now. Try Resume in a few minutes.".to_string(),
        _ => format!("OpenRouter returned an error ({}).", status),
    };
    format!("{}\n\n{} — {}", friendly, status, truncate_chars(body.trim(), ERROR_BODY_CHARS))
}

pub(crate) fn network_error(err: &reqwest::Error) -> String {
    format!("Could not reach OpenRouter. Check your connection, then Resume.\n\n{}", err)
}

fn require_key(app: &AppHandle) -> Result<(), String> {
    crate::read_key(app, "openrouter_key")
        .map(|_| ())
        .ok_or_else(|| "OPENROUTER_KEY_MISSING".to_string())
}

fn require_transcription_model(options: &MincerJobOptions) -> Result<(), String> {
    non_empty(&options.transcription_model)
        .map(|_| ())
        .ok_or_else(|| "Choose a transcription model in Settings.".to_string())
}

fn require_summary_options(options: &MincerJobOptions) -> Result<(), String> {
    match (non_empty(&options.summary_model), non_empty(&options.summary_prompt)) {
        (Some(_), Some(_)) => Ok(()),
        _ => Err("Choose a summary model in Settings.".to_string()),
    }
}

#[tauri::command]
pub async fn mincer_list(app: AppHandle) -> Result<Vec<MincerItemSummary>, String> {
    db::list_items(&app)
}

#[tauri::command]
pub async fn mincer_get(app: AppHandle, id: String) -> Result<Option<MincerItem>, String> {
    db::get_item(&app, &id)
}

#[tauri::command]
pub async fn mincer_start(app: AppHandle, input: MincerStartInput) -> Result<String, String> {
    let options = input.options;
    let kind = input.kind.as_str();
    let (title, source, transcript) = match kind {
        "paste" => {
            let text = input.text.unwrap_or_default();
            if text.trim().is_empty() {
                return Err("The text is empty.".to_string());
            }
            let title = text
                .lines()
                .map(str::trim)
                .find(|l| !l.is_empty())
                .map(|l| truncate_chars(l, 80))
                .unwrap_or_else(|| "Pasted text".to_string());
            (title, None, Some(text))
        }
        "file" => {
            let path = input.source.unwrap_or_default();
            let p = Path::new(&path);
            let meta = fs::metadata(p).map_err(|_| "The file was not found.".to_string())?;
            if meta.is_dir() {
                return Err("Folders aren't supported — drop files.".to_string());
            }
            if !meta.is_file() {
                return Err("The file was not found.".to_string());
            }
            let size = meta.len();
            let title = p
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "File".to_string());
            let ext = p
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            let transcript = if jobs::is_text_path(&path) {
                if size > MAX_TEXT_FILE_BYTES {
                    return Err("The text file is larger than 20 MB.".to_string());
                }
                let owned = path.clone();
                let text = tokio::task::spawn_blocking(move || fs::read_to_string(owned))
                    .await
                    .map_err(|e| e.to_string())?
                    .map_err(|e| format!("Could not read the file: {}", e))?;
                if text.trim().is_empty() {
                    return Err("The text is empty.".to_string());
                }
                Some(text)
            } else if jobs::is_pdf_path(&path) {
                // O texto sai no worker (pdf_extract pode levar segundos em PDFs grandes).
                if size > MAX_PDF_FILE_BYTES {
                    return Err("The PDF is larger than 100 MB.".to_string());
                }
                None
            } else if MEDIA_EXTS.contains(&ext.as_str()) {
                if size > MAX_MEDIA_FILE_BYTES {
                    return Err("The file is larger than 500 MB.".to_string());
                }
                require_transcription_model(&options)?;
                None
            } else {
                return Err("This file type is not supported.".to_string());
            };
            (title, Some(path), transcript)
        }
        "youtube" => {
            let url = input.source.unwrap_or_default().trim().to_string();
            youtube::validate_youtube_url(&url)?;
            require_transcription_model(&options)?;
            ("YouTube video".to_string(), Some(url), None)
        }
        "web_summary" | "web_capture" => {
            let url = input.source.unwrap_or_default().trim().to_string();
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err("Invalid URL. It must start with http:// or https://.".to_string());
            }
            (url.clone(), Some(url), None)
        }
        _ => return Err("Unknown item type.".to_string()),
    };

    if kind != "web_capture" {
        require_summary_options(&options)?;
        require_key(&app)?;
    }

    let id = uuid::Uuid::new_v4().to_string();
    db::insert_queued(
        &app,
        &id,
        kind,
        &title,
        source.as_deref(),
        transcript.as_deref(),
        &options,
    )?;
    jobs::start_next(&app);
    Ok(id)
}

#[tauri::command]
pub async fn mincer_resume(
    app: AppHandle,
    id: String,
    options: MincerJobOptions,
) -> Result<(), String> {
    match db::get_status(&app, &id)?.as_deref() {
        Some("error") | Some("cancelled") | Some("interrupted") => {
            // Os modelos atuais do Settings: um modelo retirado não trava o item.
            // Com Regenerate pendente, o modelo do resumo vai para as opções dele.
            let mut summary_model = non_empty(&options.summary_model);
            if let (Some(model), Some(mut pending)) = (summary_model, load_pending_summary(&app, &id)) {
                pending.summary_model = Some(model.to_string());
                save_pending_summary(&app, &id, &pending)?;
                summary_model = None;
            }
            db::set_models(
                &app,
                &id,
                non_empty(&options.transcription_model),
                summary_model,
            )?;
            jobs::enqueue_and_start(&app, &id, false)
        }
        _ => Err("This item cannot be resumed.".to_string()),
    }
}

#[tauri::command]
pub async fn mincer_cancel(app: AppHandle, id: String) -> Result<(), String> {
    jobs::cancel(&app, &id)
}

#[tauri::command]
pub async fn mincer_regenerate_summary(
    app: AppHandle,
    id: String,
    options: MincerJobOptions,
) -> Result<(), String> {
    let item = db::get_item(&app, &id)?.ok_or_else(|| "Item not found.".to_string())?;
    if item.status == "running" || item.status == "queued" {
        return Err("Wait for this item to finish first.".to_string());
    }
    if item.kind == "web_capture" || non_empty(&item.transcript).is_none() {
        return Err("This item has no text to summarize.".to_string());
    }
    require_summary_options(&options)?;
    save_pending_summary(&app, &id, &options)?;
    jobs::enqueue_and_start(&app, &id, true)
}

#[tauri::command]
pub async fn mincer_rename(app: AppHandle, id: String, title: String) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("The title cannot be empty.".to_string());
    }
    db::set_title(&app, &id, &truncate_chars(title, 200))
}

#[tauri::command]
pub async fn mincer_delete(app: AppHandle, id: String) -> Result<(), String> {
    jobs::delete(&app, &id)
}

#[tauri::command]
pub async fn mincer_active_job(app: AppHandle) -> Result<Option<String>, String> {
    Ok(jobs::active_item_id(&app))
}

#[tauri::command]
pub async fn mincer_list_transcription_models(app: AppHandle) -> Result<Vec<MincerModel>, String> {
    let key = crate::read_key(&app, "openrouter_key")
        .ok_or_else(|| "OPENROUTER_KEY_MISSING".to_string())?;
    transcribe::list_transcription_models(&key).await
}

#[tauri::command]
pub async fn mincer_mark_seen(app: AppHandle, id: String) -> Result<(), String> {
    db::mark_seen(&app, &id)
}

#[tauri::command]
pub async fn mincer_mark_sent_to_notebook(app: AppHandle, id: String) -> Result<(), String> {
    db::mark_sent_to_notebook(&app, &id)
}

#[tauri::command]
pub async fn mincer_pick_files() -> Result<Vec<String>, String> {
    let result = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Audio/Video/Text/PDF", &[&MEDIA_EXTS[..], &["txt", "md", "pdf"]].concat())
            .pick_files()
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(result
        .unwrap_or_default()
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

fn yaml_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\r', '\n'], " ")
}

#[tauri::command]
pub async fn mincer_save_files(app: AppHandle, id: String, folder: String) -> Result<String, String> {
    let item = db::get_item(&app, &id)?.ok_or_else(|| "Item not found.".to_string())?;
    let folder_name = chrono::Local::now().format("%d-%m-%Y_%H-%M-%S").to_string();
    let out_dir = Path::new(&folder).join(folder_name);
    let save_err = |e: std::io::Error| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            "No permission to save in this folder. Choose another location.".to_string()
        } else {
            format!("Could not save: {}", e)
        }
    };
    fs::create_dir_all(&out_dir).map_err(save_err)?;

    let date = chrono::Local
        .timestamp_millis_opt(item.created_at)
        .single()
        .map(|d| d.to_rfc3339())
        .unwrap_or_default();
    let front_matter = format!(
        "---\ntitle: \"{}\"\ndate: {}\nsource: \"{}\"\nkind: {}\npreset: {}\n---\n\n",
        yaml_string(&item.title),
        date,
        yaml_string(item.source.as_deref().unwrap_or("")),
        item.kind,
        item.preset.as_deref().unwrap_or("")
    );

    if let Some(summary) = non_empty(&item.summary) {
        let body = format!("{}# {}\n\n{}\n", front_matter, item.title, summary);
        fs::write(out_dir.join("summary.md"), body).map_err(save_err)?;
    }
    if let Some(transcript) = non_empty(&item.transcript) {
        let body = format!("{}# {} — Transcript\n\n{}\n", front_matter, item.title, transcript);
        fs::write(out_dir.join("transcript.md"), body).map_err(save_err)?;
    }
    Ok(out_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn mincer_record_start(
    app: AppHandle,
    state: State<'_, MincerRecording>,
    options: MincerJobOptions,
    limits: RecordLimits,
) -> Result<(), String> {
    let started_at = record::start(&app, &state, &options, limits)?;
    record_started(&app, started_at);
    Ok(())
}

#[tauri::command]
pub async fn mincer_record_stop(app: AppHandle) -> Result<String, String> {
    stop_recording(&app, None, None).await
}

#[tauri::command]
pub async fn mincer_record_extend(state: State<'_, MincerRecording>) -> Result<u32, String> {
    record::extend(&state)
}

#[tauri::command]
pub async fn mincer_record_discard(app: AppHandle) -> Result<(), String> {
    discard_recording(&app, None).await
}

#[tauri::command]
pub async fn mincer_record_status(state: State<'_, MincerRecording>) -> Result<MincerRecordStatus, String> {
    Ok(record::status(&state))
}
