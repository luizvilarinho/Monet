use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

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
struct StreamDoneEvent {
    request_id: String,
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
}

#[derive(Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModel>,
}

#[derive(Deserialize)]
struct OpenRouterModel {
    id: String,
    name: Option<String>,
    description: Option<String>,
}

fn key_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("config dir unavailable: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to ensure config dir: {}", e))?;
    Ok(dir.join(name))
}

fn read_key(app: &AppHandle, name: &str) -> Option<String> {
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
        return Err("chave vazia".into());
    }
    let path = key_file(app, name)?;
    fs::write(&path, trimmed).map_err(|e| format!("falha ao salvar chave: {}", e))?;
    Ok(())
}

fn clear_key(app: &AppHandle, name: &str) -> Result<(), String> {
    let path = key_file(app, name)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("falha ao remover chave: {}", e))?;
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
        .map_err(|e| format!("falha de rede: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        eprintln!("OpenRouter list_models {} body: {}", status, body);
        return Err(format!("OpenRouter respondeu {}", status));
    }

    let parsed: OpenRouterModelsResponse = resp
        .json()
        .await
        .map_err(|e| format!("resposta invalida: {}", e))?;

    let models = parsed
        .data
        .into_iter()
        .filter(|m| is_valid_model_id(&m.id))
        .map(|m| ModelInfo {
            name: m.name.clone().unwrap_or_else(|| m.id.clone()),
            id: m.id,
            description: m.description,
        })
        .collect();
    Ok(models)
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
    if !is_valid_model_id(&model) {
        let _ = app.emit(
            "openrouter://error",
            StreamErrorEvent {
                request_id: request_id.clone(),
                code: "INVALID_MODEL".into(),
                message: "Identificador de modelo inválido".into(),
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
                    message: "Chave de API nao configurada".into(),
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
        let result = run_openrouter_stream(
            &app_clone,
            &request_id_clone,
            &key,
            &model,
            &system_prompt,
            &user_message,
            cancel_rx,
        )
        .await;

        let registry: State<RequestRegistry> = app_clone.state();
        if let Ok(mut map) = registry.0.lock() {
            map.remove(&request_id_clone);
        }

        match result {
            Ok(()) => {
                let _ = app_clone.emit(
                    "openrouter://done",
                    StreamDoneEvent {
                        request_id: request_id_clone,
                    },
                );
            }
            Err(StreamError::Cancelled) => {
                // nada a emitir: cancelamento vem do frontend
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
    system_prompt: &str,
    user_message: &str,
    mut cancel_rx: oneshot::Receiver<()>,
) -> Result<(), StreamError> {
    let body = serde_json::json!({
        "model": model,
        "stream": true,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_message }
        ]
    });

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
            message: format!("Nao foi possivel conectar a OpenRouter: {}", e),
        })?;

    let status = resp.status();
    if !status.is_success() {
        let body_text = resp.text().await.unwrap_or_default();
        eprintln!("OpenRouter stream {} body: {}", status, body_text);
        return Err(StreamError::Failed {
            code: "HTTP_ERROR".into(),
            message: format!("OpenRouter respondeu {}", status),
        });
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

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
                            message: "Tempo limite excedido aguardando resposta".into(),
                        });
                    }
                    Ok(None) => break,
                    Ok(Some(Ok(b))) => b,
                    Ok(Some(Err(e))) => {
                        eprintln!("OpenRouter stream error: {}", e);
                        return Err(StreamError::Failed {
                            code: "STREAM_ERROR".into(),
                            message: "Conexão interrompida".into(),
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
                        return Ok(());
                    }
                    let value: serde_json::Value = match serde_json::from_str(data) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    if let Some(err) = value.get("error") {
                        let message = err
                            .get("message")
                            .and_then(|m| m.as_str())
                            .unwrap_or("Erro desconhecido")
                            .to_string();
                        return Err(StreamError::Failed {
                            code: "OPENROUTER_ERROR".into(),
                            message,
                        });
                    }
                    if let Some(content) = value
                        .get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("delta"))
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

    Ok(())
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
    ];

    tauri::Builder::default()
        .manage(RequestRegistry(Mutex::new(HashMap::new())))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            Ok(())
        })
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
            openrouter_cancel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
