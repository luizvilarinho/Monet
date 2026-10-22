// Recuperação do RAG (escopo, KNN, FTS5 + RRF, embedding da consulta,
// reescrita, rerank e pesos por fonte). Mora num módulo
// público para que o golden set (`examples/rag_eval.rs`) rode o mesmo código
// que o app.
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use rusqlite::{params, params_from_iter, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use zerocopy::AsBytes;

use crate::documents::{embed_batch, http_client, note_doc_id, notes_folder_doc_id, with_doc_db, DocDb};
use crate::vec_db::{register_auto_extension, VecDb, EMBEDDING_DIM};

// Mesmo top-k do RAG do chat (useChat.ts).
const BASELINE_TOP_K: usize = 5;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkResult {
    pub document_id: String,
    pub document_name: String,
    pub chunk_index: i64,
    pub snippet: String,
    pub distance: f64,
}

pub fn open_vec_db_readonly(path: &Path) -> Result<Connection, String> {
    register_auto_extension();
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("failed to open {} read-only: {}", path.display(), e))
}

// Embedding de uma consulta (chat, /docs): no máximo 1 retry num 429 e um
// teto de tempo, para o turno não ficar preso em "Searching knowledge base...".
// O backoff longo do embed_batch é para a indexação.
const EMBED_QUERY_RATE_LIMIT_RETRIES: u32 = 1;
const EMBED_QUERY_TIMEOUT: Duration = Duration::from_secs(10);

pub async fn embed_query(key: &str, text: &str) -> Result<Vec<f32>, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("empty text".into());
    }
    let batch = vec![trimmed.to_string()];
    let call = embed_batch(key, &batch, EMBED_QUERY_RATE_LIMIT_RETRIES);
    let mut embs = tokio::time::timeout(EMBED_QUERY_TIMEOUT, call)
        .await
        .map_err(|_| "Embedding timed out. Please try again.".to_string())??;
    embs.pop().ok_or_else(|| "API returned no embedding".into())
}

// Expande ids de visibilidade (arquivos e pastas) para os ids de arquivo
// pesquisáveis. Pastas viram seus filhos `available` atuais; ids que não
// existem mais em `documents` são ignorados. Com `notebook_id`, inclui a pasta
// de notas do caderno (se existir); `exclude_note_id` tira a cópia indexada
// daquela nota. Pastas `origin = 'ai'` só expandem com `include_ai_folders`.
pub fn resolve_scope(
    doc_conn: &Connection,
    raw_ids: &[String],
    notebook_id: Option<&str>,
    exclude_note_id: Option<&str>,
    include_ai_folders: bool,
) -> Result<Vec<String>, String> {
    let mut ids: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for id in raw_ids {
        if seen.insert(id.clone()) {
            ids.push(id.clone());
        }
    }
    if let Some(nb) = notebook_id.filter(|s| !s.is_empty()) {
        let folder_id = notes_folder_doc_id(nb);
        let exists = doc_conn
            .query_row(
                "SELECT COUNT(*) FROM documents WHERE id = ?1",
                params![folder_id],
                |r| r.get::<_, i64>(0),
            )
            .map_err(|e| format!("failed to query document: {}", e))?
            > 0;
        if exists && seen.insert(folder_id.clone()) {
            ids.push(folder_id);
        }
    }

    let mut doc_stmt = doc_conn
        .prepare("SELECT COALESCE(type, 'file'), status, origin FROM documents WHERE id = ?1")
        .map_err(|e| format!("failed to prepare scope query: {}", e))?;
    let mut children_stmt = doc_conn
        .prepare(
            "SELECT id FROM documents
             WHERE parent_folder_id = ?1 AND COALESCE(type, 'file') = 'file' AND status = 'available'
             ORDER BY created_at DESC",
        )
        .map_err(|e| format!("failed to prepare scope query: {}", e))?;

    let mut expanded: Vec<String> = Vec::new();
    let mut expanded_seen: HashSet<String> = HashSet::new();
    for id in &ids {
        let row = doc_stmt.query_row(params![id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        });
        let (doc_type, status, origin) = match row {
            Ok(v) => v,
            Err(rusqlite::Error::QueryReturnedNoRows) => continue,
            Err(e) => return Err(format!("failed to query document: {}", e)),
        };
        if doc_type == "folder" {
            if origin == "ai" && !include_ai_folders {
                continue;
            }
            let children = children_stmt
                .query_map(params![id], |r| r.get::<_, String>(0))
                .map_err(|e| format!("failed to list folder children: {}", e))?;
            for child in children {
                let child = child.map_err(|e| format!("invalid row: {}", e))?;
                if expanded_seen.insert(child.clone()) {
                    expanded.push(child);
                }
            }
        } else if status == "available" && expanded_seen.insert(id.clone()) {
            expanded.push(id.clone());
        }
    }

    if let Some(note_id) = exclude_note_id.filter(|s| !s.is_empty()) {
        let excluded = note_doc_id(note_id);
        expanded.retain(|id| *id != excluded);
    }
    Ok(expanded)
}

