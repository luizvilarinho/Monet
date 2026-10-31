// Acesso à tabela mincer_items (criada em documents::open_doc_db). Escritas
// curtas: nada de rede, processo ou arquivo grande dentro de with_doc_db.
use std::collections::HashSet;

use rusqlite::{params, OptionalExtension};
use tauri::{AppHandle, Manager};

use super::{MincerItem, MincerItemSummary, MincerJobOptions};
use crate::documents::{now_ms, with_doc_db, DocDb};

fn with_db<T>(
    app: &AppHandle,
    f: impl FnOnce(&mut rusqlite::Connection) -> Result<T, String>,
) -> Result<T, String> {
    let state = app.state::<DocDb>();
    with_doc_db(app, &state, f)
}

fn exec(app: &AppHandle, sql: &str, args: &[&dyn rusqlite::ToSql]) -> Result<(), String> {
    with_db(app, |conn| {
        conn.execute(sql, args)
            .map(|_| ())
            .map_err(|e| format!("mincer db: {}", e))
    })
}

pub(crate) fn insert_queued(
    app: &AppHandle,
    id: &str,
    kind: &str,
    title: &str,
    source: Option<&str>,
    transcript: Option<&str>,
    options: &MincerJobOptions,
) -> Result<(), String> {
    let now = now_ms();
    exec(
        app,
        "INSERT INTO mincer_items (id, kind, title, source, status, preset, summary_prompt,
            transcription_model, summary_model, transcript, queued_at, force_summary,
            created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?6, ?7, ?8, ?9, ?10, 0, ?10, ?10)",
        params![
            id,
            kind,
            title,
            source,
            options.preset,
            options.summary_prompt,
            options.transcription_model,
            options.summary_model,
            transcript,
            now
        ],
    )
}

// Resume passa false e mantém a flag de um Regenerate que falhou ou foi cancelado.
pub(crate) fn enqueue(app: &AppHandle, id: &str, force_summary: bool) -> Result<(), String> {
    let now = now_ms();
    exec(
        app,
        "UPDATE mincer_items SET status = 'queued', queued_at = ?2,
            force_summary = MAX(force_summary, ?3),
            error = NULL, stage = NULL, progress_current = 0, progress_total = 0, updated_at = ?2
         WHERE id = ?1",
        params![id, now, force_summary as i64],
    )
}

// Volta à fila mantendo o queued_at original: no próximo boot o item é o primeiro.
pub(crate) fn requeue_front(app: &AppHandle, id: &str) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET status = 'queued', stage = NULL, updated_at = ?2 WHERE id = ?1",
        params![id, now_ms()],
    )
}

pub(crate) fn next_queued(app: &AppHandle) -> Result<Option<(String, bool)>, String> {
    with_db(app, |conn| {
        conn.query_row(
            "SELECT id, force_summary FROM mincer_items WHERE status = 'queued'
             ORDER BY queued_at ASC LIMIT 1",
            [],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0)),
        )
        .optional()
        .map_err(|e| format!("mincer db: {}", e))
    })
}

pub(crate) fn get_item(app: &AppHandle, id: &str) -> Result<Option<MincerItem>, String> {
    with_db(app, |conn| {
        conn.query_row(
            "SELECT id, kind, title, source, status, stage, progress_current, progress_total,
                error, preset, summary_prompt, transcription_model, summary_model, transcript,
                summary, created_at, updated_at, unseen, sent_to_notebook_at
             FROM mincer_items WHERE id = ?1",
            params![id],
            |r| {
                Ok(MincerItem {
                    id: r.get(0)?,
                    kind: r.get(1)?,
                    title: r.get(2)?,
                    source: r.get(3)?,
                    status: r.get(4)?,
                    stage: r.get(5)?,
                    progress_current: r.get(6)?,
                    progress_total: r.get(7)?,
                    error: r.get(8)?,
                    preset: r.get(9)?,
                    summary_prompt: r.get(10)?,
                    transcription_model: r.get(11)?,
                    summary_model: r.get(12)?,
                    transcript: r.get(13)?,
                    summary: r.get(14)?,
                    created_at: r.get(15)?,
                    updated_at: r.get(16)?,
                    unseen: r.get::<_, i64>(17)? != 0,
                    sent_to_notebook_at: r.get(18)?,
                })
            },
        )
        .optional()
        .map_err(|e| format!("mincer db: {}", e))
    })
}

