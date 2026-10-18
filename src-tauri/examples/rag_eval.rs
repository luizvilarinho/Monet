// Golden set do RAG: roda perguntas reais contra a mesma busca do app e mede
// recall@k, hit@k e MRR por classe. Só lê o perfil DEV (`com.monet.app.dev`),
// com os bancos abertos somente leitura. Perguntas, gabarito e resultados ficam
// em %APPDATA%\com.monet.app.dev\rag-eval\, fora do repositório.
//
// Uso (de src-tauri/):
//   cargo run --example rag_eval -- init
//   cargo run --example rag_eval -- candidates
//   cargo run --example rag_eval -- run --label baseline --pipeline baseline
//   cargo run --example rag_eval -- run --label hybrid --pipeline hybrid
//   cargo run --example rag_eval -- run --pipeline full [--no-rewrite] [--no-fts] [--no-rerank] [--threshold 0.2]
//
// Pipelines: `baseline` = KNN top-5 da pergunta (chat atual); `hybrid` = KNN +
// FTS5 fundidos por RRF (rag::hybrid_search), termos FTS tirados da pergunta;
// `full` = rag::retrieve (reescrita + híbrida + rerank + pesos), o mesmo do
// comando rag_retrieve. As flags desligam etapas do `full` (ablação); o label
// padrão inclui as flags. `hybrid` e `full` leem a tabela chunks_fts,
// preenchida pelo app dev ao iniciar. Uma pergunta pode fixar `currentDate`
// (YYYY-MM-DD) para "hoje"/"ontem"; sem ele, vale a data local de hoje.
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use monet_lib::rag;
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::json;

const DEV_PROFILE: &str = "com.monet.app.dev";
const CLASSES: [&str; 6] = ["follow-up", "exact-term", "document", "temporal", "sweep", "image"];
const CANDIDATES_POOL: usize = 40;
const CANDIDATES_SHOWN: usize = 15;
const CANDIDATE_QUERY_MAX_CHARS: usize = 6000;
const SNIPPET_CHARS: usize = 200;

#[derive(Serialize, Deserialize)]
struct GoldenSet {
    version: u32,
    k: usize,
    questions: Vec<Question>,
}

