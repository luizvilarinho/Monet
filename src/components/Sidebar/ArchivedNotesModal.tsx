import { useState } from 'react'
import { createPortal } from 'react-dom'
import { normalizeSearch } from '../../lib/noteSearch'
import type { Note, NoteType } from '../../types'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import styles from '../TasksView/StatusManagerModal.module.css'
import own from './ArchivedNotesModal.module.css'

// Notas arquivadas do caderno atual (já ordenadas por archivedAt desc), com
// busca por título sem acento. Sem mover/mesclar aqui.
interface ArchivedNotesModalProps {
  notes: Note[]
  typeById: Map<string, NoteType>
  onOpen: (id: string) => void
  onUnarchive: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function formatArchivedAt(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ArchivedNotesModal({ notes, typeById, onOpen, onUnarchive, onDelete, onClose }: ArchivedNotesModalProps) {
  const [query, setQuery] = useState('')
  const q = normalizeSearch(query.trim())
  const shown = q ? notes.filter((n) => normalizeSearch(n.title).includes(q)) : notes

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${styles.card} ${own.card}`}
        role="dialog"
        aria-modal="true"
        aria-label="Archived notes"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <div className={styles.header}>
          <p className={styles.title}>Archived · {notes.length}</p>
          <button type="button" className={styles.close} onClick={onClose}>
            Done
          </button>
        </div>
        <input
          className={own.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search archived notes"
          aria-label="search archived notes"
          autoFocus
        />
        <ul className={own.list}>
          {shown.length === 0 ? (
            <li className={own.empty}>{notes.length === 0 ? 'No archived notes' : 'No matches'}</li>
          ) : (
            shown.map((n) => {
              const type = (n.typeId && typeById.get(n.typeId)) || null
              return (
                <li key={n.id} className={own.row}>
                  <div className={own.main}>
                    {type && (
                      <span className={own.type} style={{ color: type.color ?? undefined }} title={type.name}>
                        <TypeIcon name={type.icon} size={11} />
                        <span className={own.typeName}>{type.name}</span>
                      </span>
                    )}
                    <span className={own.title} title={n.title || 'untitled'}>
                      {n.title || 'untitled'}
                    </span>
                  </div>
                  {n.archivedAt && <span className={own.date}>{formatArchivedAt(n.archivedAt)}</span>}
                  <div className={own.actions}>
                    <button type="button" className={own.action} onClick={() => onOpen(n.id)}>
                      Open
                    </button>
                    <button type="button" className={own.action} onClick={() => onUnarchive(n.id)}>
                      Unarchive
                    </button>
                    <button type="button" className={`${own.action} ${own.actionDanger}`} onClick={() => onDelete(n.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>,
    document.body
  )
}
