// Fila FIFO do Mincer: a fila é a tabela mincer_items (status 'queued', ordem
// por queued_at) e um worker processa um item por vez. Todo pedido só
// enfileira e chama start_next, que nunca bloqueia. O lock de MincerJobs só é
// segurado para ler ou trocar o job ativo; nada de rede ou processo dentro de
// with_doc_db.
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::watch;

use super::sidecar::{self, JobCtx, JobError};
use super::{
    db, item_dir, load_pending_summary, mincer_root, record, summarize, toast, transcribe, webpage, youtube, ActiveJob,
    MincerDoneEvent, MincerErrorEvent, MincerItem, MincerJobs, MincerRecording, EVENT_DONE,
    EVENT_ERROR,
};

// Nada roda antes do on_startup marcar os 'running' antigos como interrompidos,
// e nada novo começa depois do Quit.
static READY: AtomicBool = AtomicBool::new(false);
static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

const NOTIFY_TITLE_CHARS: usize = 80;
const NOTIFY_ERROR_CHARS: usize = 180;

fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max).collect();
    out.push('…');
    out
}

fn log_err(result: Result<(), String>) {
    if let Err(e) = result {
        eprintln!("mincer: {}", e);
    }
}

fn emit_error(app: &AppHandle, id: &str, message: &str, cancelled: bool) {
    let _ = app.emit(
        EVENT_ERROR,
        MincerErrorEvent {
            item_id: id.to_string(),
            message: message.to_string(),
            cancelled,
        },
    );
}

fn remove_item_dir(app: &AppHandle, id: &str) {
    if let Ok(root) = mincer_root(app) {
        let _ = fs::remove_dir_all(root.join(id));
    }
}

pub(crate) fn start_next(app: &AppHandle) {
    if !READY.load(Ordering::SeqCst) || SHUTTING_DOWN.load(Ordering::SeqCst) {
        return;
    }
    let state = app.state::<MincerJobs>();
    let Ok(mut guard) = state.0.lock() else {
        return;
    };
    if guard.is_some() {
        return;
    }
    let (id, force_summary) = match db::next_queued(app) {
        Ok(Some(next)) => next,
        Ok(None) => return,
        Err(e) => {
            eprintln!("mincer: {}", e);
            return;
        }
    };
    if let Err(e) = db::set_running(app, &id) {
        eprintln!("mincer: {}", e);
        return;
    }
    let (cancel, cancel_rx) = watch::channel(false);
    let child_job = Arc::new(Mutex::new(None));
    // Gravado ainda com o lock: duas chamadas simultâneas não pegam o mesmo item.
    *guard = Some(ActiveJob {
        item_id: id.clone(),
        cancel,
        child_job: child_job.clone(),
    });
    drop(guard);

    let ctx = JobCtx {
        app: app.clone(),
        item_id: id,
        cancel: cancel_rx,
        child_job,
    };
    tauri::async_runtime::spawn(run_and_finish(ctx, force_summary));
}

async fn run_and_finish(ctx: JobCtx, force_summary: bool) {
    let result = run_item(&ctx, force_summary).await;
    let app = ctx.app.clone();
    let id = ctx.item_id.clone();
    match result {
        Ok(()) => {
            log_err(db::set_finished(&app, &id, "done", None));
            remove_item_dir(&app, &id);
            let _ = app.emit(EVENT_DONE, MincerDoneEvent { item_id: id.clone() });
            notify(&app, &id, Ok(()));
        }
        Err(JobError::Cancelled) => {
            // No Quit o item já voltou para a fila: não marca como cancelado.
            if db::get_status(&app, &id).ok().flatten().as_deref() == Some("running") {
                log_err(db::set_finished(&app, &id, "cancelled", Some("Cancelled.")));
                emit_error(&app, &id, "Cancelled.", true);
            }
        }
        // No Quit o processo morto pode chegar como falha: o item já voltou para a fila.
        Err(JobError::Failed(_)) if SHUTTING_DOWN.load(Ordering::SeqCst) => {}
        Err(JobError::Failed(message)) => {
            log_err(db::set_finished(&app, &id, "error", Some(&message)));
            emit_error(&app, &id, &message, false);
            notify(&app, &id, Err(&message));
        }
    }

    {
        let state = app.state::<MincerJobs>();
        if let Ok(mut guard) = state.0.lock() {
            if guard.as_ref().is_some_and(|job| job.item_id == id) {
                *guard = None;
            }
        };
    }
    start_next(&app);
}

