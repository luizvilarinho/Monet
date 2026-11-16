import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'

// Espelho (camelCase) dos tipos de src-tauri/src/rag.rs.

export interface RagScope {
  ids: string[]
  notebookId?: string | null
  excludeNoteId?: string | null
  includeAiFolders: boolean
}

export interface RagTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface RagDateRange {
  from: string
  to: string
}

export interface RagCandidate {
  rowid: number
  documentId: string
  documentName: string
  chunkIndex: number
  content: string
  header: string
  kind: string
  title: string
  docDate: string | null
  folderLabel: string | null
  section: string | null
  page: number | null
  sourceUrl: string | null
  vecRank: number | null
  vecDistance: number | null
  ftsRank: number | null
  bm25: number | null
  rrf: number
  rerankScore: number | null
  weight: number
  finalScore: number | null
}

export interface RagTimings {
  rewriteMs: number
  embeddingMs: number
  searchMs: number
  rerankMs: number
}

export interface RagResponse {
  originalQuery: string
  rewrittenQuery: string | null
  keywords: string[]
  dateRange: RagDateRange | null
  rewriteFailed: boolean
  rerankFailed: boolean
  nothingRelevant: boolean
  candidates: RagCandidate[]
  selected: RagCandidate[]
  timings: RagTimings
  // Turno do roteador (chat do caderno); null fora dele.
  route?: RagRouteTrace | null
}

// Dados da árvore do roteador (o Rust monta o texto e as referências).
export interface RouterNote {
  id: string
  title: string
  subjectId: string | null
  type: string | null // nome do tipo da nota
  properties: Array<{ name: string; value: string }> // do tipo atual, com valor (propertiesForAi)
  date: string | null // YYYY-MM-DD: data da nota, título do Calendar ou dia de criação
  archived: string | null // YYYY-MM-DD da arquivação
  updatedAt: number // ms
}

export interface RouterInput {
  notebookName: string | null
  subjects: Array<{ id: string; name: string }> // na ordem de sortOrder
  notes: RouterNote[]
  openNoteId: string | null // nota aberta E incluída no contexto
  hasAttachment: boolean
}

// 'list': a resposta vem da lista de notas do caderno (sem busca e sem leitura).
export type RagRouteKind = 'none' | 'notes' | 'list' | 'kb' | 'both'

export interface RagRoutedNote {
  ref: string // "n3"
  noteId: string
  title: string
  rowids: number[] // chunks da nota inteira, ou os dos trechos
  excerpts: RagCandidate[] | null // não-null = nota longa: usar só estes trechos
}

export interface RagRouteTrace {
  route: RagRouteKind // rota final (depois da resolução e do fallback); nunca 'notes', que vira 'both'
  modelRoute: RagRouteKind | null // a que o modelo devolveu; null = roteador falhou
  refs: string[]
  ignoredRefs: string[]
  notes: RagRoutedNote[]
  treeNotes: number
  treeOmitted: number
  treeChars: number
  // Lista das notas do caderno (a árvore sem as referências), só nas rotas
  // finais both/list; vai ao modelo principal.
  noteList: string | null
}

// Filtros da tool `search_knowledge_base` (vazio = sem filtro).
export interface RagFilters {
  kinds: string[]
  dateFrom?: string | null
  dateTo?: string | null
  folderLabelContains?: string | null
}

export async function ragRetrieve(
  scope: RagScope,
  message: string,
  history: RagTurn[],
  rewriteModel?: string | null,
  filters?: RagFilters | null,
  router?: RouterInput | null,
): Promise<RagResponse> {
  return invoke<RagResponse>('rag_retrieve', {
    scope: {
      ids: scope.ids,
      notebookId: scope.notebookId ?? null,
      excludeNoteId: scope.excludeNoteId ?? null,
      includeAiFolders: scope.includeAiFolders,
    },
    message,
    history,
    rewriteModel: rewriteModel ?? null,
    filters: filters ?? null,
    router: router ?? null,
  })
}

