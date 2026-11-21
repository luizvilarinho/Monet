// Comandos da Library (modo de leitura de livros). Este módulo lida SOMENTE
// com arquivos em app_data_dir/books — a tabela `books` do monet.db é de
// propriedade exclusiva do frontend (tauri-plugin-sql), seguindo o invariante
// de dono único por tabela documentado em documents.rs.
use std::fs;
use std::net::IpAddr;
use std::path::PathBuf;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tokio::task::spawn_blocking;
use uuid::Uuid;

const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;
const MAX_REDIRECTS: usize = 10;
const PDF_HEAD_WINDOW: usize = 1024;

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
            .add_filter("Books", &["pdf", "epub"])
            .pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    let src = match picked {
        None => return Ok(None),
        Some(p) => p,
    };

    // Extensao normalizada em minusculas: aceita `.EPUB`/`.PDF` (mesma
    // tolerancia do eq_ignore_ascii_case anterior) e e reusada abaixo para
    // nomear o destino, que precisa preservar o formato original.
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if ext != "pdf" && ext != "epub" {
        return Err("Only PDF and EPUB files can be imported".into());
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

    let dest = books_dir(&app)?.join(format!("{}.{}", Uuid::new_v4(), ext));
    fs::copy(&src, &dest).map_err(|e| format!("failed to copy file: {}", e))?;

    Ok(Some(BookImportResult {
        dest_path: dest.to_string_lossy().to_string(),
        file_name,
    }))
}

