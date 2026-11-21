import { Check, Checks, Target } from '@phosphor-icons/react'
import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  addDaysKey,
  BAND_LATER,
  BAND_MISSED,
  BAND_NONE,
  byBoardOrder,
  byTodosId,
  computeTaskSummary,
  deadlineBand,
  deadlineDropDate,
  filterTasksForView,
  formatDueShort,
  isDone,
  isDropped,
  isOpen,
  startOfWeekKey,
  summaryMatches,
  TASK_WINDOW_WEEKS,
  weekWindow,
  WEEKDAY_SHORT,
  type TaskSummaryKey,
} from '../../lib/tasks'
import { loadWorkCapacity } from '../../lib/workCapacity'
import type { Notebook, Task } from '../../types'
import { DragCursorLabel } from './DragCursorLabel'
import { TaskBatchBar } from './TaskBatchBar'
import { TaskCard } from './TaskCard'
import { TasksHeader, type NewTaskDraft } from './TasksHeader'
import { useTasksEnv } from './TasksEnv'
import { useCardDrag } from './useCardDrag'
import { useTaskKeyboard, type TaskChanges } from './useTaskKeyboard'
import type { TasksMainView } from './views'
import weekStyles from './WeekBoard.module.css'
import styles from './DeadlinesBoard.module.css'

// Visão Deadlines na área principal: uma coluna por projeto com task aberta
// (com o filtro de um projeto, uma por TODOS) × faixas pela semana do
// deadline: Missed | This week | Next week | 3 semanas | Later | No deadline.
// Arrastar uma task muda só o deadline e só dentro da própria coluna; o do
// date não muda. Cada faixa tem a altura da célula mais alta (um grid só, com
// cabeçalho e calha fixos); a grade rola e a roda do mouse vale durante o arrasto.
interface DeadlinesBoardProps {
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  mainView: TasksMainView
  onMainViewChange: (view: TasksMainView) => void
  filter: string | null
  onFilterChange: (notebookId: string | null) => void
  // Chip da faixa de resumo: filtra a grade.
  summaryFilter: TaskSummaryKey | null
  onSummaryFilterChange: (key: TaskSummaryKey | null) => void
  onCreateTask: (draft: NewTaskDraft) => Promise<Task | undefined>
  onOpenTask: (task: Task) => void
  onToggleTask: (id: string, done: boolean) => void
  onUpdateTasks: (changes: TaskChanges) => void
  onDeleteTasks: (ids: string[]) => void
  onConvertPipeTitles: (tasks: Task[]) => void
}

// Coluna das tasks sem TODOS (só existe com o filtro de um projeto).
const NO_TODOS = '__none__'
const NO_TASKS: Task[] = []

// Chave da célula (e do drop): `coluna::faixa`. A faixa nunca tem "::".
const CELL_SEP = '::'
const cellKey = (col: string, band: string) => `${col}${CELL_SEP}${band}`
function splitCellKey(key: string): [string, string] {
  const i = key.lastIndexOf(CELL_SEP)
  return [key.slice(0, i), key.slice(i + CELL_SEP.length)]
}

interface Column {
  key: string
  name: string
  // Cor do projeto (null = contorno); colunas de TODOS usam o ícone.
  color: string | null
  todos: boolean
  open: number
  // Concluídas / total sem as descartadas (progresso do cabeçalho).
  done: number
  total: number
}

interface Band {
  key: string
  label: string
  sub: string
  tone: 'missed' | 'this' | null
  // Semana da janela (recebe drop de deadline).
  week: boolean
  // Abertas somadas das colunas (contagem da calha).
  total: number
  // Sem nada (abertas ou "N done"): faixa fina de 28px.
  thin: boolean
}