// Trechos do turno anterior por rowid, só dos documentos do escopo atual.
export async function ragGetChunks(scope: RagScope, rowids: number[]): Promise<RagCandidate[]> {
  return invoke<RagCandidate[]>('rag_get_chunks', {
    scope: {
      ids: scope.ids,
      notebookId: scope.notebookId ?? null,
      excludeNoteId: scope.excludeNoteId ?? null,
      includeAiFolders: scope.includeAiFolders,
    },
    rowids,
  })
}

// ─── Integração no chat (useChat) ────────────────────────────────────────────

// Modelo da reescrita da consulta (Settings); vazio = padrão do backend.
export const RAG_REWRITE_MODEL_KEY = 'monet:rag-rewrite-model'
// Modo detalhado: guarda o trace do inspetor em memória ('1' = ligado).
export const RAG_DETAILED_KEY = 'monet:rag-detailed'

// O backend só usa os primeiros 2.000 chars da mensagem e as últimas 6
// mensagens do histórico (1.500 chars cada): mandar mais só pesa no IPC.
const RAG_MESSAGE_MAX_CHARS = 2000
const RAG_HISTORY_TURNS = 6
const RAG_HISTORY_TURN_CHARS = 1500

// Fonte compacta gravada na mensagem do assistant (localStorage): sem o
// conteúdo dos trechos, só o que a lista de fontes e o "continue" precisam.
export interface RagSource {
  n: number
  documentId: string
  title: string
  kind: string
  date?: string
  folder?: string
  page?: number
  url?: string
  rowids: number[]
}

export function ragMessage(text: string): string {
  return text.slice(0, RAG_MESSAGE_MAX_CHARS)
}

export function ragHistory(messages: Array<{ role: 'user' | 'assistant'; content: string }>): RagTurn[] {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .slice(-RAG_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, RAG_HISTORY_TURN_CHARS) }))
}

// Gating do RAG por mensagens curtas e fixas (pt/en).
const RAG_GATE_MAX_CHARS = 40
const SKIP_PHRASES = [
  'valeu', 'obrigado', 'obrigada', 'brigado', 'brigada', 'thanks', 'thank you',
  'ok', 'okay', 'blz', 'beleza', 'perfeito', 'show', 'top', 'massa', 'entendi', 'got it',
]
const REUSE_PHRASES = [
  'continue', 'continua', 'continuar', 'prossiga', 'tenta de novo', 'tente de novo',
  'de novo', 'mais', 'try again', 'again', 'go on', 'keep going', 'more',
]

function phrasesRe(phrases: string[]): RegExp {
  const alt = [...phrases].sort((a, b) => b.length - a.length).join('|')
  return new RegExp(`^(?:(?:${alt})(?: |$))+$`)
}
const SKIP_RE = phrasesRe(SKIP_PHRASES)
const REUSE_RE = phrasesRe(REUSE_PHRASES)

