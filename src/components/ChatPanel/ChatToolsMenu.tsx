import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Brain, CalendarBlank, FileText, Globe, ListChecks, ListMagnifyingGlass, Wrench } from '@phosphor-icons/react'
import type { ChatTools } from '../../hooks/useChat'
import type { ChatAgentDef } from '../../lib/agents/chat'
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
    icon: <Globe size={16} aria-hidden />,
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
  // Agente da conversa: os switches mostram o estado efetivo (o agente que não
  // usa a web a desliga; o que força Tasks ou Notes as liga) com o motivo.
  agent?: ChatAgentDef | null
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
  agent = null,
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
    // Escape fecha o popover sem sair do composer.
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Estado efetivo por agente (General não muda nada).
  const webOffByAgent = !!agent && !agent.context.web
  const tasksForced = !!agent?.forceTasksTool && !!tasksTool?.supported
  const notesForced = !!agent?.forceNotesTool && !!notesTool?.supported
  const effective = (key: keyof ChatTools): boolean => {
    if (key === 'webSearch') return tools.webSearch && !webOffByAgent
    return tools[key]
  }
  const activeCount =
    TOOLS.filter((t) => effective(t.key)).length +
    (folderMemory?.enabled ? 1 : 0) +
    (folderWebResearch?.enabled ? 1 : 0) +
    (tasksTool && (tools.tasks || tasksForced) ? 1 : 0) +
    (dailyNotesTool && tools.dailyNotes ? 1 : 0) +
    (notesTool && (tools.notes || notesForced) ? 1 : 0)

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
        aria-label="Tools"
        title="Tools"
      >
        <Wrench size={16} aria-hidden />
        {activeCount > 0 && (
          <span className={styles.badge}>{activeCount}</span>
        )}
      </button>
      {open && (
        <div className={styles.popover} role="menu">
          <div className={styles.popoverHeader}>Tools</div>
          <div className={styles.toolList}>
            {TOOLS.map((t) => {
              const enabled = effective(t.key)
              const lockedBy = t.key === 'webSearch' && webOffByAgent ? agent : null
              return (
                <div
                  key={t.key}
                  className={styles.toolRow}
                  title={lockedBy ? `${lockedBy.label} doesn't use web search` : undefined}
                >
                  <span className={styles.toolIcon}>{t.icon}</span>
                  <div className={styles.toolText}>
                    <span className={styles.toolName}>{t.name}</span>
                    <span className={styles.toolDescription}>
                      {t.description}
                    </span>
                    {lockedBy && <span className={styles.toolLocked}>Off for {lockedBy.label}</span>}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`toggle ${t.name.toLowerCase()}`}
                    disabled={!!lockedBy}
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
                title={
                  !tasksTool.supported
                    ? 'This model does not support tools'
                    : tasksForced && agent
                      ? `${agent.label} always reads your tasks`
                      : undefined
                }
              >
                <span className={styles.toolIcon}>
                  <ListChecks size={16} />
                </span>
                <div className={styles.toolText}>
                  <span className={styles.toolName}>Tasks</span>
                  <span className={styles.toolDescription}>
                    Lets the AI look up your tasks (by period, project or status) when you ask about them.
                  </span>
                  {tasksForced && agent && <span className={styles.toolLocked}>On for {agent.label}</span>}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tools.tasks || tasksForced}
                  aria-label="toggle tasks"
                  disabled={!tasksTool.supported || tasksForced}
                  className={tools.tasks || tasksForced ? styles.toggleOn : styles.toggleOff}
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
                    Lets the AI read your daily notes and the notes dated in a day or period, including deadlines and start/end dates of note types (&quot;what do I have this week?&quot;).
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
                title={
                  !notesTool.supported
                    ? 'This model does not support tools'
                    : notesForced && agent
                      ? `${agent.label} always looks up your notes`
                      : undefined
                }
              >
                <span className={styles.toolIcon}>
                  <FileText size={16} />
                </span>
                <div className={styles.toolText}>
                  <span className={styles.toolName}>Notes</span>
                  <span className={styles.toolDescription}>
                    Lets the AI look up a note by title when you name one (metadata, its tasks if it is a TODOS, and an excerpt) and list your marks when you ask what you marked.
                  </span>
                  {notesForced && agent && <span className={styles.toolLocked}>On for {agent.label}</span>}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tools.notes || notesForced}
                  aria-label="toggle notes"
                  disabled={!notesTool.supported || notesForced}
                  className={tools.notes || notesForced ? styles.toggleOn : styles.toggleOff}
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
