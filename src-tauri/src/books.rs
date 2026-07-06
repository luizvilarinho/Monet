// Comandos da Library (modo de leitura de livros). Este módulo lida SOMENTE
// com arquivos em app_data_dir/books — a tabela `books` do monet.db é de
// propriedade exclusiva do frontend (tauri-plugin-sql), seguindo o invariante
// de dono único por tabela documentado em documents.rs.
use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tokio::task::spawn_blocking;
use uuid::Uuid;

const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookImportResult {
    dest_path: String,
    file_name: String,
}

fn books_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {}", e))?
        .join("books");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create books folder: {}", e))?;
    Ok(dir)
}

#[tauri::command]
pub async fn books_import_file(app: AppHandle) -> Result<Option<BookImportResult>, String> {
    let picked = spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("PDF", &["pdf"])
            .pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    let src = match picked {
        None => return Ok(None),
        Some(p) => p,
    };

    let is_pdf = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);
    if !is_pdf {
        return Err("Only PDF files can be imported".into());
    }

    let size = fs::metadata(&src)
        .map_err(|e| format!("failed to read file: {}", e))?
        .len();
    if size > MAX_FILE_BYTES {
        return Err("File exceeds the 50 MB limit".into());
    }

    let file_name = src
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string();

    let dest = books_dir(&app)?.join(format!("{}.pdf", Uuid::new_v4()));
    fs::copy(&src, &dest).map_err(|e| format!("failed to copy file: {}", e))?;

    Ok(Some(BookImportResult {
        dest_path: dest.to_string_lossy().to_string(),
        file_name,
    }))
}

#[tauri::command]
pub async fn books_read_file(app: AppHandle, path: String) -> Result<tauri::ipc::Response, String> {
    let dir = books_dir(&app)?;
    let p = std::path::Path::new(&path);
    // Valida o path ANTES de qualquer resposta que dependa da existência do
    // arquivo — a diferença "not found"/"access denied" não pode servir de
    // sonda de existência fora de books/. Prefixo do path bruto + rejeição de
    // `..`; o canonicalize abaixo cobre o restante (ex.: symlinks).
    if p.components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
        || !p.starts_with(&dir)
    {
        return Err("Access denied: path is outside books directory".into());
    }
    if !p.exists() {
        return Err("Book file not found".into());
    }
    let canonical_path = p.canonicalize().map_err(|e| e.to_string())?;
    let canonical_dir = dir.canonicalize().unwrap_or_else(|_| dir.clone());
    if !canonical_path.starts_with(&canonical_dir) {
        return Err("Access denied: path is outside books directory".into());
    }
    let bytes = fs::read(&canonical_path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub async fn books_delete_file(app: AppHandle, path: String) -> Result<(), String> {
    let dir = books_dir(&app)?;
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Ok(());
    }
    let canonical_path = p.canonicalize().map_err(|e| e.to_string())?;
    let canonical_dir = dir.canonicalize().unwrap_or_else(|_| dir.clone());
    if !canonical_path.starts_with(&canonical_dir) {
        return Err("Access denied: path is outside books directory".into());
    }
    fs::remove_file(&canonical_path).map_err(|e| e.to_string())?;
    Ok(())
}
