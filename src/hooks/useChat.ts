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
  startOpenRouterStreamMessages,
  type ChatMessageInput,
  type ContentBlock,
} from '../lib/openrouter'
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
  return { ...f, systemPrompt: sp, systemPromptMode: mode, visibleDocumentIds }
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
        const { imageDataUrl: _, ...rest } = m
        return rest
      }),
    }))
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(stripped))
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
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(list))
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
    localStorage.setItem(LOOSE_ORDER_KEY, JSON.stringify(order))
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
    createdAt: now,
    updatedAt: now,
  }
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
  thinkingEnabled: boolean
  toggleThinking: () => void
  error: string | null
  send: (text: string, imageDataUrl?: string) => Promise<void>
  cancel: () => void
  selectConversation: (id: string) => void
  newConversation: () => void
  newConversationInFolder: (folderId: string) => void
  deleteConversation: (id: string) => void
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
  moveConversation: (
    convId: string,
    target: { type: 'loose'; index?: number } | { type: 'folder'; folderId: string; index?: number }
  ) => void
  removeConversationFromFolder: (convId: string) => void
  reorderFolders: (newOrder: string[]) => void
  reorderInFolder: (folderId: string, newOrder: string[]) => void
  reorderLoose: (newOrder: string[]) => void
}

export function useChat(): UseChatResult {
  // Estado inicial reconciliado entre conversas + folders + looseOrder
  const [conversations, setConversations] = useState<ChatConversation[]>(() =>
    loadConversations()
  )
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

  // Garante que activeId aponta pra uma conversa existente
  useEffect(() => {
    if (activeId && !conversations.some((c) => c.id === activeId)) {
      setActiveIdState(conversations[0]?.id ?? null)
    }
  }, [conversations, activeId])

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
    if (activeId) localStorage.setItem(ACTIVE_ID_KEY, activeId)
    else localStorage.removeItem(ACTIVE_ID_KEY)
  }, [activeId])

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

  const deleteConversation = useCallback(
    (id: string) => {
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
      setFolders((prev) => {
        const next = prev.map((f) =>
          f.id === folderId ? { ...f, visibleDocumentIds, updatedAt: new Date().toISOString() } : f
        )
        saveFolders(next)
        return next
      })
    },
    [],
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
        activeStreamRef.current = null
        setIsStreaming(false)
        setDeepResearchPhase(null)
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
        activeStreamRef.current = null
        setIsStreaming(false)
        setDeepResearchPhase(null)
      })
      if (cancelled) {
        chunk()
        reasoning()
        done()
        err()
        return
      }
      unlisteners.push(chunk, reasoning, done, err)
    })().catch((e) => console.error('failed to subscribe to openrouter events', e))
    return () => {
      cancelled = true
      unlisteners.forEach((u) => u())
    }
  }, [updateMessages])

  const send = useCallback(
    async (text: string, imageDataUrl?: string) => {
      const trimmed = text.trim()
      if (!trimmed && !imageDataUrl) return
      if (isStreaming) return
      if (!model) {
        setError('Select a model before sending.')
        return
      }
      setError(null)

      // Garante uma conversa ativa
      let convId = activeId
      if (!convId) {
        const conv = makeNewConversation()
        convId = conv.id
        setConversations((prev) => [conv, ...prev])
        setLooseOrder((prev) => [conv.id, ...prev])
        setActiveIdState(conv.id)
      }
      const targetId = convId

      // Captura o historico ANTES de inserir a nova mensagem do usuario,
      // senao ela apareceria duplicada no payload (no historico + na ultima msg).
      const currentConv = conversationsRef.current.find((c) => c.id === targetId)
      const historyForApi: ChatMessageInput[] =
        currentConv?.messages.map((m) => ({
          role: m.role,
          content: m.imageDataUrl
            ? ([
                { type: 'image_url', image_url: { url: m.imageDataUrl } },
                { type: 'text', text: m.content },
              ] as ContentBlock[])
            : m.content,
        })) ?? []

      // Insere a mensagem do usuario + placeholder do assistant ANTES dos awaits
      // (chave de API, web search) para a UI responder imediatamente. Erros sao
      // refletidos no proprio placeholder do assistant.
      const userMsg: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: trimmed,
        imageDataUrl: imageDataUrl || undefined,
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
      }

      const keyPresent = await hasOpenRouterKey()
      if (!keyPresent) {
        setHasApiKey(false)
        setApiKeyChecked(true)
        failOnAssistant(
          'API key not configured. Add your OpenRouter key in Settings.'
        )
        return
      }
      setHasApiKey(true)
      setApiKeyChecked(true)

      // Busca web — deep research tem prioridade sobre web search simples
      let searchSystemMessage: ChatMessageInput | null = null
      if (toolsRef.current.deepResearch) {
        const tavilyOk = await hasTavilyKey()
        if (!tavilyOk) {
          failOnAssistant(
            'Deep Research is active but the Tavily key is not configured in Settings > Web Search.'
          )
          return
        }
        try {
          const { formattedContext, sources } = await runDeepResearch(
            trimmed,
            (phase) => setDeepResearchPhase(phase)
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
      } else if (toolsRef.current.webSearch) {
        const tavilyOk = await hasTavilyKey()
        if (!tavilyOk) {
          failOnAssistant(
            'Web Search is active but the Tavily key is not configured in Settings > Web Search.'
          )
          return
        }
        try {
          const currentDate = new Date().toISOString().slice(0, 10)
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

      // System prompt da pasta (se houver) + modo de aplicacao
      // - sem pasta ou prompt vazio -> apenas o prompt padrao
      // - modo "replace" -> apenas o prompt da pasta (padrao nao entra)
      // - modo "append"  -> prompt padrao primeiro, depois o da pasta
      const containingFolder = foldersRef.current.find((f) =>
        f.conversationIds.includes(targetId)
      )
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

      const userContent: string | ContentBlock[] = imageDataUrl
        ? [
            { type: 'image_url', image_url: { url: imageDataUrl } },
            { type: 'text', text: trimmed },
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

      try {
        await startOpenRouterStreamMessages({
          requestId,
          model,
          messages: apiMessages,
          thinking: thinkingEnabled,
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err ?? 'erro desconhecido')
        failOnAssistant(message)
      }
    },
    [activeId, isStreaming, model, setLooseOrder, updateMessages, thinkingEnabled]
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
    setDeepResearchPhase(null)
  }, [updateMessages])

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null
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
    thinkingEnabled,
    toggleThinking: () => setThinkingEnabled((v) => !v),
    error,
    send,
    cancel,
    selectConversation,
    newConversation,
    newConversationInFolder,
    deleteConversation,
    createFolder,
    renameFolder,
    deleteFolder,
    setFolderExpanded,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    moveConversation,
    removeConversationFromFolder,
    reorderFolders,
    reorderInFolder,
    reorderLoose,
  }
}
