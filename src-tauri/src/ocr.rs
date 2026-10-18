// OCR local das imagens coladas nas notas (OCR nativo do Windows, WinRT). O
// texto vai só para o índice do RAG; a nota não muda. Cache por hash em
// `image_ocr_cache` (monet.db), criado em `open_doc_db`.
use std::collections::HashMap;

use rusqlite::params;
use tauri::{AppHandle, State};
use tokio::task::spawn_blocking;
use windows::core::HSTRING;
use windows::Graphics::Imaging::{BitmapAlphaMode, BitmapDecoder, BitmapPixelFormat};
use windows::Media::Ocr::OcrEngine;
use windows::Security::Cryptography::CryptographicBuffer;
use windows::Storage::Streams::InMemoryRandomAccessStream;

use crate::documents::{now_ms, with_doc_db, DocDb};

// Tetos da imagem: o base64 (antes de decodificar e de virar UTF-16) e os
// pixels do bitmap Bgra8 (4 bytes/pixel; 25 MP ~ 100 MB). Acima disso, sem
// texto (vai para o cache, não repete).
const MAX_OCR_BASE64_BYTES: usize = 20 * 1024 * 1024;
const MAX_OCR_PIXELS: u64 = 25_000_000;

// `Ok(None)`: sem engine (nenhum idioma de OCR instalado ou falha ao ativar o
// WinRT), pular sem erro. `Err`: a imagem não pôde ser lida ou reconhecida.
// Bloqueante: chamar em `spawn_blocking`. Ativar o WinRT numa thread sem
// apartment funciona porque o windows-core cai no MTA implícito.
fn ocr_base64(b64: &str) -> Result<Option<String>, String> {
    let engine = match OcrEngine::TryCreateFromUserProfileLanguages() {
        Ok(engine) => engine,
        Err(e) => {
            eprintln!("OCR engine unavailable: {} ({})", e.message(), e.code());
            return Ok(None);
        }
    };
    if b64.len() > MAX_OCR_BASE64_BYTES {
        return Ok(Some(String::new()));
    }
    let recognize = || -> windows::core::Result<String> {
        let buffer = CryptographicBuffer::DecodeFromBase64String(&HSTRING::from(b64))?;
        let stream = InMemoryRandomAccessStream::new()?;
        stream.WriteAsync(&buffer)?.get()?;
        stream.Seek(0)?;
        let decoder = BitmapDecoder::CreateAsync(&stream)?.get()?;
        // Imagem acima do limite do engine: sem texto (fica no cache, não repete).
        let max = OcrEngine::MaxImageDimension()?;
        let (width, height) = (decoder.PixelWidth()?, decoder.PixelHeight()?);
        if width > max || height > max || width as u64 * height as u64 > MAX_OCR_PIXELS {
            return Ok(String::new());
        }
        let bitmap = decoder
            .GetSoftwareBitmapConvertedAsync(BitmapPixelFormat::Bgra8, BitmapAlphaMode::Premultiplied)?
            .get()?;
        Ok(engine.RecognizeAsync(&bitmap)?.get()?.Text()?.to_string())
    };
    recognize().map(Some).map_err(|e| format!("OCR failed: {}", e.message()))
}

// async: um comando síncrono rodaria na main thread, e o busy_timeout do
// monet.db congelaria a UI.
#[tauri::command]
pub async fn ocr_cached(
    app: AppHandle,
    state: State<'_, DocDb>,
    hashes: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    with_doc_db(&app, &state, |conn| {
        let mut stmt = conn
            .prepare("SELECT text FROM image_ocr_cache WHERE hash = ?1")
            .map_err(|e| format!("failed to query OCR cache: {}", e))?;
        let mut out = HashMap::new();
        for hash in hashes {
            match stmt.query_row(params![hash], |r| r.get::<_, String>(0)) {
                Ok(text) => {
                    out.insert(hash, text);
                }
                Err(rusqlite::Error::QueryReturnedNoRows) => {}
                Err(e) => return Err(format!("failed to query OCR cache: {}", e)),
            }
        }
        Ok(out)
    })
}

// Roda o OCR de um data URL de imagem e grava no cache (inclusive texto vazio,
// para não repetir). Sem engine devolve `None` e não grava.
#[tauri::command]
pub async fn ocr_image(
    app: AppHandle,
    state: State<'_, DocDb>,
    hash: String,
    data_url: String,
) -> Result<Option<String>, String> {
    let b64 = data_url
        .split_once(";base64,")
        .map(|(_, b64)| b64.to_string())
        .ok_or_else(|| "Invalid image data URL".to_string())?;
    let text = spawn_blocking(move || ocr_base64(&b64))
        .await
        .map_err(|e| e.to_string())??;
    let Some(text) = text else { return Ok(None) };
    with_doc_db(&app, &state, |conn| {
        conn.execute(
            "INSERT OR REPLACE INTO image_ocr_cache (hash, text, created_at) VALUES (?1, ?2, ?3)",
            params![hash, text, now_ms()],
        )
        .map_err(|e| format!("failed to save OCR cache: {}", e))
    })?;
    Ok(Some(text))
}

#[cfg(test)]
mod tests {
    use super::*;

    // OCR real numa imagem gerada aqui (System.Drawing via PowerShell, texto
    // fixo). Depende do idioma de OCR instalado: `cargo test --lib -- --ignored`.
    #[test]
    #[ignore]
    fn ocr_reads_generated_image() {
        let script = r#"
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 900, 160
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$font = New-Object System.Drawing.Font 'Segoe UI', 36
$g.DrawString('Especificação da migração 9.0.1', $font, [System.Drawing.Brushes]::Black, 20, 40)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[Convert]::ToBase64String($ms.ToArray())
"#;
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .expect("powershell");
        let b64 = String::from_utf8_lossy(&out.stdout).trim().to_string();
        assert!(!b64.is_empty(), "image generation failed");
        let Some(text) = ocr_base64(&b64).expect("ocr") else {
            eprintln!("no OCR language installed; skipped");
            return;
        };
        eprintln!("OCR text: {}", text);
        let lower = text.to_lowercase();
        assert!(lower.contains("especifica"), "unexpected OCR text: {}", text);
        assert!(lower.contains("9.0.1"), "unexpected OCR text: {}", text);
    }

    #[test]
    fn invalid_image_is_an_error_not_a_panic() {
        // Base64 válido que não é imagem: Err (ou None sem engine), nunca pânico.
        assert!(!matches!(ocr_base64("aGVsbG8="), Ok(Some(_))));
    }
}
