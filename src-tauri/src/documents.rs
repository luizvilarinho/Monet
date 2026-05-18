// monet.db é compartilhado com o frontend via tauri-plugin-sql, mas a tabela
// `documents` é gerenciada exclusivamente por este módulo (DocDb / rusqlite).
// O frontend só lê documentos via `documents_list` — não escreve direto na
// tabela. Manter este invariante evita conflito de locks com o backend e
// estados inconsistentes entre frontend/backend.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use rusqlite::{params, Connection};
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

use crate::vec_db::{VecDb, EMBEDDING_DIM};

const EMBED_BATCH_SIZE: usize = 32;
const CHUNK_TARGET_CHARS: usize = 4000;
const CHUNK_OVERLAP_CHARS: usize = 400;
const EMBED_MODEL: &str = "google/gemini-embedding-2-preview";
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
    notebook_id: String,
    status: String,
    error_message: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentInfo {
    id: String,
    notebook_id: String,
    name: String,
    mime: String,
    size: i64,
    status: String,
    error_message: Option<String>,
    created_at: i64,
    updated_at: i64,
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
    conn.pragma_update(None, "journal_mode", &"WAL")
        .map_err(|e| format!("failed to configure WAL: {}", e))?;
    conn.pragma_update(None, "foreign_keys", &true)
        .map_err(|e| format!("failed to enable foreign_keys: {}", e))?;
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
    notebook_id: &str,
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
            "INSERT INTO chunks_meta(document_id, notebook_id, source_name, content, chunk_index)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![document_id, notebook_id, source_name, chunk, idx as i64],
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
    notebook_id: &str,
    status: &str,
    error_message: Option<&str>,
) {
    let _ = app.emit(
        "documents://status",
        DocumentStatusEvent {
            document_id: document_id.to_string(),
            notebook_id: notebook_id.to_string(),
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
    notebook_id: String,
    source_name: String,
    path: PathBuf,
    mime: String,
) {
    emit_status(&app, &document_id, &notebook_id, "indexing", None);

    let key = match crate::read_key(&app, "openrouter_key") {
        Some(k) => k,
        None => {
            let msg = "OpenRouter key not configured";
            let _ = update_document_status(&app, &document_id, "error", Some(msg));
            emit_status(&app, &document_id, &notebook_id, "error", Some(msg));
            return;
        }
    };

    let text = match read_document_text(path, mime).await {
        Ok(t) => t,
        Err(e) => {
            let _ = update_document_status(&app, &document_id, "error", Some(&e));
            emit_status(&app, &document_id, &notebook_id, "error", Some(&e));
            return;
        }
    };

    let chunks = chunk_text(&text);
    if chunks.is_empty() {
        let msg = "No indexable content found";
        let _ = update_document_status(&app, &document_id, "error", Some(msg));
        emit_status(&app, &document_id, &notebook_id, "error", Some(msg));
        return;
    }

    let mut all_embeddings: Vec<Vec<f32>> = Vec::with_capacity(chunks.len());
    for batch in chunks.chunks(EMBED_BATCH_SIZE) {
        let batch_vec: Vec<String> = batch.to_vec();
        match embed_batch(&key, &batch_vec).await {
            Ok(embs) => all_embeddings.extend(embs),
            Err(e) => {
                let _ = update_document_status(&app, &document_id, "error", Some(&e));
                emit_status(&app, &document_id, &notebook_id, "error", Some(&e));
                return;
            }
        }
    }

    if let Err(e) = store_chunks(
        &app,
        &document_id,
        &notebook_id,
        &source_name,
        &chunks,
        &all_embeddings,
    ) {
        let _ = update_document_status(&app, &document_id, "error", Some(&e));
        emit_status(&app, &document_id, &notebook_id, "error", Some(&e));
        return;
    }

    if let Err(e) = update_document_status(&app, &document_id, "available", None) {
        emit_status(&app, &document_id, &notebook_id, "error", Some(&e));
        return;
    }
    emit_status(&app, &document_id, &notebook_id, "available", None);
}

#[tauri::command]
pub async fn documents_upload(
    app: AppHandle,
    state: State<'_, DocDb>,
    notebook_id: String,
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
            "INSERT INTO documents (id, notebook_id, name, original_path, mime, size, status, error_message, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'indexing', NULL, ?7, ?7)",
            params![id, notebook_id, name, dest_str, mime, size, now],
        )
        .map_err(|e| format!("failed to insert document: {}", e))?;
        Ok(())
    })?;

    let app_clone = app.clone();
    let id_clone = id.clone();
    let nb_clone = notebook_id.clone();
    let name_clone = name.clone();
    let mime_str = mime.to_string();
    tauri::async_runtime::spawn(async move {
        run_indexing(app_clone, id_clone, nb_clone, name_clone, dest, mime_str).await;
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
    let row: Option<(String, String, String, String)> =
        with_doc_db(&app, &state, |conn| {
            let tx = conn
                .transaction()
                .map_err(|e| format!("failed to start transaction: {}", e))?;

            let result: Result<(String, String, String, String, String), rusqlite::Error> =
                tx.query_row(
                    "SELECT notebook_id, name, original_path, mime, status
                     FROM documents WHERE id = ?1",
                    params![document_id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
                );

            let (notebook_id, name, original_path, mime, status) = match result {
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

            Ok(Some((notebook_id, name, original_path, mime)))
        })?;

    let Some((notebook_id, name, original_path, mime)) = row else {
        return Ok(());
    };

    delete_chunks_for_document(&app, &document_id)?;

    let path = PathBuf::from(original_path);
    let app_clone = app.clone();
    let id_clone = document_id.clone();
    tauri::async_runtime::spawn(async move {
        run_indexing(app_clone, id_clone, notebook_id, name, path, mime).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn documents_delete(
    app: AppHandle,
    state: State<'_, DocDb>,
    document_id: String,
) -> Result<(), String> {
    let original_path: Option<String> = with_doc_db(&app, &state, |conn| {
        match conn.query_row(
            "SELECT original_path FROM documents WHERE id = ?1",
            params![document_id],
            |r| r.get::<_, String>(0),
        ) {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("failed to query document: {}", e)),
        }
    })?;

    delete_chunks_for_document(&app, &document_id)?;

    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "DELETE FROM documents WHERE id = ?1",
            params![document_id],
        )
        .map_err(|e| format!("failed to delete document: {}", e))?;
        Ok(())
    })?;

    if let Some(path) = original_path {
        let _ = fs::remove_file(PathBuf::from(path));
    }

    Ok(())
}

#[tauri::command]
pub async fn documents_list(
    app: AppHandle,
    state: State<'_, DocDb>,
    notebook_id: String,
) -> Result<Vec<DocumentInfo>, String> {
    with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, notebook_id, name, mime, size, status, error_message, created_at, updated_at
                 FROM documents WHERE notebook_id = ?1 ORDER BY created_at DESC",
            )
            .map_err(|e| format!("failed to prepare listing: {}", e))?;
        let rows = stmt
            .query_map(params![notebook_id], |r| {
                Ok(DocumentInfo {
                    id: r.get(0)?,
                    notebook_id: r.get(1)?,
                    name: r.get(2)?,
                    mime: r.get(3)?,
                    size: r.get(4)?,
                    status: r.get(5)?,
                    error_message: r.get(6)?,
                    created_at: r.get(7)?,
                    updated_at: r.get(8)?,
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
pub async fn documents_search(
    app: AppHandle,
    notebook_id: String,
    query_embedding: Vec<f32>,
    top_k: usize,
) -> Result<Vec<ChunkResult>, String> {
    if query_embedding.len() != EMBEDDING_DIM {
        return Err(format!(
            "embedding tem {} dim, esperado {}",
            query_embedding.len(),
            EMBEDDING_DIM
        ));
    }
    let target_k = top_k.max(1);
    // sqlite-vec aplica o filtro de notebook_id depois do KNN global, então
    // sobre-amostramos para garantir que sobrem ao menos `target_k` chunks
    // do caderno alvo após o filtro. Teto de 200 evita varredura excessiva.
    let scan_k = target_k.saturating_mul(5).min(200) as i64;

    let state = app.state::<VecDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT cm.document_id, cm.source_name, cm.content, cm.chunk_index, vc.distance
             FROM vec_chunks vc
             JOIN chunks_meta cm ON cm.rowid = vc.rowid
             WHERE vc.embedding MATCH ?1
               AND vc.k = ?2
               AND vc.rowid IN (SELECT rowid FROM chunks_meta WHERE notebook_id = ?3)
             ORDER BY vc.distance
             LIMIT ?4",
        )
        .map_err(|e| format!("failed to prepare search: {}", e))?;

    let rows = stmt
        .query_map(
            params![query_embedding.as_bytes(), scan_k, notebook_id, target_k as i64],
            |r| {
                Ok(ChunkResult {
                    document_id: r.get(0)?,
                    document_name: r.get(1)?,
                    chunk_index: r.get(3)?,
                    snippet: r.get(2)?,
                    distance: r.get(4)?,
                })
            },
        )
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
