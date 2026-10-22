// monet.db é compartilhado com o frontend via tauri-plugin-sql, mas as tabelas
// `documents` e `notebook_document_visibility` são gerenciadas exclusivamente
// por este módulo (DocDb / rusqlite). O frontend só lê documentos via
// `documents_list_global` — não escreve direto. Manter este invariante evita
// conflito de locks com o backend e estados inconsistentes entre frontend/backend.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
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

#[tauri::command]
pub async fn documents_pick_folder() -> Result<Option<String>, String> {
    let result = spawn_blocking(|| rfd::FileDialog::new().pick_folder())
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.map(|p| p.to_string_lossy().to_string()))
}

use crate::rag::ChunkResult;
use crate::vec_db::{VecDb, CURRENT_INDEX_VERSION, EMBEDDING_DIM};

const EMBED_BATCH_SIZE: usize = 32;
const CHUNK_TARGET_CHARS: usize = 4000;
const CHUNK_OVERLAP_CHARS: usize = 400;
// Pedaço de uma linha maior que o chunk. Cabe no chunk junto com o overlap
// (+ "\n\n") que abre o chunk seguinte.
const LONG_LINE_PIECE_CHARS: usize = CHUNK_TARGET_CHARS - CHUNK_OVERLAP_CHARS - 2;
// Teto do texto indexado de uma página web salva (pasta origin='ai'). Igual ao
// MAX_WEB_SOURCE_CHARS de src/lib/librarian.ts, que corta na escrita.
const MAX_WEB_SOURCE_CHARS: usize = 150_000;
const EMBED_MODEL: &str = "openai/text-embedding-3-small";
const EMBED_URL: &str = "https://openrouter.ai/api/v1/embeddings";
// Retries num 429 da indexação (backoff 2+4+8+16+32 s). A consulta do chat usa
// o seu próprio teto (rag.rs).
pub(crate) const INDEX_RATE_LIMIT_RETRIES: u32 = 5;
const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;
// Teto específico do auto-save do bibliotecário (PDFs de acesso aberto). Separado
// e mais estrito que MAX_FILE_BYTES (usado por uploads do usuário).
const LIBRARIAN_MAX_PDF_BYTES: u64 = 10 * 1024 * 1024;

// Cliente HTTP compartilhado pelo embedding, pela reescrita e pelo rerank
// (reuso de conexão TLS com o OpenRouter). Os timeouts evitam uma conexão
// pendurada para sempre; os passos do chat têm timeouts próprios, mais curtos.
pub(crate) fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

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
    origin: String,
    alias: Option<String>,
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

fn ai_web_folder_dir(app: &AppHandle, safe_chat_folder_id: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {}", e))?
        .join("web-research")
        .join(safe_chat_folder_id);
    Ok(dir)
}

// Sanitiza um id usado como componente de path com o mesmo padrão de
// save_chat_doc (lib.rs): file_name() extrai apenas o último componente; se o
// resultado diferir do input, há tentativa de escapar do diretório base.
fn safe_path_component(id: &str) -> Result<&str, String> {
    let safe = Path::new(id)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid id".to_string())?;
    if safe != id {
        return Err("Invalid id".into());
    }
    Ok(safe)
}

fn notes_folder_dir(app: &AppHandle, safe_notebook_id: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {}", e))?
        .join("notes")
        .join(safe_notebook_id);
    Ok(dir)
}

// IDs determinísticos das linhas de `documents` geradas a partir das notas.
pub(crate) fn notes_folder_doc_id(notebook_id: &str) -> String {
    format!("notes-folder:{}", notebook_id)
}

pub(crate) fn note_doc_id(note_id: &str) -> String {
    format!("note:{}", note_id)
}

const NOTES_FOLDER_READ_ONLY: &str = "Notes folders are managed by the app";

// Pastas/arquivos com origin='notes' são espelhos gerenciados pelo app: scan,
// reindex e delete genéricos são recusados.
fn reject_notes_origin(conn: &Connection, document_id: &str) -> Result<(), String> {
    match conn.query_row(
        "SELECT origin FROM documents WHERE id = ?1",
        params![document_id],
        |r| r.get::<_, String>(0),
    ) {
        Ok(origin) if origin == "notes" => Err(NOTES_FOLDER_READ_ONLY.into()),
        Ok(_) | Err(rusqlite::Error::QueryReturnedNoRows) => Ok(()),
        Err(e) => Err(format!("failed to query document: {}", e)),
    }
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

    // Toggle durável de indexação das notas por caderno: presença da linha =
    // indexação desligada para aquele caderno.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS notebook_notes_index_disabled (notebook_id TEXT PRIMARY KEY);",
    )
    .map_err(|e| format!("failed to create notes index toggle table: {}", e))?;

    // Apelido opcional de pasta indexada (exibição); sem linha = nome original.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS folder_aliases (folder_id TEXT PRIMARY KEY, alias TEXT NOT NULL);",
    )
    .map_err(|e| format!("failed to create folder aliases table: {}", e))?;

    // Conjuntos de documentos (presets de RAG), globais: `document_ids` é um
    // array JSON de ids de visibilidade (arquivos e pastas da KB).
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS document_sets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            document_ids TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );",
    )
    .map_err(|e| format!("failed to create document sets table: {}", e))?;

    // Cache do OCR das imagens das notas (ocr.rs), por SHA-256 do data URL.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS image_ocr_cache (
            hash TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );",
    )
    .map_err(|e| format!("failed to create OCR cache table: {}", e))?;

    // Reconcilia o estado de migrations do tauri-plugin-sql quando um build
    // antigo aplicou uma v11 diferente (notes_rag_doc_ids) no DB de produção.
    // O sqlx aborta o migrate por checksum mismatch na 1ª carga e o retry do
    // plugin pula o migrate, deixando reminder_state sem criar e o sistema de
    // migrations quebrado para upgrades futuros. Aqui removemos a v11 obsoleta
    // e garantimos reminder_state (idempotente) ainda no startup, antes do
    // plugin-sql carregar lazy pelo frontend. Erros aqui são apenas logados:
    // o runtime tem o safety net em TauriStorage.ensureReminderStateTable.
    let _: std::result::Result<(), rusqlite::Error> = conn.execute_batch(
        "DELETE FROM _sqlx_migrations WHERE version = 11 AND description = 'notes_rag_doc_ids';
         CREATE TABLE IF NOT EXISTS reminder_state (
             id TEXT PRIMARY KEY,
             note_id TEXT NOT NULL,
             fired_at INTEGER NOT NULL
         );",
    );

    // A visibilidade por caderno passou a guardar ids de pasta (expandidos no
    // front). Converte linhas legadas por arquivo-filho em linha da pasta-pai.
    // Idempotente; erros ignorados porque no primeiro install `documents` pode
    // ainda não existir (é criada pelas migrations do plugin).
    // Roda a cada abertura da conexão. Invariante: a tabela nunca guarda
    // arquivo-filho de pasta; um filho gravado aqui viraria a pasta inteira.
    let _: std::result::Result<(), rusqlite::Error> = conn.execute_batch(
        "INSERT OR IGNORE INTO notebook_document_visibility (notebook_id, document_id)
           SELECT DISTINCT v.notebook_id, d.parent_folder_id
           FROM notebook_document_visibility v JOIN documents d ON d.id = v.document_id
           WHERE d.parent_folder_id IS NOT NULL;
         DELETE FROM notebook_document_visibility
           WHERE document_id IN (SELECT id FROM documents WHERE parent_folder_id IS NOT NULL);",
    );

    Ok(conn)
}

