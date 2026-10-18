use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use rusqlite::ffi::sqlite3_auto_extension;
use rusqlite::Connection;
use sqlite_vec::sqlite3_vec_init;
use tauri::{AppHandle, Manager, State};
use zerocopy::AsBytes;

pub const EMBEDDING_DIM: usize = 768;
// Versão do formato dos chunks (2 = cabeçalho de metadados no texto embutido).
// Documento com versão menor, ou sem linha em doc_index_state, é reindexado.
pub(crate) const CURRENT_INDEX_VERSION: i64 = 2;

pub struct VecDb(pub Mutex<Connection>);

static AUTO_EXT_REGISTERED: OnceLock<()> = OnceLock::new();

pub(crate) fn register_auto_extension() {
    AUTO_EXT_REGISTERED.get_or_init(|| {
        // SAFETY: `sqlite3_vec_init` é exportada pela crate `sqlite-vec` com
        // a assinatura C ABI exigida por `sqlite3_auto_extension`
        // (`unsafe extern "C" fn(*mut sqlite3, *mut *mut c_char, *const sqlite3_api_routines) -> c_int`).
        // O cast via `*const ()` é o padrão usado pelos exemplos oficiais
        // do sqlite-vec/rusqlite para registrar a extensão de forma estática.
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite3_vec_init as *const (),
            )));
        }
    });
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir indisponivel: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("falha ao criar app_data_dir: {}", e))?;
    Ok(dir.join("monet-vec.db"))
}

pub fn init(app: &AppHandle) -> Result<VecDb, String> {
    register_auto_extension();
    let path = db_path(app)?;
    let conn = Connection::open(&path).map_err(|e| format!("falha ao abrir monet-vec.db: {}", e))?;

    conn.pragma_update(None, "journal_mode", &"WAL")
        .map_err(|e| format!("falha ao configurar WAL: {}", e))?;

    conn.execute(
        &format!(
            "CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(embedding float[{}])",
            EMBEDDING_DIM
        ),
        [],
    )
    .map_err(|e| format!("falha ao criar tabela vec_chunks: {}", e))?;

    // Detecta se chunks_meta existe com o schema antigo (coluna notebook_id).
    // Usa PRAGMA table_info em vez de tabela de versão para evitar ambiguidade
    // de múltiplas linhas em inicializações consecutivas.
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='chunks_meta'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .unwrap_or(0)
        > 0;

    let needs_migration = if table_exists {
        let mut stmt = conn
            .prepare("PRAGMA table_info(chunks_meta)")
            .map_err(|e| format!("falha ao inspecionar chunks_meta: {}", e))?;
        let has_notebook_id = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("falha ao ler colunas de chunks_meta: {}", e))?
            .filter_map(|r| r.ok())
            .any(|col| col == "notebook_id");
        has_notebook_id
    } else {
        false
    };

    if needs_migration {
        // Schema antigo com notebook_id: apaga embeddings órfãos e recria sem a coluna.
        // Dados descartados — sem usuários reais nesta fase do projeto.
        conn.execute_batch(
            "DELETE FROM vec_chunks;\
             DROP TABLE chunks_meta;\
             CREATE TABLE chunks_meta (\
                 rowid INTEGER PRIMARY KEY,\
                 document_id TEXT NOT NULL,\
                 source_name TEXT NOT NULL,\
                 content TEXT NOT NULL,\
                 chunk_index INTEGER NOT NULL\
             );\
             CREATE INDEX IF NOT EXISTS idx_chunks_meta_document ON chunks_meta(document_id);",
        )
        .map_err(|e| format!("falha ao migrar chunks_meta: {}", e))?;
    } else {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS chunks_meta (\
                 rowid INTEGER PRIMARY KEY,\
                 document_id TEXT NOT NULL,\
                 source_name TEXT NOT NULL,\
                 content TEXT NOT NULL,\
                 chunk_index INTEGER NOT NULL\
             );\
             CREATE INDEX IF NOT EXISTS idx_chunks_meta_document ON chunks_meta(document_id);",
        )
        .map_err(|e| format!("falha ao criar chunks_meta: {}", e))?;
    }

    // Metadados do cabeçalho por chunk (E6). ALTER guardado: só adiciona as
    // colunas que faltam. Chunks legados ficam com os defaults até reindexar.
    let existing_cols: Vec<String> = {
        let mut stmt = conn
            .prepare("PRAGMA table_info(chunks_meta)")
            .map_err(|e| format!("falha ao inspecionar chunks_meta: {}", e))?;
        let cols = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|e| format!("falha ao ler colunas de chunks_meta: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        cols
    };
    for (col, ddl) in [
        ("header", "TEXT NOT NULL DEFAULT ''"),
        ("kind", "TEXT NOT NULL DEFAULT 'document'"),
        ("title", "TEXT NOT NULL DEFAULT ''"),
        ("doc_date", "TEXT"),
        ("folder_label", "TEXT"),
        ("section", "TEXT"),
        ("page", "INTEGER"),
        ("source_url", "TEXT"),
    ] {
        if !existing_cols.iter().any(|c| c == col) {
            conn.execute(&format!("ALTER TABLE chunks_meta ADD COLUMN {} {}", col, ddl), [])
                .map_err(|e| format!("falha ao adicionar coluna {}: {}", col, e))?;
        }
    }

    // Versão do índice por documento. Sem linha = índice legado (pendente).
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS doc_index_state (\
             document_id TEXT PRIMARY KEY,\
             index_version INTEGER NOT NULL,\
             meta_sig TEXT NOT NULL DEFAULT ''\
         );",
    )
    .map_err(|e| format!("falha ao criar doc_index_state: {}", e))?;

    ensure_fts(&conn)?;

    Ok(VecDb(Mutex::new(conn)))
}

