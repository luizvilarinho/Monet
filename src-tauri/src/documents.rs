// monet.db é compartilhado com o frontend via tauri-plugin-sql, mas as tabelas
// `documents` e `notebook_document_visibility` são gerenciadas exclusivamente
// por este módulo (DocDb / rusqlite). O frontend só lê documentos via
// `documents_list_global` — não escreve direto. Manter este invariante evita
// conflito de locks com o backend e estados inconsistentes entre frontend/backend.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use rusqlite::{params, params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::task::spawn_blocking;
use uuid::Uuid;
use zerocopy::AsBytes;

#[tauri::command]
pub async fn documents_pick_file() -> Result<Option<String>, String> {
    let result = spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Documents", &["pdf", "txt", "md"])
            .add_filter("PDF", &["pdf"])
            .add_filter("Text", &["txt", "md"])
            .pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn documents_pick_folder() -> Result<Option<String>, String> {
    let result = spawn_blocking(|| rfd::FileDialog::new().pick_folder())
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.map(|p| p.to_string_lossy().to_string()))
}

use crate::vec_db::{VecDb, EMBEDDING_DIM};

const EMBED_BATCH_SIZE: usize = 32;
const CHUNK_TARGET_CHARS: usize = 4000;
const CHUNK_OVERLAP_CHARS: usize = 400;
const EMBED_MODEL: &str = "openai/text-embedding-3-small";
const EMBED_URL: &str = "https://openrouter.ai/api/v1/embeddings";
const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;

pub struct DocDb(Mutex<Option<Connection>>);

impl DocDb {
    pub fn new() -> Self {
        DocDb(Mutex::new(None))
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentStatusEvent {
    document_id: String,
    status: String,
    error_message: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentInfo {
    id: String,
    name: String,
    original_path: Option<String>,
    mime: String,
    size: i64,
    status: String,
    error_message: Option<String>,
    created_at: i64,
    updated_at: i64,
    doc_type: String,
    parent_folder_id: Option<String>,
    last_modified_ms: Option<i64>,
    is_external: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkResult {
    document_id: String,
    document_name: String,
    chunk_index: i64,
    snippet: String,
    distance: f64,
}

#[derive(Deserialize)]
struct EmbeddingApiResponse {
    data: Vec<EmbeddingApiEntry>,
}

#[derive(Deserialize)]
struct EmbeddingApiEntry {
    embedding: Vec<f32>,
    #[serde(default)]
    index: usize,
}

fn doc_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create app_data_dir: {}", e))?;
    Ok(dir.join("monet.db"))
}

fn documents_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {}", e))?
        .join("documents");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create documents folder: {}", e))?;
    Ok(dir)
}

fn open_doc_db(app: &AppHandle) -> Result<Connection, String> {
    let path = doc_db_path(app)?;
    let conn = Connection::open(&path).map_err(|e| format!("failed to open monet.db: {}", e))?;
    // O frontend (tauri-plugin-sql) abre o MESMO monet.db. Sem busy_timeout, uma
    // contenção de lock no startup falha na hora com "database is locked" — aqui
    // esperamos até 5s pelo lock em vez de falhar, reduzindo a corrida entre as
    // duas conexões (scan de watched folders vs migrations/queries do plugin).
    conn.busy_timeout(Duration::from_secs(5))
        .map_err(|e| format!("failed to set busy_timeout: {}", e))?;
    conn.pragma_update(None, "journal_mode", &"WAL")
        .map_err(|e| format!("failed to configure WAL: {}", e))?;

    // notebook_document_visibility é gerenciada exclusivamente aqui, sem FK
    // constraints. A migration v6 do tauri-plugin-sql pode tê-la criado WITH
    // FOREIGN KEY — detectamos isso via sqlite_master e recriamos limpa.
    // Não usamos migration externa para evitar race condition com Database.load()
    // do frontend (migrations do plugin rodam lazily, depois do open_doc_db).
    let existing_ddl: Option<String> = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='notebook_document_visibility'",
            [],
            |r| r.get(0),
        )
        .ok();

    let needs_recreate = existing_ddl
        .as_deref()
        .map(|ddl| ddl.to_uppercase().contains("FOREIGN KEY"))
        .unwrap_or(false);

    if needs_recreate {
        conn.execute_batch(
            "DROP TABLE notebook_document_visibility;",
        )
        .map_err(|e| format!("failed to drop legacy visibility table: {}", e))?;
    }

    if needs_recreate || existing_ddl.is_none() {
        conn.execute_batch(
            "CREATE TABLE notebook_document_visibility (
                notebook_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                PRIMARY KEY (notebook_id, document_id)
            );
            CREATE INDEX IF NOT EXISTS idx_ndv_notebook ON notebook_document_visibility(notebook_id);
            CREATE INDEX IF NOT EXISTS idx_ndv_document ON notebook_document_visibility(document_id);",
        )
        .map_err(|e| format!("failed to create visibility table: {}", e))?;
    }

