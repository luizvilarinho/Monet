import { Fragment, useState, type CSSProperties } from 'react'
import { CalendarBlank, Clock, Flag, Repeat, Sun, Target, Trash } from '@phosphor-icons/react'
import { formatMetadataValue, visibleMetadata } from '../../lib/metadata'
import {
  describeRecurrence,
  formatDueShort,
  formatElapsed,
  isDone,
  isOpen,
  overdueKind,
  SNOOZE_OPTIONS,
  statusColor,
  statusName,
  type ChecklistProgress,
  type SnoozeKind,
} from '../../lib/tasks'
import type { Task } from '../../types'
import { useTasksEnv } from './TasksEnv'
import styles from './TaskCard.module.css'

// Card de task das visões de Tasks (List, Today, Week, Kanban, Projects,
// Groups, Review): bloco de status sólido no topo, deadline à direita, título,
// "Projeto | group", metadados key/value e um rodapé com datas, checklist,
// reagendamentos e ações. Na List vira uma linha (ver `list`).
interface TaskCardProps {
  task: Task
  todayKey: string
  // Linha de contexto; ausente = a visão já diz o projeto.
  projectName?: string
  // Quadradinho antes do nome do projeto (null = contorno).
  projectColor?: string | null
  showGroup?: boolean
  // Falso no Week, onde a coluna já é a data.
  showScheduled?: boolean
  // Kanban: a coluna já é o status; só o quadrado de cor + tempo.
  compactStatus?: boolean
  maxMetadata?: 2 | 3
  // List: linha sem caixa; status e ações (fixas, à direita) na linha de
  // metadados, sob o título; deadline na linha do título; group em roxo.
  list?: boolean
  checklist?: ChecklistProgress | null
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

export function TaskCard({
  task,
  todayKey,
  projectName,
  projectColor = null,
  showGroup = true,
  showScheduled = true,
  compactStatus = false,
  maxMetadata = 3,
  list = false,
  checklist = null,
  selected = false,
  cursor = false,
  inSelection = false,
  onSelect,
  onToggle,
  onDelete,
  onSnooze,
  planned = false,
  onTogglePlan,
}: TaskCardProps) {
  const { statuses, metadataDefs } = useTasksEnv()
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const open = isOpen(task)
  const late = overdueKind(task, todayKey)
  // Tempo no status só existe em `doing` (único com registro de entrada).
  const elapsed =
    task.status === 'doing' && task.doingSince !== null ? formatElapsed(Date.now() - task.doingSince) : null
  const group = showGroup ? task.group : null
  const metadata = visibleMetadata(task, metadataDefs)
  const scheduled =
    showScheduled && task.scheduledDate && task.scheduledDate !== task.dueDate ? task.scheduledDate : null
  const postponed = task.rescheduleCount
  const hasChips =
    scheduled !== null ||
    (checklist !== null && checklist.total > 0) ||
    postponed >= 1 ||
    task.important ||
    task.recurrence !== null
  const hasActions = (open && (onTogglePlan || onSnooze)) || onDelete

  const statusEl = compactStatus ? (
    <span className={styles.stCompact} title={statusName(task.status, statuses)}>
      <span className={styles.stSquare} aria-hidden />
      {elapsed && <span title="Time in this status">{elapsed}</span>}
    </span>
  ) : (
    <span className={list ? styles.statusTag : styles.block}>
      <span className={styles.ellipsis}>{statusName(task.status, statuses)}</span>
      {elapsed && (
        <span className={styles.elapsed} title="Time in this status">
          {elapsed}
        </span>
      )}
    </span>
  )
  const actionsEl = hasActions && (
    <span className={styles.actions}>
      {onTogglePlan && open && (
        <button
          type="button"
          className={`${styles.action} ${planned ? styles.planned : ''}`}
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
      {onSnooze && open && (
        <span
          className={styles.snoozeWrap}
          onMouseDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSnoozeOpen(false)
          }}
        >
          <button
            type="button"
            className={styles.action}
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
          className={`${styles.action} ${styles.deleteAction}`}
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
    </span>
  )
  const dueEl = task.dueDate && (
    <span className={`${styles.due} ${late === 'deadline' ? styles.late : ''}`} title="Deadline">
      <Target size={11} aria-hidden />
      {formatDueShort(task.dueDate)}
    </span>
  )

  return (
    <div
      className={`${styles.card} ${list ? styles.listRow : ''} ${selected ? styles.selected : ''} ${
        cursor ? styles.cursor : ''
      } ${inSelection ? styles.inSelection : ''}`}
      style={{ '--st': statusColor(task.status, statuses) } as CSSProperties}
      data-task-id={task.id}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // Enter nos botões internos (Plan today/Snooze) não abre a task.
        if (e.key === 'Enter' && e.target === e.currentTarget) onSelect(e)
      }}
    >
      {!list && (
        <div className={styles.top}>
          {statusEl}
          {actionsEl}
          {dueEl}
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={isDone(task)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggle(e.target.checked)}
            aria-label="done"
          />
          <span className={`${styles.title} ${open ? '' : styles.titleClosed}`} title={task.title}>
            {task.title}
          </span>
          {list && dueEl}
        </div>
        {(list || projectName || group) && (
          <div className={styles.ctx}>
            {list && statusEl}
            {projectName && (
              <span className={styles.project}>
                <span
                  className={styles.swatch}
                  style={projectColor ? { background: projectColor } : { border: '1px solid var(--text-muted)' }}
                  aria-hidden
                />
                <span className={styles.ellipsis}>{projectName}</span>
              </span>
            )}
            {projectName && group && <span className={styles.sep}>|</span>}
            {group && (
              <span className={`${styles.group} ${list ? styles.groupList : ''} ${styles.ellipsis}`} title={`Group: ${group}`}>
                {group}
              </span>
            )}
            {list && actionsEl}
          </div>
        )}
      </div>
      {metadata.length > 0 && (
        <div className={styles.kv}>
          {metadata.slice(0, maxMetadata).map(({ def, value }) => {
            const text = formatMetadataValue(def, value)
            return (
              <Fragment key={def.id}>
                <span className={styles.k}>{def.name}</span>
                <span className={styles.v} title={text}>
                  {text}
                </span>
              </Fragment>
            )
          })}
          {metadata.length > maxMetadata && (
            <span className={styles.more}>+{metadata.length - maxMetadata} more</span>
          )}
        </div>
      )}
      {hasChips && (
        <div className={styles.foot}>
          {scheduled && (
            <span className={`${styles.chip} ${late === 'plan' ? styles.latePlan : ''}`} title="Do date">
              <CalendarBlank size={11} aria-hidden />
              {formatDueShort(scheduled)}
            </span>
          )}
          {checklist && checklist.total > 0 && (
            <span
              className={`${styles.chip} ${checklist.done === checklist.total ? styles.checklistDone : ''}`}
              title="Checklist"
            >
              {checklist.done}/{checklist.total}
              {checklist.total <= 10 && (
                <span className={styles.bar} aria-hidden>
                  {Array.from({ length: checklist.total }, (_, i) => (
                    <i key={i} className={i < checklist.done ? styles.on : undefined} />
                  ))}
                </span>
              )}
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
        </div>
      )}
    </div>
  )
}
