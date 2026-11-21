// Texto legível de uma página web (porte do webpage.rs do VOLP).
use std::time::Duration;

use futures_util::StreamExt;

const MAX_PAGE_BYTES: usize = 10 * 1024 * 1024;
// O JSON do Tavily leva o texto com escapes: a resposta pode passar um pouco do
// teto do texto, que é conferido depois de ler o JSON.
const MAX_TAVILY_BODY_BYTES: usize = 2 * MAX_PAGE_BYTES;
const TAVILY_EXTRACT_URL: &str = "https://api.tavily.com/extract";
const TAVILY_TIMEOUT_SECS: u64 = 30;
const TAVILY_REASON_CHARS: usize = 200;
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const PAGE_TOO_LARGE: &str = "The page is larger than 10 MB.";
const BLOCKED_SENTENCE: &str = "This site blocked direct access because it requires a web browser.";
const PASTE_HINT: &str = "Open the page in your browser, copy the text and paste it in the Paste tab of Mincer.";

pub(crate) enum FetchError {
    // O site barrou o pedido direto (is_blocked): quem chama decide o que fazer.
    Blocked,
    Failed(String),
}

impl From<String> for FetchError {
    fn from(message: String) -> Self {
        FetchError::Failed(message)
    }
}

// Barrado: 401, 403 ou qualquer resposta com cf-mitigated (desafio da Cloudflare).
fn is_blocked(status: reqwest::StatusCode, headers: &reqwest::header::HeaderMap) -> bool {
    status == reqwest::StatusCode::UNAUTHORIZED
        || status == reqwest::StatusCode::FORBIDDEN
        || headers.contains_key("cf-mitigated")
}

// Sem chave do Tavily: a saída é abrir a página e colar o texto.
pub(crate) fn blocked_message() -> String {
    format!(
        "{} {} With a Tavily key in Settings (Web Search), Mincer tries to read the page through Tavily.",
        BLOCKED_SENTENCE, PASTE_HINT
    )
}

// A frase diz as duas coisas (o bloqueio e a falha do Tavily); o motivo da
// falha vai no detalhe, depois da linha em branco.
pub(crate) fn tavily_failure_message(error: &TavilyError) -> String {
    match error {
        TavilyError::TooLarge => PAGE_TOO_LARGE.to_string(),
        TavilyError::Failed(detail) => format!(
            "This site blocked direct access because it requires a web browser, and reading it through Tavily failed too. {}\n\n{}",
            PASTE_HINT, detail
        ),
    }
}

// Devolve (título do artigo, texto).
pub(crate) async fn fetch_article(url: &str) -> Result<(Option<String>, String), FetchError> {
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

    if is_blocked(response.status(), response.headers()) {
        return Err(FetchError::Blocked);
    }
    if !response.status().is_success() {
        return Err(format!("The page returned HTTP {}.", response.status()).into());
    }

    // Só HTML/texto e com teto: um link para arquivo grande não vai para a memória.
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_ascii_lowercase);
    if let Some(ct) = content_type {
        if !(ct.starts_with("text/") || ct.contains("html") || ct.contains("xml")) {
            return Err("This URL is not a web page.".to_string().into());
        }
    }
    let too_large = || FetchError::Failed(PAGE_TOO_LARGE.to_string());
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
        return Err("This page has no readable content.".to_string().into());
    }
    Ok((title, text))
}

pub(crate) enum TavilyError {
    // O texto passa do teto de tamanho da página.
    TooLarge,
    // O motivo, em uma frase, para o detalhe do erro do item.
    Failed(String),
}

// Mesmo contrato do tavilyExtract (src/lib/search.ts): só a URL vai ao Tavily.
fn tavily_request_body(url: &str) -> serde_json::Value {
    serde_json::json!({ "urls": [url], "format": "markdown" })
}

