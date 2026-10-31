import {
  Article,
  CircleNotch,
  ClipboardText,
  Clock,
  FileAudio,
  Globe,
  Microphone,
  Plus,
  YoutubeLogo,
  type Icon,
} from '@phosphor-icons/react'
import type { MincerItemSummary, MincerKind } from '../../lib/mincer'
import shared from './Mincer.module.css'
import styles from './MincerHistory.module.css'

const KIND_ICONS: Record<MincerKind, Icon> = {
  file: FileAudio,
  paste: ClipboardText,
  record: Microphone,
  youtube: YoutubeLogo,
  web_summary: Globe,
  web_capture: Article,
}

interface MincerHistoryProps {
  items: MincerItemSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

function StatusBadge({ item }: { item: MincerItemSummary }) {
  switch (item.status) {
    case 'running':
      return <CircleNotch size={14} className={`${styles.statusIcon} ${shared.spin}`} aria-label="Processing" />
    case 'queued':
      return (
        <span className={styles.statusMuted}>
          <Clock size={12} aria-hidden="true" />
          Queued
        </span>
      )
    case 'error':
      return <span className={styles.statusError}>Error</span>
    case 'done':
      return item.unseen ? <span className={styles.statusNew}>New</span> : null
    case 'cancelled':
      return <span className={styles.statusMuted}>Cancelled</span>
    case 'interrupted':
      return <span className={styles.statusMuted}>Interrupted</span>
    default:
      return null
  }
}

export function MincerHistory({ items, selectedId, onSelect, onNew }: MincerHistoryProps) {
  return (
    <aside className={styles.history} aria-label="Mincer history">
      <div className={styles.top}>
        <button type="button" className={shared.secondary} onClick={onNew}>
          <Plus size={14} aria-hidden="true" />
          New
        </button>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>Nothing processed yet.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const KindIcon = KIND_ICONS[item.kind] ?? FileAudio
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === selectedId ? styles.rowActive : styles.row}
                  onClick={() => onSelect(item.id)}
                  aria-current={item.id === selectedId}
                >
                  <KindIcon size={16} className={styles.kindIcon} aria-hidden="true" />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{item.title || 'Untitled'}</span>
                    <span className={styles.rowMeta}>
                      {new Date(item.createdAt).toLocaleDateString()}
                      {item.sentToNotebookAt !== null && ' · Sent to notebook'}
                    </span>
                  </span>
                  <StatusBadge item={item} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
