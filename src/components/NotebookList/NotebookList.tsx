import { useRef, useState } from 'react'
import type { Notebook } from '../../types'
import styles from './NotebookList.module.css'

export interface NotebookListProps {
  notebooks: Notebook[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  tags: string[]
  activeTag: string | null
  onSelectTag: (tag: string | null) => void
  onOpenSettings: () => void
}

export function NotebookList({
  notebooks,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  tags,
  activeTag,
  onSelectTag,
  onOpenSettings,
}: NotebookListProps) {
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function commitEdit() {
    if (!editing) return
    const name = editing.value.trim()
    if (name) onRename(editing.id, name)
    setEditing(null)
  }

  return (
    <aside className={styles.notebooks}>
      <div className={styles.scrollArea}>
        <section className={styles.section}>
          <div className={styles.header}>cadernos</div>
          <button className={styles.newNotebook} onClick={onCreate}>
            + novo caderno
          </button>
          <ul className={styles.list}>
            <li
              className={`${styles.row} ${activeId === null ? styles.active : ''}`}
              onClick={() => onSelect(null)}
            >
              <span className={`${styles.rowLabel} ${styles.allNotes}`}>todas as notas</span>
            </li>

            {notebooks.length === 0 ? (
              <li className={styles.empty}>nenhum caderno</li>
            ) : (
              notebooks.map((nb) => (
                <li
                  key={nb.id}
                  className={`${styles.row} ${nb.id === activeId ? styles.active : ''}`}
                  onClick={() => {
                    if (editing?.id === nb.id) return
                    onSelect(nb.id)
                  }}
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return
                    setEditing({ id: nb.id, value: nb.name })
                  }}
                >
                  {editing?.id === nb.id ? (
                    <input
                      autoFocus
                      ref={inputRef}
                      className={styles.renameInput}
                      value={editing.value}
                      onChange={(e) => setEditing({ id: nb.id, value: e.target.value })}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') setEditing(null)
                        e.stopPropagation()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={styles.rowLabel}>
                      {nb.name || 'sem nome'}
                    </span>
                  )}
                  {editing?.id !== nb.id && (
                    <button
                      className={styles.rowDelete}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`apagar o caderno "${nb.name}" e todas as anotações dele?`)) {
                          onDelete(nb.id)
                        }
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      aria-label={`apagar caderno ${nb.name}`}
                      type="button"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <hr className={styles.divider} />

        <section className={styles.section}>
          <div className={styles.header}>tags</div>
          <ul className={styles.list}>
            {tags.length === 0 ? (
              <li className={styles.empty}>nenhuma tag</li>
            ) : (
              tags.map((t) => (
                <li
                  key={t}
                  className={t === activeTag ? styles.active : undefined}
                  onClick={() => onSelectTag(t === activeTag ? null : t)}
                >
                  #{t}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className={styles.footer}>
        <button
          className={styles.settings}
          onClick={onOpenSettings}
          aria-label="configurações"
          type="button"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
