import { invoke } from '@tauri-apps/api/core'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelOpenRouterStream,
  hasOpenRouterKey,
  onOpenRouterChunk,
  onOpenRouterDone,
  onOpenRouterError,
  onOpenRouterReasoning,
  onOpenRouterToolCall,
  startOpenRouterStreamMessages,
  type ChatMessageInput,
  type ContentBlock,
  type StreamToolCallPayload,
} from '../lib/openrouter'
import type { AiModel, Notebook, Task, TaskStatusDef } from '../types'
import {
  queryTasksText,
  type ChecklistProgress,
  type TasksQuery,
} from '../lib/tasks'
import { formatSearchResults, hasTavilyKey, webSearch, type SearchResult } from '../lib/search'
import { runDeepResearch, type DeepResearchPhase } from '../lib/deepResearch'
import { enqueueLibrarian } from '../lib/librarian'
import {
  getNotebookVisibleDocumentIds,
  NOTEBOOK_VISIBILITY_CHANGED_EVENT,
  notesFolderDocId,
  notesIndexGetDisabledNotebooks,
  replaceNotebookVisibility,
  setNotebookDocumentVisibility,
} from '../lib/documents'
import {
  buildRagContext,
  citeSource,
  RAG_DETAILED_KEY,
  RAG_REWRITE_MODEL_KEY,
  ragChunkBlocks,
  ragGate,
  ragGetChunks,
  ragHistory,
  ragMessage,
  ragNothingFoundMessage,
  ragRetrieve,
  type RagCandidate,
  type RagFilters,
  type RagResponse,
  type RagScope,
  type RagSource,
} from '../lib/rag'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs, getWeekdayName } from '../lib/calendar'
import { cleanNoteContentForAi, loadEmbedResponses, noteDate } from '../lib/noteFileText'
import { ocrTextsForContent } from '../lib/imageOcr'
import { storage } from '../storage'

// ─── System prompt do chat ───────────────────────────────────────────────────
// Edite aqui para ajustar o comportamento do modelo no modo chat.
const CHAT_SYSTEM_PROMPT = `
You are a study and research assistant. Your role is to help curious,
intelligent people learn and understand new topics — they may be beginners
in the subject, so always prioritize clarity without being condescending.

## Tone and posture
Respond like a knowledgeable, friendly professor: patient, clear, and direct.
Adapt the depth automatically — if the question is technical, go technical;
if it's from a beginner, make it accessible. When the question could be
interpreted at multiple levels of depth, default to the more technical one.
If that assumption turns out wrong, the user can always ask for a simpler
explanation.

Get to the point — no openers like "Great question!" or "Sure, I can help
with that." But don't be cold: a direct answer can still have personality.

When explaining abstract concepts, use real-world analogies and concrete
examples rather than generic definitions. Always make sure the fundamentals
of the topic are clear before going deeper.

If the question is ambiguous, pick the most likely interpretation and answer
it. If clarification is genuinely needed, ask a single focused question —
never a list of questions. If you're assuming something, say so briefly
at the start. 

When the question is open-ended or exploratory (e.g. "how does X work",
"what is X", "I want to learn X"), suggest a learning path — a sequence
with a brief reason for the order. Skip this for factual lookups, specific
concept clarifications, or follow-up questions in an ongoing explanation.

When relevant and natural, suggest complementary study resources: books and
scientific articles are preferred over blog posts. Only recommend titles you
are confident exist — do not invent authors, titles, or publication details.

## Format
- Use markdown only when it genuinely helps clarity: code blocks, comparison
  tables, lists when there are truly enumerable items
- For simple questions, answer in prose — don't turn everything into a list
- No emojis or decorative formatting
- For long responses, use headers to organize
- Key concepts in bold.
- When you have a direct URL to an image file (ending in .jpg, .png, .gif, .webp, .svg, or similar), embed it using markdown image syntax: \`![description](url)\`. Only do this for direct image file URLs — not for web page URLs that happen to contain images.

## Web search and citations
When using web search, integrate findings naturally into the response
without inline links or citations in the body text. At the end of the
response, add a "Sources" section listing all referenced links in
numbered format:

1. [Title](url)
2. [Title](url)

Never place web links or web citation markers in the middle of the text.
Knowledge base excerpts are cited inline as [n].
If search results are inconclusive or outdated, say so explicitly
in the body of the response.

## Accuracy
If you're not sure about something, say so — don't fabricate. When multiple
valid approaches exist, present the options with real trade-offs, not just
"it depends." Never invent sources, quotes, statistics, or reading
recommendations.

## Language
Always respond in the same language as the user's message.`
// ─────────────────────────────────────────────────────────────────────────────

// ─── System prompt de gerenciamento de memoria de pasta ──────────────────────
// Injetado como mensagem system ADICIONAL (independente do CHAT_SYSTEM_PROMPT
// e do systemPrompt opcional da pasta) sempre que ChatFolder.memoryEnabled
// for true. Ver `send()` para o ponto de injecao.
const MEMORY_SYSTEM_PROMPT = `
Each chat can be saved to a folder, and you have access to a persistent
memory for each folder. This memory doesn't need to be highly precise.
Record here the topics covered and any new information you come across
during the interaction with the user. Record anything that might be
important for future conversations, but keep it concise. Pay special
attention to recurring topics, or when the user shows emotion about them.
Call \`update_folder_memory\` to save it. If the memory gets too large, you
can edit it, removing parts you judge to be less important or condensing
the information further. Don't be afraid to make mistakes.`
// ─────────────────────────────────────────────────────────────────────────────

// ─── System prompt do chat do leitor (pasta por livro) ───────────────────────
// Gravado programaticamente como systemPrompt (modo `replace`) da pasta do
// livro quando ela é CRIADA em `ensureScopedFolder` (kind 'book'). Depois da criação o
// prompt passa a ser do usuário (editável no modal de system prompt da
// pasta), então o ensure não o regrava. Alinhado à visão de produto
// (DOCS/specs/productVision.md): a IA como auxiliar de leitura, ancorada no
// material do usuário, sem substituir o esforço da leitura.
function buildReaderSystemPrompt(language: string): string {
  return `
You are Monet's reading assistant. You live in a side panel next to a book
the user is actively reading. Each user message includes a system message
with the CURRENT reading context: book title/author, current page and its
text, and the user's recent highlights (most recent first, with dates and
page numbers).

Ground deictic references in that context: when the user says "this",
"here" or asks about "this page/passage", they mean the current page or
selection. Refer to specific passages, highlights or pages when helpful.

If relevant excerpts from the book or other knowledge base documents are
also provided below (retrieved via search), use them freely to answer
questions that go beyond the current page — including summaries, other
chapters, or the book as a whole. Only stay limited to the current page when
the user's phrasing calls for it ("this", "here") or no such excerpts are
provided.

Your role is to help the reader move through the book — clarify difficult
passages, define terms, unpack arguments, connect ideas to their highlights —
never to replace the reading itself.
If the context says the page text is unavailable, say you cannot see the
page text and work with the book info and highlights instead.

Use concise Markdown. No greetings or filler.
Always respond in the user's language: ${language}.`
}
// ─────────────────────────────────────────────────────────────────────────────

const CONVERSATIONS_KEY = 'monet:chat-conversations'
const FOLDERS_KEY = 'monet:chat-folders'
const LOOSE_ORDER_KEY = 'monet:chat-loose-order'
const ACTIVE_ID_KEY = 'monet:chat-active-id'
const MODEL_KEY = 'monet:chat-model'
const TOOLS_KEY = 'monet:chat-tools'
const LEGACY_HISTORY_KEY = 'monet:chat-history'
const RESPONSE_LINK_KEY = 'monet:ai-response-chat-link'
const READER_BOOK_FOLDER_LINK_KEY = 'monet:reader-book-folder-link'
const NOTEBOOK_CHAT_FOLDER_LINK_KEY = 'monet:notes-notebook-folder-link'
const NOTEBOOK_MEMORY_MIGRATION_KEY = 'monet:notebook-memory-default-migrated'

// Texto do assistant quando o turno termina sem resposta.
export const NO_RESPONSE_MESSAGE = "The model didn't return a response. Please try again."

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageDataUrl?: string
  attachedDocs?: Array<{ name: string; path: string }>
  timestamp: string
  model?: string
  tokensPerSecond?: number
  thinking?: string
  // Fontes do RAG usadas na resposta ([n] por documento), compactas.
  ragSources?: RagSource[]
  // A busca na base não achou nada relevante.
  ragNothingFound?: true
}

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  // Pasta a que a conversa pertence (null = lista solta; undefined = legado,
  // derivado das listas de ordem no reconcile). FONTE DE VERDADE da
  // vinculação conversa→pasta: é gravada ATOMICAMENTE junto com a conversa em
  // CONVERSATIONS_KEY. `folder.conversationIds` guarda apenas a ORDEM de
  // exibição e é reconstruída a partir deste campo (ver reconcileOrders) —
  // uma leitura defasada de FOLDERS_KEY em outra janela não consegue mais
  // "desvincular" uma conversa da pasta.
  folderId?: string | null
}

export type SystemPromptMode = 'replace' | 'append'

export interface ChatFolder {
  id: string
  name: string
  conversationIds: string[]
  visibleDocumentIds: string[]
  expanded: boolean
  systemPrompt: string
  systemPromptMode: SystemPromptMode
  memory: string
  memoryEnabled: boolean
  webResearchEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ChatTools {
  webSearch: boolean
  deepResearch: boolean
  // Tool "Tasks" (consulta à tabela de tasks); nos chats que fornecem o snapshot.
  tasks: boolean
  // Tools "Daily notes" (get_day, notes_by_date): leem notas datadas de
  // qualquer caderno, fora do escopo da pasta. Opt-in.
  dailyNotes: boolean
}

// Estado atual das tasks para a tool `query_tasks` (fornecido pelo App).
export interface TasksSnapshot {
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  // Progresso do checklist da nota-corpo de cada task. O loader é lido só
  // quando a tool é chamada (o Assistant lê as notas-corpo do banco).
  checklist: Map<string, ChecklistProgress> | (() => Promise<Map<string, ChecklistProgress>>)
  // Registro de status (enum da tool e nomes nas respostas).
  statuses: TaskStatusDef[]
}

export type ConversationLocation =
  | { type: 'loose'; index: number }
  | { type: 'folder'; folderId: string; index: number }

const DEFAULT_TOOLS: ChatTools = { webSearch: false, deepResearch: false, tasks: false, dailyNotes: false }

function loadTools(): ChatTools {
  try {
    const raw = localStorage.getItem(TOOLS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, unknown>
        return {
          webSearch: !!p.webSearch,
          deepResearch: !!p.deepResearch,
          tasks: !!p.tasks,
          dailyNotes: !!p.dailyNotes,
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_TOOLS }
}

function saveTools(tools: ChatTools) {
  try {
    localStorage.setItem(TOOLS_KEY, JSON.stringify(tools))
  } catch (err) {
    console.error('failed to persist chat tools', err)
  }
}

function isMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== 'object') return false
  const x = m as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    (x.role === 'user' || x.role === 'assistant') &&
    typeof x.content === 'string' &&
    typeof x.timestamp === 'string'
  )
}

function isConversation(c: unknown): c is ChatConversation {
  if (!c || typeof c !== 'object') return false
  const x = c as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.title === 'string' &&
    Array.isArray(x.messages) &&
    x.messages.every(isMessage) &&
    typeof x.createdAt === 'string' &&
    typeof x.updatedAt === 'string'
  )
}

function isFolder(f: unknown): f is ChatFolder {
  if (!f || typeof f !== 'object') return false
  const x = f as Record<string, unknown>
  // systemPrompt / systemPromptMode sao opcionais aqui — normalizados em normalizeFolder
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    Array.isArray(x.conversationIds) &&
    (x.conversationIds as unknown[]).every((id) => typeof id === 'string') &&
    typeof x.expanded === 'boolean' &&
    typeof x.createdAt === 'string' &&
    typeof x.updatedAt === 'string'
  )
}

function normalizeFolder(f: ChatFolder): ChatFolder {
  const raw = f as ChatFolder & Partial<Record<string, unknown>>
  const sp = typeof raw.systemPrompt === 'string' ? raw.systemPrompt : ''
  const mode: SystemPromptMode =
    raw.systemPromptMode === 'append' ? 'append' : 'replace'
  const visibleDocumentIds = Array.isArray(raw.visibleDocumentIds)
    ? (raw.visibleDocumentIds as unknown[]).filter((x) => typeof x === 'string') as string[]
    : []
  const memory = typeof raw.memory === 'string' ? raw.memory : ''
  const memoryEnabled = raw.memoryEnabled === true
  const webResearchEnabled = raw.webResearchEnabled === true
  return { ...f, systemPrompt: sp, systemPromptMode: mode, visibleDocumentIds, memory, memoryEnabled, webResearchEnabled }
}

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first) return 'New conversation'
  const cleaned = first.content.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New conversation'
  return cleaned.length > 50 ? cleaned.slice(0, 50) + '…' : cleaned
}

// ─── Anti-eco de persistência ────────────────────────────────────────────────
// Último valor conhecido de cada chave de chat NESTA janela — escrito por nós
// ou recebido via evento `storage` (e.newValue). Os save-effects comparam com
// este cache em vez de reler o localStorage: entre processos (WebView2, uma
// webview por janela) a leitura pode vir DEFASADA, e comparar com leitura
// defasada tanto podia suprimir uma escrita necessária quanto re-gravar
// conteúdo obsoleto por cima de uma escrita recente da outra janela.
const lastKnownValues = new Map<string, string>()

function readChatKey(key: string): string | null {
  const raw = localStorage.getItem(key)
  if (raw !== null) lastKnownValues.set(key, raw)
  return raw
}

// Retorna true se gravou (conteúdo mudou em relação ao último valor conhecido).
function writeChatKey(key: string, serialized: string): boolean {
  const known = lastKnownValues.get(key) ?? localStorage.getItem(key)
  lastKnownValues.set(key, serialized)
  if (serialized === known) return false
  localStorage.setItem(key, serialized)
  return true
}

function parseConversations(raw: string | null): ChatConversation[] {
  try {
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every(isConversation)) {
        return parsed as ChatConversation[]
      }
    }
  } catch {
    /* ignore */
  }
  return []
}

