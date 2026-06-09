mod documents;
mod vec_db;

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_sql::{Migration, MigrationKind};

// Mostra e foca uma janela pelo label, restaurando-a caso esteja minimizada.
fn show_and_focus_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Alterna a janela assistant: esconde se ja estiver visivel e focada,
// caso contrario mostra e foca.
fn toggle_assistant_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("assistant") {
        let visible = window.is_visible().unwrap_or(false);
        let focused = window.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = window.hide();
        } else {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
            // Sinaliza a exibicao para a janela assistant criar uma conversa
            // nova e zerada. So emitido ao MOSTRAR (nunca ao esconder).
            let _ = app.emit_to("assistant", "assistant-shown", ());
        }
    }
}
use tokio::sync::oneshot;
use tokio::time::timeout;

const STREAM_CHUNK_TIMEOUT: Duration = Duration::from_secs(30);

struct RequestRegistry(Mutex<HashMap<String, oneshot::Sender<()>>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamChunkEvent {
    request_id: String,
    text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamReasoningEvent {
    request_id: String,
    text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamDoneEvent {
    request_id: String,
    model: String,
    completion_tokens: u64,
    duration_secs: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamErrorEvent {
    request_id: String,
    code: String,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamToolCallEvent {
    request_id: String,
    tool_name: String,
    arguments_json: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelInfo {
    id: String,
    name: String,
    description: Option<String>,
    supports_vision: bool,
    supports_tools: bool,
}

#[derive(Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModel>,
}

#[derive(Deserialize)]
struct OpenRouterModelArchitecture {
    input_modalities: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct OpenRouterModel {
    id: String,
    name: Option<String>,
    description: Option<String>,
    architecture: Option<OpenRouterModelArchitecture>,
    supported_parameters: Option<Vec<String>>,
}

fn key_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("config dir unavailable: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to ensure config dir: {}", e))?;
    Ok(dir.join(name))
}

pub(crate) fn read_key(app: &AppHandle, name: &str) -> Option<String> {
    let path = key_file(app, name).ok()?;
    let content = fs::read_to_string(&path).ok()?;
    let trimmed = content.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn save_key(app: &AppHandle, name: &str, key: String) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("empty key".into());
    }
    let path = key_file(app, name)?;
    fs::write(&path, trimmed).map_err(|e| format!("failed to save key: {}", e))?;
    Ok(())
}

fn clear_key(app: &AppHandle, name: &str) -> Result<(), String> {
    let path = key_file(app, name)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("failed to remove key: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn save_openrouter_key(app: AppHandle, key: String) -> Result<(), String> {
    save_key(&app, "openrouter_key", key)
}

#[tauri::command]
fn has_openrouter_key(app: AppHandle) -> Result<bool, String> {
    Ok(read_key(&app, "openrouter_key").is_some())
}

#[tauri::command]
fn clear_openrouter_key(app: AppHandle) -> Result<(), String> {
    clear_key(&app, "openrouter_key")
}

#[tauri::command]
fn save_tavily_key(app: AppHandle, key: String) -> Result<(), String> {
    save_key(&app, "tavily_key", key)
}

#[tauri::command]
fn has_tavily_key(app: AppHandle) -> Result<bool, String> {
    Ok(read_key(&app, "tavily_key").is_some())
}

#[tauri::command]
fn clear_tavily_key(app: AppHandle) -> Result<(), String> {
    clear_key(&app, "tavily_key")
}

#[tauri::command]
fn get_tavily_key(app: AppHandle) -> Result<Option<String>, String> {
    Ok(read_key(&app, "tavily_key"))
}

#[tauri::command]
async fn extract_pdf_text(bytes: Vec<u8>) -> Result<String, String> {
    let join = tokio::task::spawn_blocking(move || pdf_extract::extract_text_from_mem(&bytes)).await;
    let text = match join {
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
        Ok(Ok(t)) => t,
    };
    if text.trim().is_empty() {
        return Err("PDF has no extractable text (may be scanned)".into());
    }
    Ok(text)
}

#[tauri::command]
async fn save_chat_doc(app: AppHandle, filename: String, content: String) -> Result<String, String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let docs_dir = data_dir.join("chat-docs");
    std::fs::create_dir_all(&docs_dir).map_err(|e| e.to_string())?;
    let file_path = docs_dir.join(&filename);
    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn read_chat_doc(app: AppHandle, path: String) -> Result<String, String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let docs_dir = data_dir.join("chat-docs");
    let canonical_path = std::path::Path::new(&path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let canonical_docs = docs_dir
        .canonicalize()
        .unwrap_or_else(|_| docs_dir.clone());
    if !canonical_path.starts_with(&canonical_docs) {
        return Err("Access denied: path is outside chat-docs directory".into());
    }
    std::fs::read_to_string(&canonical_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_chat_doc(app: AppHandle, path: String) -> Result<(), String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let docs_dir = data_dir.join("chat-docs");
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Ok(());
    }
    let canonical_path = p.canonicalize().map_err(|e| e.to_string())?;
    let canonical_docs = docs_dir
        .canonicalize()
        .unwrap_or_else(|_| docs_dir.clone());
    if !canonical_path.starts_with(&canonical_docs) {
        return Err("Access denied: path is outside chat-docs directory".into());
    }
    std::fs::remove_file(&canonical_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn export_markdown(default_name: String, content: String) -> Result<bool, String> {
    let result = tokio::task::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_file_name(&default_name)
            .add_filter("Markdown", &["md"])
            .save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    match result {
        None => Ok(false),
        Some(path) => {
            std::fs::write(&path, content.as_bytes())
                .map_err(|e| format!("failed to save: {}", e))?;
            Ok(true)
        }
    }
}

fn is_valid_model_id(model: &str) -> bool {
    if model.is_empty() || model.len() > 200 {
        return false;
    }
    let mut parts = model.splitn(2, '/');
    let provider = match parts.next() {
        Some(p) if !p.is_empty() => p,
        _ => return false,
    };
    let name = match parts.next() {
        Some(n) if !n.is_empty() => n,
        _ => return false,
    };
    let valid_char =
        |c: char| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':');
    provider.chars().all(valid_char) && name.chars().all(valid_char)
}

#[tauri::command]
async fn openrouter_list_models(app: AppHandle) -> Result<Vec<ModelInfo>, String> {
    let key = read_key(&app, "openrouter_key").ok_or_else(|| "OPENROUTER_KEY_MISSING".to_string())?;
    let client = reqwest::Client::new();
    let resp = client
        .get("https://openrouter.ai/api/v1/models")
        .bearer_auth(&key)
        .header("HTTP-Referer", "https://monet.local")
        .header("X-Title", "Monet")
        .send()
        .await
        .map_err(|e| format!("network error: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        eprintln!("OpenRouter list_models {} body: {}", status, body);
        return Err(format!("OpenRouter responded {}", status));
    }

    let parsed: OpenRouterModelsResponse = resp
        .json()
        .await
        .map_err(|e| format!("invalid response: {}", e))?;

    let models = parsed
        .data
        .into_iter()
        .filter(|m| is_valid_model_id(&m.id))
        .map(|m| {
            let supports_vision = m
                .architecture
                .as_ref()
                .and_then(|a| a.input_modalities.as_ref())
                .map(|mods| mods.iter().any(|s| s == "image"))
                .unwrap_or(false);
            let supports_tools = m
                .supported_parameters
                .as_ref()
                .map(|params| params.iter().any(|s| s == "tools"))
                .unwrap_or(false);
            ModelInfo {
                name: m.name.clone().unwrap_or_else(|| m.id.clone()),
                id: m.id,
                description: m.description,
                supports_vision,
                supports_tools,
            }
        })
        .collect();
    Ok(models)
}

#[tauri::command]
async fn deep_research_generate_sub_queries(
    app: AppHandle,
    query: String,
    snippets_summary: String,
    model: String,
    current_date: String,
) -> Result<Vec<String>, String> {
    let key = read_key(&app, "openrouter_key")
        .ok_or_else(|| "OPENROUTER_KEY_MISSING".to_string())?;

    let year = current_date.get(..4).unwrap_or("2025");

    let prompt = format!(
        "Current date: {current_date}\n\nYou are a research query strategist. Given a user question and the titles of initial search results, generate 3 search queries that fill the most important gaps not yet covered.\n\nUser question: {query}\n\nInitial results already cover:\n{snippets_summary}\n\nRules:\n1. Write queries as a search engine would receive them: short noun phrases with canonical terms. No filler words, no pronouns, no question syntax.\n2. Each query must target a meaningfully different angle — no overlapping with existing results or with each other.\n3. If the topic involves a named study, paper, or report — even if not explicitly asked — dedicate at least one query to finding the primary source (include author, institution, year, or terms like \"arxiv\", \"pdf\", \"paper\", \"doi\", \"journal\").\n4. Use the current year ({year}) or \"latest\" as a temporal signal when recency matters.\n5. Language: use English for global/technical topics; use the question's language for region-specific topics (local news, government, culture).\n\nCommon gap dimensions to consider: primary sources, criticism/limitations, alternative viewpoints, technical details, real-world applications, comparisons, historical context, recent developments.\n\nReturn a JSON object with a \"queries\" field containing an array of 3 strings, nothing else."
    );

    let body = serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": prompt }],
        "max_tokens": 400,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "sub_queries",
                "strict": true,
                "schema": {
                    "type": "object",
                    "properties": {
                        "queries": { "type": "array", "items": { "type": "string" } }
                    },
                    "required": ["queries"],
                    "additionalProperties": false
                }
            }
        },
    });

    let client = reqwest::Client::new();
    let resp = match client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(&key)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://monet.local")
        .header("X-Title", "Monet")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Ok(vec![]),
    };

    if !resp.status().is_success() {
        return Ok(vec![]);
    }

    let data: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(_) => return Ok(vec![]),
    };

    let content = data
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    fn extract_strings(value: &serde_json::Value) -> Option<Vec<String>> {
        let arr = value
            .get("queries")
            .and_then(|q| q.as_array())
            .or_else(|| value.as_array())?;
        let strings: Vec<String> = arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .take(3)
            .collect();
        Some(strings)
    }

    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
        if let Some(strings) = extract_strings(&parsed) {
            return Ok(strings);
        }
    }

    if let (Some(start), Some(end)) = (content.find('['), content.rfind(']')) {
        if end > start {
            let slice = &content[start..=end];
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(slice) {
                if let Some(strings) = extract_strings(&parsed) {
                    return Ok(strings);
                }
            }
        }
    }

    Ok(vec![])
}