// Índice textual (FTS5) dos chunks, com rowid = chunks_meta.rowid. É mantido
// junto com chunks_meta nas escritas (documents.rs). Se divergir (tabela nova,
// ou chunks gravados por uma versão sem FTS), é refeito a partir de
// chunks_meta: local, sem reembutir nada. Devolve true quando refez.
pub(crate) fn ensure_fts(conn: &Connection) -> Result<bool, String> {
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(header, content, tokenize = 'unicode61 remove_diacritics 2')",
        [],
    )
    .map_err(|e| format!("falha ao criar chunks_fts: {}", e))?;

    let in_sync: bool = conn
        .query_row(
            "SELECT (SELECT COUNT(*) FROM chunks_fts) = (SELECT COUNT(*) FROM chunks_meta)
                AND NOT EXISTS (
                    SELECT 1 FROM chunks_meta m
                    WHERE NOT EXISTS (SELECT 1 FROM chunks_fts f WHERE f.rowid = m.rowid)
                )",
            [],
            |r| r.get(0),
        )
        .map_err(|e| format!("falha ao verificar chunks_fts: {}", e))?;
    if in_sync {
        return Ok(false);
    }

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("falha ao iniciar backfill de chunks_fts: {}", e))?;
    tx.execute_batch(
        "DELETE FROM chunks_fts;\
         INSERT INTO chunks_fts(rowid, header, content) SELECT rowid, header, content FROM chunks_meta;",
    )
    .map_err(|e| format!("falha no backfill de chunks_fts: {}", e))?;
    tx.commit()
        .map_err(|e| format!("falha ao gravar backfill de chunks_fts: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub fn vec_db_smoke_test(state: State<'_, VecDb>) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let v: Vec<f32> = vec![0.0; EMBEDDING_DIM];
    let version: String = conn
        .query_row("SELECT vec_version()", [], |row| row.get(0))
        .map_err(|e| format!("vec_version falhou: {}", e))?;

    conn.execute(
        "INSERT INTO vec_chunks(rowid, embedding) VALUES (?1, ?2)",
        rusqlite::params![-1_i64, v.as_bytes()],
    )
    .map_err(|e| format!("insert smoke falhou: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT rowid, distance FROM vec_chunks
             WHERE embedding MATCH ?1 AND k = 1
             ORDER BY distance",
        )
        .map_err(|e| format!("prepare smoke falhou: {}", e))?;

    let (rowid, _distance): (i64, f64) = stmt
        .query_row(rusqlite::params![v.as_bytes()], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| format!("select smoke falhou: {}", e))?;

    conn.execute(
        "DELETE FROM vec_chunks WHERE rowid = ?1",
        rusqlite::params![rowid],
    )
    .map_err(|e| format!("cleanup smoke falhou: {}", e))?;

    Ok(format!("sqlite-vec ok (versao {})", version))
}