// Segunda tentativa quando o site barra o acesso direto: o Tavily lê a página
// e devolve o texto (sem título).
pub(crate) async fn extract_with_tavily(url: &str, key: &str) -> Result<String, TavilyError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(TAVILY_TIMEOUT_SECS))
        .build()
        .map_err(|e| TavilyError::Failed(format!("Could not create the HTTP client: {}", e)))?;

    let response = client
        .post(TAVILY_EXTRACT_URL)
        .bearer_auth(key)
        .json(&tavily_request_body(url))
        .send()
        .await
        .map_err(|e| TavilyError::Failed(format!("Could not reach Tavily: {}", e)))?;

    if !response.status().is_success() {
        return Err(TavilyError::Failed(format!(
            "Tavily returned HTTP {}.",
            response.status()
        )));
    }
    if response
        .content_length()
        .is_some_and(|n| n > MAX_TAVILY_BODY_BYTES as u64)
    {
        return Err(TavilyError::TooLarge);
    }
    let mut body = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk
            .map_err(|e| TavilyError::Failed(format!("Could not read the Tavily response: {}", e)))?;
        if body.len() + chunk.len() > MAX_TAVILY_BODY_BYTES {
            return Err(TavilyError::TooLarge);
        }
        body.extend_from_slice(&chunk);
    }
    parse_tavily_extract(&body)
}

