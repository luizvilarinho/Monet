import type { AiResponse } from '../../types'
import styles from './AiPanel.module.css'

export interface AiCardProps {
  response: AiResponse
}

export function AiCard({ response }: AiCardProps) {
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.cmd}>{response.command}</span>
        {response.query && <span className={styles.query}>{response.query}</span>}
      </header>
      <div className={styles.body}>{response.response}</div>
    </article>
  )
}
