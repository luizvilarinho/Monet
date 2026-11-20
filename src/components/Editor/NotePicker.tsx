import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Note, Notebook } from '../../types'
import { normalizeName } from '../../lib/tasks'
import { useAnchoredPosition, type PopoverAnchor } from './anchoredPosition'
import styles from './NotePicker.module.css'

interface NotePickerProps {
  notes: Note[]
  // Nome do caderno ao lado do título.
  notebooks?: Notebook[]
  // Notas deste caderno vêm primeiro; dentro de cada parte, as mais recentes.
  currentNotebookId?: string | null
  onSelect: (note: Note) => void
  // Esc ou clique fora.
  onClose: () => void
  anchor: PopoverAnchor
}

const MAX_RESULTS = 50
const NO_NOTEBOOKS: Notebook[] = []

// Seletor de nota do `[[` e do "Link note" do menu Insert: busca sem caixa e
// sem acento em todos os cadernos, ↑↓ e Enter.
export function NotePicker({
  notes,
  notebooks = NO_NOTEBOOKS,
  currentNotebookId,
  onSelect,
  onClose,
  anchor,
}: NotePickerProps) {
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pos = useAnchoredPosition(ref, anchor)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const notebookNames = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb.name])), [notebooks])

  const results = useMemo(() => {
    const q = normalizeName(filter.trim())
    const rank = (n: Note) => (n.notebookId === currentNotebookId ? 0 : 1)
    return notes
      .filter((n) => !n.archivedAt && (!q || normalizeName(n.title || 'Untitled').includes(q)))
      .sort((a, b) => rank(a) - rank(b) || b.updatedAt - a.updatedAt)
      .slice(0, MAX_RESULTS)
  }, [notes, filter, currentNotebookId])

  useEffect(() => setActive(0), [filter])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-idx="${active}"]`)
    if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' })
  }, [active])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current()
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [])

  function pick(note: Note | undefined) {
    if (note) onSelect(note)
  }

  return createPortal(
    <div
      ref={ref}
      data-note-picker
      className={styles.dropdown}
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label="Link note"
    >
      <input
        ref={inputRef}
        className={styles.input}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (results.length) setActive((i) => (i + 1) % results.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (results.length) setActive((i) => (i - 1 + results.length) % results.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(results[active])
          } else if (e.key === 'Escape') {
            // Já tratado para quem escuta no document (modal da task).
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }
        }}
        placeholder="Search notes in every notebook"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-autocomplete="list"
      />
      <div ref={listRef} className={styles.list} role="listbox">
        {results.length === 0 ? (
          <div className={styles.empty}>No notes found</div>
        ) : (
          results.map((note, idx) => {
            const notebookName = note.notebookId ? notebookNames.get(note.notebookId) : undefined
            return (
              <div
                key={note.id}
                data-idx={idx}
                role="option"
                aria-selected={idx === active}
                className={`${styles.item} ${idx === active ? styles.active : ''}`}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(note)
                }}
              >
                <span className={styles.itemTitle}>{note.title || 'Untitled'}</span>
                {notebookName && <span className={styles.notebook}>{notebookName}</span>}
              </div>
            )
          })
        )}
      </div>
    </div>,
    document.body
  )
}
