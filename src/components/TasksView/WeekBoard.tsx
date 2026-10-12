import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  addDaysKey,
  computeTaskSummary,
  formatDueShort,
  isOpen,
  isOverdue,
  planDate,
  startOfWeekKey,
  weekDayKeys,
  type ChecklistProgress,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { TasksHeader, type NewTaskDraft, type TasksMainView } from './TasksHeader'
import { TaskLine } from './TaskLine'
import { TaskBatchBar } from './TaskBatchBar'
import { useCardDrag } from './useCardDrag'
import { useTaskKeyboard, type TaskChanges } from './useTaskKeyboard'
import styles from './WeekBoard.module.css'

// Visão Week na área principal: Overdue | 7 dias da semana | No date.
// Arrastar um card para um dia muda o Do date; para No date limpa o Do date
// (o deadline nunca muda). Overdue e dias passados não aceitam drop.
interface WeekBoardProps {
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  mainView: TasksMainView
  onMainViewChange: (view: TasksMainView) => void
  filter: string | null
  onFilterChange: (notebookId: string | null) => void
  // Chip da faixa de resumo: o App volta para a lista com o filtro aplicado.
  onSummaryFilterChange: (key: TaskSummaryKey | null) => void
  onCreateTask: (draft: NewTaskDraft) => Promise<void>
  onOpenTask: (task: Task) => void
  onToggleTask: (id: string, done: boolean) => void
  onSchedule: (id: string, scheduledDate: string | null) => void
  onUpdateTasks: (changes: TaskChanges) => void
  onConvertPipeTitles: (tasks: Task[]) => void
  checklist: Map<string, ChecklistProgress>
}

const NO_DATE = 'nodate'
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Column {
  key: string
  label: string
  open: Task[]
  done: Task[]
  droppable: boolean
  // Coluna vazia que vira um trilho estreito (Overdue / No date).
  collapsible: boolean
  tone?: 'today' | 'overdue'
}

// Important primeiro, depois `doing`, depois a ordem manual.
function byBoardOrder(a: Task, b: Task): number {
  if (a.important !== b.important) return a.important ? -1 : 1
  if (a.status !== b.status) {
    if (a.status === 'doing') return -1
    if (b.status === 'doing') return 1
  }
  return a.sortOrder - b.sortOrder
}

