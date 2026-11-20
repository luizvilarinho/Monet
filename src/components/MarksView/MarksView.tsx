import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Check, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { Notebook, NoteType } from '../../types'
import {
  clipContextStart,
  markLabelKey,
  matchesLabelFilter,
  summarizeMarks,
  type MarkLabelFilter,
  type MarkSummary,
  type NoteMarkHit,
} from '../../lib/noteMarks'
import { normalizeSearch } from '../../lib/noteSearch'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import { TypeEyebrow } from '../NoteTypes/TypeEyebrow'
import styles from './MarksView.module.css'

export type UndoResolveResult = 'undone' | 'changed' | 'failed'

interface MarksViewProps {
  // Marcas das notas de caderno não arquivadas, as notas mexidas por último
  // primeiro (collectNoteMarks).
  hits: NoteMarkHit[]
  summary: MarkSummary
  notebooks: Notebook[]
  noteTypes: NoteType[]
  filter: MarkLabelFilter
  onFilterChange: (filter: MarkLabelFilter) => void
  // Marca aberta no editor (linha ativa).
  selected: { noteId: string; index: number } | null
  onSelect: (hit: NoteMarkHit) => void
  // `next`: a marca seguinte da lista visível, aberta depois do resolve.
  onResolve: (hit: NoteMarkHit, next: NoteMarkHit | null) => void
  // Desfaz o último Resolve: 'changed' quando a nota mudou desde então,
  // 'failed' quando a gravação falhou.
  onUndoResolve?: () => Promise<UndoResolveResult>
  onClose: () => void
  width: number
  wide?: boolean
  onWidthChange?: (w: number) => void
}

const NOTEBOOK_KEY = 'monet:marks-notebook'
const NOTICE_MS = 6000

function loadNotebookId(): string | null {
  try {
    return localStorage.getItem(NOTEBOOK_KEY) || null
  } catch {
    return null
  }
}

function storeNotebookId(id: string | null) {
  try {
    if (id) localStorage.setItem(NOTEBOOK_KEY, id)
    else localStorage.removeItem(NOTEBOOK_KEY)
  } catch {
    // Sem storage: o recorte vale só nesta sessão.
  }
}

// Lista de revisão das marcas (coluna das notas, como a TasksView): todas as
// marcas de todos os cadernos, agrupadas por nota, com o rótulo e o contexto.
// O select recorta por caderno (lembrado no localStorage, como no board; as
// contagens dos chips seguem o recorte). O clique abre a nota na marca (a
// lista fica); "Resolve" desfaz a marca pela nota aberta no editor (o texto
// fica), abre a marca seguinte e mostra "Mark resolved · Undo" por 6 s.
export function MarksView({
  hits,
  summary,
  notebooks,
  noteTypes,
  filter,
  onFilterChange,
  selected,
  onSelect,
  onResolve,
  onUndoResolve,
  onClose,
  width,
  wide = false,
  onWidthChange,
}: MarksViewProps) {
  const [query, setQuery] = useState('')
  const [savedNotebookId, setSavedNotebookId] = useState(loadNotebookId)
  // Objeto novo a cada Resolve: o prazo de 6 s recomeça.
  const [notice, setNotice] = useState<{ kind: 'resolved' | 'undoChanged' | 'undoFailed' } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const onResizeMouseDown = useSidebarResize(width, onWidthChange, wide)

  // A marca aberta pelo "List"/Ctrl+clique fica à vista.
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected?.noteId, selected?.index, filter])
  const notebookName = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb.name])), [notebooks])
  const typeById = useMemo(() => new Map(noteTypes.map((t) => [t.id, t])), [noteTypes])

  // Cadernos com marcas, na ordem da coluna; caderno salvo que não tem mais
  // marcas (ou não existe) é ignorado, sem reescrever o storage.
  const notebookOptions = useMemo(
    () => notebooks.filter((nb) => hits.some((h) => h.note.notebookId === nb.id)),
    [notebooks, hits]
  )
  const notebookId = notebookOptions.some((nb) => nb.id === savedNotebookId) ? savedNotebookId : null
  const scoped = useMemo(
    () => (notebookId ? hits.filter((h) => h.note.notebookId === notebookId) : hits),
    [hits, notebookId]
  )
  const scopedSummary = useMemo(
    () => (notebookId ? summarizeMarks(scoped.map((h) => h.entry)) : summary),
    [notebookId, scoped, summary]
  )

  function selectNotebook(id: string | null) {
    setSavedNotebookId(id)
    storeNotebookId(id)
  }

  // A linha "Mark resolved · Undo" some sozinha.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(t)
  }, [notice])

  const visible = useMemo(() => {
    const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
    return scoped.filter(({ note, entry }) => {
      if (!matchesLabelFilter(entry, filter)) return false
      if (tokens.length === 0) return true
      const hay = normalizeSearch(`${entry.text} ${entry.label ?? ''} ${entry.before} ${entry.after} ${note.title}`)
      return tokens.every((t) => hay.includes(t))
    })
  }, [scoped, filter, query])

  function resolve(i: number) {
    onResolve(visible[i], visible[i + 1] ?? null)
    if (onUndoResolve) setNotice({ kind: 'resolved' })
  }

  async function undo() {
    if (!onUndoResolve) return
    const result = await onUndoResolve()
    setNotice(result === 'undone' ? null : { kind: result === 'changed' ? 'undoChanged' : 'undoFailed' })
  }

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
          {notebookOptions.length > 1 && (
            <select
              className={styles.notebookSelect}
              value={notebookId ?? ''}
              onChange={(e) => selectNotebook(e.target.value || null)}
              aria-label="Notebook"
              title="Show the marks of one notebook"
            >
              <option value="">All notebooks</option>
              {notebookOptions.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.name || 'unnamed'}
                </option>
              ))}
            </select>
          )}
          <div className={styles.chips}>
            {chip(null, 'All', scopedSummary.total, null)}
            {scopedSummary.labels.map((l) => chip(markLabelKey(l.label), l.label, l.count, { label: l.label }, true))}
            {scopedSummary.unlabeled > 0 &&
              scopedSummary.labels.length > 0 &&
              chip('', 'No label', scopedSummary.unlabeled, { label: null })}
          </div>
        </>
      )}

      <div className={styles.notice} role="status">
        {notice?.kind === 'resolved' && (
          <>
            Mark resolved ·{' '}
            <button type="button" className={styles.noticeBtn} onClick={() => void undo()}>
              Undo
            </button>
          </>
        )}
        {notice?.kind === 'undoChanged' && "Couldn't undo: the note changed since the mark was resolved."}
        {notice?.kind === 'undoFailed' && "Couldn't undo: the note could not be saved."}
      </div>

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
            const type = newNote && note.typeId ? typeById.get(note.typeId) : undefined
            return (
              <Fragment key={`${note.id}-${entry.index}`}>
                {newNote && (
                  <div className={styles.group} title={note.title || 'Untitled'}>
                    {type && <TypeEyebrow type={type} />}
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
                      resolve(i)
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
