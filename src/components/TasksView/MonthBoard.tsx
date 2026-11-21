import { CaretLeft, CaretRight, Eye, EyeSlash } from '@phosphor-icons/react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  addDaysKey,
  byBoardOrder,
  computeTaskSummary,
  deadlineAlongPatch,
  filterTasksForView,
  formatDateLong,
  formatDueShort,
  isDone,
  isOpen,
  openDeadlinesByDay,
  planCellOf,
  PLAN_NODATE,
  PLAN_OVERDUE,
  startOfWeekKey,
  summaryMatches,
  TASK_WINDOW_WEEKS,
  weekWindow,
  WEEKDAY_SHORT,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { CompactTaskRow } from './CompactTaskRow'
import { DragCursorLabel } from './DragCursorLabel'
import { MonthDayCell } from './MonthDayCell'
import { MonthDayPopover } from './MonthDayPopover'
import { TasksHeader, type NewTaskDraft } from './TasksHeader'
import { TaskBatchBar } from './TaskBatchBar'
import { useTasksEnv } from './TasksEnv'
import { useCardDrag } from './useCardDrag'
import type { UndoOptions } from './useTaskActions'
import { useTaskKeyboard, type TaskChanges } from './useTaskKeyboard'
import { useWeekendPeek, useWeekendToggle, WEEKEND_RAIL_KEY } from './useWeekendToggle'
import type { TasksMainView } from './views'
import weekStyles from './WeekBoard.module.css'
import styles from './MonthBoard.module.css'

// Visão Month na área principal: bandeja (Overdue e No date) | grade de 5
// semanas a partir da atual (linhas = semanas seg–dom, colunas = dias).
// Arrastar uma task para um dia grava o do date; para No date limpa o do date.
// Com a task no ar, o dia do deadline dela fica marcado e os dias depois dele
// hachurados. Dia passado e Overdue não aceitam drop.
interface MonthBoardProps {
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  mainView: TasksMainView
  onMainViewChange: (view: TasksMainView) => void
  filter: string | null
  onFilterChange: (notebookId: string | null) => void
  // Chip da faixa de resumo: filtra a grade e a bandeja.
  summaryFilter: TaskSummaryKey | null
  onSummaryFilterChange: (key: TaskSummaryKey | null) => void
  onCreateTask: (draft: NewTaskDraft) => Promise<Task | undefined>
  onOpenTask: (task: Task) => void
  onUpdateTasks: (changes: TaskChanges) => void
  onDeleteTasks: (ids: string[]) => void
  onConvertPipeTitles: (tasks: Task[]) => void
}

// Bandeja: 'auto' abre com algo a agendar; as outras duas são escolha do usuário.
type TrayMode = 'auto' | 'open' | 'closed'
const TRAY_KEY = 'monet:tasks-month-tray'

function loadTrayMode(): TrayMode {
  try {
    const stored = localStorage.getItem(TRAY_KEY)
    if (stored === 'open' || stored === 'closed') return stored
  } catch {
    /* cai no automático */
  }
  return 'auto'
}

