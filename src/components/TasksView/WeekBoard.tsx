import { CaretLeft, CaretRight, Eye, EyeSlash } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  addDaysKey,
  computeTaskSummary,
  filterTasksForView,
  formatDueShort,
  isDone,
  isInProgress,
  isOpen,
  isOverdue,
  planDate,
  snoozeDate,
  startOfWeekKey,
  weekDayKeys,
  type ChecklistProgress,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { TasksHeader, type NewTaskDraft } from './TasksHeader'
import { useTasksEnv } from './TasksEnv'
import type { TasksMainView } from './views'
import { TaskCard } from './TaskCard'
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
  onDeleteTasks: (ids: string[]) => void
  onConvertPipeTitles: (tasks: Task[]) => void
  checklist: Map<string, ChecklistProgress>
}

const NO_DATE = 'nodate'
const WEEKEND = 'weekend'
const HIDE_WEEKEND_KEY = 'monet:tasks-week-hide-weekend'
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
  // Trilho do fim de semana oculto (contagem em `open.length`).
  kind?: 'weekend'
}

// Important primeiro, depois `doing`, depois a ordem manual.
function byBoardOrder(a: Task, b: Task): number {
  if (a.important !== b.important) return a.important ? -1 : 1
  const ai = isInProgress(a)
  const bi = isInProgress(b)
  if (ai !== bi) return ai ? -1 : 1
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
  onDeleteTasks,
  onConvertPipeTitles,
  checklist,
}: WeekBoardProps) {
  const [weekStart, setWeekStartState] = useState(() => startOfWeekKey(todayKey))
  const currentWeek = startOfWeekKey(todayKey)
  const [hideWeekend, setHideWeekendState] = useState(() => {
    try {
      return localStorage.getItem(HIDE_WEEKEND_KEY) === '1'
    } catch {
      return false
    }
  })
  // Fim de semana exibido temporariamente (drag segurado sobre o trilho).
  const [peek, setPeek] = useState(false)
  // A semana começa na segunda: days[0] = segunda, days[5] = sábado, days[6] = domingo.
  const days = useMemo(() => weekDayKeys(weekStart), [weekStart])
  const weekendHidden = hideWeekend && !peek

  function setWeekStart(update: (w: string) => string) {
    setWeekStartState(update)
    setPeek(false)
  }

  function setHideWeekend(hide: boolean) {
    setHideWeekendState(hide)
    setPeek(false)
    try {
      localStorage.setItem(HIDE_WEEKEND_KEY, hide ? '1' : '0')
    } catch {
      /* ignorar */
    }
  }

  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )
  const { search } = useTasksEnv()
  const notebookColorById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.color ?? null])),
    [notebooks]
  )
  const projectTasks = useMemo(
    () => filterTasksForView(tasks, filter, search),
    [tasks, filter, search]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])

  const columns = useMemo((): Column[] => {
    const byDay = new Map(days.map((d) => [d, { open: [] as Task[], done: [] as Task[] }]))
    const overdue: Task[] = []
    const noDate: Task[] = []
    for (const t of projectTasks) {
      if (isOpen(t)) {
        const plan = planDate(t)
        if (isOverdue(t, todayKey)) overdue.push(t)
        else if (plan === null) noDate.push(t)
        else byDay.get(plan)?.open.push(t)
      } else if (isDone(t) && t.completedAt !== null) {
        byDay.get(dateKeyFromMs(t.completedAt))?.done.push(t)
      }
    }
    const visibleDays = weekendHidden ? days.slice(0, 5) : days
    const weekendRail: Column[] = weekendHidden
      ? [
          {
            key: WEEKEND,
            label: 'Sat–Sun hidden',
            open: [...byDay.get(days[5])!.open, ...byDay.get(days[6])!.open],
            done: [],
            droppable: false,
            collapsible: false,
            kind: 'weekend',
            // Hoje é sábado/domingo desta semana: o rail sinaliza onde está hoje.
            tone: days[5] === todayKey || days[6] === todayKey ? 'today' : undefined,
          },
        ]
      : []
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
      ...visibleDays.map((d): Column => {
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
      ...weekendRail,
      {
        key: NO_DATE,
        label: 'No date',
        open: noDate.sort(byBoardOrder),
        done: [],
        droppable: true,
        collapsible: true,
      },
    ]
  }, [projectTasks, days, todayKey, weekendHidden])

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const orderedIds = useMemo(
    () =>
      columns
        .filter((c) => c.kind !== 'weekend')
        .flatMap((c) => [...c.open, ...c.done])
        .map((t) => t.id),
    [columns]
  )
  const kb = useTaskKeyboard({
    orderedIds,
    tasksById,
    todayKey,
    onOpen: onOpenTask,
    onUpdateTasks,
    onDeleteTasks,
  })

  const { draggingId, overKey, onCardMouseDown } = useCardDrag((id, dropKey) => {
    const task = tasksById.get(id)
    if (!task || dropKey === WEEKEND) return
    const target = dropKey === NO_DATE ? null : dropKey
    // Soltar na própria coluna não muda nada.
    if (!isOverdue(task, todayKey) && planDate(task) === target) return
    if (task.scheduledDate === target) return
    onSchedule(id, target)
  })

  // Segurar um card ~400ms sobre o trilho expande o fim de semana.
  useEffect(() => {
    if (!draggingId || overKey !== WEEKEND) return
    const timer = setTimeout(() => setPeek(true), 400)
    return () => clearTimeout(timer)
  }, [draggingId, overKey])

  // Ao soltar o card, o fim de semana volta ao estado do toggle.
  useEffect(() => {
    if (!draggingId) setPeek(false)
  }, [draggingId])

  const todayOnHiddenWeekend = columns.some((c) => c.kind === 'weekend' && c.tone === 'today')

  const rangeLabel = weekendHidden
    ? `${formatDueShort(days[0])} – ${formatDueShort(days[4])}`
    : `${formatDueShort(weekStart)} – ${formatDueShort(addDaysKey(weekStart, 6))}`

  function renderCard(t: Task, draggable: boolean) {
    return (
      <div
        key={t.id}
        className={`${styles.card} ${t.id === draggingId ? styles.cardDragging : ''} ${
          draggable ? '' : styles.cardDone
        }`}
        onMouseDown={draggable ? (e) => onCardMouseDown(e, t.id) : undefined}
      >
        <TaskCard
          task={t}
          todayKey={todayKey}
          projectName={filter === null ? notebookNameById.get(t.notebookId) : undefined}
          showScheduled={false}
          projectColor={notebookColorById.get(t.notebookId) ?? null}
          checklist={checklist.get(t.id)}
          cursor={t.id === kb.cursorId}
          inSelection={kb.selectedIds.has(t.id)}
          onSelect={(e) => {
            if (kb.handleClick(e, t.id)) onOpenTask(t)
          }}
          onToggle={(done) => onToggleTask(t.id, done)}
          onDelete={() => void kb.requestDelete([t.id], 'Delete task')}
          onSnooze={(kind) =>
            onUpdateTasks([{ id: t.id, patch: { scheduledDate: snoozeDate(t, kind, todayKey) } }])
          }
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
            onClick={() => setWeekStart(() => currentWeek)}
            title={
              todayOnHiddenWeekend
                ? 'Today is on the hidden weekend. Click the Sat–Sun rail or "Show weekends" to see it'
                : undefined
            }
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
          <button
            type="button"
            className={`${styles.thisWeek} ${styles.weekendToggle} ${hideWeekend ? styles.thisWeekActive : ''}`}
            aria-pressed={hideWeekend}
            title={hideWeekend ? 'Show Saturday and Sunday' : 'Hide Saturday and Sunday'}
            onClick={() => setHideWeekend(!hideWeekend)}
          >
            {hideWeekend ? <Eye size={13} aria-hidden /> : <EyeSlash size={13} aria-hidden />}
            {hideWeekend ? 'Show weekends' : 'Hide weekends'}
          </button>
        </div>
      </div>
      <div
        className={styles.columns}
        style={{
          gridTemplateColumns: columns
            .map((c) =>
              c.kind === 'weekend' || (c.collapsible && c.open.length === 0) ? '36px' : 'minmax(200px, 1fr)'
            )
            .join(' '),
        }}
      >
        {columns.map((c) => {
          if (c.kind === 'weekend') {
            const n = c.open.length
            const hasToday = c.tone === 'today'
            return (
              <button
                key={c.key}
                type="button"
                data-drop-key={WEEKEND}
                className={`${styles.weekendRail} ${hasToday ? styles.weekendRailToday : ''} ${
                  draggingId && overKey === WEEKEND ? styles.columnOver : ''
                }`}
                onClick={() => setHideWeekend(false)}
                title={`${hasToday ? 'Today is hidden here. ' : ''}${n} task${n === 1 ? '' : 's'} on Sat – Sun. Click to show weekends`}
              >
                <span className={`${styles.weekendCount} ${n === 0 ? styles.weekendCountEmpty : ''}`}>{n}</span>
                <span className={styles.weekendLabel}>{hasToday ? `Today · ${c.label}` : c.label}</span>
              </button>
            )
          }
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
                // Durante o arraste, colunas que não aceitam drop (Overdue e dias passados) esmaecem.
                draggingId && !c.droppable ? styles.columnBlocked : '',
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