pub(crate) fn with_doc_db<F, T>(app: &AppHandle, state: &State<'_, DocDb>, f: F) -> Result<T, String>
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

pub(crate) fn now_ms() -> i64 {
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

// Fatia `s` em pedaços de até `max_chars` caracteres. Sempre devolve ao menos
// um pedaço (vazio para `s` vazio).
fn split_by_chars(s: &str, max_chars: usize) -> Vec<&str> {
    let mut pieces = Vec::new();
    let mut start = 0;
    let mut count = 0;
    for (i, _) in s.char_indices() {
        if count == max_chars {
            pieces.push(&s[start..i]);
            start = i;
            count = 0;
        }
        count += 1;
    }
    pieces.push(&s[start..]);
    pieces
}

// Trecho que vira chunk, com a página (PDF) e a seção (último heading
// markdown) onde ele começa.
#[derive(Debug)]
struct ChunkPiece {
    text: String,
    page: Option<u32>,
    section: Option<String>,
}

// Texto de um heading markdown (`#` a `######` seguido de espaço).
fn md_heading(line: &str) -> Option<String> {
    let t = line.trim_start();
    let hashes = t.chars().take_while(|c| *c == '#').count();
    if hashes == 0 || hashes > 6 {
        return None;
    }
    let text = crate::rag::header_part(t[hashes..].strip_prefix(' ')?);
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

// Segmentos = (texto, página): um por página nos PDFs, um só (sem página) nos
// demais. Os parágrafos de todos os segmentos seguem o mesmo fluxo de chunking.
fn chunk_segments(segments: &[(String, Option<u32>)]) -> Vec<ChunkPiece> {
    let mut chunks: Vec<ChunkPiece> = Vec::new();
    let mut current = String::new();
    // Página e seção do chunk em construção, fixadas no 1º trecho novo depois
    // do overlap (o overlap é o fim do chunk anterior).
    let mut start: Option<(Option<u32>, Option<String>)> = None;
    let mut last_heading: Option<String> = None;

    let push_with_overlap = |chunks: &mut Vec<ChunkPiece>,
                             current: &mut String,
                             start: &mut Option<(Option<u32>, Option<String>)>| {
        let chunk = current.trim().to_string();
        let (page, section) = start.take().unwrap_or((None, None));
        if !chunk.is_empty() {
            // Overlap proporcional ao tamanho do chunk (max 1/4 dele), nao um
            // valor fixo: em regioes de paragrafos curtos (ex.: sumario do
            // livro, quebrado linha a linha), CHUNK_OVERLAP_CHARS fixo podia
            // ser 60-90% de um chunk pequeno, gerando chunks quase-duplicados
            // que dominavam o top-k da busca vetorial.
            let overlap_len = CHUNK_OVERLAP_CHARS.min(chunk.chars().count() / 4);
            let overlap = take_tail_chars(&chunk, overlap_len);
            chunks.push(ChunkPiece { text: chunk, page, section });
            *current = overlap;
            if !current.is_empty() {
                current.push_str("\n\n");
            }
        } else {
            current.clear();
        }
    };

    for (text, page) in segments {
        let normalized = text.replace("\r\n", "\n");
        let paragraphs = normalized
            .split("\n\n")
            .map(|p| p.trim())
            .filter(|p| !p.is_empty());

        for para in paragraphs {
            if current.chars().count() + para.chars().count() > CHUNK_TARGET_CHARS
                && !current.trim().is_empty()
            {
                push_with_overlap(&mut chunks, &mut current, &mut start);
            }

            if para.chars().count() > CHUNK_TARGET_CHARS {
                let mut buf = String::new();
                buf.push_str(&current);
                for line in para.split('\n') {
                    let heading = md_heading(line);
                    // Linha sem quebra maior que o chunk (HTML minificado, PDF
                    // corrido) é fatiada; inteira, virava um chunk gigante que
                    // estourava o limite do embedding.
                    let pieces = split_by_chars(line, LONG_LINE_PIECE_CHARS);
                    let last = pieces.len() - 1;
                    for (i, piece) in pieces.into_iter().enumerate() {
                        if buf.chars().count() + piece.chars().count() > CHUNK_TARGET_CHARS
                            && !buf.trim().is_empty()
                        {
                            push_with_overlap(&mut chunks, &mut buf, &mut start);
                        }
                        if start.is_none() {
                            start = Some((*page, heading.clone().or_else(|| last_heading.clone())));
                        }
                        buf.push_str(piece);
                        if i == last {
                            buf.push('\n');
                        }
                    }
                    if heading.is_some() {
                        last_heading = heading;
                    }
                }
                current = buf;
            } else {
                if start.is_none() {
                    let opening = para.lines().next().and_then(md_heading);
                    start = Some((*page, opening.or_else(|| last_heading.clone())));
                }
                current.push_str(para);
                current.push_str("\n\n");
                if let Some(h) = para.lines().filter_map(md_heading).last() {
                    last_heading = Some(h);
                }
            }
        }
    }

    let tail = current.trim().to_string();
    if !tail.is_empty() {
        let (page, section) = start.take().unwrap_or((None, None));
        chunks.push(ChunkPiece { text: tail, page, section });
    }

    chunks
}

// Chunks prontos para embutir e gravar, cada um com o seu cabeçalho. A seção
// igual ao título (o `# Título` do início do arquivo) é omitida.
fn prepare_chunks(
    meta: &crate::rag::DocMeta,
    segments: &[(String, Option<u32>)],
) -> Vec<(ChunkPiece, String)> {
    chunk_segments(segments)
        .into_iter()
        .map(|mut piece| {
            if piece.section.as_deref() == Some(meta.title.as_str()) {
                piece.section = None;
            }
            let header = crate::rag::build_header(meta, piece.section.as_deref(), piece.page);
            (piece, header)
        })
        .collect()
}

// Texto embutido = cabeçalho + "\n" + trecho; chunks_meta.content guarda só o
// trecho.
fn embed_inputs(chunks: &[(ChunkPiece, String)]) -> Vec<String> {
    chunks
        .iter()
        .map(|(piece, header)| format!("{}\n{}", header, piece.text))
        .collect()
}

// `max_rate_limit_retries`: quantos 429 seguidos tolerar (com backoff) antes
// de desistir.
pub(crate) async fn embed_batch(
    key: &str,
    texts: &[String],
    max_rate_limit_retries: u32,
) -> Result<Vec<Vec<f32>>, String> {
    let body = serde_json::json!({
        "model": EMBED_MODEL,
        "input": texts,
        "dimensions": EMBEDDING_DIM,
    });

    let mut attempt: u32 = 0;
    loop {
        let resp = http_client()
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
            if attempt > max_rate_limit_retries {
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

async fn embed_chunks(key: &str, chunks: &[String]) -> Result<Vec<Vec<f32>>, String> {
    let mut all_embeddings: Vec<Vec<f32>> = Vec::with_capacity(chunks.len());
    for batch in chunks.chunks(EMBED_BATCH_SIZE) {
        all_embeddings.extend(embed_batch(key, batch, INDEX_RATE_LIMIT_RETRIES).await?);
    }
    Ok(all_embeddings)
}

// Troca os chunks de um documento numa única transação do vec db (rusqlite):
// o documento nunca fica com chunks duplicados nem sem chunks no meio da
// troca, e uma falha antes daqui mantém o índice antigo. Grava junto o
// estado do índice (versão atual + assinatura dos metadados).
fn replace_chunks(
    app: &AppHandle,
    document_id: &str,
    source_name: &str,
    meta: &crate::rag::DocMeta,
    chunks: &[(ChunkPiece, String)],
    embeddings: &[Vec<f32>],
) -> Result<(), String> {
    let state = app.state::<VecDb>();
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    replace_chunks_conn(&mut conn, document_id, source_name, meta, chunks, embeddings)
}

fn replace_chunks_conn(
    conn: &mut Connection,
    document_id: &str,
    source_name: &str,
    meta: &crate::rag::DocMeta,
    chunks: &[(ChunkPiece, String)],
    embeddings: &[Vec<f32>],
) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("failed to start transaction: {}", e))?;

    tx.execute(
        "DELETE FROM vec_chunks WHERE rowid IN (SELECT rowid FROM chunks_meta WHERE document_id = ?1)",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete vectors: {}", e))?;
    tx.execute(
        "DELETE FROM chunks_fts WHERE rowid IN (SELECT rowid FROM chunks_meta WHERE document_id = ?1)",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete text index: {}", e))?;
    tx.execute(
        "DELETE FROM chunks_meta WHERE document_id = ?1",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete chunks_meta: {}", e))?;

    insert_chunks_tx(&tx, document_id, source_name, meta, chunks, embeddings)?;

    tx.execute(
        "INSERT OR REPLACE INTO doc_index_state (document_id, index_version, meta_sig)
         VALUES (?1, ?2, ?3)",
        params![document_id, CURRENT_INDEX_VERSION, crate::rag::meta_sig(meta)],
    )
    .map_err(|e| format!("failed to save index state: {}", e))?;

    tx.commit()
        .map_err(|e| format!("failed to commit transaction: {}", e))?;
    Ok(())
}

fn insert_chunks_tx(
    tx: &rusqlite::Transaction,
    document_id: &str,
    source_name: &str,
    meta: &crate::rag::DocMeta,
    chunks: &[(ChunkPiece, String)],
    embeddings: &[Vec<f32>],
) -> Result<(), String> {
    for (idx, ((piece, header), emb)) in chunks.iter().zip(embeddings.iter()).enumerate() {
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
            "INSERT INTO chunks_meta(document_id, source_name, content, chunk_index, header,
                                     kind, title, doc_date, folder_label, section, page, source_url)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                document_id,
                source_name,
                piece.text,
                idx as i64,
                header,
                meta.kind,
                meta.title,
                meta.doc_date,
                meta.folder_label,
                piece.section,
                piece.page,
                meta.source_url
            ],
        )
        .map_err(|e| format!("failed to insert metadata {}: {}", idx, e))?;

        let rowid = tx.last_insert_rowid();

        tx.execute(
            "INSERT INTO vec_chunks(rowid, embedding) VALUES (?1, ?2)",
            params![rowid, emb.as_bytes()],
        )
        .map_err(|e| format!("failed to insert vector {}: {}", idx, e))?;

        tx.execute(
            "INSERT INTO chunks_fts(rowid, header, content) VALUES (?1, ?2, ?3)",
            params![rowid, header, piece.text],
        )
        .map_err(|e| format!("failed to insert text index {}: {}", idx, e))?;
    }
    Ok(())
}

fn delete_chunks_for_document(app: &AppHandle, document_id: &str) -> Result<(), String> {
    let state = app.state::<VecDb>();
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    delete_chunks_conn(&mut conn, document_id)
}

fn delete_chunks_conn(conn: &mut Connection, document_id: &str) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("failed to start transaction: {}", e))?;

    tx.execute(
        "DELETE FROM vec_chunks WHERE rowid IN (SELECT rowid FROM chunks_meta WHERE document_id = ?1)",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete vectors: {}", e))?;
    tx.execute(
        "DELETE FROM chunks_fts WHERE rowid IN (SELECT rowid FROM chunks_meta WHERE document_id = ?1)",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete text index: {}", e))?;
    tx.execute(
        "DELETE FROM chunks_meta WHERE document_id = ?1",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete chunks_meta: {}", e))?;
    tx.execute(
        "DELETE FROM doc_index_state WHERE document_id = ?1",
        params![document_id],
    )
    .map_err(|e| format!("failed to delete index state: {}", e))?;

    tx.commit()
        .map_err(|e| format!("failed to commit deletion: {}", e))?;
    Ok(())
}

// (versão, assinatura) gravadas na última indexação bem-sucedida.
fn index_state(app: &AppHandle, document_id: &str) -> Result<Option<(i64, String)>, String> {
    let state = app.state::<VecDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    match conn.query_row(
        "SELECT index_version, meta_sig FROM doc_index_state WHERE document_id = ?1",
        params![document_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ) {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("failed to read index state: {}", e)),
    }
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

fn has_chunks(conn: &Connection, document_id: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM chunks_meta WHERE document_id = ?1)",
        params![document_id],
        |r| r.get(0),
    )
}

// Sem a linha de doc_index_state o documento volta a ser pendente (Update
// index, reconciliação das notas).
fn mark_outdated(conn: &Connection, document_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM doc_index_state WHERE document_id = ?1",
        params![document_id],
    )
    .map(|_| ())
}

// Status depois de uma (re)indexação interrompida: com chunks de uma indexação
// anterior, segue 'available' (pesquisável com o índice antigo); sem chunks,
// 'error'.
fn status_for_failed_index(app: &AppHandle, document_id: &str) -> &'static str {
    let state = app.state::<VecDb>();
    let Ok(conn) = state.0.lock() else {
        return "error";
    };
    if has_chunks(&conn, document_id).unwrap_or(false) {
        "available"
    } else {
        "error"
    }
}

fn mark_outdated_logged(app: &AppHandle, document_id: &str) {
    let state = app.state::<VecDb>();
    let result = match state.0.lock() {
        Ok(conn) => mark_outdated(&conn, document_id).map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    };
    if let Err(e) = result {
        eprintln!("mark_outdated {}: {}", document_id, e);
    }
}

// Falha de (re)indexação: com chunks antigos, fica 'available' e pendente
// (perde a linha de doc_index_state); sem chunks, vira 'error'.
fn status_after_index_failure(app: &AppHandle, document_id: &str) -> &'static str {
    let status = status_for_failed_index(app, document_id);
    if status == "available" {
        mark_outdated_logged(app, document_id);
    }
    status
}

fn mark_index_failed(app: &AppHandle, document_id: &str, error_message: &str) {
    let status = status_after_index_failure(app, document_id);
    let _ = update_document_status(app, document_id, status, Some(error_message));
    emit_status(app, document_id, status, Some(error_message));
}

// Segmentos (texto, página): um por página nos PDFs, um só nos demais.
async fn read_document_text(path: PathBuf, mime: String) -> Result<Vec<(String, Option<u32>)>, String> {
    if mime == "application/pdf" {
        let path_clone = path.clone();
        let join = spawn_blocking(move || pdf_extract::extract_text_by_pages(&path_clone)).await;
        let pages = match join {
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
            Ok(Ok(p)) => p,
        };
        if pages.iter().all(|p| p.trim().is_empty()) {
            return Err("PDF has no extractable text (may be scanned)".into());
        }
        Ok(pages
            .into_iter()
            .enumerate()
            .map(|(i, text)| (text, Some(i as u32 + 1)))
            .collect())
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
        Ok(vec![(text, None)])
    }
}

// Documento de uma pasta web salva pelo bibliotecário (pasta-pai origin='ai').
fn is_web_source(app: &AppHandle, document_id: &str) -> bool {
    let state = app.state::<DocDb>();
    with_doc_db(app, &state, |conn| {
        conn.query_row(
            "SELECT p.origin FROM documents d JOIN documents p ON p.id = d.parent_folder_id
             WHERE d.id = ?1",
            params![document_id],
            |r| r.get::<_, String>(0),
        )
        .map_err(|e| e.to_string())
    })
    .map(|origin| origin == "ai")
    .unwrap_or(false)
}

fn truncate_chars(text: String, max_chars: usize) -> String {
    match text.char_indices().nth(max_chars) {
        Some((byte_idx, _)) => text[..byte_idx].to_string(),
        None => text,
    }
}

// Corta o total dos segmentos em `max_chars`, descartando os que sobram.
fn truncate_segments(
    segments: Vec<(String, Option<u32>)>,
    max_chars: usize,
) -> Vec<(String, Option<u32>)> {
    let mut left = max_chars;
    let mut out = Vec::new();
    for (text, page) in segments {
        if left == 0 {
            break;
        }
        let len = text.chars().count();
        out.push((truncate_chars(text, left), page));
        left = left.saturating_sub(len);
    }
    out
}

// O documento ainda existe em monet.db? Apagado enquanto o embedding rodava =
// não gravar chunks órfãos.
fn document_exists(conn: &Connection, document_id: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM documents WHERE id = ?1)",
        params![document_id],
        |r| r.get(0),
    )
    .map_err(|e| format!("failed to query document: {}", e))
}