pub fn knn_search(
    conn: &Connection,
    document_ids: &[String],
    query_embedding: &[f32],
    top_k: usize,
) -> Result<Vec<ChunkResult>, String> {
    if document_ids.is_empty() {
        return Ok(vec![]);
    }
    if query_embedding.len() != EMBEDDING_DIM {
        return Err(format!(
            "embedding tem {} dim, esperado {}",
            query_embedding.len(),
            EMBEDDING_DIM
        ));
    }
    let target_k = top_k.max(1);
    // O filtro `rowid IN (subquery)` do sqlite-vec 0.1.9 é pré-aplicado ao KNN
    // (verificado em 2026-10-17): todos os resultados já vêm do escopo. A
    // sobre-amostragem existe só para o filtro de vizinhos abaixo ter
    // substitutos. Teto de 200 evita varredura excessiva.
    let scan_k = target_k.saturating_mul(5).min(200) as i64;

    let sql = format!(
        "SELECT cm.document_id, cm.source_name, cm.content, cm.chunk_index, vc.distance
         FROM vec_chunks vc
         JOIN chunks_meta cm ON cm.rowid = vc.rowid
         WHERE vc.embedding MATCH ?
           AND vc.k = ?
           AND vc.rowid IN (SELECT rowid FROM chunks_meta WHERE document_id IN ({}))
         ORDER BY vc.distance
         LIMIT ?",
        placeholders(document_ids.len())
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("failed to prepare search: {}", e))?;

    // Monta lista de parâmetros: [embedding_bytes, scan_k, doc_ids..., scan_k]
    let embedding_bytes = query_embedding.as_bytes().to_vec();
    let mut binders: Vec<Box<dyn rusqlite::ToSql>> = Vec::with_capacity(3 + document_ids.len());
    binders.push(Box::new(embedding_bytes));
    binders.push(Box::new(scan_k));
    for id in document_ids {
        binders.push(Box::new(id.clone()));
    }
    // Traz ate scan_k candidatos (nao so target_k) para sobrar pool suficiente
    // pro filtro de vizinhanca abaixo escolher substitutos quando descarta um.
    binders.push(Box::new(scan_k));

    let rows = stmt
        .query_map(params_from_iter(binders.iter().map(|b| b.as_ref())), |r| {
            Ok(ChunkResult {
                document_id: r.get(0)?,
                document_name: r.get(1)?,
                chunk_index: r.get(3)?,
                snippet: r.get(2)?,
                distance: r.get(4)?,
            })
        })
        .map_err(|e| format!("search failed: {}", e))?;

    let mut candidates = Vec::new();
    for r in rows {
        candidates.push(r.map_err(|e| format!("invalid row: {}", e))?);
    }

    // Chunks vizinhos (chunk_index a +-1) do mesmo documento carregam texto
    // quase identico por causa do overlap do chunking — sem esse filtro, o
    // top-k tendia a incluir pares quase-duplicados em vez de diversificar.
    // Candidatos ja vem ordenados por distancia (mais relevante primeiro);
    // o fallback preenche o restante caso o filtro deixe menos que target_k.
    let mut selected: Vec<ChunkResult> = Vec::with_capacity(target_k);
    let mut fallback: Vec<ChunkResult> = Vec::new();
    for r in candidates {
        let is_adjacent = selected.iter().any(|s: &ChunkResult| {
            s.document_id == r.document_id && (s.chunk_index - r.chunk_index).abs() <= 1
        });
        if is_adjacent {
            fallback.push(r);
        } else {
            selected.push(r);
        }
        if selected.len() >= target_k {
            break;
        }
    }
    if selected.len() < target_k {
        selected.extend(fallback.into_iter().take(target_k - selected.len()));
    }
    // O fallback e anexado no fim, entao reordena para manter a promessa de
    // "mais relevante primeiro" que o consumidor (prompt do chat) pressupoe.
    selected.sort_by(|a, b| {
        a.distance
            .partial_cmp(&b.distance)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(selected)
}

// Busca híbrida: candidatos de cada lado (KNN e FTS), tamanho do conjunto
// fundido e constante da RRF.
pub const HYBRID_K_EACH: usize = 40;
pub const HYBRID_POOL: usize = 40;
const RRF_K: f64 = 60.0;
// Termos da consulta FTS: mínimo de chars por termo e teto de termos.
const FTS_MIN_TERM_CHARS: usize = 2;
const FTS_MAX_TERMS: usize = 12;
// Termos tirados da própria mensagem: mínimo de chars e stopwords pt/en.
const MESSAGE_MIN_TERM_CHARS: usize = 3;
const STOPWORDS: &[&str] = &[
    // pt
    "que", "qual", "quais", "quem", "como", "onde", "quando", "porque", "por", "para", "pra",
    "com", "sem", "sobre", "uma", "uns", "umas", "dos", "das", "nos", "nas", "pelo", "pela",
    "pelos", "pelas", "num", "numa", "este", "esta", "esse", "essa", "isso", "isto", "aquele",
    "aquela", "ele", "ela", "eles", "elas", "meu", "minha", "meus", "minhas", "seu", "sua",
    "seus", "suas", "não", "sim", "mais", "menos", "muito", "foi", "ser", "são", "está",
    "estão", "tem", "têm", "ter", "há", "faz", "fazer", "pode", "posso", "também", "já",
    "ainda", "então", "mas", "aqui", "ali", "lá", "você", "vocês", "nós", "algum", "alguma",
    "todo", "toda", "todos", "todas", "tudo",
    // en
    "the", "and", "for", "are", "was", "were", "what", "which", "who", "whom", "how", "why",
    "when", "where", "with", "without", "from", "about", "this", "that", "these", "those",
    "you", "your", "can", "could", "does", "did", "have", "has", "had", "not", "but", "all",
    "any", "some", "into", "there", "their", "them", "they", "its", "our", "out",
];

// Candidato da busca híbrida: colunas de chunks_meta + posições e pontuações
// de cada lado (rank 1-based; None = não veio daquele lado) e a RRF.
pub struct Candidate {
    pub rowid: i64,
    pub document_id: String,
    pub document_name: String,
    pub chunk_index: i64,
    pub content: String,
    pub header: String,
    pub kind: String,
    pub title: String,
    pub doc_date: Option<String>,
    pub folder_label: Option<String>,
    pub section: Option<String>,
    pub page: Option<i64>,
    pub source_url: Option<String>,
    pub vec_rank: Option<usize>,
    pub vec_distance: Option<f64>,
    pub fts_rank: Option<usize>,
    pub bm25: Option<f64>,
    pub rrf: f64,
}

fn placeholders(n: usize) -> String {
    std::iter::repeat("?").take(n).collect::<Vec<_>>().join(",")
}

// Expressão MATCH do FTS5 a partir de termos livres. Cada termo vira uma frase
// entre aspas (com `"` escapado como `""`), então operadores, `*`, `:`, `-` e
// parênteses do usuário são texto, nunca sintaxe. O unicode61 tokeniza a frase
// "9.0.0.1" como `9 0 0 1` em sequência. Termos curtos ou sem letra/dígito
// saem; None = nada pesquisável.
pub fn fts_query(terms: &[String]) -> Option<String> {
    let mut seen: HashSet<String> = HashSet::new();
    let phrases: Vec<String> = terms
        .iter()
        .map(|t| t.trim())
        .filter(|t| t.chars().count() >= FTS_MIN_TERM_CHARS && t.chars().any(char::is_alphanumeric))
        .filter(|t| seen.insert(t.to_lowercase()))
        .take(FTS_MAX_TERMS)
        .map(|t| format!("\"{}\"", t.replace('"', "\"\"")))
        .collect();
    if phrases.is_empty() {
        None
    } else {
        Some(phrases.join(" OR "))
    }
}

// Termos FTS tirados da própria mensagem (quando não há keywords da
// reescrita): palavras separadas por espaço, sem a pontuação das pontas (o
// ponto interno de "9.0.0.1" fica), com 3+ chars e fora das stopwords.
pub fn message_terms(message: &str) -> Vec<String> {
    let mut seen: HashSet<String> = HashSet::new();
    message
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase())
        .filter(|w| w.chars().count() >= MESSAGE_MIN_TERM_CHARS)
        .filter(|w| !STOPWORDS.contains(&w.as_str()))
        .filter(|w| seen.insert(w.clone()))
        .collect()
}

// Top-k do FTS5 dentro do escopo, por bm25 (menor = melhor): (rowid, bm25).
pub fn fts_search(
    conn: &Connection,
    document_ids: &[String],
    match_expr: &str,
    k: usize,
) -> Result<Vec<(i64, f64)>, String> {
    if document_ids.is_empty() || k == 0 {
        return Ok(vec![]);
    }
    let sql = format!(
        "SELECT rowid, bm25(chunks_fts) FROM chunks_fts
         WHERE chunks_fts MATCH ?
           AND rowid IN (SELECT rowid FROM chunks_meta WHERE document_id IN ({}))
         ORDER BY bm25(chunks_fts)
         LIMIT ?",
        placeholders(document_ids.len())
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("failed to prepare text search: {}", e))?;
    let mut binders: Vec<Box<dyn rusqlite::ToSql>> = Vec::with_capacity(2 + document_ids.len());
    binders.push(Box::new(match_expr.to_string()));
    for id in document_ids {
        binders.push(Box::new(id.clone()));
    }
    binders.push(Box::new(k as i64));
    let rows = stmt
        .query_map(params_from_iter(binders.iter().map(|b| b.as_ref())), |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, f64>(1)?))
        })
        .map_err(|e| format!("text search failed: {}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("invalid row: {}", e))
}

// Top-k do KNN dentro do escopo, sem o filtro de vizinhos: (rowid, distância).
fn knn_rowids(
    conn: &Connection,
    document_ids: &[String],
    query_embedding: &[f32],
    k: usize,
) -> Result<Vec<(i64, f64)>, String> {
    if document_ids.is_empty() || k == 0 {
        return Ok(vec![]);
    }
    if query_embedding.len() != EMBEDDING_DIM {
        return Err(format!(
            "embedding tem {} dim, esperado {}",
            query_embedding.len(),
            EMBEDDING_DIM
        ));
    }
    let sql = format!(
        "SELECT rowid, distance FROM vec_chunks
         WHERE embedding MATCH ?
           AND k = ?
           AND rowid IN (SELECT rowid FROM chunks_meta WHERE document_id IN ({}))
         ORDER BY distance",
        placeholders(document_ids.len())
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("failed to prepare search: {}", e))?;
    let mut binders: Vec<Box<dyn rusqlite::ToSql>> = Vec::with_capacity(2 + document_ids.len());
    binders.push(Box::new(query_embedding.as_bytes().to_vec()));
    binders.push(Box::new(k as i64));
    for id in document_ids {
        binders.push(Box::new(id.clone()));
    }
    let rows = stmt
        .query_map(params_from_iter(binders.iter().map(|b| b.as_ref())), |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, f64>(1)?))
        })
        .map_err(|e| format!("search failed: {}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("invalid row: {}", e))
}

// Chunks de chunks_meta por rowid, sem pontuações (ordem do banco; rowids
// que não existem mais são ignorados).
fn chunk_rows(conn: &Connection, rowids: &[i64]) -> Result<Vec<Candidate>, String> {
    if rowids.is_empty() {
        return Ok(vec![]);
    }
    let sql = format!(
        "SELECT rowid, document_id, source_name, chunk_index, content, header, kind, title,
                doc_date, folder_label, section, page, source_url
         FROM chunks_meta WHERE rowid IN ({})",
        placeholders(rowids.len())
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("failed to prepare chunk lookup: {}", e))?;
    let rows = stmt
        .query_map(params_from_iter(rowids.iter()), |r| {
            Ok(Candidate {
                rowid: r.get(0)?,
                document_id: r.get(1)?,
                document_name: r.get(2)?,
                chunk_index: r.get(3)?,
                content: r.get(4)?,
                header: r.get(5)?,
                kind: r.get(6)?,
                title: r.get(7)?,
                doc_date: r.get(8)?,
                folder_label: r.get(9)?,
                section: r.get(10)?,
                page: r.get(11)?,
                source_url: r.get(12)?,
                vec_rank: None,
                vec_distance: None,
                fts_rank: None,
                bm25: None,
                rrf: 0.0,
            })
        })
        .map_err(|e| format!("chunk lookup failed: {}", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("invalid row: {}", e))
}

// KNN (top `k_each`) + FTS5 (top `k_each`) no escopo, fundidos por RRF
// (`Σ 1/(60 + rank)`). Sem termos pesquisáveis, fica só o KNN. O filtro de
// vizinhos (mesmo documento, chunk_index ±1, quase duplicados pelo overlap) é
// aplicado depois da fusão; devolve até `pool` candidatos, melhor RRF primeiro.
pub fn hybrid_search(
    conn: &Connection,
    document_ids: &[String],
    query_embedding: &[f32],
    fts_terms: &[String],
    k_each: usize,
    pool: usize,
) -> Result<Vec<Candidate>, String> {
    if document_ids.is_empty() {
        return Ok(vec![]);
    }
    let vec_hits = knn_rowids(conn, document_ids, query_embedding, k_each)?;
    // Erro no FTS (MATCH inesperado, tabela corrompida): segue só com o KNN.
    let fts_hits = match fts_query(fts_terms) {
        Some(expr) => fts_search(conn, document_ids, &expr, k_each).unwrap_or_else(|e| {
            eprintln!("rag text search failed, using vector search only: {}", e);
            vec![]
        }),
        None => vec![],
    };

    // rowid -> (vec_rank, distância, fts_rank, bm25)
    let mut fused: HashMap<i64, (Option<usize>, Option<f64>, Option<usize>, Option<f64>)> =
        HashMap::new();
    for (i, (rowid, distance)) in vec_hits.iter().enumerate() {
        let e = fused.entry(*rowid).or_default();
        e.0 = Some(i + 1);
        e.1 = Some(*distance);
    }
    for (i, (rowid, bm25)) in fts_hits.iter().enumerate() {
        let e = fused.entry(*rowid).or_default();
        e.2 = Some(i + 1);
        e.3 = Some(*bm25);
    }
    if fused.is_empty() {
        return Ok(vec![]);
    }

    let rowids: Vec<i64> = fused.keys().copied().collect();
    let mut candidates = chunk_rows(conn, &rowids)?;
    for c in &mut candidates {
        let (vec_rank, vec_distance, fts_rank, bm25) = fused[&c.rowid];
        c.vec_rank = vec_rank;
        c.vec_distance = vec_distance;
        c.fts_rank = fts_rank;
        c.bm25 = bm25;
        c.rrf = [vec_rank, fts_rank]
            .into_iter()
            .flatten()
            .map(|rank| 1.0 / (RRF_K + rank as f64))
            .sum();
    }
    // Empate na RRF: o melhor do vetor primeiro, depois rowid (determinístico).
    let by_rrf = |a: &Candidate, b: &Candidate| {
        b.rrf
            .partial_cmp(&a.rrf)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.vec_rank.unwrap_or(usize::MAX).cmp(&b.vec_rank.unwrap_or(usize::MAX)))
            .then(a.rowid.cmp(&b.rowid))
    };
    candidates.sort_by(by_rrf);

    // Mesmo filtro de vizinhos do knn_search, com o fallback preenchendo o
    // que faltar para `pool`.
    let mut selected: Vec<Candidate> = Vec::with_capacity(pool);
    let mut fallback: Vec<Candidate> = Vec::new();
    for c in candidates {
        if selected.len() >= pool {
            break;
        }
        let is_adjacent = selected
            .iter()
            .any(|s| s.document_id == c.document_id && (s.chunk_index - c.chunk_index).abs() <= 1);
        if is_adjacent {
            fallback.push(c);
        } else {
            selected.push(c);
        }
    }
    if selected.len() < pool {
        selected.extend(fallback.into_iter().take(pool - selected.len()));
        selected.sort_by(by_rrf);
    }
    Ok(selected)
}

// Teto de cada parte do cabeçalho (título, seção): uma linha gigante virando
// título estouraria o limite do embedding.
const MAX_HEADER_PART_CHARS: usize = 200;

// Metadados do documento que vão no cabeçalho de cada chunk e nas colunas de
// chunks_meta. `kind`: note | meeting | web | document.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct DocMeta {
    pub kind: &'static str,
    pub title: String,
    pub doc_date: Option<String>,
    pub folder_label: Option<String>,
    pub source_url: Option<String>,
    // Data de arquivamento da nota (`YYYY-MM-DD`), quando arquivada.
    pub archived: Option<String>,
}

