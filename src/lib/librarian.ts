import { invoke } from '@tauri-apps/api/core'
import { tavilyExtract, hashUrlToFilename, type SearchResult } from './search'

// ─── Wrappers dos comandos Rust do bibliotecário ─────────────────────────────
// Os parâmetros snake_case do Rust (candidates_block/sources_block/current_date)
// chegam como camelCase no invoke — Tauri faz a conversão automaticamente.

export async function librarianTriage(
  question: string,
  candidatesBlock: string,
  currentDate: string,
): Promise<string[]> {
  return invoke<string[]>('librarian_triage', { question, candidatesBlock, currentDate })
}

export async function librarianJudge(
  question: string,
  sourcesBlock: string,
  currentDate: string,
): Promise<string[]> {
  return invoke<string[]>('librarian_judge', { question, sourcesBlock, currentDate })
}

export async function librarianAcademicQuery(
  question: string,
  currentDate: string,
): Promise<string[]> {
  return invoke<string[]>('librarian_academic_query', { question, currentDate })
}

export async function librarianAcademicRelevance(
  question: string,
  candidatesBlock: string,
  currentDate: string,
): Promise<string[]> {
  return invoke<string[]>('librarian_academic_relevance', { question, candidatesBlock, currentDate })
}

export async function librarianFetchAndSavePdf(
  folderId: string,
  url: string,
  filename: string,
): Promise<void> {
  await invoke('librarian_fetch_and_save_pdf', { folderId, url, filename })
}

// ─── APIs acadêmicas (Crossref / Unpaywall) — frontend fetch, CORS aberto ─────
// Crossref e Unpaywall enviam Access-Control-Allow-Origin: * (verificado), então
// as chamadas de metadados JSON vivem no frontend. Só o download binário do PDF
// vai para o Rust (librarian_fetch_and_save_pdf). O polite pool do Crossref é
// alcançado pelo `mailto=` no query string — o header User-Agent é forbidden no
// webview e seria descartado; o UA real só existe no download em Rust.

const ACADEMIC_EMAIL = 'luizvilarinho@gmail.com'

interface CrossrefCandidate {
  doi: string
  title: string
  year: number | null
  type: string
  abstract: string
}