// Indexa um arquivo da KB e devolve se deu certo (um documento apagado no meio
// conta como concluído: não há o que indexar). Uma falha mantém o índice
// anterior (ver status_after_index_failure).
async fn run_indexing(
    app: AppHandle,
    document_id: String,
    source_name: String,
    path: PathBuf,
    mime: String,
) -> bool {
    emit_status(&app, &document_id, "indexing", None);

    let key = match crate::read_key(&app, "openrouter_key") {
        Some(k) => k,
        None => {
            let msg = "OpenRouter key not configured";
            mark_index_failed(&app, &document_id, msg);
            return false;
        }
    };

    let segments = match read_document_text(path, mime).await {
        Ok(t) => t,
        Err(e) => {
            mark_index_failed(&app, &document_id, &e);
            return false;
        }
    };

    let segments = if is_web_source(&app, &document_id) {
        truncate_segments(segments, MAX_WEB_SOURCE_CHARS)
    } else {
        segments
    };

    let first_text = segments.first().map(|(t, _)| t.as_str()).unwrap_or("");
    let state = app.state::<DocDb>();
    let meta = match with_doc_db(&app, &state, |conn| {
        crate::rag::doc_meta(conn, &document_id, first_text)
    }) {
        Ok(m) => m,
        Err(e) => {
            mark_index_failed(&app, &document_id, &e);
            return false;
        }
    };

    let chunks = prepare_chunks(&meta, &segments);
    if chunks.is_empty() {
        let msg = "No indexable content found";
        mark_index_failed(&app, &document_id, msg);
        return false;
    }

    let all_embeddings = match embed_chunks(&key, &embed_inputs(&chunks)).await {
        Ok(embs) => embs,
        Err(e) => {
            mark_index_failed(&app, &document_id, &e);
            return false;
        }
    };

    match with_doc_db(&app, &state, |conn| document_exists(conn, &document_id)) {
        Ok(true) => {}
        Ok(false) => return true,
        Err(e) => {
            mark_index_failed(&app, &document_id, &e);
            return false;
        }
    }

    if let Err(e) = replace_chunks(
        &app,
        &document_id,
        &source_name,
        &meta,
        &chunks,
        &all_embeddings,
    ) {
        mark_index_failed(&app, &document_id, &e);
        return false;
    }

    if let Err(e) = update_document_status(&app, &document_id, "available", None) {
        emit_status(&app, &document_id, "error", Some(&e));
        return false;
    }
    emit_status(&app, &document_id, "available", None);
    true
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
    with_doc_db(&app, &state, |conn| reject_notes_origin(conn, &document_id))?;

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

    // Sem pré-deleção: run_indexing troca os chunks atomicamente, e uma
    // falha mantém o índice antigo.
    let path = PathBuf::from(original_path);
    let app_clone = app.clone();
    let id_clone = document_id.clone();
    tauri::async_runtime::spawn(async move {
        run_indexing(app_clone, id_clone, name, path, mime).await;
    });

    Ok(())
}

// ─── Reindexação dos documentos fora da versão atual ("Update index") ───────

struct PendingDoc {
    id: String,
    name: String,
    original_path: String,
    mime: String,
    is_note: bool,
}

