import type { EditorView } from '@codemirror/view'
import styles from './FormattingToolbar.module.css'
import type { ActiveFormat } from './formatting'
import {
  toggleHeading,
  toggleBold,
  toggleItalic,
  toggleUnorderedList,
  toggleOrderedList,
  toggleTodo,
} from './formatting'

interface Props {
  view: EditorView
  activeFormats: Set<ActiveFormat>
  position: { top: number; left: number }
}

const GROUPS = [
  [
    { id: 'h1' as ActiveFormat, label: 'H1', title: 'Título H1' },
    { id: 'h2' as ActiveFormat, label: 'H2', title: 'Subtítulo H2' },
    { id: 'h3' as ActiveFormat, label: 'H3', title: 'Subtítulo H3' },
  ],
  [
    { id: 'bold' as ActiveFormat, label: 'B', title: 'Negrito' },
    { id: 'italic' as ActiveFormat, label: 'I', title: 'Itálico' },
  ],
  [
    { id: 'ul' as ActiveFormat, label: '≡', title: 'Lista' },
    { id: 'ol' as ActiveFormat, label: '1.', title: 'Lista Numerada' },
  ],
  [
    { id: 'todo' as ActiveFormat, label: '☐', title: 'TODO' },
  ],
]

function getAction(id: ActiveFormat, view: EditorView): () => void {
  switch (id) {
    case 'h1': return () => toggleHeading(view, 1)
    case 'h2': return () => toggleHeading(view, 2)
    case 'h3': return () => toggleHeading(view, 3)
    case 'bold': return () => toggleBold(view)
    case 'italic': return () => toggleItalic(view)
    case 'ul': return () => toggleUnorderedList(view)
    case 'ol': return () => toggleOrderedList(view)
    case 'todo': return () => toggleTodo(view)
  }
}

export function FormattingToolbar({ view, activeFormats, position }: Props) {
  const MARGIN = 8
  const top = position.top < 52 ? position.top + 22 : position.top - MARGIN

  return (
    <div
      className={styles.toolbar}
      style={{ top, left: Math.max(MARGIN, position.left) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {GROUPS.map((group, gi) => (
        <div key={gi} className={styles.group}>
          {gi > 0 && <div className={styles.sep} />}
          {group.map(({ id, label, title }) => (
            <button
              key={id}
              className={[
                styles.btn,
                activeFormats.has(id) ? styles.active : '',
                id === 'bold' ? styles.bold : '',
                id === 'italic' ? styles.italic : '',
              ].join(' ')}
              title={title}
              onMouseDown={(e) => {
                e.preventDefault()
                getAction(id, view)()
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