    Ok(conn)
}

fn with_doc_db<F, T>(app: &AppHandle, state: &State<'_, DocDb>, f: F) -> Result<T, String>
where
    F: FnOnce(&mut Connection) -> Result<T, String>,
{
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(open_doc_db(app)?);
    }
    let conn = guard.as_mut().expect("doc_db connection initialized");
    f(conn)
}

fn detect_mime(path: &Path) -> Option<&'static str> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());
    match ext.as_deref() {
        Some("pdf") => Some("application/pdf"),
        Some("txt") => Some("text/plain"),
        Some("md") | Some("markdown") => Some("text/markdown"),
        _ => None,
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn take_tail_chars(s: &str, n: usize) -> String {
    let total = s.chars().count();
    if total <= n {
        return s.to_string();
    }
    s.chars().skip(total - n).collect()
}

fn chunk_text(text: &str) -> Vec<String> {
    let normalized = text.replace("\r\n", "\n");
    let paragraphs: Vec<&str> = normalized
        .split("\n\n")
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();

    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();

    let push_with_overlap = |chunks: &mut Vec<String>, current: &mut String| {
        let chunk = current.trim().to_string();
        if !chunk.is_empty() {
            let overlap = take_tail_chars(&chunk, CHUNK_OVERLAP_CHARS);
            chunks.push(chunk);
            *current = overlap;
            if !current.is_empty() {
                current.push_str("\n\n");
            }
        } else {
            current.clear();
        }
    };

    for para in paragraphs {
        if current.chars().count() + para.chars().count() > CHUNK_TARGET_CHARS
            && !current.trim().is_empty()
        {
            push_with_overlap(&mut chunks, &mut current);
        }

        if para.chars().count() > CHUNK_TARGET_CHARS {
            let mut buf = String::new();
            buf.push_str(&current);
            for line in para.split('\n') {
                if buf.chars().count() + line.chars().count() > CHUNK_TARGET_CHARS
                    && !buf.trim().is_empty()
                {
                    push_with_overlap(&mut chunks, &mut buf);
                }
                buf.push_str(line);
                buf.push('\n');
            }
            current = buf;
        } else {
            current.push_str(para);
            current.push_str("\n\n");
        }
    }

    let tail = current.trim().to_string();
    if !tail.is_empty() {
        chunks.push(tail);
    }

    chunks
}

async fn embed_batch(key: &str, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
    let body = serde_json::json!({
        "model": EMBED_MODEL,
        "input": texts,
        "dimensions": EMBEDDING_DIM,
    });

    let mut attempt: u32 = 0;
    loop {
        let client = reqwest::Client::new();
        let resp = client
            .post(EMBED_URL)
            .bearer_auth(key)
            .header("HTTP-Referer", "https://monet.local")
            .header("X-Title", "Monet")
            .json(&body)
            .send()
            .await;

        let resp = match resp {
            Ok(r) => r,
            Err(e) => {
                if e.is_connect() || e.is_timeout() {
                    return Err("No connection. Indexing requires internet access.".into());
                }
                eprintln!("OpenRouter embeddings network error: {}", e);
                return Err("Embedding generation failed. Please try again.".into());
            }
        };

        let status = resp.status();
        if status.as_u16() == 429 {
            attempt += 1;
            if attempt > 5 {
                return Err(
                    "Rate limit exceeded. Please try again in a few minutes.".into(),
                );
            }
            // Backoff exponencial com jitter para evitar thundering herd quando
            // múltiplos lotes retornam 429 ao mesmo tempo. Jitter derivado dos
            // nanos do clock — sem dependência adicional.
            let backoff_secs = 2u64.saturating_pow(attempt);
            let jitter_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| (d.subsec_nanos() as u64) % (backoff_secs * 1000).max(1))
                .unwrap_or(0);
            let total = Duration::from_secs(backoff_secs) + Duration::from_millis(jitter_ms);
            tokio::time::sleep(total).await;
            continue;
        }

        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            eprintln!("OpenRouter embeddings {} body: {}", status, body_text);
            return Err("Embedding generation failed. Please try again.".into());
        }

        let parsed: EmbeddingApiResponse = match resp.json().await {
            Ok(v) => v,
            Err(e) => {
                eprintln!("OpenRouter embeddings parse error: {}", e);
                return Err("Embedding generation failed. Please try again.".into());
            }
        };

        let mut entries = parsed.data;
        if entries.len() != texts.len() {
            eprintln!(
                "OpenRouter returned {} embeddings for {} entries",
                entries.len(),
                texts.len()
            );
            return Err("Embedding generation failed. Please try again.".into());
        }
        entries.sort_by_key(|e| e.index);

        for (i, e) in entries.iter().enumerate() {
            if e.embedding.len() != EMBEDDING_DIM {
                eprintln!(
                    "Embedding {} has dimension {}, expected {}",
                    i,
                    e.embedding.len(),
                    EMBEDDING_DIM
                );
                return Err("Embedding generation failed. Please try again.".into());
            }
        }

        return Ok(entries.into_iter().map(|e| e.embedding).collect());
    }
}

