import { useEffect, useState } from 'react'
import { clipContextStart, type NoteMarkHit } from '../../lib/noteMarks'
import type { Notebook } from '../../types'
import styles from './SearchPalette.module.css'

interface MarkNotePickerProps {
  open: boolean
  // Texto da marca citada no chat (`==texto==` sem os delimitadores).
  text: string
  // Marcas candidatas, uma por nota.
  hits: NoteMarkHit[]
  notebooks: Notebook[]
  onClose: () => void
  onSelect: (hit: NoteMarkHit) => void
}

// Seletor do clique num `==texto==` do chat (R11): a mesma marca em mais de
// uma nota abre este modal — uma linha por nota, no padrão visual do
// SearchPalette. Sem nenhuma, avisa que a marca não existe mais (resolvida ou
// editada). Navegável por teclado (↑↓ Enter) e fechável com Esc.
export function MarkNotePicker({
  open,
  text,
  hits,
  notebooks,
  onClose,
  onSelect,
}: MarkNotePickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (open) setSelectedIndex(0)
  }, [open, text])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const hit = hits[selectedIndex]
        if (hit) onSelect(hit)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, hits, selectedIndex, onClose, onSelect])

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.chips}>
          <mark className={styles.markText}>{text}</mark>
        </div>
        {hits.length === 0 ? (
          <div className={styles.empty}>This mark no longer exists — it may have been resolved or edited.</div>
        ) : (
          <div className={styles.list}>
            {hits.map(({ note, entry }, i) => {
              const notebook = notebooks.find((nb) => nb.id === note.notebookId)
              return (
                <button
                  key={note.id}
                  type="button"
                  className={`${styles.item} ${styles.pickItem} ${i === selectedIndex ? styles.itemActive : ''}`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(hits[i])}
                >
                  {notebook && <div className={styles.itemNotebook}>{notebook.name}</div>}
                  <div className={styles.itemTitleRow}>
                    <div className={styles.itemTitle}>{note.title || 'Untitled'}</div>
                    {entry.label && <span className={styles.markLabel}>{entry.label}</span>}
                    {note.archivedAt && <span className={styles.itemLabel}>archived</span>}
                    <span className={styles.itemMeta}>{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {(entry.before || entry.after) && (
                    <div className={styles.markPreview}>
                      {clipContextStart(entry.before)}
                      <mark className={styles.markText}>{entry.text}</mark>
                      {entry.after}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
