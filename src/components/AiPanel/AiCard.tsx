import { useState } from 'react'
import type { AiResponse } from '../../types'
import styles from './AiPanel.module.css'

export interface AiCardProps {
  response: AiResponse
}

const STATUS_LABEL: Record<AiResponse['status'], string> = {
  streaming: 'respondendo...',
  completed: 'concluído',
  interrupted: 'interrompido',
  error: 'erro',
}

export function AiCard({ response }: AiCardProps) {
  const [open, setOpen] = useState(response.status === 'streaming')

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
      </header>
      {response.model && (
        <div className={styles.modelTag}>{response.model}</div>
      )}
      {showError ? (
        <div className={styles.errorBody}>
          Falha ao obter resposta: {response.response || 'erro desconhecido'}
        </div>
      ) : (
        <div className={`${styles.body} ${!open ? styles.bodyCollapsed : ''}`}>
          {response.response}
          {response.status === 'streaming' && (
            <span className={styles.caretBlink} aria-hidden="true">
              ▍
            </span>
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