// Baixa um PDF de acesso aberto (o "Open in Library" de uma nota Paper) para
// app_data_dir/books, no espelho de librarian_fetch_and_save_pdf (documents.rs):
// só http/https, teto de 50 MB, assinatura %PDF- e escrita atômica (`.tmp` +
// rename). Os bytes não cruzam o IPC; o frontend registra o livro depois
// (registerBookFile). User-Agent sem e-mail. Recusa `localhost` e IP literal de
// loopback, rede privada ou link-local, na URL e em cada redirecionamento. O
// corpo é lido em pedaços: passou do teto, para na hora (sem juntar tudo antes).
#[tauri::command]
pub async fn books_download_pdf(app: AppHandle, url: String) -> Result<BookImportResult, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| "Invalid PDF link".to_string())?;
    if !is_http(&parsed) {
        return Err("Invalid PDF link".into());
    }
    if is_local_host(&parsed) {
        return Err("The link points to a local address.".into());
    }

    let policy = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS {
            attempt.error("too many redirects")
        } else if !is_http(attempt.url()) || is_local_host(attempt.url()) {
            attempt.error("redirect to a blocked address")
        } else {
            attempt.follow()
        }
    });
    let client = reqwest::Client::builder()
        .user_agent("Monet")
        .timeout(Duration::from_secs(60))
        .redirect(policy)
        .build()
        .map_err(|e| format!("http client: {}", e))?;
    let mut resp = client.get(parsed).send().await.map_err(download_error)?;
    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }
    // Descarta cedo, sem baixar, se o Content-Length já ultrapassa o teto.
    if let Some(len) = resp.content_length() {
        if len > MAX_FILE_BYTES {
            return Err(too_large(Some(len)));
        }
    }

    // Content-Length pode faltar ou mentir: o tamanho real é conferido a cada
    // pedaço, e a assinatura assim que os primeiros 1024 bytes chegam.
    let mut bytes: Vec<u8> = Vec::new();
    let mut head_checked = false;
    while let Some(chunk) = resp.chunk().await.map_err(download_error)? {
        if (bytes.len() + chunk.len()) as u64 > MAX_FILE_BYTES {
            return Err(too_large(None));
        }
        bytes.extend_from_slice(&chunk);
        if !head_checked && bytes.len() >= PDF_HEAD_WINDOW {
            if !has_pdf_signature(&bytes) {
                return Err(not_a_pdf());
            }
            head_checked = true;
        }
    }
    if !head_checked && !has_pdf_signature(&bytes) {
        return Err(not_a_pdf());
    }

    let dir = books_dir(&app)?;
    let id = Uuid::new_v4();
    let dest = dir.join(format!("{}.pdf", id));
    let tmp = dir.join(format!("{}.pdf.tmp", id));
    let (dest_write, tmp_write) = (dest.clone(), tmp.clone());
    spawn_blocking(move || {
        // Falha na escrita ou no rename: não deixa o `.tmp` parcial para trás.
        if let Err(e) = fs::write(&tmp_write, &bytes).and_then(|_| fs::rename(&tmp_write, &dest_write)) {
            let _ = fs::remove_file(&tmp_write);
            return Err(format!("failed to save file: {}", e));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(BookImportResult {
        dest_path: dest.to_string_lossy().to_string(),
        file_name: "paper".into(),
    })
}

fn download_error(e: reqwest::Error) -> String {
    if e.is_timeout() {
        "Download failed: the server took too long to respond".to_string()
    } else if e.is_redirect() {
        "Download failed: too many redirects, or a redirect to a local address".to_string()
    } else {
        "Download failed: could not reach the server".to_string()
    }
}

fn too_large(bytes: Option<u64>) -> String {
    let limit = MAX_FILE_BYTES / (1024 * 1024);
    match bytes {
        Some(b) => format!("PDF too large ({:.1} MB). Limit: {} MB.", b as f64 / (1024.0 * 1024.0), limit),
        // Passou do teto no meio da leitura: o tamanho total não se sabe.
        None => format!("PDF too large (over {} MB). Limit: {} MB.", limit, limit),
    }
}

fn not_a_pdf() -> String {
    "The link did not return a PDF (the publisher may require a browser). Use Open to read the paper in your browser."
        .into()
}

fn is_http(url: &reqwest::Url) -> bool {
    url.scheme() == "http" || url.scheme() == "https"
}

// O cabeçalho `%PDF-` pode vir depois de alguns bytes (a especificação do PDF e
// o pdf.js aceitam até o 1024º), não só no byte 0.
fn has_pdf_signature(head: &[u8]) -> bool {
    head[..head.len().min(PDF_HEAD_WINDOW)]
        .windows(5)
        .any(|w| w == b"%PDF-")
}

// `localhost` (e `*.localhost`) ou IP literal de loopback, rede privada ou
// link-local. O `url` já normaliza `2130706433` e `0x7f.1` para `127.0.0.1`. Um
// nome que resolve para um IP local não é pego (não há consulta de DNS aqui).
fn is_local_host(url: &reqwest::Url) -> bool {
    let host = match url.host_str() {
        Some(h) => h.trim_end_matches('.').to_ascii_lowercase(),
        None => return true,
    };
    if host == "localhost" || host.ends_with(".localhost") {
        return true;
    }
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    match bare.parse::<IpAddr>() {
        Ok(ip) => is_local_ip(ip),
        Err(_) => false,
    }
}

fn is_local_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let o = v4.octets();
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                // 100.64.0.0/10 (espaço compartilhado, ex.: Tailscale).
                || (o[0] == 100 && (o[1] & 0xc0) == 0x40)
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_local_ip(IpAddr::V4(v4));
            }
            let first = v6.segments()[0];
            v6.is_loopback()
                || v6.is_unspecified()
                || (first & 0xfe00) == 0xfc00 // fc00::/7, endereço local único
                || (first & 0xffc0) == 0xfe80 // fe80::/10, link-local
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn local(url: &str) -> bool {
        is_local_host(&reqwest::Url::parse(url).unwrap())
    }

    #[test]
    fn signature_at_the_start_or_within_the_first_1024_bytes() {
        assert!(has_pdf_signature(b"%PDF-1.7
..."));
        let mut padded = vec![b' '; 1000];
        padded.extend_from_slice(b"%PDF-1.4
");
        assert!(has_pdf_signature(&padded));
    }

    #[test]
    fn signature_past_the_window_or_missing_is_not_a_pdf() {
        let mut late = vec![b' '; 1021];
        late.extend_from_slice(b"%PDF-1.4");
        assert!(!has_pdf_signature(&late));
        assert!(!has_pdf_signature(b"<!DOCTYPE html><html></html>"));
        assert!(!has_pdf_signature(b""));
        assert!(!has_pdf_signature(b"%PDF"));
    }

    #[test]
    fn blocks_localhost_and_loopback_private_and_link_local_literals() {
        for url in [
            "http://localhost/a.pdf",
            "http://LOCALHOST:8080/a.pdf",
            "http://localhost./a.pdf",
            "http://paper.localhost/a.pdf",
            "http://127.0.0.1/a.pdf",
            "http://127.1.2.3:3000/a.pdf",
            "http://10.0.0.5/a.pdf",
            "http://172.16.4.2/a.pdf",
            "http://172.31.255.255/a.pdf",
            "http://192.168.1.10/a.pdf",
            "http://169.254.169.254/latest/meta-data",
            "http://100.64.0.1/a.pdf",
            "http://0.0.0.0/a.pdf",
            "http://2130706433/a.pdf",
            "http://0x7f.1/a.pdf",
            "http://[::1]/a.pdf",
            "http://[::]/a.pdf",
            "http://[fe80::1]/a.pdf",
            "http://[fd12:3456::1]/a.pdf",
            "http://[::ffff:127.0.0.1]/a.pdf",
            "http://[::ffff:192.168.0.2]/a.pdf",
        ] {
            assert!(local(url), "{url} should be blocked");
        }
    }

    #[test]
    fn allows_public_hosts_and_addresses() {
        for url in [
            "https://repo.example.org/files/p.pdf",
            "https://localhost.example.org/a.pdf",
            "https://mylocalhost.com/a.pdf",
            "http://8.8.8.8/a.pdf",
            "http://172.15.0.1/a.pdf",
            "http://172.32.0.1/a.pdf",
            "http://100.63.0.1/a.pdf",
            "http://100.128.0.1/a.pdf",
            "http://[2606:4700::1111]/a.pdf",
        ] {
            assert!(!local(url), "{url} should be allowed");
        }
    }

    #[test]
    fn only_http_and_https_are_accepted() {
        assert!(is_http(&reqwest::Url::parse("https://x.org/a.pdf").unwrap()));
        assert!(is_http(&reqwest::Url::parse("http://x.org/a.pdf").unwrap()));
        assert!(!is_http(&reqwest::Url::parse("ftp://x.org/a.pdf").unwrap()));
        assert!(!is_http(&reqwest::Url::parse("file:///C:/a.pdf").unwrap()));
    }

    #[test]
    fn too_large_message_with_and_without_the_real_size() {
        assert_eq!(too_large(Some(60 * 1024 * 1024)), "PDF too large (60.0 MB). Limit: 50 MB.");
        assert_eq!(too_large(None), "PDF too large (over 50 MB). Limit: 50 MB.");
    }
}