// Arquivos (type='file') sem linha em doc_index_state, com versão menor que a
// atual ou com status='error'. `documents` mora no monet.db e
// `doc_index_state` no monet-vec.db: uma consulta por banco, cruzadas aqui.
fn pending_documents(app: &AppHandle) -> Result<Vec<PendingDoc>, String> {
    let state = app.state::<DocDb>();
    let docs: Vec<(PendingDoc, String)> = with_doc_db(app, &state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, original_path, mime, origin, status FROM documents
                 WHERE type = 'file' ORDER BY created_at",
            )
            .map_err(|e| format!("failed to prepare query: {}", e))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    PendingDoc {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        original_path: r.get(2)?,
                        mime: r.get(3)?,
                        is_note: r.get::<_, String>(4)? == "notes",
                    },
                    r.get::<_, String>(5)?,
                ))
            })
            .map_err(|e| format!("failed to query documents: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("invalid row: {}", e))?);
        }
        Ok(out)
    })?;

    let versions: std::collections::HashMap<String, i64> = {
        let vec_state = app.state::<VecDb>();
        let conn = vec_state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT document_id, index_version FROM doc_index_state")
            .map_err(|e| format!("failed to prepare query: {}", e))?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
            .map_err(|e| format!("failed to query index state: {}", e))?;
        let mut out = std::collections::HashMap::new();
        for r in rows {
            let (id, version) = r.map_err(|e| format!("invalid row: {}", e))?;
            out.insert(id, version);
        }
        out
    };

    Ok(docs
        .into_iter()
        .filter(|(doc, status)| {
            status == "error"
                || versions
                    .get(&doc.id)
                    .map_or(true, |v| *v < CURRENT_INDEX_VERSION)
        })
        .map(|(doc, _)| doc)
        .collect())
}

#[derive(Serialize)]
pub struct IndexOutdatedCount {
    files: u32,
    notes: u32,
}

#[tauri::command]
pub async fn documents_index_outdated_count(app: AppHandle) -> Result<IndexOutdatedCount, String> {
    let pending = pending_documents(&app)?;
    let notes = pending.iter().filter(|d| d.is_note).count() as u32;
    Ok(IndexOutdatedCount {
        files: pending.len() as u32 - notes,
        notes,
    })
}

static REINDEX_RUNNING: AtomicBool = AtomicBool::new(false);

// Libera o single-flight ao fim da rotina, inclusive em erro ou pânico.
struct ReindexRunningGuard;

