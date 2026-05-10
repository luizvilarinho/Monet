import type { ChatConversation } from '../../hooks/useChat'
import styles from './ChatSidebar.module.css'

export interface ChatSidebarProps {
  conversations: ChatConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ChatSidebarProps) {
  const sorted = [...conversations].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  )

  return (
    <aside className={styles.sidebar} aria-label="Conversas">
      <div className={styles.header}>
        <button type="button" className={styles.newBtn} onClick={onNew}>
          <span className={styles.plus} aria-hidden="true">
            +
          </span>
          Nova conversa
        </button>
      </div>
      <div className={styles.list}>
        {sorted.length === 0 ? (
          <p className={styles.empty}>
            Nenhuma conversa ainda. Crie uma para começar.
          </p>
        ) : (
          sorted.map((c) => {
            const active = c.id === activeId
            return (
              <div
                key={c.id}
                className={active ? styles.itemActive : styles.item}
                onClick={() => onSelect(c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(c.id)
                  }
                }}
              >
                <span className={styles.itemTitle}>{c.title}</span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(c.id)
                  }}
                  aria-label="apagar conversa"
                  title="apagar conversa"
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
