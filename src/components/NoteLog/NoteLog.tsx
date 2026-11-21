import { useMemo, useState, type KeyboardEvent } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import { formatMetadataValue, hasMetadataValue } from '../../lib/metadata'
import {
  LOG_PERIODS,
  logEntries,
  logNotes,
  logPeriodRange,
  logTotalsLabel,
  sessionsLabel,
  summarizeLog,
  type LogPeriod,
  type LogTrend,
  type ResolvedLog,
} from '../../lib/noteLog'
import { formatDueShort } from '../../lib/tasks'
import type { MetadataDef, Note, Notebook, NoteType } from '../../types'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import { Sparkline } from './Sparkline'
import styles from './NoteLog.module.css'

interface NoteLogProps {
  type: NoteType
  resolved: ResolvedLog
  // Propriedades do tipo, na ordem do tipo.
  typeDefs: MetadataDef[]
  // Todas as notas (o Log atravessa os cadernos).
  notes: Note[]
  notebooks: Notebook[]
  todayKey: string
  // Nota aberta no editor (linha ativa).
  activeNoteId: string | null
  onOpenNote: (note: Note) => void
  // Abre o modal de tipos no tipo.
  onOpenSettings: () => void
  // "New session": nota do tipo com a data de hoje, aberta no editor.
  onNewSession: () => void
  onClose: () => void
  width: number
  wide?: boolean
  onWidthChange?: (w: number) => void
}

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

// "Nov 20"; com o ano quando difere do de hoje.
function dayLabel(day: string, todayKey: string): string {
  const year = day.slice(0, 4)
  return year === todayKey.slice(0, 4) ? formatDueShort(day) : `${formatDueShort(day)}, ${year}`
}

// Com um ponto só, o valor; com mais, do primeiro ao último.
function trendText(trend: LogTrend): string {
  return trend.points.length > 1 ? `${fmt(trend.first)} → ${fmt(trend.last)}` : fmt(trend.last)
}

// Propriedades com valor, na ordem do tipo. Checkbox: só o nome quando marcado.
function rowProperties(note: Note, defs: MetadataDef[]): Array<{ id: string; name: string; text: string | null }> {
  const out: Array<{ id: string; name: string; text: string | null }> = []
  for (const def of defs) {
    const value = note.properties?.[def.id]
    if (value === undefined || !hasMetadataValue(value)) continue
    if (def.type === 'checkbox') {
      if (value === true) out.push({ id: def.id, name: def.name, text: null })
      continue
    }
    const text = formatMetadataValue(def, value)
    if (text) out.push({ id: def.id, name: def.name, text })
  }
  return out
}

