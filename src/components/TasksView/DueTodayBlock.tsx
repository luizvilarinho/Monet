import { useMemo } from 'react'
import { compareTasks, formatDueShort, isOpen, isOverdue, overdueKind, todosTitleOf } from '../../lib/tasks'
import type { Task } from '../../types'
import { useTasksEnv } from './TasksEnv'
import styles from './DueTodayBlock.module.css'

// Bloco somente leitura no topo da nota diária do Calendar: tasks abertas com
// do date ou deadline no dia (e, se o dia é hoje, também as atrasadas).
// Nada é gravado no conteúdo da nota.
interface DueTodayBlockProps {
  tasks: Task[]
  dayKey: string
  todayKey: string
  onOpenTask: (id: string) => void
}

export function DueTodayBlock({ tasks, dayKey, todayKey, onOpenTask }: DueTodayBlockProps) {
  const { todosById, onOpenNote } = useTasksEnv()
  const isToday = dayKey === todayKey
  const list = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            isOpen(t) &&
            (t.dueDate === dayKey || t.scheduledDate === dayKey || (isToday && isOverdue(t, todayKey)))
        )
        .sort(compareTasks),
    [tasks, dayKey, todayKey, isToday]
  )
  if (list.length === 0) return null
  return (
    <div className={styles.block}>
      <span className={styles.heading}>{isToday ? 'Due today' : `Due ${formatDueShort(dayKey)}`}</span>
      {list.map((t) => {
        const late = overdueKind(t, todayKey)
        const todos = todosTitleOf(t, todosById)
        return (
          <button
            key={t.id}
            type="button"
            className={`${styles.item} ${
              late === 'deadline' ? styles.lateDeadline : late === 'plan' ? styles.latePlan : ''
            }`}
            onClick={() => onOpenTask(t.id)}
            title={t.title}
          >
            {todos && (
              <span
                className={styles.todos}
                title={`Open TODOS: ${todos}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenNote(t.parentNoteId!)
                }}
              >
                {todos}
              </span>
            )}
            <span className={styles.title}>{t.title}</span>
            {t.dueDate === dayKey && <span className={styles.tag}>deadline</span>}
          </button>
        )
      })}
    </div>
  )
}
