import { invoke } from '@tauri-apps/api/core'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatSearchResults, hasTavilyKey, webSearch } from '../lib/search'

const CONVERSATIONS_KEY = 'monet:chat-conversations'
const ACTIVE_ID_KEY = 'monet:chat-active-id'
const MODEL_KEY = 'monet:chat-model'
const TOOLS_KEY = 'monet:chat-tools'
const LEGACY_HISTORY_KEY = 'monet:chat-history'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

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
  const abortRef = useRef<AbortController | null>(null)
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
    try {
      const present = await invoke<boolean>('has_openrouter_key')
      setHasApiKey(present)
      setApiKeyChecked(true)
      return present
    } catch {
      setHasApiKey(false)
      setApiKeyChecked(true)
      return false
    }
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

      const apiKey = await invoke<string | null>('get_openrouter_key').catch(
        () => null
      )
      if (!apiKey) {
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
      let searchSystemMessage: { role: 'system'; content: string } | null = null
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

      // Snapshot do historico ANTES de adicionar a nova mensagem (pra montar o body do fetch)
      const currentConv = conversationsRef.current.find((c) => c.id === targetId)
      const historyForApi =
        currentConv?.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })) ?? []

      updateMessages(targetId, (msgs) => [...msgs, userMsg, assistantMsg])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      const apiMessages = [
        ...(searchSystemMessage ? [searchSystemMessage] : []),
        ...historyForApi,
        { role: 'user' as const, content: trimmed },
      ]

      const finishWithError = (message: string) => {
        updateMessages(targetId, (msgs) =>
          msgs.map((m) =>
            m.id === assistantId && m.content === ''
              ? { ...m, content: `Erro: ${message}` }
              : m
          )
        )
        setError(message)
      }

      try {
        const response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://monet.local',
            'X-Title': 'Monet',
          },
          body: JSON.stringify({
            model,
            stream: true,
            messages: apiMessages,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(
            `OpenRouter respondeu ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`
          )
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('Resposta sem corpo de stream.')

        const decoder = new TextDecoder()
        let buffer = ''
        let finished = false

        while (!finished) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let newlineIdx: number
          while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
            const rawLine = buffer.slice(0, newlineIdx)
            buffer = buffer.slice(newlineIdx + 1)
            const line = rawLine.trim()
            if (!line || line.startsWith(':')) continue
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') {
              finished = true
              break
            }
            let json: any
            try {
              json = JSON.parse(data)
            } catch {
              continue
            }
            if (json?.error) {
              const msg =
                typeof json.error.message === 'string'
                  ? json.error.message
                  : 'Erro do OpenRouter'
              throw new Error(msg)
            }
            const delta: unknown = json?.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta.length > 0) {
              updateMessages(targetId, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + delta }
                    : m
                )
              )
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          // streaming cancelado pelo usuario
        } else {
          const message =
            err instanceof Error
              ? err.message
              : String(err ?? 'erro desconhecido')
          finishWithError(message)
        }
      } finally {
        abortRef.current = null
        setIsStreaming(false)
      }
    },
    [activeId, isStreaming, model, updateMessages]
  )

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
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
