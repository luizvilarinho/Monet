import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Brain, CalendarBlank, FileText, Globe, ListChecks, ListMagnifyingGlass } from '@phosphor-icons/react'
import type { ChatTools } from '../../hooks/useChat'
import { useRagDetailed } from '../../hooks/useRagDetailed'
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
]

export interface ChatToolsMenuProps {
  tools: ChatTools
  onToggle: (key: keyof ChatTools, value: boolean) => void
  folderMemory: { enabled: boolean } | null
  onToggleFolderMemory: (value: boolean) => void
  folderMemoryLabel?: string
  folderWebResearch?: { enabled: boolean } | null
  onToggleFolderWebResearch?: (value: boolean) => void
  // Tool "Tasks": chat principal e NotesChat; `supported` = o modelo aceita tools.
  tasksTool?: { supported: boolean } | null
  // Tool "Daily notes" (get_day, notes_by_date); `supported` = o modelo aceita tools.
  dailyNotesTool?: { supported: boolean } | null
  // Tool "Notes" (get_note e search_marks); `supported` = o modelo aceita tools.
  notesTool?: { supported: boolean } | null
}

export function ChatToolsMenu({
  tools,
  onToggle,
  folderMemory,
  onToggleFolderMemory,
  folderMemoryLabel = 'Folder memory',
  folderWebResearch = null,
  onToggleFolderWebResearch = () => {},
  tasksTool = null,
  dailyNotesTool = null,
  notesTool = null,
}: ChatToolsMenuProps) {
  const [open, setOpen] = useState(false)
  const [ragDetailed, setRagDetailed] = useRagDetailed()
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

  const activeCount =
    TOOLS.filter((t) => tools[t.key]).length +
    (folderMemory?.enabled ? 1 : 0) +
    (folderWebResearch?.enabled ? 1 : 0) +
    (tasksTool && tools.tasks ? 1 : 0) +
    (dailyNotesTool && tools.dailyNotes ? 1 : 0) +
    (notesTool && tools.notes ? 1 : 0)

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
            {tasksTool && (
              <div
                className={styles.toolRow}
                title={tasksTool.supported ? undefined : 'This model does not support tools'}
              >
                <span className={styles.toolIcon}>
                  <ListChecks size={16} />
                </span>
                <div className={styles.toolText}>
                  <span className={styles.toolName}>Tasks</span>
                  <span className={styles.toolDescription}>
                    Lets the AI look up your tasks (by period, project or status) when you ask about them.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tools.tasks}
                  aria-label="toggle tasks"
                  disabled={!tasksTool.supported}
                  className={tools.tasks ? styles.toggleOn : styles.toggleOff}
                  onClick={() => onToggle('tasks', !tools.tasks)}
                >
                  <span className={styles.toggleKnob} aria-hidden="true" />
                </button>
              </div>
            )}
            {dailyNotesTool && (
              <div
                className={styles.toolRow}
                title={dailyNotesTool.supported ? undefined : 'This model does not support tools'}
              >
                <span className={styles.toolIcon}>
                  <CalendarBlank size={16} />
                </span>
                <div className={styles.toolText}>
                  <span className={styles.toolName}>Daily notes</span>
                  <span className={styles.toolDescription}>
                    Lets the AI read your daily and dated notes from any notebook when you ask about a day or period (&quot;what do I have today?&quot;).
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tools.dailyNotes}
                  aria-label="toggle daily notes"
                  disabled={!dailyNotesTool.supported}
                  className={tools.dailyNotes ? styles.toggleOn : styles.toggleOff}
                  onClick={() => onToggle('dailyNotes', !tools.dailyNotes)}
                >
                  <span className={styles.toggleKnob} aria-hidden="true" />
                </button>
              </div>
            )}
            {notesTool && (
              <div
                className={styles.toolRow}
                title={notesTool.supported ? undefined : 'This model does not support tools'}
              >
                <span className={styles.toolIcon}>
                  <FileText size={16} />
                </span>
                <div className={styles.toolText}>
                  <span className={styles.toolName}>Notes</span>
                  <span className={styles.toolDescription}>
                    Lets the AI look up a note by title when you name one (metadata, its tasks if it is a TODOS, and an excerpt) and list your marks when you ask what you marked.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tools.notes}
                  aria-label="toggle notes"
                  disabled={!notesTool.supported}
                  className={tools.notes ? styles.toggleOn : styles.toggleOff}
                  onClick={() => onToggle('notes', !tools.notes)}
                >
                  <span className={styles.toggleKnob} aria-hidden="true" />
                </button>
              </div>
            )}
            {folderMemory && (
              <div className={styles.toolRow}>
                <span className={styles.toolIcon}>
                  <Brain size={16} />
                </span>
                <div className={styles.toolText}>
                  <span className={styles.toolName}>{folderMemoryLabel}</span>
                  <span className={styles.toolDescription}>
                    Lets the AI remember context across conversations in this folder.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={folderMemory.enabled}
                  aria-label="toggle folder memory"
                  className={folderMemory.enabled ? styles.toggleOn : styles.toggleOff}
                  onClick={() => onToggleFolderMemory(!folderMemory.enabled)}
                >
                  <span className={styles.toggleKnob} aria-hidden="true" />
                </button>
              </div>
            )}
            {folderWebResearch && (
              <div className={styles.toolRow}>
                <span className={styles.toolIcon}>
                  <Globe size={16} />
                </span>
                <div className={styles.toolText}>
                  <span className={styles.toolName}>Save web sources</span>
                  <span className={styles.toolDescription}>
                    Lets the AI save web sources it finds into this folder&apos;s permanent knowledge base, so future conversations don&apos;t need to re-search them.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={folderWebResearch.enabled}
                  aria-label="toggle save web sources"
                  className={folderWebResearch.enabled ? styles.toggleOn : styles.toggleOff}
                  onClick={() => onToggleFolderWebResearch(!folderWebResearch.enabled)}
                >
                  <span className={styles.toggleKnob} aria-hidden="true" />
                </button>
              </div>
            )}
            <div className={styles.toolRow}>
              <span className={styles.toolIcon}>
                <ListMagnifyingGlass size={16} />
              </span>
              <div className={styles.toolText}>
                <span className={styles.toolName}>Retrieval details</span>
                <span className={styles.toolDescription}>
                  Shows how the knowledge base search picked each answer&apos;s sources (queries, scores and the excerpts sent) and how long each step took. Applies to new answers.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={ragDetailed}
                aria-label="toggle retrieval details"
                className={ragDetailed ? styles.toggleOn : styles.toggleOff}
                onClick={() => setRagDetailed(!ragDetailed)}
              >
                <span className={styles.toggleKnob} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
