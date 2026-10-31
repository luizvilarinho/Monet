// Texto legível de uma página web (porte do webpage.rs do VOLP).
use std::time::Duration;

use futures_util::StreamExt;

const MAX_PAGE_BYTES: usize = 10 * 1024 * 1024;
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Devolve (título do artigo, texto).
pub(crate) async fn fetch_article(url: &str) -> Result<(Option<String>, String), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Could not create the HTTP client: {}", e))?;

    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Could not open the URL: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("The page returned HTTP {}.", response.status()));
    }

    // Só HTML/texto e com teto: um link para arquivo grande não vai para a memória.
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_ascii_lowercase);
    if let Some(ct) = content_type {
        if !(ct.starts_with("text/") || ct.contains("html") || ct.contains("xml")) {
            return Err("This URL is not a web page.".to_string());
        }
    }
    let too_large = || "The page is larger than 10 MB.".to_string();
    if response.content_length().is_some_and(|n| n > MAX_PAGE_BYTES as u64) {
        return Err(too_large());
    }
    let mut body = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Could not read the page: {}", e))?;
        if body.len() + chunk.len() > MAX_PAGE_BYTES {
            return Err(too_large());
        }
        body.extend_from_slice(&chunk);
    }
    let html = String::from_utf8_lossy(&body).into_owned();

    let owned_url = url.to_string();
    let (title, text) = tokio::task::spawn_blocking(move || {
        let mut readability = dom_smoothie::Readability::new(html, Some(&owned_url), None)
            .map_err(|e| format!("Could not process the HTML: {}", e))?;
        let article = readability
            .parse()
            .map_err(|e| format!("Could not extract the page content: {}", e))?;
        let title = article.title.trim().to_string();
        Ok::<_, String>((
            if title.is_empty() { None } else { Some(title) },
            article.text_content.trim().to_string(),
        ))
    })
    .await
    .map_err(|e| format!("Could not extract the page content: {}", e))??;

    if text.is_empty() {
        return Err("This page has no readable content.".to_string());
    }
    Ok((title, text))
}
