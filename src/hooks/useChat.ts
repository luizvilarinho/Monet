import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelOpenRouterStream,
  hasOpenRouterKey,
  onOpenRouterChunk,
  onOpenRouterDone,
  onOpenRouterError,
  startOpenRouterStreamMessages,
  type ChatMessageInput,
} from '../lib/openrouter'
import { formatSearchResults, hasTavilyKey, webSearch } from '../lib/search'

// ─── System prompt do chat ───────────────────────────────────────────────────
// Edite aqui para ajustar o comportamento do modelo no modo chat.
const CHAT_SYSTEM_PROMPT = `
You are a study and research assistant. Your role is to help curious, 
intelligent people learn and understand new topics — they may be beginners 
in the subject, so always prioritize clarity without being condescending.

## Tone and posture
Respond like a knowledgeable, friendly professor: patient, clear, and direct. 
Adapt the depth automatically — if the question is technical, go technical; 
if it's from a beginner, make it accessible. When in doubt, lean toward 
the more technical interpretation.

Get to the point — no openers like "Great question!" or "Sure, I can help 
with that." But don't be cold: a direct answer can still have personality.

When explaining abstract concepts, use real-world analogies and concrete 
examples rather than generic definitions. Always make sure the fundamentals 
of the topic are clear before going deeper.

If the question is ambiguous, pick the most likely interpretation and answer 
it — don't ask for clarification on simple questions. If you're assuming 
something, say so briefly at the start.

When the topic allows, suggest a learning path — not just a list of 
resources, but a sequence with a brief reason for the order.

When relevant and natural, suggest complementary study resources: books and 
scientific articles are preferred over blog posts.

## Format
- Use markdown only when it genuinely helps clarity: code blocks, comparison 
  tables, lists when there are truly enumerable items
- For simple questions, answer in prose — don't turn everything into a list
- No emojis or decorative formatting
- For long responses, use headers to organize

## Web search and citations
When using web search results, cite sources with inline links next to the 
claim they support — format: [Title](url). Distribute citations throughout 
the text, not grouped at the end. When search results include concrete data 
(ratings, statistics, dates), cite them directly rather than paraphrasing. 
If results are inconclusive or outdated, say so explicitly.

## Accuracy
If you're not sure about something, say so — don't fabricate. When multiple 
valid approaches exist, present the options with real trade-offs, not just 
"it depends." Never invent sources, quotes, or statistics.

## Language
Always respond in the same language as the user's message.`
// ─────────────────────────────────────────────────────────────────────────────

const CONVERSATIONS_KEY = 'monet:chat-conversations'
const ACTIVE_ID_KEY = 'monet:chat-active-id'
const MODEL_KEY = 'monet:chat-model'
const TOOLS_KEY = 'monet:chat-tools'
const LEGACY_HISTORY_KEY = 'monet:chat-history'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface ChatTools {
  webSearch: boolean
}

const DEFAULT_TOOLS: ChatTools = { webSearch: false }

function loadTools(): ChatTools {
  try {
    const raw = localStorage.getItem(TOOLS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return { webSearch: !!(parsed as Record<string, unknown>).webSearch }
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

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first) return 'Nova conversa'
  const cleaned = first.content.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'Nova conversa'
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
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('failed to persist chat conversations', err)
  }
}