#[tauri::command]
async fn deep_research_rerank(
    app: AppHandle,
    query: String,
    documents: Vec<String>,
    model: String,
    top_n: usize,
) -> Result<Vec<usize>, String> {
    let key = read_key(&app, "openrouter_key")
        .ok_or_else(|| "OPENROUTER_KEY_MISSING".to_string())?;

    let body = serde_json::json!({
        "model": model,
        "query": query,
        "documents": documents,
        "top_n": top_n,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://openrouter.ai/api/v1/rerank")
        .bearer_auth(&key)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://monet.local")
        .header("X-Title", "Monet")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network error: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body_text = resp.text().await.unwrap_or_default();
        eprintln!("OpenRouter rerank {} body: {}", status, body_text);
        return Err(format!("OpenRouter responded {}", status));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("invalid response: {}", e))?;

    let results = data
        .get("results")
        .and_then(|r| r.as_array())
        .ok_or_else(|| "missing results".to_string())?;

    let indices: Vec<usize> = results
        .iter()
        .filter_map(|r| r.get("index").and_then(|i| i.as_u64()).map(|i| i as usize))
        .collect();

    Ok(indices)
}

#[tauri::command]
async fn web_search_route(
    app: AppHandle,
    history: Vec<serde_json::Value>,
    last_message: String,
    current_date: String,
) -> Result<serde_json::Value, String> {
    let key = read_key(&app, "openrouter_key")
        .ok_or_else(|| "OPENROUTER_KEY_MISSING".to_string())?;

    // Truncate fallback query to Tavily's ~400-char limit
    let fallback_query: String = last_message.chars().take(380).collect();
    let year = current_date.get(..4).unwrap_or("2025");

    let system_prompt = format!("Current date: {current_date}\n\nYou are a search routing assistant. Your job is to analyze the conversation and the latest user message to decide whether a web search is needed, and if so, to generate optimal search queries.\n\n---\n\n## STEP 1 — Decide if search is needed\n\nSet \"needsSearch\": true if ANY of the following apply:\n- The question involves current events, recent news, live prices, or real-time data\n- The question implies recency (\"latest\", \"current\", \"now\", \"today\", \"this year\", \"recently\", \"just released\")\n- The question is about a specific person, company, product, library, framework, model, or technology that may have changed or evolved since training\n- The question requires verifying a specific fact, statistic, or claim\n- The question asks for documentation, changelogs, release notes, or API specs\n- The user shares or pastes external content (article, post, tweet, summary) that references a study, report, paper, or research finding — the implicit need is to locate and verify the original primary source\n- The answer cannot be reliably derived from the conversation context alone\n\nSet \"needsSearch\": false ONLY if the question is:\n- About programming language fundamentals (loops, data structures, algorithms, design patterns that haven't changed in years)\n- Purely mathematical or logical reasoning\n- Creative writing or brainstorming with no factual dependency\n- Already fully answerable from the conversation history\n\nWhen uncertain, prefer true — an unnecessary search is cheaper than a wrong answer.\n\n---\n\n## STEP 2 — Classify search intent\n\nClassify the question into one of these categories. This classification determines both query strategy and query count.\n\n| Intent       | Description                                      | Queries |\n|--------------|--------------------------------------------------|---------|\n| FACTUAL      | A specific fact, stat, definition, or claim       | 1-2     |\n| TECHNICAL    | Docs, APIs, configs, libraries, changelogs        | 2       |\n| COMPARATIVE  | Comparing tools, approaches, or options           | 2-3     |\n| NEWS         | Recent events, announcements, releases            | 2-3     |\n| EXPLORATORY  | Broad research, open-ended investigation          | 3-4     |\n| SOURCE_TRACE | Content shared by user references a study or      | 2-3     |\n|              | paper — goal is finding the original source       |         |\n\n---\n\n## STEP 3 — Generate queries\n\nRules:\n1. Write queries as a search engine would receive them: short noun phrases with canonical terms. No filler words, no pronouns, no question syntax.\n2. Each query must target a meaningfully different angle — no overlapping result sets.\n3. If the topic involves a named study, paper, or report — whether the user asks about it directly OR shares content that references it — dedicate at least one query to finding the primary source. Extract identifying details from the content (university, author names, institution, journal, year, sample size, key finding) and use them as query terms. Combine with source signals like \"arxiv\", \"pdf\", \"paper\", \"doi\", \"journal\", \"pubmed\", or the institution name.\n4. If the conversation has an established topic context, inherit it into the queries instead of generating generic ones.\n5. For follow-up questions, incorporate the established topic but generate fresh queries — do not repeat previous searches.\n6. Use the current year ({year}) or \"latest\" as a temporal signal when recency matters.\n7. Language: use English for global/technical topics; use the user's language for region-specific topics (local news, government, culture).\n\n### Query rewriting examples\n\nBAD:  \"does DeepSeek V3 support function calling?\"\nGOOD: \"DeepSeek V3 function calling support\"\n\nBAD:  \"what is the latest version of Angular?\"\nGOOD: \"Angular latest version {year} release\"\n\nBAD:  \"how to fix memory leaks in Angular\"\nGOOD: \"Angular memory leak fix takeUntilDestroyed\"\n\nBAD:  \"who is the current CEO of OpenAI?\"\nGOOD: \"OpenAI CEO {year}\"\n\n### Source tracing examples\n\nUser shares a post saying \"MIT researchers found that LLM agents fail 43% of multi-step tasks\":\n→ \"MIT LLM agents multi-step task failure rate paper {year}\"\n→ \"LLM agent reliability benchmark study arxiv\"\n\nUser shares an article mentioning \"a Stanford study showed 80% of developers using Copilot introduced more security vulnerabilities\":\n→ \"Stanford Copilot security vulnerabilities developer study\"\n→ \"AI code assistant security risk research paper pdf\"\n→ \"GitHub Copilot code quality security academic study\"\n\n---\n\n## OUTPUT\n\nReturn only valid JSON, no markdown, no explanation, no preamble.\n\n{{\"needsSearch\": true, \"intent\": \"FACTUAL\", \"queries\": [\"query1\", \"query2\"]}}\n\nIf needsSearch is false, set intent to null and queries to [].");

    // Flatten history to text-only to avoid sending image base64 data to the routing model
    let history_slice = if history.len() > 10 {
        &history[history.len() - 10..]
    } else {
        &history[..]
    };

    fn extract_text_content(content: &serde_json::Value) -> String {
        match content {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Array(blocks) => blocks
                .iter()
                .filter_map(|b| {
                    if b.get("type").and_then(|t| t.as_str()) == Some("text") {
                        b.get("text").and_then(|t| t.as_str()).map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join(" "),
            _ => String::new(),
        }
    }

    let text_history: Vec<serde_json::Value> = history_slice
        .iter()
        .filter_map(|msg| {
            let role = msg.get("role")?.as_str()?;
            let content = msg.get("content")?;
            let text = extract_text_content(content);
            if text.is_empty() {
                return None;
            }
            Some(serde_json::json!({ "role": role, "content": text }))
        })
        .collect();

    let mut messages = vec![serde_json::json!({ "role": "system", "content": &system_prompt })];
    messages.extend(text_history);
    messages.push(serde_json::json!({ "role": "user", "content": &last_message }));

    let body = serde_json::json!({
        "model": "openai/gpt-4.1-mini",
        "messages": messages,
        "max_tokens": 350,
    });

    let client = reqwest::Client::new();
    let resp = match client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(&key)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://monet.local")
        .header("X-Title", "Monet")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Ok(serde_json::json!({ "needsSearch": true, "queries": [fallback_query] })),
    };

    if !resp.status().is_success() {
        return Ok(serde_json::json!({ "needsSearch": true, "queries": [fallback_query] }));
    }

    let data: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(_) => return Ok(serde_json::json!({ "needsSearch": true, "queries": [fallback_query] })),
    };

    let content = data
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    fn parse_route_json(s: &str) -> Option<serde_json::Value> {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(s) {
            return Some(v);
        }
        // Fallback: extract first {...} substring for cases where the model wraps in markdown
        if let (Some(start), Some(end)) = (s.find('{'), s.rfind('}')) {
            if end > start {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s[start..=end]) {
                    return Some(v);
                }
            }
        }
        None
    }

    if let Some(parsed) = parse_route_json(&content) {
        let needs_search = parsed
            .get("needsSearch")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        let queries: Vec<String> = parsed
            .get("queries")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.chars().take(380).collect::<String>())
                    .filter(|s| !s.is_empty())
                    .take(3)
                    .collect()
            })
            .unwrap_or_default();
        let queries = if queries.is_empty() { vec![fallback_query.clone()] } else { queries };
        return Ok(serde_json::json!({ "needsSearch": needs_search, "queries": queries }));
    }

    Ok(serde_json::json!({ "needsSearch": true, "queries": [fallback_query] }))
}

