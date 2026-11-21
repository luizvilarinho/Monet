import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { CalendarBlank, Flag, Sun, Target } from '@phosphor-icons/react'
import {
  deadlineMarkOn,
  formatDateLong,
  formatDeadlineDay,
  formatDueShort,
  isDone,
  isOpen,
  overdueKind,
  statusColor,
} from '../../lib/tasks'
import type { Task } from '../../types'
import { useTasksEnv } from './TasksEnv'
import styles from './CompactTaskRow.module.css'

// Linha compacta de task do Month (grade, bandeja e popover do dia): filete do
// projeto na borda esquerda, quadrado de status e título; à direita só o que
// existe (My Day, important e o Target do deadline). Nada além disso.
interface CompactTaskRowProps {
  task: Task
  todayKey: string
  projectColor: string | null
  // Dia da célula da grade (decide o Target); null na bandeja.
  day: string | null
  // Título em até 2 linhas (bandeja, popover e sobra na célula).
  wrap?: boolean
  // Bandeja Overdue: a data que estourou (Target vermelho ou CalendarBlank amarelo).
  showMissedDate?: boolean
  // Cursor do teclado e multi-seleção (useTaskKeyboard).
  cursor: boolean
  inSelection: boolean
  // A linha de origem do arrasto esmaece.
  dragging: boolean
  // Hover no "N due" do dia do deadline desta task.
  highlighted?: boolean
  onSelect: (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void
  // Ausente = sem arrasto (concluídas no popover).
  onMouseDown?: (e: MouseEvent<HTMLElement>) => void
  onHoverChange?: (taskId: string | null) => void
}

export function CompactTaskRow({
  task,
  todayKey,
  projectColor,
  day,
  wrap = false,
  showMissedDate = false,
  cursor,
  inSelection,
  dragging,
  highlighted = false,
  onSelect,
  onMouseDown,
  onHoverChange,
}: CompactTaskRowProps) {
  const { statuses } = useTasksEnv()
  // O React não dispara mouseleave numa linha que desmonta sob o mouse (concluir,
  // apagar, reagendar por teclado, fechar o popover): sem avisar o pai, o hover
  // dele ficaria preso nessa task.
  const hovered = useRef(false)
  const onHoverChangeRef = useRef(onHoverChange)
  onHoverChangeRef.current = onHoverChange
  useEffect(
    () => () => {
      if (hovered.current) onHoverChangeRef.current?.(null)
    },
    []
  )
  const open = isOpen(task)
  const mark = open && day !== null ? deadlineMarkOn(task, day, todayKey) : null
  const late = showMissedDate ? overdueKind(task, todayKey) : null
  const inMyDay = open && task.plannedDay === todayKey
  const hasIcons = inMyDay || (open && task.important) || mark !== null

  return (
    <div
      className={[
        styles.row,
        projectColor === null ? styles.noColor : '',
        wrap ? styles.wrap : '',
        cursor ? styles.cursor : '',
        inSelection ? styles.inSelection : '',
        dragging ? styles.dragging : '',
        highlighted ? styles.highlighted : '',
        isDone(task) ? styles.done : '',
      ].join(' ')}
      style={
        {
          '--st': statusColor(task.status, statuses),
          '--pc': projectColor ?? 'transparent',
        } as CSSProperties
      }
      data-task-id={task.id}
      role="button"
      tabIndex={0}
      title={task.title}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onSelect(e)
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={
        onHoverChange
          ? () => {
              hovered.current = true
              onHoverChange(task.id)
            }
          : undefined
      }
      onMouseLeave={
        onHoverChange
          ? () => {
              hovered.current = false
              onHoverChange(null)
            }
          : undefined
      }
    >
      <span className={styles.sq} aria-hidden />
      <span className={styles.body}>
        <span className={styles.title} data-row-title>
          {task.title}
        </span>
        {late === 'deadline' && task.dueDate && (
          <span className={`${styles.meta} ${styles.metaLate}`} title="Deadline missed">
            <Target size={11} aria-hidden />
            {formatDeadlineDay(task.dueDate, todayKey)}
          </span>
        )}
        {late === 'plan' && task.scheduledDate && (
          <span className={`${styles.meta} ${styles.metaSlip}`} title="Do date passed">
            <CalendarBlank size={11} aria-hidden />
            {formatDeadlineDay(task.scheduledDate, todayKey)}
          </span>
        )}
      </span>
      {hasIcons && (
        <span className={styles.icons}>
          {inMyDay && (
            <span className={styles.accent} title="In My Day today">
              <Sun size={11} weight="fill" aria-hidden />
            </span>
          )}
          {open && task.important && (
            <span className={styles.accent} title="Important">
              <Flag size={11} weight="fill" aria-hidden />
            </span>
          )}
          {mark?.kind === 'due' && (
            <span className={styles.dl} title="Deadline is this day">
              <Target size={11} aria-hidden />
            </span>
          )}
          {mark?.kind === 'after' && (
            <span
              className={`${styles.dl} ${styles.dlAfter}`}
              title={`After deadline (${formatDueShort(task.dueDate!)})`}
            >
              <Target size={11} aria-hidden />+{mark.days}d
            </span>
          )}
          {mark?.kind === 'missed' && (
            <span
              className={`${styles.dl} ${styles.dlMissed}`}
              title={`Deadline missed: ${formatDateLong(task.dueDate!)}`}
            >
              <Target size={11} aria-hidden />
            </span>
          )}
        </span>
      )}
    </div>
  )
}