// Toast nativo do Windows, inclusive com a janela escondida na bandeja.
fn notify(app: &AppHandle, id: &str, result: Result<(), &str>) {
    let item = db::get_item(app, id).ok().flatten();
    let title = item
        .as_ref()
        .map(|i| i.title.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| "item".to_string());
    let title = truncate_chars(&title, NOTIFY_TITLE_CHARS);
    let is_capture = item.as_ref().is_some_and(|i| i.kind == "web_capture");
    let (heading, body) = match result {
        Ok(()) => (
            format!("Mincer: {} is ready", title),
            if is_capture { "Text captured." } else { "Summary is ready." }.to_string(),
        ),
        Err(message) => {
            let body = if message == "OPENROUTER_KEY_MISSING" {
                "Add your OpenRouter key in Settings.".to_string()
            } else {
                // Só a frase: o detalhe técnico (depois da linha em branco) fica no app.
                let sentence = message.split("\n\n").next().unwrap_or(message);
                truncate_chars(sentence, NOTIFY_ERROR_CHARS)
            };
            (format!("Mincer: {} failed", title), body)
        }
    };
    toast(app, &heading, &body);
}

pub(crate) fn enqueue_and_start(app: &AppHandle, id: &str, force_summary: bool) -> Result<(), String> {
    db::enqueue(app, id, force_summary)?;
    start_next(app);
    Ok(())
}

fn non_empty(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

pub(crate) fn is_text_path(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_lowercase().as_str(), "txt" | "md"))
        .unwrap_or(false)
}

pub(crate) fn is_pdf_path(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("pdf"))
}

fn openrouter_key(app: &AppHandle) -> Result<String, JobError> {
    crate::read_key(app, "openrouter_key")
        .ok_or_else(|| JobError::Failed("OPENROUTER_KEY_MISSING".into()))
}

fn transcription_model(item: &MincerItem) -> Result<String, JobError> {
    non_empty(&item.transcription_model)
        .map(str::to_string)
        .ok_or_else(|| JobError::Failed("Choose a transcription model in Settings.".into()))
}

async fn extract_text(ctx: &JobCtx, item: &MincerItem) -> Result<String, JobError> {
    let app = &ctx.app;
    let source = item.source.as_deref().unwrap_or_default();
    match item.kind.as_str() {
        "paste" => Err(JobError::Failed("The text is empty.".into())),
        "file" if is_text_path(source) => Err(JobError::Failed("The text is empty.".into())),
        "file" if is_pdf_path(source) => {
            ctx.progress("reading_pdf", 0, 0);
            let path = source.to_string();
            let bytes = tokio::task::spawn_blocking(move || fs::read(path))
                .await
                .map_err(|e| JobError::Failed(e.to_string()))?
                .map_err(|_| JobError::Failed("The file was not found.".into()))?;
            tokio::select! {
                r = crate::pdf_text_from_mem(bytes) => r.map_err(|e| JobError::Failed(format!("{}.", e))),
                _ = ctx.cancelled() => Err(JobError::Cancelled),
            }
        }
        "web_summary" | "web_capture" => {
            ctx.progress("fetching", 0, 0);
            let (title, text) = tokio::select! {
                r = webpage::fetch_article(source) => r?,
                _ = ctx.cancelled() => return Err(JobError::Cancelled),
            };
            if let Some(title) = title {
                db::set_title(app, &ctx.item_id, &title)?;
            }
            Ok(text)
        }
        "youtube" => {
            let model = transcription_model(item)?;
            let key = openrouter_key(app)?;
            let yt_dlp = sidecar::resolve("yt-dlp")?;
            let dir = item_dir(app, &ctx.item_id)?;
            if !dir.join("yt_audio.done").exists() {
                if let Some(title) = youtube::fetch_title(ctx, &yt_dlp, source).await {
                    db::set_title(app, &ctx.item_id, &title)?;
                }
            }
            let audio = youtube::download_audio(ctx, &yt_dlp, source, &dir).await?;
            transcribe::transcribe_media(ctx, Some(&audio), &dir, &model, &key).await
        }
        "file" => {
            let model = transcription_model(item)?;
            let key = openrouter_key(app)?;
            let dir = item_dir(app, &ctx.item_id)?;
            transcribe::transcribe_media(ctx, Some(Path::new(source)), &dir, &model, &key).await
        }
        "record" => {
            let model = transcription_model(item)?;
            let key = openrouter_key(app)?;
            let dir = item_dir(app, &ctx.item_id)?;
            let mixed = dir.join("audio.mp3").exists()
                || dir.join("chunks.done").exists()
                || dir.join("chunk_000.mp3").exists();
            if !mixed {
                record::mix(ctx, &dir).await?;
            }
            transcribe::transcribe_media(ctx, None, &dir, &model, &key).await
        }
        _ => Err(JobError::Failed("Unknown item type.".into())),
    }
}

