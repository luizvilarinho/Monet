import type { Note } from '../../types'
import styles from './Sidebar.module.css'

export interface SidebarProps {
  notes: Note[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}

export function Sidebar({ notes, activeId, onSelect, onCreate }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <button className={styles.newNote} onClick={onCreate}>+ nova nota</button>
      <ul className={styles.list}>
        {notes.map((n) => (
          <li
            key={n.id}
            className={n.id === activeId ? styles.active : undefined}
            onClick={() => onSelect(n.id)}
          >
            {n.title || 'sem título'}
          </li>
        ))}
      </ul>
    </aside>
  )
}
