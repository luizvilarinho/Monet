import { useMemo, useState } from 'react'
import type { Note, Notebook } from '../../types'
import { cleanContent, scoreRelatedNotes } from './scoreNotes'
import styles from './RelatedContent.module.css'

interface Props {
  activeNote: Note
  notes: Note[]
  notebooks: Notebook[]
  onSelect: (id: string) => void
}

function snippet(content: string, max = 140): string {
  const clean = cleanContent(content)
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).trimEnd() + '…'
}

export function RelatedContent({ activeNote, notes, notebooks, onSelect }: Props) {
  const [open, setOpen] = useState(true)
  const related = useMemo(
    () => scoreRelatedNotes(activeNote, notes),
    [activeNote, notes]
  )

  if (related.length === 0) return null

  return (
    <div className={styles.related}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
        <span className={styles.title}>Related content</span>
        <span className={styles.count}>{related.length}</span>
      </button>
      {open && (
        <ul className={styles.list}>
          {related.map(({ note }) => {
            const preview = snippet(note.content)
            const notebookName = notebooks.find((n) => n.id === note.notebookId)?.name
            return (
              <li key={note.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.itemButton}
                  onClick={() => onSelect(note.id)}
                >
                  {notebookName && (
                    <div className={styles.itemNotebook}>{notebookName}</div>
                  )}
                  <div className={styles.itemTitle}>
                    {note.title.trim() || 'Untitled'}
                  </div>
                  {preview && <div className={styles.itemSnippet}>{preview}</div>}
                  {note.tags.length > 0 && (
                    <div className={styles.itemTags}>
                      {note.tags.map((t) => (
                        <span key={t} className={styles.itemTag}>#{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
