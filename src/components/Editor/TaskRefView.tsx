import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { formatDueShort, isOpen, overdueKind, planDate } from '../../lib/tasks'
import { useTasksContext } from './TasksContext'
import styles from './TaskRef.module.css'

export function TaskRefView({ node, selected }: NodeViewProps) {
  const id = (node.attrs.id as string) ?? ''
  const { tasksById, todayKey, onOpenTask } = useTasksContext()
  const task = tasksById.get(id)

  // Task inexistente (excluída): não renderiza nada; o item vira checkbox comum.
  if (!task) return <NodeViewWrapper as="span" />

  const late = overdueKind(task, todayKey)
  const plan = planDate(task)
  const className = [
    styles.pill,
    late === 'deadline' ? styles.overdue : late === 'plan' ? styles.late : '',
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
      {plan ? formatDueShort(plan) : 'task'}
    </NodeViewWrapper>
  )
}
