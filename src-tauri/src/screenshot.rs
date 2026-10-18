// Print da tela para o chat do Assistant: captura (GDI) o monitor onde a
// janela assistant está, sem ela, e devolve um data URL JPEG que o composer
// trata como imagem colada. A janela sai do print por
// `WDA_EXCLUDEFROMCAPTURE` só durante a captura (fora dela, continua visível
// em gravações e compartilhamento de tela); no Windows anterior ao 10 2004,
// ela é escondida e mostrada de novo.
use std::sync::{mpsc, OnceLock};
use std::thread::sleep;
use std::time::Duration;

use tauri::{AppHandle, Manager, WebviewWindow};
use tokio::task::spawn_blocking;
use windows::Graphics::Imaging::{BitmapAlphaMode, BitmapEncoder, BitmapPixelFormat};
use windows::Security::Cryptography::CryptographicBuffer;
use windows::Storage::Streams::{Buffer, InMemoryRandomAccessStream, InputStreamOptions};
use windows::System::Profile::AnalyticsInfo;
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
    GetMonitorInfoW, MonitorFromWindow, ReleaseDC, SelectObject, SetBrushOrgEx,
    SetStretchBltMode, StretchBlt, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    HALFTONE, MONITORINFO, MONITOR_DEFAULTTONEAREST, SRCCOPY,
};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE, WINDOW_DISPLAY_AFFINITY,
};

// Lado maior do print: limita o tamanho para os modelos de visão e para a
// cota do chat (localStorage).
const MAX_SIDE: i32 = 2000;
// Espera para o DWM aplicar a exclusão (ou o hide do fallback) antes de ler a tela.
const EXCLUDE_SETTLE: Duration = Duration::from_millis(100);
const HIDE_SETTLE: Duration = Duration::from_millis(150);
// 1º build com `WDA_EXCLUDEFROMCAPTURE` (Windows 10 2004). Antes dele a chamada
// não falha: aplica `WDA_MONITOR`, e a janela sairia preta no print.
const EXCLUDE_MIN_BUILD: u64 = 19041;

struct Capture {
    width: u32,
    height: u32,
    bgra: Vec<u8>,
}

fn monitor_rect(hwnd: HWND) -> Result<RECT, String> {
    let mut info = MONITORINFO {
        cbSize: size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    // SAFETY: `info` é um MONITORINFO válido com `cbSize` preenchido, e o
    // HMONITOR vem direto de `MonitorFromWindow` (nunca nulo com NEAREST).
    let ok = unsafe { GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mut info) };
    if !ok.as_bool() {
        return Err("Could not find the monitor of the Assistant window.".to_string());
    }
    Ok(info.rcMonitor)
}

// Lê um retângulo da tela (coordenadas físicas do desktop virtual) em BGRA,
// reduzido pelo StretchBlt se o lado maior passar de `MAX_SIDE`.
fn capture_rect(rect: RECT) -> Result<Capture, String> {
    let (src_w, src_h) = (rect.right - rect.left, rect.bottom - rect.top);
    if src_w <= 0 || src_h <= 0 {
        return Err("The monitor has no visible area.".to_string());
    }
    let scale = (MAX_SIDE as f64 / src_w.max(src_h) as f64).min(1.0);
    let width = ((src_w as f64 * scale).round() as i32).max(1);
    let height = ((src_h as f64 * scale).round() as i32).max(1);
    let mut bgra = vec![0u8; width as usize * height as usize * 4];
    // SAFETY: todo handle GDI criado aqui é liberado antes de sair do bloco
    // (não há `?` nem retorno entre a criação e a liberação; o único retorno
    // vem antes). `bgra` tem exatamente `width * height * 4` bytes, o que o
    // GetDIBits escreve com 32 bpp e `BI_RGB` (stride sem padding).
    let lines = unsafe {
        let screen = GetDC(None);
        if screen.is_invalid() {
            return Err("Could not read the screen.".to_string());
        }
        let mem = CreateCompatibleDC(Some(screen));
        let bitmap = CreateCompatibleBitmap(screen, width, height);
        let previous = SelectObject(mem, bitmap.into());
        SetStretchBltMode(mem, HALFTONE);
        let _ = SetBrushOrgEx(mem, 0, 0, None);
        let copied = StretchBlt(
            mem, 0, 0, width, height, Some(screen), rect.left, rect.top, src_w, src_h, SRCCOPY,
        );
        // O GetDIBits pede o bitmap fora do DC.
        SelectObject(mem, previous);
        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                // Negativo: linhas de cima para baixo.
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let lines = if copied.as_bool() {
            GetDIBits(
                mem,
                bitmap,
                0,
                height as u32,
                Some(bgra.as_mut_ptr().cast()),
                &mut info,
                DIB_RGB_COLORS,
            )
        } else {
            0
        };
        let _ = DeleteObject(bitmap.into());
        let _ = DeleteDC(mem);
        ReleaseDC(None, screen);
        lines
    };
    if lines != height {
        return Err("Could not read the screen.".to_string());
    }
    Ok(Capture { width: width as u32, height: height as u32, bgra })
}