fn store_chunks(
    app: &AppHandle,
    document_id: &str,
    source_name: &str,
    chunks: &[String],
    embeddings: &[Vec<f32>],
) -> Result<(), String> {
    let state = app.state::<VecDb>();
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("failed to start transaction: {}", e))?;

    for (idx, (chunk, emb)) in chunks.iter().zip(embeddings.iter()).enumerate() {
        if emb.len() != EMBEDDING_DIM {
            return Err(format!(
                "embedding {} dim {} != {}",
                idx,
                emb.len(),
                EMBEDDING_DIM
            ));
        }
        // chunks_meta.rowid é INTEGER PRIMARY KEY (alias de rowid),
        // então o SQLite atribui automaticamente. Pegamos o valor com
        // last_insert_rowid e usamos como rowid em vec_chunks para
        // garantir o pareamento sem depender de MAX(rowid)+1.
        tx.execute(
            "INSERT INTO chunks_meta(document_id, source_name, content, chunk_index)
             VALUES (?1, ?2, ?3, ?4)",
            params![document_id, source_name, chunk, idx as i64],
        )
        .map_err(|e| format!("failed to insert metadata {}: {}", idx, e))?;

        let rowid = tx.last_insert_rowid();

        tx.execute(
            "INSERT INTO vec_chunks(rowid, embedding) VALUES (?1, ?2)",
            params![rowid, emb.as_bytes()],
        )
        .map_err(|e| format!("failed to insert vector {}: {}", idx, e))?;
    }

    tx.commit()
        .map_err(|e| format!("failed to commit transaction: {}", e))?;
    Ok(())
}

