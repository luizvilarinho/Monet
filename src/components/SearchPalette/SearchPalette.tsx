import { useCallback, useEffect, useRef, useState } from 'react'
import { storage } from '../../storage'
import type { Note, Notebook } from '../../types'
import styles from './SearchPalette.module.css'

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  onSelectNote: (notebookId: string, noteId: string, subjectId?: string | null) => void
  onSelectNotebook?: (notebookId: string) => void
  notebooks?: Notebook[]
}

type SearchResult =
  | { kind: 'notebook'; notebook: Notebook }
  | { kind: 'note'; note: Note }

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .slice(0, 80)
}

function sortResults(notes: Note[], query: string, notebookMap: Map<string, string>): Note[] {
  const q = query.trim().toLowerCase()
  return [...notes].sort((a, b) => {
    const aNb = (notebookMap.get(a.notebookId ?? '') ?? '').toLowerCase()
    const bNb = (notebookMap.get(b.notebookId ?? '') ?? '').toLowerCase()
    const aScore = aNb.includes(q) ? 0 : a.title.toLowerCase().includes(q) ? 1 : 2
    const bScore = bNb.includes(q) ? 0 : b.title.toLowerCase().includes(q) ? 1 : 2
    return aScore - bScore
  })
}

export function SearchPalette({ open, onClose, onSelectNote, onSelectNotebook, notebooks = [] }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const notebookMap = new Map(notebooks.map((nb) => [nb.id, nb.name]))

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
      const q = query.trim().toLowerCase()
      const matchingNotebooks: SearchResult[] = notebooks
        .filter((nb) => nb.name.toLowerCase().includes(q))
        .map((nb) => ({ kind: 'notebook', notebook: nb }))
      const foundNotes = await storage.searchNotes(query)
      const sortedNotes: SearchResult[] = sortResults(foundNotes, query, notebookMap).map((n) => ({
        kind: 'note',
        note: n,
      }))
      setResults([...matchingNotebooks, ...sortedNotes])
      setSelectedIndex(0)
    }, 150)
    return () => clearTimeout(timer)
  }, [query, notebooks])

  const selectResult = useCallback((result: SearchResult) => {
    if (result.kind === 'notebook') {
      onSelectNotebook?.(result.notebook.id)
    } else {
      const note = result.note
      if (note.notebookId) {
        onSelectNote(note.notebookId, note.id, note.subjectId)
      }
    }
    onClose()
  }, [onSelectNotebook, onSelectNote, onClose])

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
        const result = results[selectedIndex]
        if (result) selectResult(result)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [open, results, selectedIndex, onClose, onSelectNote, onSelectNotebook, selectResult])

  if (!open) return null

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Search notes and notebooks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.list}>
          {results.length === 0 && query.trim() && (
            <div className={styles.empty}>No results found</div>
          )}
          {results.map((result, i) => (
            <div
              key={result.kind === 'notebook' ? `nb-${result.notebook.id}` : result.note.id}
              className={`${styles.item} ${i === selectedIndex ? styles.itemActive : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onMouseDown={() => selectResult(result)}
            >
              {result.kind === 'notebook' ? (
                <>
                  <div className={styles.itemNotebook}>Notebook</div>
                  <div className={styles.itemTitle}>{result.notebook.name}</div>
                </>
              ) : (
                <>
                  {result.note.notebookId && notebookMap.has(result.note.notebookId) && (
                    <div className={styles.itemNotebook}>{notebookMap.get(result.note.notebookId)}</div>
                  )}
                  <div className={styles.itemTitle}>{result.note.title || 'Untitled'}</div>
                  {result.note.content && (
                    <div className={styles.itemPreview}>{stripMarkdown(result.note.content)}</div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