#[derive(Serialize, Deserialize)]
struct Question {
    id: String,
    class: String,
    question: String,
    #[serde(default)]
    history: Vec<Turn>,
    #[serde(default)]
    scope: Scope,
    #[serde(default)]
    expected: Vec<Expected>,
    #[serde(default)]
    confirmed: bool,
    #[serde(default)]
    comment: String,
    #[serde(default, rename = "currentDate", skip_serializing_if = "Option::is_none")]
    current_date: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct Turn {
    role: String,
    content: String,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Scope {
    #[serde(default)]
    ids: Vec<String>,
    #[serde(default)]
    notebook_id: Option<String>,
    #[serde(default)]
    include_ai_folders: bool,
    #[serde(default)]
    exclude_note_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Expected {
    document_id: String,
    #[serde(default)]
    label: String,
}

struct DevPaths {
    doc_db: PathBuf,
    vec_db: PathBuf,
    key: PathBuf,
    eval_dir: PathBuf,
    goldenset: PathBuf,
    candidates: PathBuf,
    results_dir: PathBuf,
}

fn ensure_dev(p: &Path) -> Result<(), String> {
    if !p.to_string_lossy().contains(DEV_PROFILE) {
        return Err(format!(
            "refusing to touch a path outside the dev profile: {}",
            p.display()
        ));
    }
    Ok(())
}

impl DevPaths {
    fn resolve() -> Result<Self, String> {
        let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA is not set".to_string())?;
        let dir = PathBuf::from(appdata).join(DEV_PROFILE);
        if dir.file_name().and_then(|n| n.to_str()) != Some(DEV_PROFILE) {
            return Err(format!("unexpected dev profile path: {}", dir.display()));
        }
        let eval_dir = dir.join("rag-eval");
        let paths = DevPaths {
            doc_db: dir.join("monet.db"),
            vec_db: dir.join("monet-vec.db"),
            key: dir.join("openrouter_key"),
            goldenset: eval_dir.join("goldenset.json"),
            candidates: eval_dir.join("candidates.md"),
            results_dir: eval_dir.join("results"),
            eval_dir,
        };
        for p in [
            &dir,
            &paths.doc_db,
            &paths.vec_db,
            &paths.key,
            &paths.eval_dir,
            &paths.goldenset,
            &paths.candidates,
            &paths.results_dir,
        ] {
            ensure_dev(p)?;
        }
        Ok(paths)
    }

    fn open_doc_db(&self) -> Result<Connection, String> {
        ensure_dev(&self.doc_db)?;
        let conn = Connection::open_with_flags(&self.doc_db, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("failed to open {} read-only: {}", self.doc_db.display(), e))?;
        conn.busy_timeout(Duration::from_secs(5))
            .map_err(|e| format!("failed to set busy_timeout: {}", e))?;
        Ok(conn)
    }

    fn open_vec_db(&self) -> Result<Connection, String> {
        ensure_dev(&self.vec_db)?;
        let conn = rag::open_vec_db_readonly(&self.vec_db)?;
        conn.busy_timeout(Duration::from_secs(5))
            .map_err(|e| format!("failed to set busy_timeout: {}", e))?;
        Ok(conn)
    }

    fn read_key(&self) -> Result<String, String> {
        ensure_dev(&self.key)?;
        let key = fs::read_to_string(&self.key)
            .map_err(|_| format!("OpenRouter key not found at {}", self.key.display()))?;
        let key = key.trim().to_string();
        if key.is_empty() {
            return Err(format!("OpenRouter key is empty at {}", self.key.display()));
        }
        Ok(key)
    }

    fn write(&self, path: &Path, content: &str) -> Result<(), String> {
        ensure_dev(path)?;
        if let Some(parent) = path.parent() {
            ensure_dev(parent)?;
            fs::create_dir_all(parent)
                .map_err(|e| format!("failed to create {}: {}", parent.display(), e))?;
        }
        fs::write(path, content).map_err(|e| format!("failed to write {}: {}", path.display(), e))
    }

    fn load_goldenset(&self) -> Result<GoldenSet, String> {
        let raw = fs::read_to_string(&self.goldenset).map_err(|_| {
            format!(
                "{} not found. Run `cargo run --example rag_eval -- init` first.",
                self.goldenset.display()
            )
        })?;
        let gs: GoldenSet = serde_json::from_str(&raw)
            .map_err(|e| format!("invalid {}: {}", self.goldenset.display(), e))?;
        if gs.k == 0 {
            return Err("goldenset.json: k must be >= 1".into());
        }
        let mut ids = HashSet::new();
        for q in &gs.questions {
            if !CLASSES.contains(&q.class.as_str()) {
                return Err(format!(
                    "question {}: class '{}' is not one of {}",
                    q.id,
                    q.class,
                    CLASSES.join(" | ")
                ));
            }
            if !ids.insert(q.id.as_str()) {
                return Err(format!("duplicate question id: {}", q.id));
            }
            if q.class == "follow-up" && q.history.is_empty() {
                eprintln!("warning: question {} is follow-up but has no history", q.id);
            }
        }
        Ok(gs)
    }
}

// Timestamp YYYYMMDDHHmmss em UTC (sem dependência de crate de datas).
fn utc_timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    // civil_from_days (H. Hinnant)
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!(
        "{:04}{:02}{:02}{:02}{:02}{:02}",
        y,
        m,
        d,
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

fn scope_ids(doc_conn: &Connection, q: &Question) -> Result<Vec<String>, String> {
    rag::resolve_scope(
        doc_conn,
        &q.scope.ids,
        q.scope.notebook_id.as_deref(),
        q.scope.exclude_note_id.as_deref(),
        q.scope.include_ai_folders,
    )
}

// Ids de documento na ordem da 1ª ocorrência, sem duplicatas.
fn ranked_documents<'a>(document_ids: impl Iterator<Item = &'a str>) -> Vec<String> {
    let mut seen = HashSet::new();
    document_ids
        .filter(|id| seen.insert(*id))
        .map(String::from)
        .collect()
}

// O `hybrid` depende do chunks_fts que o app grava (o eval só lê o banco).
fn check_fts(vec_conn: &Connection) -> Result<(), String> {
    let exists: i64 = vec_conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE name = 'chunks_fts'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| format!("failed to inspect the vec db: {}", e))?;
    if exists == 0 {
        return Err(
            "chunks_fts not found in the dev vec db: start the dev app once (its startup fills the text index)"
                .into(),
        );
    }
    let (fts, meta): (i64, i64) = vec_conn
        .query_row(
            "SELECT (SELECT COUNT(*) FROM chunks_fts), (SELECT COUNT(*) FROM chunks_meta)",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| format!("failed to count chunks_fts: {}", e))?;
    if fts != meta {
        eprintln!(
            "warning: chunks_fts has {} rows and chunks_meta {}; restart the dev app to resync",
            fts, meta
        );
    }
    Ok(())
}

fn init(paths: &DevPaths) -> Result<(), String> {
    if paths.goldenset.exists() {
        println!(
            "{} already exists; not overwriting.",
            paths.goldenset.display()
        );
        return Ok(());
    }
    let template = GoldenSet {
        version: 1,
        k: 5,
        questions: vec![
            Question {
                id: "q01".into(),
                class: "document".into(),
                question: "qual é a especificação do Projeto Exemplo?".into(),
                history: vec![],
                scope: Scope {
                    ids: vec!["<id de pasta ou arquivo da KB>".into()],
                    notebook_id: None,
                    include_ai_folders: false,
                    exclude_note_id: None,
                },
                expected: vec![Expected {
                    document_id: "note:<noteId>".into(),
                    label: "Especificação (Notes — Projeto Exemplo)".into(),
                }],
                confirmed: true,
                comment: "Fictitious example; replace with real questions.".into(),
                current_date: None,
            },
            Question {
                id: "q02".into(),
                class: "follow-up".into(),
                question: "e na versão 2?".into(),
                history: vec![
                    Turn {
                        role: "user".into(),
                        content: "quais são os requisitos do Projeto Exemplo?".into(),
                    },
                    Turn {
                        role: "assistant".into(),
                        content: "Os requisitos da versão 1 são A e B.".into(),
                    },
                ],
                scope: Scope {
                    ids: vec![],
                    notebook_id: Some("<notebookId>".into()),
                    include_ai_folders: false,
                    exclude_note_id: None,
                },
                expected: vec![],
                confirmed: false,
                comment: "Fictitious example; replace with real questions.".into(),
                current_date: None,
            },
        ],
    };
    let body = serde_json::to_string_pretty(&template).map_err(|e| e.to_string())?;
    paths.write(&paths.goldenset, &body)?;
    println!("Created {}", paths.goldenset.display());
    Ok(())
}

fn candidates(paths: &DevPaths) -> Result<(), String> {
    let gs = paths.load_goldenset()?;
    let doc_conn = paths.open_doc_db()?;
    let vec_conn = paths.open_vec_db()?;
    let pending: Vec<&Question> = gs.questions.iter().filter(|q| !q.confirmed).collect();
    let key = if pending.is_empty() { None } else { Some(paths.read_key()?) };

    let mut doc_stmt = doc_conn
        .prepare(
            "SELECT d.name, p.name FROM documents d
             LEFT JOIN documents p ON p.id = d.parent_folder_id
             WHERE d.id = ?1",
        )
        .map_err(|e| format!("failed to prepare document lookup: {}", e))?;

    let mut out = String::new();
    out.push_str("# RAG golden set — candidates\n\n");
    out.push_str("Generated by `rag_eval candidates`. Contains work data: never commit this file.\n\n");
    out.push_str(&format!(
        "For each unconfirmed question: the {} best documents in scope (top {} chunks, deduplicated by document). `*` marks a document already in `expected`.\n",
        CANDIDATES_SHOWN, CANDIDATES_POOL
    ));

    for q in &pending {
        out.push_str(&format!("\n## {} · {}\n\n", q.id, q.class));
        out.push_str(&format!("**Question:** {}\n\n", q.question));
        let doc_ids = scope_ids(&doc_conn, q)?;
        out.push_str(&format!("Scope: {} searchable documents\n\n", doc_ids.len()));
        if doc_ids.is_empty() {
            out.push_str("_Scope resolved to no documents: fill `scope.ids` / `scope.notebookId`._\n");
            continue;
        }
        // Para achar o gabarito de follow-ups, a consulta inclui o histórico.
        let mut query_text: String = q
            .history
            .iter()
            .map(|t| t.content.as_str())
            .chain(std::iter::once(q.question.as_str()))
            .collect::<Vec<_>>()
            .join("\n");
        if query_text.chars().count() > CANDIDATE_QUERY_MAX_CHARS {
            query_text = query_text.chars().take(CANDIDATE_QUERY_MAX_CHARS).collect();
        }
        let key = key.as_deref().expect("key loaded for pending questions");
        let embedding = tauri::async_runtime::block_on(rag::embed_query(key, &query_text))?;
        let chunks = rag::knn_search(&vec_conn, &doc_ids, &embedding, CANDIDATES_POOL)?;
        let expected: HashSet<&str> = q.expected.iter().map(|e| e.document_id.as_str()).collect();
        let mut seen = HashSet::new();
        let best: Vec<&rag::ChunkResult> = chunks
            .iter()
            .filter(|c| seen.insert(c.document_id.clone()))
            .take(CANDIDATES_SHOWN)
            .collect();
        for (i, c) in best.iter().enumerate() {
            let (name, folder) = doc_stmt
                .query_row(params![c.document_id], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
                })
                .unwrap_or_else(|_| (c.document_name.clone(), None));
            let snippet: String = c
                .snippet
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
                .chars()
                .take(SNIPPET_CHARS)
                .collect();
            out.push_str(&format!(
                "{}. {}`{}` — {} ({}) — d={:.3}\n   > {}\n",
                i + 1,
                if expected.contains(c.document_id.as_str()) { "* " } else { "" },
                c.document_id,
                name,
                folder.unwrap_or_else(|| "no folder".into()),
                c.distance,
                snippet
            ));
        }
    }

    paths.write(&paths.candidates, &out)?;
    println!(
        "Wrote {} ({} unconfirmed question(s))",
        paths.candidates.display(),
        pending.len()
    );
    Ok(())
}

#[derive(Default)]
struct Totals {
    n: usize,
    recall: f64,
    hit: f64,
    rr: f64,
}

impl Totals {
    fn add(&mut self, recall: f64, hit: f64, rr: f64) {
        self.n += 1;
        self.recall += recall;
        self.hit += hit;
        self.rr += rr;
    }