fn delete_chunks_for_document(app: &AppHandle, document_id: &str) -> Result<(), String> {
    let state = app.state::<VecDb>();
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("failed to start transaction: {}", e))?;

    tx.execute(
        "DELETE FROM vec_chunks WHERE rowid IN (SELECT rowid FROM chunks_meta WHERE document_id = ?1)",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete vectors: {}", e))?;
    tx.execute(
        "DELETE FROM chunks_meta WHERE document_id = ?1",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete chunks_meta: {}", e))?;

    tx.commit()
        .map_err(|e| format!("failed to commit deletion: {}", e))?;
    Ok(())
}

fn update_document_status(
    app: &AppHandle,
    document_id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<(), String> {
    let state = app.state::<DocDb>();
    with_doc_db(app, &state, |conn| {
        conn.execute(
            "UPDATE documents SET status = ?1, error_message = ?2, updated_at = ?3 WHERE id = ?4",
            params![status, error_message, now_ms(), document_id],
        )
        .map_err(|e| format!("failed to update status: {}", e))?;
        Ok(())
    })
}

fn emit_status(
    app: &AppHandle,
    document_id: &str,
    status: &str,
    error_message: Option<&str>,
) {
    let _ = app.emit(
        "documents://status",
        DocumentStatusEvent {
            document_id: document_id.to_string(),
            status: status.to_string(),
            error_message: error_message.map(|s| s.to_string()),
        },
    );
}

async fn read_document_text(path: PathBuf, mime: String) -> Result<String, String> {
    if mime == "application/pdf" {
        let path_clone = path.clone();
        let join = spawn_blocking(move || pdf_extract::extract_text(&path_clone)).await;
        let text = match join {
            Err(e) if e.is_panic() => {
                return Err("Corrupted PDF or unsupported format".into());
            }
            Err(e) => {
                eprintln!("pdf_extract join error: {}", e);
                return Err("Failed to process PDF".into());
            }
            Ok(Err(e)) => {
                eprintln!("pdf_extract error: {}", e);
                return Err("Corrupted PDF or unsupported format".into());
            }
            Ok(Ok(t)) => t,
        };
        if text.trim().is_empty() {
            return Err("PDF has no extractable text (may be scanned)".into());
        }
        Ok(text)
    } else {
        let text = match spawn_blocking(move || fs::read_to_string(&path)).await {
            Err(e) => {
                eprintln!("read_to_string join error: {}", e);
                return Err("Failed to read file".into());
            }
            Ok(Err(e)) if e.kind() == std::io::ErrorKind::InvalidData => {
                return Err("File is not valid UTF-8 text".into());
            }
            Ok(Err(e)) => {
                eprintln!("read_to_string io error: {}", e);
                return Err("Failed to read file".into());
            }
            Ok(Ok(t)) => t,
        };
        if text.trim().is_empty() {
            return Err("Empty file".into());
        }
        Ok(text)
    }
}

async fn run_indexing(
    app: AppHandle,
    document_id: String,
    source_name: String,
    path: PathBuf,
    mime: String,
) {
    emit_status(&app, &document_id, "indexing", None);

    let key = match crate::read_key(&app, "openrouter_key") {
        Some(k) => k,
        None => {
            let msg = "OpenRouter key not configured";
            let _ = update_document_status(&app, &document_id, "error", Some(msg));
            emit_status(&app, &document_id, "error", Some(msg));
            return;
        }
    };

    let text = match read_document_text(path, mime).await {
        Ok(t) => t,
        Err(e) => {
            let _ = update_document_status(&app, &document_id, "error", Some(&e));
            emit_status(&app, &document_id, "error", Some(&e));
            return;
        }
    };

    let chunks = chunk_text(&text);
    if chunks.is_empty() {
        let msg = "No indexable content found";
        let _ = update_document_status(&app, &document_id, "error", Some(msg));
        emit_status(&app, &document_id, "error", Some(msg));
        return;
    }

    let mut all_embeddings: Vec<Vec<f32>> = Vec::with_capacity(chunks.len());
    for batch in chunks.chunks(EMBED_BATCH_SIZE) {
        let batch_vec: Vec<String> = batch.to_vec();
        match embed_batch(&key, &batch_vec).await {
            Ok(embs) => all_embeddings.extend(embs),
            Err(e) => {
                let _ = update_document_status(&app, &document_id, "error", Some(&e));
                emit_status(&app, &document_id, "error", Some(&e));
                return;
            }
        }
    }

    if let Err(e) = store_chunks(
        &app,
        &document_id,
        &source_name,
        &chunks,
        &all_embeddings,
    ) {
        let _ = update_document_status(&app, &document_id, "error", Some(&e));
        emit_status(&app, &document_id, "error", Some(&e));
        return;
    }

    if let Err(e) = update_document_status(&app, &document_id, "available", None) {
        emit_status(&app, &document_id, "error", Some(&e));
        return;
    }
    emit_status(&app, &document_id, "available", None);
}

#[tauri::command]
pub async fn documents_upload_global(
    app: AppHandle,
    state: State<'_, DocDb>,
    source_path: String,
) -> Result<String, String> {
    let src = PathBuf::from(&source_path);
    let mime = detect_mime(&src)
        .ok_or_else(|| "Unsupported file type (only .pdf, .txt, .md are accepted)".to_string())?;

    let metadata =
        fs::metadata(&src).map_err(|e| format!("could not read file: {}", e))?;
    if !metadata.is_file() {
        return Err("Path does not point to a file".into());
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!(
            "File too large ({:.1} MB). Limit: {} MB.",
            metadata.len() as f64 / (1024.0 * 1024.0),
            MAX_FILE_BYTES / (1024 * 1024)
        ));
    }
    if metadata.len() == 0 {
        return Err("Empty file".into());
    }
    let size = metadata.len() as i64;

    let name = src
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "document".to_string());

    let id = Uuid::new_v4().to_string();
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin")
        .to_lowercase();
    let dest = documents_dir(&app)?.join(format!("{}.{}", id, ext));

    fs::copy(&src, &dest).map_err(|e| format!("failed to copy file: {}", e))?;

    let dest_str = dest.to_string_lossy().to_string();
    let now = now_ms();

    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "INSERT INTO documents (id, name, original_path, mime, size, status, error_message, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'indexing', NULL, ?6, ?6)",
            params![id, name, dest_str, mime, size, now],
        )
        .map_err(|e| format!("failed to insert document: {}", e))?;
        Ok(())
    })?;

    let app_clone = app.clone();
    let id_clone = id.clone();
    let name_clone = name.clone();
    let mime_str = mime.to_string();
    tauri::async_runtime::spawn(async move {
        run_indexing(app_clone, id_clone, name_clone, dest, mime_str).await;
    });

    Ok(id)
}

