import type { AiResponse } from '../../types'
import { AiCard } from './AiCard'
import { AI_MODELS } from './models'
import styles from './AiPanel.module.css'

export interface AiPanelProps {
  open: boolean
  responses: AiResponse[]
  modelId: string
  onModelChange: (id: string) => void
}

export function AiPanel({ open, responses, modelId, onModelChange }: AiPanelProps) {
  if (!open) return null
  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>ia</span>
        <label className={styles.modelWrap}>
          <span className={styles.srOnly}>modelo</span>
          <select
            className={styles.modelSelect}
            value={modelId}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <svg
            className={styles.caret}
            viewBox="0 0 24 24"
            width="10"
            height="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </label>
      </header>
      <div className={styles.content}>
        {responses.length === 0 ? (
          <p className={styles.empty}>Use /comandos no editor para acionar a IA.</p>
        ) : (
          responses.map((r) => <AiCard key={r.id} response={r} />)
        )}
      </div>
    </aside>
  )
}
