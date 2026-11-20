import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeSearch } from '../../lib/noteSearch'
import type { Note } from '../../types'
import styles from './MergeNoteModal.module.css'

interface MergeNoteModalProps {
  sourceNote: Note
  notes: Note[]
  onMerge: (targetId: string) => void
  onClose: () => void
}

// Escolha da nota de destino com busca (foco ao abrir), ↑↓, Enter e duplo
// clique. O texto diz o que acontece com a origem.
export function MergeNoteModal({ sourceNote, notes, onMerge, onClose }: MergeNoteModalProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const sourceTitle = sourceNote.title || 'untitled'

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const shown = useMemo(() => {
    const q = normalizeSearch(query.trim())
    return q ? notes.filter((n) => normalizeSearch(n.title).includes(q)) : notes
  }, [notes, query])

  // Fusão apaga a origem: nada vem escolhido. Vale o item clicado ou navegado
  // com as setas, ou o único resultado da busca digitada.
  const onlyMatch = query.trim() && shown.length === 1 ? shown[0].id : null
  const activeId = shown.some((n) => n.id === selectedId) ? selectedId : onlyMatch

  useEffect(() => {
    if (!activeId) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  function move(delta: number) {
    if (shown.length === 0) return
    const i = shown.findIndex((n) => n.id === activeId)
    const next = Math.min(shown.length - 1, Math.max(0, i + delta))
    setSelectedId(shown[next].id)
  }

  function handleMerge(id: string | null = activeId) {
    if (!id) return
    onMerge(id)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label={`Merge “${sourceTitle}”`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>
          Merge &ldquo;{sourceTitle}&rdquo; into:
        </div>
        <p className={styles.description}>
          &ldquo;{sourceTitle}&rdquo; is added to the end of the note you pick, under a heading with its title,
          and its tags join that note. Then &ldquo;{sourceTitle}&rdquo; is deleted.
        </p>
        <input
          className={styles.search}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              move(1)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              move(-1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              handleMerge()
            }
          }}
          placeholder="Search notes…"
          aria-label="Search notes"
          role="combobox"
          aria-expanded
          aria-controls="merge-note-list"
          aria-activedescendant={activeId ? `merge-note-${activeId}` : undefined}
        />
        <ul className={styles.list} ref={listRef} role="listbox" id="merge-note-list" aria-label="Notes">
          {shown.length === 0 ? (
            <li className={styles.empty}>No note matches “{query.trim()}”</li>
          ) : (
            shown.map((note) => (
              <li
                key={note.id}
                id={`merge-note-${note.id}`}
                data-id={note.id}
                role="option"
                aria-selected={activeId === note.id}
                className={`${styles.item} ${activeId === note.id ? styles.itemSelected : ''}`}
                onClick={() => setSelectedId(note.id)}
                onDoubleClick={() => handleMerge(note.id)}
              >
                {note.title || 'untitled'}
              </li>
            ))
          )}
        </ul>
        <div className={styles.footer}>
          <button className={styles.btnCancel} type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.btnMerge}
            type="button"
            disabled={!activeId}
            onClick={() => handleMerge()}
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  )
}