export function WeekBoard({
  tasks,
  notebooks,
  todayKey,
  mainView,
  onMainViewChange,
  filter,
  onFilterChange,
  onSummaryFilterChange,
  onCreateTask,
  onOpenTask,
  onToggleTask,
  onSchedule,
  onUpdateTasks,
  onConvertPipeTitles,
  checklist,
}: WeekBoardProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(todayKey))
  const currentWeek = startOfWeekKey(todayKey)

  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )
  const projectTasks = useMemo(
    () => (filter === null ? tasks : tasks.filter((t) => t.notebookId === filter)),
    [tasks, filter]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])

  const columns = useMemo((): Column[] => {
    const days = weekDayKeys(weekStart)
    const byDay = new Map(days.map((d) => [d, { open: [] as Task[], done: [] as Task[] }]))
    const overdue: Task[] = []
    const noDate: Task[] = []
    for (const t of projectTasks) {
      if (isOpen(t)) {
        const plan = planDate(t)
        if (isOverdue(t, todayKey)) overdue.push(t)
        else if (plan === null) noDate.push(t)
        else byDay.get(plan)?.open.push(t)
      } else if (t.status === 'done' && t.completedAt !== null) {
        byDay.get(dateKeyFromMs(t.completedAt))?.done.push(t)
      }
    }
    return [
      {
        key: 'overdue',
        label: 'Overdue',
        open: overdue.sort(byBoardOrder),
        done: [],
        droppable: false,
        collapsible: true,
        tone: 'overdue',
      },
      ...days.map((d): Column => {
        const day = byDay.get(d)!
        const date = new Date(`${d}T00:00:00`)
        return {
          key: d,
          label: `${DAY_SHORT[date.getDay()]} ${date.getDate()}`,
          open: day.open.sort(byBoardOrder),
          done: day.done.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0)),
          droppable: d >= todayKey,
          collapsible: false,
          tone: d === todayKey ? 'today' : undefined,
        }
      }),
      {
        key: NO_DATE,
        label: 'No date',
        open: noDate.sort(byBoardOrder),
        done: [],
        droppable: true,
        collapsible: true,
      },
    ]
  }, [projectTasks, weekStart, todayKey])

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const orderedIds = useMemo(
    () => columns.flatMap((c) => [...c.open, ...c.done]).map((t) => t.id),
    [columns]
  )
  const kb = useTaskKeyboard({ orderedIds, tasksById, todayKey, onOpen: onOpenTask, onUpdateTasks })

  const { draggingId, overKey, onCardMouseDown } = useCardDrag((id, dropKey) => {
    const task = tasksById.get(id)
    if (!task) return
    const target = dropKey === NO_DATE ? null : dropKey
    // Soltar na própria coluna não muda nada.
    if (!isOverdue(task, todayKey) && planDate(task) === target) return
    if (task.scheduledDate === target) return
    onSchedule(id, target)
  })

  const rangeLabel = `${formatDueShort(weekStart)} – ${formatDueShort(addDaysKey(weekStart, 6))}`

  function renderCard(t: Task, draggable: boolean) {
    return (
      <div
        key={t.id}
        className={`${styles.card} ${t.id === draggingId ? styles.cardDragging : ''} ${
          draggable ? '' : styles.cardDone
        }`}
        onMouseDown={draggable ? (e) => onCardMouseDown(e, t.id) : undefined}
      >
        <TaskLine
          task={t}
          todayKey={todayKey}
          projectName={filter === null ? notebookNameById.get(t.notebookId) : undefined}
          showDate={false}
          checklist={checklist.get(t.id)}
          lines={3}
          cursor={t.id === kb.cursorId}
          inSelection={kb.selectedIds.has(t.id)}
          onSelect={(e) => {
            if (kb.handleClick(e, t.id)) onOpenTask(t)
          }}
          onToggle={(done) => onToggleTask(t.id, done)}
        />
      </div>
    )
  }

  return (
    <section className={styles.board} {...kb.containerProps} aria-label="week board">
      <div className={styles.top}>
        <TasksHeader
          tasks={tasks}
          notebooks={notebooks}
          todayKey={todayKey}
          mainView={mainView}
          onMainViewChange={onMainViewChange}
          filter={filter}
          onFilterChange={onFilterChange}
          summary={summary}
          summaryFilter={null}
          onSummaryFilterChange={onSummaryFilterChange}
          onCreateTask={onCreateTask}
          onConvertPipeTitles={onConvertPipeTitles}
        />
        <div className={styles.weekNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setWeekStart((w) => addDaysKey(w, -7))}
            aria-label="previous week"
          >
            <CaretLeft size={13} weight="bold" />
          </button>
          <button
            type="button"
            className={`${styles.thisWeek} ${weekStart === currentWeek ? styles.thisWeekActive : ''}`}
            onClick={() => setWeekStart(currentWeek)}
          >
            This week
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setWeekStart((w) => addDaysKey(w, 7))}
            aria-label="next week"
          >
            <CaretRight size={13} weight="bold" />
          </button>
          <span className={styles.range}>{rangeLabel}</span>
        </div>
      </div>
      <div
        className={styles.columns}
        style={{
          gridTemplateColumns: columns
            .map((c) => (c.collapsible && c.open.length === 0 ? '36px' : 'minmax(168px, 1fr)'))
            .join(' '),
        }}
      >
        {columns.map((c) => {
          const rail = c.collapsible && c.open.length === 0
          return (
            <div
              key={c.key}
              data-drop-key={c.droppable ? c.key : undefined}
              className={[
                styles.column,
                rail ? styles.rail : '',
                c.tone === 'today' ? styles.columnToday : '',
                c.tone === 'overdue' ? styles.columnOverdue : '',
                draggingId && overKey === c.key ? styles.columnOver : '',
              ].join(' ')}
            >
              <div className={styles.columnHeader}>
                <span className={styles.columnLabel}>{c.label}</span>
                <span className={styles.columnCount}>{c.open.length}</span>
              </div>
              {!rail && (
                <div className={styles.cards}>
                  {c.open.map((t) => renderCard(t, true))}
                  {c.done.map((t) => renderCard(t, false))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <TaskBatchBar kb={kb} todayKey={todayKey} />
    </section>
  )
}