fn encode_jpeg(capture: &Capture) -> windows::core::Result<String> {
    let stream = InMemoryRandomAccessStream::new()?;
    let encoder = BitmapEncoder::CreateAsync(BitmapEncoder::JpegEncoderId()?, &stream)?.get()?;
    encoder.SetPixelData(
        BitmapPixelFormat::Bgra8,
        BitmapAlphaMode::Ignore,
        capture.width,
        capture.height,
        96.0,
        96.0,
        &capture.bgra,
    )?;
    encoder.FlushAsync()?.get()?;
    let size = stream.Size()? as u32;
    stream.Seek(0)?;
    let data = stream
        .ReadAsync(&Buffer::Create(size)?, size, InputStreamOptions::None)?
        .get()?;
    Ok(CryptographicBuffer::EncodeToBase64String(&data)?.to_string())
}

// Build do Windows (0 se não der para ler, o que leva ao fallback).
fn windows_build() -> u64 {
    static BUILD: OnceLock<u64> = OnceLock::new();
    *BUILD.get_or_init(|| {
        // "a.b.c.d" empacotado num u64, 16 bits por parte; o build é a 3ª.
        AnalyticsInfo::VersionInfo()
            .and_then(|info| info.DeviceFamilyVersion())
            .ok()
            .and_then(|version| version.to_string().parse::<u64>().ok())
            .map_or(0, |version| (version >> 16) & 0xFFFF)
    })
}

// Na thread da janela (dona do HWND). O HWND não é Send: cruza a thread como
// inteiro. `false` se a chamada falhar.
fn set_display_affinity(window: &WebviewWindow, hwnd: isize, affinity: WINDOW_DISPLAY_AFFINITY) -> bool {
    let (tx, rx) = mpsc::channel();
    let scheduled = window.run_on_main_thread(move || {
        // SAFETY: `hwnd` é o HWND da própria janela, lido na captura, e a
        // chamada roda na thread dona dela, como a API exige.
        let ok = unsafe { SetWindowDisplayAffinity(HWND(hwnd as _), affinity) }.is_ok();
        let _ = tx.send(ok);
    });
    scheduled.is_ok() && rx.recv().unwrap_or(false)
}

// Janela fora do print enquanto o guard existir. O Drop sempre volta a
// `WDA_NONE`, inclusive em erro ou panic.
struct ExcludedFromCapture<'a> {
    window: &'a WebviewWindow,
    hwnd: isize,
}

impl<'a> ExcludedFromCapture<'a> {
    // `None` em Windows sem `WDA_EXCLUDEFROMCAPTURE` ou se a chamada falhar.
    fn new(window: &'a WebviewWindow, hwnd: isize) -> Option<Self> {
        (windows_build() >= EXCLUDE_MIN_BUILD
            && set_display_affinity(window, hwnd, WDA_EXCLUDEFROMCAPTURE))
        .then_some(Self { window, hwnd })
    }
}

impl Drop for ExcludedFromCapture<'_> {
    fn drop(&mut self) {
        if !set_display_affinity(self.window, self.hwnd, WDA_NONE) {
            eprintln!("screenshot: could not restore WDA_NONE on the assistant window");
        }
    }
}

// Bloqueante: chamar em `spawn_blocking`.
fn capture_without_window(window: &WebviewWindow) -> Result<String, String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let rect = monitor_rect(hwnd)?;
    let capture = match ExcludedFromCapture::new(window, hwnd.0 as isize) {
        // O guard cai no fim deste braço, logo depois da captura.
        Some(_excluded) => {
            sleep(EXCLUDE_SETTLE);
            capture_rect(rect)
        }
        None => {
            let _ = window.hide();
            sleep(HIDE_SETTLE);
            let capture = capture_rect(rect);
            let _ = window.show();
            let _ = window.set_focus();
            capture
        }
    }?;
    let b64 = encode_jpeg(&capture)
        .map_err(|e| format!("Could not encode the screenshot: {}", e.message()))?;
    Ok(format!("data:image/jpeg;base64,{b64}"))
}