// Texto de results[0].raw_content; sem ele, o motivo vem de failed_results.
fn parse_tavily_extract(body: &[u8]) -> Result<String, TavilyError> {
    let unexpected = || TavilyError::Failed("Tavily sent an unexpected response.".to_string());
    let value: serde_json::Value = serde_json::from_slice(body).map_err(|_| unexpected())?;
    let results = value
        .get("results")
        .and_then(|r| r.as_array())
        .ok_or_else(unexpected)?;

    let text = results
        .first()
        .and_then(|r| r.get("raw_content"))
        .and_then(|c| c.as_str())
        .map(str::trim)
        .unwrap_or("");
    if text.len() > MAX_PAGE_BYTES {
        return Err(TavilyError::TooLarge);
    }
    if !text.is_empty() {
        return Ok(text.to_string());
    }

    let reason = value
        .get("failed_results")
        .and_then(|f| f.as_array())
        .and_then(|f| f.first())
        .and_then(|f| f.get("error"))
        .and_then(|e| e.as_str())
        .map(|e| e.trim().trim_end_matches('.'))
        .filter(|e| !e.is_empty());
    Err(TavilyError::Failed(match reason {
        Some(reason) => format!(
            "Tavily could not read the page ({}).",
            super::truncate_chars(reason, TAVILY_REASON_CHARS)
        ),
        None => "Tavily returned no text for this page.".to_string(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::{HeaderMap, HeaderValue};
    use reqwest::StatusCode;

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(*name, HeaderValue::from_static(value));
        }
        map
    }

    #[test]
    fn unauthorized_and_forbidden_are_blocked() {
        let none = HeaderMap::new();
        assert!(is_blocked(StatusCode::UNAUTHORIZED, &none));
        assert!(is_blocked(StatusCode::FORBIDDEN, &none));
    }

    #[test]
    fn cloudflare_challenge_header_is_blocked_on_any_status() {
        let challenge = headers(&[("cf-mitigated", "challenge"), ("server", "cloudflare")]);
        assert!(is_blocked(StatusCode::FORBIDDEN, &challenge));
        assert!(is_blocked(StatusCode::SERVICE_UNAVAILABLE, &challenge));
        assert!(is_blocked(StatusCode::OK, &challenge));
        // O nome do cabeçalho não depende da caixa.
        assert!(is_blocked(StatusCode::OK, &headers(&[("Cf-Mitigated", "challenge")])));
    }

    #[test]
    fn other_responses_are_not_blocked() {
        let none = HeaderMap::new();
        for status in [
            StatusCode::OK,
            StatusCode::NOT_FOUND,
            StatusCode::TOO_MANY_REQUESTS,
            StatusCode::INTERNAL_SERVER_ERROR,
            StatusCode::BAD_GATEWAY,
        ] {
            assert!(!is_blocked(status, &none), "{}", status);
        }
        // Só o servidor ser a Cloudflare não é bloqueio.
        assert!(!is_blocked(StatusCode::NOT_FOUND, &headers(&[("server", "cloudflare")])));
    }

    #[test]
    fn blocked_message_without_tavily_key_points_to_settings() {
        assert_eq!(
            blocked_message(),
            "This site blocked direct access because it requires a web browser. Open the page in your browser, copy the text and paste it in the Paste tab of Mincer. With a Tavily key in Settings (Web Search), Mincer tries to read the page through Tavily."
        );
    }

    #[test]
    fn tavily_failure_message_says_both_things_and_keeps_the_reason_as_detail() {
        let message = tavily_failure_message(&TavilyError::Failed("Tavily returned HTTP 432.".to_string()));
        assert_eq!(
            message,
            "This site blocked direct access because it requires a web browser, and reading it through Tavily failed too. Open the page in your browser, copy the text and paste it in the Paste tab of Mincer.\n\nTavily returned HTTP 432."
        );
        // A frase (antes da linha em branco) é a que o toast mostra.
        let sentence = message.split("\n\n").next().unwrap();
        assert!(sentence.contains("blocked direct access") && sentence.contains("Tavily failed too"));
        assert!(!sentence.contains("432"));
    }

    #[test]
    fn tavily_text_over_the_cap_reports_a_page_too_large() {
        assert_eq!(
            tavily_failure_message(&TavilyError::TooLarge),
            "The page is larger than 10 MB."
        );
    }

    #[test]
    fn tavily_request_carries_only_the_url() {
        let body = tavily_request_body("https://example.com/a?b=1");
        assert_eq!(
            body,
            serde_json::json!({ "urls": ["https://example.com/a?b=1"], "format": "markdown" })
        );
    }

    fn parse(json: &str) -> Result<String, String> {
        parse_tavily_extract(json.as_bytes()).map_err(|e| match e {
            TavilyError::TooLarge => "too large".to_string(),
            TavilyError::Failed(detail) => detail,
        })
    }

    #[test]
    fn parses_the_text_of_the_first_result() {
        let json = r##"{"results":[{"url":"https://example.com","raw_content":"  # Title\n\nBody text.  "}],"failed_results":[],"response_time":1.2}"##;
        assert_eq!(parse(json), Ok("# Title\n\nBody text.".to_string()));
    }

    #[test]
    fn empty_text_is_a_failure() {
        assert_eq!(
            parse(r#"{"results":[{"url":"https://example.com","raw_content":"  \n "}]}"#),
            Err("Tavily returned no text for this page.".to_string())
        );
        assert_eq!(
            parse(r#"{"results":[{"url":"https://example.com"}],"failed_results":[]}"#),
            Err("Tavily returned no text for this page.".to_string())
        );
        assert_eq!(
            parse(r#"{"results":[],"failed_results":[]}"#),
            Err("Tavily returned no text for this page.".to_string())
        );
    }

    #[test]
    fn failed_results_give_the_reason() {
        assert_eq!(
            parse(r#"{"results":[],"failed_results":[{"url":"https://example.com","error":"Failed to extract. "}]}"#),
            Err("Tavily could not read the page (Failed to extract).".to_string())
        );
        // Motivo vazio cai na frase genérica.
        assert_eq!(
            parse(r#"{"results":[],"failed_results":[{"url":"https://example.com","error":" "}]}"#),
            Err("Tavily returned no text for this page.".to_string())
        );
    }

    #[test]
    fn unexpected_shapes_are_failures() {
        let unexpected = Err("Tavily sent an unexpected response.".to_string());
        assert_eq!(parse("not json"), unexpected);
        assert_eq!(parse(r#"{"detail":{"error":"x"}}"#), unexpected);
        assert_eq!(parse(r#"{"results":"x"}"#), unexpected);
        assert_eq!(parse(r#"[]"#), unexpected);
    }

    #[test]
    fn text_over_the_page_cap_is_too_large() {
        let at_cap = serde_json::json!({ "results": [{ "raw_content": "a".repeat(MAX_PAGE_BYTES) }] });
        assert_eq!(parse(&at_cap.to_string()).map(|t| t.len()), Ok(MAX_PAGE_BYTES));
        let over = serde_json::json!({ "results": [{ "raw_content": "a".repeat(MAX_PAGE_BYTES + 1) }] });
        assert_eq!(parse(&over.to_string()), Err("too large".to_string()));
    }
}