impl Drop for ReindexRunningGuard {
    fn drop(&mut self) {
        REINDEX_RUNNING.store(false, Ordering::SeqCst);
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReindexProgressEvent {
    done: u32,
    total: u32,
    failed: u32,
    current_name: Option<String>,
    finished: bool,
}

fn emit_reindex_progress(app: &AppHandle, done: u32, total: u32, failed: u32, current_name: Option<&str>, finished: bool) {
    let _ = app.emit(
        "documents://reindex-progress",
        ReindexProgressEvent {
            done,
            total,
            failed,
            current_name: current_name.map(|s| s.to_string()),
            finished,
        },
    );
}

// Marca 'indexing' se o documento existe e ninguém (scan, retry) já o indexa.
fn claim_for_reindex(app: &AppHandle, document_id: &str) -> Result<bool, String> {
    let state = app.state::<DocDb>();
    with_doc_db(app, &state, |conn| {
        let changed = conn
            .execute(
                "UPDATE documents SET status = 'indexing', error_message = NULL, updated_at = ?1
                 WHERE id = ?2 AND status != 'indexing'",
                params![now_ms(), document_id],
            )
            .map_err(|e| format!("failed to mark reindex: {}", e))?;
        Ok(changed > 0)
    })
}

// Reindexa, um por vez, os arquivos não-nota pendentes. Retomável por
// construção: cada documento concluído grava a versão atual, então rodar de
// novo (inclusive depois de fechar o app) só pega os que faltam. As notas se
// reindexam pela reconciliação do useNotesIndexSync.
#[tauri::command]
pub async fn documents_reindex_outdated(app: AppHandle) -> Result<(), String> {
    if crate::read_key(&app, "openrouter_key").is_none() {
        return Err("OpenRouter key not configured".into());
    }
    if REINDEX_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let guard = ReindexRunningGuard;
    let files: Vec<PendingDoc> = pending_documents(&app)?
        .into_iter()
        .filter(|d| !d.is_note)
        .collect();

    tauri::async_runtime::spawn(async move {
        let _guard = guard;
        let total = files.len() as u32;
        let mut done = 0;
        let mut failed = 0;
        for doc in files {
            emit_reindex_progress(&app, done, total, failed, Some(&doc.name), false);
            let ok = match claim_for_reindex(&app, &doc.id) {
                // Apagado, ou já indexando por outro caminho: não é falha.
                Ok(false) => true,
                Ok(true) => {
                    let path = PathBuf::from(doc.original_path);
                    run_indexing(app.clone(), doc.id, doc.name, path, doc.mime).await
                }
                Err(e) => {
                    eprintln!("documents_reindex_outdated {}: {}", doc.id, e);
                    false
                }
            };
            done += 1;
            if !ok {
                failed += 1;
            }
        }
        emit_reindex_progress(&app, done, total, failed, None, true);
    });

    Ok(())
}

#[tauri::command]
pub async fn documents_delete(
    app: AppHandle,
    state: State<'_, DocDb>,
    document_id: String,
) -> Result<(), String> {
    with_doc_db(&app, &state, |conn| reject_notes_origin(conn, &document_id))?;

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

// Abre o arquivo de um documento da KB no app padrão do sistema (fontes do
// chat). Fica no Rust para não exigir `opener:allow-open-path` na capability.
#[tauri::command]
pub async fn documents_open_file(
    app: AppHandle,
    state: State<'_, DocDb>,
    document_id: String,
) -> Result<(), String> {
    let path: Option<String> = with_doc_db(&app, &state, |conn| {
        match conn.query_row(
            "SELECT original_path FROM documents WHERE id = ?1 AND type = 'file' AND origin != 'notes'",
            params![document_id],
            |r| r.get::<_, Option<String>>(0),
        ) {
            Ok(v) => Ok(v),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    })?;
    let path = path.ok_or_else(|| "Document file not found".to_string())?;
    if !Path::new(&path).exists() {
        return Err(format!("File not found: {}", path));
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn documents_list_global(
    app: AppHandle,
    state: State<'_, DocDb>,
) -> Result<Vec<DocumentInfo>, String> {
    with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT documents.id, name, original_path, mime, size, status, error_message, created_at, updated_at,
                        type, parent_folder_id, last_modified_ms, is_external, origin, a.alias
                 FROM documents LEFT JOIN folder_aliases a ON a.folder_id = documents.id
                 ORDER BY created_at DESC",
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
                    origin: r.get(13)?,
                    alias: r.get(14)?,
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

// Alias vazio ou ausente remove o apelido (volta ao nome original).
#[tauri::command]
pub async fn documents_set_folder_alias(
    app: AppHandle,
    state: State<'_, DocDb>,
    folder_id: String,
    alias: Option<String>,
) -> Result<(), String> {
    // Filhos da pasta, quando o apelido mudou: o cabeçalho dos chunks deles
    // leva o apelido, então viram pendentes de reindexação.
    let stale_children: Vec<String> = with_doc_db(&app, &state, |conn| {
        reject_notes_origin(conn, &folder_id)?;
        let alias = alias.as_deref().map(str::trim).unwrap_or("");
        let previous: Option<String> = match conn.query_row(
            "SELECT alias FROM folder_aliases WHERE folder_id = ?1",
            params![folder_id],
            |r| r.get(0),
        ) {
            Ok(a) => Some(a),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(e) => return Err(format!("failed to read alias: {}", e)),
        };
        if previous.as_deref().unwrap_or("") == alias {
            return Ok(Vec::new());
        }
        if alias.is_empty() {
            conn.execute(
                "DELETE FROM folder_aliases WHERE folder_id = ?1",
                params![folder_id],
            )
            .map_err(|e| format!("failed to clear alias: {}", e))?;
        } else {
            conn.execute(
                "INSERT OR REPLACE INTO folder_aliases (folder_id, alias) VALUES (?1, ?2)",
                params![folder_id, alias],
            )
            .map_err(|e| format!("failed to set alias: {}", e))?;
        }
        let mut stmt = conn
            .prepare("SELECT id FROM documents WHERE parent_folder_id = ?1")
            .map_err(|e| format!("failed to prepare children query: {}", e))?;
        let rows = stmt
            .query_map(params![folder_id], |r| r.get::<_, String>(0))
            .map_err(|e| format!("failed to list folder children: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("invalid row: {}", e))?);
        }
        Ok(out)
    })?;

    if stale_children.is_empty() {
        return Ok(());
    }
    let vec_state = app.state::<VecDb>();
    let conn = vec_state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("DELETE FROM doc_index_state WHERE document_id = ?1")
        .map_err(|e| format!("failed to prepare index state update: {}", e))?;
    for id in &stale_children {
        stmt.execute(params![id])
            .map_err(|e| format!("failed to mark document outdated: {}", e))?;
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSet {
    id: String,
    name: String,
    document_ids: Vec<String>,
    created_at: i64,
    updated_at: i64,
}

fn clean_set_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("set name is empty".into());
    }
    Ok(name.to_string())
}

#[tauri::command]
pub async fn document_sets_list(
    app: AppHandle,
    state: State<'_, DocDb>,
) -> Result<Vec<DocumentSet>, String> {
    with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, document_ids, created_at, updated_at
                 FROM document_sets ORDER BY name COLLATE NOCASE, created_at",
            )
            .map_err(|e| format!("failed to prepare sets listing: {}", e))?;
        let rows = stmt
            .query_map([], |r| {
                let ids_json: String = r.get(2)?;
                Ok(DocumentSet {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    document_ids: serde_json::from_str(&ids_json).unwrap_or_default(),
                    created_at: r.get(3)?,
                    updated_at: r.get(4)?,
                })
            })
            .map_err(|e| format!("failed to list sets: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("invalid set row: {}", e))?);
        }
        Ok(out)
    })
}

// Sem `id` cria um conjunto novo; com `id` regrava nome e ids. Devolve o id.
#[tauri::command]
pub async fn document_sets_save(
    app: AppHandle,
    state: State<'_, DocDb>,
    id: Option<String>,
    name: String,
    document_ids: Vec<String>,
) -> Result<String, String> {
    let name = clean_set_name(&name)?;
    let ids_json = serde_json::to_string(&document_ids).map_err(|e| e.to_string())?;
    let now = now_ms();
    with_doc_db(&app, &state, |conn| match id {
        Some(id) => {
            let n = conn
                .execute(
                    "UPDATE document_sets SET name = ?2, document_ids = ?3, updated_at = ?4 WHERE id = ?1",
                    params![id, name, ids_json, now],
                )
                .map_err(|e| format!("failed to update set: {}", e))?;
            if n == 0 {
                return Err("set not found".into());
            }
            Ok(id)
        }
        None => {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO document_sets (id, name, document_ids, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?4)",
                params![id, name, ids_json, now],
            )
            .map_err(|e| format!("failed to create set: {}", e))?;
            Ok(id)
        }
    })
}

#[tauri::command]
pub async fn document_sets_rename(
    app: AppHandle,
    state: State<'_, DocDb>,
    id: String,
    name: String,
) -> Result<(), String> {
    let name = clean_set_name(&name)?;
    let now = now_ms();
    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "UPDATE document_sets SET name = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, name, now],
        )
        .map_err(|e| format!("failed to rename set: {}", e))?;
        Ok(())
    })
}

#[tauri::command]
pub async fn document_sets_delete(
    app: AppHandle,
    state: State<'_, DocDb>,
    id: String,
) -> Result<(), String> {
    with_doc_db(&app, &state, |conn| {
        conn.execute("DELETE FROM document_sets WHERE id = ?1", params![id])
            .map_err(|e| format!("failed to delete set: {}", e))?;
        Ok(())
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
pub async fn documents_replace_notebook_visibility(
    app: AppHandle,
    state: State<'_, DocDb>,
    notebook_id: String,
    document_ids: Vec<String>,
) -> Result<(), String> {
    with_doc_db(&app, &state, |conn| {
        let tx = conn
            .transaction()
            .map_err(|e| format!("failed to begin transaction: {}", e))?;
        tx.execute(
            "DELETE FROM notebook_document_visibility WHERE notebook_id = ?1",
            params![notebook_id],
        )
        .map_err(|e| format!("failed to clear visibility: {}", e))?;
        for document_id in &document_ids {
            tx.execute(
                "INSERT OR IGNORE INTO notebook_document_visibility (notebook_id, document_id)
                 VALUES (?1, ?2)",
                params![notebook_id, document_id],
            )
            .map_err(|e| format!("failed to set visibility: {}", e))?;
        }
        tx.commit()
            .map_err(|e| format!("failed to commit visibility: {}", e))
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
    let state = app.state::<VecDb>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::rag::knn_search(&conn, &document_ids, &query_embedding, top_k)
}

#[tauri::command]
pub async fn documents_resolve_searchable_ids(
    app: AppHandle,
    state: State<'_, DocDb>,
    raw_ids: Vec<String>,
    notebook_id: Option<String>,
    exclude_note_id: Option<String>,
    include_ai_folders: bool,
) -> Result<Vec<String>, String> {
    with_doc_db(&app, &state, |conn| {
        crate::rag::resolve_scope(
            conn,
            &raw_ids,
            notebook_id.as_deref(),
            exclude_note_id.as_deref(),
            include_ai_folders,
        )
    })
}

#[tauri::command]
pub async fn embed_text(app: AppHandle, text: String) -> Result<Vec<f32>, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("empty text".into());
    }
    let key = crate::read_key(&app, "openrouter_key")
        .ok_or_else(|| "OpenRouter key not configured".to_string())?;
    crate::rag::embed_query(&key, trimmed).await
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

#[tauri::command]
pub async fn documents_ensure_ai_folder(
    app: AppHandle,
    state: State<'_, DocDb>,
    chat_folder_id: String,
    folder_name: String,
) -> Result<String, String> {
    let safe_id = safe_path_component(&chat_folder_id)
        .map_err(|_| "Invalid chat folder id".to_string())?;

    let dir = ai_web_folder_dir(&app, safe_id)?;
    let path_str = dir.to_string_lossy().to_string();

    let existing_id: Option<String> = with_doc_db(&app, &state, |conn| {
        match conn.query_row(
            "SELECT id FROM documents WHERE type = 'folder' AND original_path = ?1",
            params![path_str],
            |r| r.get::<_, String>(0),
        ) {
            Ok(id) => Ok(Some(id)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("failed to query folder: {}", e)),
        }
    })?;

    if let Some(id) = existing_id {
        return Ok(id);
    }

    fs::create_dir_all(&dir).map_err(|e| format!("failed to create folder: {}", e))?;

    let id = Uuid::new_v4().to_string();
    let name = format!("Save web sources — {}", folder_name);
    let now = now_ms();

    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "INSERT INTO documents (id, name, original_path, mime, size, status, error_message,
                                    created_at, updated_at, type, parent_folder_id,
                                    last_modified_ms, is_external, origin)
             VALUES (?1, ?2, ?3, 'inode/directory', 0, 'available', NULL,
                     ?4, ?4, 'folder', NULL, NULL, 1, 'ai')",
            params![id, name, path_str, now],
        )
        .map_err(|e| format!("failed to insert folder: {}", e))?;
        Ok(())
    })?;

    Ok(id)
}

#[tauri::command]
pub async fn documents_write_ai_source_file(
    app: AppHandle,
    state: State<'_, DocDb>,
    folder_id: String,
    filename: String,
    content: String,
) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("Empty file".into());
    }
    if content.len() as u64 > MAX_FILE_BYTES {
        return Err(format!(
            "Content too large ({:.1} MB). Limit: {} MB.",
            content.len() as f64 / (1024.0 * 1024.0),
            MAX_FILE_BYTES / (1024 * 1024)
        ));
    }

    let (original_path, origin): (String, String) = with_doc_db(&app, &state, |conn| {
        conn.query_row(
            "SELECT original_path, origin FROM documents WHERE id = ?1 AND type = 'folder'",
            params![folder_id],
            |r| Ok((r.get::<_, Option<String>>(0)?.unwrap_or_default(), r.get::<_, String>(1)?)),
        )
        .map_err(|e| format!("folder not found: {}", e))
    })?;

    if origin != "ai" {
        return Err("Target folder is not AI-managed".into());
    }

    let safe_name = Path::new(&filename)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid filename".to_string())?;
    if safe_name != filename || !safe_name.ends_with(".md") {
        return Err("Invalid filename".into());
    }

    write_bytes_atomic(&original_path, safe_name, content.as_bytes())?;
    Ok(())
}

// Escrita atômica: grava num arquivo temporário no MESMO diretório e faz
// rename para o nome final. O sufixo `.tmp` não é reconhecido pelo scan
// (detect_mime retorna None), então o arquivo parcial nunca é indexado se o
// app fechar no meio. No Windows, std::fs::rename usa MOVEFILE_REPLACE_EXISTING,
// substituindo o destino existente atomicamente no mesmo volume.
fn write_bytes_atomic(dir: &str, safe_name: &str, bytes: &[u8]) -> Result<(), String> {
    let final_path = Path::new(dir).join(safe_name);
    let tmp_path = Path::new(dir).join(format!("{}.tmp", safe_name));
    fs::write(&tmp_path, bytes).map_err(|e| format!("failed to write file: {}", e))?;
    if let Err(e) = fs::rename(&tmp_path, &final_path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("failed to write file: {}", e));
    }
    Ok(())
}

