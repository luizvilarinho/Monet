// Pasta de documentação .md escolhida pelo usuário no Library (modo "Docs").
// Diferente de books.rs, a raiz do sandbox não é uma pasta do app: é a pasta
// selecionada no diálogo, revalidada em cada comando (canonicalize +
// starts_with + rejeição de `..` — nunca confiar em path vindo do frontend).
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use notify::event::{EventKind, ModifyKind};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

// Tetos da varredura recursiva: pastas gigantes não podem travar o Library.
// Ao atingir um teto a varredura para silenciosamente.
const MAX_DEPTH: usize = 10;
const MAX_MD_FILES: usize = 5000;

const DOCS_CHANGED_EVENT: &str = "docs://changed";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocsTreeNode {
    name: String,
    rel_path: String,
    is_dir: bool,
    children: Vec<DocsTreeNode>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocsChangedEvent {
    root: String,
}

fn canonical_root(root: &str) -> Result<PathBuf, String> {
    let p = Path::new(root)
        .canonicalize()
        .map_err(|_| "Documentation folder not found or not readable".to_string())?;
    if !p.is_dir() {
        return Err("Documentation folder not found or not readable".into());
    }
    Ok(p)
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
}

// Ocultos (.git, .github…) e node_modules ficam fora da árvore e do watcher:
// numa pasta de repositório eles só trariam ruído (READMEs de dependências,
// eventos de git status).
fn is_skipped_name(name: &str) -> bool {
    name.starts_with('.') || name == "node_modules"
}

// Varredura tolerante a erro (modelo: collect_files_recursive em documents.rs):
// entradas ilegíveis são logadas e puladas; symlinks e nomes de
// is_skipped_name ignorados.
// Retorna os filhos ordenados (pastas antes de arquivos, ordem alfabética
// case-insensitive); pastas sem nenhum .md descendente são omitidas.
fn scan_dir(dir: &Path, rel: &str, depth: usize, md_count: &mut usize) -> Vec<DocsTreeNode> {
    if depth > MAX_DEPTH || *md_count >= MAX_MD_FILES {
        return Vec::new();
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("docs_tree: cannot read dir {:?}: {}", dir, e);
            return Vec::new();
        }
    };
    let mut dirs: Vec<DocsTreeNode> = Vec::new();
    let mut files: Vec<DocsTreeNode> = Vec::new();
    for entry in entries {
        if *md_count >= MAX_MD_FILES {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("docs_tree: entry error: {}", e);
                continue;
            }
        };
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("docs_tree: cannot stat {:?}: {}", path, e);
                continue;
            }
        };
        let name = entry.file_name().to_string_lossy().to_string();
        if file_type.is_symlink() || is_skipped_name(&name) {
            continue;
        }
        let child_rel = if rel.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", rel, name)
        };
        if file_type.is_dir() {
            let children = scan_dir(&path, &child_rel, depth + 1, md_count);
            if children.is_empty() {
                continue;
            }
            dirs.push(DocsTreeNode {
                name,
                rel_path: child_rel,
                is_dir: true,
                children,
            });
        } else if file_type.is_file() && is_markdown(&path) {
            *md_count += 1;
            files.push(DocsTreeNode {
                name,
                rel_path: child_rel,
                is_dir: false,
                children: Vec::new(),
            });
        }
    }
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    dirs.extend(files);
    dirs
}

#[tauri::command]
pub async fn docs_tree(root: String) -> Result<DocsTreeNode, String> {
    let root_canon = canonical_root(&root)?;
    let name = root_canon
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Documentation")
        .to_string();
    let mut md_count = 0usize;
    let children = scan_dir(&root_canon, "", 1, &mut md_count);
    Ok(DocsTreeNode {
        name,
        rel_path: String::new(),
        is_dir: true,
        children,
    })
}