pub(crate) fn header_part(s: &str) -> String {
    s.trim().chars().take(MAX_HEADER_PART_CHARS).collect()
}

fn non_empty(s: Option<&str>) -> Option<String> {
    s.map(header_part).filter(|s| !s.is_empty())
}

// `YYYY-MM-DD`.
fn is_iso_date(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b.iter().enumerate().all(|(i, c)| match i {
            4 | 7 => *c == b'-',
            _ => c.is_ascii_digit(),
        })
}

// Nota: os metadados vêm do próprio upsert (título, pasta "Notes — <caderno>",
// data da nota e data de arquivamento), sem consultar o banco.
pub(crate) fn note_meta(
    title: &str,
    folder: &str,
    note_date: Option<&str>,
    archived: Option<&str>,
) -> DocMeta {
    DocMeta {
        kind: "note",
        title: header_part(title),
        doc_date: note_date.map(str::trim).filter(|d| is_iso_date(d)).map(String::from),
        folder_label: non_empty(Some(folder)),
        source_url: None,
        archived: archived.map(str::trim).filter(|d| is_iso_date(d)).map(String::from),
    }
}

struct DocRow {
    name: String,
    path: String,
    mime: String,
    // Data do arquivo (last_modified_ms da pasta monitorada ou created_at do
    // upload), já em `YYYY-MM-DD` local.
    file_date: Option<String>,
    parent_name: Option<String>,
    parent_origin: Option<String>,
    alias: Option<String>,
}

// Metadados de um arquivo da KB (não-nota). `file_text` é o início do texto
// lido (1º segmento), usado para o título e o cabeçalho das páginas web.
pub(crate) fn doc_meta(
    doc_conn: &Connection,
    document_id: &str,
    file_text: &str,
) -> Result<DocMeta, String> {
    let row = doc_conn
        .query_row(
            "SELECT d.name, d.original_path, d.mime,
                    date(COALESCE(d.last_modified_ms, d.created_at) / 1000, 'unixepoch', 'localtime'),
                    p.name, p.origin, a.alias
             FROM documents d
             LEFT JOIN documents p ON p.id = d.parent_folder_id
             LEFT JOIN folder_aliases a ON a.folder_id = p.id
             WHERE d.id = ?1",
            params![document_id],
            |r| {
                Ok(DocRow {
                    name: r.get(0)?,
                    path: r.get(1)?,
                    mime: r.get(2)?,
                    file_date: r.get(3)?,
                    parent_name: r.get(4)?,
                    parent_origin: r.get(5)?,
                    alias: r.get(6)?,
                })
            },
        )
        .map_err(|e| format!("failed to read document metadata: {}", e))?;
    Ok(derive_meta(&row, file_text))
}

fn derive_meta(row: &DocRow, file_text: &str) -> DocMeta {
    let folder_label = non_empty(row.alias.as_deref().or(row.parent_name.as_deref()));
    let web = parse_web_header(file_text);
    if row.parent_origin.as_deref() == Some("ai") || web.is_some() {
        let title = match &web {
            Some(w) => w.title.clone(),
            None => md_title(file_text).unwrap_or_else(|| row.name.clone()),
        };
        return DocMeta {
            kind: "web",
            title: header_part(&title),
            doc_date: web.as_ref().and_then(|w| w.retrieved.clone()),
            folder_label,
            source_url: web.map(|w| w.source),
            archived: None,
        };
    }
    if let Some((date, title)) = meeting_from_path(&row.path, &row.name) {
        return DocMeta {
            kind: "meeting",
            title: header_part(&title),
            doc_date: Some(date),
            folder_label,
            source_url: None,
            archived: None,
        };
    }
    let title = if row.mime == "text/markdown" {
        md_title(file_text).unwrap_or_else(|| row.name.clone())
    } else {
        row.name.clone()
    };
    DocMeta {
        kind: "document",
        title: header_part(&title),
        doc_date: row.file_date.clone().filter(|d| is_iso_date(d)),
        folder_label,
        source_url: None,
        archived: None,
    }
}

// Título markdown: a 1ª linha não vazia, se for um `# `.
fn md_title(text: &str) -> Option<String> {
    let first = text
        .trim_start_matches('\u{feff}')
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())?;
    non_empty(first.strip_prefix("# "))
}

struct WebHeader {
    title: String,
    source: String,
    retrieved: Option<String>,
}

// Cabeçalho que o bibliotecário grava nas páginas web (librarian.ts):
// `# <título>`, `Source: <url>` e `Retrieved: <YYYY-MM-DD>`, nessa ordem, nas
// primeiras linhas não vazias.
fn parse_web_header(text: &str) -> Option<WebHeader> {
    let mut lines = text
        .trim_start_matches('\u{feff}')
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty());
    let title = lines.next()?.strip_prefix("# ")?.trim().to_string();
    let source = lines.next()?.strip_prefix("Source:")?.trim().to_string();
    let retrieved = lines.next()?.strip_prefix("Retrieved:")?.trim();
    if title.is_empty() || source.is_empty() {
        return None;
    }
    let retrieved = retrieved.get(..10).filter(|d| is_iso_date(d)).map(String::from);
    Some(WebHeader { title, source, retrieved })
}

// Pasta de reunião `dd-mm-yyyy_hh-mm-ss`.
fn is_meeting_dir(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 19
        && b.iter().enumerate().all(|(i, c)| match i {
            2 | 5 | 13 | 16 => *c == b'-',
            10 => *c == b'_',
            _ => c.is_ascii_digit(),
        })
}

// Reunião: algum componente do caminho é uma pasta-data. Devolve a data
// (`YYYY-MM-DD`) e o título `<pasta acima> dd/mm/yyyy hh:mm — <arquivo>`.
fn meeting_from_path(path: &str, file_name: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = path.split(['\\', '/']).filter(|p| !p.is_empty()).collect();
    let i = parts.iter().position(|p| is_meeting_dir(p))?;
    let d = parts[i];
    let date = format!("{}-{}-{}", &d[6..10], &d[3..5], &d[0..2]);
    let when = format!("{}/{}/{} {}:{}", &d[0..2], &d[3..5], &d[6..10], &d[11..13], &d[14..16]);
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(file_name);
    let title = match i.checked_sub(1).map(|j| parts[j]) {
        Some(above) => format!("{} {} — {}", above, when, stem),
        None => format!("{} — {}", when, stem),
    };
    Some((date, title))
}

// `[<título> · <tipo> · <data> · <pasta> · Archived: <data> · <seção> ·
// p. <página>]`, sem as partes vazias.
pub(crate) fn build_header(meta: &DocMeta, section: Option<&str>, page: Option<u32>) -> String {
    let page = page.map(|p| format!("p. {}", p));
    let archived = meta.archived.as_deref().map(|d| format!("Archived: {}", d));
    let parts: Vec<&str> = [
        Some(meta.title.as_str()),
        Some(meta.kind),
        meta.doc_date.as_deref(),
        meta.folder_label.as_deref(),
        archived.as_deref(),
        section,
        page.as_deref(),
    ]
    .into_iter()
    .flatten()
    .filter(|s| !s.is_empty())
    .collect();
    format!("[{}]", parts.join(" · "))
}

// Assinatura dos metadados do documento: o cabeçalho sem seção e página.
// Mudou (ex.: caderno renomeado) = reembutir.
pub(crate) fn meta_sig(meta: &DocMeta) -> String {
    build_header(meta, None, None)
}

// Comportamento atual do chat: embute a pergunta inteira e pega o top-5.
pub async fn retrieve_baseline(
    vec_conn: &Connection,
    key: &str,
    question: &str,
    doc_ids: &[String],
) -> Result<Vec<ChunkResult>, String> {
    if doc_ids.is_empty() {
        return Ok(vec![]);
    }
    let embedding = embed_query(key, question).await?;
    knn_search(vec_conn, doc_ids, &embedding, BASELINE_TOP_K)
}

// --- Pipeline completo: reescrita da consulta, híbrida, rerank e peso por
// fonte. Reescrita e rerank falham em silêncio (mensagem original / ordem da
// RRF); só embedding e busca devolvem erro.

