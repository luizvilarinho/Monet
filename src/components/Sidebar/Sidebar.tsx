import type { Note } from '../../types'
import styles from './Sidebar.module.css'

export interface SidebarProps {
  notes: Note[]
  activeId: string | null
  notebookSelected: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export function Sidebar({
  notes,
  activeId,
  notebookSelected,
  onSelect,
  onCreate,
  onDelete,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>anotações</div>
      <button
        className={styles.newNote}
        onClick={onCreate}
        disabled={!notebookSelected}
      >
        + nova anotação
      </button>
      <ul className={styles.list}>
        {notes.length === 0 ? (
          <li className={styles.empty}>nenhuma anotação</li>
        ) : (
          notes.map((n) => (
            <li
              key={n.id}
              className={
                (n.id === activeId ? styles.active : '') + ' ' + styles.row
              }
              onClick={() => onSelect(n.id)}
            >
              <span className={styles.rowLabel}>{n.title || 'sem título'}</span>
              <button
                className={styles.rowDelete}
                onClick={(e) => {
                  e.stopPropagation()
                  if (
                    window.confirm(
                      `apagar a anotação "${n.title || 'sem título'}"?`
                    )
                  ) {
                    onDelete(n.id)
                  }
                }}
                aria-label={`apagar anotação ${n.title || 'sem título'}`}
                type="button"
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
