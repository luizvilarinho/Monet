import { useEffect, useRef, useState } from 'react'
import type { Note } from '../../types'
import styles from './NotePicker.module.css'

interface NotePickerProps {
  notes: Note[]
  onSelect: (note: Note) => void
  onClose: () => void
  position?: { top: number; left: number }
}

export function NotePicker({ notes, onSelect, onClose, position }: NotePickerProps) {
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(filter.toLowerCase())
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!position) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const el = document.querySelector('[data-note-picker]')
      if (el && !el.contains(target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [position, onClose])

  if (position) {
    return (
      <div
        data-note-picker
        className={styles.dropdown}
        style={{ top: position.top, left: position.left }}
      >
        <input
          ref={inputRef}
          className={styles.input}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search notes..."
        />
        {filtered.length === 0 ? (
          <div className={styles.empty}>No notes found</div>
        ) : (
          filtered.map((note) => (
            <div
              key={note.id}
              className={styles.item}
              onMouseDown={() => {
                onSelect(note)
                onClose()
              }}
            >
              {note.title || 'Untitled'}
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        data-note-picker
        className={styles.panel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className={styles.input}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search notes..."
        />
        {filtered.length === 0 ? (
          <div className={styles.empty}>No notes found</div>
        ) : (
          filtered.map((note) => (
            <div
              key={note.id}
              className={styles.item}
              onMouseDown={() => {
                onSelect(note)
                onClose()
              }}
            >
              {note.title || 'Untitled'}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