function loadConversations(): ChatConversation[] {
  const parsed = parseConversations(readChatKey(CONVERSATIONS_KEY))
  if (parsed.length > 0) return parsed
  // Migracao do historico unico legado
  try {
    const legacy = localStorage.getItem(LEGACY_HISTORY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(isMessage)
      ) {
        const now = new Date().toISOString()
        const conv: ChatConversation = {
          id: nanoid(),
          title: deriveTitle(parsed),
          messages: parsed,
          createdAt: now,
          updatedAt: now,
          folderId: null,
        }
        writeChatKey(CONVERSATIONS_KEY, JSON.stringify([conv]))
        localStorage.setItem(ACTIVE_ID_KEY, conv.id)
        localStorage.removeItem(LEGACY_HISTORY_KEY)
        return [conv]
      }
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveConversations(list: ChatConversation[]) {
  try {
    const stripped = list.map((c) => ({
      ...c,
      messages: c.messages.map((m) => {
        if (!m.imageDataUrl) return m
        const { imageDataUrl: _img, ...rest } = m
        return rest
      }),
    }))
    const serialized = JSON.stringify(stripped)
    // Anti-loop do sync cross-window: se o conteudo nao mudou em relacao ao
    // ultimo valor conhecido (caso tipico de hidratacao via evento `storage`),
    // nao re-grava — assim nao dispara um novo evento na outra janela.
    writeChatKey(CONVERSATIONS_KEY, serialized)
  } catch (err) {
    console.error('failed to persist chat conversations', err)
  }
}

function parseFolders(raw: string | null): ChatFolder[] {
  try {
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(isFolder)) {
      return (parsed as ChatFolder[]).map(normalizeFolder)
    }
  } catch {
    /* ignore */
  }
  return []
}

function loadFolders(): ChatFolder[] {
  const folders = parseFolders(readChatKey(FOLDERS_KEY))
  // Migração única: a "Notebook memory" passou a nascer ligada; liga também
  // nas pastas de caderno que já existiam.
  if (localStorage.getItem(NOTEBOOK_MEMORY_MIGRATION_KEY) !== null) return folders
  localStorage.setItem(NOTEBOOK_MEMORY_MIGRATION_KEY, '1')
  const notebookFolderIds = new Set(Object.values(loadNotebookChatFolderLinks()))
  if (!folders.some((f) => notebookFolderIds.has(f.id) && !f.memoryEnabled)) return folders
  const migrated = folders.map((f) =>
    notebookFolderIds.has(f.id) ? { ...f, memoryEnabled: true } : f
  )
  saveFolders(migrated)
  return migrated
}

function saveFolders(list: ChatFolder[]) {
  try {
    writeChatKey(FOLDERS_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('failed to persist chat folders', err)
  }
}

function parseLooseOrder(raw: string | null): string[] {
  try {
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed as string[]
    }
  } catch {
    /* ignore */
  }
  return []
}

function loadLooseOrder(): string[] {
  return parseLooseOrder(readChatKey(LOOSE_ORDER_KEY))
}

function saveLooseOrder(order: string[]) {
  try {
    writeChatKey(LOOSE_ORDER_KEY, JSON.stringify(order))
  } catch (err) {
    console.error('failed to persist loose order', err)
  }
}

type ResponseLinks = Record<string, string>

function loadResponseLinks(): ResponseLinks {
  try {
    const raw = localStorage.getItem(RESPONSE_LINK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: ResponseLinks = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    }
  } catch {
    /* ignore */
  }
  return {}
}

function saveResponseLinks(links: ResponseLinks): void {
  try {
    localStorage.setItem(RESPONSE_LINK_KEY, JSON.stringify(links))
  } catch (err) {
    console.error('failed to persist response-chat links', err)
  }
}

export function getLinkedChatConversationId(responseId: string): string | null {
  const links = loadResponseLinks()
  return links[responseId] ?? null
}

export function linkResponseToChatConversation(
  responseId: string,
  conversationId: string
): void {
  const links = loadResponseLinks()
  links[responseId] = conversationId
  saveResponseLinks(links)
}

export function unlinkResponseFromChat(responseId: string): void {
  const links = loadResponseLinks()
  if (!(responseId in links)) return
  delete links[responseId]
  saveResponseLinks(links)
}

// Ids das pastas de chat salvas. A KB usa para achar as pastas web órfãs
// (de pastas de chat apagadas).
// null quando a lista gravada não pôde ser lida: quem chama não pode concluir
// que as pastas sumiram (ex.: marcar todas as pastas web como órfãs).
export function listChatFolderIds(): string[] | null {
  const raw = localStorage.getItem(FOLDERS_KEY)
  const folders = parseFolders(raw)
  if (raw && folders.length === 0) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length > 0) return null
    } catch {
      return null
    }
  }
  return folders.map((f) => f.id)
}

export function chatConversationExists(conversationId: string): boolean {
  return loadConversations().some((c) => c.id === conversationId)
}

// ─── Vínculo livro ↔ pasta de chat do leitor ─────────────────────────────────
// Record bookId → folderId em localStorage, no mesmo padrão do
// RESPONSE_LINK_KEY acima. Materializa "uma PASTA por livro" do chat do
// Reader (várias conversas por livro dentro da pasta). A resolução robusta é
// pelo folderId (o nome da pasta — título do livro — é cosmético e pode ser
// renomeado pelo usuário).
type ReaderBookFolderLinks = Record<string, string>

function loadReaderBookFolderLinks(): ReaderBookFolderLinks {
  try {
    const raw = localStorage.getItem(READER_BOOK_FOLDER_LINK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: ReaderBookFolderLinks = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    }
  } catch {
    /* ignore */
  }
  return {}
}

function saveReaderBookFolderLinks(links: ReaderBookFolderLinks): void {
  try {
    localStorage.setItem(READER_BOOK_FOLDER_LINK_KEY, JSON.stringify(links))
  } catch (err) {
    console.error('failed to persist reader book-folder links', err)
  }
}

export function getReaderChatFolderId(bookId: string): string | null {
  const links = loadReaderBookFolderLinks()
  return links[bookId] ?? null
}

function linkBookToReaderFolder(bookId: string, folderId: string): void {
  const links = loadReaderBookFolderLinks()
  links[bookId] = folderId
  saveReaderBookFolderLinks(links)
}

export function unlinkBookFromReaderFolder(bookId: string): void {
  const links = loadReaderBookFolderLinks()
  if (!(bookId in links)) return
  delete links[bookId]
  saveReaderBookFolderLinks(links)
}

// ─── Vínculo caderno ↔ pasta de chat das Anotações ───────────────────────────
// Record notebookId → folderId em localStorage, no mesmo padrão do vínculo do
// Reader acima. Uma pasta vinculada NÃO usa `visibleDocumentIds`: a seleção de
// documentos dela é a tabela durável `notebook_document_visibility` do caderno
// (a mesma do DocumentsModal).
type NotebookChatFolderLinks = Record<string, string>

function loadNotebookChatFolderLinks(): NotebookChatFolderLinks {
  try {
    const raw = localStorage.getItem(NOTEBOOK_CHAT_FOLDER_LINK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: NotebookChatFolderLinks = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    }
  } catch {
    /* ignore */
  }
  return {}
}

function saveNotebookChatFolderLinks(links: NotebookChatFolderLinks): void {
  try {
    localStorage.setItem(NOTEBOOK_CHAT_FOLDER_LINK_KEY, JSON.stringify(links))
  } catch (err) {
    console.error('failed to persist notebook chat-folder links', err)
  }
}

export function getNotebookChatFolderId(notebookId: string): string | null {
  const links = loadNotebookChatFolderLinks()
  return links[notebookId] ?? null
}

// Busca reversa (pasta → caderno). Lê o localStorage a cada chamada, para
// enxergar vínculos gravados por outra janela sem precisar de sync.
export function getNotebookIdForChatFolder(folderId: string): string | null {
  const links = loadNotebookChatFolderLinks()
  for (const [notebookId, linkedFolderId] of Object.entries(links)) {
    if (linkedFolderId === folderId) return notebookId
  }
  return null
}

// Pastas automáticas (vinculadas a livro do Reader ou a caderno), por id —
// o nome é cosmético. Usado só para agrupar visualmente na sidebar do chat.
export function getAutoFolderGroups(): { library: Set<string>; notebook: Set<string> } {
  return {
    library: new Set(Object.values(loadReaderBookFolderLinks())),
    notebook: new Set(Object.values(loadNotebookChatFolderLinks())),
  }
}

export function linkNotebookToChatFolder(notebookId: string, folderId: string): void {
  const links = loadNotebookChatFolderLinks()
  links[notebookId] = folderId
  saveNotebookChatFolderLinks(links)
}

export function unlinkNotebookFromChatFolder(notebookId: string): void {
  const links = loadNotebookChatFolderLinks()
  if (!(notebookId in links)) return
  delete links[notebookId]
  saveNotebookChatFolderLinks(links)
}

// Conversas existentes de uma pasta, na ordem dela: pelo vínculo
// (`folderId`, fonte de verdade) e pela lista de ordem, para que exclusões e
// fusões não deixem nenhuma para trás. Da lista de ordem só entram as
// conversas sem vínculo válido (legado ou pasta inexistente, como no
// reconcileOrders): uma lista defasada não leva conversa solta ou de outra pasta.
export function folderConversationIds(
  folder: ChatFolder,
  conversations: ChatConversation[],
  folders: ChatFolder[]
): string[] {
  const folderIds = new Set(folders.map((f) => f.id))
  const byId = new Map(conversations.map((c) => [c.id, c]))
  const ids = folder.conversationIds.filter((id) => {
    const c = byId.get(id)
    if (!c) return false
    if (c.folderId === undefined || c.folderId === folder.id) return true
    return c.folderId !== null && !folderIds.has(c.folderId)
  })
  for (const c of conversations) {
    if (c.folderId === folder.id && !ids.includes(c.id)) ids.push(c.id)
  }
  return ids
}

// Nome da pasta de chat de um caderno (cosmético; a resolução é pelo vínculo).
function notebookChatFolderName(title: string): string {
  return `Notebook - ${title.trim().slice(0, 90) || 'Untitled notebook'}`
}

// Funde a pasta `sourceId` em `destId`: as conversas da origem passam para o
// topo do destino, a memória da origem é anexada com título, o system prompt
// do destino fica e o web research vale se estiver ligado em qualquer uma. A
// origem sai da lista. null se uma das pastas não existe.
function mergeFolderList(
  folders: ChatFolder[],
  conversations: ChatConversation[],
  sourceId: string,
  destId: string
): { folders: ChatFolder[]; movedIds: Set<string> } | null {
  const source = folders.find((f) => f.id === sourceId)
  const dest = folders.find((f) => f.id === destId)
  if (!source || !dest || source === dest) return null
  const moved = folderConversationIds(source, conversations, folders)
  const movedIds = new Set(moved)
  const sourceMemory = source.memory.trim()
  const memory = sourceMemory
    ? [dest.memory.trim(), `## Merged from "${source.name}"\n${sourceMemory}`].filter(Boolean).join('\n\n')
    : dest.memory
  const merged: ChatFolder = {
    ...dest,
    conversationIds: [...moved, ...dest.conversationIds.filter((id) => !movedIds.has(id))],
    memory,
    webResearchEnabled: dest.webResearchEnabled || source.webResearchEnabled,
    updatedAt: new Date().toISOString(),
  }
  return {
    folders: folders.filter((f) => f.id !== sourceId).map((f) => (f.id === destId ? merged : f)),
    movedIds,
  }
}

// ─── Pastas de chat de cadernos excluídos ou movidos ─────────────────────────
// Instâncias `useChat` montadas nesta janela. Mudanças de pasta vindas de fora
// do chat (excluir ou mover caderno) passam por TODAS elas: gravar direto no
// localStorage seria desfeito pelo save-effect de uma instância montada (o
// evento `storage` só chega às outras janelas). Sem instância montada, o
// localStorage é editado direto.
interface MountedChat {
  hasFolder: (id: string) => boolean
  deleteFolder: (id: string) => void
  mergeFolderInto: (sourceId: string, destId: string) => void
  renameFolder: (id: string, name: string) => void
}
const mountedChats = new Set<{ current: MountedChat | null }>()

function chatFolderExists(folderId: string): boolean {
  const instances = [...mountedChats]
  if (instances.length > 0) return instances.some((i) => i.current?.hasFolder(folderId))
  return parseFolders(localStorage.getItem(FOLDERS_KEY)).some((f) => f.id === folderId)
}

// Quantas conversas a pasta de chat do caderno tem; null se ele não tem pasta.
// Para o texto da confirmação de exclusão do caderno.
export function countNotebookChatConversations(notebookId: string): number | null {
  const folderId = getNotebookChatFolderId(notebookId)
  const folders = folderId ? parseFolders(localStorage.getItem(FOLDERS_KEY)) : []
  const folder = folders.find((f) => f.id === folderId)
  if (!folder) return null
  return folderConversationIds(folder, parseConversations(localStorage.getItem(CONVERSATIONS_KEY)), folders).length
}

// Caderno excluído: apaga a pasta de chat dele com as conversas e desfaz o
// vínculo. Chamar DEPOIS de o caderno sair do estado, senão o chat das
// Anotações recria a pasta. Retorna o id da pasta (para apagar a pasta web
// dela) ou null se o caderno não tinha pasta.
export function deleteNotebookChatFolder(notebookId: string): string | null {
  const folderId = getNotebookChatFolderId(notebookId)
  if (!folderId) return null
  const instances = [...mountedChats]
  if (instances.length > 0) instances.forEach((i) => i.current?.deleteFolder(folderId))
  else deleteChatFolderById(folderId)
  unlinkNotebookFromChatFolder(notebookId)
  return folderId
}

// Caderno movido para dentro de outro (vira subject): a pasta de chat dele
// passa para o caderno de destino. Destino sem pasta: o vínculo do destino
// aponta para a pasta da origem, renomeada. Destino com pasta: a origem é
// fundida nela e apagada. Chamar DEPOIS de o caderno de origem sair do
// estado. Retorna o id da pasta da origem quando ela foi apagada (a pasta web
// dela não acompanha a fusão); senão null.
export function moveNotebookChatFolder(
  sourceNotebookId: string,
  destNotebookId: string,
  destTitle: string
): string | null {
  const sourceFolderId = getNotebookChatFolderId(sourceNotebookId)
  if (!sourceFolderId || !chatFolderExists(sourceFolderId)) {
    unlinkNotebookFromChatFolder(sourceNotebookId)
    return null
  }
  const instances = [...mountedChats]
  const destFolderId = getNotebookChatFolderId(destNotebookId)
  let deletedFolderId: string | null = null
  if (destFolderId && destFolderId !== sourceFolderId && chatFolderExists(destFolderId)) {
    if (instances.length > 0) {
      instances.forEach((i) => i.current?.mergeFolderInto(sourceFolderId, destFolderId))
    } else {
      const conversations = loadConversations()
      const merged = mergeFolderList(loadFolders(), conversations, sourceFolderId, destFolderId)
      if (merged) {
        // Pastas antes das conversas: ver deleteFolder no hook.
        saveFolders(merged.folders)
        saveConversations(
          conversations.map((c) => (merged.movedIds.has(c.id) ? { ...c, folderId: destFolderId } : c))
        )
      }
    }
    deletedFolderId = sourceFolderId
  } else {
    linkNotebookToChatFolder(destNotebookId, sourceFolderId)
    const name = notebookChatFolderName(destTitle)
    if (instances.length > 0) {
      instances.forEach((i) => i.current?.renameFolder(sourceFolderId, name))
    } else {
      saveFolders(
        loadFolders().map((f) =>
          f.id === sourceFolderId ? { ...f, name, updatedAt: new Date().toISOString() } : f
        )
      )
    }
  }
  unlinkNotebookFromChatFolder(sourceNotebookId)
  return deletedFolderId
}

// Remove uma PASTA inteira diretamente do localStorage (pasta + conversas +
// arquivos de documentos anexados + ordem solta). ATENÇÃO: este helper
// manipula o localStorage diretamente e NÃO atualiza instâncias `useChat`
// montadas na MESMA janela (o evento `storage` só dispara em outras janelas).
// Usar apenas em fluxos onde nenhum `useChat` está montado — ex.: cascata de
// deleção de livro no Library (Library e ChatPanel vivem em modos mutuamente
// exclusivos do App).
export function deleteChatFolderById(folderId: string): void {
  const folders = loadFolders()
  const folder = folders.find((f) => f.id === folderId)
  if (!folder) return
  const conversations = loadConversations()
  const convIdsToDelete = new Set(folderConversationIds(folder, conversations, folders))
  // Mesma limpeza de documentos anexados do deleteFolder do hook.
  for (const conv of conversations) {
    if (!convIdsToDelete.has(conv.id)) continue
    for (const msg of conv.messages) {
      for (const doc of msg.attachedDocs ?? []) {
        void invoke('delete_chat_doc', { path: doc.path }).catch(() => {
          /* ignorar erros */
        })
      }
    }
  }
  // Pastas antes das conversas: ver deleteFolder no hook.
  saveFolders(folders.filter((f) => f.id !== folderId))
  saveConversations(conversations.filter((c) => !convIdsToDelete.has(c.id)))
  saveLooseOrder(loadLooseOrder().filter((id) => !convIdsToDelete.has(id)))
}

export function activateChatConversation(conversationId: string): void {
  try {
    localStorage.setItem(ACTIVE_ID_KEY, conversationId)
  } catch (err) {
    console.error('failed to persist active chat id', err)
  }
}

