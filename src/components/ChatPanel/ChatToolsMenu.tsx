import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ChatTools } from '../../hooks/useChat'
import styles from './ChatToolsMenu.module.css'

interface ToolDef {
  key: keyof ChatTools
  name: string
  description: string
  icon: ReactNode
}

const TOOLS: ToolDef[] = [
  {
    key: 'webSearch',
    name: 'Web Search',
    description: 'Searches the web for current information (uses Tavily).',
    icon: (
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
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    key: 'deepResearch',
    name: 'Deep Research',
    description: 'Multi-query search with reranking for thorough answers (overrides Web Search).',
    icon: (
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
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
]

export interface ChatToolsMenuProps {
  tools: ChatTools
  onToggle: (key: keyof ChatTools, value: boolean) => void
}

export function ChatToolsMenu({ tools, onToggle }: ChatToolsMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const activeCount = TOOLS.filter((t) => tools[t.key]).length

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={
          activeCount > 0 ? styles.triggerActive : styles.trigger
        }
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="tools"
        title="tools"
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
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" />
        </svg>
        {activeCount > 0 && (
          <span className={styles.badge}>{activeCount}</span>
        )}
      </button>
      {open && (
        <div className={styles.popover} role="menu">
          <div className={styles.popoverHeader}>FERRAMENTAS</div>
          <div className={styles.toolList}>
            {TOOLS.map((t) => {
              const enabled = tools[t.key]
              return (
                <div key={t.key} className={styles.toolRow}>
                  <span className={styles.toolIcon}>{t.icon}</span>
                  <div className={styles.toolText}>
                    <span className={styles.toolName}>{t.name}</span>
                    <span className={styles.toolDescription}>
                      {t.description}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`alternar ${t.name}`}
                    className={enabled ? styles.toggleOn : styles.toggleOff}
                    onClick={() => onToggle(t.key, !enabled)}
                  >
                    <span className={styles.toggleKnob} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