#[tauri::command]
pub async fn docs_read_file(root: String, rel_path: String) -> Result<String, String> {
    let root_canon = canonical_root(&root)?;
    let rel = Path::new(&rel_path);
    if rel
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err("Access denied: path is outside docs folder".into());
    }
    let p = root_canon.join(rel);
    if !is_markdown(&p) {
        return Err("Only Markdown (.md) files can be opened".into());
    }
    let canonical_path = p.canonicalize().map_err(|_| "Document not found".to_string())?;
    if !canonical_path.starts_with(&root_canon) {
        return Err("Access denied: path is outside docs folder".into());
    }
    if !canonical_path.is_file() {
        return Err("Document not found".into());
    }
    let bytes = fs::read(&canonical_path).map_err(|e| e.to_string())?;
    // from_utf8_lossy degrada com elegância encodings não UTF-8; o BOM, quando
    // presente, viraria um caractere invisível no topo do documento renderizado.
    let text = String::from_utf8_lossy(&bytes).into_owned();
    Ok(text.strip_prefix('\u{FEFF}').unwrap_or(&text).to_string())
}

// Emite quando algo muda num .md, ou em criação/remoção/renomeação (cobre
// pastas, cujo path não tem extensão .md). Leituras (Access) e caminhos dentro
// de pastas ignoradas pela árvore não contam — sem isso cada `git status` num
// repositório dispararia um re-scan. O debounce fica no frontend.
fn is_relevant_event(root: &Path, event: &notify::Event) -> bool {
    if matches!(event.kind, EventKind::Access(_)) {
        return false;
    }
    let structural = matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(ModifyKind::Name(_))
    );
    event.paths.iter().any(|p| {
        let visible = match p.strip_prefix(root) {
            Ok(rel) => !rel
                .components()
                .any(|c| c.as_os_str().to_str().map(is_skipped_name).unwrap_or(false)),
            Err(_) => true,
        };
        visible && (structural || is_markdown(p))
    })
}

// Um watcher por DocsReader montado, identificado pelo id devolvido no start.
// O stop remove só o próprio watcher: no StrictMode (montar → desmontar →
// montar) o stop da primeira montagem pode chegar depois do segundo start, e
// com um watcher global ele derrubaria o watcher novo.
static WATCHERS: Mutex<Vec<(u64, RecommendedWatcher)>> = Mutex::new(Vec::new());
static NEXT_WATCH_ID: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
pub async fn docs_watch_start(app: AppHandle, root: String) -> Result<u64, String> {
    let root_canon = canonical_root(&root)?;
    let root_label = root.clone();
    let event_root = root_canon.clone();
    let emit = move || {
        let _ = app.emit(
            DOCS_CHANGED_EVENT,
            DocsChangedEvent {
                root: root_label.clone(),
            },
        );
    };
    let mut watcher =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            match res {
                Ok(event) => {
                    if is_relevant_event(&event_root, &event) {
                        emit();
                    }
                }
                Err(e) => {
                    // Raiz removida/renomeada: o re-scan do frontend falha e cai
                    // no estado de erro de pasta — por isso emite mesmo assim.
                    eprintln!("docs watcher error: {}", e);
                    emit();
                }
            }
        })
        .map_err(|e| e.to_string())?;
    watcher
        .watch(&root_canon, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    let id = NEXT_WATCH_ID.fetch_add(1, Ordering::Relaxed);
    WATCHERS.lock().map_err(|e| e.to_string())?.push((id, watcher));
    Ok(id)
}

#[tauri::command]
pub async fn docs_watch_stop(watch_id: u64) -> Result<(), String> {
    let removed = {
        let mut guard = WATCHERS.lock().map_err(|e| e.to_string())?;
        guard
            .iter()
            .position(|(id, _)| *id == watch_id)
            .map(|i| guard.remove(i))
    };
    // Drop fora do lock: encerrar o watcher pode esperar a thread do notify.
    drop(removed);
    Ok(())
}
