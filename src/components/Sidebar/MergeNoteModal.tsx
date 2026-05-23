import { useEffect, useState } from 'react'
import type { Note } from '../../types'
import styles from './MergeNoteModal.module.css'

interface MergeNoteModalProps {
  sourceNote: Note
  notes: Note[]
  onMerge: (targetId: string) => void
  onClose: () => void
}

export function MergeNoteModal({ sourceNote, notes, onMerge, onClose }: MergeNoteModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleMerge() {
    if (!selectedId) return
    onMerge(selectedId)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>
          Merge &ldquo;{sourceNote.title || 'untitled'}&rdquo; into:
        </div>
        <ul className={styles.list}>
          {notes.map((note) => (
            <li
              key={note.id}
              className={`${styles.item} ${selectedId === note.id ? styles.itemSelected : ''}`}
              onClick={() => setSelectedId(note.id)}
            >
              {note.title || 'untitled'}
            </li>
          ))}
        </ul>
        <div className={styles.footer}>
          <button className={styles.btnCancel} type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.btnMerge}
            type="button"
            disabled={!selectedId}
            onClick={handleMerge}
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  )
}