export function DeadlinesBoard({
  tasks,
  notebooks,
  todayKey,
  mainView,
  onMainViewChange,
  filter,
  onFilterChange,
  summaryFilter,
  onSummaryFilterChange,
  onCreateTask,
  onOpenTask,
  onToggleTask,
  onUpdateTasks,
  onDeleteTasks,
  onConvertPipeTitles,
}: DeadlinesBoardProps) {
  const { search, todosById } = useTasksEnv()
  // Dias de trabalho do Settings: definem o "último dia de trabalho" ao soltar.
  const workDays = useMemo(() => loadWorkCapacity().workDays, [])
  const projectTasks = useMemo(
    () => filterTasksForView(tasks, filter, search, todosById),
    [tasks, filter, search, todosById]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])
  const shownTasks = useMemo(
    () => (summaryFilter ? projectTasks.filter((t) => summaryMatches(summaryFilter, t, todayKey)) : projectTasks),
    [projectTasks, summaryFilter, todayKey]
  )

  // Coluna da task: o projeto; com o filtro de um projeto, a TODOS dela.
  const colKeyOf = useCallback(
    (t: Task) =>
      filter === null ? t.notebookId : t.parentNoteId && todosById.has(t.parentNoteId) ? t.parentNoteId : NO_TODOS,
    [filter, todosById]
  )

  const columns = useMemo((): Column[] => {
    const stats = new Map<string, { open: number; done: number; total: number }>()
    const openTasks: Task[] = []
    for (const t of shownTasks) {
      if (isDropped(t)) continue
      const key = colKeyOf(t)
      const s = stats.get(key) ?? { open: 0, done: 0, total: 0 }
      s.total++
      if (isDone(t)) s.done++
      else {
        s.open++
        openTasks.push(t)
      }
      stats.set(key, s)
    }
    const column = (key: string, name: string, color: string | null, todos: boolean): Column => ({
      key,
      name,
      color,
      todos,
      ...stats.get(key)!,
    })
    if (filter !== null) {
      // As TODOS do projeto em ordem alfabética, "No TODOS" no fim.
      return [...byTodosId(openTasks, todosById).keys()].map((id) =>
        id === null
          ? column(NO_TODOS, 'No TODOS', null, true)
          : column(id, todosById.get(id)?.title.trim() || 'Untitled', null, true)
      )
    }
    // Os cadernos na ordem da lista; ids desconhecidos ("unnamed") depois.
    const known = new Set(notebooks.map((nb) => nb.id))
    const projects = [
      ...notebooks.map((nb) => ({ id: nb.id, name: nb.name || 'unnamed', color: nb.color ?? null })),
      ...[...stats.keys()].filter((id) => !known.has(id)).map((id) => ({ id, name: 'unnamed', color: null })),
    ]
    return projects
      .filter((p) => (stats.get(p.id)?.open ?? 0) > 0)
      .map((p) => column(p.id, p.name, p.color, false))
  }, [shownTasks, colKeyOf, filter, notebooks, todosById])

  // Abertas por célula (pelo deadline, depois a ordem das outras visões) e as
  // concluídas por célula de semana (a semana do deadline delas: "N done").
  const { cells, doneCells } = useMemo(() => {
    const cells = new Map<string, Task[]>()
    const doneCells = new Map<string, Task[]>()
    for (const t of shownTasks) {
      if (isOpen(t)) {
        const key = cellKey(colKeyOf(t), deadlineBand(t, todayKey))
        cells.set(key, [...(cells.get(key) ?? []), t])
      } else if (isDone(t) && t.dueDate !== null) {
        const key = cellKey(colKeyOf(t), startOfWeekKey(t.dueDate))
        doneCells.set(key, [...(doneCells.get(key) ?? []), t])
      }
    }
    for (const list of cells.values()) {
      list.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || byBoardOrder(a, b))
    }
    return { cells, doneCells }
  }, [shownTasks, colKeyOf, todayKey])

  const bands = useMemo((): Band[] => {
    const weeks = weekWindow(todayKey, TASK_WINDOW_WEEKS).map((w) => w[0])
    const lastDay = addDaysKey(weeks[weeks.length - 1], 6)
    const range = (ws: string) => `${formatDueShort(ws)} – ${formatDueShort(addDaysKey(ws, 6))}`
    const defs: Array<Pick<Band, 'key' | 'label' | 'sub' | 'tone' | 'week'>> = [
      { key: BAND_MISSED, label: 'Missed', sub: 'past deadline', tone: 'missed', week: false },
      ...weeks.map((ws, n) => ({
        key: ws,
        label: n === 0 ? 'This week' : n === 1 ? 'Next week' : range(ws),
        sub: n < 2 ? range(ws) : '',
        tone: n === 0 ? ('this' as const) : null,
        week: true,
      })),
      { key: BAND_LATER, label: 'Later', sub: `after ${formatDueShort(lastDay)}`, tone: null, week: false },
      { key: BAND_NONE, label: 'No deadline', sub: '', tone: null, week: false },
    ]
    return defs
      .map((def): Band => {
        let total = 0
        let done = 0
        for (const c of columns) {
          total += cells.get(cellKey(c.key, def.key))?.length ?? 0
          done += doneCells.get(cellKey(c.key, def.key))?.length ?? 0
        }
        return { ...def, total, thin: total === 0 && done === 0 }
      })
      .filter((b) => b.key !== BAND_MISSED || b.total > 0)
  }, [todayKey, columns, cells, doneCells])

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  // Ordem do teclado: coluna a coluna, faixa a faixa.
  const orderedIds = useMemo(() => {
    const ids: string[] = []
    for (const c of columns) {
      for (const b of bands) for (const t of cells.get(cellKey(c.key, b.key)) ?? NO_TASKS) ids.push(t.id)
    }
    return ids
  }, [columns, bands, cells])
  const kb = useTaskKeyboard({
    orderedIds,
    tasksById,
    todayKey,
    onOpen: onOpenTask,
    onUpdateTasks,
    onDeleteTasks,
  })

  // Soltar muda só o deadline (o do date fica; se passar do deadline novo, a
  // barra de Undo avisa). Só as células de semana e "No deadline" da coluna da
  // própria task têm drop key.
  const { draggingId, overKey, onCardMouseDown } = useCardDrag((id, key) => {
    const task = tasksById.get(id)
    if (!task) return
    const [col, band] = splitCellKey(key)
    if (col !== colKeyOf(task) || band === deadlineBand(task, todayKey)) return
    const next = band === BAND_NONE ? null : deadlineDropDate(task, band, todayKey, workDays)
    if (next === task.dueDate) return
    const note =
      next !== null && task.scheduledDate !== null && task.scheduledDate > next
        ? `The do date (${formatDueShort(task.scheduledDate)}) is now after it.`
        : undefined
    kb.actions.update(
      [{ id, patch: { dueDate: next } }],
      next === null ? 'deadline cleared' : `deadline moved to ${formatDueShort(next)}`,
      note ? { note } : undefined
    )
  })

  // A roda do mouse rola a grade com a task no ar (nada a intercepta). O
  // useCardDrag só recalcula o alvo no mousemove, então, depois de rolar com o
  // mouse parado, a grade repete o último movimento para o alvo não ficar velho.
  // A posição vem de um listener sempre ligado: um ligado só com `draggingId`
  // entraria depois do render que segue o 1º movimento do arrasto e perderia a
  // posição dele (a roda pode vir antes do 2º movimento).
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const track = (e: MouseEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY }
    }
    document.addEventListener('mousemove', track)
    return () => document.removeEventListener('mousemove', track)
  }, [])
  function onGridScroll() {
    const p = lastPointer.current
    if (draggingId && p) document.dispatchEvent(new MouseEvent('mousemove', { clientX: p.x, clientY: p.y }))
  }

  const dragged = draggingId ? (tasksById.get(draggingId) ?? null) : null
  const draggedCol = dragged ? colKeyOf(dragged) : null
  const draggedBand = dragged ? deadlineBand(dragged, todayKey) : null
  const overBand = draggingId && overKey !== null ? splitCellKey(overKey)[1] : null

  // Rótulo junto ao cursor: o deadline que a task recebe na faixa sob ele.
  let cursorText: string | null = null
  if (dragged && overBand !== null) {
    if (overBand === BAND_NONE) cursorText = 'No deadline'
    else {
      const date = deadlineDropDate(dragged, overBand, todayKey, workDays)
      cursorText = `${WEEKDAY_SHORT[new Date(`${date}T00:00:00`).getDay()]}, ${formatDueShort(date)}`
    }
  }

  function renderTask(t: Task) {
    return (
      <div
        key={t.id}
        className={`${styles.item} ${t.id === draggingId ? styles.itemDragging : ''}`}
        onMouseDown={(e) => onCardMouseDown(e, t.id)}
      >
        <TaskCard
          task={t}
          todayKey={todayKey}
          list
          deadlinesCell
          showTodos={filter === null}
          cursor={t.id === kb.cursorId}
          inSelection={kb.selectedIds.has(t.id)}
          onSelect={(e) => {
            if (kb.handleClick(e, t.id)) onOpenTask(t)
          }}
          onToggle={(done) => kb.toggleTask(t.id, done, () => onToggleTask(t.id, done))}
        />
      </div>
    )
  }

  return (
    <section className={weekStyles.board} {...kb.containerProps} aria-label="deadlines board">
      <div className={weekStyles.top}>
        <TasksHeader
          tasks={tasks}
          notebooks={notebooks}
          todayKey={todayKey}
          mainView={mainView}
          onMainViewChange={onMainViewChange}
          filter={filter}
          onFilterChange={onFilterChange}
          summary={summary}
          summaryFilter={summaryFilter}
          onSummaryFilterChange={onSummaryFilterChange}
          onCreateTask={onCreateTask}
          onOpenTask={onOpenTask}
          onConvertPipeTitles={onConvertPipeTitles}
        />
      </div>
      <div
        className={styles.grid}
        style={{
          gridTemplateColumns: columns.length ? `104px repeat(${columns.length}, minmax(200px, 1fr))` : '104px 1fr',
        }}
        onScroll={onGridScroll}
      >
        <div className={styles.corner} title="Rows are weeks, by the task deadline">
          <Target size={11} aria-hidden />
          Deadline
        </div>
        {columns.length === 0 && <div className={`${styles.head} ${styles.lastCol}`} />}
        {columns.map((c, n) => (
          <div
            key={c.key}
            className={`${styles.head} ${n === columns.length - 1 ? styles.lastCol : ''} ${
              draggingId && c.key !== draggedCol ? styles.headBlocked : ''
            }`}
          >
            {c.todos ? (
              <span className={styles.todosIcon}>
                <Checks size={13} aria-hidden />
              </span>
            ) : (
              <span
                className={`${styles.dot} ${c.color ? '' : styles.dotNone}`}
                style={c.color ? { background: c.color } : undefined}
              />
            )}
            <span className={styles.name} title={c.name}>
              {c.name}
            </span>
            <span className={styles.count}>{c.open}</span>
            <span className={styles.prog} title="Done / total tasks (dropped not counted)">
              {c.done}/{c.total}
            </span>
            <span className={styles.bar} aria-hidden>
              <i style={{ width: `${c.total > 0 ? (c.done / c.total) * 100 : 0}%` }} />
            </span>
          </div>
        ))}
        {bands.map((band) => (
          <Fragment key={band.key}>
            <div
              className={`${styles.gut} ${band.tone === 'missed' ? styles.gutMissed : ''} ${
                band.tone === 'this' ? styles.gutThis : ''
              } ${band.thin ? styles.thin : ''} ${draggingId && overBand === band.key ? styles.gutOver : ''}`}
              title={band.tone === 'missed' ? 'Deadline before today, even with a new do date' : undefined}
            >
              <div className={styles.gl}>
                <span>{band.label}</span>
                {band.total > 0 && <span className={styles.gc}>{band.total}</span>}
              </div>
              {!band.thin && band.sub && <div className={styles.gs}>{band.sub}</div>}
            </div>
            {(columns.length ? columns : [null]).map((c, n) => {
              const last = n === Math.max(columns.length, 1) - 1
              if (!c) {
                return <div key="empty" className={`${styles.cell} ${styles.lastCol} ${band.thin ? styles.thin : ''}`} />
              }
              const key = cellKey(c.key, band.key)
              const list = cells.get(key) ?? NO_TASKS
              const done = doneCells.get(key) ?? NO_TASKS
              const source = c.key === draggedCol && band.key === draggedBand
              const accepts =
                dragged !== null &&
                c.key === draggedCol &&
                band.key !== draggedBand &&
                (band.week || band.key === BAND_NONE)
              return (
                <div
                  key={c.key}
                  data-drop-key={accepts ? key : undefined}
                  className={[
                    styles.cell,
                    last ? styles.lastCol : '',
                    band.thin ? styles.thin : '',
                    band.tone === 'missed' ? styles.cellMissed : '',
                    accepts ? styles.cellTarget : '',
                    draggingId && overKey === key ? styles.cellOver : '',
                    // Com a task no ar, o que não recebe drop esmaece (a célula de origem não).
                    draggingId && !accepts && !source ? styles.dim : '',
                  ].join(' ')}
                >
                  {list.map(renderTask)}
                  {done.length > 0 && (
                    <span className={styles.doneCount} title={done.map((t) => t.title).join(', ')}>
                      <Check size={11} aria-hidden />
                      {done.length} done
                    </span>
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      <TaskBatchBar kb={kb} todayKey={todayKey} />
      <DragCursorLabel active={draggingId !== null} text={cursorText} tone="accent" />
    </section>
  )
}