#[tauri::command]
pub async fn documents_reindex(
    app: AppHandle,
    state: State<'_, DocDb>,
    document_id: String,
) -> Result<(), String> {
    // Lê metadados e marca status='indexing' atomicamente. Se já estava
    // 'indexing', retorna sem fazer nada (evita corrupção por duplo-clique
    // em "retentar").
    let row: Option<(String, String, String)> =
        with_doc_db(&app, &state, |conn| {
            let tx = conn
                .transaction()
                .map_err(|e| format!("failed to start transaction: {}", e))?;

            let result: Result<(String, String, String, String), rusqlite::Error> =
                tx.query_row(
                    "SELECT name, original_path, mime, status
                     FROM documents WHERE id = ?1",
                    params![document_id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
                );

            let (name, original_path, mime, status) = match result {
                Ok(row) => row,
                Err(e) => {
                    return Err(format!("document not found: {}", e));
                }
            };

            if status == "indexing" {
                tx.commit().ok();
                return Ok(None);
            }

            tx.execute(
                "UPDATE documents SET status = 'indexing', error_message = NULL, updated_at = ?1 WHERE id = ?2",
                params![now_ms(), document_id],
            )
            .map_err(|e| format!("failed to mark reindex: {}", e))?;

            tx.commit()
                .map_err(|e| format!("failed to commit reindex: {}", e))?;

            Ok(Some((name, original_path, mime)))
        })?;

    let Some((name, original_path, mime)) = row else {
        return Ok(());
    };

    delete_chunks_for_document(&app, &document_id)?;

    let path = PathBuf::from(original_path);
    let app_clone = app.clone();
    let id_clone = document_id.clone();
    tauri::async_runtime::spawn(async move {
        run_indexing(app_clone, id_clone, name, path, mime).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn documents_delete(
    app: AppHandle,
    state: State<'_, DocDb>,
    document_id: String,
) -> Result<(), String> {
    let (original_path, is_external): (Option<String>, bool) = with_doc_db(&app, &state, |conn| {
        match conn.query_row(
            "SELECT original_path, is_external FROM documents WHERE id = ?1",
            params![document_id],
            |r| Ok((r.get::<_, Option<String>>(0)?, r.get::<_, i64>(1).map(|v| v != 0).unwrap_or(false))),
        ) {
            Ok(v) => Ok(v),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok((None, false)),
            Err(e) => Err(format!("failed to query document: {}", e)),
        }
    })?;

    delete_chunks_for_document(&app, &document_id)?;

    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "DELETE FROM notebook_document_visibility WHERE document_id = ?1",
            params![document_id],
        )
        .map_err(|e| format!("failed to clear visibility: {}", e))?;
        conn.execute(
            "DELETE FROM documents WHERE id = ?1",
            params![document_id],
        )
        .map_err(|e| format!("failed to delete document: {}", e))?;
        Ok(())
    })?;

    if let Some(path) = original_path {
        if !is_external {
            let _ = fs::remove_file(PathBuf::from(path));
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn documents_list_global(
    app: AppHandle,
    state: State<'_, DocDb>,
) -> Result<Vec<DocumentInfo>, String> {
    with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, original_path, mime, size, status, error_message, created_at, updated_at,
                        type, parent_folder_id, last_modified_ms, is_external
                 FROM documents ORDER BY created_at DESC",
            )
            .map_err(|e| format!("failed to prepare listing: {}", e))?;
        let rows = stmt
            .query_map([], |r| {
                Ok(DocumentInfo {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    original_path: r.get(2)?,
                    mime: r.get(3)?,
                    size: r.get(4)?,
                    status: r.get(5)?,
                    error_message: r.get(6)?,
                    created_at: r.get(7)?,
                    updated_at: r.get(8)?,
                    doc_type: r.get::<_, Option<String>>(9)?.unwrap_or_else(|| "file".to_string()),
                    parent_folder_id: r.get(10)?,
                    last_modified_ms: r.get(11)?,
                    is_external: r.get::<_, i64>(12).map(|v| v != 0).unwrap_or(false),
                })
            })
            .map_err(|e| format!("failed to list: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("invalid row: {}", e))?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub async fn documents_set_notebook_visibility(
    app: AppHandle,
    state: State<'_, DocDb>,
    notebook_id: String,
    document_id: String,
    visible: bool,
) -> Result<(), String> {
    with_doc_db(&app, &state, |conn| {
        if visible {
            conn.execute(
                "INSERT OR IGNORE INTO notebook_document_visibility (notebook_id, document_id)
                 VALUES (?1, ?2)",
                params![notebook_id, document_id],
            )
            .map_err(|e| format!("failed to set visibility: {}", e))?;
        } else {
            conn.execute(
                "DELETE FROM notebook_document_visibility
                 WHERE notebook_id = ?1 AND document_id = ?2",
                params![notebook_id, document_id],
            )
            .map_err(|e| format!("failed to clear visibility: {}", e))?;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn documents_get_notebook_visible_ids(
    app: AppHandle,
    state: State<'_, DocDb>,
    notebook_id: String,
) -> Result<Vec<String>, String> {
    with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT document_id FROM notebook_document_visibility
                 WHERE notebook_id = ?1",
            )
            .map_err(|e| format!("failed to prepare visibility query: {}", e))?;
        let rows = stmt
            .query_map(params![notebook_id], |r| r.get::<_, String>(0))
            .map_err(|e| format!("failed to query visibility: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("invalid visibility row: {}", e))?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub async fn documents_get_notebooks_with_visible_docs(
    app: AppHandle,
    state: State<'_, DocDb>,
) -> Result<Vec<String>, String> {
    with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare("SELECT DISTINCT notebook_id FROM notebook_document_visibility")
            .map_err(|e| format!("failed to query: {}", e))?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| format!("failed to list: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("invalid row: {}", e))?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub async fn documents_search_by_ids(
    app: AppHandle,
    document_ids: Vec<String>,
    query_embedding: Vec<f32>,
    top_k: usize,
) -> Result<Vec<ChunkResult>, String> {
    if document_ids.is_empty() {
        return Ok(vec![]);
    }
    if query_embedding.len() != EMBEDDING_DIM {
        return Err(format!(
            "embedding tem {} dim, esperado {}",
            query_embedding.len(),
            EMBEDDING_DIM
        ));
    }
    let target_k = top_k.max(1);
    // sqlite-vec aplica o filtro de document_id depois do KNN global, então
    // sobre-amostramos para garantir que sobrem ao menos `target_k` chunks
    // dos documentos alvos após o filtro. Teto de 200 evita varredura excessiva.
    let scan_k = target_k.saturating_mul(5).min(200) as i64;

    let placeholders = std::iter::repeat("?")
        .take(document_ids.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT cm.document_id, cm.source_name, cm.content, cm.chunk_index, vc.distance
         FROM vec_chunks vc
         JOIN chunks_meta cm ON cm.rowid = vc.rowid
         WHERE vc.embedding MATCH ?
           AND vc.k = ?
           AND vc.rowid IN (SELECT rowid FROM chunks_meta WHERE document_id IN ({}))
         ORDER BY vc.distance
         LIMIT ?",
        placeholders
    );

    let state = app.state::<VecDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("failed to prepare search: {}", e))?;

    // Monta lista de parâmetros: [embedding_bytes, scan_k, doc_ids..., target_k]
    let embedding_bytes = query_embedding.as_bytes().to_vec();
    let mut binders: Vec<Box<dyn rusqlite::ToSql>> = Vec::with_capacity(3 + document_ids.len());
    binders.push(Box::new(embedding_bytes));
    binders.push(Box::new(scan_k));
    for id in &document_ids {
        binders.push(Box::new(id.clone()));
    }
    binders.push(Box::new(target_k as i64));

    let rows = stmt
        .query_map(params_from_iter(binders.iter().map(|b| b.as_ref())), |r| {
            Ok(ChunkResult {
                document_id: r.get(0)?,
                document_name: r.get(1)?,
                chunk_index: r.get(3)?,
                snippet: r.get(2)?,
                distance: r.get(4)?,
            })
        })
        .map_err(|e| format!("search failed: {}", e))?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("invalid row: {}", e))?);
    }
    Ok(out)
}

#[tauri::command]
pub async fn embed_text(app: AppHandle, text: String) -> Result<Vec<f32>, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("empty text".into());
    }
    let key = crate::read_key(&app, "openrouter_key")
        .ok_or_else(|| "OpenRouter key not configured".to_string())?;
    let batch = vec![trimmed.to_string()];
    let mut embs = embed_batch(&key, &batch).await?;
    embs.pop().ok_or_else(|| "API returned no embedding".into())
}

#[tauri::command]
pub async fn documents_add_watched_folder(
    app: AppHandle,
    state: State<'_, DocDb>,
    folder_path: String,
) -> Result<String, String> {
    let meta = fs::metadata(&folder_path)
        .map_err(|e| format!("cannot access folder: {}", e))?;
    if !meta.is_dir() {
        return Err("Path does not point to a directory".into());
    }

    let id = Uuid::new_v4().to_string();
    let name = Path::new(&folder_path)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| folder_path.clone());
    let now = now_ms();

    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "INSERT INTO documents (id, name, original_path, mime, size, status, error_message,
                                    created_at, updated_at, type, parent_folder_id,
                                    last_modified_ms, is_external)
             VALUES (?1, ?2, ?3, 'inode/directory', 0, 'indexing', NULL,
                     ?4, ?4, 'folder', NULL, NULL, 1)",
            params![id, name, folder_path, now],
        )
        .map_err(|e| format!("failed to insert folder: {}", e))?;
        Ok(())
    })?;

    let app_clone = app.clone();
    let id_clone = id.clone();
    tauri::async_runtime::spawn(async move {
        scan_watched_folder_async(app_clone, id_clone).await;
    });

    Ok(id)
}

