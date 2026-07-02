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
import type { AiModel } from '../types'
import { formatSearchResults, hasTavilyKey, webSearch } from '../lib/search'
import { runDeepResearch, type DeepResearchPhase } from '../lib/deepResearch'

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

Never place links or citation markers in the middle of the text.
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

const CONVERSATIONS_KEY = 'monet:chat-conversations'
const FOLDERS_KEY = 'monet:chat-folders'
const LOOSE_ORDER_KEY = 'monet:chat-loose-order'
const ACTIVE_ID_KEY = 'monet:chat-active-id'
const MODEL_KEY = 'monet:chat-model'
const TOOLS_KEY = 'monet:chat-tools'
const LEGACY_HISTORY_KEY = 'monet:chat-history'
const RESPONSE_LINK_KEY = 'monet:ai-response-chat-link'

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
}

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
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
  createdAt: string
  updatedAt: string
}

export interface ChatTools {
  webSearch: boolean
  deepResearch: boolean
}

export type ConversationLocation =
  | { type: 'loose'; index: number }
  | { type: 'folder'; folderId: string; index: number }

const DEFAULT_TOOLS: ChatTools = { webSearch: false, deepResearch: false }

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
  return { ...f, systemPrompt: sp, systemPromptMode: mode, visibleDocumentIds, memory, memoryEnabled }
}

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first) return 'New conversation'
  const cleaned = first.content.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New conversation'
  return cleaned.length > 50 ? cleaned.slice(0, 50) + '…' : cleaned
}

function loadConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every(isConversation)) {
        return parsed as ChatConversation[]
      }
    }
  } catch {
    /* ignore */
  }
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
        }
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([conv]))
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
    // Anti-loop do sync cross-window: se o valor ja persistido for identico
    // (caso tipico de hidratacao via evento `storage`), nao re-grava — assim
    // nao dispara um novo evento `storage` na outra janela.
    if (serialized === localStorage.getItem(CONVERSATIONS_KEY)) return
    localStorage.setItem(CONVERSATIONS_KEY, serialized)
  } catch (err) {
    console.error('failed to persist chat conversations', err)
  }
}

function loadFolders(): ChatFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
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

function saveFolders(list: ChatFolder[]) {
  try {
    const serialized = JSON.stringify(list)
    if (serialized === localStorage.getItem(FOLDERS_KEY)) return
    localStorage.setItem(FOLDERS_KEY, serialized)
  } catch (err) {
    console.error('failed to persist chat folders', err)
  }
}