#[derive(Deserialize)]
struct ChatMessageInput {
    role: String,
    content: serde_json::Value,
}

fn spawn_openrouter_stream(
    app: AppHandle,
    registry: State<'_, RequestRegistry>,
    request_id: String,
    model: String,
    messages: serde_json::Value,
    thinking: bool,
    tools: Option<serde_json::Value>,
) -> Result<(), String> {
    if !is_valid_model_id(&model) {
        let _ = app.emit(
            "openrouter://error",
            StreamErrorEvent {
                request_id: request_id.clone(),
                code: "INVALID_MODEL".into(),
                message: "Invalid model identifier".into(),
            },
        );
        return Err("INVALID_MODEL".into());
    }

    let key = match read_key(&app, "openrouter_key") {
        Some(k) => k,
        None => {
            let _ = app.emit(
                "openrouter://error",
                StreamErrorEvent {
                    request_id: request_id.clone(),
                    code: "OPENROUTER_KEY_MISSING".into(),
                    message: "API key not configured".into(),
                },
            );
            return Err("OPENROUTER_KEY_MISSING".into());
        }
    };

    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    {
        let mut map = registry.0.lock().map_err(|e| e.to_string())?;
        map.insert(request_id.clone(), cancel_tx);
    }

    let app_clone = app.clone();
    let request_id_clone = request_id.clone();

    tauri::async_runtime::spawn(async move {
        let start = Instant::now();
        let result = run_openrouter_stream(
            &app_clone,
            &request_id_clone,
            &key,
            &model,
            messages,
            thinking,
            tools,
            cancel_rx,
        )
        .await;

        let registry: State<RequestRegistry> = app_clone.state();
        if let Ok(mut map) = registry.0.lock() {
            map.remove(&request_id_clone);
        }

        match result {
            Ok((completion_tokens,)) => {
                let duration_secs = start.elapsed().as_secs_f64();
                let _ = app_clone.emit(
                    "openrouter://done",
                    StreamDoneEvent {
                        request_id: request_id_clone,
                        model,
                        completion_tokens,
                        duration_secs,
                    },
                );
            }
            Err(StreamError::Cancelled) => {
                // nothing to emit: cancellation comes from the frontend
            }
            Err(StreamError::ToolCall) => {
                // nothing to emit: frontend handles tool execution via openrouter://tool_call event
            }
            Err(StreamError::Failed { code, message }) => {
                let _ = app_clone.emit(
                    "openrouter://error",
                    StreamErrorEvent {
                        request_id: request_id_clone,
                        code,
                        message,
                    },
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn openrouter_stream_chat(
    app: AppHandle,
    registry: State<'_, RequestRegistry>,
    request_id: String,
    model: String,
    system_prompt: String,
    user_message: String,
) -> Result<(), String> {
    let messages = serde_json::json!([
        { "role": "system", "content": system_prompt },
        { "role": "user", "content": user_message }
    ]);
    spawn_openrouter_stream(app, registry, request_id, model, messages, false, None)
}

#[tauri::command]
async fn openrouter_stream_messages(
    app: AppHandle,
    registry: State<'_, RequestRegistry>,
    request_id: String,
    model: String,
    messages: Vec<ChatMessageInput>,
    thinking: Option<bool>,
    tools: Option<serde_json::Value>,
) -> Result<(), String> {
    let messages_json: Vec<serde_json::Value> = messages
        .into_iter()
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();
    spawn_openrouter_stream(
        app,
        registry,
        request_id,
        model,
        serde_json::Value::Array(messages_json),
        thinking.unwrap_or(false),
        tools,
    )
}

#[tauri::command]
fn openrouter_cancel(
    registry: State<'_, RequestRegistry>,
    request_id: String,
) -> Result<(), String> {
    let mut map = registry.0.lock().map_err(|e| e.to_string())?;
    if let Some(tx) = map.remove(&request_id) {
        let _ = tx.send(());
    }
    Ok(())
}

enum StreamError {
    Cancelled,
    ToolCall,
    Failed { code: String, message: String },
}

async fn run_openrouter_stream(
    app: &AppHandle,
    request_id: &str,
    key: &str,
    model: &str,
    messages: serde_json::Value,
    thinking: bool,
    tools: Option<serde_json::Value>,
    mut cancel_rx: oneshot::Receiver<()>,
) -> Result<(u64,), StreamError> {
    let mut body = serde_json::json!({
        "model": model,
        "stream": true,
        "messages": messages,
    });
    if thinking {
        body["reasoning"] = serde_json::json!({ "max_tokens": 8000 });
    }
    if let Some(t) = tools {
        body["tools"] = t;
        body["tool_choice"] = serde_json::json!("auto");
    }

    let client = reqwest::Client::new();
    let resp = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(key)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://monet.local")
        .header("X-Title", "Monet")
        .json(&body)
        .send()
        .await
        .map_err(|e| StreamError::Failed {
            code: "NETWORK_ERROR".into(),
            message: format!("Could not connect to OpenRouter: {}", e),
        })?;

    let status = resp.status();
    if !status.is_success() {
        let body_text = resp.text().await.unwrap_or_default();
        eprintln!("OpenRouter stream {} body: {}", status, body_text);
        return Err(StreamError::Failed {
            code: "HTTP_ERROR".into(),
            message: format!("OpenRouter responded {}", status),
        });
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut completion_tokens: u64 = 0;
    let mut tool_call_name = String::new();
    let mut tool_call_args = String::new();

    loop {
        tokio::select! {
            _ = &mut cancel_rx => {
                return Err(StreamError::Cancelled);
            }
            next = timeout(STREAM_CHUNK_TIMEOUT, stream.next()) => {
                let bytes = match next {
                    Err(_) => {
                        return Err(StreamError::Failed {
                            code: "STREAM_TIMEOUT".into(),
                            message: "Timeout waiting for response".into(),
                        });
                    }
                    Ok(None) => break,
                    Ok(Some(Ok(b))) => b,
                    Ok(Some(Err(e))) => {
                        eprintln!("OpenRouter stream error: {}", e);
                        return Err(StreamError::Failed {
                            code: "STREAM_ERROR".into(),
                            message: "Connection interrupted".into(),
                        });
                    }
                };
                buffer.push_str(&String::from_utf8_lossy(&bytes));

                while let Some(pos) = buffer.find('\n') {
                    let raw_line = buffer[..pos].to_string();
                    buffer.drain(..=pos);
                    let line = raw_line.trim();
                    if line.is_empty() || line.starts_with(':') {
                        continue;
                    }
                    let data = match line.strip_prefix("data:") {
                        Some(d) => d.trim(),
                        None => continue,
                    };
                    if data == "[DONE]" {
                        return Ok((completion_tokens,));
                    }
                    let value: serde_json::Value = match serde_json::from_str(data) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    if let Some(err) = value.get("error") {
                        let message = err
                            .get("message")
                            .and_then(|m| m.as_str())
                            .unwrap_or("Unknown error")
                            .to_string();
                        return Err(StreamError::Failed {
                            code: "OPENROUTER_ERROR".into(),
                            message,
                        });
                    }
                    if let Some(ct) = value
                        .get("usage")
                        .and_then(|u| u.get("completion_tokens"))
                        .and_then(|v| v.as_u64())
                    {
                        completion_tokens = ct;
                    }
                    let delta = value
                        .get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("delta"));
                    if let Some(reasoning) = delta
                        .and_then(|d| d.get("reasoning").or_else(|| d.get("reasoning_content")))
                        .and_then(|r| r.as_str())
                    {
                        if !reasoning.is_empty() {
                            let _ = app.emit(
                                "openrouter://reasoning",
                                StreamReasoningEvent {
                                    request_id: request_id.to_string(),
                                    text: reasoning.to_string(),
                                },
                            );
                        }
                    }
                    if let Some(content) = delta
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        if !content.is_empty() {
                            let _ = app.emit(
                                "openrouter://chunk",
                                StreamChunkEvent {
                                    request_id: request_id.to_string(),
                                    text: content.to_string(),
                                },
                            );
                        }
                    }
                    let finish_reason = value
                        .get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("finish_reason"))
                        .and_then(|f| f.as_str());
                    if let Some(tool_call) = delta
                        .and_then(|d| d.get("tool_calls"))
                        .and_then(|tc| tc.get(0))
                    {
                        if let Some(name) = tool_call
                            .get("function")
                            .and_then(|f| f.get("name"))
                            .and_then(|n| n.as_str())
                        {
                            if !name.is_empty() {
                                tool_call_name = name.to_string();
                            }
                        }
                        if let Some(args_chunk) = tool_call
                            .get("function")
                            .and_then(|f| f.get("arguments"))
                            .and_then(|a| a.as_str())
                        {
                            tool_call_args.push_str(args_chunk);
                        }
                    }
                    if finish_reason == Some("tool_calls") && !tool_call_name.is_empty() {
                        let arguments_json = if tool_call_args.is_empty() {
                            "{}".to_string()
                        } else {
                            tool_call_args.clone()
                        };
                        let _ = app.emit(
                            "openrouter://tool_call",
                            StreamToolCallEvent {
                                request_id: request_id.to_string(),
                                tool_name: tool_call_name.clone(),
                                arguments_json,
                            },
                        );
                        return Err(StreamError::ToolCall);
                    }
                }
            }
        }
    }

    Ok((completion_tokens,))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
            CREATE TABLE IF NOT EXISTS notebooks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                notebook_id TEXT,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id);
            CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
            CREATE TABLE IF NOT EXISTS rag_chunks (
                id TEXT PRIMARY KEY,
                note_id TEXT,
                source_name TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding TEXT NOT NULL,
                chunk_index INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_rag_note ON rag_chunks(note_id);
            CREATE TABLE IF NOT EXISTS ai_responses (
                id TEXT PRIMARY KEY,
                note_id TEXT,
                command TEXT NOT NULL,
                query TEXT NOT NULL,
                response TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "ai_responses_model_status",
            sql: "
            ALTER TABLE ai_responses ADD COLUMN model TEXT NOT NULL DEFAULT '';
            ALTER TABLE ai_responses ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
            CREATE INDEX IF NOT EXISTS idx_ai_responses_note ON ai_responses(note_id);
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "ai_responses_command_id",
            sql: "
            ALTER TABLE ai_responses ADD COLUMN command_id TEXT;
            CREATE INDEX IF NOT EXISTS idx_ai_responses_cmd ON ai_responses(command_id);
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "documents_table",
            sql: "
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                notebook_id TEXT NOT NULL,
                name TEXT NOT NULL,
                original_path TEXT NOT NULL,
                mime TEXT NOT NULL,
                size INTEGER NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_documents_notebook ON documents(notebook_id);
            DROP TABLE IF EXISTS rag_chunks;
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "ai_responses_sources",
            sql: "ALTER TABLE ai_responses ADD COLUMN sources TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "documents_global_knowledge_base",
            // Base de Conhecimento global: remove vinculo notebook_id da tabela
            // documents e cria tabela de visibilidade por caderno. Dados antigos
            // sao descartados (sem usuarios reais).
            sql: "
            DELETE FROM documents;
            CREATE TABLE IF NOT EXISTS notebook_document_visibility (
                notebook_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                PRIMARY KEY (notebook_id, document_id),
                FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            );
            CREATE TABLE documents_new (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                original_path TEXT NOT NULL,
                mime TEXT NOT NULL,
                size INTEGER NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            INSERT INTO documents_new SELECT id, name, original_path, mime, size, status, error_message, created_at, updated_at FROM documents;
            DROP TABLE documents;
            ALTER TABLE documents_new RENAME TO documents;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "move_visibility_table_to_docdb",
            sql: "DROP TABLE IF EXISTS notebook_document_visibility;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "notes_date_field",
            sql: "ALTER TABLE notes ADD COLUMN date TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "subjects_table_and_note_subject_id",
            sql: "
                CREATE TABLE IF NOT EXISTS subjects (
                    id TEXT PRIMARY KEY,
                    notebook_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_subjects_notebook ON subjects(notebook_id);
                ALTER TABLE notes ADD COLUMN subject_id TEXT;
                CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes(subject_id);
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "watched_folders_support",
            sql: "
                ALTER TABLE documents ADD COLUMN type TEXT NOT NULL DEFAULT 'file';
                ALTER TABLE documents ADD COLUMN parent_folder_id TEXT;
                ALTER TABLE documents ADD COLUMN last_modified_ms INTEGER;
                ALTER TABLE documents ADD COLUMN is_external INTEGER NOT NULL DEFAULT 0;
                CREATE INDEX IF NOT EXISTS idx_documents_type_folder ON documents(type, parent_folder_id);
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .manage(RequestRegistry(Mutex::new(HashMap::new())))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }

            // ─── System tray ───────────────────────────────────────────────
            let open_item = MenuItemBuilder::with_id("open", "Open").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let tray_menu = MenuBuilder::new(app).items(&[&open_item, &quit_item]).build()?;
            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Monet")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show_and_focus_window(app, "main"),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_and_focus_window(tray.app_handle(), "main");
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            tray_builder.build(app)?;

            // ─── X sempre esconde a main na bandeja (nunca encerra) ────────
            if let Some(main_window) = app.get_webview_window("main") {
                let win = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            let vec_db = vec_db::init(&app.handle())
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(vec_db);
            app.manage(documents::DocDb::new());

            let cleanup_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                documents::cleanup_stuck_indexing(cleanup_handle).await;
            });

            let scan_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                documents::scan_all_watched_folders_on_startup(scan_handle).await;
            });

            // ─── Atalho global Ctrl+M → toggle da janela assistant ─────────
            // Falha de registro (ex.: atalho ja em uso) nao deve crashar o startup.
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
                let ctrl_m = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyM);
                if let Err(err) = app.global_shortcut().register(ctrl_m) {
                    eprintln!("failed to register Ctrl+M global shortcut: {err}");
                }
            }

            Ok(())
        })
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
                    let ctrl_m = tauri_plugin_global_shortcut::Shortcut::new(
                        Some(Modifiers::CONTROL),
                        Code::KeyM,
                    );
                    if shortcut == &ctrl_m && event.state() == ShortcutState::Pressed {
                        toggle_assistant_window(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:monet.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            save_openrouter_key,
            has_openrouter_key,
            clear_openrouter_key,
            save_tavily_key,
            has_tavily_key,
            clear_tavily_key,
            get_tavily_key,
            openrouter_list_models,
            openrouter_stream_chat,
            openrouter_stream_messages,
            openrouter_cancel,
            deep_research_generate_sub_queries,
            deep_research_rerank,
            web_search_route,
            extract_pdf_text,
            save_chat_doc,
            read_chat_doc,
            delete_chat_doc,
            export_markdown,
            vec_db::vec_db_smoke_test,
            documents::documents_upload_global,
            documents::documents_reindex,
            documents::documents_delete,
            documents::documents_list_global,
            documents::documents_set_notebook_visibility,
            documents::documents_get_notebook_visible_ids,
            documents::documents_get_notebooks_with_visible_docs,
            documents::documents_search_by_ids,
            documents::documents_pick_file,
            documents::documents_pick_folder,
            documents::documents_add_watched_folder,
            documents::documents_scan_watched_folder,
            documents::documents_delete_watched_folder,
            documents::embed_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