fn delete_folder_child(app: &AppHandle, doc_id: &str) -> Result<(), String> {
    delete_chunks_for_document(app, doc_id)?;
    let state = app.state::<DocDb>();
    with_doc_db(app, &state, |conn| {
        conn.execute(
            "DELETE FROM notebook_document_visibility WHERE document_id = ?1",
            params![doc_id],
        )
        .map_err(|e| format!("failed to clear visibility: {}", e))?;
        conn.execute(
            "DELETE FROM documents WHERE id = ?1",
            params![doc_id],
        )
        .map_err(|e| format!("failed to delete document: {}", e))?;
        Ok(())
    })
}

fn collect_files_recursive(dir: &Path) -> Vec<(PathBuf, i64)> {
    let mut result = Vec::new();
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("scan_watched_folder: cannot read dir {:?}: {}", dir, e);
            return result;
        }
    };
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("scan_watched_folder: entry error: {}", e);
                continue;
            }
        };
        let path = entry.path();
        let meta = match std::fs::metadata(&path) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("scan_watched_folder: cannot stat {:?}: {}", path, e);
                continue;
            }
        };
        if meta.file_type().is_symlink() {
            continue;
        }
        if meta.is_dir() {
            result.extend(collect_files_recursive(&path));
        } else if meta.is_file() {
            if detect_mime(&path).is_none() {
                continue;
            }
            let last_modified_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            result.push((path, last_modified_ms));
        }
    }
    result
}

