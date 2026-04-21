import type { AiResponse } from '../../types'
import { AiCard } from './AiCard'
import styles from './AiPanel.module.css'

export interface AiPanelProps {
  open: boolean
  responses: AiResponse[]
}

export function AiPanel({ open, responses }: AiPanelProps) {
  if (!open) return null
  return (
    <aside className={styles.panel}>
      {responses.length === 0 ? (
        <p className={styles.empty}>Use /comandos no editor para acionar a IA.</p>
      ) : (
        responses.map((r) => <AiCard key={r.id} response={r} />)
      )}
    </aside>
  )
}