pub const DEFAULT_REWRITE_MODEL: &str = "openai/gpt-4.1-mini";
pub const RERANK_MODEL: &str = "cohere/rerank-4-fast";
// Rerank mínimo para um trecho ir ao modelo. Todos abaixo = "nada relevante".
// 0,25 (golden set, 2026-10-18): perguntas fora da base ficam em 0,09–0,30
// (mediana ~0,17); o pior esperado primário do golden set tem 0,43, e um
// secundário real, 0,27.
pub const RERANK_THRESHOLD: f64 = 0.25;
// Máximo de trechos enviados ao modelo; sem rerank, os primeiros da RRF.
const MAX_SELECTED: usize = 8;
const RRF_FALLBACK_SELECTED: usize = 6;
// Cada documento do rerank: cabeçalho + trecho, cortado.
const RERANK_DOC_CHARS: usize = 4000;
const REWRITE_TIMEOUT: Duration = Duration::from_secs(4);
const RERANK_TIMEOUT: Duration = Duration::from_secs(8);
const REWRITE_MAX_TOKENS: u32 = 300;
// Entrada da reescrita: últimas mensagens do histórico e cortes por mensagem.
const REWRITE_HISTORY_TURNS: usize = 6;
const REWRITE_TURN_CHARS: usize = 1500;
const REWRITE_MESSAGE_CHARS: usize = 2000;
const REWRITE_QUERY_MAX_CHARS: usize = 300;
const REWRITE_MAX_KEYWORDS: usize = 8;
// Sem reescrita, a consulta é o começo da mensagem: uma mensagem colada
// enorme não vira consulta gigante.
const FALLBACK_QUERY_CHARS: usize = 1000;

// Peso por fonte: o que o usuário escreveu (notas, reuniões) vale mais que
// documentos, e estes mais que páginas web salvas pela IA.
fn source_weight(kind: &str) -> f64 {
    match kind {
        "note" | "meeting" => 1.0,
        "web" => 0.7,
        _ => 0.9,
    }
}

fn trim_to_chars(s: &str, max: usize) -> String {
    s.trim().chars().take(max).collect()
}

#[derive(Clone, Deserialize)]
pub struct RagTurn {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct DateRange {
    pub from: String,
    pub to: String,
}

#[derive(Debug, PartialEq)]
pub struct Rewrite {
    pub query: String,
    pub keywords: Vec<String>,
    pub date_range: Option<DateRange>,
}

// Data local de hoje (`YYYY-MM-DD`), pelo SQLite (sem crate de datas).
pub fn local_today(conn: &Connection) -> Result<String, String> {
    conn.query_row("SELECT date('now', 'localtime')", [], |r| r.get(0))
        .map_err(|e| format!("failed to read the current date: {}", e))
}

// Dia da semana de uma data `YYYY-MM-DD` (Sakamoto).
fn weekday(date: &str) -> Option<&'static str> {
    if !is_iso_date(date) {
        return None;
    }
    let mut y: i64 = date[0..4].parse().ok()?;
    let m: usize = date[5..7].parse().ok()?;
    let d: i64 = date[8..10].parse().ok()?;
    if !(1..=12).contains(&m) {
        return None;
    }
    const T: [i64; 12] = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    if m < 3 {
        y -= 1;
    }
    let w = (y + y / 4 - y / 100 + y / 400 + T[m - 1] + d).rem_euclid(7);
    Some(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][w as usize])
}

fn rewrite_prompt(current_date: &str) -> String {
    let day = weekday(current_date).map(|w| format!(" ({})", w)).unwrap_or_default();
    format!(
        "Current date: {current_date}{day}.\n\n\
You turn the user's latest chat message into a search request for their personal knowledge base (their own notes, meeting transcripts, documents and saved web pages).\n\n\
Return JSON with:\n\
- \"query\": one self-contained search query of at most 300 characters, in the language of the user's message. Resolve pronouns and references to earlier turns (\"it\", \"that version\", \"and in version X?\") using the conversation. Keep every specific entity: names, projects, notebooks, documents, versions, codes, dates. Drop greetings, filler and instructions about the answer itself (\"search\", \"explain step by step\", \"make a list\"), and ignore pasted text that does not help to find the information.\n\
- \"keywords\": up to 8 exact terms likely to appear verbatim in the relevant text: proper names, project, product, notebook or file names, versions, codes, endpoints, table names, acronyms and distinctive technical terms. One term per item, 1 to 3 words, spelled as the user wrote them. Never generic words such as \"meeting\", \"rule\", \"document\", \"how\", \"reunião\", \"regra\".\n\
- \"dateRange\": only when the message refers to a specific day or period (\"on 14/10\", \"yesterday\", \"last week\", \"in August\"): {{\"from\": \"YYYY-MM-DD\", \"to\": \"YYYY-MM-DD\"}}, inclusive. Numeric dates are day/month. A date without a year means its most recent occurrence not after the current date. Otherwise null."
    )
}

fn rewrite_input(history: &[RagTurn], message: &str) -> String {
    let start = history.len().saturating_sub(REWRITE_HISTORY_TURNS);
    let turns: Vec<String> = history[start..]
        .iter()
        .filter(|t| !t.content.trim().is_empty())
        .map(|t| {
            let who = if t.role == "assistant" { "Assistant" } else { "User" };
            format!("{}: {}", who, trim_to_chars(&t.content, REWRITE_TURN_CHARS))
        })
        .collect();
    let latest = trim_to_chars(message, REWRITE_MESSAGE_CHARS);
    if turns.is_empty() {
        format!("Latest user message:\n{}", latest)
    } else {
        format!("Conversation so far:\n{}\n\nLatest user message:\n{}", turns.join("\n"), latest)
    }
}

// Valida a saída da reescrita: consulta vazia = falha; keywords cortadas;
// dateRange só com duas datas ISO (invertidas são trocadas).
fn parse_rewrite(content: &str) -> Option<Rewrite> {
    let v: serde_json::Value = serde_json::from_str(content.trim()).ok().or_else(|| {
        let (start, end) = (content.find('{')?, content.rfind('}')?);
        serde_json::from_str(content.get(start..=end)?).ok()
    })?;
    let query = trim_to_chars(v.get("query")?.as_str()?, REWRITE_QUERY_MAX_CHARS);
    if query.is_empty() {
        return None;
    }
    let keywords = v
        .get("keywords")
        .and_then(|k| k.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|k| k.as_str())
                .map(|k| trim_to_chars(k, MAX_HEADER_PART_CHARS))
                .filter(|k| !k.is_empty())
                .take(REWRITE_MAX_KEYWORDS)
                .collect()
        })
        .unwrap_or_default();
    let date_range = v.get("dateRange").and_then(|r| {
        let from = r.get("from")?.as_str()?.trim();
        let to = r.get("to")?.as_str()?.trim();
        if !is_iso_date(from) || !is_iso_date(to) {
            return None;
        }
        let (from, to) = if from <= to { (from, to) } else { (to, from) };
        Some(DateRange { from: from.into(), to: to.into() })
    });
    Some(Rewrite { query, keywords, date_range })
}

async fn rewrite_request(
    key: &str,
    model: &str,
    history: &[RagTurn],
    message: &str,
    current_date: &str,
) -> Result<Rewrite, String> {
    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": rewrite_prompt(current_date) },
            { "role": "user", "content": rewrite_input(history, message) },
        ],
        "max_tokens": REWRITE_MAX_TOKENS,
        "temperature": 0,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "rag_query",
                "strict": true,
                "schema": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" },
                        "keywords": { "type": "array", "items": { "type": "string" } },
                        "dateRange": {
                            "anyOf": [
                                {
                                    "type": "object",
                                    "properties": {
                                        "from": { "type": "string" },
                                        "to": { "type": "string" }
                                    },
                                    "required": ["from", "to"],
                                    "additionalProperties": false
                                },
                                { "type": "null" }
                            ]
                        }
                    },
                    "required": ["query", "keywords", "dateRange"],
                    "additionalProperties": false
                }
            }
        },
    });
    let resp = http_client()
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(key)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://monet.local")
        .header("X-Title", "Monet")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network error: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("OpenRouter responded {}", resp.status()));
    }
    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("invalid response: {}", e))?;
    let content = data
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .unwrap_or("");
    parse_rewrite(content).ok_or_else(|| "invalid rewrite JSON".to_string())
}

// Reescreve a mensagem (com o histórico) numa consulta autossuficiente,
// keywords exatas e período. Erro, timeout ou JSON inválido = None.
pub async fn rewrite_query(
    key: &str,
    model: &str,
    history: &[RagTurn],
    message: &str,
    current_date: &str,
) -> Option<Rewrite> {
    match tokio::time::timeout(
        REWRITE_TIMEOUT,
        rewrite_request(key, model, history, message, current_date),
    )
    .await
    {
        Ok(Ok(r)) => Some(r),
        Ok(Err(e)) => {
            eprintln!("rag rewrite failed: {}", e);
            None
        }
        Err(_) => {
            eprintln!("rag rewrite timed out");
            None
        }
    }
}

// Rerank via OpenRouter (Cohere): (índice do documento, relevance_score), na
// ordem devolvida (mais relevante primeiro).
pub async fn rerank(
    key: &str,
    model: &str,
    query: &str,
    documents: &[String],
    top_n: usize,
) -> Result<Vec<(usize, f64)>, String> {
    let body = serde_json::json!({
        "model": model,
        "query": query,
        "documents": documents,
        "top_n": top_n,
    });

    let resp = http_client()
        .post("https://openrouter.ai/api/v1/rerank")
        .bearer_auth(key)
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

    Ok(results
        .iter()
        .filter_map(|r| {
            let index = r.get("index")?.as_u64()? as usize;
            let score = r.get("relevance_score").and_then(|s| s.as_f64()).unwrap_or(0.0);
            Some((index, score))
        })
        .collect())
}