// Remove tags JATS-XML do abstract do Crossref antes de mandar ao modelo.
function stripJats(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function crossrefSearch(query: string): Promise<CrossrefCandidate[]> {
  try {
    const url =
      `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}` +
      `&rows=8&select=DOI,title,published,type,abstract&mailto=${ACADEMIC_EMAIL}`
    const resp = await fetch(url)
    if (!resp.ok) return []
    const data = await resp.json()
    const items = data?.message?.items
    if (!Array.isArray(items)) return []
    const out: CrossrefCandidate[] = []
    for (const it of items) {
      const doi = typeof it?.DOI === 'string' ? it.DOI : ''
      const title = Array.isArray(it?.title) ? (it.title[0] ?? '') : ''
      if (!doi || !title) continue
      const yearRaw = it?.published?.['date-parts']?.[0]?.[0]
      const year = typeof yearRaw === 'number' ? yearRaw : null
      const type = typeof it?.type === 'string' ? it.type : ''
      const abstract = typeof it?.abstract === 'string' ? stripJats(it.abstract) : ''
      out.push({ doi, title, year, type, abstract })
    }
    return out
  } catch {
    return []
  }
}

async function unpaywallResolve(doi: string): Promise<string | null> {
  try {
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${ACADEMIC_EMAIL}`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const data = await resp.json()
    if (data?.is_oa !== true) return null
    const best = data?.best_oa_location?.url_for_pdf
    if (typeof best === 'string' && best) return best
    const locations = data?.oa_locations
    if (Array.isArray(locations)) {
      for (const loc of locations) {
        const pdf = loc?.url_for_pdf
        if (typeof pdf === 'string' && pdf) return pdf
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── Filename acadêmico: {ano}_{slug}.pdf ────────────────────────────────────
// Slug seguro para o gate do Rust (sem separadores de path; safe_name === filename)
// e sem colisão com os `.md` do web (extensões distintas).
function academicSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'paper'
}

function academicFilename(year: number | null, title: string): string {
  return `${year ?? 'unknown'}_${academicSlug(title)}.pdf`
}

// ─── Estado in-flight (singleton de módulo) ──────────────────────────────────
// Vive no módulo, não em ref de hook: cada painel tem sua própria instância de
// useChat, então um Set/Map de módulo é o único estado compartilhado por todo o
// app. `inFlightUrls` guarda chaves chaveadas POR PASTA
// (`${chatFolderId}:${filename}` no web e `${chatFolderId}:doi:...`/filename no
// acadêmico) sendo processadas — o prefixo de pasta garante que dois pipelines
// de pastas distintas processando a MESMA URL não se falso-deduplicam (cada
// pasta grava na sua própria KB); `folderChains` serializa os pipelines por
// chatFolderId para evitar extract duplicado, escrita concorrente e scan storm.
const inFlightUrls = new Set<string>()
const folderChains = new Map<string, Promise<void>>()

export interface LibrarianInput {
  chatFolderId: string // ChatFolder.id (para documentsEnsureAiFolder)
  folderName: string
  question: string
  searchResults: SearchResult[]
  citedUrls: string[] // URLs citadas no texto final (best-effort)
  onSaved: (count: number) => void // toast
  onFolderRegistered: (aiFolderId: string) => void // add à visibleDocumentIds
}

// Enfileira um pipeline serializado por pasta. Fire-and-forget: não retorna a
// promise ao caller.
export function enqueueLibrarian(input: LibrarianInput): void {
  const prev = folderChains.get(input.chatFolderId) ?? Promise.resolve()
  const next = prev
    .then(() => runPipeline(input))
    .catch((e) => console.warn('librarian pipeline failed', e))
  folderChains.set(input.chatFolderId, next)
  void next.finally(() => {
    if (folderChains.get(input.chatFolderId) === next) {
      folderChains.delete(input.chatFolderId)
    }
  })
}

async function runPipeline(input: LibrarianInput): Promise<void> {
  // a. Localizar a AI folder existente (sem criar) para dedupe em disco. A busca
  // é pelo caminho determinístico (…/web-research/<chatFolderId>, origin='ai'),
  // espelhando documents_ensure_ai_folder — NÃO pelo snapshot de
  // visibleDocumentIds do turno, que fica defasado nos turnos iniciais (antes de
  // onFolderRegistered propagar o id ao estado React) e causaria re-extract caro
  // + toast inflado ao não achar a pasta que já existe em disco.
  const { documentsListGlobal } = await import('./documents')
  const allDocs = await documentsListGlobal()
  const aiFolderSuffix = `web-research/${input.chatFolderId}`
  const existingAiFolder = allDocs.find(
    (d) =>
      d.docType === 'folder' &&
      d.origin === 'ai' &&
      (d.originalPath ?? '').replace(/\\/g, '/').endsWith(aiFolderSuffix),
  )
  const existingFilenames = new Set<string>()
  if (existingAiFolder) {
    for (const d of allDocs) {
      if (d.parentFolderId === existingAiFolder.id) existingFilenames.add(d.name)
    }
  }

  // Estado compartilhado entre as fases web e acadêmica. `claimed` acumula os
  // filenames/chaves reivindicados no inFlightUrls por ambas as fases; o finally
  // os libera de uma vez. `aiFolderId` é criado preguiçosamente por ensureFolder
  // (só quando há ≥1 arquivo a gravar, de qualquer fase).
  const claimed: string[] = []
  let savedCount = 0
  let aiFolderId: string | null = null
  const currentDate = new Date().toISOString().slice(0, 10)

  const ensureFolder = async (): Promise<string> => {
    if (!aiFolderId) {
      const { documentsEnsureAiFolder } = await import('./documents')
      aiFolderId = await documentsEnsureAiFolder(input.chatFolderId, input.folderName)
      input.onFolderRegistered(aiFolderId)
    }
    return aiFolderId
  }

  try {
    // Fases sequenciais: web (fonte primária) e acadêmica (complementar). Cada
    // fase tem early-exits internos que encerram só a própria fase; o try/catch
    // por fase isola também exceções — uma falha na fase web não impede a
    // acadêmica (são complementares) e vice-versa.
    try {
      savedCount += await runWebPhase(input, existingFilenames, claimed, ensureFolder, currentDate)
    } catch (e) {
      console.warn('librarian: web phase failed', e)
    }
    try {
      savedCount += await runAcademicPhase(input, existingFilenames, claimed, ensureFolder, currentDate)
    } catch (e) {
      console.warn('librarian: academic phase failed', e)
    }

    // Scan (fire-and-forget) para indexar as novas fontes — UM só, cobrindo
    // `.md` (web) e `.pdf` (acadêmico) de uma vez.
    if (savedCount > 0 && aiFolderId) {
      const { documentsScanWatchedFolder } = await import('./documents')
      void documentsScanWatchedFolder(aiFolderId).catch(() => {})
    }

    // Feedback via toast: UM só, somando web + papers.
    if (savedCount > 0) input.onSaved(savedCount)
  } finally {
    // Libera todos os filenames/chaves reivindicados (mesmo em erro/return antecipado).
    for (const f of claimed) inFlightUrls.delete(f)
  }
}

// Fase web (fonte primária): triagem → extract → julgamento → escrita verbatim
// dos `.md`. Retorna quantos arquivos foram gravados. Early-exits retornam 0 e
// encerram só esta fase (não abortam o pipeline inteiro).
async function runWebPhase(
  input: LibrarianInput,
  existingFilenames: Set<string>,
  claimed: string[],
  ensureFolder: () => Promise<string>,
  currentDate: string,
): Promise<number> {
  // Montar candidatos + dedupe (disco + in-flight). Reivindica os filenames
  // que passarem para cobrir o TOCTOU entre pipelines concorrentes.
  const candidates: Array<{ url: string; title: string; snippet: string; filename: string }> = []
  for (const r of input.searchResults) {
    const filename = await hashUrlToFilename(r.url)
    const inflightKey = `${input.chatFolderId}:${filename}`
    if (existingFilenames.has(filename) || inFlightUrls.has(inflightKey)) continue
    inFlightUrls.add(inflightKey)
    claimed.push(inflightKey)
    candidates.push({ url: r.url, title: r.title, snippet: r.content, filename })
  }
  if (candidates.length === 0) return 0

  // Triagem (barra conservadora). URLs citadas marcadas com [CITED].
  const candidatesBlock = candidates
    .map((c) => {
      const cited = input.citedUrls.some((u) => u === c.url) ? '[CITED] ' : ''
      return `- ${cited}URL: ${c.url}\n  Title: ${c.title}\n  Snippet: ${c.snippet}`
    })
    .join('\n')
  const candidateUrlSet = new Set(candidates.map((c) => c.url))
  const triagedRaw = await librarianTriage(input.question, candidatesBlock, currentDate)
  const triagedUrls = triagedRaw.filter((u) => candidateUrlSet.has(u))
  if (triagedUrls.length === 0) return 0

  // Extract em lote (só nas triadas).
  const extractedResults = await Promise.all(
    triagedUrls.map((url) => tavilyExtract(url).catch(() => null)),
  )
  const extracted: Array<{ url: string; rawContent: string }> = []
  triagedUrls.forEach((url, i) => {
    const res = extractedResults[i]
    if (res && res.rawContent) extracted.push({ url, rawContent: res.rawContent })
  })
  if (extracted.length === 0) return 0

  // Julgamento (rejeita paywall/teaser/boilerplate).
  const sourcesBlock = extracted
    .map((e) => `=== URL: ${e.url} ===\n${e.rawContent.slice(0, 5000)}\n`)
    .join('\n')
  const extractedUrlSet = new Set(extracted.map((e) => e.url))
  const approvedRaw = await librarianJudge(input.question, sourcesBlock, currentDate)
  const approvedUrls = approvedRaw.filter((u) => extractedUrlSet.has(u))
  if (approvedUrls.length === 0) return 0

  // Persistência (só aprovadas). Criação preguiçosa da AI folder via ensureFolder.
  const { documentsWriteAiSourceFile } = await import('./documents')
  const folderId = await ensureFolder()

  const extractedByUrl = new Map(extracted.map((e) => [e.url, e.rawContent]))
  let savedLocal = 0
  for (const url of approvedUrls) {
    const rawContent = extractedByUrl.get(url)
    if (!rawContent) continue
    try {
      const title = input.searchResults.find((r) => r.url === url)?.title ?? url
      const filename = await hashUrlToFilename(url)
      // Conteúdo salvo VERBATIM (raw content do Tavily) + cabeçalho de
      // proveniência. O modelo secundário só decide; nunca reescreve/resume.
      // O tamanho é limitado pelo Rust (MAX_FILE_BYTES).
      const header = `# ${title}\n\nSource: ${url}\nRetrieved: ${currentDate}\n\n`
      await documentsWriteAiSourceFile(folderId, filename, header + rawContent)
      savedLocal++
    } catch (e) {
      console.warn('librarian: failed to save source', url, e)
    }
  }

  return savedLocal
}

