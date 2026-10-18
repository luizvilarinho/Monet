import { useEffect, useMemo, useState } from 'react'
import type { AiModel } from '../types'
import type { ChatMessage } from './useChat'

interface UseChatPanelStateParams {
  model: string | null
  setModel: (id: string | null) => void
  messages: ChatMessage[]
  isStreaming: boolean
  folderMemoryUpdatedAt: number | null
  webSourcesSaved: { count: number; at: number } | null
}

// Estado de tela comum ao Chat e ao Assistant: modelo padrão ao carregar a
// lista, a mensagem em streaming e os toasts de memória e de fontes web.
export function useChatPanelState(
  models: AiModel[],
  { model, setModel, messages, isStreaming, folderMemoryUpdatedAt, webSourcesSaved }: UseChatPanelStateParams
) {
  const [memoryToastVisible, setMemoryToastVisible] = useState(false)
  const [webSourcesToast, setWebSourcesToast] = useState<{ count: number } | null>(null)

  // Seleciona um modelo padrão quando a lista carregar.
  useEffect(() => {
    if (models.length === 0) return
    if (model && models.some((m) => m.id === model)) return
    const fallback = localStorage.getItem('lastModelId')
    const next =
      fallback && models.some((m) => m.id === fallback) ? fallback : models[0].id
    setModel(next)
  }, [models, model, setModel])

  useEffect(() => {
    if (folderMemoryUpdatedAt === null) return
    setMemoryToastVisible(true)
    const id = window.setTimeout(() => setMemoryToastVisible(false), 4000)
    return () => window.clearTimeout(id)
  }, [folderMemoryUpdatedAt])

  useEffect(() => {
    if (webSourcesSaved === null) return
    setWebSourcesToast({ count: webSourcesSaved.count })
    const id = window.setTimeout(() => setWebSourcesToast(null), 4000)
    return () => window.clearTimeout(id)
  }, [webSourcesSaved])

  const selectedModel = models.find((m) => m.id === model)

  // A mensagem em streaming é sempre a última assistant da conversa ativa.
  const streamingMessageId = useMemo(() => {
    if (!isStreaming) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [isStreaming, messages])

  return { selectedModel, streamingMessageId, memoryToastVisible, webSourcesToast }
}
