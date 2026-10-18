import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ChatMessage } from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import styles from './ChatMessageBubble.module.css'

interface ChatMessageBubbleProps {
  message: ChatMessage
  isStreaming: boolean
  // Ausente esconde o botao "Save to note".
  onSaveToNote?: (content: string) => void
  // Conteudo extra abaixo da resposta do assistant.
  footer?: ReactNode
}

export function ChatMessageBubble({ message, isStreaming, onSaveToNote, footer }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
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
      if (!cancelled) setHtml(out)
    })
    return () => {
      cancelled = true
    }
  }, [isUser, message.content, cacheKey])

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
            className={styles.assistantBody}
            dangerouslySetInnerHTML={{ __html: html }}
            onClick={(e) => {
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
    </div>
  )
}
