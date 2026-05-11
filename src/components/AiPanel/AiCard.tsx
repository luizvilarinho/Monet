import { useEffect, useState } from 'react'
import type { AiResponse, AiSource } from '../../types'
import { renderMarkdown } from '../../lib/markdown'
import styles from './AiPanel.module.css'

const SourceIcon = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 2.5h6L12.5 5.5v8a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" />
    <polyline points="9.5 2.5 9.5 5.5 12.5 5.5" />
  </svg>
)

function SourcesSection({ sources }: { sources: AiSource[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <details className={styles.sources}>
      <summary className={styles.sourcesSummary}>
        <SourceIcon />
        Fontes ({sources.length})
      </summary>
      <ul className={styles.sourcesList}>
        {sources.map((s, i) => {
          const key = `${s.documentId}-${s.chunkIndex}-${i}`
          const isExpanded = !!expanded[key]
          return (
            <li key={key} className={styles.sourceItem}>
              <button
                type="button"
                className={styles.sourceToggle}
                onClick={() => toggle(key)}
                aria-expanded={isExpanded}
              >
                <SourceIcon />
                <span className={styles.sourceName}>{s.documentName}</span>
                <span className={styles.sourceMeta}>· trecho {s.chunkIndex + 1}</span>
              </button>
              {isExpanded && (
                <p className={styles.sourceSnippet}>{s.snippet}</p>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

export interface AiCardProps {
  response: AiResponse
  execIndex: number
  forceOpen?: boolean
  globalExpand?: boolean | null
  onDelete?: (id: string) => void
}

const STATUS_LABEL: Record<AiResponse['status'], string> = {
  streaming: 'respondendo...',
  completed: 'concluído',
  interrupted: 'interrompido',
  error: 'erro',
}

export function AiCard({ response, execIndex, forceOpen, globalExpand, onDelete }: AiCardProps) {
  const [open, setOpen] = useState(response.status === 'streaming')
  const [renderedHtml, setRenderedHtml] = useState('')

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  useEffect(() => {
    if (globalExpand === null || globalExpand === undefined) return
    if (response.status === 'streaming') return
    setOpen(globalExpand)
  }, [globalExpand, response.status])

  useEffect(() => {
    if (response.status === 'streaming') return
    if (!response.response) { setRenderedHtml(''); return }
    let cancelled = false
    renderMarkdown(response.response).then((html) => {
      if (!cancelled) setRenderedHtml(html)
    })
    return () => { cancelled = true }
  }, [response.response, response.status])

  const statusClass =
    response.status === 'streaming'
      ? styles.statusStreaming
      : response.status === 'interrupted'
        ? styles.statusInterrupted
        : response.status === 'error'
          ? styles.statusError
          : styles.statusCompleted

  const empty = response.response.length === 0
  const showError = response.status === 'error' && empty
  const hasBody = !showError && !empty

  return (
    <article
      className={
        response.status === 'streaming'
          ? `${styles.card} ${styles.cardStreaming}`
          : styles.card
      }
      aria-live={response.status === 'streaming' ? 'polite' : undefined}
      data-status={response.status}
      data-exec-index={execIndex}
    >
      <header
        className={`${styles.cardHeader} ${hasBody ? styles.cardHeaderClickable : ''}`}
        onClick={hasBody ? () => setOpen((v) => !v) : undefined}
      >
        {hasBody && (
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true">
            ›
          </span>
        )}
        <span className={styles.cmd}>{response.command}</span>
        {response.query && (
          <span className={styles.query}>{response.query}</span>
        )}
        <span className={`${styles.status} ${statusClass}`}>
          {response.status === 'streaming' && (
            <span className={styles.streamDot} aria-hidden="true" />
          )}
          {STATUS_LABEL[response.status]}
        </span>
        {onDelete && response.status !== 'streaming' && (
          <button
            className={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(response.id)
            }}
            aria-label="apagar resposta"
            type="button"
          >
            ×
          </button>
        )}
      </header>
      {response.model && (
        <div className={styles.modelTag}>{response.model}</div>
      )}
      {showError ? (
        <div className={styles.errorBody}>
          Falha ao obter resposta: {response.response || 'erro desconhecido'}
        </div>
      ) : (
        <div className={`${styles.body} ${response.status !== 'streaming' ? styles.bodyMd : ''} ${!open ? styles.bodyCollapsed : ''}`}>
          {response.status === 'streaming' ? (
            <>
              <span style={{ whiteSpace: 'pre-wrap' }}>{response.response}</span>
              <span className={styles.caretBlink} aria-hidden="true">▍</span>
            </>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          )}
        </div>
      )}
      {response.status === 'interrupted' && open && (
        <div className={styles.interruptedNote}>
          Resposta interrompida antes de terminar.
        </div>
      )}
      {response.sources && response.sources.length > 0 && response.status !== 'streaming' && (
        <SourcesSection sources={response.sources} />
      )}
    </article>
  )
}
