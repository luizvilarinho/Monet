import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { Note, Notebook, NoteType } from '../../types'
import { CALENDAR_NOTEBOOK_ID } from '../../lib/calendar'
import { normalizeSearch, notePreview } from '../../lib/noteSearch'
import { hasTag, tagKey, type TagCount } from '../../lib/noteTags'
import { isTaskBodyNote } from '../../lib/tasks'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import styles from './TagView.module.css'

interface TagViewProps {
  // Todas as notas (a tag atravessa os cadernos).
  notes: Note[]
  // Na ordem da coluna de cadernos: a ordem dos grupos.
  notebooks: Notebook[]
  noteTypes: NoteType[]
  // Tags existentes, em ordem alfabética (chips para trocar de tag).
  tags: TagCount[]
  tag: string
  onSelectTag: (tag: string) => void
  // Nota aberta no editor (linha ativa).
  activeNoteId: string | null
  onOpenNote: (note: Note) => void
  onClose: () => void
  width: number
  wide?: boolean
  onWidthChange?: (w: number) => void
}

interface NotebookGroup {
  notebookId: string
  name: string
  notes: Note[]
}

// Rótulo à direita do título, como no Ctrl+P.
function noteLabel(note: Note): string | null {
  if (note.archivedAt) return 'archived'
  if (note.notebookId === CALENDAR_NOTEBOOK_ID) return 'Daily'
  if (isTaskBodyNote(note)) return 'Task'
  return null
}

// Notas com a tag, de todos os cadernos (coluna das notas, como a lista de
// marcas): agrupadas por caderno na ordem da coluna de cadernos, as mexidas por
// último primeiro em cada grupo. O clique abre a nota e a lista fica; as
// outras tags da nota trocam a lista para elas. Arquivadas só pelo rodapé.
export function TagView({
  notes,
  notebooks,
  noteTypes,
  tags,
  tag,
  onSelectTag,
  activeNoteId,
  onOpenNote,
  onClose,
  width,
  wide = false,
  onWidthChange,
}: TagViewProps) {
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const onResizeMouseDown = useSidebarResize(width, onWidthChange, wide)
  const typeById = useMemo(() => new Map(noteTypes.map((t) => [t.id, t])), [noteTypes])
  const currentKey = tagKey(tag)

  // Outra tag: sem o filtro de texto da anterior, arquivadas fechadas.
  useEffect(() => {
    setQuery('')
    setShowArchived(false)
  }, [currentKey])

  const tagged = useMemo(() => notes.filter((n) => n.notebookId && hasTag(n, tag)), [notes, tag])
  const archivedCount = useMemo(() => tagged.filter((n) => n.archivedAt).length, [tagged])

  const groups = useMemo(() => {
    const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
    const matches = tagged.filter((n) => {
      if (n.archivedAt && !showArchived) return false
      if (tokens.length === 0) return true
      const hay = normalizeSearch(`${n.title} ${n.tags.join(' ')} ${notePreview(n)}`)
      return tokens.every((t) => hay.includes(t))
    })
    const order = new Map(notebooks.map((nb, i) => [nb.id, i]))
    const byNotebook = new Map<string, NotebookGroup>()
    for (const note of matches) {
      const id = note.notebookId as string
      const group = byNotebook.get(id) ?? {
        notebookId: id,
        name: notebooks.find((nb) => nb.id === id)?.name ?? 'Untitled',
        notes: [],
      }
      group.notes.push(note)
      byNotebook.set(id, group)
    }
    const list = Array.from(byNotebook.values())
    for (const g of list) {
      // Arquivadas no fim do grupo.
      g.notes.sort((a, b) => Number(!!a.archivedAt) - Number(!!b.archivedAt) || b.updatedAt - a.updatedAt)
    }
    return list.sort((a, b) => (order.get(a.notebookId) ?? Infinity) - (order.get(b.notebookId) ?? Infinity))
  }, [tagged, query, showArchived, notebooks])

  const shown = groups.reduce((n, g) => n + g.notes.length, 0)

  // A nota aberta fica à vista ao trocar de tag.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [currentKey])

  return (
    <aside className={styles.view} style={{ width }}>
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
      <div className={styles.header}>
        <span>Tags</span>
        <button type="button" className={styles.headerBtn} onClick={onClose} title="Back to notes" aria-label="close tags">
          <X size={14} aria-hidden />
        </button>
      </div>

      <label className={styles.search}>
        <MagnifyingGlass size={13} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter #${tag}`}
          aria-label="filter tagged notes"
        />
        {query && (
          <button type="button" className={styles.searchClear} onClick={() => setQuery('')} aria-label="clear filter">
            <X size={11} aria-hidden />
          </button>
        )}
      </label>

      <div className={styles.chips}>
        {tags.map((t) => {
          const active = tagKey(t.tag) === currentKey
          return (
            <button
              key={tagKey(t.tag)}
              type="button"
              className={`${styles.chip} ${active ? styles.chipActive : ''}`}
              onClick={() => onSelectTag(t.tag)}
              title={`Notes tagged #${t.tag}`}
            >
              <span className={styles.chipText}>#{t.tag}</span>
              <span className={styles.chipCount}>{t.count}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.list} ref={listRef}>
        {tagged.length === 0 ? (
          <div className={styles.empty}>No note is tagged #{tag} anymore.</div>
        ) : shown === 0 ? (
          <div className={styles.empty}>
            {query ? 'No notes match.' : `Only archived notes are tagged #${tag}.`}
          </div>
        ) : (
          groups.map((g) => (
            <Fragment key={g.notebookId}>
              <div className={styles.group}>
                <span className={styles.groupName}>{g.name}</span>
                <span className={styles.groupCount}>{g.notes.length}</span>
              </div>
              {g.notes.map((note) => {
                const type = note.typeId ? typeById.get(note.typeId) : undefined
                const label = noteLabel(note)
                const preview = notePreview(note)
                const otherTags = note.tags.filter((t) => tagKey(t) !== currentKey)
                const active = note.id === activeNoteId
                return (
                  <div
                    key={note.id}
                    className={`${styles.row} ${active ? styles.rowActive : ''} ${note.archivedAt ? styles.rowArchived : ''}`}
                    data-active={active || undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenNote(note)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onOpenNote(note)
                    }}
                  >
                    {type && (
                      <span className={styles.eyebrow} style={{ color: type.color ?? undefined }} title={type.name}>
                        <TypeIcon name={type.icon} size={11} />
                        <span className={styles.eyebrowName}>{type.name}</span>
                      </span>
                    )}
                    <div className={styles.titleRow}>
                      <span className={styles.title}>{note.title.trim() || 'Untitled'}</span>
                      {label && <span className={styles.label}>{label}</span>}
                    </div>
                    {preview && <div className={styles.preview}>{preview}</div>}
                    {otherTags.length > 0 && (
                      <div className={styles.tags}>
                        {otherTags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={styles.tag}
                            title={`Show #${t}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectTag(t)
                            }}
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </Fragment>
          ))
        )}
      </div>

      {archivedCount > 0 && (
        <button
          type="button"
          className={`${styles.archivedFooter} ${showArchived ? styles.archivedOn : ''}`}
          onClick={() => setShowArchived((v) => !v)}
          title={showArchived ? 'Hide archived notes' : 'Show archived notes'}
        >
          <Archive size={12} aria-hidden />
          Archived · {archivedCount}
        </button>
      )}
    </aside>
  )
}
