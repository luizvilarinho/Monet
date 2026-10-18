import { useState } from 'react'
import type { ChatMessage } from '../../hooks/useChat'
import { useRagDetailed } from '../../hooks/useRagDetailed'
import { isRagSourceOpenable, openRagSource, type RagResponse, type RagSource } from '../../lib/rag'
import { RagInspector } from './RagInspector'
import styles from './MessageSources.module.css'

interface MessageSourcesProps {
  message: ChatMessage
  // Trace do RAG desta resposta (só em memória, com o modo detalhado ligado).
  trace?: RagResponse
}

function sourceMeta(s: RagSource): string {
  return [s.kind, s.date, s.folder, s.page !== undefined ? `p. ${s.page}` : undefined]
    .filter(Boolean)
    .join(' · ')
}

function sourceTitle(s: RagSource): string {
  if (!isRagSourceOpenable(s)) return s.title
  if (s.documentId.startsWith('note:')) return 'Open note'
  if (s.url) return s.url
  return 'Open file'
}

// "Sources (n)" abaixo da resposta que usou o RAG, e o inspetor quando houver
// trace. Usado nos 4 chats (Chat, Anotações, Reader e Assistant).
export function MessageSources({ message, trace }: MessageSourcesProps) {
  const [open, setOpen] = useState(false)
  const [detailed] = useRagDetailed()
  const sources = message.ragSources ?? []
  const showInspector = detailed && !!trace

  if (message.role !== 'assistant') return null
  if (sources.length === 0 && !message.ragNothingFound && !showInspector) return null

  return (
    <div className={styles.wrap}>
      {sources.length > 0 ? (
        <>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg
              className={open ? styles.caretOpen : styles.caret}
              viewBox="0 0 16 16"
              width="10"
              height="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6,4 10,8 6,12" />
            </svg>
            Sources ({sources.length})
          </button>
          {open && (
            <ol className={styles.list}>
              {sources.map((s) => (
                <li key={s.n}>
                  <button
                    type="button"
                    className={styles.item}
                    disabled={!isRagSourceOpenable(s)}
                    title={sourceTitle(s)}
                    onClick={() => {
                      openRagSource(s).catch((err) => console.warn('Failed to open source:', err))
                    }}
                  >
                    <span className={styles.num}>[{s.n}]</span>
                    <span className={styles.title}>{s.title}</span>
                    <span className={styles.meta}>{sourceMeta(s)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : message.ragNothingFound ? (
        <p className={styles.empty}>No relevant sources found in your documents</p>
      ) : null}
      {showInspector && trace && <RagInspector trace={trace} />}
    </div>
  )
}