async fn run_item(ctx: &JobCtx, force_summary: bool) -> Result<(), JobError> {
    let app = &ctx.app;
    let item = db::get_item(app, &ctx.item_id)?
        .ok_or_else(|| JobError::Failed("Item not found.".into()))?;

    let mut transcript = item.transcript.clone().unwrap_or_default();
    if transcript.trim().is_empty() {
        transcript = extract_text(ctx, &item).await?;
        db::set_transcript(app, &ctx.item_id, &transcript)?;
        // Com a transcrição salva, a retomada não usa mais a pasta (áudio e pedaços).
        remove_item_dir(app, &ctx.item_id);
    }

    let has_summary = item.summary.as_deref().is_some_and(|s| !s.trim().is_empty());
    if item.kind != "web_capture" && (force_summary || !has_summary) {
        let pending = if force_summary { load_pending_summary(app, &ctx.item_id) } else { None };
        let (model, prompt) = match &pending {
            Some(p) => (&p.summary_model, &p.summary_prompt),
            None => (&item.summary_model, &item.summary_prompt),
        };
        let (Some(model), Some(prompt)) = (non_empty(model), non_empty(prompt)) else {
            return Err(JobError::Failed("Choose a summary model in Settings.".into()));
        };
        let key = openrouter_key(app)?;
        ctx.progress("summarizing", 0, 0);
        let summary = summarize::summarize(ctx, &key, model, prompt, &transcript).await?;
        match &pending {
            Some(options) => db::set_summary_with_options(app, &ctx.item_id, &summary, options)?,
            None => db::set_summary(app, &ctx.item_id, &summary)?,
        }
    }
    Ok(())
}

pub(crate) fn cancel(app: &AppHandle, id: &str) -> Result<(), String> {
    let state = app.state::<MincerJobs>();
    // O lock fica preso durante a checagem para o worker não pegar o item no meio.
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(job) = guard.as_ref() {
        if job.item_id == id {
            let _ = job.cancel.send(true);
            return Ok(());
        }
    }
    if db::get_status(app, id)?.as_deref() == Some("queued") {
        let message = "Removed from queue.";
        db::set_finished(app, id, "cancelled", Some(message))?;
        emit_error(app, id, message, true);
    }
    Ok(())
}

// Item enfileirado sai da fila por não existir mais. O lock fica preso para o
// worker não pegar o item no meio.
pub(crate) fn delete(app: &AppHandle, id: &str) -> Result<(), String> {
    let state = app.state::<MincerJobs>();
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    // Logo depois do Cancel o job ainda está registrado, mas o status já é final.
    if guard.as_ref().is_some_and(|job| job.item_id == id)
        && db::get_status(app, id)?.as_deref() == Some("running")
    {
        return Err("Cancel the job before deleting this item.".to_string());
    }
    db::delete_item(app, id)?;
    drop(guard);
    remove_item_dir(app, id);
    Ok(())
}

pub(crate) fn active_item_id(app: &AppHandle) -> Option<String> {
    let state = app.state::<MincerJobs>();
    let guard = state.0.lock().ok()?;
    guard.as_ref().map(|job| job.item_id.clone())
}

pub async fn on_startup(app: AppHandle) {
    // Crash: o item não é retomado sozinho (evita loop num item que derruba o
    // app); fica com Resume.
    log_err(db::mark_running_interrupted(
        &app,
        "Monet was closed while this item was processing.",
    ));

    // Uma gravação iniciada antes deste ponto usa a pasta: não é sobra de crash.
    let recording_active = app
        .state::<MincerRecording>()
        .0
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(true);
    if !recording_active && record::has_pending_recording(&app) {
        if let Err(e) = record::finalize_into_item(&app, &[], None) {
            eprintln!("mincer: recovered recording: {}", e);
        }
    }

    match (mincer_root(&app), db::item_ids(&app)) {
        (Ok(root), Ok(ids)) => {
            let _ = tokio::task::spawn_blocking(move || {
                let Ok(entries) = fs::read_dir(&root) else {
                    return;
                };
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name != "recording" && !ids.contains(&name) && entry.path().is_dir() {
                        let _ = fs::remove_dir_all(entry.path());
                    }
                }
            })
            .await;
        }
        (Err(e), _) | (_, Err(e)) => eprintln!("mincer: {}", e),
    }

    READY.store(true, Ordering::SeqCst);
    // Os itens enfileirados antes do fechamento voltam a rodar, em ordem.
    start_next(&app);
}

// Quit limpo (RunEvent::Exit).
pub fn shutdown(app: &AppHandle) {
    SHUTTING_DOWN.store(true, Ordering::SeqCst);

    // A gravação em curso vira item na fila e é transcrita no próximo boot.
    let handle = app
        .try_state::<MincerRecording>()
        .and_then(|state| state.0.lock().ok().and_then(|mut g| g.take()));
    if let Some(handle) = handle {
        let errors = record::stop_handle(handle);
        if let Err(e) = record::finalize_into_item(app, &errors, None) {
            eprintln!("mincer: recording on exit: {}", e);
        }
    }

    // O job ativo volta à frente da fila e retoma do cache no próximo boot.
    let Some(state) = app.try_state::<MincerJobs>() else {
        return;
    };
    let Ok(guard) = state.0.lock() else {
        return;
    };
    if let Some(job) = guard.as_ref() {
        log_err(db::requeue_front(app, &job.item_id));
        // Mata a árvore de processos antes de acordar a task.
        let child = job.child_job.lock().ok().and_then(|mut g| g.take());
        drop(child);
        let _ = job.cancel.send(true);
    }
}
