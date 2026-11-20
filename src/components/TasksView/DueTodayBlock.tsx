import { useMemo } from 'react'
import { dateKeyFromMs } from '../../lib/calendar'
import { compareTasks, formatDueShort, isDone, isOpen, isOverdue, overdueKind, todosTitleOf } from '../../lib/tasks'
import type { Task } from '../../types'
import { useTasksEnv } from './TasksEnv'
import styles from './DueTodayBlock.module.css'

// Bloco no topo da nota diária do Calendar: tasks abertas com do date ou
// deadline no dia (e, se o dia é hoje, também as atrasadas e as do My Day),
// com checkbox. As concluídas no dia continuam riscadas. Nada é gravado no
// conteúdo da nota.
interface DueTodayBlockProps {
  tasks: Task[]
  dayKey: string
  todayKey: string
  onOpenTask: (id: string) => void
  onToggleTask: (id: string, done: boolean) => void
}

export function DueTodayBlock({ tasks, dayKey, todayKey, onOpenTask, onToggleTask }: DueTodayBlockProps) {
  const { todosById, onOpenNote } = useTasksEnv()
  const isToday = dayKey === todayKey
  const list = useMemo(() => {
    const onDay = (t: Task) =>
      t.dueDate === dayKey || t.scheduledDate === dayKey || (isToday && t.plannedDay === todayKey)
    // Concluída hoje que estava atrasada: segue na lista, riscada. Mesma regra
    // do isOverdue: deadline estourado com do date de hoje em diante já tinha
    // sido replanejado (não era de hoje).
    const wasLate = (t: Task) =>
      isToday &&
      ((t.scheduledDate !== null && t.scheduledDate < todayKey) ||
        (t.scheduledDate === null && t.dueDate !== null && t.dueDate < todayKey))
    const open = tasks.filter((t) => isOpen(t) && (onDay(t) || (isToday && isOverdue(t, todayKey))))
    const done = tasks.filter(
      (t) =>
        isDone(t) && t.completedAt !== null && dateKeyFromMs(t.completedAt) === dayKey && (onDay(t) || wasLate(t))
    )
    return [...open.sort(compareTasks), ...done.sort(compareTasks)]
  }, [tasks, dayKey, todayKey, isToday])
  if (list.length === 0) return null
  return (
    <div className={styles.block}>
      <span className={styles.heading}>{isToday ? 'Due today' : `Due ${formatDueShort(dayKey)}`}</span>
      {list.map((t) => {
        const late = overdueKind(t, todayKey)
        const todos = todosTitleOf(t, todosById)
        const done = isDone(t)
        return (
          <div
            key={t.id}
            className={`${styles.item} ${
              late === 'deadline' ? styles.lateDeadline : late === 'plan' ? styles.latePlan : ''
            } ${done ? styles.done : ''}`}
          >
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={done}
              onChange={(e) => onToggleTask(t.id, e.target.checked)}
              aria-label={`done: ${t.title}`}
            />
            {todos && (
              <button
                type="button"
                className={styles.todos}
                title={`Open TODOS: ${todos}`}
                onClick={() => onOpenNote(t.parentNoteId!)}
              >
                {todos}
              </button>
            )}
            <button type="button" className={styles.titleBtn} onClick={() => onOpenTask(t.id)} title={t.title}>
              {t.title}
            </button>
            {t.dueDate === dayKey && <span className={styles.tag}>deadline</span>}
          </div>
        )
      })}
    </div>
  )
}