// Baixa um PDF de acesso aberto, valida a assinatura %PDF e o grava atômico na
// pasta de KB da IA. Os bytes nunca cruzam o IPC — o download acontece aqui e o
// arquivo é escrito direto no disco. Espelha o cabeçalho de resolução/gate/
// sanitização de documents_write_ai_source_file, com extensão `.pdf`.
#[tauri::command]
pub async fn librarian_fetch_and_save_pdf(
    app: AppHandle,
    state: State<'_, DocDb>,
    folder_id: String,
    url: String,
    filename: String,
) -> Result<(), String> {
    let (original_path, origin): (String, String) = with_doc_db(&app, &state, |conn| {
        conn.query_row(
            "SELECT original_path, origin FROM documents WHERE id = ?1 AND type = 'folder'",
            params![folder_id],
            |r| Ok((r.get::<_, Option<String>>(0)?.unwrap_or_default(), r.get::<_, String>(1)?)),
        )
        .map_err(|e| format!("folder not found: {}", e))
    })?;

    if origin != "ai" {
        return Err("Target folder is not AI-managed".into());
    }

    let safe_name = Path::new(&filename)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid filename".to_string())?;
    if safe_name != filename || !safe_name.ends_with(".pdf") {
        return Err("Invalid filename".into());
    }

    let client = reqwest::Client::builder()
        .user_agent("Monet/0.1 (mailto:luizvilarinho@gmail.com)")
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("http client: {}", e))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("download failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("download failed: HTTP {}", resp.status()));
    }
    // Descarta cedo, sem baixar, se o Content-Length já ultrapassa o teto.
    if let Some(len) = resp.content_length() {
        if len > LIBRARIAN_MAX_PDF_BYTES {
            return Err(format!(
                "PDF too large ({:.1} MB). Limit: {} MB.",
                len as f64 / (1024.0 * 1024.0),
                LIBRARIAN_MAX_PDF_BYTES / (1024 * 1024)
            ));
        }
    }
    let bytes = resp.bytes().await.map_err(|e| format!("read body: {}", e))?;

    // Sempre valida o tamanho real (Content-Length pode faltar ou mentir).
    if bytes.len() as u64 > LIBRARIAN_MAX_PDF_BYTES {
        return Err(format!(
            "PDF too large ({:.1} MB). Limit: {} MB.",
            bytes.len() as f64 / (1024.0 * 1024.0),
            LIBRARIAN_MAX_PDF_BYTES / (1024 * 1024)
        ));
    }
    if !bytes.starts_with(b"%PDF") {
        return Err("Downloaded content is not a PDF".into());
    }

    write_bytes_atomic(&original_path, safe_name, &bytes)?;
    Ok(())
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
                // Modified — update last_modified_ms and reindex. Já indexando
                // (Update index, retry): fica para o próximo scan, que ainda
                // vê o last_modified_ms antigo.
                let claimed = with_doc_db(&app, &state, |conn| {
                    let changed = conn
                        .execute(
                            "UPDATE documents SET last_modified_ms = ?1, status = 'indexing',
                                                  updated_at = ?2
                             WHERE id = ?3 AND status != 'indexing'",
                            params![disk_ms, now, existing_id],
                        )
                        .map_err(|e| format!("update failed: {}", e))?;
                    Ok(changed > 0)
                });
                match claimed {
                    Ok(true) => {}
                    Ok(false) => continue,
                    Err(e) => eprintln!("scan_watched_folder_async update: {}", e),
                }
                // Os chunks antigos ficam até run_indexing trocá-los.
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
    state: State<'_, DocDb>,
    folder_id: String,
) -> Result<(), String> {
    with_doc_db(&app, &state, |conn| reject_notes_origin(conn, &folder_id))?;

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
    let (folder_path, folder_origin): (Option<String>, String) = with_doc_db(&app, &state, |conn| {
        match conn.query_row(
            "SELECT original_path, origin FROM documents WHERE id = ?1 AND type = 'folder'",
            params![folder_id],
            |r| Ok((r.get::<_, Option<String>>(0)?, r.get::<_, String>(1)?)),
        ) {
            Ok(v) => Ok(v),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok((None, "user".to_string())),
            Err(e) => Err(format!("failed to query folder: {}", e)),
        }
    })?;

    if folder_origin == "notes" {
        return Err(NOTES_FOLDER_READ_ONLY.into());
    }

    remove_folder_rows(&app, &folder_id)?;

    if folder_origin == "ai" {
        if let Some(path) = folder_path {
            let _ = fs::remove_dir_all(PathBuf::from(path));
        }
    }

    Ok(())
}

// Remove do banco os filhos (chunks, visibilidade e linha), a visibilidade e a
// linha da pasta. Não mexe em disco. Idempotente.
fn remove_folder_rows(app: &AppHandle, folder_id: &str) -> Result<(), String> {
    let state = app.state::<DocDb>();
    let children: Vec<String> = with_doc_db(app, &state, |conn| {
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
        if let Err(e) = delete_folder_child(app, child_id) {
            eprintln!("documents_delete_watched_folder child {}: {}", child_id, e);
        }
    }

    with_doc_db(app, &state, |conn| {
        conn.execute(
            "DELETE FROM notebook_document_visibility WHERE document_id = ?1",
            params![folder_id],
        )
        .map_err(|e| format!("failed to clear visibility: {}", e))?;
        conn.execute(
            "DELETE FROM folder_aliases WHERE folder_id = ?1",
            params![folder_id],
        )
        .map_err(|e| format!("failed to clear alias: {}", e))?;
        conn.execute(
            "DELETE FROM documents WHERE id = ?1",
            params![folder_id],
        )
        .map_err(|e| format!("failed to delete folder: {}", e))?;
        Ok(())
    })
}

// Remove o documento de uma nota (chunks, visibilidade, linha) e seu arquivo.
// Idempotente: sem linha, não faz nada.
fn delete_note_doc(app: &AppHandle, state: &State<'_, DocDb>, doc_id: &str) -> Result<(), String> {
    let original_path: Option<Option<String>> = with_doc_db(app, state, |conn| {
        match conn.query_row(
            "SELECT original_path FROM documents WHERE id = ?1",
            params![doc_id],
            |r| r.get::<_, Option<String>>(0),
        ) {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("failed to query note document: {}", e)),
        }
    })?;

    let Some(original_path) = original_path else {
        return Ok(());
    };

    delete_folder_child(app, doc_id)?;
    if let Some(path) = original_path {
        let _ = fs::remove_file(PathBuf::from(path));
    }
    Ok(())
}

// Remove a pasta de notas de um caderno: linhas (filhos, visibilidade, pasta)
// e o diretório em disco. Idempotente.
fn remove_notes_folder(app: &AppHandle, safe_notebook_id: &str) -> Result<(), String> {
    remove_folder_rows(app, &notes_folder_doc_id(safe_notebook_id))?;
    if let Ok(dir) = notes_folder_dir(app, safe_notebook_id) {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(())
}

fn is_notes_index_disabled(conn: &Connection, notebook_id: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM notebook_notes_index_disabled WHERE notebook_id = ?1)",
        params![notebook_id],
        |r| r.get::<_, bool>(0),
    )
    .map_err(|e| format!("failed to query notes index toggle: {}", e))
}

