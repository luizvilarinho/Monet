import { CalendarBlank, Checks, Flag, Repeat, Target } from '@phosphor-icons/react'
import {
  describeRecurrence,
  formatDueShort,
  formatElapsed,
  isDone,
  isInProgress,
  isOpen,
  overdueKind,
  planDate,
  statusColor,
  statusName,
  todosTitleOf,
  type ChecklistProgress,
} from '../../lib/tasks'
import type { Task } from '../../types'
import { useTasksEnv } from './TasksEnv'
import styles from './TaskLine.module.css'

// Linha compacta das listas embutidas: bloco `/tasks` e sidebar do caderno; as
// visões de Tasks usam TaskCard. O título quebra em até 2 linhas (tooltip com
// o texto completo) e os metadados ficam numa segunda linha compacta.
interface TaskLineProps {
  task: Task
  todayKey: string
  // Nome do projeto (só quando a lista mostra todos os projetos).
  projectName?: string
  // Progresso do checklist da nota-corpo (`2/5`).
  checklist?: ChecklistProgress | null
  onSelect: () => void
  onToggle: (done: boolean) => void
}

export function TaskLine({ task, todayKey, projectName, checklist = null, onSelect, onToggle }: TaskLineProps) {
  const closed = !isOpen(task)
  return (
    <div
      className={styles.line}
      data-task-id={task.id}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect()
      }}
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={isDone(task)}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label="done"
      />
      <div className={styles.body}>
        <span className={`${styles.title} ${closed ? styles.titleClosed : ''}`} title={task.title}>
          {task.title}
        </span>
        <TaskMeta task={task} todayKey={todayKey} projectName={projectName} checklist={checklist} />
      </div>
    </div>
  )
}

interface TaskMetaProps {
  task: Task
  todayKey: string
  projectName?: string
  checklist: ChecklistProgress | null
}

function TaskMeta({ task, todayKey, projectName, checklist }: TaskMetaProps) {
  const { statuses, todosById, onOpenNote } = useTasksEnv()
  const plan = planDate(task)
  const late = overdueKind(task, todayKey)
  const date = plan
  // Deadline à parte só quando difere da data de planejamento.
  const deadline = task.dueDate !== null && task.dueDate !== plan ? task.dueDate : null
  const postponed = task.rescheduleCount
  const doing = isInProgress(task)
  const todos = todosTitleOf(task, todosById)
  if (
    !date &&
    !deadline &&
    postponed < 1 &&
    !doing &&
    !projectName &&
    !todos &&
    !task.important &&
    !task.recurrence &&
    !checklist
  ) {
    return null
  }
  return (
    <div className={styles.meta}>
      {date && (
        <span
          className={`${styles.chip} ${
            late === 'deadline' ? styles.lateDeadline : late === 'plan' ? styles.latePlan : ''
          }`}
        >
          <CalendarBlank size={11} aria-hidden />
          {formatDueShort(date)}
        </span>
      )}
      {deadline && (
        <span
          className={`${styles.chip} ${late === 'deadline' ? styles.lateDeadline : ''}`}
          title="Deadline"
        >
          <Target size={11} aria-hidden />
          {formatDueShort(deadline)}
        </span>
      )}
      {postponed >= 1 && (
        <span
          className={`${styles.chip} ${postponed >= 3 ? styles.postponedHigh : ''}`}
          title={`Postponed ${postponed}×`}
        >
          ↻{postponed}
        </span>
      )}
      {doing && (
        <span
          className={`${styles.chip} ${styles.doing}`}
          style={{ color: statusColor(task.status, statuses) }}
          title={task.doingSince !== null ? 'Time in this status' : undefined}
        >
          <span className={styles.doingDot} aria-hidden />
          {statusName(task.status, statuses).toLowerCase()}
          {task.status === 'doing' && task.doingSince !== null && (
            <> {formatElapsed(Date.now() - task.doingSince)}</>
          )}
        </span>
      )}
      {projectName && <span className={`${styles.chip} ${styles.project}`}>{projectName}</span>}
      {todos && (
        <span
          className={`${styles.chip} ${styles.todos}`}
          title={`Open TODOS: ${todos}`}
          role="link"
          onClick={(e) => {
            e.stopPropagation()
            onOpenNote(task.parentNoteId!)
          }}
        >
          <Checks size={11} aria-hidden />
          <span>{todos}</span>
        </span>
      )}
      {task.important && (
        <span className={`${styles.chip} ${styles.important}`} title="Important">
          <Flag size={11} weight="fill" aria-hidden />
        </span>
      )}
      {task.recurrence && (
        <span className={styles.chip} title={`Repeats ${describeRecurrence(task.recurrence)}`}>
          <Repeat size={11} aria-hidden />
        </span>
      )}
      {checklist && (
        <span
          className={`${styles.chip} ${checklist.done === checklist.total ? styles.checklistDone : ''}`}
          title="Checklist"
        >
          {checklist.done}/{checklist.total}
        </span>
      )}
    </div>
  )
}