// Trecho do trace: colunas do chunk e as pontuações de cada etapa (None = não
// passou por ela).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagCandidate {
    pub rowid: i64,
    pub document_id: String,
    pub document_name: String,
    pub chunk_index: i64,
    pub content: String,
    pub header: String,
    pub kind: String,
    pub title: String,
    pub doc_date: Option<String>,
    pub folder_label: Option<String>,
    pub section: Option<String>,
    pub page: Option<i64>,
    pub source_url: Option<String>,
    pub vec_rank: Option<usize>,
    pub vec_distance: Option<f64>,
    pub fts_rank: Option<usize>,
    pub bm25: Option<f64>,
    pub rrf: f64,
    pub rerank_score: Option<f64>,
    pub weight: f64,
    pub final_score: Option<f64>,
}

impl From<Candidate> for RagCandidate {
    fn from(c: Candidate) -> Self {
        RagCandidate {
            weight: source_weight(&c.kind),
            rowid: c.rowid,
            document_id: c.document_id,
            document_name: c.document_name,
            chunk_index: c.chunk_index,
            content: c.content,
            header: c.header,
            kind: c.kind,
            title: c.title,
            doc_date: c.doc_date,
            folder_label: c.folder_label,
            section: c.section,
            page: c.page,
            source_url: c.source_url,
            vec_rank: c.vec_rank,
            vec_distance: c.vec_distance,
            fts_rank: c.fts_rank,
            bm25: c.bm25,
            rrf: c.rrf,
            rerank_score: None,
            final_score: None,
        }
    }
}

pub struct RagRequest {
    pub message: String,
    pub history: Vec<RagTurn>,
    pub doc_ids: Vec<String>,
    // `YYYY-MM-DD`: referência para "hoje", "ontem", "14/10".
    pub current_date: String,
    pub rewrite_model: String,
    pub use_rewrite: bool,
    pub use_fts: bool,
    pub use_rerank: bool,
    pub threshold: f64,
    // Filtros da tool `search_knowledge_base`; None = só o escopo.
    pub filters: Option<RagFilters>,
}

// Filtros por metadados do chunk, aplicados em SQL sobre `chunks_meta` antes
// da busca: tipo (note, meeting, document, web), período de `doc_date`
// (inclusivo; sem data = fora) e trecho do nome do caderno/pasta (sem
// diferenciar caixa nem acentos). Campo vazio = sem filtro.
#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagFilters {
    #[serde(default)]
    pub kinds: Vec<String>,
    #[serde(default)]
    pub date_from: Option<String>,
    #[serde(default)]
    pub date_to: Option<String>,
    #[serde(default)]
    pub folder_label_contains: Option<String>,
}

// Minúsculas e sem os acentos do latim comum ("Migração" casa "migracao").
fn fold(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            _ => c,
        })
        .collect()
}

// Documentos do escopo com algum chunk que passa nos filtros. Datas que não
// são `YYYY-MM-DD` são ignoradas; período invertido é trocado.
pub fn filter_doc_ids(
    conn: &Connection,
    doc_ids: &[String],
    filters: &RagFilters,
) -> Result<Vec<String>, String> {
    if doc_ids.is_empty() {
        return Ok(vec![]);
    }
    let kinds: Vec<String> = filters
        .kinds
        .iter()
        .map(|k| k.trim().to_lowercase())
        .filter(|k| !k.is_empty())
        .collect();
    let iso = |d: &Option<String>| {
        d.as_deref().map(str::trim).filter(|d| is_iso_date(d)).map(String::from)
    };
    let (mut date_from, mut date_to) = (iso(&filters.date_from), iso(&filters.date_to));
    if let (Some(from), Some(to)) = (&date_from, &date_to) {
        if from > to {
            std::mem::swap(&mut date_from, &mut date_to);
        }
    }
    let folder = filters
        .folder_label_contains
        .as_deref()
        .map(|f| fold(f.trim()))
        .filter(|f| !f.is_empty());

    let mut sql = format!(
        "SELECT DISTINCT document_id, folder_label FROM chunks_meta WHERE document_id IN ({})",
        placeholders(doc_ids.len())
    );
    let mut binders: Vec<Box<dyn rusqlite::ToSql>> =
        Vec::with_capacity(doc_ids.len() + kinds.len() + 2);
    for id in doc_ids {
        binders.push(Box::new(id.clone()));
    }
    if !kinds.is_empty() {
        sql.push_str(&format!(" AND kind IN ({})", placeholders(kinds.len())));
        for k in kinds {
            binders.push(Box::new(k));
        }
    }
    if let Some(from) = date_from {
        sql.push_str(" AND doc_date >= ?");
        binders.push(Box::new(from));
    }
    if let Some(to) = date_to {
        sql.push_str(" AND doc_date <= ?");
        binders.push(Box::new(to));
    }
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("failed to prepare filter query: {}", e))?;
    let rows = stmt
        .query_map(params_from_iter(binders.iter().map(|b| b.as_ref())), |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
        })
        .map_err(|e| format!("filter query failed: {}", e))?;
    let mut seen: HashSet<String> = HashSet::new();
    let mut out: Vec<String> = Vec::new();
    for row in rows {
        let (id, label) = row.map_err(|e| format!("invalid row: {}", e))?;
        if let Some(f) = &folder {
            if !label.as_deref().is_some_and(|l| fold(l).contains(f.as_str())) {
                continue;
            }
        }
        if seen.insert(id.clone()) {
            out.push(id);
        }
    }
    Ok(out)
}