    fn means(&self) -> (f64, f64, f64) {
        if self.n == 0 {
            return (0.0, 0.0, 0.0);
        }
        let n = self.n as f64;
        (self.recall / n, self.hit / n, self.rr / n)
    }
}

fn arg_value(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

// Etapas do `full` (todas ligadas por padrão).
struct FullOptions {
    rewrite: bool,
    fts: bool,
    rerank: bool,
    threshold: f64,
}

impl FullOptions {
    fn from_args(args: &[String]) -> Result<Self, String> {
        let threshold = match arg_value(args, "--threshold") {
            Some(t) => t
                .parse::<f64>()
                .map_err(|_| format!("invalid --threshold: {}", t))?,
            None => rag::RERANK_THRESHOLD,
        };
        Ok(FullOptions {
            rewrite: !args.iter().any(|a| a == "--no-rewrite"),
            fts: !args.iter().any(|a| a == "--no-fts"),
            rerank: !args.iter().any(|a| a == "--no-rerank"),
            threshold,
        })
    }

    fn label(&self) -> String {
        let mut label = String::from("full");
        for (on, flag) in [(self.rewrite, "-no-rewrite"), (self.fts, "-no-fts"), (self.rerank, "-no-rerank")] {
            if !on {
                label.push_str(flag);
            }
        }
        if self.rerank && self.threshold != rag::RERANK_THRESHOLD {
            label.push_str(&format!("-t{}", self.threshold));
        }
        label
    }
}

// Contadores do `full` (flags do trace e latência).
#[derive(Default)]
struct FullTotals {
    rewrite_failed: usize,
    rerank_failed: usize,
    nothing_relevant: usize,
    selected_chunks: usize,
    ms: u128,
}

// Maior pontuação de rerank de um conjunto de candidatos.
fn best_rerank<'a>(candidates: impl Iterator<Item = &'a rag::RagCandidate>) -> Option<f64> {
    candidates
        .filter_map(|c| c.rerank_score)
        .fold(None, |acc: Option<f64>, s| Some(acc.map_or(s, |a| a.max(s))))
}

fn run(paths: &DevPaths, args: &[String]) -> Result<(), String> {
    let pipeline = arg_value(args, "--pipeline").unwrap_or_else(|| "baseline".into());
    if !["baseline", "hybrid", "full"].contains(&pipeline.as_str()) {
        return Err(format!(
            "pipeline '{}' is not available (baseline | hybrid | full)",
            pipeline
        ));
    }
    let full = if pipeline == "full" { Some(FullOptions::from_args(args)?) } else { None };
    let label = arg_value(args, "--label")
        .or_else(|| full.as_ref().map(FullOptions::label))
        .unwrap_or_else(|| pipeline.clone());
    let safe_label: String = label
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();

    let gs = paths.load_goldenset()?;
    let doc_conn = paths.open_doc_db()?;
    let vec_conn = paths.open_vec_db()?;
    if pipeline != "baseline" {
        check_fts(&vec_conn)?;
    }
    // O `full` recebe o banco como o app (Mutex travado só durante a busca).
    let vec_db = Mutex::new(vec_conn);
    let today = rag::local_today(&doc_conn)?;
    let mut key: Option<String> = None;

    let mut by_class: HashMap<&str, Totals> = HashMap::new();
    let mut overall = Totals::default();
    let mut per_question = Vec::new();
    let mut full_totals = FullTotals::default();

    for q in gs.questions.iter().filter(|q| q.confirmed) {
        if q.expected.is_empty() {
            eprintln!("warning: question {} is confirmed but has no expected documents; skipped", q.id);
            continue;
        }
        let doc_ids = scope_ids(&doc_conn, q)?;
        let mut trace = serde_json::Value::Null;
        let mut retrieved = if doc_ids.is_empty() {
            eprintln!("warning: question {} has an empty scope", q.id);
            vec![]
        } else {
            if key.is_none() {
                key = Some(paths.read_key()?);
            }
            let k = key.as_deref().expect("key loaded");
            if let Some(opts) = &full {
                let req = rag::RagRequest {
                    message: q.question.clone(),
                    history: q
                        .history
                        .iter()
                        .map(|t| rag::RagTurn { role: t.role.clone(), content: t.content.clone() })
                        .collect(),
                    doc_ids: doc_ids.clone(),
                    current_date: q.current_date.clone().unwrap_or_else(|| today.clone()),
                    rewrite_model: rag::DEFAULT_REWRITE_MODEL.to_string(),
                    use_rewrite: opts.rewrite,
                    use_fts: opts.fts,
                    use_rerank: opts.rerank,
                    threshold: opts.threshold,
                    filters: None,
                };
                let started = Instant::now();
                let resp = tauri::async_runtime::block_on(rag::retrieve(&vec_db, k, &req))
                    .map_err(|e| format!("question {}: {}", q.id, e))?;
                let ms = started.elapsed().as_millis();
                full_totals.ms += ms;
                full_totals.rewrite_failed += resp.rewrite_failed as usize;
                full_totals.rerank_failed += resp.rerank_failed as usize;
                full_totals.nothing_relevant += resp.nothing_relevant as usize;
                full_totals.selected_chunks += resp.selected.len();
                // Só números: posição de cada esperado no conjunto de
                // candidatos (ordem da RRF) e o melhor rerank dele.
                let expected_in_pool: Vec<serde_json::Value> = q
                    .expected
                    .iter()
                    .map(|e| {
                        let pool_rank = resp
                            .candidates
                            .iter()
                            .position(|c| c.document_id == e.document_id)
                            .map(|p| p + 1);
                        let rerank = best_rerank(
                            resp.candidates.iter().filter(|c| c.document_id == e.document_id),
                        );
                        json!({ "documentId": e.document_id, "poolRank": pool_rank, "bestRerank": rerank })
                    })
                    .collect();
                trace = json!({
                    "rewriteFailed": resp.rewrite_failed,
                    "rerankFailed": resp.rerank_failed,
                    "nothingRelevant": resp.nothing_relevant,
                    "keywordCount": resp.keywords.len(),
                    "dateRange": resp.date_range.is_some(),
                    "candidates": resp.candidates.len(),
                    "selected": resp.selected.len(),
                    "topRerank": best_rerank(resp.candidates.iter()),
                    "expectedInPool": expected_in_pool,
                    "ms": ms,
                });
                ranked_documents(resp.selected.iter().map(|c| c.document_id.as_str()))
            } else if pipeline == "hybrid" {
                let embedding = tauri::async_runtime::block_on(rag::embed_query(k, &q.question))
                    .map_err(|e| format!("question {}: {}", q.id, e))?;
                let vec_conn = vec_db.lock().map_err(|e| e.to_string())?;
                let candidates = rag::hybrid_search(
                    &vec_conn,
                    &doc_ids,
                    &embedding,
                    &rag::message_terms(&q.question),
                    rag::HYBRID_K_EACH,
                    rag::HYBRID_POOL,
                )
                .map_err(|e| format!("question {}: {}", q.id, e))?;
                ranked_documents(candidates.iter().map(|c| c.document_id.as_str()))
            } else {
                let vec_conn = vec_db.lock().map_err(|e| e.to_string())?;
                let chunks = tauri::async_runtime::block_on(rag::retrieve_baseline(
                    &vec_conn,
                    k,
                    &q.question,
                    &doc_ids,
                ))
                .map_err(|e| format!("question {}: {}", q.id, e))?;
                ranked_documents(chunks.iter().map(|c| c.document_id.as_str()))
            }
        };
        retrieved.truncate(gs.k);

        let expected_ranks: Vec<serde_json::Value> = q
            .expected
            .iter()
            .map(|e| {
                let rank = retrieved.iter().position(|d| *d == e.document_id).map(|p| p + 1);
                json!({ "documentId": e.document_id, "rank": rank })
            })
            .collect();
        let expected_ids: HashSet<&str> = q.expected.iter().map(|e| e.document_id.as_str()).collect();
        let found = retrieved.iter().filter(|d| expected_ids.contains(d.as_str())).count();
        let recall = found as f64 / expected_ids.len() as f64;
        let first_rank = retrieved
            .iter()
            .position(|d| expected_ids.contains(d.as_str()))
            .map(|p| p + 1);
        let hit = if first_rank.is_some() { 1.0 } else { 0.0 };
        let rr = first_rank.map(|r| 1.0 / r as f64).unwrap_or(0.0);

        by_class.entry(q.class.as_str()).or_default().add(recall, hit, rr);
        overall.add(recall, hit, rr);
        per_question.push(json!({
            "id": q.id,
            "class": q.class,
            "scopeSize": doc_ids.len(),
            "retrieved": retrieved,
            "expected": expected_ranks,
            "firstHitRank": first_rank,
            "recall": recall,
            "hit": hit,
            "rr": rr,
            "trace": trace,
        }));
    }

    let k = gs.k;
    println!(
        "\n{:<12} {:>4} {:>10} {:>8} {:>7}",
        "class",
        "n",
        format!("recall@{}", k),
        format!("hit@{}", k),
        "MRR"
    );
    let mut summary = Vec::new();
    for class in CLASSES {
        if let Some(t) = by_class.get(class) {
            let (r, h, m) = t.means();
            println!("{:<12} {:>4} {:>10.3} {:>8.3} {:>7.3}", class, t.n, r, h, m);
            summary.push(json!({ "class": class, "n": t.n, "recall": r, "hit": h, "mrr": m }));
        }
    }
    let (r, h, m) = overall.means();
    println!("{:<12} {:>4} {:>10.3} {:>8.3} {:>7.3}", "overall", overall.n, r, h, m);
    let full_summary = if full.is_some() && overall.n > 0 {
        let n = overall.n as f64;
        println!(
            "\nrewrite failed: {} · rerank failed: {} · nothing relevant: {} · avg selected chunks: {:.1} · avg latency: {:.0} ms",
            full_totals.rewrite_failed,
            full_totals.rerank_failed,
            full_totals.nothing_relevant,
            full_totals.selected_chunks as f64 / n,
            full_totals.ms as f64 / n
        );
        json!({
            "rewriteFailed": full_totals.rewrite_failed,
            "rerankFailed": full_totals.rerank_failed,
            "nothingRelevant": full_totals.nothing_relevant,
            "avgSelectedChunks": full_totals.selected_chunks as f64 / n,
            "avgMs": full_totals.ms as f64 / n,
        })
    } else {
        serde_json::Value::Null
    };

    let ts = utc_timestamp();
    let result = json!({
        "version": 1,
        "label": label,
        "pipeline": pipeline,
        "createdAtUtc": ts,
        "k": k,
        "summary": summary,
        "overall": { "n": overall.n, "recall": r, "hit": h, "mrr": m },
        "full": full_summary,
        "questions": per_question,
    });
    let out_path = paths.results_dir.join(format!("{}-{}.json", ts, safe_label));
    let body = serde_json::to_string_pretty(&result).map_err(|e| e.to_string())?;
    paths.write(&out_path, &body)?;
    println!("\nResults: {}", out_path.display());
    Ok(())
}

fn usage() {
    eprintln!(
        "usage (from src-tauri/):\n  \
         cargo run --example rag_eval -- init\n  \
         cargo run --example rag_eval -- candidates\n  \
         cargo run --example rag_eval -- run [--label <name>] [--pipeline baseline|hybrid|full]\n    \
         full only: [--no-rewrite] [--no-fts] [--no-rerank] [--threshold <f>]"
    );
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = DevPaths::resolve().and_then(|paths| match args.first().map(String::as_str) {
        Some("init") => init(&paths),
        Some("candidates") => candidates(&paths),
        Some("run") => run(&paths, &args[1..]),
        _ => {
            usage();
            Err("missing or unknown subcommand".into())
        }
    });
    if let Err(e) = result {
        eprintln!("rag_eval: {}", e);
        std::process::exit(1);
    }
}