function loadLooseOrder(): string[] {
  try {
    const raw = localStorage.getItem(LOOSE_ORDER_KEY)
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

function saveLooseOrder(order: string[]) {
  try {
    const serialized = JSON.stringify(order)
    if (serialized === localStorage.getItem(LOOSE_ORDER_KEY)) return
    localStorage.setItem(LOOSE_ORDER_KEY, serialized)
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

export function chatConversationExists(conversationId: string): boolean {
  return loadConversations().some((c) => c.id === conversationId)
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

function makeNewConversation(): ChatConversation {
  const now = new Date().toISOString()
  return {
    id: nanoid(),
    title: 'New conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
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
// duplicatas, retorna o array inalterado (mesma referencia).
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

// Reconcilia ordens persistidas com o conjunto atual de conversas.
// Conversas novas (sem registro de ordem) vao para o topo da lista solta.
function reconcileOrders(
  conversations: ChatConversation[],
  folders: ChatFolder[],
  looseOrder: string[]
): { folders: ChatFolder[]; looseOrder: string[] } {
  const allIds = new Set(conversations.map((c) => c.id))
  const seen = new Set<string>()

  // Consolida pastas `assistant` duplicadas ANTES de reconciliar, garantindo
  // que o estado nunca carregue mais de uma pasta `assistant` (raiz do bug do
  // system prompt nao aplicado: prompt gravado numa pasta, lido de outra).
  folders = dedupeAssistantFolders(folders)

  const nextFolders = folders.map((f) => {
    const cleaned = f.conversationIds.filter((id) => {
      if (!allIds.has(id)) return false
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    return { ...f, conversationIds: cleaned }
  })

  const cleanedLoose = looseOrder.filter((id) => {
    if (!allIds.has(id)) return false
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  // Conversas nao registradas em pasta nem em ordem solta -> topo da lista solta
  const unseen = conversations.filter((c) => !seen.has(c.id)).map((c) => c.id)
  const nextLoose = [...unseen, ...cleanedLoose]

  return { folders: nextFolders, looseOrder: nextLoose }
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
  thinkingEnabled: boolean
  toggleThinking: () => void
  error: string | null
  send: (text: string, imageDataUrl?: string, documents?: Array<{ name: string; type: string; data: string }>) => Promise<void>
  cancel: () => void
  selectConversation: (id: string) => void
  newConversation: () => void
  newConversationInFolder: (folderId: string) => void
  startAssistantConversation: () => void
  ensureAssistantFolder: () => void
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
  setFolderMemory: (folderId: string, text: string) => void
  setFolderMemoryEnabled: (folderId: string, enabled: boolean) => void
  folderMemoryUpdatedAt: number | null
  moveConversation: (
    convId: string,
    target: { type: 'loose'; index?: number } | { type: 'folder'; folderId: string; index?: number }
  ) => void
  removeConversationFromFolder: (convId: string) => void
  reorderFolders: (newOrder: string[]) => void
  reorderInFolder: (folderId: string, newOrder: string[]) => void
  reorderLoose: (newOrder: string[]) => void
}

export function useChat(
  models: AiModel[] = [],
  options?: { isAssistant?: boolean }
): UseChatResult {
  const isAssistant = options?.isAssistant ?? false
  // Estado inicial reconciliado entre conversas + folders + looseOrder
  const [conversations, setConversations] = useState<ChatConversation[]>(() =>
    loadConversations()
  )
  // Conversa-rascunho da janela assistant: vive SO em memoria ate a 1a mensagem.
  // Abrir/fechar o assistant sem enviar nada nao deixa rastro no localStorage.
  const [draftConversation, setDraftConversation] = useState<ChatConversation | null>(null)
  const draftRef = useRef<ChatConversation | null>(null)
  draftRef.current = draftConversation
  const [folders, setFoldersState] = useState<ChatFolder[]>(() => {
    const initialConvs = loadConversations()
    const initialFolders = loadFolders()
    const initialLoose = loadLooseOrder()
    const reconciled = reconcileOrders(initialConvs, initialFolders, initialLoose)
    return reconciled.folders
  })
  const [looseOrder, setLooseOrderState] = useState<string[]>(() => {
    const initialConvs = loadConversations()
    const initialFolders = loadFolders()
    const initialLoose = loadLooseOrder()
    const reconciled = reconcileOrders(initialConvs, initialFolders, initialLoose)
    return reconciled.looseOrder
  })

  const [activeId, setActiveIdState] = useState<string | null>(() => {
    const saved = localStorage.getItem(ACTIVE_ID_KEY)
    return saved && saved.length > 0 ? saved : null
  })
  const [model, setModelState] = useState<string | null>(
    () => localStorage.getItem(MODEL_KEY)
  )
  const [tools, setToolsState] = useState<ChatTools>(() => loadTools())
  const toolsRef = useRef<ChatTools>(tools)
  toolsRef.current = tools
  const [hasApiKey, setHasApiKey] = useState<boolean>(false)
  const [apiKeyChecked, setApiKeyChecked] = useState<boolean>(false)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [deepResearchPhase, setDeepResearchPhase] = useState<DeepResearchPhase | null>(null)
  const [webSearchActive, setWebSearchActive] = useState<boolean>(false)
  const [folderMemoryUpdatedAt, setFolderMemoryUpdatedAt] = useState<number | null>(null)
  const toolCallHandlerRef = useRef<((p: StreamToolCallPayload) => void) | null>(null)
  const toolCancelledRef = useRef<boolean>(false)
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
      setActiveIdState(conversations[0]?.id ?? null)
    }
  }, [conversations, activeId, draftConversation])

  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  useEffect(() => {
    saveFolders(folders)
  }, [folders])

  useEffect(() => {
    saveLooseOrder(looseOrder)
  }, [looseOrder])

  useEffect(() => {
    // O assistant sempre comeca em rascunho novo (so-memoria): nao deve
    // restaurar nem clobberar o ACTIVE_ID_KEY compartilhado da janela principal.
    // "Qual conversa esta ativa" e per-janela.
    if (isAssistant) return
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
      if (e.key === CONVERSATIONS_KEY) {
        const next = mergeRemoteConversations(loadConversations())
        setConversations(next)
        const r = reconcileOrders(next, loadFolders(), loadLooseOrder())
        setFoldersState(r.folders)
        setLooseOrderState(r.looseOrder)
      } else if (e.key === FOLDERS_KEY) {
        setFoldersState(dedupeAssistantFolders(loadFolders()))
      } else if (e.key === LOOSE_ORDER_KEY) {
        setLooseOrderState(loadLooseOrder())
      }
      // Outras chaves (ex.: ACTIVE_ID_KEY) NAO sao sincronizadas: "qual
      // conversa esta ativa" e per-janela.
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
      const conv = makeNewConversation()
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

  // Inicia uma conversa NOVA e zerada para a janela assistant a cada exibicao.
  // Persistencia preguiçosa: a conversa-rascunho vive SO em memoria e NAO toca o
  // localStorage. Ela so e materializada na pasta `assistant` quando o usuario
  // envia a 1a mensagem (ver `send`). Abrir/fechar sem enviar nao deixa rastro
  // nem cria conversa vazia, e nao ressuscita lista obsoleta na outra janela.
  const startAssistantConversation = useCallback(() => {
    const conv = makeNewConversation()
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
        const remaining = conversationsRef.current.filter((c) => c.id !== id)
        return remaining[0]?.id ?? null
      })
    },
    [setFolders, setLooseOrder]
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
      const convIdsToDelete = new Set(folder.conversationIds)
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
      setConversations((prev) =>
        prev.filter((c) => !convIdsToDelete.has(c.id))
      )
      setFolders((prev) => prev.filter((f) => f.id !== id))
      setActiveIdState((current) => {
        if (!current) return current
        if (!convIdsToDelete.has(current)) return current
        const remaining = conversationsRef.current.filter(
          (c) => !convIdsToDelete.has(c.id)
        )
        return remaining[0]?.id ?? null
      })
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
    [setFolders]
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
              ? { ...m, model: doneModel ?? stream.model, tokensPerSecond: tps }
              : m
          )
        )
        toolCallHandlerRef.current = null
        activeStreamRef.current = null
        setIsStreaming(false)
        setDeepResearchPhase(null)
        setWebSearchActive(false)
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
      })
      const toolCall = await onOpenRouterToolCall((p) => toolCallHandlerRef.current?.(p))
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
    async (text: string, imageDataUrl?: string, documents?: Array<{ name: string; type: string; data: string }>) => {
      const trimmed = text.trim()
      if (!trimmed && !imageDataUrl && (!documents || documents.length === 0)) return
      if (isStreaming) return
      if (!model) {
        setError('Select a model before sending.')
        return
      }
      setError(null)
      toolCancelledRef.current = false

      // Garante uma conversa ativa
      let convId = activeId
      const draft = draftRef.current
      if (draft && draft.id === activeId) {
        // Materializa o rascunho do assistant: insere na lista persistida e
        // vincula a pasta `assistant` (idempotente por nome), tudo via setters
        // de estado React.
        convId = draft.id
        setConversations((prev) => [draft, ...prev])
        setFolders((prev) => {
          const existing = prev.find((f) => f.name === ASSISTANT_FOLDER_NAME)
          if (existing) {
            return prev.map((f) =>
              f.id === existing.id
                ? {
                    ...f,
                    conversationIds: [draft.id, ...f.conversationIds],
                    expanded: true,
                    updatedAt: new Date().toISOString(),
                  }
                : f
            )
          }
          const folder = makeNewFolder(ASSISTANT_FOLDER_NAME)
          folder.conversationIds = [draft.id]
          return [folder, ...prev]
        })
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
        activeStreamRef.current = null
        setIsStreaming(false)
        setDeepResearchPhase(null)
        setWebSearchActive(false)
      }

      // Busca web — deep research tem prioridade sobre web search simples
      const currentDate = new Date().toISOString().slice(0, 10)
      const selectedModelInfo = models.find((m) => m.id === model)
      const supportsTools = selectedModelInfo?.supportsTools ?? false
      let searchSystemMessage: ChatMessageInput | null = null
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
      // No turno da 1a mensagem do assistant, a pasta `assistant` pode ter
      // acabado de ser criada via `setFolders` (assincrono) e ainda nao estar
      // refletida em `foldersRef.current`; resolvemos por NOME para aplicar
      // system prompt/RAG ja na 1a mensagem.
      const containingFolder = isAssistant
        ? foldersRef.current.find((f) => f.name === ASSISTANT_FOLDER_NAME) ??
          foldersRef.current.find((f) => f.conversationIds.includes(targetId))
        : foldersRef.current.find((f) => f.conversationIds.includes(targetId))
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
      systemMessages.push({ role: 'system', content: `Current date: ${currentDate}` })

      // RAG context for folder documents
      let ragSystemMessage: ChatMessageInput | null = null
      const folderDocIds = containingFolder?.visibleDocumentIds ?? []
      if (folderDocIds.length > 0 && trimmed.trim()) {
        try {
          const { embedText, documentsSearchByIds } = await import('../lib/documents')
          const embedding = await embedText(trimmed)
          const topK = 5
          const chunks = await documentsSearchByIds(folderDocIds, embedding, topK)
          if (chunks.length > 0) {
            const formatted = chunks
              .map((c) => `[${c.documentName}]\n${c.snippet}`)
              .join('\n\n---\n\n')
            ragSystemMessage = {
              role: 'system',
              content: `The following excerpts from your knowledge base documents are relevant to this conversation:\n\n${formatted}`,
            }
          }
        } catch (err) {
          console.warn('RAG search in chat failed (continuing without):', err)
        }
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
        ...(ragSystemMessage ? [ragSystemMessage] : []),
        ...(searchSystemMessage ? [searchSystemMessage] : []),
        ...historyForApi,
        { role: 'user', content: userContent },
      ]

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
      const toolsPayload: object[] | undefined = toolDefs.length > 0 ? toolDefs : undefined

      // Register tool call handler for this turn
      if (toolsPayload) {
        toolCallHandlerRef.current = async (p: StreamToolCallPayload) => {
          if (p.requestId !== requestId) return
          if (!activeStreamRef.current) return

          // Clear streaming state while tool executes
          activeStreamRef.current = null
          setIsStreaming(false)

          try {
            let toolSearchMessage: ChatMessageInput | null = null
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
                const formatted = formatSearchResults(deduplicated)
                if (formatted) {
                  toolSearchMessage = {
                    role: 'system',
                    content: `You have access to the following web search results. Use them to support your response and always cite sources with inline links in the format [Title](url), close to the claim each source supports. Do not group sources at the end — distribute citations throughout the text. Some results include an Image URL — only embed it using markdown image syntax \`![description](url)\` if the user explicitly asked to see or show images AND the URL appears verbatim in the search results above. Never invent, guess, or modify image URLs.\n\n${formatted}`,
                  }
                }
                setWebSearchActive(false)
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

            const toolApiMessages: ChatMessageInput[] = [
              ...systemMessages,
              ...(ragSystemMessage ? [ragSystemMessage] : []),
              ...(toolSearchMessage ? [toolSearchMessage] : []),
              ...historyForApi,
              { role: 'user', content: userContent },
            ]

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
    [activeId, isAssistant, isStreaming, model, models, setFolders, setLooseOrder, updateMessages, thinkingEnabled]
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
    deleteConversation,
    renameConversation,
    createFolder,
    renameFolder,
    deleteFolder,
    setFolderExpanded,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    setFolderMemory,
    setFolderMemoryEnabled,
    folderMemoryUpdatedAt,
    moveConversation,
    removeConversationFromFolder,
    reorderFolders,
    reorderInFolder,
    reorderLoose,
  }
}
