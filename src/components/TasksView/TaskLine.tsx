import { CalendarBlank, Flag, Repeat, Target } from '@phosphor-icons/react'
import {
  describeRecurrence,
  formatDueShort,
  isOpen,
  overdueKind,
  planDate,
  type ChecklistProgress,
} from '../../lib/tasks'
import type { Task } from '../../types'
import styles from './TaskLine.module.css'

// Linha de task compartilhada pelas visões de Tasks: o título ocupa a largura
// inteira (quebra em até `lines` linhas, tooltip com o texto completo) e os
// metadados ficam numa segunda linha compacta.
interface TaskLineProps {
  task: Task
  todayKey: string
  // Nome do projeto (só quando a lista mostra todos os projetos).
  projectName?: string
  // Mostra o indicador "doing" (falso onde o grupo já diz isso).
  showDoing?: boolean
  // Mostra a data de planejamento (falso no Week board, onde a coluna é a data).
  showDate?: boolean
  // Mostra o group (falso no Group by projeto, que já usa subtítulos).
  showGroup?: boolean
  // Progresso do checklist da nota-corpo (`2/5`).
  checklist?: ChecklistProgress | null
  lines?: 2 | 3
  // Task aberta no editor.
  selected?: boolean
  // Cursor do teclado e multi-seleção (useTaskKeyboard).
  cursor?: boolean
  inSelection?: boolean
  // Recebe as teclas modificadoras do clique (Ctrl/Shift = seleção).
  onSelect: (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void
  onToggle: (done: boolean) => void
}

export function TaskLine({
  task,
  todayKey,
  projectName,
  showDoing = true,
  showDate = true,
  showGroup = true,
  checklist = null,
  lines = 2,
  selected = false,
  cursor = false,
  inSelection = false,
  onSelect,
  onToggle,
}: TaskLineProps) {
  const closed = !isOpen(task)
  return (
    <div
      className={`${styles.line} ${selected ? styles.selected : ''} ${cursor ? styles.cursor : ''} ${
        inSelection ? styles.inSelection : ''
      }`}
      data-task-id={task.id}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(e)
      }}
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={task.status === 'done'}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label="done"
      />
      <div className={styles.body}>
        <span
          className={`${styles.title} ${closed ? styles.titleClosed : ''}`}
          style={{ WebkitLineClamp: lines }}
          title={task.title}
        >
          {task.title}
        </span>
        <TaskMeta
          task={task}
          todayKey={todayKey}
          projectName={projectName}
          showDoing={showDoing}
          showDate={showDate}
          showGroup={showGroup}
          checklist={checklist}
        />
      </div>
    </div>
  )
}

interface TaskMetaProps {
  task: Task
  todayKey: string
  projectName?: string
  showDoing: boolean
  showDate: boolean
  showGroup: boolean
  checklist: ChecklistProgress | null
}

function TaskMeta({ task, todayKey, projectName, showDoing, showDate, showGroup, checklist }: TaskMetaProps) {
  const plan = planDate(task)
  const late = overdueKind(task, todayKey)
  const date = showDate ? plan : null
  // Deadline à parte só quando difere da data de planejamento.
  const deadline = task.dueDate !== null && task.dueDate !== plan ? task.dueDate : null
  const postponed = task.rescheduleCount
  const doing = showDoing && task.status === 'doing'
  const group = showGroup ? task.group : null
  if (
    !date &&
    !deadline &&
    postponed < 1 &&
    !doing &&
    !projectName &&
    !group &&
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
        <span className={`${styles.chip} ${styles.doing}`}>
          <span className={styles.doingDot} aria-hidden />
          doing
        </span>
      )}
      {projectName && <span className={`${styles.chip} ${styles.project}`}>{projectName}</span>}
      {group && (
        <span className={`${styles.chip} ${styles.group}`} title={`Group: ${group}`}>
          {group}
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
