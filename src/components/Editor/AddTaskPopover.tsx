import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProjectChoice } from '../../lib/tasks'
import type { Notebook } from '../../types'
import { ProjectPicker } from '../TasksView/ProjectPicker'
import { useAnchoredPosition, type PopoverAnchor } from './anchoredPosition'
import styles from './AddTaskPopover.module.css'

interface AddTaskPopoverProps {
  position: PopoverAnchor
  count: number
  notebooks: Notebook[]
  suggestedNotebookId: string
  onConfirm: (opts: { dueDate: string | null; project: ProjectChoice }) => void
  onCancel: () => void
}

// Popover do "Add to Tasks" (fora do BubbleMenu, que some quando o input de
// data rouba o foco). Enter confirma, Esc/clique fora cancela.
export function AddTaskPopover({
  position,
  count,
  notebooks,
  suggestedNotebookId,
  onConfirm,
  onCancel,
}: AddTaskPopoverProps) {
  const [dueDate, setDueDate] = useState('')
  const [project, setProject] = useState<ProjectChoice>({ notebookId: suggestedNotebookId })
  const dateRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const pos = useAnchoredPosition(ref, position)
  // Ref: `onCancel` muda a cada render do Editor e re-registrar o listener
  // abriria uma janela em que o clique fora se perde.
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    dateRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancelRef.current()
      }
    }
    // Registro adiado: o popover abre no mousedown do botão "Add to Tasks", e o
    // React aplica o efeito antes de esse mesmo evento chegar ao document —
    // registrado na hora, o clique de abertura contaria como "clique fora".
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [])

  function confirm() {
    onConfirm({ dueDate: dueDate || null, project })
  }

  // Portal: acima do modal da task (z-index 1000) e fora do overflow do editor.
  return createPortal(
    <div
      ref={ref}
      data-add-task-popover
      className={styles.popup}
      style={{ top: pos.top, left: pos.left }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          confirm()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>Deadline</span>
        <input
          ref={dateRef}
          className={styles.input}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="deadline"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Project</span>
        <ProjectPicker notebooks={notebooks} value={project} onChange={setProject} />
      </label>
      <button
        type="button"
        className={styles.confirm}
        onMouseDown={(e) => {
          e.preventDefault()
          confirm()
        }}
      >
        {count > 1 ? `Add ${count} tasks` : 'Add task'}
      </button>
    </div>,
    document.body
  )
}