// Espelha uma nota em `app_data_dir()/notes/<notebookId>/<noteId>.md` e a
// indexa no RAG. Retorna: "disabled" | "removed" | "no_key" | "unchanged" |
// "indexed". Não emite documents://status para os filhos, evitando refresh em
// cascata do KB a cada nota. `note_date` (`YYYY-MM-DD`) vai no cabeçalho.
#[tauri::command]
pub async fn notes_index_upsert(
    app: AppHandle,
    state: State<'_, DocDb>,
    notebook_id: String,
    notebook_name: String,
    note_id: String,
    title: String,
    file_text: String,
    note_date: Option<String>,
    archived: Option<String>,
) -> Result<String, String> {
    let safe_nb = safe_path_component(&notebook_id)?;
    let safe_note = safe_path_component(&note_id)?;
    let doc_id = note_doc_id(safe_note);
    let folder_id = notes_folder_doc_id(safe_nb);

    if with_doc_db(&app, &state, |conn| is_notes_index_disabled(conn, safe_nb))? {
        delete_note_doc(&app, &state, &doc_id)?;
        return Ok("disabled".into());
    }

    if file_text.trim().is_empty() {
        delete_note_doc(&app, &state, &doc_id)?;
        return Ok("removed".into());
    }

    let Some(key) = crate::read_key(&app, "openrouter_key") else {
        return Ok("no_key".into());
    };

    // Garante a pasta (disco + linha) e mantém o nome em dia com o caderno.
    let dir = notes_folder_dir(&app, safe_nb)?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create notes folder: {}", e))?;
    let dir_str = dir.to_string_lossy().to_string();
    let folder_name = format!("Notes — {}", notebook_name);
    let folder_created = with_doc_db(&app, &state, |conn| {
        let existing_name: Option<String> = match conn.query_row(
            "SELECT name FROM documents WHERE id = ?1",
            params![folder_id],
            |r| r.get::<_, String>(0),
        ) {
            Ok(n) => Some(n),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(e) => return Err(format!("failed to query notes folder: {}", e)),
        };
        match existing_name {
            None => {
                conn.execute(
                    "INSERT INTO documents (id, name, original_path, mime, size, status, error_message,
                                            created_at, updated_at, type, parent_folder_id,
                                            last_modified_ms, is_external, origin)
                     VALUES (?1, ?2, ?3, 'inode/directory', 0, 'available', NULL,
                             ?4, ?4, 'folder', NULL, NULL, 1, 'notes')",
                    params![folder_id, folder_name, dir_str, now_ms()],
                )
                .map_err(|e| format!("failed to insert notes folder: {}", e))?;
                Ok(true)
            }
            Some(name) => {
                if name != folder_name {
                    conn.execute(
                        "UPDATE documents SET name = ?1, updated_at = ?2 WHERE id = ?3",
                        params![folder_name, now_ms(), folder_id],
                    )
                    .map_err(|e| format!("failed to rename notes folder: {}", e))?;
                }
                Ok(false)
            }
        }
    })?;
    if folder_created {
        emit_status(&app, &folder_id, "available", None);
    }

    let file_name = format!("{}.md", safe_note);
    let target_str = dir.join(&file_name).to_string_lossy().to_string();

    let existing: Option<(Option<String>, Option<String>, String)> =
        with_doc_db(&app, &state, |conn| {
            match conn.query_row(
                "SELECT parent_folder_id, original_path, status FROM documents WHERE id = ?1",
                params![doc_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            ) {
                Ok(v) => Ok(Some(v)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(format!("failed to query note document: {}", e)),
            }
        })?;

    let source_name = match title.trim() {
        "" => "Untitled".to_string(),
        t => t.to_string(),
    };
    let meta = crate::rag::note_meta(
        &source_name,
        &folder_name,
        note_date.as_deref(),
        archived.as_deref(),
    );

    // Sem mudança só com o mesmo conteúdo, o mesmo caderno e o índice na
    // versão atual com os mesmos metadados. Mover entre cadernos reembute,
    // porque o cabeçalho leva o caderno.
    if let Some((parent, Some(old_path), status)) = &existing {
        let same_content = fs::read_to_string(old_path)
            .map(|c| c == file_text)
            .unwrap_or(false);
        if status == "available"
            && same_content
            && parent.as_deref() == Some(folder_id.as_str())
            && index_state(&app, &doc_id)?
                == Some((CURRENT_INDEX_VERSION, crate::rag::meta_sig(&meta)))
        {
            return Ok("unchanged".into());
        }
    }

    write_bytes_atomic(&dir_str, &file_name, file_text.as_bytes())?;
    if let Some((_, Some(old_path), _)) = &existing {
        if *old_path != target_str {
            let _ = fs::remove_file(old_path);
        }
    }

    let size = file_text.len() as i64;
    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "INSERT INTO documents (id, name, original_path, mime, size, status, error_message,
                                    created_at, updated_at, type, parent_folder_id,
                                    last_modified_ms, is_external, origin)
             VALUES (?1, ?2, ?3, 'text/markdown', ?4, 'indexing', NULL,
                     ?5, ?5, 'file', ?6, ?5, 1, 'notes')
             ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name,
                 original_path = excluded.original_path,
                 mime = excluded.mime,
                 size = excluded.size,
                 status = 'indexing',
                 error_message = NULL,
                 updated_at = excluded.updated_at,
                 type = 'file',
                 parent_folder_id = excluded.parent_folder_id,
                 last_modified_ms = excluded.last_modified_ms,
                 is_external = 1,
                 origin = 'notes'",
            params![doc_id, source_name, target_str, size, now_ms(), folder_id],
        )
        .map_err(|e| format!("failed to upsert note document: {}", e))?;
        Ok(())
    })?;

    let chunks = prepare_chunks(&meta, &[(file_text, None)]);
    let embeddings = match embed_chunks(&key, &embed_inputs(&chunks)).await {
        Ok(e) => e,
        Err(msg) => {
            let status = status_after_index_failure(&app, &doc_id);
            let _ = update_document_status(&app, &doc_id, status, Some(&msg));
            return Err(msg);
        }
    };

    // Revalida antes de gravar: a nota pode ter sido apagada, movida ou o
    // caderno desligado enquanto o embedding rodava.
    let still_valid = with_doc_db(&app, &state, |conn| {
        let parent: Option<Option<String>> = match conn.query_row(
            "SELECT parent_folder_id FROM documents WHERE id = ?1",
            params![doc_id],
            |r| r.get::<_, Option<String>>(0),
        ) {
            Ok(p) => Some(p),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(e) => return Err(format!("failed to query note document: {}", e)),
        };
        let disabled = is_notes_index_disabled(conn, safe_nb)?;
        Ok(!disabled && parent.flatten().as_deref() == Some(folder_id.as_str()))
    })?;
    if !still_valid {
        return Ok("removed".into());
    }

    if let Err(e) = replace_chunks(&app, &doc_id, &source_name, &meta, &chunks, &embeddings) {
        let status = status_after_index_failure(&app, &doc_id);
        let _ = update_document_status(&app, &doc_id, status, Some(&e));
        return Err(e);
    }
    update_document_status(&app, &doc_id, "available", None)?;
    Ok("indexed".into())
}

#[tauri::command]
pub async fn notes_index_delete(
    app: AppHandle,
    state: State<'_, DocDb>,
    note_id: String,
) -> Result<(), String> {
    delete_note_doc(&app, &state, &note_doc_id(&note_id))
}

#[tauri::command]
pub async fn notes_index_remove_notebook(
    app: AppHandle,
    _state: State<'_, DocDb>,
    notebook_id: String,
) -> Result<(), String> {
    let safe_nb = safe_path_component(&notebook_id)?;
    remove_notes_folder(&app, safe_nb)
}

#[tauri::command]
pub async fn notes_index_set_notebook_enabled(
    app: AppHandle,
    state: State<'_, DocDb>,
    notebook_id: String,
    enabled: bool,
) -> Result<(), String> {
    let safe_nb = safe_path_component(&notebook_id)?;
    if enabled {
        with_doc_db(&app, &state, |conn| {
            conn.execute(
                "DELETE FROM notebook_notes_index_disabled WHERE notebook_id = ?1",
                params![safe_nb],
            )
            .map_err(|e| format!("failed to enable notes index: {}", e))?;
            Ok(())
        })
    } else {
        with_doc_db(&app, &state, |conn| {
            conn.execute(
                "INSERT OR IGNORE INTO notebook_notes_index_disabled (notebook_id) VALUES (?1)",
                params![safe_nb],
            )
            .map_err(|e| format!("failed to disable notes index: {}", e))?;
            Ok(())
        })?;
        remove_notes_folder(&app, safe_nb)
    }
}

#[tauri::command]
pub async fn notes_index_get_disabled_notebooks(
    app: AppHandle,
    state: State<'_, DocDb>,
) -> Result<Vec<String>, String> {
    with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare("SELECT notebook_id FROM notebook_notes_index_disabled")
            .map_err(|e| format!("failed to prepare query: {}", e))?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| format!("failed to query: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("invalid row: {}", e))?);
        }
        Ok(out)
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesIndexEntry {
    note_id: String,
    notebook_id: String,
    status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesIndexState {
    notebook_ids: Vec<String>,
    notes: Vec<NotesIndexEntry>,
}

#[tauri::command]
pub async fn notes_index_list_state(
    app: AppHandle,
    state: State<'_, DocDb>,
) -> Result<NotesIndexState, String> {
    let rows: Vec<(String, String, Option<String>, String)> = with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, type, parent_folder_id, status FROM documents WHERE origin = 'notes'",
            )
            .map_err(|e| format!("failed to prepare query: {}", e))?;
        let rows = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
            .map_err(|e| format!("failed to query: {}", e))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("invalid row: {}", e))?);
        }
        Ok(out)
    })?;

    let mut result = NotesIndexState {
        notebook_ids: Vec::new(),
        notes: Vec::new(),
    };
    for (id, doc_type, parent, status) in rows {
        if doc_type == "folder" {
            if let Some(nb) = id.strip_prefix("notes-folder:") {
                result.notebook_ids.push(nb.to_string());
            }
        } else if let (Some(note), Some(nb)) = (
            id.strip_prefix("note:"),
            parent.as_deref().and_then(|p| p.strip_prefix("notes-folder:")),
        ) {
            result.notes.push(NotesIndexEntry {
                note_id: note.to_string(),
                notebook_id: nb.to_string(),
                status,
            });
        }
    }
    Ok(result)
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
            .prepare("SELECT id FROM documents WHERE type = 'folder' AND origin != 'notes'")
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
    let stuck: Vec<String> = match with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id FROM documents WHERE status = 'indexing'")
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
            eprintln!("cleanup_stuck_indexing: {}", e);
            return;
        }
    };

    // Interrompido com chunks antigos: segue pesquisável e pendente. Só mexe
    // em quem continua 'indexing' (outro caminho pode ter concluído nesse meio
    // tempo); o estado do índice só sai depois disso.
    for id in stuck {
        let status = status_for_failed_index(&app, &id);
        match with_doc_db(&app, &state, |conn| release_stuck(conn, &id, status)) {
            Ok(true) if status == "available" => mark_outdated_logged(&app, &id),
            Ok(_) => {}
            Err(e) => eprintln!("cleanup_stuck_indexing {}: {}", id, e),
        }
    }
}