export function createPreloadedChatConversation(params: {
  title: string
  userMessage: string
  assistantMessage: string
}): string {
  const id = nanoid()
  const now = new Date().toISOString()
  const conv: ChatConversation = {
    id,
    title: params.title,
    messages: [
      {
        id: nanoid(),
        role: 'user',
        content: params.userMessage,
        timestamp: now,
      },
      {
        id: nanoid(),
        role: 'assistant',
        content: params.assistantMessage,
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    folderId: null,
  }
  const existing = loadConversations()
  saveConversations([conv, ...existing])
  const looseExisting = loadLooseOrder()
  saveLooseOrder([id, ...looseExisting])
  try {
    localStorage.setItem(ACTIVE_ID_KEY, id)
  } catch (err) {
    console.error('failed to persist active chat id', err)
  }
  return id
}

// Nome da pasta de chat usada pelas conversas iniciadas na janela assistant.
export const ASSISTANT_FOLDER_NAME = 'assistant'

function makeNewConversation(folderId: string | null = null): ChatConversation {
  const now = new Date().toISOString()
  return {
    id: nanoid(),
    title: 'New conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
    folderId,
  }
}

function makeNewFolder(name = 'New folder'): ChatFolder {
  const now = new Date().toISOString()
  return {
    id: nanoid(),
    name,
    conversationIds: [],
    visibleDocumentIds: [],
    expanded: true,
    systemPrompt: '',
    systemPromptMode: 'replace',
    memory: '',
    memoryEnabled: false,
    webResearchEnabled: false,
    createdAt: now,
    updatedAt: now,
  }
}

// Consolida pastas `assistant` DUPLICADAS num unico registro. Iteracoes de
// teste antigas acumularam mais de uma pasta com o mesmo nome no localStorage;
// com duplicatas, modal/send/materializacao podiam referenciar instancias
// diferentes (prompt gravado numa, lido de outra). Aqui mantemos UMA pasta
// (a primeira por ordem), priorizando systemPrompt/visibleDocumentIds ja
// configurados, e unindo os `conversationIds` de todas. Idempotente: sem
// duplicatas, retorna o array inalterado (mesma referencia). As pastas por
// escopo (livro/caderno) NAO passam por aqui: sao resolvidas por folderId, entao
// nomes duplicados (dois livros/cadernos com o mesmo titulo) sao apenas cosmeticos.
function dedupeAssistantFolders(folders: ChatFolder[]): ChatFolder[] {
  const assistantFolders = folders.filter((f) => f.name === ASSISTANT_FOLDER_NAME)
  if (assistantFolders.length <= 1) return folders

  // Prioriza a pasta com systemPrompt, documentos ou memoria configurados; senao a 1a.
  const primary =
    assistantFolders.find(
      (f) =>
        f.systemPrompt.trim().length > 0 ||
        f.visibleDocumentIds.length > 0 ||
        f.memory.trim().length > 0 ||
        f.memoryEnabled
    ) ?? assistantFolders[0]

  // Une conversationIds de todas as duplicatas (sem repetir), preservando ordem.
  const mergedConvIds: string[] = []
  const seen = new Set<string>()
  for (const f of assistantFolders) {
    for (const id of f.conversationIds) {
      if (seen.has(id)) continue
      seen.add(id)
      mergedConvIds.push(id)
    }
  }

  const consolidated: ChatFolder = {
    ...primary,
    conversationIds: mergedConvIds,
  }

  // Reconstroi a lista mantendo a posicao da pasta `primary` e removendo as
  // demais pastas `assistant`.
  const out: ChatFolder[] = []
  let placed = false
  for (const f of folders) {
    if (f.name === ASSISTANT_FOLDER_NAME) {
      if (!placed) {
        out.push(consolidated)
        placed = true
      }
      continue
    }
    out.push(f)
  }
  return out
}

// Reconcilia o estado de chat em torno da FONTE DE VERDADE da vinculação:
// `conversation.folderId`. As listas de ordem (folder.conversationIds e
// looseOrder) são apenas apresentação e são RECONSTRUÍDAS a partir da
// vinculação — nunca o contrário. Consequências:
// - uma conversa com folderId válido SEMPRE aparece na pasta, mesmo que uma
//   escrita defasada de FOLDERS_KEY (outra janela) tenha perdido o id dela
//   na lista de ordem — era a causa do "chat órfão" do leitor;
// - conversas legadas (folderId undefined) herdam a pasta das listas de
//   ordem persistidas (backfill em memória; persiste na próxima gravação);
// - folderId apontando para pasta inexistente: adota a pasta que ainda
//   listar a conversa na ordem (ex.: pastas `assistant` deduplicadas) ou
//   cai para a lista solta.
// Determinística e idempotente: reaplicar sobre o próprio output devolve o
// mesmo conteúdo (e preserva identidade dos itens inalterados) — requisito
// do efeito de reparo local e do anti-eco cross-window.
function reconcileOrders(
  conversations: ChatConversation[],
  folders: ChatFolder[],
  looseOrder: string[]
): {
  conversations: ChatConversation[]
  folders: ChatFolder[]
  looseOrder: string[]
} {
  // Consolida pastas `assistant` duplicadas ANTES de reconciliar, garantindo
  // que o estado nunca carregue mais de uma pasta `assistant` (raiz do bug do
  // system prompt nao aplicado: prompt gravado numa pasta, lido de outra).
  folders = dedupeAssistantFolders(folders)

  const folderIds = new Set(folders.map((f) => f.id))
  // Vinculação implícita nas listas de ordem (1ª pasta que listar a conversa
  // vence) — usada para backfill de legado e re-adoção após dedupe.
  const orderMembership = new Map<string, string>()
  for (const f of folders) {
    for (const id of f.conversationIds) {
      if (!orderMembership.has(id)) orderMembership.set(id, f.id)
    }
  }

  // 1) Normaliza folderId de cada conversa (identidade preservada se nada
  // muda). IMPORTANTE: folderId apontando para pasta AUSENTE não é reescrito
  // para null — a ausência pode ser transitória (ex.: a pasta foi criada em
  // outra janela e o evento de FOLDERS_KEY ainda não chegou); reescrever
  // destruiria o vínculo. A conversa só é EXIBIDA na lista solta enquanto a
  // pasta não existe (passo 3). Reescreve-se apenas de forma construtiva:
  // backfill de legado (undefined) e re-adoção pela pasta que ainda lista a
  // conversa na ordem (ex.: pastas `assistant` deduplicadas).
  const nextConversations = conversations.map((c) => {
    if (c.folderId === undefined) {
      return { ...c, folderId: orderMembership.get(c.id) ?? null }
    }
    if (c.folderId !== null && !folderIds.has(c.folderId)) {
      const adopted = orderMembership.get(c.id)
      if (adopted) return { ...c, folderId: adopted }
    }
    return c
  })
  const byId = new Map(nextConversations.map((c) => [c.id, c]))

  // 2) Reconstrói a ordem de cada pasta: mantém a ordem persistida das
  // conversas que continuam vinculadas e PREPENDA as vinculadas ainda fora
  // da lista (recém-materializadas ou resgatadas de uma escrita defasada).
  const nextFolders = folders.map((f) => {
    const keptSet = new Set<string>()
    const kept = f.conversationIds.filter((id) => {
      if (keptSet.has(id)) return false
      if (byId.get(id)?.folderId !== f.id) return false
      keptSet.add(id)
      return true
    })
    const missing = nextConversations
      .filter((c) => c.folderId === f.id && !keptSet.has(c.id))
      .map((c) => c.id)
    return { ...f, conversationIds: [...missing, ...kept] }
  })

  // 3) Lista solta: conversas sem pasta — ou com pasta AUSENTE (vínculo
  // preservado; ver passo 1) — na ordem persistida; novas no topo.
  const isLoose = (c: ChatConversation) =>
    c.folderId == null || !folderIds.has(c.folderId)
  const looseIds = new Set(
    nextConversations.filter(isLoose).map((c) => c.id)
  )
  const keptLooseSet = new Set<string>()
  const keptLoose = looseOrder.filter((id) => {
    if (keptLooseSet.has(id)) return false
    if (!looseIds.has(id)) return false
    keptLooseSet.add(id)
    return true
  })
  const missingLoose = nextConversations
    .filter((c) => isLoose(c) && !keptLooseSet.has(c.id))
    .map((c) => c.id)

  return {
    conversations: nextConversations,
    folders: nextFolders,
    looseOrder: [...missingLoose, ...keptLoose],
  }
}

// Estado inicial reconciliado (conversas + pastas + ordem solta) a partir do
// localStorage. Pura e barata: pode ser chamada por cada useState initializer.
function loadReconciledChatState(): {
  conversations: ChatConversation[]
  folders: ChatFolder[]
  looseOrder: string[]
} {
  return reconcileOrders(loadConversations(), loadFolders(), loadLooseOrder())
}

export interface UseChatResult {
  conversations: ChatConversation[]
  folders: ChatFolder[]
  looseConversationIds: string[]
  activeId: string | null
  activeConversation: ChatConversation | null
  messages: ChatMessage[]
  model: string | null
  setModel: (id: string | null) => void
  hasApiKey: boolean
  apiKeyChecked: boolean
  refreshApiKey: () => Promise<boolean>
  tools: ChatTools
  setTool: (key: keyof ChatTools, value: boolean) => void
  isStreaming: boolean
  deepResearchPhase: DeepResearchPhase | null
  webSearchActive: boolean
  // Recuperação do RAG em andamento (antes do 1º token).
  ragSearching: boolean
  // Trace do inspetor por id de mensagem assistant; só em memória e só com
  // o modo detalhado ligado.
  ragTraces: Record<string, RagResponse>
  thinkingEnabled: boolean
  toggleThinking: () => void
  error: string | null
  send: (
    text: string,
    imageDataUrl?: string,
    documents?: Array<{ name: string; type: string; data: string }>,
    opts?: { ephemeralContext?: string; excludeNoteId?: string | null }
  ) => Promise<void>
  cancel: () => void
  selectConversation: (id: string) => void
  newConversation: () => void
  newConversationInFolder: (folderId: string) => void
  // Cria um rascunho de conversa (memoria) para instancias dedicadas;
  // `folderId` fixa a pasta de destino da materializacao (modos reader/notes).
  startAssistantConversation: (folderId?: string) => void
  ensureAssistantFolder: () => void
  ensureScopedFolder: (scope: ChatFolderScope) => string
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  createFolder: () => string
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  setFolderExpanded: (id: string, expanded: boolean) => void
  setFolderSystemPrompt: (
    folderId: string,
    text: string,
    mode: SystemPromptMode
  ) => void
  setFolderVisibleDocuments: (folderId: string, visibleDocumentIds: string[]) => void
  // Seleção de documentos da pasta: pasta vinculada a caderno → tabela do
  // caderno; senão `folder.visibleDocumentIds`.
  getFolderVisibleDocumentIds: (folderId: string) => string[]
  getFolderNotebookId: (folderId: string) => string | null
  setFolderMemory: (folderId: string, text: string) => void
  setFolderMemoryEnabled: (folderId: string, enabled: boolean) => void
  setFolderWebResearchEnabled: (folderId: string, enabled: boolean) => void
  folderMemoryUpdatedAt: number | null
  webSourcesSaved: { count: number; at: number } | null
  moveConversation: (
    convId: string,
    target: { type: 'loose'; index?: number } | { type: 'folder'; folderId: string; index?: number }
  ) => void
  removeConversationFromFolder: (convId: string) => void
  reorderFolders: (newOrder: string[]) => void
  reorderInFolder: (folderId: string, newOrder: string[]) => void
  reorderLoose: (newOrder: string[]) => void
}

// Escopo de uma pasta de chat dedicada: um livro (Reader) ou um caderno
// (chat das Anotações). Ver `ensureScopedFolder`.
export type ChatFolderScope = { kind: 'book' | 'notebook'; id: string; title: string }

// ─── Tools "Daily notes" (get_day, notes_by_date) ────────────────────────────
// Orçamento total de conteúdo das notas por chamada; cada nota leva uma parte.
const NOTES_TOOL_BUDGET = 24000
const NOTES_TOOL_MIN_SHARE = 1500
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function foldText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Notas do período (nota diária do Calendar + notas datadas, de qualquer
// caderno com indexação de IA ligada), como texto para a IA. Cada nota vira
// uma fonte [n] em `sources` (numeração contínua da resposta).
async function notesByDateText(
  from: string,
  to: string,
  notebook: string | undefined,
  sources: RagSource[]
): Promise<string> {
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) return 'Invalid date: use YYYY-MM-DD.'
  if (from > to) [from, to] = [to, from]
  const [notes, notebooks, summaries, disabledIds] = await Promise.all([
    storage.getNotesByDateRange(from, to),
    storage.getNotebooks(),
    storage.getNoteSummaries(),
    notesIndexGetDisabledNotebooks(),
  ])
  const disabled = new Set(disabledIds)
  const notebookName = new Map(notebooks.map((nb) => [nb.id, nb.name]))
  const titles = new Map(summaries.map((n) => [n.id, n.title]))
  const wanted = notebook ? foldText(notebook) : ''
  const picked = notes
    .filter((n) => n.notebookId === null || !disabled.has(n.notebookId))
    .filter((n) => !wanted || foldText(notebookName.get(n.notebookId ?? '') ?? '').includes(wanted))
    .map((n) => ({ note: n, date: noteDate(n) ?? '' }))
    // Por data; no mesmo dia, a nota diária primeiro.
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Number(b.note.notebookId === CALENDAR_NOTEBOOK_ID) - Number(a.note.notebookId === CALENDAR_NOTEBOOK_ID)
    )
  if (picked.length === 0) return 'No notes found for this period.'

  const contents = picked.map((p) => p.note.content)
  const [embeds, imageTexts] = await Promise.all([
    loadEmbedResponses(contents),
    ocrTextsForContent(contents.join('\n')),
  ])
  const share = Math.max(NOTES_TOOL_MIN_SHARE, Math.floor(NOTES_TOOL_BUDGET / picked.length))
  const blocks: string[] = []
  let used = 0
  let omitted = 0
  for (const { note, date } of picked) {
    if (used >= NOTES_TOOL_BUDGET) {
      omitted++
      continue
    }
    let body = cleanNoteContentForAi(note.content, {
      resolveNoteTitle: (id) => titles.get(id),
      resolveEmbed: (id) => embeds.get(id),
      resolveImageText: (url) => imageTexts.get(url),
    }).trim()
    const cap = Math.min(share, NOTES_TOOL_BUDGET - used)
    if (body.length > cap) body = `${body.slice(0, cap)} [truncated]`
    used += body.length
    const title = note.title.trim() || 'Untitled'
    const folder = note.notebookId ? `Notes — ${notebookName.get(note.notebookId) ?? 'Untitled'}` : undefined
    const n = citeSource(sources, {
      documentId: `note:${note.id}`,
      title,
      kind: 'note',
      date: date.slice(0, 10) || undefined,
      folder,
      rowids: [],
    })
    const header = [title, 'note', date, folder].filter(Boolean).join(' · ')
    blocks.push(`[${n}] [${header}]\n${body || '(empty note)'}`)
  }
  if (omitted > 0) blocks.push(`(${omitted} more note(s) omitted: content budget reached; ask for a shorter period.)`)
  return blocks.join('\n---\n')
}

export function useChat(
  models: AiModel[] = [],
  options?: {
    mode?: 'main' | 'assistant' | 'reader' | 'notes'
    // Chat principal, NotesChat e Assistant passam: habilita a tool "Tasks".
    // O Assistant carrega do storage (assíncrono), por não ter o estado da main.
    getTasksSnapshot?: () => TasksSnapshot | Promise<TasksSnapshot>
  }
): UseChatResult {
  const mode = options?.mode ?? 'main'
  const getTasksSnapshotRef = useRef(options?.getTasksSnapshot)
  getTasksSnapshotRef.current = options?.getTasksSnapshot
  // Instancias "detached" (assistant/reader/notes) vivem fora do ChatPanel principal
  // e nao leem/gravam o ACTIVE_ID_KEY compartilhado: "qual conversa esta
  // ativa" e per-instancia.
  const isDetached = mode !== 'main'
  // Modos com pasta por escopo (uma pasta por livro/caderno).
  const isScopedMode = mode === 'reader' || mode === 'notes'
  // Pasta dedicada por NOME (so o assistant): conversas dessa instancia sao
  // materializadas dentro dela no 1o envio. Os modos reader/notes usam pasta
  // por ID (uma pasta por livro/caderno — ver scopedFolderIdRef/ensureScopedFolder).
  const dedicatedFolderName =
    mode === 'assistant' ? ASSISTANT_FOLDER_NAME : null
  // Estado inicial reconciliado entre conversas + folders + looseOrder
  const [conversations, setConversations] = useState<ChatConversation[]>(
    () => loadReconciledChatState().conversations
  )
  // Conversa-rascunho da janela assistant: vive SO em memoria ate a 1a mensagem.
  // Abrir/fechar o assistant sem enviar nada nao deixa rastro no localStorage.
  const [draftConversation, setDraftConversation] = useState<ChatConversation | null>(null)
  const draftRef = useRef<ChatConversation | null>(null)
  draftRef.current = draftConversation
  const [folders, setFoldersState] = useState<ChatFolder[]>(
    () => loadReconciledChatState().folders
  )
  const [looseOrder, setLooseOrderState] = useState<string[]>(
    () => loadReconciledChatState().looseOrder
  )

  const [activeId, setActiveIdState] = useState<string | null>(() => {
    // Instancias detached nao leem o ACTIVE_ID_KEY compartilhado: comecam sem
    // conversa ativa (o dono da instancia seleciona/cria a conversa dele).
    if (isDetached) return null
    const saved = localStorage.getItem(ACTIVE_ID_KEY)
    return saved && saved.length > 0 ? saved : null
  })
  const [model, setModelState] = useState<string | null>(
    () => localStorage.getItem(MODEL_KEY)
  )
  const [storedTools, setToolsState] = useState<ChatTools>(() => loadTools())
  // O estado das tools é compartilhado entre os chats (localStorage), mas o
  // NotesChat não tem UI de Deep Research: força desligado só aqui, sem gravar.
  const tools =
    mode === 'notes' && storedTools.deepResearch
      ? { ...storedTools, deepResearch: false }
      : storedTools
  const toolsRef = useRef<ChatTools>(tools)
  toolsRef.current = tools
  const [hasApiKey, setHasApiKey] = useState<boolean>(false)
  const [apiKeyChecked, setApiKeyChecked] = useState<boolean>(false)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [deepResearchPhase, setDeepResearchPhase] = useState<DeepResearchPhase | null>(null)
  const [webSearchActive, setWebSearchActive] = useState<boolean>(false)
  const [ragSearching, setRagSearching] = useState<boolean>(false)
  const [ragTraces, setRagTraces] = useState<Record<string, RagResponse>>({})
  const [folderMemoryUpdatedAt, setFolderMemoryUpdatedAt] = useState<number | null>(null)
  const [webSourcesSaved, setWebSourcesSaved] = useState<{ count: number; at: number } | null>(null)
  const toolCallHandlerRef = useRef<((p: StreamToolCallPayload) => void) | null>(null)
  const toolCancelledRef = useRef<boolean>(false)
  // Contexto do bibliotecário capturado por turno (nos dois caminhos de busca),
  // consumido em onOpenRouterDone para disparar o pipeline em background.
  // Vive num ref por hook (o estado in-flight/serialização mora no singleton
  // src/lib/librarian.ts). Resetado no início de send() e em error/cancel.
  const librarianContextRef = useRef<{
    chatFolderId: string
    folderName: string
    webResearchEnabled: boolean
    question: string
    searchResults: SearchResult[]
  } | null>(null)
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const activeStreamRef = useRef<{
    requestId: string
    convId: string
    assistantId: string
    model: string
  } | null>(null)
  const conversationsRef = useRef<ChatConversation[]>(conversations)
  conversationsRef.current = conversations
  const foldersRef = useRef<ChatFolder[]>(folders)
  foldersRef.current = folders
  const looseOrderRef = useRef<string[]>(looseOrder)
  looseOrderRef.current = looseOrder
  // Modos reader/notes: id da pasta do escopo atual (livro/caderno, setado por
  // ensureScopedFolder). E ref (nao state) porque so o send() precisa dele,
  // sem re-render.
  const scopedFolderIdRef = useRef<string | null>(null)

  // Mapa `${kind}:${id}` → folderId para criacoes ainda nao commitadas no
  // estado. O setTimeout do React pode fazer com que a pasta ainda nao esteja
  // visivel em `folders` enquanto o recovery-effect do painel (Reader/Notas)
  // ja chama ensureScopedFolder de novo. Este mapa impede a criacao de pastas
  // duplicadas nessa janela.
  const pendingScopedFolderIds = useRef<Map<string, string>>(new Map())

  // Se a pasta do escopo for apagada (ex.: no ChatPanel de outra janela) e a
  // remocao ja estiver refletida no estado, limpa o ref para que o proximo
  // ensureScopedFolder RECRIE a pasta em vez de devolver um id morto.
  // (Enquanto a criacao de uma pasta ainda nao foi commitada, `folders` nunca
  // e observado sem ela — ver a guarda de criacao pendente no ensure.)
  useEffect(() => {
    if (!isScopedMode) return
    const rid = scopedFolderIdRef.current
    if (rid && !folders.some((f) => f.id === rid)) {
      // So limpa se nao ha criacao pendente que referencia este id.
      // Se houver, o ensureScopedFolder cuida de reatribuir o ref
      // quando a pasta aparecer no estado.
      let hasPending = false
      for (const pid of pendingScopedFolderIds.current.values()) {
        if (pid === rid) { hasPending = true; break }
      }
      if (!hasPending) {
        scopedFolderIdRef.current = null
      }
    }
  }, [folders, isScopedMode])

  // Seleção de documentos das pastas vinculadas a caderno (chatFolderId →
  // ids), espelho da tabela `notebook_document_visibility`. Só serve à UI
  // (badge/seletor); o send() relê a tabela a cada envio.
  const [linkedVisibility, setLinkedVisibility] = useState<Record<string, string[]>>({})
  const linkedVisibilitySeqRef = useRef(0)

  // Recarrega da tabela as pastas vinculadas existentes. Com `notebookId`,
  // só a entrada desse caderno (mesclada); sem, todas (substitui o mapa).
  const reloadLinkedVisibility = useCallback(async (notebookId?: string) => {
    const folderIds = new Set(foldersRef.current.map((f) => f.id))
    const pairs = Object.entries(loadNotebookChatFolderLinks()).filter(
      ([nb, folderId]) => folderIds.has(folderId) && (!notebookId || nb === notebookId)
    )
    // Só cargas completas entram na sequência (a mais recente vence).
    const seq = notebookId ? linkedVisibilitySeqRef.current : ++linkedVisibilitySeqRef.current
    try {
      const loaded = await Promise.all(
        pairs.map(async ([nb, folderId]) => [folderId, await getNotebookVisibleDocumentIds(nb)] as const)
      )
      if (!notebookId && seq !== linkedVisibilitySeqRef.current) return
      const next = Object.fromEntries(loaded)
      setLinkedVisibility((prev) => (notebookId ? { ...prev, ...next } : next))
    } catch (err) {
      console.warn('failed to load notebook visibility for linked chat folders', err)
    }
  }, [])

  // Carga quando o conjunto de pastas vinculadas muda (não a cada update de
  // `folders`, que muda a todo envio).
  const linkedPairsKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const folderIds = new Set(folders.map((f) => f.id))
    const key = JSON.stringify(
      Object.entries(loadNotebookChatFolderLinks()).filter(([, folderId]) => folderIds.has(folderId))
    )
    if (key === linkedPairsKeyRef.current) return
    linkedPairsKeyRef.current = key
    void reloadLinkedVisibility()
  }, [folders, reloadLinkedVisibility])

  // Recarga: o evento de visibilidade só dispara na janela que gravou; as
  // outras janelas (ex.: a assistant oculta) recarregam no `focus` e quando o
  // vínculo muda em outra janela (`storage`).
  useEffect(() => {
    function onVisibilityChanged(e: Event) {
      const notebookId = (e as CustomEvent<{ notebookId?: string }>).detail?.notebookId
      if (notebookId) void reloadLinkedVisibility(notebookId)
    }
    function onFocus() {
      void reloadLinkedVisibility()
    }
    function onStorage(e: StorageEvent) {
      if (e.key === NOTEBOOK_CHAT_FOLDER_LINK_KEY) void reloadLinkedVisibility()
    }
    window.addEventListener(NOTEBOOK_VISIBILITY_CHANGED_EVENT, onVisibilityChanged)
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(NOTEBOOK_VISIBILITY_CHANGED_EVENT, onVisibilityChanged)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
    }
  }, [reloadLinkedVisibility])

  // Mescla a lista remota (vinda do `storage` da outra janela) preservando a
  // conversa que ESTA janela esta gerando agora. Durante o streaming, a outra
  // janela ecoa uma copia levemente ATRASADA de `CONVERSATIONS_KEY`; sem essa
  // protecao, esse eco sobrescreveria a mensagem em andamento e a resposta
  // apareceria truncada (BUG 2). As demais conversas recebem a versao remota
  // normalmente.
  const mergeRemoteConversations = useCallback(
    (remote: ChatConversation[]): ChatConversation[] => {
      const streamingId = activeStreamRef.current?.convId
      if (!streamingId) return remote
      const local = conversationsRef.current.find((c) => c.id === streamingId)
      if (!local) return remote
      return remote.map((c) => (c.id === streamingId ? local : c))
    },
    []
  )

  // Auto-expand pasta da conversa ativa ao montar (1x)
  const autoExpandedOnMountRef = useRef(false)
  useEffect(() => {
    if (autoExpandedOnMountRef.current) return
    if (!activeId) return
    autoExpandedOnMountRef.current = true
    const folder = foldersRef.current.find((f) =>
      f.conversationIds.includes(activeId)
    )
    if (folder && !folder.expanded) {
      setFoldersState((prev) =>
        prev.map((f) =>
          f.id === folder.id ? { ...f, expanded: true } : f
        )
      )
    }
  }, [activeId])

  const setFolders = useCallback(
    (updater: ChatFolder[] | ((prev: ChatFolder[]) => ChatFolder[])) => {
      setFoldersState(updater)
    },
    []
  )

  const setLooseOrder = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      setLooseOrderState(updater)
    },
    []
  )

  // Garante que activeId aponta pra uma conversa existente. O rascunho do
  // assistant (so em memoria) e um alvo valido mesmo nao estando em
  // `conversations`, entao nao deve ser resetado aqui.
  useEffect(() => {
    if (
      activeId &&
      !conversations.some((c) => c.id === activeId) &&
      draftConversation?.id !== activeId
    ) {
      // Instancias detached NAO caem para uma conversa alheia (ex.: a conversa
      // do livro apagada em outra janela nao pode fazer o leitor "pular" para
      // outra conversa qualquer): caem para null e o dono da instancia decide.
      setActiveIdState(isDetached ? null : conversations[0]?.id ?? null)
    }
  }, [conversations, activeId, draftConversation, isDetached])

  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  useEffect(() => {
    saveFolders(folders)
  }, [folders])

  useEffect(() => {
    saveLooseOrder(looseOrder)
  }, [looseOrder])

  // Reparo de invariante: mantém as listas de ordem coerentes com a fonte de
  // verdade (conversation.folderId) a cada mudança de estado — inclusive após
  // hidratação via evento `storage` (o handler abaixo hidrata só a chave que
  // mudou e delega a coerência a este efeito). Como reconcileOrders é
  // idempotente e preserva identidade/conteúdo quando nada muda, os setState
  // condicionais abaixo não re-disparam o efeito em estado já consistente.
  useEffect(() => {
    const r = reconcileOrders(conversations, folders, looseOrder)
    const convsChanged =
      r.conversations.length !== conversations.length ||
      r.conversations.some((c, i) => c !== conversations[i])
    if (convsChanged) setConversations(r.conversations)
    if (JSON.stringify(r.folders) !== JSON.stringify(folders)) {
      setFoldersState(r.folders)
    }
    if (JSON.stringify(r.looseOrder) !== JSON.stringify(looseOrder)) {
      setLooseOrderState(r.looseOrder)
    }
  }, [conversations, folders, looseOrder])

  useEffect(() => {
    // Instancias detached (assistant/reader) nao devem restaurar nem clobberar
    // o ACTIVE_ID_KEY compartilhado da janela principal. "Qual conversa esta
    // ativa" e per-janela/per-instancia.
    if (isDetached) return
    // Mesma guarda anti-loop por comparacao de conteudo dos demais save-effects.
    const current = localStorage.getItem(ACTIVE_ID_KEY)
    if (activeId) {
      if (current !== activeId) localStorage.setItem(ACTIVE_ID_KEY, activeId)
    } else if (current !== null) {
      localStorage.removeItem(ACTIVE_ID_KEY)
    }
  }, [activeId])

  // Sync cross-window: o evento `storage` dispara apenas nas OUTRAS janelas da
  // mesma origem. Quando a outra janela grava nas chaves de chat, recarregamos
  // o valor canonico do localStorage e re-hidratamos o estado. O anti-eco fica
  // nos save-effects (comparacao de conteudo nos save-helpers): hidratar a
  // partir do proprio localStorage gera a mesma string serializada, entao os
  // save-effects nao re-gravam e nao disparam um novo evento `storage`. A
  // protecao do streaming (BUG 2) e o `mergeRemoteConversations`, que preserva
  // a conversa que ESTA janela esta gerando contra a copia atrasada da outra.
  useEffect(() => {
    function handler(e: StorageEvent) {
      if (e.key === null) return
      if (
        e.key !== CONVERSATIONS_KEY &&
        e.key !== FOLDERS_KEY &&
        e.key !== LOOSE_ORDER_KEY
      ) {
        // Outras chaves (ex.: ACTIVE_ID_KEY) NAO sao sincronizadas: "qual
        // conversa esta ativa" e per-janela.
        return
      }
      // Hidrata a partir do PROPRIO evento (e.newValue e o valor autoritativo
      // da escrita remota) — nunca relendo o localStorage aqui: entre
      // processos a releitura pode vir defasada e ressuscitar estado antigo.
      // So a chave alterada e hidratada; a coerencia vinculacao↔ordem fica a
      // cargo do efeito de reparo (reconcileOrders) acima.
      lastKnownValues.set(e.key, e.newValue ?? '')
      if (e.key === CONVERSATIONS_KEY) {
        setConversations(mergeRemoteConversations(parseConversations(e.newValue)))
      } else if (e.key === FOLDERS_KEY) {
        setFoldersState(dedupeAssistantFolders(parseFolders(e.newValue)))
      } else {
        setLooseOrderState(parseLooseOrder(e.newValue))
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const setModel = useCallback((id: string | null) => {
    setModelState(id)
    if (id) localStorage.setItem(MODEL_KEY, id)
    else localStorage.removeItem(MODEL_KEY)
  }, [])

  const setTool = useCallback((key: keyof ChatTools, value: boolean) => {
    setToolsState((prev) => {
      const next = { ...prev, [key]: value }
      saveTools(next)
      return next
    })
  }, [])

  const refreshApiKey = useCallback(async () => {
    const present = await hasOpenRouterKey()
    setHasApiKey(present)
    setApiKeyChecked(true)
    return present
  }, [])

  useEffect(() => {
    void refreshApiKey()
  }, [refreshApiKey])

  const selectConversation = useCallback((id: string) => {
    setActiveIdState(id)
    // Se a conversa esta em pasta colapsada, expande
    const folder = foldersRef.current.find((f) =>
      f.conversationIds.includes(id)
    )
    if (folder && !folder.expanded) {
      setFolders((prev) =>
        prev.map((f) => (f.id === folder.id ? { ...f, expanded: true } : f))
      )
    }
  }, [setFolders])

  const newConversation = useCallback(() => {
    const conv = makeNewConversation()
    setConversations((prev) => [conv, ...prev])
    setLooseOrder((prev) => [conv.id, ...prev])
    setActiveIdState(conv.id)
  }, [setLooseOrder])

  const newConversationInFolder = useCallback(
    (folderId: string) => {
      const conv = makeNewConversation(folderId)
      setConversations((prev) => [conv, ...prev])
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? {
                ...f,
                conversationIds: [conv.id, ...f.conversationIds],
                expanded: true,
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      )
      setActiveIdState(conv.id)
    },
    [setFolders]
  )

  // Inicia uma conversa NOVA e zerada para uma instancia dedicada
  // (assistant/reader). Persistencia preguiçosa: a conversa-rascunho vive SO
  // em memoria e NAO toca o localStorage. Ela so e materializada quando o
  // usuario envia a 1a mensagem (ver `send`). Abrir/fechar sem enviar nao
  // deixa rastro nem cria conversa vazia. `folderId` fixa desde ja a pasta de
  // destino do rascunho (modo reader: a pasta do livro; modo assistant: a
  // pasta do seletor); sem ele, o send() resolve a pasta dedicada por nome
  // (modo assistant).
  const startAssistantConversation = useCallback((folderId?: string) => {
    const conv = makeNewConversation(folderId ?? null)
    setDraftConversation(conv)
    setActiveIdState(conv.id)
  }, [])

  // Garante (idempotente, por nome) a pasta `assistant` no estado React, sem
  // vincular conversa. Usado pelos modais de system prompt/RAG da janela
  // assistant para configurar a pasta ANTES de enviar a 1a mensagem.
  const ensureAssistantFolder = useCallback(() => {
    setFolders((prev) => {
      if (prev.some((f) => f.name === ASSISTANT_FOLDER_NAME)) return prev
      const folder = makeNewFolder(ASSISTANT_FOLDER_NAME)
      return [folder, ...prev]
    })
  }, [setFolders])

  // Garante (idempotente) a PASTA DO ESCOPO (livro no Reader, caderno nas
  // Anotações) e retorna o id dela. Resolve pelo vinculo escopo → folderId em
  // localStorage; se o vinculo nao existe ou a pasta foi apagada, cria uma
  // pasta nova e regrava o vinculo.
  // - Livro: nome "Library - <titulo>" (cosmetico) com o system prompt do
  //   auxiliar de leitura (modo `replace`), gravado SO na criacao — depois
  //   disso a pasta e do usuario (modais de pasta no painel do Reader).
  // - Caderno: nome "Notebook - <titulo>", sem system prompt proprio (o send
  //   usa o prompt padrao).
  // Seguro a cada troca de livro/caderno: so reaponta o ref do escopo atual,
  // sem tocar em conversas nem no stream em andamento.
  const ensureScopedFolder = useCallback(
    (scope: ChatFolderScope): string => {
      const isBook = scope.kind === 'book'
      const pendingKey = `${scope.kind}:${scope.id}`
      const linkedId = isBook
        ? getReaderChatFolderId(scope.id)
        : getNotebookChatFolderId(scope.id)
      if (linkedId) {
        const existing = foldersRef.current.find((f) => f.id === linkedId)
        if (existing) {
          scopedFolderIdRef.current = existing.id
          pendingScopedFolderIds.current.delete(pendingKey)
          return existing.id
        }
        // Criacao deste mesmo vinculo ainda pendente de commit (ex.: chamadas
        // duplicadas no mesmo tick / StrictMode): nao duplica a pasta.
        if (scopedFolderIdRef.current === linkedId) {
          return linkedId
        }
        // Guarda adicional: criacao pendente mapeada — cobre o cenario em que
        // o efeito de limpeza zerou scopedFolderIdRef entre a criacao e o
        // commit do estado (causa dos bugs de pasta duplicada e chat fora da
        // pasta). Reaponta o ref: com troca de escopo (A → B → A) ele pode
        // estar no escopo anterior.
        const pendingId = pendingScopedFolderIds.current.get(pendingKey)
        if (pendingId) {
          scopedFolderIdRef.current = pendingId
          return pendingId
        }
      }
      // Criacao pendente para este escopo (fallback: linkedId pode ser null
      // na primeira chamada, mas uma chamada concorrente ja criou e mapeou).
      const pendingFallback = pendingScopedFolderIds.current.get(pendingKey)
      if (pendingFallback) {
        scopedFolderIdRef.current = pendingFallback
        return pendingFallback
      }
      let folder: ChatFolder
      if (isBook) {
        const language =
          localStorage.getItem('monet:user-language') ?? navigator.language
        const title = scope.title.trim().slice(0, 90) || 'Untitled book'
        folder = makeNewFolder(`Library - ${title}`)
        folder.systemPrompt = buildReaderSystemPrompt(language)
        folder.systemPromptMode = 'replace'
      } else {
        folder = makeNewFolder(notebookChatFolderName(scope.title))
        folder.memoryEnabled = true
      }
      pendingScopedFolderIds.current.set(pendingKey, folder.id)
      setFolders((prev) => [folder, ...prev])
      if (isBook) linkBookToReaderFolder(scope.id, folder.id)
      else linkNotebookToChatFolder(scope.id, folder.id)
      scopedFolderIdRef.current = folder.id
      return folder.id
    },
    [setFolders]
  )

  const deleteConversation = useCallback(
    (id: string) => {
      // Limpa arquivos de documentos anexados antes de remover do estado
      const conv = conversationsRef.current.find((c) => c.id === id)
      if (conv) {
        for (const msg of conv.messages) {
          for (const doc of msg.attachedDocs ?? []) {
            void invoke('delete_chat_doc', { path: doc.path }).catch(() => {
              /* ignorar erros */
            })
          }
        }
      }
      setConversations((prev) => prev.filter((c) => c.id !== id))
      setFolders((prev) =>
        prev.map((f) =>
          f.conversationIds.includes(id)
            ? {
                ...f,
                conversationIds: f.conversationIds.filter((cid) => cid !== id),
              }
            : f
        )
      )
      setLooseOrder((prev) => prev.filter((cid) => cid !== id))
      setActiveIdState((current) => {
        if (current !== id) return current
        // Mesmo padrao de isDetached usado no efeito de fallback acima:
        // instancias detached nao pulam para uma conversa alheia.
        if (isDetached) return null
        const remaining = conversationsRef.current.filter((c) => c.id !== id)
        return remaining[0]?.id ?? null
      })
    },
    [setFolders, setLooseOrder, isDetached]
  )

  const createFolder = useCallback((): string => {
    const folder = makeNewFolder('')
    setFolders((prev) => [folder, ...prev])
    return folder.id
  }, [setFolders])

  // Renomeia uma conversa. Titulo custom eh "sticky": nao chama deriveTitle()
  // no fluxo de updateMessages (que so re-deriva se o titulo atual for
  // 'New conversation' ou vazio), entao o titulo definido aqui nao sera
  // sobrescrito por mensagens futuras.
  const renameConversation = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim().slice(0, 100)
      if (!trimmed) return
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, title: trimmed, updatedAt: new Date().toISOString() }
            : c
        )
      )
    },
    [setConversations]
  )

  const renameFolder = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setFolders((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, name: trimmed, updatedAt: new Date().toISOString() }
            : f
        )
      )
    },
    [setFolders]
  )

  const deleteFolder = useCallback(
    (id: string) => {
      const folder = foldersRef.current.find((f) => f.id === id)
      if (!folder) return
      const convIdsToDelete = new Set(folderConversationIds(folder, conversationsRef.current, foldersRef.current))
      // Limpa arquivos de documentos anexados das conversas que serao apagadas
      for (const conv of conversationsRef.current) {
        if (!convIdsToDelete.has(conv.id)) continue
        for (const msg of conv.messages) {
          for (const doc of msg.attachedDocs ?? []) {
            void invoke('delete_chat_doc', { path: doc.path }).catch(() => {
              /* ignorar erros */
            })
          }
        }
      }
      // Grava as pastas ANTES das conversas (os save-effects gravariam as
      // conversas primeiro): na ordem inversa, a outra janela (ex.: assistant
      // oculta) reconcilia as conversas novas com as pastas antigas e ecoa de
      // volta a pasta apagada.
      saveFolders(foldersRef.current.filter((f) => f.id !== id))
      setConversations((prev) =>
        prev.filter((c) => !convIdsToDelete.has(c.id))
      )
      setFolders((prev) => prev.filter((f) => f.id !== id))
      setActiveIdState((current) => {
        if (!current) return current
        if (!convIdsToDelete.has(current)) return current
        // Instancias detached nao pulam para uma conversa alheia.
        if (isDetached) return null
        const remaining = conversationsRef.current.filter(
          (c) => !convIdsToDelete.has(c.id)
        )
        return remaining[0]?.id ?? null
      })
    },
    [setFolders, isDetached]
  )

  // Fusão de pastas (caderno movido para dentro de outro); ver
  // `mergeFolderList` e `moveNotebookChatFolder`. O vínculo de cada conversa
  // muda junto com ela (folderId), nunca para null.
  const mergeFolderInto = useCallback(
    (sourceId: string, destId: string) => {
      const merged = mergeFolderList(foldersRef.current, conversationsRef.current, sourceId, destId)
      if (!merged) return
      // Pastas antes das conversas: ver deleteFolder. A outra janela recebe o
      // destino já listando as conversas e as re-adota no reconcile.
      saveFolders(merged.folders)
      setFolders(merged.folders)
      setConversations((prev) =>
        prev.map((c) =>
          merged.movedIds.has(c.id) && c.folderId !== destId ? { ...c, folderId: destId } : c
        )
      )
    },
    [setFolders]
  )

  const setFolderExpanded = useCallback(
    (id: string, expanded: boolean) => {
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, expanded } : f))
      )
    },
    [setFolders]
  )

  const setFolderSystemPrompt = useCallback(
    (folderId: string, text: string, mode: SystemPromptMode) => {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? {
                ...f,
                systemPrompt: text,
                systemPromptMode: mode,
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      )
    },
    [setFolders]
  )

  const setFolderVisibleDocuments = useCallback(
    (folderId: string, visibleDocumentIds: string[]) => {
      // Pasta vinculada a caderno: grava na tabela do caderno (a pasta de
      // notas dele é implícita e não é gravada), com atualização otimista.
      const notebookId = getNotebookIdForChatFolder(folderId)
      if (notebookId) {
        const ids = visibleDocumentIds.filter((id) => id !== notesFolderDocId(notebookId))
        setLinkedVisibility((prev) => ({ ...prev, [folderId]: ids }))
        replaceNotebookVisibility(notebookId, ids).catch((err) => {
          console.error('failed to save notebook visibility', err)
          void reloadLinkedVisibility(notebookId)
        })
        return
      }
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? {
                ...f,
                visibleDocumentIds,
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      )
    },
    [setFolders, reloadLinkedVisibility]
  )

  const getFolderVisibleDocumentIds = useCallback(
    (folderId: string): string[] => {
      if (getNotebookIdForChatFolder(folderId)) return linkedVisibility[folderId] ?? []
      return folders.find((f) => f.id === folderId)?.visibleDocumentIds ?? []
    },
    [linkedVisibility, folders]
  )

  const getFolderNotebookId = useCallback(
    (folderId: string) => getNotebookIdForChatFolder(folderId),
    []
  )

  const setFolderMemory = useCallback(
    (folderId: string, text: string) => {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? { ...f, memory: text, updatedAt: new Date().toISOString() }
            : f
        )
      )
    },
    [setFolders]
  )

  const setFolderMemoryEnabled = useCallback(
    (folderId: string, enabled: boolean) => {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? { ...f, memoryEnabled: enabled, updatedAt: new Date().toISOString() }
            : f
        )
      )
    },
    [setFolders]
  )

  const setFolderWebResearchEnabled = useCallback(
    (folderId: string, enabled: boolean) => {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? { ...f, webResearchEnabled: enabled, updatedAt: new Date().toISOString() }
            : f
        )
      )
    },
    [setFolders]
  )

  const moveConversation = useCallback(
    (
      convId: string,
      target:
        | { type: 'loose'; index?: number }
        | { type: 'folder'; folderId: string; index?: number }
    ) => {
      // Detecta origem
      const currentFolders = foldersRef.current
      const currentLoose = looseOrderRef.current
      const sourceFolder = currentFolders.find((f) =>
        f.conversationIds.includes(convId)
      )
      const sourceContainerKey = sourceFolder
        ? `folder:${sourceFolder.id}`
        : 'loose'
      const targetContainerKey =
        target.type === 'folder' ? `folder:${target.folderId}` : 'loose'

      // Mesma pasta destino: sem efeito se sem indice especifico
      if (sourceContainerKey === targetContainerKey && target.index === undefined) {
        return
      }

      // Remove da origem
      let nextFolders = currentFolders
      let nextLoose = currentLoose
      if (sourceFolder) {
        nextFolders = currentFolders.map((f) =>
          f.id === sourceFolder.id
            ? {
                ...f,
                conversationIds: f.conversationIds.filter(
                  (id) => id !== convId
                ),
              }
            : f
        )
      } else {
        nextLoose = currentLoose.filter((id) => id !== convId)
      }

      // Insere no destino
      if (target.type === 'folder') {
        nextFolders = nextFolders.map((f) => {
          if (f.id !== target.folderId) return f
          const list = [...f.conversationIds]
          const idx = target.index ?? list.length
          list.splice(Math.max(0, Math.min(idx, list.length)), 0, convId)
          return {
            ...f,
            conversationIds: list,
            expanded: true, // BDD: auto expand ao receber conversa
            updatedAt: new Date().toISOString(),
          }
        })
      } else {
        const list = [...nextLoose]
        const idx = target.index ?? 0
        list.splice(Math.max(0, Math.min(idx, list.length)), 0, convId)
        nextLoose = list
      }

      setFolders(nextFolders)
      setLooseOrder(nextLoose)
      // Fonte de verdade da vinculacao acompanha o movimento.
      const nextFolderId = target.type === 'folder' ? target.folderId : null
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId && c.folderId !== nextFolderId
            ? { ...c, folderId: nextFolderId }
            : c
        )
      )
    },
    [setFolders, setLooseOrder]
  )

  const removeConversationFromFolder = useCallback(
    (convId: string) => {
      const folder = foldersRef.current.find((f) =>
        f.conversationIds.includes(convId)
      )
      if (!folder) return
      moveConversation(convId, { type: 'loose', index: 0 })
    },
    [moveConversation]
  )

  const reorderFolders = useCallback(
    (newOrder: string[]) => {
      setFolders((prev) => {
        const byId = new Map(prev.map((f) => [f.id, f]))
        const next: ChatFolder[] = []
        for (const id of newOrder) {
          const f = byId.get(id)
          if (f) {
            next.push(f)
            byId.delete(id)
          }
        }
        // Acrescenta qualquer pasta nao listada (defensive)
        for (const f of byId.values()) next.push(f)
        return next
      })
    },
    [setFolders]
  )

  const reorderInFolder = useCallback(
    (folderId: string, newOrder: string[]) => {
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id !== folderId) return f
          const set = new Set(f.conversationIds)
          const filtered = newOrder.filter((id) => set.has(id))
          // mantem itens nao listados ao final (defensive)
          for (const id of f.conversationIds) {
            if (!filtered.includes(id)) filtered.push(id)
          }
          return { ...f, conversationIds: filtered }
        })
      )
    },
    [setFolders]
  )

  const reorderLoose = useCallback(
    (newOrder: string[]) => {
      setLooseOrder((prev) => {
        const set = new Set(prev)
        const filtered = newOrder.filter((id) => set.has(id))
        for (const id of prev) {
          if (!filtered.includes(id)) filtered.push(id)
        }
        return filtered
      })
    },
    [setLooseOrder]
  )

  const updateMessages = useCallback(
    (convId: string, updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c
          const nextMessages = updater(c.messages)
          const titleNeedsUpdate =
            c.title === 'New conversation' ||
            c.title.length === 0
          const nextTitle = titleNeedsUpdate
            ? deriveTitle(nextMessages)
            : c.title
          return {
            ...c,
            messages: nextMessages,
            title: nextTitle,
            updatedAt: new Date().toISOString(),
          }
        })
      )
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    const unlisteners: Array<() => void> = []
    ;(async () => {
      const chunk = await onOpenRouterChunk(({ requestId, text }) => {
        const stream = activeStreamRef.current
        if (!stream || stream.requestId !== requestId) return
        updateMessages(stream.convId, (msgs) =>
          msgs.map((m) =>
            m.id === stream.assistantId
              ? { ...m, content: m.content + text }
              : m
          )
        )
      })
      const reasoning = await onOpenRouterReasoning(({ requestId, text }) => {
        const stream = activeStreamRef.current
        if (!stream || stream.requestId !== requestId) return
        updateMessages(stream.convId, (msgs) =>
          msgs.map((m) =>
            m.id === stream.assistantId
              ? { ...m, thinking: (m.thinking ?? '') + text }
              : m
          )
        )
      })
      const done = await onOpenRouterDone(({ requestId, model: doneModel, completionTokens, durationSecs }) => {
        const stream = activeStreamRef.current
        if (!stream || stream.requestId !== requestId) return
        const tps =
          completionTokens && durationSecs && durationSecs > 0
            ? Math.round(completionTokens / durationSecs)
            : undefined
        updateMessages(stream.convId, (msgs) =>
          msgs.map((m) =>
            m.id === stream.assistantId
              ? {
                  ...m,
                  model: doneModel ?? stream.model,
                  tokensPerSecond: tps,
                  content: m.content === '' ? NO_RESPONSE_MESSAGE : m.content,
                }
              : m
          )
        )
        toolCallHandlerRef.current = null
        activeStreamRef.current = null
        setIsStreaming(false)
        setDeepResearchPhase(null)
        setWebSearchActive(false)

        // Bibliotecário: dispara o pipeline em background no fim do turno,
        // fire-and-forget (serializado internamente pelo singleton). Consome o
        // contexto capturado durante a busca (dois caminhos), uma vez por turno.
        const ctx = librarianContextRef.current
        librarianContextRef.current = null
        if (ctx && ctx.webResearchEnabled && ctx.searchResults.length > 0) {
          // Prioridade-por-citação é best-effort: lê o texto final do assistant
          // de conversationsRef. Numa rara corrida last-chunk/done o texto pode
          // estar 1 render atrás — a pior consequência é uma URL citada não
          // ganhar prioridade na barra conservadora de triagem, nunca um erro de
          // correção.
          const finalText =
            conversationsRef.current
              .find((c) => c.id === stream.convId)
              ?.messages.find((m) => m.id === stream.assistantId)?.content ?? ''
          const citedUrls = ctx.searchResults
            .map((r) => r.url)
            .filter((url) => finalText.includes(url))
          enqueueLibrarian({
            chatFolderId: ctx.chatFolderId,
            folderName: ctx.folderName,
            question: ctx.question,
            searchResults: ctx.searchResults,
            citedUrls,
            onSaved: (count) => setWebSourcesSaved({ count, at: Date.now() }),
            onFolderRegistered: (aiFolderId) => {
              // Pasta vinculada a caderno: a seleção mora na tabela do caderno.
              const linkedNotebookId = getNotebookIdForChatFolder(ctx.chatFolderId)
              if (linkedNotebookId) {
                setNotebookDocumentVisibility(linkedNotebookId, aiFolderId, true).catch((err) =>
                  console.error('failed to add AI sources folder to notebook visibility', err)
                )
                return
              }
              setFolders((prev) =>
                prev.map((f) =>
                  f.id === ctx.chatFolderId && !f.visibleDocumentIds.includes(aiFolderId)
                    ? {
                        ...f,
                        visibleDocumentIds: [...f.visibleDocumentIds, aiFolderId],
                        updatedAt: new Date().toISOString(),
                      }
                    : f
                )
              )
            },
          })
        }
      })
      const err = await onOpenRouterError(({ requestId, message }) => {
        const stream = activeStreamRef.current
        if (!stream || stream.requestId !== requestId) return
        updateMessages(stream.convId, (msgs) =>
          msgs.map((m) =>
            m.id === stream.assistantId && m.content === ''
              ? { ...m, content: `Error: ${message}` }
              : m
          )
        )
        setError(message)
        toolCallHandlerRef.current = null
        activeStreamRef.current = null
        setIsStreaming(false)
        setDeepResearchPhase(null)
        setWebSearchActive(false)
        librarianContextRef.current = null
      })
      const toolCall = await onOpenRouterToolCall((p) => {
        const handler = toolCallHandlerRef.current
        if (handler) {
          handler(p)
          return
        }
        // Tool call sem handler (ex.: a 2ª rodada, enviada sem tools, em que o
        // modelo ainda tenta chamar uma tool): o backend não emite done nem
        // error, então o turno é encerrado aqui — senão fica vazio para sempre.
        const stream = activeStreamRef.current
        if (!stream || stream.requestId !== p.requestId) return
        updateMessages(stream.convId, (msgs) =>
          msgs.map((m) =>
            m.id === stream.assistantId && m.content === ''
              ? { ...m, model: stream.model, content: NO_RESPONSE_MESSAGE }
              : m
          )
        )
        activeStreamRef.current = null
        setIsStreaming(false)
        setDeepResearchPhase(null)
        setWebSearchActive(false)
        librarianContextRef.current = null
      })
      if (cancelled) {
        chunk()
        reasoning()
        done()
        err()
        toolCall()
        return
      }
      unlisteners.push(chunk, reasoning, done, err, toolCall)
    })().catch((e) => console.error('failed to subscribe to openrouter events', e))
    return () => {
      cancelled = true
      unlisteners.forEach((u) => u())
    }
  }, [updateMessages])

  const send = useCallback(
    async (
      text: string,
      imageDataUrl?: string,
      documents?: Array<{ name: string; type: string; data: string }>,
      opts?: { ephemeralContext?: string; excludeNoteId?: string | null }
    ) => {
      const trimmed = text.trim()
      if (!trimmed && !imageDataUrl && (!documents || documents.length === 0)) return
      if (isStreaming) return
      if (!model) {
        setError('Select a model before sending.')
        return
      }
      setError(null)
      toolCancelledRef.current = false
      librarianContextRef.current = null

      // Garante uma conversa ativa
      let convId = activeId
      const draft = draftRef.current
      // Pasta recem-criada NESTE send (assistant sem pasta previa): objeto
      // conhecido antes do commit do estado — usado tambem na resolucao do
      // system prompt abaixo.
      let materializedFolder: ChatFolder | null = null
      // Pasta de destino da conversa materializada neste send (se houver).
      let materializedFolderId: string | null | undefined
      if (draft && draft.id === activeId && isDetached) {
        // Materializa o rascunho da instancia dedicada (assistant/reader/notes).
        // A pasta de destino ja esta gravada NO PROPRIO rascunho
        // (draft.folderId, fixado na criacao — modos reader/notes e a pasta
        // escolhida no seletor do assistant); sem pasta valida, o modo assistant
        // resolve a pasta dedicada por NOME aqui (lazy: abrir o assistant sem
        // enviar nada nao cria pasta). A vinculacao e persistida de forma
        // ATOMICA junto com a conversa (folderId); a insercao na lista de
        // ordem da pasta e cosmetica e auto-reparavel via reconcileOrders.
        convId = draft.id
        let targetFolderId: string | null = draft.folderId ?? null
        if (dedicatedFolderName) {
          // Pasta escolhida no seletor do assistant (fixada no rascunho) vence,
          // desde que exista; senão, a pasta dedicada por nome.
          const chosen = targetFolderId
            ? foldersRef.current.find((f) => f.id === targetFolderId)
            : undefined
          const existing =
            chosen ?? foldersRef.current.find((f) => f.name === dedicatedFolderName)
          if (existing) {
            targetFolderId = existing.id
          } else {
            materializedFolder = makeNewFolder(dedicatedFolderName)
            targetFolderId = materializedFolder.id
          }
        } else if (isScopedMode) {
          // Fallback dos modos com escopo: se a pasta do rascunho foi
          // apagada/recriada entre a criacao do rascunho e o 1o envio, o
          // ensure chamado pelo painel antes do send deixou o id fresco no ref.
          const rid = scopedFolderIdRef.current
          if (
            targetFolderId &&
            !foldersRef.current.some((f) => f.id === targetFolderId) &&
            rid &&
            foldersRef.current.some((f) => f.id === rid)
          ) {
            targetFolderId = rid
          }
        }
        const conv: ChatConversation = { ...draft, folderId: targetFolderId }
        setConversations((prev) => [conv, ...prev])
        if (targetFolderId) {
          const fid = targetFolderId
          const created = materializedFolder
          setFolders((prev) => {
            const base =
              created && !prev.some((f) => f.id === fid)
                ? [created, ...prev]
                : prev
            return base.map((f) =>
              f.id === fid
                ? {
                    ...f,
                    conversationIds: [conv.id, ...f.conversationIds],
                    expanded: true,
                    updatedAt: new Date().toISOString(),
                  }
                : f
            )
          })
        } else {
          setLooseOrder((prev) => [conv.id, ...prev])
        }
        materializedFolderId = targetFolderId
        setDraftConversation(null)
        draftRef.current = null
      } else if (!convId) {
        const conv = makeNewConversation()
        convId = conv.id
        setConversations((prev) => [conv, ...prev])
        setLooseOrder((prev) => [conv.id, ...prev])
        setActiveIdState(conv.id)
      }
      const targetId = convId

      // Captura o historico ANTES de inserir a nova mensagem do usuario,
      // senao ela apareceria duplicada no payload (no historico + na ultima msg).
      // Documentos anexados sao armazenados como paths no filesystem; ler conteudo
      // a partir do disco para mensagens antigas (paralelo via Promise.all).
      const currentConv = conversationsRef.current.find((c) => c.id === targetId)
      const historyForApi: ChatMessageInput[] = await Promise.all(
        (currentConv?.messages ?? []).map(async (m) => {
          const docBlocks: ContentBlock[] = m.attachedDocs && m.attachedDocs.length > 0
            ? await Promise.all(
                m.attachedDocs.map(async (d) => {
                  const content = await invoke<string>('read_chat_doc', { path: d.path }).catch(() => '[content unavailable]')
                  return { type: 'text' as const, text: `[Attached file: ${d.name}]\n${content}` }
                })
              )
            : []
          const hasExtras = docBlocks.length > 0 || !!m.imageDataUrl
          return {
            role: m.role,
            content: hasExtras
              ? ([
                  ...docBlocks,
                  ...(m.imageDataUrl ? [{ type: 'image_url' as const, image_url: { url: m.imageDataUrl } }] : []),
                  { type: 'text' as const, text: m.content },
                ] as ContentBlock[])
              : m.content,
          }
        })
      )

      // Verifica chave antes de persistir arquivos: evita leak de docs no disco
      // quando a chave nao esta configurada.
      const keyPresent = await hasOpenRouterKey()
      if (!keyPresent) {
        setHasApiKey(false)
        setApiKeyChecked(true)
        setError('API key not configured. Add your OpenRouter key in Settings.')
        return
      }
      setHasApiKey(true)
      setApiKeyChecked(true)

      // Persiste os documentos anexados no filesystem para sobreviver ao reload da
      // app. Apenas o path eh armazenado no ChatMessage.
      const persistedDocs: Array<{ name: string; path: string }> = documents && documents.length > 0
        ? await Promise.all(
            documents.map(async (d) => {
              const path = await invoke<string>('save_chat_doc', {
                filename: `${nanoid()}.txt`,
                content: d.data,
              })
              return { name: d.name, path }
            })
          )
        : []

      // Insere a mensagem do usuario + placeholder do assistant ANTES dos awaits
      // (web search) para a UI responder imediatamente. Erros sao refletidos no
      // proprio placeholder do assistant.
      const userMsg: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: trimmed,
        imageDataUrl: imageDataUrl || undefined,
        attachedDocs: persistedDocs.length > 0 ? persistedDocs : undefined,
        timestamp: new Date().toISOString(),
      }
      const assistantId = nanoid()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      }
      updateMessages(targetId, (msgs) => [...msgs, userMsg, assistantMsg])
      setIsStreaming(true)

      const failOnAssistant = (message: string) => {
        updateMessages(targetId, (msgs) =>
          msgs.map((m) =>
            m.id === assistantId && m.content === ''
              ? { ...m, content: `Error: ${message}` }
              : m
          )
        )
        setError(message)
        librarianContextRef.current = null
        activeStreamRef.current = null
        setIsStreaming(false)
        setDeepResearchPhase(null)
        setWebSearchActive(false)
      }

      // Busca web — deep research tem prioridade sobre web search simples
      // Data LOCAL do usuário ("hoje", "ontem", "semana passada" nas tools).
      const currentDate = dateKeyFromMs(Date.now())
      const selectedModelInfo = models.find((m) => m.id === model)
      const supportsTools = selectedModelInfo?.supportsTools ?? false
      let searchSystemMessage: ChatMessageInput | null = null
      // Resultados da busca pré-turno (modelos SEM tools) para o bibliotecário;
      // consumidos abaixo, depois que containingFolder for resolvido.
      let preTurnSearchResults: SearchResult[] | null = null
      if (toolsRef.current.deepResearch) {
        const tavilyOk = await hasTavilyKey()
        if (!tavilyOk) {
          failOnAssistant(
            'Deep Research is active but the Tavily key is not configured in Settings > Web Search.'
          )
          return
        }
        if (!supportsTools) {
          try {
            const route = await invoke<{ needsSearch: boolean; intent: string | null; queries: string[] }>(
              'web_search_route',
              { history: historyForApi, lastMessage: trimmed, currentDate }
            ).catch(() => ({ needsSearch: true, intent: null, queries: [trimmed.slice(0, 380)] }))
            const optimizedQuery = route.queries[0] ?? trimmed.slice(0, 380)

            const { formattedContext, sources } = await runDeepResearch(
              optimizedQuery,
              (phase) => setDeepResearchPhase(phase),
              currentDate
            )
            setDeepResearchPhase('synthesizing')
            const sourceList = sources
              .map((s, i) => `${i + 1}. [${s.title}](${s.url})`)
              .join('\n')
            if (formattedContext) {
              searchSystemMessage = {
                role: 'system',
                content: `You have access to the following deeply researched web sources. Synthesize them into a complete, well-structured answer. At the end of your response add a "Sources" section with these references:\n\n${sourceList}\n\n---\n\nResearch results:\n\n${formattedContext}`,
              }
            }
          } catch (err) {
            setDeepResearchPhase(null)
            console.warn('deepResearch failed:', err)
            setError(
              `Deep Research failed: ${err instanceof Error ? err.message : 'unknown error'}. Sending without search context.`
            )
          }
        }
      } else if (toolsRef.current.webSearch) {
        const tavilyOk = await hasTavilyKey()
        if (!tavilyOk) {
          failOnAssistant(
            'Web Search is active but the Tavily key is not configured in Settings > Web Search.'
          )
          return
        }
        if (!supportsTools) {
          try {
            const route = await invoke<{ needsSearch: boolean; intent: string | null; queries: string[] }>(
              'web_search_route',
              { history: historyForApi, lastMessage: trimmed, currentDate }
            ).catch(() => ({ needsSearch: true, intent: null, queries: [trimmed.slice(0, 380)] }))

            if (route.needsSearch && route.queries.length > 0) {
              const allResults = await Promise.all(
                route.queries.map((q) => webSearch(q, 3).catch(() => []))
              )
              const seen = new Set<string>()
              const deduplicated = allResults.flat().filter((r) => {
                if (seen.has(r.url)) return false
                seen.add(r.url)
                return true
              })
              preTurnSearchResults = deduplicated
              const formatted = formatSearchResults(deduplicated)
              if (formatted) {
                searchSystemMessage = {
                  role: 'system',
                  content: `You have access to the following web search results. Use them to support your response and always cite sources with inline links in the format [Title](url), close to the claim each source supports. Do not group sources at the end — distribute citations throughout the text. Some results include an Image URL — only embed it using markdown image syntax \`![description](url)\` if the user explicitly asked to see or show images AND the URL appears verbatim in the search results above. Never invent, guess, or modify image URLs.\n\n${formatted}`,
                }
              }
            }
          } catch (err) {
            console.warn('webSearch failed:', err)
            setError(
              `Web search failed: ${err instanceof Error ? err.message : 'unknown error'}. Sending without search context.`
            )
          }
        }
      }

      // System prompt da pasta (se houver) + modo de aplicacao
      // - sem pasta ou prompt vazio -> apenas o prompt padrao
      // - modo "replace" -> apenas o prompt da pasta (padrao nao entra)
      // - modo "append"  -> prompt padrao primeiro, depois o da pasta
      // Resolucao pela FONTE DE VERDADE (conversation.folderId). No turno da
      // 1a mensagem de uma instancia dedicada a conversa acabou de ser
      // materializada neste send (estado ainda nao commitado): usamos o
      // folderId/objeto capturados na materializacao para aplicar system
      // prompt/RAG/memoria ja na 1a mensagem.
      const targetConvFolderId =
        materializedFolderId !== undefined
          ? materializedFolderId
          : conversationsRef.current.find((c) => c.id === targetId)?.folderId ??
            null
      const containingFolder = targetConvFolderId
        ? foldersRef.current.find((f) => f.id === targetConvFolderId) ??
          (materializedFolder?.id === targetConvFolderId
            ? materializedFolder
            : undefined)
        : undefined
      // Bibliotecário (caminho SEM tools): com containingFolder resolvido,
      // captura os resultados da busca pré-turno se a pasta tiver web research
      // ligado. (Deep research não alimenta o bibliotecário: preTurnSearchResults
      // só é preenchido no branch de webSearch.)
      if (preTurnSearchResults && containingFolder?.webResearchEnabled) {
        librarianContextRef.current = {
          chatFolderId: containingFolder.id,
          folderName: containingFolder.name,
          webResearchEnabled: true,
          question: trimmed,
          searchResults: preTurnSearchResults,
        }
      }
      const folderPrompt = containingFolder?.systemPrompt.trim() ?? ''
      let systemMessages: ChatMessageInput[]
      if (containingFolder && folderPrompt.length > 0) {
        if (containingFolder.systemPromptMode === 'replace') {
          systemMessages = [{ role: 'system', content: folderPrompt }]
        } else {
          systemMessages = [
            { role: 'system', content: CHAT_SYSTEM_PROMPT },
            { role: 'system', content: folderPrompt },
          ]
        }
      } else {
        systemMessages = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }]
      }
      // Memoria da pasta: injetada SEMPRE que memoryEnabled, independente do
      // systemPromptMode (mesmo em 'replace', que descarta o CHAT_SYSTEM_PROMPT
      // padrao mas nao pode descartar a memoria — ela e uma 3a variavel de
      // prompt, independente das outras duas).
      if (containingFolder?.memoryEnabled) {
        systemMessages.push({ role: 'system', content: MEMORY_SYSTEM_PROMPT })
        systemMessages.push({
          role: 'system',
          content:
            containingFolder.memory.trim().length > 0
              ? `Current folder memory:\n\n${containingFolder.memory}`
              : 'Current folder memory: (empty — nothing recorded yet for this folder).',
        })
      }
      systemMessages.push({
        role: 'system',
        content: `Current date: ${currentDate} (${getWeekdayName(new Date())})`,
      })

      // Contexto EFEMERO por envio (ex.: contexto de leitura do chat do
      // Reader): entra apenas nos payloads da API deste turno — nunca em
      // ChatMessage.content, no historico persistido ou nas queries de web
      // search/deep research (que derivam de historyForApi/trimmed). Por ser
      // `const` no closure do send(), entra nos DOIS payloads (inicial e
      // pos tool-call).
      const ephemeralSystemMessage: ChatMessageInput | null =
        opts?.ephemeralContext?.trim()
          ? { role: 'system', content: opts.ephemeralContext }
          : null

      // RAG context for folder documents. A selecao (ids de arquivo e de pasta)
      // vem da tabela do caderno quando a pasta de chat e vinculada a um caderno
      // (com a pasta de notas dele implicita), senao de visibleDocumentIds.
      // O `rag_retrieve` expande as pastas para os filhos atuais (pastas
      // origin === 'ai' so com webResearchEnabled), reescreve a consulta com o
      // historico, faz a busca hibrida e o rerank. `excludeNoteId` tira a nota
      // aberta (ja enviada como contexto efemero).
      // Gating: agradecimento nao busca; "continue"/"tenta de novo" reaproveita
      // os trechos do turno anterior (rowids em ragSources).
      // O escopo também alimenta a tool search_knowledge_base (null = pasta
      // sem documentos visíveis: nem RAG nem tool).
      let ragScope: RagScope | null = null
      if (containingFolder) {
        try {
          const linkedNotebookId = getNotebookIdForChatFolder(containingFolder.id)
          const rawFolderDocIds = linkedNotebookId
            ? await getNotebookVisibleDocumentIds(linkedNotebookId)
            : containingFolder.visibleDocumentIds
          if (linkedNotebookId || rawFolderDocIds.length > 0) {
            ragScope = {
              ids: rawFolderDocIds,
              notebookId: linkedNotebookId,
              excludeNoteId: opts?.excludeNoteId ?? null,
              includeAiFolders: !!containingFolder.webResearchEnabled,
            }
          }
        } catch (err) {
          console.warn('RAG scope in chat failed (continuing without):', err)
        }
      }
      let ragSystemMessage: ChatMessageInput | null = null
      // Fontes do RAG automático; as tools de busca continuam a numeração.
      let turnRagSources: RagSource[] = []
      const ragGateResult = trimmed ? ragGate(trimmed) : 'skip'
      if (ragScope && ragGateResult !== 'skip') {
        try {
          setRagSearching(true)
          let selected: RagCandidate[] = []
          let trace: RagResponse | null = null
          if (ragGateResult === 'reuse') {
            const prevSources = [...(currentConv?.messages ?? [])]
              .reverse()
              .find((m) => m.role === 'assistant' && m.ragSources && m.ragSources.length > 0)
              ?.ragSources
            const rowids = (prevSources ?? []).flatMap((s) => s.rowids)
            if (rowids.length > 0) {
              // O escopo (com a nota aberta excluida) e aplicado no backend.
              selected = await ragGetChunks(ragScope, rowids)
            }
            if (import.meta.env.DEV)
              console.log(`[useChat] RAG reuse: ${selected.length}/${rowids.length} chunks from the previous turn`)
          }
          // "search", ou "reuse" sem trechos (sem fontes antes, ou rowids
          // que sumiram numa reindexacao).
          if (selected.length === 0) {
            trace = await ragRetrieve(
              ragScope,
              ragMessage(trimmed),
              ragHistory(currentConv?.messages ?? []),
              localStorage.getItem(RAG_REWRITE_MODEL_KEY)
            )
            selected = trace.selected
            if (import.meta.env.DEV) console.log('[useChat] RAG retrieve:', trace)
          }
          const hasOtherContext = !!ephemeralSystemMessage
          let ragSources: RagSource[] | undefined
          let ragNothingFound: true | undefined
          if (selected.length > 0) {
            const ctx = buildRagContext(selected, hasOtherContext)
            ragSystemMessage = { role: 'system', content: ctx.content }
            ragSources = ctx.sources
            turnRagSources = ctx.sources
          } else if (trace?.nothingRelevant) {
            ragSystemMessage = { role: 'system', content: ragNothingFoundMessage(hasOtherContext) }
            ragNothingFound = true
          }
          if (ragSources || ragNothingFound) {
            updateMessages(targetId, (msgs) =>
              msgs.map((m) => (m.id === assistantId ? { ...m, ragSources, ragNothingFound } : m))
            )
          }
          const detailed = localStorage.getItem(RAG_DETAILED_KEY) === '1'
          if (trace && detailed) {
            const t = trace
            setRagTraces((prev) => ({ ...prev, [assistantId]: t }))
          }
        } catch (err) {
          console.warn('RAG search in chat failed (continuing without):', err)
        } finally {
          setRagSearching(false)
        }
      }

      // Stop durante a busca (web pre-turno ou RAG): ainda nao ha stream para
      // cancelar, entao o turno termina aqui.
      if (toolCancelledRef.current) {
        updateMessages(targetId, (msgs) =>
          msgs.filter((m) => !(m.id === assistantId && m.content === ''))
        )
        setIsStreaming(false)
        return
      }

      // Documents arrive here already converted to plain text by ChatPanel
      // (PDFs have their text extracted in the backend before reaching send).
      // They are sent inline so any model can process them.
      const docBlocks: ContentBlock[] = (documents ?? []).map((doc) => ({
        type: 'text' as const,
        text: `[Attached file: ${doc.name}]\n${doc.data}`,
      }))
      const userContent: string | ContentBlock[] =
        imageDataUrl || docBlocks.length > 0
          ? [
              ...docBlocks,
              ...(imageDataUrl ? [{ type: 'image_url' as const, image_url: { url: imageDataUrl } }] : []),
              { type: 'text' as const, text: trimmed },
            ]
          : trimmed

      const apiMessages: ChatMessageInput[] = [
        ...systemMessages,
        ...(ephemeralSystemMessage ? [ephemeralSystemMessage] : []),
        ...(ragSystemMessage ? [ragSystemMessage] : []),
        ...(searchSystemMessage ? [searchSystemMessage] : []),
        ...historyForApi,
        { role: 'user', content: userContent },
      ]
      if (import.meta.env.DEV) console.log('[useChat] context sent to AI:', apiMessages)

      const requestId = assistantId
      activeStreamRef.current = { requestId, convId: targetId, assistantId, model }

      // Build tool definitions for models that support tool use
      const deepResearchToolParameters = {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'A keyword search query rewritten for a search engine. Use canonical noun phrases only — no filler words, no pronouns, no verbs, no question syntax, no conversational language. Extract the core topic and rewrite it as 3–8 keywords. Examples: user says "busque as últimas edições de Lord Jim em português" → "Lord Jim Conrad edição portuguesa 2026"; user says "how to fix memory leaks in Angular" → "Angular memory leak fix takeUntilDestroyed"; user says "who is the CEO of OpenAI now?" → "OpenAI CEO 2026".',
            maxLength: 80,
          },
        },
        required: ['query'],
      }
      const webSearchToolParameters = {
        type: 'object',
        properties: {
          queries: {
            type: 'array',
            description: 'A list of 1 to 3 keyword search queries covering different angles of the topic. Each query must use canonical noun phrases only — no filler words, no pronouns, no verbs, no question syntax, no conversational language. Extract the core topic and rewrite it as 3–8 keywords per query. Use multiple queries when the topic has distinct facets worth searching separately; use a single query for straightforward lookups. Examples: user says "busque as últimas edições de Lord Jim em português" → ["Lord Jim Conrad edição portuguesa 2026"]; user says "compare React Server Components and Next.js App Router" → ["React Server Components 2026", "Next.js App Router architecture", "RSC vs App Router differences"].',
            items: { type: 'string', maxLength: 80 },
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ['queries'],
      }
      const toolDefs: object[] = []
      if (supportsTools && (toolsRef.current.deepResearch || toolsRef.current.webSearch)) {
        const tavilyOk = await hasTavilyKey()
        if (tavilyOk) {
          if (toolsRef.current.deepResearch) {
            toolDefs.push({
              type: 'function',
              function: {
                name: 'deep_research',
                description: 'Perform deep multi-source web research. IMPORTANT: the query argument must be a short keyword search string (3–8 words), NOT the user\'s message verbatim. Rewrite the topic as a search engine query: canonical noun phrases only, no filler words, no pronouns, no verbs, no question syntax.',
                parameters: deepResearchToolParameters,
              },
            })
          } else if (toolsRef.current.webSearch) {
            toolDefs.push({
              type: 'function',
              function: {
                name: 'web_search',
                description: 'Search the web for current information. IMPORTANT: pass 1 to 3 short keyword search queries (3–8 words each), NOT the user\'s message verbatim. Rewrite the topic as search engine queries: canonical noun phrases only, no filler words, no pronouns, no verbs, no question syntax. Use multiple queries when the topic has distinct facets worth searching separately.',
                parameters: webSearchToolParameters,
              },
            })
          }
        }
      }
      // update_folder_memory nao depende de Tavily; e independente de web_search/
      // deep_research e pode coexistir com qualquer uma das duas (ou nenhuma).
      // Modelos sem suporte a tools (supportsTools === false) nunca a recebem —
      // nesse caso a memoria fica inoperante para ESCRITA (leitura de contexto via
      // system message continua funcionando normalmente).
      if (supportsTools && containingFolder?.memoryEnabled) {
        toolDefs.push({
          type: 'function',
          function: {
            name: 'update_folder_memory',
            description: 'Rewrite this folder\'s persistent memory with a new, complete version. Call this only when the current exchange contains something durable, novel, and worth remembering for future conversations in this folder — most turns do not need this. You are given the current memory as context in the system prompt; pass back the FULL replacement text (reorganized, condensed, or pruned as needed), not just an addition.',
            parameters: {
              type: 'object',
              properties: {
                memory: {
                  type: 'string',
                  description: 'The full new memory content for this folder, replacing the previous memory entirely.',
                },
              },
              required: ['memory'],
            },
          },
        })
      }
      // query_tasks: só com a tool "Tasks" ligada pelo usuário e num chat que
      // fornece o snapshot das tasks. Lido uma vez por envio: os status entram
      // no enum da tool, e o mesmo snapshot responde à chamada.
      let tasksSnapshot: TasksSnapshot | null = null
      if (supportsTools && toolsRef.current.tasks && getTasksSnapshotRef.current) {
        try {
          tasksSnapshot = await getTasksSnapshotRef.current()
        } catch (err) {
          console.warn('getTasksSnapshot failed:', err)
        }
      }
      if (tasksSnapshot) {
        toolDefs.push({
          type: 'function',
          function: {
            name: 'query_tasks',
            description: "Query the user's tasks (personal task list of Monet notes). Use it when the user asks about their tasks, deadlines, what is due, overdue or done. Dates are YYYY-MM-DD; 'do' is when the user plans to do it, 'deadline' is the delivery date. Weeks start on Monday.",
            parameters: {
              type: 'object',
              properties: {
                period: {
                  type: 'string',
                  enum: ['overdue', 'today', 'this_week', 'next_week', 'open', 'done_this_week'],
                  description: 'Time window. this_week includes overdue tasks. Omit to get all open tasks.',
                },
                project: {
                  type: 'string',
                  description: 'Project (notebook) name, without spaces or "#". Omit for all projects.',
                },
                status: {
                  type: 'string',
                  // Built-ins pelo id; custom pelo nome (lista dinâmica).
                  enum: tasksSnapshot.statuses.map((s) =>
                    s.builtin ? s.id : s.name
                  ),
                },
              },
            },
          },
        })
      }
      // get_day / notes_by_date: só com a tool "Daily notes" ligada (leem notas
      // de qualquer caderno, fora do escopo da pasta).
      if (supportsTools && toolsRef.current.dailyNotes) {
        toolDefs.push({
          type: 'function',
          function: {
            name: 'get_day',
            description: "Read the user's notes for one day, from any notebook: the daily note of the Calendar notebook for that date and the notes tagged with that date. Use it when the user asks about a specific day (\"what do I have today?\", \"what did I write yesterday?\", \"my notes from 14/10\"). Resolve relative dates from the current date in the system prompt, which is the user's local date.",
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'The day, as YYYY-MM-DD.' },
              },
              required: ['date'],
            },
          },
        })
        toolDefs.push({
          type: 'function',
          function: {
            name: 'notes_by_date',
            description: "Read the user's notes dated within a period (inclusive), from any notebook: Calendar daily notes and notes tagged with a date in the range. Use it for periods (\"notes from last week\", \"what did I write in August\"); for a single day prefer get_day. Resolve relative dates from the current date in the system prompt (the user's local date); weeks start on Monday. Long periods return only part of each note.",
            parameters: {
              type: 'object',
              properties: {
                from: { type: 'string', description: 'First day, as YYYY-MM-DD.' },
                to: { type: 'string', description: 'Last day, as YYYY-MM-DD.' },
                notebook: {
                  type: 'string',
                  description: 'Only notes of the notebook whose name contains this text. Omit for all notebooks.',
                },
              },
              required: ['from', 'to'],
            },
          },
        })
      }
      // search_knowledge_base: com escopo de RAG na pasta, para o modelo
      // refinar a busca (tipo, período, caderno) dentro desse escopo.
      if (supportsTools && ragScope) {
        toolDefs.push({
          type: 'function',
          function: {
            name: 'search_knowledge_base',
            description: "Search the user's knowledge base (the notes, meeting transcripts, documents and saved web pages visible in this chat folder). Excerpts for the user's message were already retrieved automatically and are in the context when relevant: call this only when they are missing or insufficient, or when the user asks to search a specific type of source, period or notebook/folder.",
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: "A self-contained search query in the user's language, with the specific names, terms and versions to look for.",
                },
                kind: {
                  type: 'string',
                  enum: ['note', 'meeting', 'document', 'web'],
                  description: 'Only this type of source: note (user notes), meeting (meeting transcripts), document (files), web (saved web pages).',
                },
                dateFrom: { type: 'string', description: 'Only sources dated on or after this day (YYYY-MM-DD).' },
                dateTo: { type: 'string', description: 'Only sources dated on or before this day (YYYY-MM-DD).' },
                notebook: {
                  type: 'string',
                  description: 'Only sources whose notebook or folder name contains this text (notes of a notebook are labeled "Notes — <notebook>").',
                },
              },
              required: ['query'],
            },
          },
        })
      }
      const toolsPayload: object[] | undefined = toolDefs.length > 0 ? toolDefs : undefined

      // Stop enquanto as tools eram montadas (hasTavilyKey, snapshot de tasks):
      // o cancel() já limpou o turno (placeholder, isStreaming e
      // activeStreamRef), mas o stream ainda não tinha começado. Não começa.
      if (activeStreamRef.current?.requestId !== requestId) return

      // Register tool call handler for this turn. Single round: the tool runs,
      // then a 2nd request WITHOUT tools is dispatched to force the final text
      // answer. Persisting web sources is no longer the model's job — it runs
      // out of band via the librarian pipeline (see librarianContextRef +
      // onOpenRouterDone).
      if (toolsPayload) {
        toolCallHandlerRef.current = async (p: StreamToolCallPayload) => {
          if (p.requestId !== requestId) return
          if (!activeStreamRef.current) return

          // NÃO zera activeStreamRef/isStreaming aqui: zerar cedo destrava
          // `canSend` (ChatPanel) durante a execução da tool, permitindo que um
          // send() novo sobrescreva os refs únicos e orfã este turno (bug #3).
          // Só done/error/failOnAssistant/cancel (fim real) zeram esses dois; a
          // 2ª rodada os reatribui logo abaixo.

          try {
            let toolSearchMessage: ChatMessageInput | null = null
            // Resultados de query_tasks (uma entrada por chamada).
            const taskResults: string[] = []
            // Resultados de search_knowledge_base e das tools de notas, com as
            // fontes da resposta (cópia): a numeração [n] continua a do RAG.
            const kbResults: string[] = []
            const noteResults: string[] = []
            const sources: RagSource[] = turnRagSources.map((s) => ({ ...s, rowids: [...s.rowids] }))
            for (const tc of p.toolCalls) {
              let parsedArgs: { query?: string; queries?: unknown; memory?: unknown } = {}
              try {
                parsedArgs = JSON.parse(tc.argumentsJson) as { query?: string; queries?: unknown; memory?: unknown }
              } catch {
                /* fallback handled per-tool below */
              }

              if (tc.toolName === 'deep_research') {
                const query = parsedArgs.query?.trim() || trimmed.slice(0, 380)
                setDeepResearchPhase('searching')
                const { formattedContext, sources } = await runDeepResearch(
                  query,
                  (phase) => setDeepResearchPhase(phase),
                  currentDate
                )
                setDeepResearchPhase('synthesizing')
                const sourceList = sources
                  .map((s, i) => `${i + 1}. [${s.title}](${s.url})`)
                  .join('\n')
                if (formattedContext) {
                  toolSearchMessage = {
                    role: 'system',
                    content: `You have access to the following deeply researched web sources. Synthesize them into a complete, well-structured answer. At the end of your response add a "Sources" section with these references:\n\n${sourceList}\n\n---\n\nResearch results:\n\n${formattedContext}`,
                  }
                }
                setDeepResearchPhase(null)
              } else if (tc.toolName === 'web_search') {
                const rawQueries = Array.isArray(parsedArgs.queries)
                  ? (parsedArgs.queries as unknown[]).filter(
                      (q): q is string => typeof q === 'string' && q.trim().length > 0
                    ).map((q) => q.trim()).slice(0, 3)
                  : []
                const queries = rawQueries.length > 0 ? rawQueries : [trimmed.slice(0, 380)]
                setWebSearchActive(true)
                const allResults = await Promise.all(
                  queries.map((q) => webSearch(q, 3).catch(() => []))
                )
                const seen = new Set<string>()
                const deduplicated = allResults.flat().filter((r) => {
                  if (seen.has(r.url)) return false
                  seen.add(r.url)
                  return true
                })
                // Captura os resultados para o pipeline do bibliotecário (disparo
                // no fim do turno, em onOpenRouterDone) — só quando a pasta tem
                // web research ligado. Sobrescrever é aceitável: o pipeline roda
                // uma vez por turno com o último conjunto.
                if (containingFolder?.webResearchEnabled) {
                  librarianContextRef.current = {
                    chatFolderId: containingFolder.id,
                    folderName: containingFolder.name,
                    webResearchEnabled: true,
                    question: trimmed,
                    searchResults: deduplicated,
                  }
                }
                const formatted = formatSearchResults(deduplicated)
                if (formatted) {
                  toolSearchMessage = {
                    role: 'system',
                    content: `You have access to the following web search results. Use them to support your response and always cite sources with inline links in the format [Title](url), close to the claim each source supports. Do not group sources at the end — distribute citations throughout the text. Some results include an Image URL — only embed it using markdown image syntax \`![description](url)\` if the user explicitly asked to see or show images AND the URL appears verbatim in the search results above. Never invent, guess, or modify image URLs.\n\n${formatted}`,
                  }
                }
                setWebSearchActive(false)
              } else if (tc.toolName === 'query_tasks') {
                const snapshot = tasksSnapshot
                if (snapshot) {
                  let query: TasksQuery = {}
                  try {
                    query = JSON.parse(tc.argumentsJson) as TasksQuery
                  } catch {
                    /* sem argumentos: tasks abertas */
                  }
                  // Cadernos com a indexação de IA desligada ficam fora da tool.
                  let result: string
                  try {
                    const disabled = new Set(await notesIndexGetDisabledNotebooks())
                    const checklist =
                      typeof snapshot.checklist === 'function'
                        ? await snapshot.checklist()
                        : snapshot.checklist
                    result = queryTasksText(
                      snapshot.tasks.filter((t) => !disabled.has(t.notebookId)),
                      snapshot.notebooks.filter((n) => !disabled.has(n.id)),
                      query,
                      snapshot.todayKey,
                      checklist,
                      snapshot.statuses
                    )
                  } catch (err) {
                    console.warn('query_tasks failed:', err)
                    result = 'Tasks are unavailable right now.'
                  }
                  taskResults.push(
                    `query_tasks ${JSON.stringify(query)} (today is ${snapshot.todayKey}):\n${result}`
                  )
                }
              } else if (tc.toolName === 'search_knowledge_base' && ragScope) {
                const args = parsedArgs as Record<string, unknown>
                const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
                const query = str(args.query) ?? trimmed
                const kind = str(args.kind)
                const filters: RagFilters = {
                  kinds: kind ? [kind] : [],
                  dateFrom: str(args.dateFrom),
                  dateTo: str(args.dateTo),
                  folderLabelContains: str(args.notebook),
                }
                const label = `search_knowledge_base ${tc.argumentsJson}`
                setRagSearching(true)
                try {
                  const res = await ragRetrieve(
                    ragScope,
                    ragMessage(query),
                    [],
                    localStorage.getItem(RAG_REWRITE_MODEL_KEY),
                    filters
                  )
                  if (import.meta.env.DEV) console.log('[useChat] search_knowledge_base:', filters, res)
                  kbResults.push(
                    res.selected.length > 0
                      ? `${label}:\n\n${ragChunkBlocks(res.selected, sources).join('\n---\n')}`
                      : `${label}: nothing relevant found.`
                  )
                } catch (err) {
                  console.warn('search_knowledge_base failed:', err)
                  kbResults.push(`${label}: the search failed.`)
                } finally {
                  setRagSearching(false)
                }
              } else if (tc.toolName === 'get_day' || tc.toolName === 'notes_by_date') {
                const args = parsedArgs as Record<string, unknown>
                const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
                const from = str(tc.toolName === 'get_day' ? args.date : args.from)
                const to = str(tc.toolName === 'get_day' ? args.date : args.to)
                let result: string
                try {
                  result = await notesByDateText(from, to, str(args.notebook) || undefined, sources)
                } catch (err) {
                  console.warn(`${tc.toolName} failed:`, err)
                  result = 'Notes are unavailable right now.'
                }
                noteResults.push(`${tc.toolName} ${tc.argumentsJson} (today is ${currentDate}):\n${result}`)
              } else if (tc.toolName === 'update_folder_memory') {
                const newMemory = typeof parsedArgs.memory === 'string' ? parsedArgs.memory : null
                if (newMemory !== null && containingFolder) {
                  setFolderMemory(containingFolder.id, newMemory)
                  setFolderMemoryUpdatedAt(Date.now())
                }
              }
            }

            if (toolCancelledRef.current) {
              toolCallHandlerRef.current = null
              return
            }
            const toolTasksMessage: ChatMessageInput | null =
              taskResults.length > 0
                ? {
                    role: 'system',
                    content: `You looked up the user's tasks. Answer from these results only; do not invent tasks.\n\n${taskResults.join('\n\n')}`,
                  }
                : null
            const toolKbMessage: ChatMessageInput | null =
              kbResults.length > 0
                ? {
                    role: 'system',
                    content: `You searched the user's knowledge base. Cite these excerpts inline as [n] right after the claim they support (the numbering continues the excerpts above). Use only what they say.\n\n${kbResults.join('\n\n')}`,
                  }
                : null
            const toolNotesMessage: ChatMessageInput | null =
              noteResults.length > 0
                ? {
                    role: 'system',
                    content: `You looked up the user's notes by date. Answer from these notes only; do not invent notes or entries. Cite them inline as [n] right after the claim they support.\n\n${noteResults.join('\n\n')}`,
                  }
                : null
            // Fontes trazidas pelas tools (qualquer uma): somam-se às do RAG na
            // mensagem e tiram o aviso "nada relevante" do RAG automático.
            const toolFound = sources.length > turnRagSources.length
            if (toolFound) {
              updateMessages(targetId, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantId ? { ...m, ragSources: sources, ragNothingFound: undefined } : m
                )
              )
            }

            const toolApiMessages: ChatMessageInput[] = [
              ...systemMessages,
              ...(ephemeralSystemMessage ? [ephemeralSystemMessage] : []),
              // O aviso "nada relevante" do RAG automático sai se uma tool trouxe fontes.
              ...(ragSystemMessage && !(toolFound && turnRagSources.length === 0) ? [ragSystemMessage] : []),
              ...(toolSearchMessage ? [toolSearchMessage] : []),
              ...(toolTasksMessage ? [toolTasksMessage] : []),
              ...(toolKbMessage ? [toolKbMessage] : []),
              ...(toolNotesMessage ? [toolNotesMessage] : []),
              // Esta rodada vai sem tools: sem o aviso, prompts como o da
              // memória levam o modelo a pedir outra tool (e não responder).
              {
                role: 'system',
                content: 'Tools are not available in this step. Answer the user now in plain text using the context above; do not call any tool.',
              },
              ...historyForApi,
              { role: 'user', content: userContent },
            ]
            if (import.meta.env.DEV)
              console.log('[useChat] context sent to AI (post tool-call):', toolApiMessages)

            const requestId2 = crypto.randomUUID()
            activeStreamRef.current = { requestId: requestId2, convId: targetId, assistantId, model }
            setIsStreaming(true)
            toolCallHandlerRef.current = null

            await startOpenRouterStreamMessages({
              requestId: requestId2,
              model,
              messages: toolApiMessages,
              thinking: thinkingEnabled,
            })
          } catch (toolErr) {
            toolCallHandlerRef.current = null
            const message =
              toolErr instanceof Error ? toolErr.message : String(toolErr ?? 'unknown error')
            failOnAssistant(message)
          }
        }
      }

      try {
        await startOpenRouterStreamMessages({
          requestId,
          model,
          messages: apiMessages,
          thinking: thinkingEnabled,
          tools: toolsPayload,
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err ?? 'erro desconhecido')
        failOnAssistant(message)
      }
    },
    [activeId, dedicatedFolderName, isDetached, mode, isStreaming, model, models, setFolders, setLooseOrder, updateMessages, thinkingEnabled]
  )

  useEffect(() => {
    return () => {
      const stream = activeStreamRef.current
      if (stream) {
        cancelOpenRouterStream(stream.requestId).catch((e) =>
          console.error('failed to cancel chat stream on unmount', e)
        )
        activeStreamRef.current = null
      }
    }
  }, [])

  const cancel = useCallback(() => {
    // Signal tool handler to abort even if activeStreamRef is null (tool executing)
    toolCancelledRef.current = true
    toolCallHandlerRef.current = null
    setDeepResearchPhase(null)
    setWebSearchActive(false)
    librarianContextRef.current = null

    const stream = activeStreamRef.current
    if (!stream) return
    void cancelOpenRouterStream(stream.requestId)
    updateMessages(stream.convId, (msgs) => {
      const last = msgs[msgs.length - 1]
      if (last && last.id === stream.assistantId && last.content === '') {
        return msgs.slice(0, -1)
      }
      return msgs
    })
    activeStreamRef.current = null
    setIsStreaming(false)
  }, [updateMessages])

  // Registro desta instância em `mountedChats`. Antes de apagar ou fundir uma
  // pasta, para o turno em andamento numa conversa dela (antes do stream
  // começar, a conversa do turno é a ativa).
  const mountedRef = useRef<MountedChat | null>(null)
  const cancelIfStreamingIn = (folderId: string) => {
    const folder = foldersRef.current.find((f) => f.id === folderId)
    const convId = activeStreamRef.current?.convId ?? activeId
    if (!isStreaming || !folder || !convId) return
    if (folderConversationIds(folder, conversationsRef.current, foldersRef.current).includes(convId)) cancel()
  }
  mountedRef.current = {
    hasFolder: (id) => foldersRef.current.some((f) => f.id === id),
    deleteFolder: (id) => {
      cancelIfStreamingIn(id)
      deleteFolder(id)
    },
    mergeFolderInto: (sourceId, destId) => {
      cancelIfStreamingIn(sourceId)
      mergeFolderInto(sourceId, destId)
    },
    renameFolder,
  }
  useEffect(() => {
    mountedChats.add(mountedRef)
    return () => {
      mountedChats.delete(mountedRef)
    }
  }, [])

  const activeConversation =
    conversations.find((c) => c.id === activeId) ??
    (draftConversation && draftConversation.id === activeId
      ? draftConversation
      : null)
  const messages = activeConversation?.messages ?? []

  return {
    conversations,
    folders,
    looseConversationIds: looseOrder,
    activeId,
    activeConversation,
    messages,
    model,
    setModel,
    hasApiKey,
    apiKeyChecked,
    refreshApiKey,
    tools,
    setTool,
    isStreaming,
    deepResearchPhase,
    webSearchActive,
    ragSearching,
    ragTraces,
    thinkingEnabled,
    toggleThinking: () => setThinkingEnabled((v) => !v),
    error,
    send,
    cancel,
    selectConversation,
    newConversation,
    newConversationInFolder,
    startAssistantConversation,
    ensureAssistantFolder,
    ensureScopedFolder,
    deleteConversation,
    renameConversation,
    createFolder,
    renameFolder,
    deleteFolder,
    setFolderExpanded,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    getFolderVisibleDocumentIds,
    getFolderNotebookId,
    setFolderMemory,
    setFolderMemoryEnabled,
    setFolderWebResearchEnabled,
    folderMemoryUpdatedAt,
    webSourcesSaved,
    moveConversation,
    removeConversationFromFolder,
    reorderFolders,
    reorderInFolder,
    reorderLoose,
  }
}
