import { useState } from 'react'
import { CalendarBlank, Clock, Flag, Repeat, Sun, Target, Trash } from '@phosphor-icons/react'
import {
  describeRecurrence,
  formatDueShort,
  formatElapsed,
  isDone,
  isInProgress,
  isOpen,
  overdueKind,
  planDate,
  SNOOZE_OPTIONS,
  statusColor,
  statusName,
  type ChecklistProgress,
  type SnoozeKind,
} from '../../lib/tasks'
import type { Task } from '../../types'
import { useTasksEnv } from './TasksEnv'
import styles from './TaskLine.module.css'

// Linha de task compartilhada pelas visões de Tasks: o título ocupa a largura
// inteira (quebra em até `lines` linhas, tooltip com o texto completo) e os
// metadados ficam numa segunda linha compacta.
interface TaskLineProps {
  task: Task
  todayKey: string
  // Nome do projeto (só quando a lista mostra todos os projetos).
  projectName?: string
  // Mostra o indicador de status em andamento (falso onde o grupo já diz isso).
  showDoing?: boolean
  // Cor do projeto (borda esquerda); null = neutra.
  projectColor?: string | null
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
  // Exclusão (pede confirmação no chamador); ausente = sem botão.
  onDelete?: () => void
  // Adia a data de planejamento; ausente = sem botão.
  onSnooze?: (kind: SnoozeKind) => void
  // Plan today: adiciona/remove a task de hoje; ausente = sem botão.
  planned?: boolean
  onTogglePlan?: () => void
}

export function TaskLine({
  task,
  todayKey,
  projectName,
  showDoing = true,
  projectColor = null,
  showDate = true,
  showGroup = true,
  checklist = null,
  lines = 2,
  selected = false,
  cursor = false,
  inSelection = false,
  onSelect,
  onToggle,
  onDelete,
  onSnooze,
  planned = false,
  onTogglePlan,
}: TaskLineProps) {
  const closed = !isOpen(task)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  return (
    <div
      className={`${styles.line} ${selected ? styles.selected : ''} ${cursor ? styles.cursor : ''} ${
        inSelection ? styles.inSelection : ''
      }`}
      data-task-id={task.id}
      style={projectColor && !selected ? { borderLeftColor: projectColor } : undefined}
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
        checked={isDone(task)}
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
      {onTogglePlan && isOpen(task) && (
        <button
          type="button"
          className={`${styles.deleteBtn} ${planned ? styles.planned : ''}`}
          aria-label={planned ? 'Remove from today' : 'Add to today'}
          aria-pressed={planned}
          title={planned ? 'Remove from today' : 'Add to today'}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePlan()
          }}
        >
          <Sun size={13} weight={planned ? 'fill' : 'regular'} aria-hidden />
        </button>
      )}
      {onSnooze && isOpen(task) && (
        <span
          className={styles.snoozeWrap}
          onMouseDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSnoozeOpen(false)
          }}
        >
          <button
            type="button"
            className={styles.deleteBtn}
            aria-label="Snooze task"
            title="Snooze"
            onClick={(e) => {
              e.stopPropagation()
              setSnoozeOpen((v) => !v)
            }}
          >
            <Clock size={13} aria-hidden />
          </button>
          {snoozeOpen && (
            <div className={styles.snoozeMenu} role="menu">
              {SNOOZE_OPTIONS.map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  role="menuitem"
                  className={styles.snoozeItem}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSnoozeOpen(false)
                    onSnooze(o.kind)
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </span>
      )}
      {onDelete && (
        <button
          type="button"
          className={styles.deleteBtn}
          aria-label="Delete task"
          title="Delete task"
          // Não inicia o arraste do card (Kanban/Week) nem abre a task.
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash size={13} aria-hidden />
        </button>
      )}
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
  const { statuses } = useTasksEnv()
  const plan = planDate(task)
  const late = overdueKind(task, todayKey)
  const date = showDate ? plan : null
  // Deadline à parte só quando difere da data de planejamento.
  const deadline = task.dueDate !== null && task.dueDate !== plan ? task.dueDate : null
  const postponed = task.rescheduleCount
  const doing = showDoing && isInProgress(task)
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