function normalizeForGate(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// 'skip': agradecimento/confirmação, sem busca. 'reuse': "continue"/"tenta
// de novo", reaproveita os trechos do turno anterior. 'search': o resto.
export function ragGate(message: string): 'skip' | 'reuse' | 'search' {
  const trimmed = message.trim()
  if (trimmed.length > RAG_GATE_MAX_CHARS) return 'search'
  const norm = normalizeForGate(trimmed)
  // Vazia ou só emoji/pontuação ("👍", "!!").
  if (norm.length === 0) return 'skip'
  if (SKIP_RE.test(norm)) return 'skip'
  if (REUSE_RE.test(norm)) return 'reuse'
  return 'search'
}

// Com contexto efêmero (nota aberta, página do livro), o "não encontrei" vale
// só para a base: a nota aberta fica fora da busca (excludeNoteId).
const OTHER_CONTEXT_NOTE =
  ' This applies only to the knowledge base search: the other context provided in this conversation (such as the open note or the current page) can still be used.'

// Número [n] de um documento nas fontes da resposta: um documento já citado
// mantém o seu (e ganha os rowids novos); um novo entra no fim. Muta `sources`.
export function citeSource(sources: RagSource[], source: Omit<RagSource, 'n'>): number {
  const found = sources.find((s) => s.documentId === source.documentId)
  if (found) {
    for (const r of source.rowids) if (!found.rowids.includes(r)) found.rowids.push(r)
    return found.n
  }
  const n = sources.length + 1
  sources.push({ ...source, n, rowids: [...source.rowids] })
  return n
}

// Blocos `[n] <header>\n<trechos>`, um por documento na ordem do 1º
// aparecimento, numerados (e acrescentados) em `sources` por `citeSource`.
// Com fontes anteriores, a numeração continua a da resposta.
export function ragChunkBlocks(chunks: RagCandidate[], sources: RagSource[]): string[] {
  const groups: Array<{ first: RagCandidate; chunks: RagCandidate[] }> = []
  const byDoc = new Map<string, { first: RagCandidate; chunks: RagCandidate[] }>()
  for (const c of chunks) {
    let g = byDoc.get(c.documentId)
    if (!g) {
      g = { first: c, chunks: [] }
      byDoc.set(c.documentId, g)
      groups.push(g)
    }
    g.chunks.push(c)
  }
  return groups.map((g) => {
    const n = citeSource(sources, {
      documentId: g.first.documentId,
      title: g.first.title || g.first.documentName,
      kind: g.first.kind,
      date: g.first.docDate ?? undefined,
      folder: g.first.folderLabel ?? undefined,
      page: g.first.page ?? undefined,
      url: g.first.sourceUrl ?? undefined,
      rowids: g.chunks.map((c) => c.rowid),
    })
    return `[${n}] ${g.first.header}\n${g.chunks.map((c) => c.content).join('\n…\n')}`
  })
}

// Mensagem de sistema com os trechos, numerados por documento na ordem do 1º
// aparecimento ([n] por documento), e as fontes compactas correspondentes.
export function buildRagContext(
  chunks: RagCandidate[],
  hasOtherContext: boolean,
): { content: string; sources: RagSource[] } {
  const sources: RagSource[] = []
  const blocks = ragChunkBlocks(chunks, sources)
  const content =
    'Knowledge base excerpts. Cite them inline as [n] right after the claim they support. ' +
    "Use only what they say; if they do not answer the question, say you did not find it in the user's documents." +
    (hasOtherContext ? OTHER_CONTEXT_NOTE : '') +
    `\n\n${blocks.join('\n---\n')}`
  return { content, sources }
}

// Nota escolhida pelo roteador, lida no turno: inteira ou só os trechos.
export interface RoutedNoteRead {
  documentId: string // note:<id>
  title: string
  type?: string // nome do tipo da nota
  properties: Array<{ name: string; value: string }> // do tipo atual, com valor
  date?: string
  folder?: string // "Notes — <caderno>"
  archived?: string
  rowids: number[]
  excerpts: boolean
  text: string
}

const NOTE_LIST_FORMAT =
  'List of the notes in this notebook, without their text: each line has the title and, when present, the note type, the properties of that type ("Name: value; Name: value"), the date and the archive date.'
const NOTE_LIST_INCOMPLETE = ' When the list says some notes are not listed, say that the answer may be incomplete.'

// Mensagem de sistema do turno do roteador. A lista de notas do caderno
// (rotas finais both/list) vem primeiro; depois as notas escolhidas e, com
// busca, os trechos da KB, na mesma numeração [n]. Sem nota lida, a busca
// que não achou nada leva o aviso de "nada relevante". Só a lista (rota
// list): a resposta sai dela, sem fontes e sem o aviso.
export function buildRoutedContext(
  notes: RoutedNoteRead[],
  kbChunks: RagCandidate[],
  kbNothingRelevant: boolean,
  hasOtherContext: boolean,
  noteList: string | null,
): { content: string; sources: RagSource[] } {
  const sources: RagSource[] = []
  const parts: string[] = []
  if (noteList) {
    const use =
      notes.length > 0 || kbChunks.length > 0
        ? ' Answer from this list the questions about which notes exist and the requests to list notes by type, property, subject or title; the notes and knowledge base excerpts below are supporting material. Items that appear only in this list are not sources: cite as [n] only the notes and excerpts below.'
        : ' Answer from this list: it covers the questions about which notes exist and the requests to list notes by type, property, subject or title. Its items are not sources: do not cite them as [n].'
    parts.push(`${NOTE_LIST_FORMAT}${use}${NOTE_LIST_INCOMPLETE}\n\n${noteList}`)
  }
  if (notes.length > 0) {
    const noteBlocks = notes.map((note) => {
      const n = citeSource(sources, {
        documentId: note.documentId,
        title: note.title,
        kind: 'note',
        date: note.date,
        folder: note.folder,
        rowids: note.rowids,
      })
      const properties = note.properties.map((p) => `${p.name}: ${p.value}`).join('; ')
      const header = [
        note.title,
        'note',
        note.type && `type ${note.type}`,
        properties,
        note.date,
        note.archived && `archived ${note.archived}`,
        note.folder,
      ]
        .filter(Boolean)
        .join(' · ')
      return `[${n}] [${header}]${note.excerpts ? ' (excerpts)' : ''}${note.text ? `\n${note.text}` : ''}`
    })
    let intro =
      "Notes from this notebook picked for the user's message: each one in full, or only its passages most relevant to the message when the note is long (marked \"excerpts\"). " +
      'Cite them inline as [n] right after the claim they support. Use only what they say when you describe these notes.'
    if (kbChunks.length === 0 && kbNothingRelevant) {
      intro +=
        ' The search in the rest of the knowledge base found nothing relevant to this message.' +
        (hasOtherContext ? OTHER_CONTEXT_NOTE : '')
    }
    parts.push(`${intro}\n\n${noteBlocks.join('\n---\n')}`)
  } else if (kbChunks.length === 0 && kbNothingRelevant) {
    // Rota both sem nota lida: a busca na KB rodou e não achou nada.
    parts.push(ragNothingFoundMessage(hasOtherContext))
  }
  if (kbChunks.length > 0) {
    parts.push(
      'Knowledge base excerpts (the numbering continues). Cite them inline as [n] right after the claim they support. ' +
        "Use only what they say; if neither the notes above nor these excerpts answer the question, say you did not find it in the user's documents." +
        (hasOtherContext ? OTHER_CONTEXT_NOTE : '') +
        `\n\n${ragChunkBlocks(kbChunks, sources).join('\n---\n')}`
    )
  }
  return { content: parts.join('\n\n'), sources }
}

export function ragNothingFoundMessage(hasOtherContext: boolean): string {
  return (
    'The knowledge base search found nothing relevant to this question. ' +
    'Tell the user you did not find it in their documents instead of guessing.' +
    (hasOtherContext ? OTHER_CONTEXT_NOTE : '')
  )
}

// ─── Fontes clicáveis (Sources) ──────────────────────────────────────────────

// O documento-resumo sintético das tasks de um caderno não tem o que abrir.
export function isRagSourceOpenable(source: RagSource): boolean {
  return !source.documentId.startsWith('note:tasks-')
}

// Nota → janela principal (também a partir da janela assistant); página web →
// navegador (só http/https: a `url` vem do cabeçalho do arquivo); demais
// arquivos da KB → app padrão do sistema.
export async function openRagSource(source: RagSource): Promise<void> {
  if (!isRagSourceOpenable(source)) return
  if (source.documentId.startsWith('note:')) {
    await invoke('open_note_in_main', { noteId: source.documentId.slice('note:'.length) })
  } else if (source.url && /^https?:\/\//i.test(source.url)) {
    await openUrl(source.url)
  } else {
    await invoke('documents_open_file', { documentId: source.documentId })
  }
}
