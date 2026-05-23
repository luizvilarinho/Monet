import { useEffect, useRef, useState } from 'react'
import { storage } from '../../storage'
import type { Note } from '../../types'
import styles from './SearchPalette.module.css'

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  onSelectNote: (notebookId: string, noteId: string) => void
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .slice(0, 80)
}

export function SearchPalette({ open, onClose, onSelectNote }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    } else {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const found = await storage.searchNotes(query)
      setResults(found)
      setSelectedIndex(0)
    }, 150)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const note = results[selectedIndex]
        if (note) {
          onSelectNote(note.notebookId, note.id)
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [open, results, selectedIndex, onClose, onSelectNote])

  if (!open) return null

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Search notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.list}>
          {results.length === 0 && query.trim() && (
            <div className={styles.empty}>No results found</div>
          )}
          {results.map((note, i) => (
            <div
              key={note.id}
              className={`${styles.item} ${i === selectedIndex ? styles.itemActive : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onMouseDown={() => {
                onSelectNote(note.notebookId, note.id)
                onClose()
              }}
            >
              <div className={styles.itemTitle}>{note.title || 'Untitled'}</div>
              {note.content && (
                <div className={styles.itemPreview}>{stripMarkdown(note.content)}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