pub(crate) fn list_items(app: &AppHandle) -> Result<Vec<MincerItemSummary>, String> {
    with_db(app, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, kind, title, status, stage, progress_current, progress_total, error,
                    created_at, updated_at, unseen, sent_to_notebook_at
                 FROM mincer_items ORDER BY created_at DESC",
            )
            .map_err(|e| format!("mincer db: {}", e))?;
        let rows = stmt
            .query_map([], |r| {
                Ok(MincerItemSummary {
                    id: r.get(0)?,
                    kind: r.get(1)?,
                    title: r.get(2)?,
                    status: r.get(3)?,
                    stage: r.get(4)?,
                    progress_current: r.get(5)?,
                    progress_total: r.get(6)?,
                    error: r.get(7)?,
                    created_at: r.get(8)?,
                    updated_at: r.get(9)?,
                    unseen: r.get::<_, i64>(10)? != 0,
                    sent_to_notebook_at: r.get(11)?,
                })
            })
            .map_err(|e| format!("mincer db: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("mincer db: {}", e))
    })
}

pub(crate) fn set_running(app: &AppHandle, id: &str) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET status = 'running', error = NULL, stage = NULL,
            progress_current = 0, progress_total = 0, updated_at = ?2
         WHERE id = ?1",
        params![id, now_ms()],
    )
}

pub(crate) fn get_status(app: &AppHandle, id: &str) -> Result<Option<String>, String> {
    with_db(app, |conn| {
        conn.query_row(
            "SELECT status FROM mincer_items WHERE id = ?1",
            params![id],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("mincer db: {}", e))
    })
}

pub(crate) fn set_progress(
    app: &AppHandle,
    id: &str,
    stage: &str,
    current: i64,
    total: i64,
) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET stage = ?2, progress_current = ?3, progress_total = ?4,
            updated_at = ?5
         WHERE id = ?1",
        params![id, stage, current, total, now_ms()],
    )
}

pub(crate) fn set_title(app: &AppHandle, id: &str, title: &str) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET title = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, title, now_ms()],
    )
}

pub(crate) fn set_transcript(app: &AppHandle, id: &str, text: &str) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET transcript = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, text, now_ms()],
    )
}

pub(crate) fn set_summary(app: &AppHandle, id: &str, text: &str) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET summary = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, text, now_ms()],
    )
}

// Resumo de um Regenerate: grava junto as opções que o geraram.
pub(crate) fn set_summary_with_options(
    app: &AppHandle,
    id: &str,
    text: &str,
    options: &MincerJobOptions,
) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET summary = ?2, preset = ?3, summary_prompt = ?4,
            summary_model = ?5, updated_at = ?6
         WHERE id = ?1",
        params![
            id,
            text,
            options.preset,
            options.summary_prompt,
            options.summary_model,
            now_ms()
        ],
    )
}

// Item terminado (done ou error) fica "novo" até ser aberto.
pub(crate) fn mark_seen(app: &AppHandle, id: &str) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET unseen = 0 WHERE id = ?1",
        params![id],
    )
}

pub(crate) fn mark_sent_to_notebook(app: &AppHandle, id: &str) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET sent_to_notebook_at = ?2 WHERE id = ?1",
        params![id, now_ms()],
    )
}

// Só troca os modelos informados; None mantém o do item.
pub(crate) fn set_models(
    app: &AppHandle,
    id: &str,
    transcription_model: Option<&str>,
    summary_model: Option<&str>,
) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET transcription_model = COALESCE(?2, transcription_model),
            summary_model = COALESCE(?3, summary_model), updated_at = ?4
         WHERE id = ?1",
        params![id, transcription_model, summary_model, now_ms()],
    )
}

pub(crate) fn set_finished(
    app: &AppHandle,
    id: &str,
    status: &str,
    error: Option<&str>,
) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET status = ?2, error = ?3, stage = NULL,
            force_summary = CASE WHEN ?2 = 'done' THEN 0 ELSE force_summary END,
            unseen = CASE WHEN ?2 IN ('done', 'error') THEN 1 ELSE unseen END,
            updated_at = ?4
         WHERE id = ?1",
        params![id, status, error, now_ms()],
    )
}

pub(crate) fn delete_item(app: &AppHandle, id: &str) -> Result<(), String> {
    exec(app, "DELETE FROM mincer_items WHERE id = ?1", params![id])
}

pub(crate) fn mark_running_interrupted(app: &AppHandle, message: &str) -> Result<(), String> {
    exec(
        app,
        "UPDATE mincer_items SET status = 'interrupted', error = ?1, stage = NULL, updated_at = ?2
         WHERE status = 'running'",
        params![message, now_ms()],
    )
}

pub(crate) fn item_ids(app: &AppHandle) -> Result<HashSet<String>, String> {
    with_db(app, |conn| {
        let mut stmt = conn
            .prepare("SELECT id FROM mincer_items")
            .map_err(|e| format!("mincer db: {}", e))?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| format!("mincer db: {}", e))?;
        rows.collect::<Result<HashSet<_>, _>>()
            .map_err(|e| format!("mincer db: {}", e))
    })
}