// Tira um documento de 'indexing' se ele ainda estiver assim. Devolve se mudou.
fn release_stuck(conn: &Connection, document_id: &str, status: &str) -> Result<bool, String> {
    conn.execute(
        "UPDATE documents SET status = ?1, error_message = ?2, updated_at = ?3
         WHERE id = ?4 AND status = 'indexing'",
        params![status, "Indexing interrupted (app closed)", now_ms(), document_id],
    )
    .map(|changed| changed > 0)
    .map_err(|e| format!("failed to update status: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunk_segments_splits_giant_line() {
        // 20.000 chars numa linha só, com caractere multibyte para exercitar
        // as fronteiras de char.
        let line = "aé".repeat(10_000);
        let chunks = chunk_segments(&[(line, None)]);
        assert!(chunks.len() >= 5);
        for c in &chunks {
            let n = c.text.chars().count();
            assert!(n <= CHUNK_TARGET_CHARS, "chunk com {} chars", n);
        }
        let joined: usize = chunks.iter().map(|c| c.text.replace("\n", "").chars().count()).sum();
        assert!(joined >= 20_000);
    }

    #[test]
    fn chunk_segments_tracks_page_and_section() {
        let segments = vec![
            (format!("# Guide\n\n{}", "a".repeat(3000)), Some(1)),
            (
                format!("## Setup\n\n{}\n\n{}", "b".repeat(3000), "c".repeat(3000)),
                Some(2),
            ),
        ];
        let chunks = chunk_segments(&segments);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].page, Some(1));
        assert_eq!(chunks[0].section.as_deref(), Some("Guide"));
        assert!(chunks[0].text.ends_with("## Setup"));
        // O chunk que começa no meio da página 2 herda o último heading.
        assert_eq!(chunks[1].page, Some(2));
        assert_eq!(chunks[1].section.as_deref(), Some("Setup"));
        assert_eq!(chunks[2].section.as_deref(), Some("Setup"));

        // A seção igual ao título sai do cabeçalho.
        let meta = crate::rag::note_meta("Guide", "Notes — Docs", None, None);
        let prepared = prepare_chunks(&meta, &segments);
        assert_eq!(prepared[0].0.section, None);
        assert_eq!(prepared[0].1, "[Guide · note · Notes — Docs · p. 1]");
        assert_eq!(prepared[1].1, "[Guide · note · Notes — Docs · Setup · p. 2]");
        assert!(md_heading("#nope").is_none() && md_heading("####### x").is_none());
    }

    #[test]
    fn truncate_segments_caps_total() {
        let segs = vec![("abc".to_string(), Some(1)), ("defg".to_string(), Some(2)), ("h".to_string(), Some(3))];
        let out = truncate_segments(segs, 5);
        assert_eq!(out, vec![("abc".to_string(), Some(1)), ("de".to_string(), Some(2))]);
    }

    // Vec db em memória com o mesmo schema do app (vec0, chunks_meta,
    // doc_index_state e chunks_fts).
    fn vec_test_db() -> Connection {
        crate::vec_db::register_auto_extension();
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(&format!(
            "CREATE VIRTUAL TABLE vec_chunks USING vec0(embedding float[{}]);
             CREATE TABLE chunks_meta (
                 rowid INTEGER PRIMARY KEY, document_id TEXT NOT NULL, source_name TEXT NOT NULL,
                 content TEXT NOT NULL, chunk_index INTEGER NOT NULL, header TEXT NOT NULL DEFAULT '',
                 kind TEXT NOT NULL DEFAULT 'document', title TEXT NOT NULL DEFAULT '', doc_date TEXT,
                 folder_label TEXT, section TEXT, page INTEGER, source_url TEXT
             );
             CREATE TABLE doc_index_state (
                 document_id TEXT PRIMARY KEY, index_version INTEGER NOT NULL,
                 meta_sig TEXT NOT NULL DEFAULT ''
             );",
            EMBEDDING_DIM
        ))
        .unwrap();
        crate::vec_db::ensure_fts(&conn).unwrap();
        conn
    }

    fn index_doc(conn: &mut Connection, doc: &str, texts: &[&str]) {
        let meta = crate::rag::note_meta(doc, "Notes — Test", None, None);
        let segments: Vec<(String, Option<u32>)> =
            texts.iter().map(|t| (t.to_string(), None)).collect();
        let chunks: Vec<(ChunkPiece, String)> = segments
            .iter()
            .map(|(t, _)| (ChunkPiece { text: t.clone(), page: None, section: None }, format!("[{}]", doc)))
            .collect();
        let embeddings = vec![vec![0.1_f32; EMBEDDING_DIM]; chunks.len()];
        replace_chunks_conn(conn, doc, doc, &meta, &chunks, &embeddings).unwrap();
    }

    fn count(conn: &Connection, sql: &str) -> i64 {
        conn.query_row(sql, [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn replace_and_delete_keep_vectors_fts_and_state_in_sync() {
        let mut conn = vec_test_db();
        index_doc(&mut conn, "doc:a", &["alpha one", "alpha two"]);
        index_doc(&mut conn, "doc:b", &["beta"]);
        // Reindexar troca tudo do documento, sem duplicar.
        index_doc(&mut conn, "doc:a", &["alpha three"]);
        for table in ["chunks_meta", "vec_chunks", "chunks_fts"] {
            assert_eq!(count(&conn, &format!("SELECT COUNT(*) FROM {}", table)), 2, "{}", table);
        }
        assert_eq!(
            count(&conn, "SELECT COUNT(*) FROM chunks_fts WHERE chunks_fts MATCH '\"alpha\"'"),
            1
        );
        assert_eq!(
            count(&conn, "SELECT index_version FROM doc_index_state WHERE document_id = 'doc:a'"),
            CURRENT_INDEX_VERSION
        );
        assert!(!crate::vec_db::ensure_fts(&conn).unwrap(), "FTS out of sync after replace");

        delete_chunks_conn(&mut conn, "doc:a").unwrap();
        for table in ["chunks_meta", "vec_chunks", "chunks_fts", "doc_index_state"] {
            assert_eq!(count(&conn, &format!("SELECT COUNT(*) FROM {}", table)), 1, "{}", table);
        }
        assert!(!crate::vec_db::ensure_fts(&conn).unwrap(), "FTS out of sync after delete");
    }

    #[test]
    fn failed_index_with_chunks_stays_searchable_and_pending() {
        let mut conn = vec_test_db();
        index_doc(&mut conn, "doc:a", &["alpha"]);
        assert!(has_chunks(&conn, "doc:a").unwrap());
        assert!(!has_chunks(&conn, "doc:missing").unwrap());
        mark_outdated(&conn, "doc:a").unwrap();
        // Chunks intactos, sem a linha de estado (= pendente no Update index).
        assert!(has_chunks(&conn, "doc:a").unwrap());
        assert_eq!(count(&conn, "SELECT COUNT(*) FROM doc_index_state"), 0);
    }

    fn doc_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE documents (
                 id TEXT PRIMARY KEY, original_path TEXT NOT NULL, status TEXT NOT NULL,
                 error_message TEXT, updated_at INTEGER
             );
             INSERT INTO documents (id, original_path, status) VALUES
                 ('doc:a', 'C:\\kb\\a.md', 'indexing'),
                 ('doc:b', 'C:\\kb\\b.md', 'available');",
        )
        .unwrap();
        conn
    }

    #[test]
    fn indexing_result_is_dropped_for_deleted_documents() {
        let conn = doc_test_db();
        assert!(document_exists(&conn, "doc:a").unwrap());
        assert!(!document_exists(&conn, "doc:gone").unwrap());
    }

    #[test]
    fn release_stuck_only_touches_documents_still_indexing() {
        let conn = doc_test_db();
        assert!(release_stuck(&conn, "doc:a", "available").unwrap());
        // doc:b concluiu por outro caminho depois do snapshot: fica como está.
        assert!(!release_stuck(&conn, "doc:b", "error").unwrap());
        let status = |id: &str| -> (String, Option<String>) {
            conn.query_row(
                "SELECT status, error_message FROM documents WHERE id = ?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap()
        };
        assert_eq!(status("doc:a"), ("available".into(), Some("Indexing interrupted (app closed)".into())));
        assert_eq!(status("doc:b"), ("available".into(), None));
    }

    #[test]
    fn truncate_chars_respects_char_boundaries() {
        assert_eq!(truncate_chars("ééé".to_string(), 2), "éé");
        assert_eq!(truncate_chars("ab".to_string(), 5), "ab");
    }
}