async fn scan_watched_folder_async(app: AppHandle, folder_id: String) {
    // 7a. Read folder from DB
    let state = app.state::<DocDb>();
    let folder_path: Option<String> = match with_doc_db(&app, &state, |conn| {
        match conn.query_row(
            "SELECT original_path FROM documents WHERE id = ?1 AND type = 'folder'",
            params![folder_id],
            |r| r.get::<_, String>(0),
        ) {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("db error: {}", e)),
        }
    }) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("scan_watched_folder_async: {}", e);
            return;
        }
    };

    let folder_path = match folder_path {
        Some(p) => p,
        None => return,
    };

    // 7a-2. Emit indexing status so the frontend can show scanning feedback
    let _ = update_document_status(&app, &folder_id, "indexing", None);
    emit_status(&app, &folder_id, "indexing", None);

    // 7b. Verify folder exists on disk
    let folder_meta = fs::metadata(&folder_path);
    let folder_ok = folder_meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
    if !folder_ok {
        let msg = "Folder not found on disk";
        let _ = update_document_status(&app, &folder_id, "error", Some(msg));
        emit_status(&app, &folder_id, "error", Some(msg));
        return;
    }

    // 7c. Collect files on disk (recursive, blocking)
    let folder_path_clone = folder_path.clone();
    let files_on_disk = spawn_blocking(move || {
        collect_files_recursive(Path::new(&folder_path_clone))
    })
    .await
    .unwrap_or_default();

    // 7d. Fetch already-indexed children from DB
    let existing: Vec<(String, String, Option<i64>)> = match with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, original_path, last_modified_ms FROM documents
                 WHERE parent_folder_id = ?1 AND type = 'file'",
            )
            .map_err(|e| format!("prepare failed: {}", e))?;
        let rows = stmt
            .query_map(params![folder_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<i64>>(2)?,
                ))
            })
            .map_err(|e| format!("query failed: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("row error: {}", e))?);
        }
        Ok(out)
    }) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("scan_watched_folder_async fetch existing: {}", e);
            return;
        }
    };

    // Map: original_path -> (id, last_modified_ms)
    let mut indexed_map: std::collections::HashMap<String, (String, Option<i64>)> =
        existing.into_iter().map(|(id, path, ms)| (path, (id, ms))).collect();

    let now = now_ms();

    // 7e. Detect changes and act
    for (file_path, disk_ms) in &files_on_disk {
        let path_str = file_path.to_string_lossy().to_string();
        let mime = match detect_mime(file_path) {
            Some(m) => m,
            None => continue,
        };

        if let Some((existing_id, existing_ms)) = indexed_map.remove(&path_str) {
            // File already indexed
            let changed = existing_ms.map(|m| m != *disk_ms).unwrap_or(true);
            if changed {
                // Modified — update last_modified_ms and reindex
                let err_update = with_doc_db(&app, &state, |conn| {
                    conn.execute(
                        "UPDATE documents SET last_modified_ms = ?1, status = 'indexing',
                                              updated_at = ?2 WHERE id = ?3",
                        params![disk_ms, now, existing_id],
                    )
                    .map_err(|e| format!("update failed: {}", e))?;
                    Ok(())
                });
                if let Err(e) = err_update {
                    eprintln!("scan_watched_folder_async update: {}", e);
                }
                if let Err(e) = delete_chunks_for_document(&app, &existing_id) {
                    eprintln!("scan_watched_folder_async delete_chunks: {}", e);
                }
                let name = file_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| path_str.clone());
                let app_clone = app.clone();
                let id_clone = existing_id.clone();
                let path_clone = file_path.clone();
                let mime_str = mime.to_string();
                tauri::async_runtime::spawn(async move {
                    run_indexing(app_clone, id_clone, name, path_clone, mime_str).await;
                });
            }
            // else: unchanged — skip
        } else {
            // New file — insert and index
            let new_id = Uuid::new_v4().to_string();
            let name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| path_str.clone());
            let size = fs::metadata(file_path).map(|m| m.len() as i64).unwrap_or(0);

            let folder_id_clone = folder_id.clone();
            let new_id_clone = new_id.clone();
            let insert_result = with_doc_db(&app, &state, |conn| {
                conn.execute(
                    "INSERT INTO documents (id, name, original_path, mime, size, status,
                                            error_message, created_at, updated_at, type,
                                            parent_folder_id, last_modified_ms, is_external)
                     VALUES (?1, ?2, ?3, ?4, ?5, 'indexing', NULL,
                             ?6, ?6, 'file', ?7, ?8, 1)",
                    params![new_id_clone, name, path_str, mime, size, now, folder_id_clone, disk_ms],
                )
                .map_err(|e| format!("insert failed: {}", e))?;
                // Propagate visibility: for each notebook that has any sibling file of
                // this folder visible, also mark this new child file as visible.
                // (Visibility is stored per-file, not per-folder, so we look at siblings.)
                conn.execute(
                    "INSERT OR IGNORE INTO notebook_document_visibility (notebook_id, document_id)
                     SELECT DISTINCT notebook_id, ?2
                     FROM notebook_document_visibility
                     WHERE document_id IN (
                         SELECT id FROM documents WHERE parent_folder_id = ?1 AND type = 'file'
                     )",
                    params![folder_id_clone, new_id_clone],
                )
                .map_err(|e| format!("failed to propagate visibility: {}", e))?;
                Ok(())
            });
            if let Err(e) = insert_result {
                eprintln!("scan_watched_folder_async insert: {}", e);
                continue;
            }
            let app_clone = app.clone();
            let id_clone = new_id.clone();
            let path_clone = file_path.clone();
            let mime_str = mime.to_string();
            tauri::async_runtime::spawn(async move {
                run_indexing(app_clone, id_clone, name, path_clone, mime_str).await;
            });
        }
    }

    // 7f. Delete files removed from disk (remaining entries in indexed_map)
    for (_, (orphan_id, _)) in &indexed_map {
        if let Err(e) = delete_folder_child(&app, orphan_id) {
            eprintln!("scan_watched_folder_async delete orphan {}: {}", orphan_id, e);
        }
    }

    // 7g. Update folder status to available
    let _ = update_document_status(&app, &folder_id, "available", None);
    emit_status(&app, &folder_id, "available", None);
}

