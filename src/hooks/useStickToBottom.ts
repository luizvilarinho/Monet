import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from './useChat'

interface UseStickToBottomParams {
  messages: ChatMessage[]
  isStreaming: boolean
  activeId: string | null
}

// Rolagem do historico do chat: acompanha o fim so quando o usuario ja esta
// la, e expoe `atBottom` para o botao "voltar ao fim".
export function useStickToBottom({ messages, isStreaming, activeId }: UseStickToBottomParams) {
  const historyRef = useRef<HTMLDivElement | null>(null)
  const [atBottom, setAtBottom] = useState(true)

  // Scroll unico ao final do historico quando o usuario envia uma nova mensagem
  // na mesma conversa. Trocas de conversa nao disparam (cada conversa preserva
  // sua posicao). Streaming nao dispara (so o id da ultima msg de user importa).
  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].id
    }
    return null
  }, [messages])
  const prevActiveIdRef = useRef(activeId)
  const prevLastUserMessageIdRef = useRef(lastUserMessageId)
  useEffect(() => {
    const sameConv = prevActiveIdRef.current === activeId
    const userMsgChanged =
      prevLastUserMessageIdRef.current !== lastUserMessageId
    prevActiveIdRef.current = activeId
    prevLastUserMessageIdRef.current = lastUserMessageId
    if (!sameConv || !userMsgChanged || !lastUserMessageId) return
    const el = historyRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [activeId, lastUserMessageId])

  // Durante streaming, acompanha o crescimento da resposta rolando para baixo
  // somente se o usuario nao tiver scrollado para cima manualmente.
  useEffect(() => {
    if (!isStreaming) return
    const el = historyRef.current
    if (!el) return
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48
    if (isAtBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
    }
  }, [messages, isStreaming])

  function onScroll() {
    const el = historyRef.current
    if (!el) return
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 32)
  }

  function scrollToBottom() {
    const el = historyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  return { historyRef, atBottom, onScroll, scrollToBottom }
}
