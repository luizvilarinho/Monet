import { Archive } from '@phosphor-icons/react'
import styles from './ArchivedBadge.module.css'

// Selo da nota arquivada aberta (R4): discreto, com a ação de desarquivar.
export function ArchivedBadge({ onUnarchive }: { onUnarchive: () => void }) {
  return (
    <span className={styles.badge}>
      <Archive size={12} aria-hidden />
      Archived
      <button type="button" className={styles.action} onClick={onUnarchive}>
        Unarchive
      </button>
    </span>
  )
}
