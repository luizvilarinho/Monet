import { useEffect, useState } from 'react'
import type { AiResponse } from '../../types'
import { renderMarkdown } from '../../lib/markdown'
import styles from './AiPanel.module.css'

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
    </article>
  )
}
