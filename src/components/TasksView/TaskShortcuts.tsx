import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, X } from '@phosphor-icons/react'
import styles from './TaskShortcuts.module.css'

// Lista dos atalhos das visões de Tasks (tecla `?` com o foco nas Tasks e item
// do menu de visão). O cabeçalho escuta o evento e abre o popover. Fora das
// Tasks, o `?` abre o ShortcutsOverlay da casca (aria-modal aqui impede os dois).
// Esc e clique fora fecham.
export const TASKS_SHORTCUTS_EVENT = 'monet:tasks-shortcuts'

const SHORTCUTS: Array<{ keys: ReactNode[]; desc: string }> = [
  {
    keys: [
      <ArrowUp key="up" size={10} weight="bold" aria-label="Up arrow" />,
      <ArrowDown key="down" size={10} weight="bold" aria-label="Down arrow" />,
    ],
    desc: 'Move the cursor (Shift extends the selection)',
  },
  { keys: ['Enter'], desc: 'Open the task' },
  { keys: ['Esc'], desc: 'Clear the selection' },
  { keys: ['x'], desc: 'Mark done / reopen' },
  { keys: ['s'], desc: 'Next status' },
  { keys: ['t'], desc: 'Do date today' },
  { keys: ['d'], desc: 'Pick a do date' },
  { keys: ['p'], desc: 'Add to / remove from My Day' },
  { keys: ['z'], desc: 'Snooze 1 day' },
  { keys: ['Shift', 'z'], desc: 'Snooze 1 week' },
  { keys: ['Delete'], desc: 'Drop' },
  { keys: ['/', 'Ctrl F'], desc: 'Search' },
  { keys: ['?'], desc: 'Show this list' },
]

export function TaskShortcuts({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="tasks-shortcuts-title">
        <div className={styles.head}>
          <h2 id="tasks-shortcuts-title" className={styles.title}>
            Keyboard shortcuts
          </h2>
          <button type="button" className={styles.close} onClick={onClose} autoFocus>
            <X size={12} aria-hidden />
            Close
          </button>
        </div>
        <dl className={styles.list}>
          {SHORTCUTS.map((s) => (
            <div key={s.desc} className={styles.row}>
              <dt className={styles.keys}>
                {s.keys.map((k, i) => (
                  <kbd key={i} className={styles.key}>
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className={styles.desc}>{s.desc}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.note}>
          Shortcuts act on the selected tasks, or on the cursor. Ctrl+click adds a task to the
          selection; Shift+click selects a range.
        </p>
      </div>
    </div>,
    document.body
  )
}
