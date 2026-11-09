import { CalendarPlus, IdentificationCard } from '@phosphor-icons/react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ChatMessage } from '../../hooks/useChat'
import { agentNoteDraft, type AgentNoteDraft } from '../../lib/agentNotes'
import { CHAT_AGENTS } from '../../lib/agents/chat'
import { dateKeyFromMs } from '../../lib/calendar'
import { renderMarkdown } from '../../lib/markdown'
import { linkNoteMarks } from '../../lib/noteMarks'
import { clickedImage, useImageViewer } from '../ImageViewer/ImageViewer'
import styles from './ChatMessageBubble.module.css'

// Respostas que levam o rótulo do agente: com agentId diferente do da resposta
// anterior do assistant (General não grava agentId).
export function agentLabelIds(messages: ChatMessage[]): Set<string> {
  const ids = new Set<string>()
  let previous: string | undefined
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    if (m.agentId && m.agentId !== previous) ids.add(m.id)
    previous = m.agentId
  }
  return ids
}

// Ícone + nome do agente acima da resposta (id desconhecido = sem rótulo).
export function AgentReplyLabel({ agentId }: { agentId: string | undefined }) {
  const agent = CHAT_AGENTS.find((a) => a.id === agentId)
  if (!agent) return null
  const Icon = agent.icon
  return (
    <div className={styles.agentLabel}>
      <Icon size={12} aria-hidden />
      {agent.label}
    </div>
  )
}

interface ChatMessageBubbleProps {
  message: ChatMessage
  isStreaming: boolean
  // Mostra o rótulo do agente acima da resposta (ver agentLabelIds).
  showAgentLabel?: boolean
  // Ausente esconde o botao "Save to note".
  onSaveToNote?: (content: string) => void
  // Ausente esconde o "Save as Plan note" (resposta do planner com plano datado).
  onSaveAgentNote?: (draft: AgentNoteDraft) => void
  // Clique numa marca (`==texto==`) citada na resposta: abre a nota nela (o
  // App decide entre abrir direto e o seletor de notas).
  onOpenMark?: (text: string) => void
  // Conteudo extra abaixo da resposta do assistant.
  footer?: ReactNode
}

export function ChatMessageBubble({
  message,
  isStreaming,
  showAgentLabel,
  onSaveToNote,
  onSaveAgentNote,
  onOpenMark,
  footer,
}: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const imageViewer = useImageViewer()
  const isStreamingPlaceholder = !isUser && message.content.length === 0
  const isErrorMessage =
    !isUser &&
    message.content.startsWith('Error:')
  const canSaveToNote =
    !isUser &&
    !isStreaming &&
    !isStreamingPlaceholder &&
    !isErrorMessage &&
    message.content.trim().length > 0
  const agentDraft = useMemo(
    () => (canSaveToNote && onSaveAgentNote ? agentNoteDraft(message, dateKeyFromMs(Date.now())) : null),
    [canSaveToNote, onSaveAgentNote, message]
  )

  const cacheKey = useMemo(
    () => (isUser ? null : `${message.id}:${message.content.length}`),
    [isUser, message.id, message.content]
  )

  useEffect(() => {
    if (isUser) return
    if (!message.content) {
      setHtml('')
      return
    }
    let cancelled = false
    renderMarkdown(message.content).then((out) => {
      if (!cancelled) setHtml(linkNoteMarks(out))
    })
    return () => {
      cancelled = true
    }
  }, [isUser, message.content, cacheKey])

  // Objeto estável: o React 19 reescreve o innerHTML quando a identidade do
  // { __html } muda, e isso desfaz a seleção do usuário na resposta.
  const bodyHtml = useMemo(() => ({ __html: html }), [html])

  function handleCopy() {
    if (isUser) return
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasAttachedDocs = isUser && message.attachedDocs && message.attachedDocs.length > 0

  return (
    <div
      className={isUser ? (hasAttachedDocs ? styles.bubbleUserWrapper : styles.bubbleUser) : styles.bubbleAssistant}
      data-role={message.role}
    >
      {!isUser && showAgentLabel && <AgentReplyLabel agentId={message.agentId} />}
      {isUser ? (
        <>
          {hasAttachedDocs && (
            <div className={styles.msgDocLabel}>
              {message.attachedDocs!.map((d) => (
                <span key={d.name} className={styles.msgDocChip}>{d.name}</span>
              ))}
            </div>
          )}
          <div className={hasAttachedDocs ? styles.bubbleUser : undefined}>
            {message.imageDataUrl && (
              <img
                src={message.imageDataUrl}
                alt="attached image"
                className={styles.userMessageImage}
                title="Open image"
                onClick={() => imageViewer.open(message.imageDataUrl!)}
              />
            )}
            <p className={styles.userText}>{message.content}</p>
          </div>
        </>
      ) : isStreamingPlaceholder ? (
        <span className={styles.streamingDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <>
          {message.thinking && (
            <details className={styles.thinking} open={isStreaming || undefined}>
              <summary className={styles.thinkingSummary}>Thinking</summary>
              <div className={styles.thinkingContent}>{message.thinking}</div>
            </details>
          )}
          <div
            className={`${styles.assistantBody} ${onOpenMark ? styles.markClickable : ''}`}
            dangerouslySetInnerHTML={bodyHtml}
            onClick={(e) => {
              const nm = (e.target as HTMLElement).closest('mark[data-nm]')
              if (nm) {
                const text = nm.getAttribute('data-nm')
                if (text) onOpenMark?.(text)
                return
              }
              const img = clickedImage(e)
              if (img) {
                imageViewer.open(img.src, img.alt)
                return
              }
              const target = (e.target as HTMLElement).closest('a')
              if (!target) return
              const href = target.getAttribute('href')
              if (!href || !href.startsWith('http')) return
              e.preventDefault()
              void openUrl(href)
            }}
          />
          {!isStreaming && message.model && (
            <div className={styles.msgMeta}>
              <span>{message.model}</span>
              {message.tokensPerSecond !== undefined && (
                <span>{message.tokensPerSecond} tok/s</span>
              )}
            </div>
          )}
          <div className={styles.assistantActions}>
            {agentDraft && onSaveAgentNote && (
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => onSaveAgentNote(agentDraft)}
                aria-label={
                  agentDraft.kind === 'profile' ? 'Save this study profile as a note' : 'Save this plan as a Plan note'
                }
              >
                {agentDraft.kind === 'profile' ? (
                  <IdentificationCard size={13} aria-hidden />
                ) : (
                  <CalendarPlus size={13} aria-hidden />
                )}
                {agentDraft.kind === 'profile' ? 'Save study profile' : 'Save as Plan note'}
              </button>
            )}
            {canSaveToNote && onSaveToNote && (
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => onSaveToNote(message.content)}
                aria-label="Save response to a note"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 2h8l2 2v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
                  <polyline points="5,2 5,7 10,7 10,2" />
                  <line x1="5" y1="11" x2="11" y2="11" />
                </svg>
                Save to note
              </button>
            )}
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy response'}
              aria-label="Copy response"
            >
              {copied ? (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="3,8 6,11 13,4" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="5" width="9" height="9" rx="1" />
                  <path d="M11 4V3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1" />
                </svg>
              )}
            </button>
          </div>
          {/* Resposta com erro: sem "Sources", que sugeririam uma resposta baseada nelas. */}
          {!isErrorMessage && footer}
        </>
      )}
      {imageViewer.viewer}
    </div>
  )
}