const NO_TASKS: Task[] = []
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export function MonthBoard({
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
  onUpdateTasks,
  onDeleteTasks,
  onConvertPipeTitles,
}: MonthBoardProps) {
  const currentWeek = startOfWeekKey(todayKey)
  const [weekStart, setWeekStartState] = useState(currentWeek)
  const { hideWeekend, setHideWeekend, weekendHidden, setPeek } = useWeekendToggle()
  const [trayMode, setTrayModeState] = useState<TrayMode>(loadTrayMode)
  const [popover, setPopover] = useState<{ day: string; anchor: DOMRect } | null>(null)
  // Task sob o mouse (marca o dia do deadline dela) e dia do "N due" sob o
  // mouse (realça as tasks que vencem nele). Valem só fora do arrasto.
  const [hoverTaskId, setHoverTaskId] = useState<string | null>(null)
  const [hoverDueDay, setHoverDueDay] = useState<string | null>(null)

  // Virada do dia com o app aberto: a 1ª linha volta a ser a semana de hoje.
  useEffect(() => setWeekStartState(startOfWeekKey(todayKey)), [todayKey])

  function setWeekStart(update: (w: string) => string) {
    setWeekStartState(update)
    setPeek(false)
  }

  function setTrayMode(mode: TrayMode) {
    setTrayModeState(mode)
    try {
      localStorage.setItem(TRAY_KEY, mode)
    } catch {
      /* ignorar */
    }
  }

  const weeks = useMemo(() => weekWindow(weekStart, TASK_WINDOW_WEEKS), [weekStart])
  const lastDay = weeks[TASK_WINDOW_WEEKS - 1][6]

  const notebookColorById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.color ?? null])),
    [notebooks]
  )
  const { search, todosById } = useTasksEnv()
  const projectTasks = useMemo(
    () => filterTasksForView(tasks, filter, search, todosById),
    [tasks, filter, search, todosById]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])
  const shownTasks = useMemo(
    () => (summaryFilter ? projectTasks.filter((t) => summaryMatches(summaryFilter, t, todayKey)) : projectTasks),
    [projectTasks, summaryFilter, todayKey]
  )

  // Onde cada task aparece: bandeja (overdue / sem data), um dia, ou "later"
  // (plano depois do último dia da janela). Concluídas só contam no dia da conclusão.
  const plan = useMemo(() => {
    const overdue: Task[] = []
    const noDate: Task[] = []
    const later: Array<{ task: Task; key: string }> = []
    const openByDay = new Map<string, Task[]>()
    const doneByDay = new Map<string, Task[]>()
    for (const t of shownTasks) {
      if (isOpen(t)) {
        const key = planCellOf(t, todayKey)
        if (key === PLAN_OVERDUE) overdue.push(t)
        else if (key === PLAN_NODATE) noDate.push(t)
        else {
          openByDay.set(key, [...(openByDay.get(key) ?? []), t])
          if (key > lastDay) later.push({ task: t, key })
        }
      } else if (isDone(t) && t.completedAt !== null) {
        const key = dateKeyFromMs(t.completedAt)
        doneByDay.set(key, [...(doneByDay.get(key) ?? []), t])
      }
    }
    for (const list of openByDay.values()) list.sort(byBoardOrder)
    for (const list of doneByDay.values()) list.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
    later.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : byBoardOrder(a.task, b.task)))
    return {
      overdue: overdue.sort(byBoardOrder),
      noDate: noDate.sort(byBoardOrder),
      later,
      openByDay,
      doneByDay,
    }
  }, [shownTasks, todayKey, lastDay])

  // Deadlines abertos de cada dia (marcador "N due" do cabeçalho do dia).
  const dueByDay = useMemo(() => openDeadlinesByDay(shownTasks), [shownTasks])
  // O "N due" que some sob o mouse (o último deadline do dia foi concluído ou
  // mudou) não dispara mouseleave: sem deadline aberto no dia, o realce acaba.
  const dueHoverDay = hoverDueDay !== null && dueByDay.has(hoverDueDay) ? hoverDueDay : null

  const trayOpen = trayMode === 'open' || (trayMode === 'auto' && plan.overdue.length + plan.noDate.length > 0)

  // Rótulos dos dias: a 1ª linha traz o dia da semana; o mês aparece na 1ª
  // célula e no 1º dia visível de cada mês.
  const dayLabels = useMemo(() => {
    const labels = new Map<string, { label: string; monthStart: boolean }>()
    let prevMonth = -1
    weeks.forEach((days, w) => {
      days.forEach((day, d) => {
        if (weekendHidden && d >= 5) return
        const date = new Date(`${day}T00:00:00`)
        const newMonth = date.getMonth() !== prevMonth
        prevMonth = date.getMonth()
        const weekday = WEEKDAY_SHORT[date.getDay()]
        const label = newMonth
          ? `${w === 0 ? `${weekday}, ` : ''}${formatDueShort(day)}`
          : `${w === 0 ? `${weekday} ` : ''}${date.getDate()}`
        labels.set(day, { label, monthStart: newMonth && !(w === 0 && d === 0) })
      })
    })
    return labels
  }, [weeks, weekendHidden])

  // Ordem do teclado: Overdue, os dias visíveis semana a semana (inclusive as
  // tasks escondidas atrás do "+N more") e No date. Fim de semana oculto e
  // bandeja recolhida ficam fora.
  const orderedIds = useMemo(() => {
    const ids: string[] = []
    if (trayOpen) for (const t of plan.overdue) ids.push(t.id)
    for (const days of weeks) {
      days.forEach((day, d) => {
        if (weekendHidden && d >= 5) return
        for (const t of plan.openByDay.get(day) ?? NO_TASKS) ids.push(t.id)
      })
    }
    if (trayOpen) for (const t of plan.noDate) ids.push(t.id)
    return ids
  }, [plan, weeks, weekendHidden, trayOpen])

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
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
    // Soltar na própria célula não muda nada.
    if (!task || dropKey === WEEKEND_RAIL_KEY || planCellOf(task, todayKey) === dropKey) return
    const date = dropKey === PLAN_NODATE ? null : dropKey
    const due = task.dueDate !== null && task.dueDate >= todayKey ? task.dueDate : null
    let options: UndoOptions | undefined
    if (date !== null && due !== null && date > due) {
      // Depois de um deadline que ainda não passou: aceita; a barra oferece levar o deadline junto.
      options = {
        note: `It's after the deadline (${formatDueShort(due)}).`,
        extra: {
          label: 'Move deadline too',
          message: 'Task moved, deadline too.',
          changes: [{ id, patch: deadlineAlongPatch(task, date, todayKey) }],
        },
      }
    } else if (date === null && due !== null && task.scheduledDate !== null) {
      options = { note: `Still on its deadline day (${formatDueShort(due)}).` }
    }
    void kb.actions.reschedule([{ id, date }], 'moved', options)
  })
  useWeekendPeek(draggingId, overKey, setPeek)
  // O arrasto que começa num popover já o fechou (o fantasma é clonado antes).
  useEffect(() => {
    if (draggingId) setPopover(null)
  }, [draggingId])

  // Deadline da task no ar (ou sob o mouse): o dia dele ganha a barra; no
  // arrasto, os dias depois dele ficam hachurados.
  const dragged = draggingId ? (tasksById.get(draggingId) ?? null) : null
  const draggedDeadline = dragged?.dueDate && dragged.dueDate >= todayKey ? dragged.dueDate : null
  const hoverDeadline = !draggingId && hoverTaskId ? (tasksById.get(hoverTaskId)?.dueDate ?? null) : null

  let cursorText: string | null = null
  let cursorTone: 'default' | 'late' | 'danger' = 'default'
  if (dragged?.dueDate) {
    if (dragged.dueDate < todayKey) {
      cursorText = formatDueShort(dragged.dueDate)
      cursorTone = 'danger'
    } else if (overKey !== null && DAY_KEY.test(overKey) && overKey > dragged.dueDate) {
      cursorText = 'After deadline'
      cursorTone = 'late'
    } else {
      cursorText = formatDueShort(dragged.dueDate)
    }
  }

  const popOpen = popover ? (plan.openByDay.get(popover.day) ?? NO_TASKS) : NO_TASKS
  const popDone = popover ? (plan.doneByDay.get(popover.day) ?? NO_TASKS) : NO_TASKS
  const popoverEmpty = popover !== null && popOpen.length === 0 && popDone.length === 0
  useEffect(() => {
    if (popoverEmpty) setPopover(null)
  }, [popoverEmpty])

  function openList(day: string, anchor: HTMLElement) {
    const cell = anchor.closest('[data-day]') ?? anchor
    setPopover((prev) => (prev?.day === day ? null : { day, anchor: cell.getBoundingClientRect() }))
  }

  function renderRow(t: Task, day: string | null, wrap: boolean, showMissedDate = false) {
    return (
      <CompactTaskRow
        key={t.id}
        task={t}
        todayKey={todayKey}
        projectColor={notebookColorById.get(t.notebookId) ?? null}
        day={day}
        wrap={wrap}
        showMissedDate={showMissedDate}
        cursor={t.id === kb.cursorId}
        inSelection={kb.selectedIds.has(t.id)}
        dragging={t.id === draggingId}
        highlighted={!draggingId && dueHoverDay !== null && t.dueDate === dueHoverDay}
        onSelect={(e) => {
          if (kb.handleClick(e, t.id)) {
            // O modal da task cobre a grade: o popover do dia não pode ficar por cima dele.
            setPopover(null)
            onOpenTask(t)
          }
        }}
        onMouseDown={isOpen(t) ? (e) => onCardMouseDown(e, t.id) : undefined}
        onHoverChange={setHoverTaskId}
      />
    )
  }

  const todayOnHiddenWeekend = weekendHidden && [0, 6].includes(new Date(`${todayKey}T00:00:00`).getDay())
  const firstDay = weeks[0][0]
  const lastVisible = weeks[TASK_WINDOW_WEEKS - 1][weekendHidden ? 4 : 6]
  const rangeLabel = `${formatDueShort(firstDay)} – ${formatDueShort(lastVisible)}`
  const nextLater = plan.later[0]?.key ?? null

  const controls = (
    <>
      <button
        type="button"
        className={weekStyles.navBtn}
        onClick={() => setWeekStart((w) => addDaysKey(w, -7))}
        aria-label="previous week"
        title="Previous week"
      >
        <CaretLeft size={13} weight="bold" />
      </button>
      <button
        type="button"
        className={`${weekStyles.thisWeek} ${weekStart === currentWeek ? weekStyles.thisWeekActive : ''}`}
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
        className={weekStyles.navBtn}
        onClick={() => setWeekStart((w) => addDaysKey(w, 7))}
        aria-label="next week"
        title="Next week"
      >
        <CaretRight size={13} weight="bold" />
      </button>
      <span className={weekStyles.range}>{rangeLabel}</span>
      {nextLater !== null && (
        <button
          type="button"
          className={`${weekStyles.thisWeek} ${styles.later}`}
          onClick={() => setWeekStart(() => startOfWeekKey(nextLater))}
          title={`Planned after this window. Next: ${formatDateLong(nextLater)}`}
        >
          {plan.later.length} later
          <CaretRight size={11} aria-hidden />
        </button>
      )}
      <button
        type="button"
        className={`${weekStyles.thisWeek} ${weekStyles.weekendToggle} ${hideWeekend ? weekStyles.thisWeekActive : ''}`}
        aria-pressed={hideWeekend}
        title={hideWeekend ? 'Show Saturday and Sunday' : 'Hide Saturday and Sunday'}
        onClick={() => setHideWeekend(!hideWeekend)}
      >
        {hideWeekend ? <Eye size={13} aria-hidden /> : <EyeSlash size={13} aria-hidden />}
        {hideWeekend ? 'Show weekends' : 'Hide weekends'}
      </button>
    </>
  )

  const collapseButton = (
    <button
      type="button"
      className={styles.collapse}
      onClick={() => setTrayMode('closed')}
      aria-label="collapse tray"
      title="Collapse"
    >
      <CaretLeft size={12} aria-hidden />
    </button>
  )

  function renderTray() {
    if (!trayOpen) {
      const overdueCount = plan.overdue.length
      const noDateCount = plan.noDate.length
      // Reabrir com tasks a agendar volta ao automático (esvaziar a bandeja a recolhe de
      // novo, F2.8); só uma bandeja vazia aberta de propósito fica fixa em 'open'.
      const reopenMode: TrayMode = overdueCount + noDateCount > 0 ? 'auto' : 'open'
      return (
        <button
          type="button"
          data-drop-key={PLAN_NODATE}
          className={`${styles.trail} ${draggingId && overKey === PLAN_NODATE ? styles.trailOver : ''}`}
          onClick={() => setTrayMode(reopenMode)}
          title={`${overdueCount} overdue · ${noDateCount} with no date. Click to open`}
        >
          {overdueCount > 0 && (
            <>
              <span className={`${styles.trailCount} ${styles.trailCountHas} ${styles.trailCountDanger}`}>
                {overdueCount}
              </span>
              <span className={`${styles.trailLabel} ${styles.trailLabelDanger}`}>Overdue</span>
              <span className={styles.trailGap} />
            </>
          )}
          <span className={`${styles.trailCount} ${noDateCount > 0 ? styles.trailCountHas : ''}`}>
            {noDateCount}
          </span>
          <span className={styles.trailLabel}>No date</span>
        </button>
      )
    }
    return (
      <aside className={styles.tray} aria-label="tasks to schedule">
        {plan.overdue.length > 0 && (
          <section className={`${styles.traySection} ${styles.overdue} ${draggingId ? styles.blocked : ''}`}>
            <div className={styles.trayHead}>
              <span className={styles.trayLabel}>Overdue</span>
              <span className={styles.trayCount}>{plan.overdue.length}</span>
              {collapseButton}
            </div>
            {plan.overdue.map((t) => renderRow(t, null, true, true))}
          </section>
        )}
        <section
          data-drop-key={PLAN_NODATE}
          className={`${styles.traySection} ${styles.noDate} ${
            draggingId && overKey === PLAN_NODATE ? styles.trayOver : ''
          }`}
        >
          <div className={styles.trayHead}>
            <span className={styles.trayLabel}>No date</span>
            <span className={styles.trayCount}>{plan.noDate.length}</span>
            {plan.overdue.length === 0 && collapseButton}
          </div>
          {plan.noDate.map((t) => renderRow(t, null, true))}
          {draggingId && <div className={styles.hint}>Drop here to clear the do date</div>}
        </section>
      </aside>
    )
  }

  return (
    <section
      className={`${weekStyles.board} ${styles.monthBoard}`}
      {...kb.containerProps}
      aria-label="month board"
    >
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
          controls={controls}
        />
      </div>
      <div className={styles.month}>
        {renderTray()}
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: weekendHidden
              ? 'repeat(5, minmax(0, 1fr)) 36px'
              : 'repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 0.62fr))',
          }}
        >
          {weeks.map((days, w) => {
            const sat = days[5]
            const sun = days[6]
            const railCount = (plan.openByDay.get(sat)?.length ?? 0) + (plan.openByDay.get(sun)?.length ?? 0)
            const railToday = sat === todayKey || sun === todayKey
            return (
              <Fragment key={days[0]}>
                {days.map((day, d) => {
                  if (weekendHidden && d >= 5) return null
                  const { label, monthStart } = dayLabels.get(day)!
                  return (
                    <MonthDayCell
                      key={day}
                      day={day}
                      label={label}
                      monthStart={monthStart}
                      todayKey={todayKey}
                      open={plan.openByDay.get(day) ?? NO_TASKS}
                      doneCount={plan.doneByDay.get(day)?.length ?? 0}
                      due={dueByDay.get(day) ?? NO_TASKS}
                      droppable={day >= todayKey}
                      over={draggingId !== null && overKey === day}
                      dragging={draggingId !== null}
                      deadlineDay={draggedDeadline === day}
                      deadlineHover={hoverDeadline === day}
                      afterDeadline={draggedDeadline !== null && day > draggedDeadline}
                      weekend={d >= 5}
                      renderRow={(t, wrap) => renderRow(t, day, wrap)}
                      onOpenList={openList}
                      onDueHover={setHoverDueDay}
                    />
                  )
                })}
                {weekendHidden && (
                  <button
                    type="button"
                    data-drop-key={WEEKEND_RAIL_KEY}
                    className={`${styles.weekRail} ${railToday ? styles.weekRailToday : ''} ${
                      draggingId && overKey === WEEKEND_RAIL_KEY ? styles.weekRailOver : ''
                    }`}
                    onClick={() => setHideWeekend(false)}
                    title={`${railToday ? 'Today is hidden here. ' : ''}${railCount} task${
                      railCount === 1 ? '' : 's'
                    } on Sat – Sun. Click to show weekends`}
                  >
                    {railCount > 0 && <span className={weekStyles.weekendCount}>{railCount}</span>}
                    {(w === 0 || railToday) && (
                      <span className={styles.weekRailLabel}>{railToday ? 'Today' : 'Sat–Sun'}</span>
                    )}
                  </button>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
      {/* Sobreposta à grade: no fluxo, a barra encolheria a grade por 6s e as células refariam as linhas.
          Com uma task no ar o ponteiro atravessa a barra: o drop na faixa de baixo da 5ª semana vale. */}
      <div className={`${styles.barSlot} ${draggingId ? styles.barSlotPass : ''}`}>
        <TaskBatchBar kb={kb} todayKey={todayKey} />
      </div>
      {popover && !popoverEmpty && (
        <MonthDayPopover
          day={popover.day}
          anchor={popover.anchor}
          open={popOpen}
          done={popDone}
          renderRow={(t) => renderRow(t, popover.day, true)}
          onClose={() => setPopover(null)}
        />
      )}
      <DragCursorLabel active={draggingId !== null} text={cursorText} tone={cursorTone} />
    </section>
  )
}