#[tauri::command]
pub async fn documents_scan_watched_folder(
    app: AppHandle,
    _state: State<'_, DocDb>,
    folder_id: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        scan_watched_folder_async(app, folder_id).await;
    });
    Ok(())
}

#[tauri::command]
pub async fn documents_delete_watched_folder(
    app: AppHandle,
    state: State<'_, DocDb>,
    folder_id: String,
) -> Result<(), String> {
    // Fetch all children
    let children: Vec<String> = with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id FROM documents WHERE parent_folder_id = ?1")
            .map_err(|e| format!("prepare failed: {}", e))?;
        let rows = stmt
            .query_map(params![folder_id], |r| r.get::<_, String>(0))
            .map_err(|e| format!("query failed: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("row error: {}", e))?);
        }
        Ok(out)
    })?;

    for child_id in &children {
        if let Err(e) = delete_folder_child(&app, child_id) {
            eprintln!("documents_delete_watched_folder child {}: {}", child_id, e);
        }
    }

    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "DELETE FROM notebook_document_visibility WHERE document_id = ?1",
            params![folder_id],
        )
        .map_err(|e| format!("failed to clear visibility: {}", e))?;
        conn.execute(
            "DELETE FROM documents WHERE id = ?1",
            params![folder_id],
        )
        .map_err(|e| format!("failed to delete folder: {}", e))?;
        Ok(())
    })
}

pub async fn scan_all_watched_folders_on_startup(app: AppHandle) {
    // Wait for DB file to exist (mirrors cleanup_stuck_indexing pattern)
    for _ in 0..30 {
        if doc_db_path(&app).map(|p| p.exists()).unwrap_or(false) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    let state = app.state::<DocDb>();
    let folder_ids: Vec<String> = match with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id FROM documents WHERE type = 'folder'")
            .map_err(|e| format!("prepare failed: {}", e))?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| format!("query failed: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("row error: {}", e))?);
        }
        Ok(out)
    }) {
        Ok(ids) => ids,
        Err(e) => {
            eprintln!("scan_all_watched_folders_on_startup: {}", e);
            return;
        }
    };

    for folder_id in folder_ids {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            scan_watched_folder_async(app_clone, folder_id).await;
        });
    }
}

pub async fn cleanup_stuck_indexing(app: AppHandle) {
    for _ in 0..30 {
        if doc_db_path(&app).map(|p| p.exists()).unwrap_or(false) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    let state = app.state::<DocDb>();
    let result = with_doc_db(&app, &state, |conn| {
        conn.execute(
            "UPDATE documents SET status = 'error', error_message = ?1, updated_at = ?2 WHERE status = 'indexing'",
            params!["Indexing interrupted (app closed)", now_ms()],
        )
        .map_err(|e| format!("cleanup failed: {}", e))?;
        Ok(())
    });

    if let Err(e) = result {
        eprintln!("cleanup_stuck_indexing: {}", e);
    }
}