#[derive(Serialize, Clone, Copy, Default)]
#[serde(rename_all = "camelCase")]
pub struct RagTimings {
    pub rewrite_ms: u64,
    pub embedding_ms: u64,
    pub search_ms: u64,
    pub rerank_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RagResponse {
    pub original_query: String,
    // None = a busca usou a mensagem original (sem reescrita, ou ela falhou).
    pub rewritten_query: Option<String>,
    // Termos enviados ao FTS: keywords da reescrita ou, sem elas, termos da
    // consulta. Vazio sem FTS.
    pub keywords: Vec<String>,
    pub date_range: Option<DateRange>,
    pub rewrite_failed: bool,
    pub rerank_failed: bool,
    // O rerank funcionou e nenhum candidato passou do limiar (ou a busca não
    // achou nada no escopo): a UI avisa em vez de o modelo inventar.
    pub nothing_relevant: bool,
    // Candidatos na ordem da RRF (depois do filtro de período).
    pub candidates: Vec<RagCandidate>,
    // Trechos enviados ao modelo, melhor primeiro.
    pub selected: Vec<RagCandidate>,
    // Tempo de cada etapa (0 = etapa pulada ou não executada).
    pub timings: RagTimings,
}

// Mantém os candidatos sem data e os com data no período. Só vale se algum
// candidato com data cair no período: um período resolvido errado (ex.: ano
// trocado) não pode descartar todas as fontes datadas.
fn apply_date_range(candidates: &mut Vec<RagCandidate>, range: &DateRange) {
    let in_range = |d: &str| d >= range.from.as_str() && d <= range.to.as_str();
    if candidates.iter().any(|c| c.doc_date.as_deref().is_some_and(in_range)) {
        candidates.retain(|c| c.doc_date.as_deref().map_or(true, in_range));
    }
}

// Aplica as pontuações do rerank e os pesos nos candidatos e devolve os
// selecionados: rerank >= limiar, ordenados por `rerank × peso`, até
// MAX_SELECTED.
fn select_reranked(
    candidates: &mut [RagCandidate],
    scores: &[(usize, f64)],
    threshold: f64,
) -> Vec<RagCandidate> {
    for &(i, score) in scores {
        if let Some(c) = candidates.get_mut(i) {
            c.rerank_score = Some(score);
            c.final_score = Some(score * c.weight);
        }
    }
    let mut selected: Vec<RagCandidate> = candidates
        .iter()
        .filter(|c| c.rerank_score.is_some_and(|s| s >= threshold))
        .cloned()
        .collect();
    selected.sort_by(|a, b| {
        b.final_score
            .partial_cmp(&a.final_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    selected.truncate(MAX_SELECTED);
    selected
}

// Pipeline completo. `vec_db` só fica travado durante a busca (síncrona),
// nunca através de um await.
pub async fn retrieve(
    vec_db: &Mutex<Connection>,
    key: &str,
    req: &RagRequest,
) -> Result<RagResponse, String> {
    // Tempo de cada etapa do pipeline (0 = etapa pulada); vai na resposta para
    // a linha de tempos do chat.
    let mut timings = RagTimings::default();
    let original = req.message.trim().to_string();
    // Filtros: o escopo encolhe antes da reescrita e da busca.
    let filtered: Vec<String>;
    let doc_ids: &[String] = match &req.filters {
        Some(f) => {
            let conn = vec_db.lock().map_err(|e| e.to_string())?;
            filtered = filter_doc_ids(&conn, &req.doc_ids, f)?;
            &filtered
        }
        None => &req.doc_ids,
    };
    let searchable = !doc_ids.is_empty() && !original.is_empty();
    let rewrite = if req.use_rewrite && searchable {
        let rewrite_started = std::time::Instant::now();
        let rewrite =
            rewrite_query(key, &req.rewrite_model, &req.history, &original, &req.current_date).await;
        timings.rewrite_ms = rewrite_started.elapsed().as_millis() as u64;
        rewrite
    } else {
        None
    };
    let query = match &rewrite {
        Some(r) => r.query.clone(),
        None => trim_to_chars(&original, FALLBACK_QUERY_CHARS),
    };
    let fts_terms = match &rewrite {
        _ if !req.use_fts => vec![],
        Some(r) if !r.keywords.is_empty() => r.keywords.clone(),
        _ => message_terms(&query),
    };
    let rewrite_failed = req.use_rewrite && searchable && rewrite.is_none();
    let (rewritten_query, date_range) = match rewrite {
        Some(r) => (Some(r.query), r.date_range),
        None => (None, None),
    };
    let mut response = RagResponse {
        original_query: original,
        rewritten_query,
        keywords: fts_terms,
        date_range,
        rewrite_failed,
        rerank_failed: false,
        nothing_relevant: false,
        candidates: vec![],
        selected: vec![],
        timings: RagTimings::default(),
    };
    if !searchable {
        // Escopo com documentos, mas nenhum passou nos filtros.
        response.nothing_relevant = req.filters.is_some()
            && !req.doc_ids.is_empty()
            && !response.original_query.is_empty();
        response.timings = timings;
        return Ok(response);
    }

    let embedding_started = std::time::Instant::now();
    let embedding = embed_query(key, &query).await?;
    timings.embedding_ms = embedding_started.elapsed().as_millis() as u64;
    let search_started = std::time::Instant::now();
    let found = {
        let conn = vec_db.lock().map_err(|e| e.to_string())?;
        hybrid_search(&conn, doc_ids, &embedding, &response.keywords, HYBRID_K_EACH, HYBRID_POOL)?
    };
    timings.search_ms = search_started.elapsed().as_millis() as u64;
    let mut candidates: Vec<RagCandidate> = found.into_iter().map(RagCandidate::from).collect();
    if let Some(range) = &response.date_range {
        apply_date_range(&mut candidates, range);
    }
    if candidates.is_empty() {
        response.nothing_relevant = true;
        response.timings = timings;
        return Ok(response);
    }

    let scores = if req.use_rerank {
        let rerank_started = std::time::Instant::now();
        let docs: Vec<String> = candidates
            .iter()
            .map(|c| trim_to_chars(&format!("{}\n{}", c.header, c.content), RERANK_DOC_CHARS))
            .collect();
        // top_n = todos: o custo é o mesmo e o trace mostra o rerank de cada
        // candidato; a seleção corta em MAX_SELECTED.
        let call = rerank(key, RERANK_MODEL, &query, &docs, docs.len());
        let result = match tokio::time::timeout(RERANK_TIMEOUT, call).await {
            Ok(Ok(scores)) => Some(scores),
            Ok(Err(e)) => {
                eprintln!("rag rerank failed: {}", e);
                None
            }
            Err(_) => {
                eprintln!("rag rerank timed out");
                None
            }
        };
        timings.rerank_ms = rerank_started.elapsed().as_millis() as u64;
        result
    } else {
        None
    };
    match scores {
        Some(scores) => {
            response.selected = select_reranked(&mut candidates, &scores, req.threshold);
            response.nothing_relevant = response.selected.is_empty();
        }
        None => {
            response.rerank_failed = req.use_rerank;
            response.selected = candidates.iter().take(RRF_FALLBACK_SELECTED).cloned().collect();
        }
    }
    response.candidates = candidates;
    response.timings = timings;
    Ok(response)
}

// Chunks por rowid, na ordem pedida (reaproveitar os trechos do turno
// anterior), só dos documentos do escopo atual: a visibilidade pode ter mudado
// e um rowid apagado pode ter sido reaproveitado por outro documento. Rowids
// que sumiram numa reindexação são ignorados.
pub fn get_chunks(
    conn: &Connection,
    rowids: &[i64],
    doc_ids: &[String],
) -> Result<Vec<RagCandidate>, String> {
    let scope: HashSet<&str> = doc_ids.iter().map(String::as_str).collect();
    let mut by_rowid: HashMap<i64, Candidate> = chunk_rows(conn, rowids)?
        .into_iter()
        .filter(|c| scope.contains(c.document_id.as_str()))
        .map(|c| (c.rowid, c))
        .collect();
    Ok(rowids
        .iter()
        .filter_map(|id| by_rowid.remove(id))
        .map(RagCandidate::from)
        .collect())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RagScope {
    #[serde(default)]
    ids: Vec<String>,
    #[serde(default)]
    notebook_id: Option<String>,
    #[serde(default)]
    exclude_note_id: Option<String>,
    #[serde(default)]
    include_ai_folders: bool,
}

impl RagScope {
    fn resolve(&self, doc_conn: &Connection) -> Result<Vec<String>, String> {
        resolve_scope(
            doc_conn,
            &self.ids,
            self.notebook_id.as_deref(),
            self.exclude_note_id.as_deref(),
            self.include_ai_folders,
        )
    }
}

#[tauri::command]
pub(crate) async fn rag_retrieve(
    app: AppHandle,
    doc_state: State<'_, DocDb>,
    vec_state: State<'_, VecDb>,
    scope: RagScope,
    message: String,
    history: Vec<RagTurn>,
    rewrite_model: Option<String>,
    filters: Option<RagFilters>,
) -> Result<RagResponse, String> {
    let key = crate::read_key(&app, "openrouter_key")
        .ok_or_else(|| "OPENROUTER_KEY_MISSING".to_string())?;
    let (doc_ids, current_date) = with_doc_db(&app, &doc_state, |conn| {
        Ok((scope.resolve(conn)?, local_today(conn)?))
    })?;
    let rewrite_model = rewrite_model
        .map(|m| m.trim().to_string())
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| DEFAULT_REWRITE_MODEL.to_string());
    let req = RagRequest {
        message,
        history,
        doc_ids,
        current_date,
        rewrite_model,
        use_rewrite: true,
        use_fts: true,
        use_rerank: true,
        threshold: RERANK_THRESHOLD,
        filters,
    };
    retrieve(&vec_state.0, &key, &req).await
}

#[tauri::command]
pub(crate) async fn rag_get_chunks(
    app: AppHandle,
    doc_state: State<'_, DocDb>,
    vec_state: State<'_, VecDb>,
    scope: RagScope,
    rowids: Vec<i64>,
) -> Result<Vec<RagCandidate>, String> {
    let doc_ids = with_doc_db(&app, &doc_state, |conn| scope.resolve(conn))?;
    let conn = vec_state.0.lock().map_err(|e| e.to_string())?;
    get_chunks(&conn, &rowids, &doc_ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(name: &str, path: &str, mime: &str, parent_origin: Option<&str>) -> DocRow {
        DocRow {
            name: name.into(),
            path: path.into(),
            mime: mime.into(),
            file_date: Some("2026-10-01".into()),
            parent_name: Some("MONET-RAG".into()),
            parent_origin: parent_origin.map(String::from),
            alias: None,
        }
    }

    #[test]
    fn meeting_date_comes_from_folder() {
        let (date, title) =
            meeting_from_path(r"C:\x\ACME\MEETINGS\25-05-2026_17-18-52\summary.md", "summary.md")
                .unwrap();
        assert_eq!(date, "2026-05-25");
        assert_eq!(title, "MEETINGS 25/05/2026 17:18 — summary");
        assert!(meeting_from_path(r"C:\x\ACME\notes\summary.md", "summary.md").is_none());
        assert!(meeting_from_path(r"C:\x\25-05-2026\a.md", "a.md").is_none());

        let mut r = row("summary.md", r"C:\x\ACME\MEETINGS\25-05-2026_17-18-52\summary.md", "text/markdown", Some("user"));
        r.alias = Some("Acme meetings".into());
        let meta = derive_meta(&r, "# Summary\n\nbody");
        assert_eq!(meta.kind, "meeting");
        assert_eq!(meta.doc_date.as_deref(), Some("2026-05-25"));
        assert_eq!(meta.folder_label.as_deref(), Some("Acme meetings"));
    }

    #[test]
    fn web_header_is_parsed() {
        let text = "# Example page\n\nSource: https://example.com/a\nRetrieved: 2026-08-07\n\nbody";
        let w = parse_web_header(text).unwrap();
        assert_eq!(w.title, "Example page");
        assert_eq!(w.source, "https://example.com/a");
        assert_eq!(w.retrieved.as_deref(), Some("2026-08-07"));
        assert!(parse_web_header("# Title\n\nbody\nSource: x").is_none());

        let meta = derive_meta(&row("page.md", r"C:\w\page.md", "text/markdown", Some("ai")), text);
        assert_eq!(meta.kind, "web");
        assert_eq!(meta.title, "Example page");
        assert_eq!(meta.source_url.as_deref(), Some("https://example.com/a"));
        assert_eq!(meta.doc_date.as_deref(), Some("2026-08-07"));

        // PDF salvo pelo bibliotecário: sem cabeçalho, título = nome do arquivo.
        let pdf = derive_meta(&row("paper.pdf", r"C:\w\paper.pdf", "application/pdf", Some("ai")), "Abstract");
        assert_eq!((pdf.kind, pdf.title.as_str(), pdf.doc_date), ("web", "paper.pdf", None));
    }

    #[test]
    fn document_title_and_date() {
        let md = derive_meta(&row("spec.md", r"C:\d\spec.md", "text/markdown", Some("user")), "\n# Spec\n\ntext");
        assert_eq!(md.kind, "document");
        assert_eq!(md.title, "Spec");
        assert_eq!(md.doc_date.as_deref(), Some("2026-10-01"));
        assert_eq!(md.folder_label.as_deref(), Some("MONET-RAG"));
        let txt = derive_meta(&row("log.txt", r"C:\d\log.txt", "text/plain", Some("user")), "# not a title");
        assert_eq!(txt.title, "log.txt");
    }

    #[test]
    fn header_omits_empty_parts() {
        let meta = DocMeta {
            kind: "document",
            title: "Manual".into(),
            doc_date: None,
            folder_label: None,
            source_url: None,
            archived: None,
        };
        assert_eq!(build_header(&meta, None, None), "[Manual · document]");
        assert_eq!(build_header(&meta, Some(""), Some(12)), "[Manual · document · p. 12]");

        let note = note_meta("Spec", "Notes — Migration", Some("2026-10-17"), None);
        assert_eq!(
            build_header(&note, Some("Versions"), None),
            "[Spec · note · 2026-10-17 · Notes — Migration · Versions]"
        );
        assert_eq!(meta_sig(&note), "[Spec · note · 2026-10-17 · Notes — Migration]");
        assert_eq!(note_meta("A", "", Some("17/10/2026"), None).doc_date, None);

        // Nota arquivada: a data entra no cabeçalho antes da seção e muda a
        // assinatura (reembede no próximo upsert).
        let archived =
            note_meta("Spec", "Notes — Migration", Some("2026-10-17"), Some("2026-10-20"));
        assert_eq!(
            build_header(&archived, None, None),
            "[Spec · note · 2026-10-17 · Notes — Migration · Archived: 2026-10-20]"
        );
        assert_ne!(meta_sig(&archived), meta_sig(&note));
    }

    // Banco em memória com o schema do vec db (vec_chunks, chunks_meta e
    // chunks_fts via ensure_fts). Linha: (document_id, chunk_index, header,
    // content); o embedding da linha i é o vetor unitário na dimensão i.
    fn test_db(rows: &[(&str, i64, &str, &str)]) -> Connection {
        register_auto_extension();
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(&format!(
            "CREATE VIRTUAL TABLE vec_chunks USING vec0(embedding float[{}]);
             CREATE TABLE chunks_meta (
                 rowid INTEGER PRIMARY KEY, document_id TEXT NOT NULL, source_name TEXT NOT NULL,
                 content TEXT NOT NULL, chunk_index INTEGER NOT NULL, header TEXT NOT NULL DEFAULT '',
                 kind TEXT NOT NULL DEFAULT 'document', title TEXT NOT NULL DEFAULT '', doc_date TEXT,
                 folder_label TEXT, section TEXT, page INTEGER, source_url TEXT
             );",
            EMBEDDING_DIM
        ))
        .unwrap();
        for (i, (doc, idx, header, content)) in rows.iter().enumerate() {
            conn.execute(
                "INSERT INTO chunks_meta(rowid, document_id, source_name, content, chunk_index, header)
                 VALUES (?1, ?2, ?2, ?3, ?4, ?5)",
                params![i as i64 + 1, doc, content, idx, header],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO vec_chunks(rowid, embedding) VALUES (?1, ?2)",
                params![i as i64 + 1, unit(i).as_bytes()],
            )
            .unwrap();
        }
        crate::vec_db::ensure_fts(&conn).unwrap();
        conn
    }

    fn unit(i: usize) -> Vec<f32> {
        let mut v = vec![0.0; EMBEDDING_DIM];
        v[i] = 1.0;
        v
    }

    fn strings(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    fn fts_docs(conn: &Connection, scope: &[&str], terms: &[String]) -> Vec<String> {
        let expr = fts_query(terms).expect("searchable terms");
        fts_search(conn, &strings(scope), &expr, 10)
            .unwrap()
            .into_iter()
            .map(|(rowid, _)| {
                conn.query_row("SELECT document_id FROM chunks_meta WHERE rowid = ?1", [rowid], |r| r.get(0))
                    .unwrap()
            })
            .collect()
    }

    #[test]
    fn fts_query_quotes_every_term() {
        let terms = strings(&["a", "say \"hi\"", "x AND y", "***", "9.0.0.1", "SAY \"HI\""]);
        assert_eq!(
            fts_query(&terms).as_deref(),
            Some("\"say \"\"hi\"\"\" OR \"x AND y\" OR \"9.0.0.1\"")
        );
        assert_eq!(fts_query(&strings(&["?", " "])), None);
        let many: Vec<String> = (0..20).map(|i| format!("term{}", i)).collect();
        assert_eq!(fts_query(&many).unwrap().matches(" OR ").count(), 11);
    }

    #[test]
    fn message_terms_drop_stopwords_and_edge_punctuation() {
        assert_eq!(
            message_terms("Qual é a especificação da Migração? Versão \"9.0.0.1\", e a 2.1"),
            vec!["especificação", "migração", "versão", "9.0.0.1", "2.1"]
        );
    }

    #[test]
    fn fts_ignores_accents_and_case() {
        let conn = test_db(&[
            ("note:spec", 0, "[Especificação · note · 2026-10-17 · Notes — Migração]", "Node 24\n\nAngular 21"),
            ("doc:other", 0, "[Other · document]", "nothing relevant here"),
            ("doc:plain", 0, "[Plain · document]", "ESPECIFICACAO sem acento"),
        ]);
        let all = ["note:spec", "doc:other", "doc:plain"];
        let found = fts_docs(&conn, &all, &strings(&["especificacao"]));
        assert!(found.contains(&"note:spec".to_string()) && found.contains(&"doc:plain".to_string()));
        assert!(!found.contains(&"doc:other".to_string()));
        // Título e caderno estão só no cabeçalho.
        assert_eq!(fts_docs(&conn, &all, &message_terms("o que tem na migracao?")), vec!["note:spec"]);
        assert_eq!(fts_docs(&conn, &all, &strings(&["Especificação"])).len(), 2);
    }

    #[test]
    fn fts_matches_dotted_versions_as_phrase() {
        let conn = test_db(&[
            ("doc:a", 0, "[A · document]", "Upgrade to 9.0.0.1 finished."),
            ("doc:b", 0, "[B · document]", "Versions 9.0.1.0 and 1.0.0.9 only."),
        ]);
        assert_eq!(fts_docs(&conn, &["doc:a", "doc:b"], &strings(&["9.0.0.1"])), vec!["doc:a"]);
    }

    #[test]
    fn fts_survives_query_syntax_in_terms() {
        let conn = test_db(&[("doc:a", 0, "[A · document]", "say \"hi\" (NEAR the end) col:value -x ^start")]);
        for term in ["say \"hi\"", "NEAR(", "col:value", "-x", "^start", "a*", "\"unbalanced", "AND OR NOT"] {
            let expr = fts_query(&strings(&[term])).unwrap();
            fts_search(&conn, &strings(&["doc:a"]), &expr, 5).unwrap_or_else(|e| panic!("{}: {}", term, e));
        }
        assert_eq!(fts_docs(&conn, &["doc:a"], &strings(&["say \"hi\""])), vec!["doc:a"]);
        assert_eq!(fts_query(&strings(&["((", "\"\""])), None);
    }

    #[test]
    fn ensure_fts_backfills_once_and_resyncs() {
        let conn = test_db(&[("doc:a", 0, "[A · document]", "alpha"), ("doc:b", 0, "[B · document]", "beta")]);
        // test_db já fez o backfill: a 2ª chamada não refaz.
        assert!(!crate::vec_db::ensure_fts(&conn).unwrap());
        // Chunk trocado sem passar pelo FTS (versão antiga do app): refaz.
        conn.execute("DELETE FROM chunks_meta WHERE rowid = 2", []).unwrap();
        conn.execute(
            "INSERT INTO chunks_meta(rowid, document_id, source_name, content, chunk_index, header)
             VALUES (3, 'doc:b', 'doc:b', 'gamma', 0, '[B · document]')",
            [],
        )
        .unwrap();
        assert!(crate::vec_db::ensure_fts(&conn).unwrap());
        assert!(!crate::vec_db::ensure_fts(&conn).unwrap());
        let both = ["doc:a", "doc:b"];
        assert_eq!(fts_docs(&conn, &both, &strings(&["gamma"])), vec!["doc:b"]);
        assert!(fts_docs(&conn, &both, &strings(&["beta"])).is_empty());
    }

    #[test]
    fn hybrid_fuses_both_sides_within_scope() {
        let conn = test_db(&[
            ("doc:vec", 0, "[Vector match · document]", "unrelated words"),
            ("doc:vec", 1, "[Vector match · document]", "neighbour of the vector match"),
            ("note:spec", 0, "[Especificação · note · Notes — Migração]", "Node 24"),
            ("doc:out", 0, "[Especificação · document]", "out of scope"),
        ]);
        let scope = strings(&["doc:vec", "note:spec"]);
        let terms = message_terms("especificacao");
        // Distâncias: vetor 0,5; nota 1,12; vizinho 1,5.
        let mut query = unit(0);
        query[2] = 0.5;
        let got = hybrid_search(&conn, &scope, &query, &terms, 40, 40).unwrap();
        let ids: Vec<(&str, i64)> = got.iter().map(|c| (c.document_id.as_str(), c.chunk_index)).collect();
        assert_eq!(ids.len(), 3, "out-of-scope chunk must not appear: {:?}", ids);
        // A nota soma 1/61 (1ª no FTS) + 1/62 (2ª no KNN); o vetor só 1/61.
        assert_eq!(ids[0], ("note:spec", 0));
        assert_eq!(ids[1], ("doc:vec", 0));
        // O vizinho (chunk 1) vem por último, pelo fallback.
        assert_eq!(ids[2], ("doc:vec", 1));
        let spec = &got[0];
        assert_eq!((spec.fts_rank, spec.vec_rank), (Some(1), Some(2)));
        assert!(spec.bm25.is_some() && got[1].fts_rank.is_none());
        // Pool menor que o total: o vizinho sai.
        let top2 = hybrid_search(&conn, &scope, &query, &terms, 40, 2).unwrap();
        assert_eq!(top2.len(), 2);
        assert!(top2.iter().all(|c| c.chunk_index == 0));
        // Sem termos pesquisáveis, só KNN.
        let knn_only = hybrid_search(&conn, &scope, &query, &[], 40, 40).unwrap();
        assert!(knn_only.iter().all(|c| c.fts_rank.is_none()));
    }

    fn turn(role: &str, content: &str) -> RagTurn {
        RagTurn { role: role.into(), content: content.into() }
    }

    #[test]
    fn rewrite_output_is_validated() {
        let r = parse_rewrite(
            r#"{"query":"especificação da Migração","keywords":["Especificação"," ","Migração"],"dateRange":null}"#,
        )
        .unwrap();
        assert_eq!(r.query, "especificação da Migração");
        assert_eq!(r.keywords, vec!["Especificação", "Migração"]);
        assert_eq!(r.date_range, None);

        // Markdown em volta, período invertido e consulta longa demais.
        let long = "x".repeat(500);
        let r = parse_rewrite(&format!(
            "```json\n{{\"query\":\"{}\",\"keywords\":[],\"dateRange\":{{\"from\":\"2026-10-17\",\"to\":\"2026-10-11\"}}}}\n```",
            long
        ))
        .unwrap();
        assert_eq!(r.query.chars().count(), REWRITE_QUERY_MAX_CHARS);
        assert_eq!(r.date_range, Some(DateRange { from: "2026-10-11".into(), to: "2026-10-17".into() }));

        // Data fora do formato descarta só o período.
        let r = parse_rewrite(r#"{"query":"q","keywords":[],"dateRange":{"from":"14/10","to":"14/10"}}"#).unwrap();
        assert_eq!(r.date_range, None);
        assert_eq!(parse_rewrite(r#"{"query":"  ","keywords":[]}"#), None);
        assert_eq!(parse_rewrite("not json"), None);
        let many: Vec<String> = (0..20).map(|i| format!("\"k{}\"", i)).collect();
        let r = parse_rewrite(&format!("{{\"query\":\"q\",\"keywords\":[{}]}}", many.join(","))).unwrap();
        assert_eq!(r.keywords.len(), REWRITE_MAX_KEYWORDS);
    }

    #[test]
    fn rewrite_input_keeps_last_turns_and_cuts_long_text() {
        let history: Vec<RagTurn> = (0..10)
            .map(|i| turn(if i % 2 == 0 { "user" } else { "assistant" }, &format!("turn{} {}", i, "y".repeat(3000))))
            .collect();
        let pasted = "z".repeat(10_000);
        let input = rewrite_input(&history, &pasted);
        assert!(!input.contains("turn3 ") && input.contains("turn4 ") && input.contains("turn9 "));
        assert!(input.contains("User: turn4") && input.contains("Assistant: turn5"));
        assert_eq!(input.matches('y').count(), 6 * (REWRITE_TURN_CHARS - "turnN ".len()));
        assert_eq!(input.matches('z').count(), REWRITE_MESSAGE_CHARS);
        assert_eq!(rewrite_input(&[], "oi"), "Latest user message:\noi");
    }

    #[test]
    fn weekday_names() {
        assert_eq!(weekday("2026-10-18"), Some("Sunday"));
        assert_eq!(weekday("2026-10-15"), Some("Thursday"));
        assert_eq!(weekday("2024-02-29"), Some("Thursday"));
        assert_eq!(weekday("18/10/2026"), None);
        assert!(rewrite_prompt("2026-10-18").starts_with("Current date: 2026-10-18 (Sunday)."));
    }

    fn cand(rowid: i64, doc: &str, kind: &str, date: Option<&str>) -> RagCandidate {
        RagCandidate {
            rowid,
            document_id: doc.into(),
            document_name: doc.into(),
            chunk_index: 0,
            content: String::new(),
            header: String::new(),
            kind: kind.into(),
            title: String::new(),
            doc_date: date.map(String::from),
            folder_label: None,
            section: None,
            page: None,
            source_url: None,
            vec_rank: None,
            vec_distance: None,
            fts_rank: None,
            bm25: None,
            rrf: 0.0,
            rerank_score: None,
            weight: source_weight(kind),
            final_score: None,
        }
    }

    #[test]
    fn date_range_keeps_undated_and_never_empties_dated() {
        let range = DateRange { from: "2026-10-14".into(), to: "2026-10-14".into() };
        let mut c = vec![
            cand(1, "a", "meeting", Some("2026-10-14")),
            cand(2, "b", "meeting", Some("2026-06-18")),
            cand(3, "c", "document", None),
        ];
        apply_date_range(&mut c, &range);
        assert_eq!(c.iter().map(|c| c.rowid).collect::<Vec<_>>(), vec![1, 3]);

        // Nenhum candidato datado no período: o filtro é ignorado.
        let mut c = vec![cand(1, "a", "meeting", Some("2025-10-14")), cand(2, "b", "document", None)];
        apply_date_range(&mut c, &range);
        assert_eq!(c.len(), 2);
    }

    #[test]
    fn rerank_selection_applies_threshold_and_weights() {
        let mut c = vec![
            cand(1, "web", "web", None),
            cand(2, "note", "note", None),
            cand(3, "doc", "document", None),
            cand(4, "low", "note", None),
        ];
        // Web com rerank maior perde para a nota pelo peso (0,63 × 0,6).
        let scores = vec![(0, 0.9), (1, 0.7), (2, 0.5), (3, 0.1), (9, 0.99)];
        let selected = select_reranked(&mut c, &scores, 0.2);
        assert_eq!(selected.iter().map(|c| c.rowid).collect::<Vec<_>>(), vec![2, 1, 3]);
        assert_eq!(c[0].final_score, Some(0.9 * 0.7));
        assert_eq!(c[3].rerank_score, Some(0.1));

        // Todos abaixo do limiar: nada selecionado.
        let mut c = vec![cand(1, "a", "note", None)];
        assert!(select_reranked(&mut c, &[(0, 0.05)], 0.2).is_empty());

        // Teto de selecionados.
        let mut c: Vec<RagCandidate> = (0..20).map(|i| cand(i, "n", "note", None)).collect();
        let scores: Vec<(usize, f64)> = (0..20).map(|i| (i, 0.9)).collect();
        assert_eq!(select_reranked(&mut c, &scores, 0.2).len(), MAX_SELECTED);
    }

    #[test]
    fn get_chunks_keeps_requested_order() {
        let conn = test_db(&[
            ("doc:a", 0, "[A · document]", "alpha"),
            ("doc:b", 0, "[B · document]", "beta"),
            ("doc:c", 0, "[C · document]", "gamma"),
        ]);
        let all = strings(&["doc:a", "doc:b", "doc:c"]);
        let got = get_chunks(&conn, &[3, 99, 1], &all).unwrap();
        assert_eq!(got.iter().map(|c| c.rowid).collect::<Vec<_>>(), vec![3, 1]);
        assert_eq!(got[0].content, "gamma");
        assert!(get_chunks(&conn, &[], &all).unwrap().is_empty());
    }

    #[test]
    fn get_chunks_drops_rowids_outside_the_scope() {
        let conn = test_db(&[
            ("doc:a", 0, "[A · document]", "alpha"),
            ("doc:b", 0, "[B · document]", "beta"),
            ("doc:c", 0, "[C · document]", "gamma"),
        ]);
        // doc:b saiu do escopo (visibilidade mudou, ou o rowid 2 agora é de
        // outro documento): o trecho não volta ao modelo.
        let got = get_chunks(&conn, &[1, 2, 3], &strings(&["doc:a", "doc:c"])).unwrap();
        assert_eq!(got.iter().map(|c| c.rowid).collect::<Vec<_>>(), vec![1, 3]);
        assert!(get_chunks(&conn, &[1, 2, 3], &[]).unwrap().is_empty());
    }

    #[test]
    fn hybrid_search_falls_back_to_knn_when_fts_fails() {
        let conn = test_db(&[
            ("doc:a", 0, "[A · document]", "alpha"),
            ("doc:b", 0, "[B · document]", "beta"),
        ]);
        conn.execute_batch("DROP TABLE chunks_fts;").unwrap();
        let found = hybrid_search(
            &conn,
            &strings(&["doc:a", "doc:b"]),
            &unit(1),
            &strings(&["beta"]),
            HYBRID_K_EACH,
            HYBRID_POOL,
        )
        .unwrap();
        assert_eq!(found[0].document_id, "doc:b");
        assert!(found.iter().all(|c| c.fts_rank.is_none()));
    }

    #[test]
    fn filters_narrow_scope_by_kind_date_and_folder() {
        let conn = test_db(&[
            ("note:a", 0, "", "a"),
            ("note:a", 1, "", "a2"),
            ("meet:b", 0, "", "b"),
            ("meet:c", 0, "", "c"),
            ("doc:d", 0, "", "d"),
        ]);
        let meta = [
            (1, "note", Some("2026-10-14"), "Notes — Migração"),
            (2, "note", Some("2026-10-14"), "Notes — Migração"),
            (3, "meeting", Some("2026-10-02"), "Reuniões"),
            (4, "meeting", Some("2026-06-18"), "Reuniões"),
            (5, "document", None, "DOCS — Monet"),
        ];
        for (rowid, kind, date, folder) in meta {
            conn.execute(
                "UPDATE chunks_meta SET kind = ?1, doc_date = ?2, folder_label = ?3 WHERE rowid = ?4",
                params![kind, date, folder, rowid],
            )
            .unwrap();
        }
        let scope = strings(&["note:a", "meet:b", "meet:c", "doc:d"]);
        let run = |f: RagFilters| {
            let mut ids = filter_doc_ids(&conn, &scope, &f).unwrap();
            ids.sort();
            ids
        };

        assert_eq!(run(RagFilters::default()).len(), 4);
        assert_eq!(
            run(RagFilters { kinds: strings(&["Meeting"]), ..Default::default() }),
            strings(&["meet:b", "meet:c"])
        );
        // Período invertido é trocado; sem data fica fora.
        assert_eq!(
            run(RagFilters {
                date_from: Some("2026-10-31".into()),
                date_to: Some("2026-10-01".into()),
                ..Default::default()
            }),
            strings(&["meet:b", "note:a"])
        );
        // Caderno sem acento e sem caixa; data inválida é ignorada.
        assert_eq!(
            run(RagFilters {
                folder_label_contains: Some("MIGRACAO".into()),
                date_from: Some("14/10".into()),
                ..Default::default()
            }),
            strings(&["note:a"])
        );
        // Fora do escopo nunca entra.
        assert!(filter_doc_ids(&conn, &strings(&["doc:d"]), &RagFilters {
            kinds: strings(&["note"]),
            ..Default::default()
        })
        .unwrap()
        .is_empty());
    }
}
