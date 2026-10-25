import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Check, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { Notebook } from '../../types'
import {
  clipContextStart,
  markLabelKey,
  matchesLabelFilter,
  type MarkLabelFilter,
  type MarkSummary,
  type NoteMarkHit,
} from '../../lib/noteMarks'
import { normalizeSearch } from '../../lib/noteSearch'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import styles from './MarksView.module.css'

interface MarksViewProps {
  // Marcas das notas de caderno não arquivadas, as notas mexidas por último
  // primeiro (collectNoteMarks).
  hits: NoteMarkHit[]
  summary: MarkSummary
  notebooks: Notebook[]
  filter: MarkLabelFilter
  onFilterChange: (filter: MarkLabelFilter) => void
  // Marca aberta no editor (linha ativa).
  selected: { noteId: string; index: number } | null
  onSelect: (hit: NoteMarkHit) => void
  onResolve: (hit: NoteMarkHit) => void
  onClose: () => void
  width: number
  wide?: boolean
  onWidthChange?: (w: number) => void
}

// Lista de revisão das marcas (coluna das notas, como a TasksView): todas as
// marcas de todos os cadernos, agrupadas por nota, com o rótulo e o contexto.
// O clique abre a nota na marca (a lista fica); "Resolve" desfaz a marca
// pela nota aberta no editor (o texto fica).
export function MarksView({
  hits,
  summary,
  notebooks,
  filter,
  onFilterChange,
  selected,
  onSelect,
  onResolve,
  onClose,
  width,
  wide = false,
  onWidthChange,
}: MarksViewProps) {
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const onResizeMouseDown = useSidebarResize(width, onWidthChange, wide)

  // A marca aberta pelo "List"/Ctrl+clique fica à vista.
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected?.noteId, selected?.index, filter])
  const notebookName = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb.name])), [notebooks])

  const visible = useMemo(() => {
    const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
    return hits.filter(({ note, entry }) => {
      if (!matchesLabelFilter(entry, filter)) return false
      if (tokens.length === 0) return true
      const hay = normalizeSearch(`${entry.text} ${entry.label ?? ''} ${entry.before} ${entry.after} ${note.title}`)
      return tokens.every((t) => hay.includes(t))
    })
  }, [hits, filter, query])

  const filterKey = filter === null ? null : filter.label === null ? '' : markLabelKey(filter.label)
  const chip = (key: string | null, label: string, count: number, next: MarkLabelFilter, isLabel = false) => (
    <button
      key={key ?? '\u0000all'}
      type="button"
      className={`${styles.chip} ${isLabel ? styles.chipLabel : ''} ${filterKey === key ? styles.chipActive : ''}`}
      onClick={() => onFilterChange(next)}
    >
      <span className={styles.chipText}>{label}</span>
      <span className={styles.chipCount}>{count}</span>
    </button>
  )

  return (
    <aside className={styles.view} style={{ width }}>
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
      <div className={styles.header}>
        <span>
          Marks <span className={styles.headerCount}>{summary.total}</span>
        </span>
        <button
          type="button"
          className={styles.headerBtn}
          onClick={onClose}
          title="Back to notes"
          aria-label="close marks"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {summary.total > 0 && (
        <>
          <label className={styles.search}>
            <MagnifyingGlass size={13} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter marks"
              aria-label="filter marks"
            />
            {query && (
              <button type="button" className={styles.searchClear} onClick={() => setQuery('')} aria-label="clear filter">
                <X size={11} aria-hidden />
              </button>
            )}
          </label>
          <div className={styles.chips}>
            {chip(null, 'All', summary.total, null)}
            {summary.labels.map((l) => chip(markLabelKey(l.label), l.label, l.count, { label: l.label }, true))}
            {summary.unlabeled > 0 && summary.labels.length > 0 && chip('', 'No label', summary.unlabeled, { label: null })}
          </div>
        </>
      )}

      <div className={styles.list} ref={listRef}>
        {summary.total === 0 ? (
          <div className={styles.empty}>
            <p>Nothing marked yet.</p>
            <p>
              Select a passage in a note and click <strong>Mark</strong> (Ctrl+Shift+M) to keep a point to come
              back to — something to research, review or doubt. Add a label to sort them.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>
            <p>No marks match.</p>
          </div>
        ) : (
          visible.map((hit, i) => {
            const { note, entry } = hit
            const newNote = visible[i - 1]?.note.id !== note.id
            const isSelected = selected?.noteId === note.id && selected.index === entry.index
            return (
              <Fragment key={`${note.id}-${entry.index}`}>
                {newNote && (
                  <div className={styles.group} title={note.title || 'Untitled'}>
                    <span className={styles.groupTitle}>{note.title || 'Untitled'}</span>
                    {note.notebookId && notebookName.has(note.notebookId) && (
                      <span className={styles.groupNotebook}>{notebookName.get(note.notebookId)}</span>
                    )}
                  </div>
                )}
                <div
                  className={`${styles.row} ${isSelected ? styles.rowActive : ''}`}
                  data-selected={isSelected || undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(hit)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelect(hit)
                  }}
                >
                  {/* O trecho no contexto do bloco: o rótulo na frente, o
                      fim do texto anterior e o começo do seguinte. */}
                  <div className={styles.text}>
                    {entry.label && <span className={styles.label}>{entry.label}</span>}
                    {entry.before && <span className={styles.context}>{clipContextStart(entry.before, 32)}</span>}
                    <span className={styles.markText}>{entry.text}</span>
                    {entry.after && <span className={styles.context}>{entry.after}</span>}
                  </div>
                  <button
                    type="button"
                    className={styles.resolve}
                    title="Resolve: remove the mark (keeps the text)"
                    onClick={(e) => {
                      e.stopPropagation()
                      onResolve(hit)
                    }}
                  >
                    <Check size={11} weight="bold" aria-hidden />
                    Resolve
                  </button>
                </div>
              </Fragment>
            )
          })
        )}
      </div>
    </aside>
  )
}
