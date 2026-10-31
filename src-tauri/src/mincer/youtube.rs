// Áudio de vídeos do YouTube via yt-dlp (porte do youtube.rs do VOLP).
use std::fs;
use std::path::{Path, PathBuf};

use super::sidecar::{self, JobCtx, JobError};

const INVALID_URL: &str = "Invalid URL. Paste a valid YouTube link.";
// Os clientes android e mweb contornam o PO Token do YouTube.
const EXTRACTOR_ARGS: &str = "youtube:player_client=android,mweb";
const AUDIO_EXTS: [&str; 6] = ["m4a", "webm", "opus", "ogg", "mp4", "mp3"];

// Só aceita link http(s) de host do YouTube com id de vídeo válido: a URL vai
// inteira ao yt-dlp, depois de "--", e nunca pode virar opção dele.
pub(crate) fn validate_youtube_url(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| INVALID_URL.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(INVALID_URL.to_string());
    }
    let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    let mut segments = parsed.path_segments().into_iter().flatten().filter(|s| !s.is_empty());
    match host.as_str() {
        "youtu.be" => validate_video_id(segments.next().unwrap_or("")),
        "youtube.com" | "www.youtube.com" | "m.youtube.com" | "music.youtube.com" => {
            if segments.next() == Some("shorts") {
                return validate_video_id(segments.next().unwrap_or(""));
            }
            let id = parsed
                .query_pairs()
                .find(|(k, _)| k == "v")
                .map(|(_, v)| v.into_owned())
                .unwrap_or_default();
            validate_video_id(&id)
        }
        _ => Err(INVALID_URL.to_string()),
    }
}

fn validate_video_id(id: &str) -> Result<(), String> {
    if id.len() != 11
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(INVALID_URL.to_string());
    }
    Ok(())
}

pub(crate) async fn fetch_title(ctx: &JobCtx, yt_dlp: &Path, url: &str) -> Option<String> {
    let mut cmd = sidecar::command(yt_dlp);
    cmd.args([
        "--skip-download",
        "--no-playlist",
        "--no-warnings",
        "--print",
        "%(title)s",
        "--extractor-args",
        EXTRACTOR_ARGS,
        "--",
        url,
    ]);
    let output = sidecar::run(ctx, cmd).await.ok()?;
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .map(str::to_string)
}

fn find_audio(dir: &Path) -> Option<PathBuf> {
    AUDIO_EXTS
        .iter()
        .map(|ext| dir.join(format!("yt_audio.{}", ext)))
        .find(|p| p.exists())
}

pub(crate) async fn download_audio(
    ctx: &JobCtx,
    yt_dlp: &Path,
    url: &str,
    dir: &Path,
) -> Result<PathBuf, JobError> {
    let marker = dir.join("yt_audio.done");
    if marker.exists() {
        if let Some(path) = find_audio(dir) {
            return Ok(path);
        }
    }

    ctx.progress("downloading", 0, 100);
    let template = dir.join("yt_audio.%(ext)s");
    let mut cmd = sidecar::command(yt_dlp);
    cmd.args([
        "--format",
        "bestaudio*",
        "--no-playlist",
        "--newline",
        "--extractor-args",
        EXTRACTOR_ARGS,
        "-o",
    ])
    .arg(&template)
    .args(["--", url]);

    let mut last_pct: i64 = 0;
    sidecar::run_with_lines(ctx, cmd, |line| {
        let Some(rest) = line.trim_start().strip_prefix("[download]") else {
            return;
        };
        let Some(token) = rest.trim_start().split('%').next() else {
            return;
        };
        if let Ok(pct) = token.trim().parse::<f64>() {
            let pct = pct as i64;
            if pct != last_pct {
                last_pct = pct;
                ctx.progress("downloading", pct, 100);
            }
        }
    })
    .await
    .map_err(|e| e.context("Could not download the YouTube audio"))?;

    let path = find_audio(dir)
        .ok_or_else(|| JobError::Failed("yt-dlp did not produce the audio file.".into()))?;
    fs::write(&marker, b"").map_err(|e| format!("Could not save progress: {}", e))?;
    Ok(path)
}