// Fase acadêmica (complementar): query bibliográfica → Crossref → relevância →
// Unpaywall → download+validação do PDF real. Retorna quantos PDFs foram
// gravados. Early-exits retornam 0 e encerram só esta fase.
async function runAcademicPhase(
  input: LibrarianInput,
  existingFilenames: Set<string>,
  claimed: string[],
  ensureFolder: () => Promise<string>,
  currentDate: string,
): Promise<number> {
  // 1. Gerar queries bibliográficas a partir do tópico do turno.
  const queries = await librarianAcademicQuery(input.question, currentDate)
  if (queries.length === 0) return 0

  // 2. Buscar candidatos no Crossref (multi-query paralelo) e dedupe por DOI.
  const raw = (await Promise.all(queries.slice(0, 2).map((q) => crossrefSearch(q)))).flat()
  const byDoi = new Map<string, CrossrefCandidate>()
  for (const c of raw) {
    const key = c.doi.toLowerCase()
    if (!byDoi.has(key)) byDoi.set(key, c)
  }
  if (byDoi.size === 0) return 0

  // 3. Filtro de relevância (barra conservadora, cap 3 reforçado no TS).
  const candList = [...byDoi.values()]
  const candidatesBlock = candList
    .map(
      (c) =>
        `- DOI: ${c.doi}\n  Title: ${c.title}\n  Year: ${c.year ?? 'unknown'}\n  Abstract: ${c.abstract || '(none)'}`,
    )
    .join('\n')
  const candidateDoiSet = new Set(candList.map((c) => c.doi.toLowerCase()))
  const approvedRaw = await librarianAcademicRelevance(input.question, candidatesBlock, currentDate)
  const approvedDois = approvedRaw
    .filter((d) => candidateDoiSet.has(d.toLowerCase()))
    .slice(0, 3)
  if (approvedDois.length === 0) return 0

  // 4. Loop por DOI aprovado: resolver OA → baixar+validar %PDF (no Rust) → gravar.
  let savedLocal = 0
  for (const doi of approvedDois) {
    const cand = byDoi.get(doi.toLowerCase())
    if (!cand) continue
    const filename = academicFilename(cand.year, cand.title)
    const fileKey = `${input.chatFolderId}:${filename}`
    const doiKey = `${input.chatFolderId}:doi:${doi.toLowerCase()}`
    // Dedupe (disco + in-flight por DOI e por filename, chaveado por pasta).
    if (existingFilenames.has(filename) || inFlightUrls.has(fileKey) || inFlightUrls.has(doiKey)) {
      continue
    }
    // Reivindicar in-flight (TOCTOU) antes de resolver OA.
    inFlightUrls.add(doiKey)
    inFlightUrls.add(fileKey)
    claimed.push(doiKey, fileKey)

    const pdfUrl = await unpaywallResolve(doi)
    if (!pdfUrl) continue // OA ausente/quebrado; descartar em silêncio.
    try {
      const folderId = await ensureFolder()
      await librarianFetchAndSavePdf(folderId, pdfUrl, filename)
      savedLocal++
    } catch (e) {
      // %PDF inválido / HTML de landing vira Err no Rust e cai aqui, sem gravar.
      console.warn('librarian: academic save failed', doi, e)
    }
    // Throttle polido do Unpaywall/publishers (cap 3 mantém o custo trivial).
    await new Promise((r) => setTimeout(r, 250))
  }

  return savedLocal
}