#[tauri::command]
pub async fn capture_screen_without_assistant(app: AppHandle) -> Result<String, String> {
    let window = app
        .get_webview_window("assistant")
        .ok_or_else(|| "Assistant window not found.".to_string())?;
    spawn_blocking(move || capture_without_window(&window))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;
    use windows::core::w;
    use windows::Win32::Foundation::{COLORREF, LPARAM, LRESULT, WPARAM};
    use windows::Win32::Graphics::Gdi::CreateSolidBrush;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetDesktopWindow,
        PeekMessageW, RegisterClassW, UnregisterClassW, MSG, PM_REMOVE, WNDCLASSW,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP, WS_VISIBLE,
    };

    // Todo Windows 10/11 tem build >= 10240; 0 seria falha na leitura.
    #[test]
    fn reads_windows_build() {
        let build = windows_build();
        eprintln!("windows build: {build}");
        assert!(build >= 10240, "build {build}");
    }

    // Print real do monitor principal (nada gravado em disco):
    // `cargo test --lib screenshot -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn captures_primary_monitor() {
        let rect = monitor_rect(unsafe { GetDesktopWindow() }).expect("monitor");
        let capture = capture_rect(rect).expect("capture");
        eprintln!(
            "monitor {}x{} -> capture {}x{}",
            rect.right - rect.left,
            rect.bottom - rect.top,
            capture.width,
            capture.height
        );
        assert!(capture.width > 0 && capture.height > 0);
        assert!(capture.width.max(capture.height) <= MAX_SIDE as u32);
        assert_eq!(capture.bgra.len(), capture.width as usize * capture.height as usize * 4);
        let b64 = encode_jpeg(&capture).expect("encode");
        eprintln!("jpeg base64: {} KB", b64.len() / 1024);
        // "/9j/" = início (FF D8 FF) de um JPEG em base64.
        assert!(b64.starts_with("/9j/"));
        // Área maior que `MAX_SIDE` (fora da tela vira preto): reduzida na proporção.
        let big = capture_rect(RECT { left: 0, top: 0, right: 4000, bottom: 2000 }).expect("capture");
        assert_eq!((big.width, big.height), (2000, 1000));
    }

    unsafe extern "system" fn wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
    }

    fn pump(duration: Duration) {
        let end = Instant::now() + duration;
        let mut msg = MSG::default();
        while Instant::now() < end {
            while unsafe { PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE) }.as_bool() {
                unsafe { DispatchMessageW(&msg) };
            }
            sleep(Duration::from_millis(10));
        }
    }

    fn center_is_red(rect: RECT) -> bool {
        let capture = capture_rect(rect).expect("capture");
        let i = ((capture.height / 2 * capture.width + capture.width / 2) * 4) as usize;
        let (b, g, r) = (capture.bgra[i], capture.bgra[i + 1], capture.bgra[i + 2]);
        r > 240 && g < 15 && b < 15
    }

    // Mostra por ~1 s um quadrado vermelho no canto do monitor principal e
    // confere que ele sai do print com `WDA_EXCLUDEFROMCAPTURE`.
    #[test]
    #[ignore]
    fn excluded_window_is_not_captured() {
        let class = w!("MonetScreenshotTest");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(wndproc),
            lpszClassName: class,
            hbrBackground: unsafe { CreateSolidBrush(COLORREF(0x0000_00FF)) },
            ..Default::default()
        };
        assert_ne!(unsafe { RegisterClassW(&wc) }, 0, "RegisterClassW");
        let hwnd = unsafe {
            CreateWindowExW(
                WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
                class,
                w!("Monet screenshot test"),
                WS_POPUP | WS_VISIBLE,
                100,
                100,
                300,
                300,
                None,
                None,
                None,
                None,
            )
        }
        .expect("CreateWindowExW");
        pump(Duration::from_millis(400));
        let rect = RECT { left: 100, top: 100, right: 400, bottom: 400 };
        let visible_before = center_is_red(rect);
        unsafe { SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) }.expect("affinity");
        let start = Instant::now();
        let mut excluded_after = None;
        while start.elapsed() < Duration::from_secs(1) {
            if !center_is_red(rect) {
                excluded_after = Some(start.elapsed());
                break;
            }
            pump(Duration::from_millis(5));
        }
        let _ = unsafe { SetWindowDisplayAffinity(hwnd, WDA_NONE) };
        pump(Duration::from_millis(200));
        let visible_again = center_is_red(rect);
        let _ = unsafe { DestroyWindow(hwnd) };
        let _ = unsafe { UnregisterClassW(class, None) };
        eprintln!(
            "visible before: {visible_before}, excluded after: {excluded_after:?}, visible again: {visible_again}"
        );
        assert!(visible_before, "test window was not captured before the exclusion");
        let elapsed = excluded_after.expect("window still captured after WDA_EXCLUDEFROMCAPTURE");
        assert!(elapsed < EXCLUDE_SETTLE, "exclusion took {elapsed:?}");
        assert!(visible_again, "window not captured after WDA_NONE");
    }
}