// Log de um tipo de nota (coluna das notas, como a lista de uma tag): as notas
// do tipo de todos os cadernos como sessões no período, com os totais, os
// grupos e a lista. O clique numa linha abre a nota e a lista fica.
export function NoteLog({
  type,
  resolved,
  typeDefs,
  notes,
  notebooks,
  todayKey,
  activeNoteId,
  onOpenNote,
  onOpenSettings,
  onNewSession,
  onClose,
  width,
  wide = false,
  onWidthChange,
}: NoteLogProps) {
  const [period, setPeriod] = useState<LogPeriod>('month')
  const onResizeMouseDown = useSidebarResize(width, onWidthChange, wide)
  const notebookName = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb.name])), [notebooks])

  const totalNotes = useMemo(() => logNotes(notes, type.id).length, [notes, type.id])
  const { from, to } = logPeriodRange(period, todayKey)
  const entries = useMemo(() => logEntries(notes, type.id, from, to), [notes, type.id, from, to])
  const summary = useMemo(() => summarizeLog(entries, resolved), [entries, resolved])

  const color = type.color ?? 'var(--accent)'
  const sumName = resolved.sum?.name ?? ''
  const trendName = resolved.trend?.name ?? ''

  function openOnKey(note: Note) {
    return (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      onOpenNote(note)
    }
  }

  return (
    <aside className={styles.view} style={{ width }}>
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
      <div className={styles.header}>
        <span className={styles.headerTitle} title={`${type.name} · Log`}>
          <span className={styles.headerIcon} style={{ color: type.color ?? undefined }}>
            <TypeIcon name={type.icon} size={14} />
          </span>
          <span className={styles.headerName}>{type.name}</span>
          <span className={styles.headerSuffix}>· Log</span>
        </span>
        <button type="button" className={styles.headerText} onClick={onOpenSettings} title="Log settings in Note types">
          Settings
        </button>
        <button type="button" className={styles.headerBtn} onClick={onClose} title="Back to notes" aria-label="close log">
          <X size={14} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        className={styles.newSession}
        onClick={onNewSession}
        title={`New ${type.name} note dated today, opened in the editor`}
      >
        <Plus size={12} aria-hidden />
        New session
      </button>

      <div className={styles.periods} role="group" aria-label="log period">
        {LOG_PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.period} ${p.id === period ? styles.periodActive : ''}`}
            aria-pressed={p.id === period}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={styles.scroll}>
        {totalNotes > 0 && (
          <div className={styles.totals}>
            <div className={styles.totalsLine}>
              <span className={styles.totalsMain}>{logTotalsLabel(summary.sessions, summary.days)}</span>
              {summary.sum !== null && (
                <span>
                  {' · '}
                  {fmt(summary.sum)} {sumName}
                </span>
              )}
            </div>
            {summary.trend && !resolved.group && (
              <div className={styles.trendLine}>
                <span>
                  {trendName}: {trendText(summary.trend)}
                </span>
                <Sparkline points={summary.trend.points} color={color} />
              </div>
            )}
          </div>
        )}

        {resolved.group && summary.groups.length > 0 && (
          <>
            <div className={styles.sectionLabel}>By {resolved.group.name}</div>
            {summary.groups.map((g) => (
              <div key={g.key} className={styles.groupRow}>
                <div className={styles.groupTop}>
                  <span className={styles.groupLabel} title={g.label}>
                    {g.label}
                  </span>
                  <span className={styles.groupMeta}>{sessionsLabel(g.sessions)}</span>
                </div>
                {(g.sum !== null || g.trend) && (
                  <div className={styles.groupDetail}>
                    {g.sum !== null && (
                      <span>
                        {fmt(g.sum)} {sumName}
                      </span>
                    )}
                    {g.trend && (
                      <span className={styles.trendLine}>
                        <span>
                          {trendName} {trendText(g.trend)}
                        </span>
                        <Sparkline points={g.trend.points} color={color} />
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {totalNotes === 0 ? (
          <div className={styles.empty}>
            No {type.name} notes yet. Notes count by their date, or by the day they were created.
          </div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>No {type.name} notes in this period.</div>
        ) : (
          <>
            <div className={styles.sectionLabel}>Notes</div>
            {entries.map(({ note, day }) => {
              const active = note.id === activeNoteId
              const properties = rowProperties(note, typeDefs)
              const notebook = note.notebookId ? notebookName.get(note.notebookId) : undefined
              return (
                <div
                  key={note.id}
                  className={`${styles.row} ${active ? styles.rowActive : ''}`}
                  data-active={active || undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenNote(note)}
                  onKeyDown={openOnKey(note)}
                >
                  <div className={styles.rowTop}>
                    <span className={styles.day}>{dayLabel(day, todayKey)}</span>
                    <span className={styles.title}>{note.title.trim() || 'Untitled'}</span>
                  </div>
                  {(notebook || properties.length > 0) && (
                    <div className={styles.rowMeta}>
                      {notebook && <span className={styles.notebook}>{notebook}</span>}
                      {properties.map((p) => (
                        <span key={p.id} className={styles.prop}>
                          <span className={styles.propName}>{p.name}</span>
                          {p.text !== null && ` ${p.text}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </aside>
  )
}
