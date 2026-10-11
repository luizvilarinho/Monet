import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { formatDueShort, isOpen, isOverdue } from '../../lib/tasks'
import { useTasksContext } from './TasksContext'
import styles from './TaskRef.module.css'

export function TaskRefView({ node, selected }: NodeViewProps) {
  const id = (node.attrs.id as string) ?? ''
  const { tasksById, todayKey, onOpenTask } = useTasksContext()
  const task = tasksById.get(id)

  // Task inexistente (excluída): não renderiza nada; o item vira checkbox comum.
  if (!task) return <NodeViewWrapper as="span" />

  const className = [
    styles.pill,
    isOverdue(task, todayKey) ? styles.overdue : '',
    isOpen(task) ? '' : styles.closed,
    selected ? styles.selected : '',
  ].join(' ')

  return (
    <NodeViewWrapper
      as="span"
      className={className}
      contentEditable={false}
      title={onOpenTask ? 'Open in Tasks' : undefined}
      onClick={() => onOpenTask?.(id)}
    >
      {task.dueDate ? formatDueShort(task.dueDate) : 'task'}
    </NodeViewWrapper>
  )
}
