// Resumo numa chamada, sem streaming (porte do summarize.rs do VOLP).
use super::sidecar::{JobCtx, JobError};
use super::transcribe::http_client;
use super::{api_error, network_error};

pub(crate) async fn summarize(
    ctx: &JobCtx,
    key: &str,
    model: &str,
    system_prompt: &str,
    text: &str,
) -> Result<String, JobError> {
    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": text }
        ]
    });

    let request = async {
        let response = http_client()
            .post("https://openrouter.ai/api/v1/chat/completions")
            .bearer_auth(key)
            .header("HTTP-Referer", "https://monet.local")
            .header("X-Title", "Monet")
            .json(&body)
            .send()
            .await
            .map_err(|e| network_error(&e))?;

        if !response.status().is_success() {
            let status = response.status();
            let err_body = response.text().await.unwrap_or_default();
            return Err(api_error(status, &err_body, model));
        }

        #[derive(serde::Deserialize)]
        struct Message {
            content: Option<String>,
        }
        #[derive(serde::Deserialize)]
        struct Choice {
            message: Message,
        }
        #[derive(serde::Deserialize)]
        struct ChatResponse {
            choices: Vec<Choice>,
        }

        let parsed: ChatResponse = response
            .json()
            .await
            .map_err(|e| format!("Invalid summary response: {}", e))?;
        parsed
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| {
                "The model returned no content. Try again or choose another summary model in Settings."
                    .to_string()
            })
    };

    tokio::select! {
        r = request => r.map_err(JobError::Failed),
        _ = ctx.cancelled() => Err(JobError::Cancelled),
    }
}
