import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatSearchResults, hasTavilyKey, webSearch } from '../lib/search'
import {
  cancelOpenRouterStream,
  hasOpenRouterKey,
  onOpenRouterChunk,
  onOpenRouterDone,
  onOpenRouterError,
  startOpenRouterStreamMessages,
  type ChatMessageInput,
} from '../lib/openrouter'

// ─── System prompt do chat ───────────────────────────────────────────────────
// Edite aqui para ajustar o comportamento do modelo no modo chat.
const CHAT_SYSTEM_PROMPT = `## Tom e postura
Responda como um professor especialista no tema da pergunta — alguém que domina o assunto e sabe explicar bem, sem ser condescendente. Seja paciente, claro e direto. Adapte o nível de profundidade ao perfil aparente de quem pergunta: se a pergunta for técnica, responda tecnicamente; se for de iniciante, explique do jeito mais acessível possível. Em caso de dúvida sobre o nível, prefira o mais técnico.

Evite preâmbulos como "Ótima pergunta!" ou "Claro, posso te ajudar com isso." Vá direto ao ponto. Seja conciso — não alongue respostas que não precisam ser longas.

## Formato
- Use markdown apenas quando ajudar a clareza: blocos de código, tabelas comparativas, listas quando há itens enumeráveis de verdade
- Para perguntas simples, responda em prosa — não transforme tudo em lista
- Evite emojis e formatação decorativa
- Em respostas longas, use headers para organizar

## Web search e citações
Quando usar busca na web, cite as fontes com links inline, próximo à afirmação que elas suportam. Distribua as citações ao longo do texto — não agrupe tudo no final. Se os resultados forem inconclusivos ou desatualizados, diga explicitamente.

## Precisão
Se não souber algo com certeza, diga — não invente. Quando houver múltiplas abordagens válidas, apresente as opções com os trade-offs reais, não apenas "depende".

## Idioma
Responda no mesmo idioma da pergunta.`
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
              content: `Use os resultados de busca na web abaixo para informar sua resposta. Cite as fontes quando relevante.\n\n${formatted}`,
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
