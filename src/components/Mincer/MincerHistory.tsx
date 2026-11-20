import { useEffect, useState } from 'react'
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
import { formatElapsed, type MincerItemSummary, type MincerKind } from '../../lib/mincer'
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
  // Gravação em curso (início em ms), ou null: linha fixa no topo.
  recordingStartedAt: number | null
  onOpenRecording: () => void
}

type Group = 'Today' | 'Yesterday' | 'Earlier'

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dayGroup(createdAt: number, today: number): Group {
  if (createdAt >= today) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  return createdAt >= yesterday.getTime() ? 'Yesterday' : 'Earlier'
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// O relógio re-renderiza só esta linha, não o histórico.
function RecordingRow({ startedAt, onOpen }: { startedAt: number; onOpen: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <button type="button" className={styles.recordingRow} onClick={onOpen} title="Open the recording (Record tab)">
      <span className={styles.recordDot} aria-hidden="true" />
      <span className={styles.rowTitle}>Recording · {formatElapsed(now - startedAt)}</span>
    </button>
  )
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
      return (
        <span className={styles.statusAttention} title="Needs attention: it did not finish. Open it to resume.">
          Resume?
        </span>
      )
    default:
      return null
  }
}

export function MincerHistory({
  items,
  selectedId,
  onSelect,
  onNew,
  recordingStartedAt,
  onOpenRecording,
}: MincerHistoryProps) {
  const today = startOfDay(Date.now())
  const groups: Array<{ label: Group; items: MincerItemSummary[] }> = []
  for (const item of items) {
    const label = dayGroup(item.createdAt, today)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }

  return (
    <aside className={styles.history} aria-label="Mincer history">
      <div className={styles.top}>
        <button type="button" className={shared.secondary} onClick={onNew}>
          <Plus size={14} aria-hidden="true" />
          New
        </button>
      </div>
      {recordingStartedAt !== null && (
        <div className={styles.recordingSlot}>
          <RecordingRow startedAt={recordingStartedAt} onOpen={onOpenRecording} />
        </div>
      )}
      {items.length === 0 ? (
        <p className={styles.empty}>Nothing processed yet.</p>
      ) : (
        <div className={styles.list}>
          {groups.map((group) => (
            <section key={group.label} className={styles.group} aria-label={group.label}>
              <h3 className={styles.groupLabel}>{group.label}</h3>
              <ul className={styles.groupList}>
                {group.items.map((item) => {
                  const KindIcon = KIND_ICONS[item.kind] ?? FileAudio
                  const when =
                    group.label === 'Earlier'
                      ? `${new Date(item.createdAt).toLocaleDateString()} ${timeLabel(item.createdAt)}`
                      : timeLabel(item.createdAt)
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
                            {when}
                            {item.sentToNotebookAt !== null && ' · Sent to notebook'}
                          </span>
                        </span>
                        <StatusBadge item={item} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  )
}
