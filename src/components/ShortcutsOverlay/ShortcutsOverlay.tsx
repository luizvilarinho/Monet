import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, X } from '@phosphor-icons/react'
import styles from './ShortcutsOverlay.module.css'

interface ShortcutsOverlayProps {
  onClose: () => void
}

interface Shortcut {
  keys: ReactNode[]
  label: string
}

const GROUPS: Array<{ title: string; items: Shortcut[] }> = [
  {
    title: 'Anywhere in Monet',
    items: [
      { keys: ['Ctrl', 'P'], label: 'Search everything (every notebook, tags and marks)' },
      { keys: ['Ctrl', 'N'], label: 'New quick note' },
      { keys: ['Alt', <ArrowLeft key="l" size={11} aria-label="Left arrow" />], label: 'Back to the previous note' },
      { keys: ['Ctrl', '1 – 4'], label: 'Notebook, Chat, Library, Mincer' },
      { keys: ['Ctrl', 'Space'], label: 'Focus mode (notes)' },
      { keys: ['?'], label: 'This list (also Ctrl+/)' },
    ],
  },
  {
    title: 'From any app (Monet in the tray)',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Quick note window (today’s note)' },
      { keys: ['Ctrl', 'M'], label: 'Assistant window' },
      { keys: ['Ctrl', 'Alt', 'R'], label: 'Stop the Mincer recording (while recording)' },
    ],
  },
  {
    title: 'In a note',
    items: [
      { keys: ['/'], label: 'AI commands, on their own line' },
      { keys: ['[['], label: 'Link another note' },
      { keys: ['Ctrl', 'Shift', 'K'], label: 'Add or edit a link' },
      { keys: ['Ctrl', 'Shift', 'M'], label: 'Mark the selection for later' },
    ],
  },
  {
    title: 'In a book (Library)',
    items: [
      { keys: ['T'], label: 'Translate the selection (books in another language)' },
      { keys: ['V'], label: 'Add the selection to vocabulary (books in another language)' },
      { keys: ['L'], label: 'Listen to the selection, or to the page' },
      { keys: ['Space'], label: 'Play or pause (with the player open)' },
      { keys: ['R'], label: 'Repeat the sentence' },
      {
        keys: [
          'Shift',
          <ArrowLeft key="l" size={11} aria-label="Left arrow" />,
          '/',
          <ArrowRight key="r" size={11} aria-label="Right arrow" />,
        ],
        label: 'Previous or next sentence (with the player open)',
      },
    ],
  },
  {
    title: 'Search and boards',
    items: [
      { keys: ['Alt', 'Enter'], label: 'Open the result on the side (in Search everything)' },
      {
        keys: ['Alt', <ArrowUp key="u" size={11} aria-label="Up arrow" />, <ArrowDown key="d" size={11} aria-label="Down arrow" />],
        label: 'Previous or next card (note open from a board)',
      },
    ],
  },
]

// Lista dos atalhos (tecla `?` ou Ctrl+/). Esc, clique fora ou Close fecham.
export function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <header className={styles.header}>
          <h2 className={styles.title} id="shortcuts-title">Keyboard shortcuts</h2>
          <button type="button" className={styles.close} onClick={onClose} autoFocus>
            <X size={14} aria-hidden />
            Close
          </button>
        </header>
        <div className={styles.body}>
          {GROUPS.map((group) => (
            <section key={group.title} className={styles.group}>
              <h3 className={styles.groupTitle}>{group.title}</h3>
              <dl className={styles.list}>
                {group.items.map((item) => (
                  <div key={item.label} className={styles.item}>
                    <dt className={styles.keys}>
                      {item.keys.map((k, i) => (
                        <kbd key={i} className={styles.kbd}>{k}</kbd>
                      ))}
                    </dt>
                    <dd className={styles.label}>{item.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
