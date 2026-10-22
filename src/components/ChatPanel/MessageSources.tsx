import { useState } from 'react'
import type { ChatMessage, ChatTimings } from '../../hooks/useChat'
import { useRagDetailed } from '../../hooks/useRagDetailed'
import { isRagSourceOpenable, openRagSource, type RagResponse, type RagSource } from '../../lib/rag'
import { RagInspector } from './RagInspector'
import styles from './MessageSources.module.css'

interface MessageSourcesProps {
  message: ChatMessage
  // Trace do RAG desta resposta (só em memória, com o modo detalhado ligado).
  trace?: RagResponse
  // Tempos da resposta (só em memória); a linha compacta sai com o modo
  // detalhado ligado, mesmo sem fontes.
  timings?: ChatTimings
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

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

// Linha compacta: RAG com as etapas medidas, 1ª palavra, rodadas de tool e o
// total do turno. Etapa pulada não entra.
function timingLine(t: ChatTimings): string {
  const parts: string[] = []
  const stages = [
    t.rewriteMs !== undefined && `rewrite ${seconds(t.rewriteMs)}`,
    t.embeddingMs !== undefined && `embed ${seconds(t.embeddingMs)}`,
    t.searchMs !== undefined && `search ${seconds(t.searchMs)}`,
    t.rerankMs !== undefined && `rerank ${seconds(t.rerankMs)}`,
  ].filter((s): s is string => !!s)
  if (t.ragSkipped) parts.push('RAG skipped')
  else if (stages.length > 0) {
    const total = (t.rewriteMs ?? 0) + (t.embeddingMs ?? 0) + (t.searchMs ?? 0) + (t.rerankMs ?? 0)
    parts.push(`RAG ${seconds(total)} (${stages.join(' · ')})`)
  }
  if (t.rewriteFailed) parts.push('rewrite failed')
  if (t.rerankFailed) parts.push('rerank failed')
  if (t.firstWordMs !== undefined) parts.push(`first word ${seconds(t.firstWordMs)}`)
  if (t.toolRounds > 0) parts.push(`${t.toolRounds} tool round${t.toolRounds > 1 ? 's' : ''}`)
  if (t.totalMs !== undefined) parts.push(`total ${seconds(t.totalMs)}`)
  if (t.interrupted) parts.push('interrupted')
  return parts.join(' · ')
}

// "Sources (n)" abaixo da resposta que usou o RAG, e o inspetor quando houver
// trace. Usado nos 4 chats (Chat, Anotações, Reader e Assistant).
export function MessageSources({ message, trace, timings: timingsData }: MessageSourcesProps) {
  const [open, setOpen] = useState(false)
  const [detailed] = useRagDetailed()
  const sources = message.ragSources ?? []
  const showInspector = detailed && !!trace
  const timings = detailed && timingsData ? timingLine(timingsData) : ''

  if (message.role !== 'assistant') return null
  const hasFooter = sources.length > 0 || !!message.ragNothingFound || showInspector || !!timings
  if (!hasFooter) return null

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
      {timings && <p className={styles.timings}>{timings}</p>}
    </div>
  )
}