function makeNewConversation(): ChatConversation {
  const now = new Date().toISOString()
  return {
    id: nanoid(),
    title: 'Nova conversa',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export interface UseChatResult {
  conversations: ChatConversation[]
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
  error: string | null
  send: (text: string) => Promise<void>
  selectConversation: (id: string) => void
  newConversation: () => void
  deleteConversation: (id: string) => void
}

export function useChat(): UseChatResult {
  const [conversations, setConversations] = useState<ChatConversation[]>(() =>
    loadConversations()
  )
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
  const [error, setError] = useState<string | null>(null)
  const activeStreamRef = useRef<{
    requestId: string
    convId: string
    assistantId: string
  } | null>(null)
  const conversationsRef = useRef<ChatConversation[]>(conversations)
  conversationsRef.current = conversations

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
  }, [])

  const newConversation = useCallback(() => {
    const conv = makeNewConversation()
    setConversations((prev) => [conv, ...prev])
    setActiveIdState(conv.id)
  }, [])

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
    setActiveIdState((current) => {
      if (current !== id) return current
      const remaining = conversationsRef.current.filter((c) => c.id !== id)
      return remaining[0]?.id ?? null
    })
  }, [])

  const updateMessages = useCallback(
    (convId: string, updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c
          const nextMessages = updater(c.messages)
          const titleNeedsUpdate =
            c.title === 'Nova conversa' ||
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
      const done = await onOpenRouterDone(({ requestId }) => {
        const stream = activeStreamRef.current
        if (!stream || stream.requestId !== requestId) return
        activeStreamRef.current = null
        setIsStreaming(false)
      })
      const err = await onOpenRouterError(({ requestId, message }) => {
        const stream = activeStreamRef.current
        if (!stream || stream.requestId !== requestId) return
        updateMessages(stream.convId, (msgs) =>
          msgs.map((m) =>
            m.id === stream.assistantId && m.content === ''
              ? { ...m, content: `Erro: ${message}` }
              : m
          )
        )
        setError(message)
        activeStreamRef.current = null
        setIsStreaming(false)
      })
      if (cancelled) {
        chunk()
        done()
        err()
        return
      }
      unlisteners.push(chunk, done, err)
    })().catch((e) => console.error('failed to subscribe to openrouter events', e))
    return () => {
      cancelled = true
      unlisteners.forEach((u) => u())
    }
  }, [updateMessages])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (isStreaming) return
      if (!model) {
        setError('Selecione um modelo antes de enviar.')
        return
      }
      setError(null)

      const keyPresent = await hasOpenRouterKey()
      if (!keyPresent) {
        setHasApiKey(false)
        setApiKeyChecked(true)
        setError(
          'Chave de API não configurada. Cadastre a chave do OpenRouter em Settings.'
        )
        return
      }
      setHasApiKey(true)
      setApiKeyChecked(true)

      // Busca web opcional (tool ativada)
      let searchSystemMessage: ChatMessageInput | null = null
      if (toolsRef.current.webSearch) {
        const tavilyOk = await hasTavilyKey()
        if (!tavilyOk) {
          setError(
            'Web Search está ativo mas a chave Tavily não está configurada em Settings > Busca Web.'
          )
          return
        }
        try {
          const results = await webSearch(trimmed)
          const formatted = formatSearchResults(results)
          if (formatted) {
            searchSystemMessage = {
              role: 'system',
              content: `Você tem acesso aos seguintes resultados de busca na web. Use-os para embasar sua resposta e cite obrigatoriamente as fontes com links inline no formato [Título](url), próximo à afirmação que cada fonte suporta. Não agrupe as fontes no final — distribua as citações ao longo do texto.\n\n${formatted}`,
            }
          }
        } catch (err) {
          console.warn('webSearch failed:', err)
          setError(
            `Falha ao buscar na web: ${err instanceof Error ? err.message : 'erro desconhecido'}. Enviando sem contexto de busca.`
          )
        }
      }

      // Garante uma conversa ativa
      let convId = activeId
      if (!convId) {
        const conv = makeNewConversation()
        convId = conv.id
        setConversations((prev) => [conv, ...prev])
        setActiveIdState(conv.id)
      }
      const targetId = convId

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      }
      const assistantId = nanoid()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      }

      const currentConv = conversationsRef.current.find((c) => c.id === targetId)
      const historyForApi: ChatMessageInput[] =
        currentConv?.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })) ?? []

      updateMessages(targetId, (msgs) => [...msgs, userMsg, assistantMsg])

      const apiMessages: ChatMessageInput[] = [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        ...(searchSystemMessage ? [searchSystemMessage] : []),
        ...historyForApi,
        { role: 'user', content: trimmed },
      ]

      const requestId = assistantId
      activeStreamRef.current = { requestId, convId: targetId, assistantId }
      setIsStreaming(true)

      try {
        await startOpenRouterStreamMessages({
          requestId,
          model,
          messages: apiMessages,
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err ?? 'erro desconhecido')
        updateMessages(targetId, (msgs) =>
          msgs.map((m) =>
            m.id === assistantId && m.content === ''
              ? { ...m, content: `Erro: ${message}` }
              : m
          )
        )
        setError(message)
        activeStreamRef.current = null
        setIsStreaming(false)
      }
    },
    [activeId, isStreaming, model, updateMessages]
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

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null
  const messages = activeConversation?.messages ?? []

  return {
    conversations,
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
    error,
    send,
    selectConversation,
    newConversation,
    deleteConversation,
  }
}
