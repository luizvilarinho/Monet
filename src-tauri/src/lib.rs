mod documents;
mod vec_db;

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_sql::{Migration, MigrationKind};
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelInfo {
    id: String,
    name: String,
    description: Option<String>,
    supports_vision: bool,
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
fn get_openrouter_key(app: AppHandle) -> Result<Option<String>, String> {
    Ok(read_key(&app, "openrouter_key"))
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
            ModelInfo {
                name: m.name.clone().unwrap_or_else(|| m.id.clone()),
                id: m.id,
                description: m.description,
                supports_vision,
            }
        })
        .collect();
    Ok(models)
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
    spawn_openrouter_stream(app, registry, request_id, model, messages, false)
}

#[tauri::command]
async fn openrouter_stream_messages(
    app: AppHandle,
    registry: State<'_, RequestRegistry>,
    request_id: String,
    model: String,
    messages: Vec<ChatMessageInput>,
    thinking: Option<bool>,
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
    Failed { code: String, message: String },
}

async fn run_openrouter_stream(
    app: &AppHandle,
    request_id: &str,
    key: &str,
    model: &str,
    messages: serde_json::Value,
    thinking: bool,
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
    ];

    tauri::Builder::default()
        .manage(RequestRegistry(Mutex::new(HashMap::new())))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            let vec_db = vec_db::init(&app.handle())
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(vec_db);
            app.manage(documents::DocDb::new());

            let cleanup_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                documents::cleanup_stuck_indexing(cleanup_handle).await;
            });

            Ok(())
        })
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
            get_openrouter_key,
            clear_openrouter_key,
            save_tavily_key,
            has_tavily_key,
            clear_tavily_key,
            get_tavily_key,
            openrouter_list_models,
            openrouter_stream_chat,
            openrouter_stream_messages,
            openrouter_cancel,
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
            documents::embed_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
