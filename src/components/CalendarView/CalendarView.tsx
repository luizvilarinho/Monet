import { CaretLeft, CaretRight, SidebarSimple } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note, Notebook, Task } from '../../types'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs, toDateKey } from '../../lib/calendar'
import {
  formatDueShort,
  INBOX_NOTEBOOK_ID,
  isOverdue,
  taskSpan,
  type ProjectChoice,
} from '../../lib/tasks'
import { ProjectPicker } from '../TasksView/ProjectPicker'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import styles from './CalendarView.module.css'

function noteHasContent(content: string): boolean {
  return content.trim().length > 0
}

// Itens vinculados a tasks (com <task-ref>) não contam: são representados
// pelos marcadores de task, e o [ ] da nota pode estar defasado.
function noteHasUnfinishedTodos(content: string): boolean {
  return content
    .split(/\r?\n/)
    .some((line) => /^- \[ \] .+/.test(line) && !line.includes('<task-ref'))
}

function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number)
  return { y, m: m - 1, d }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface CalendarViewProps {
  notes: Note[]
  datedNotes: Note[]
  notebooks: Notebook[]
  /** Todas as notas — usadas para destacar no dia selecionado as que foram
   *  criadas ou editadas nesse dia. */
  recentlyActiveNotes?: Note[]
  onDayClick: (date: Date) => void
  onNoteClick: (noteId: string) => void
  width?: number
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onWidthChange?: (w: number) => void
  tasks: Task[]
  todayKey: string
  onToggleTaskDone: (id: string, done: boolean) => void
  onCreateTask: (dueDate: string, title: string, project: ProjectChoice) => void
  onOpenTask: (id: string) => void
}

export function CalendarView({
  notes,
  datedNotes,
  notebooks,
  recentlyActiveNotes = [],
  onDayClick,
  onNoteClick,
  width = 220,
  collapsed = false,
  onToggleCollapsed,
  onWidthChange,
  tasks,
  todayKey,
  onToggleTaskDone,
  onCreateTask,
  onOpenTask,
}: CalendarViewProps) {
  const [year, setYear] = useState(() => parseDateKey(todayKey).y)
  const [month, setMonth] = useState(() => parseDateKey(todayKey).m)
  const [yearInput, setYearInput] = useState(() => String(parseDateKey(todayKey).y))

  const [selectedDay, setSelectedDay] = useState<string | null>(todayKey)
  const [addingTask, setAddingTask] = useState(false)
  const [taskDraft, setTaskDraft] = useState('')
  const [taskProject, setTaskProject] = useState<ProjectChoice>({ notebookId: INBOX_NOTEBOOK_ID })

  // Virada do dia com o app aberto: se o dia selecionado era o "hoje"
  // anterior, acompanha o novo hoje.
  const prevTodayRef = useRef(todayKey)
  useEffect(() => {
    const prev = prevTodayRef.current
    prevTodayRef.current = todayKey
    if (prev === todayKey) return
    setSelectedDay((sel) => (sel === prev ? todayKey : sel))
  }, [todayKey])

  const onMouseDown = useSidebarResize(width, onWidthChange)

  const dayDotMap = useMemo(() => {
    const map = new Map<string, 'todo' | 'content'>()
    for (const note of notes) {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(note.title)) continue
      if (!noteHasContent(note.content)) continue
      const dotType = noteHasUnfinishedTodos(note.content) ? 'todo' : 'content'
      map.set(note.title, dotType)
    }
    for (const note of datedNotes) {
      if (!note.date) continue
      if (!noteHasContent(note.content)) continue
      const dotType = noteHasUnfinishedTodos(note.content) ? 'todo' : 'content'
      const existing = map.get(note.date)
      if (!existing || existing === 'content') {
        map.set(note.date, dotType)
      }
    }
    return map
  }, [notes, datedNotes])

  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name])),
    [notebooks]
  )

  // Cards abaixo do calendário:
  // - Notas "dated" (com note.date === selectedDay) → linha roxa
  // - Notas criadas/editadas no dia selecionado → linha verde
  // Notas do próprio notebook Calendar (notas diárias) não aparecem aqui.
  // Sem duplicação: se uma nota for tanto dated quanto active, conta como dated.
  const dayCards = useMemo(() => {
    if (!selectedDay) return [] as Array<{ note: Note; dated: boolean }>
    const seen = new Set<string>()
    const cards: Array<{ note: Note; dated: boolean }> = []
    // Primeiro as dated (roxa) — têm prioridade
    for (const n of datedNotes) {
      if (n.date !== selectedDay) continue
      if (n.notebookId === CALENDAR_NOTEBOOK_ID) continue
      cards.push({ note: n, dated: true })
      seen.add(n.id)
    }
    // Depois as active (verde) — sem duplicar
    for (const n of recentlyActiveNotes) {
      if (seen.has(n.id)) continue
      if (n.notebookId === CALENDAR_NOTEBOOK_ID) continue
      const createdKey = dateKeyFromMs(n.createdAt)
      const updatedKey = dateKeyFromMs(n.updatedAt)
      if (createdKey === selectedDay || updatedKey === selectedDay) {
        cards.push({ note: n, dated: false })
      }
    }
    return cards
  }, [selectedDay, datedNotes, recentlyActiveNotes])

  // Indica se houve notas criadas ou editadas hoje (para destacar o dia atual).
  const hasActivityToday = useMemo(() => {
    return recentlyActiveNotes.some((n) => {
      if (n.notebookId === CALENDAR_NOTEBOOK_ID) return false
      const createdKey = dateKeyFromMs(n.createdAt)
      const updatedKey = dateKeyFromMs(n.updatedAt)
      return createdKey === todayKey || updatedKey === todayKey
    })
  }, [recentlyActiveNotes, todayKey])

  // Marcadores de task por dia do mês visível: 'active' dentro do período da
  // task, 'due' no dia do prazo (prevalece). Itera só os dias do mês visível.
  const taskDayMap = useMemo(() => {
    const map = new Map<string, 'active' | 'due'>()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const spans: Array<{ start: string; end: string; hasDue: boolean }> = []
    for (const t of tasks) {
      const span = taskSpan(t, todayKey)
      if (span) spans.push({ ...span, hasDue: t.dueDate !== null })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = toDateKey(year, month, d)
      for (const span of spans) {
        if (key < span.start || key > span.end) continue
        if (span.hasDue && key === span.end) {
          map.set(key, 'due')
          break
        }
        map.set(key, 'active')
      }
    }
    return map
  }, [tasks, todayKey, year, month])

  const overdueTasks = useMemo(
    () => (selectedDay === todayKey ? tasks.filter((t) => isOverdue(t, todayKey)) : []),
    [tasks, selectedDay, todayKey]
  )

  // Tasks do dia selecionado: abertas cujo período contém o dia + concluídas
  // naquele dia.
  const dayTasks = useMemo(() => {
    if (!selectedDay) return [] as Task[]
    return tasks.filter((t) => {
      if (t.status === 'done') {
        return t.completedAt !== null && dateKeyFromMs(t.completedAt) === selectedDay
      }
      const span = taskSpan(t, todayKey)
      return span !== null && span.start <= selectedDay && selectedDay <= span.end
    })
  }, [tasks, selectedDay, todayKey])

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const result: Array<{ day: number; current: boolean }> = []

    for (let i = firstWeekday - 1; i >= 0; i--) {
      result.push({ day: daysInPrevMonth - i, current: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, current: true })
    }
    const remaining = 42 - result.length
    for (let d = 1; d <= remaining; d++) {
      result.push({ day: d, current: false })
    }
    return result
  }, [year, month])

  function prevMonth() {
    if (month === 0) {
      const y = year - 1
      setYear(y)
      setYearInput(String(y))
      setMonth(11)
    } else {
      setMonth(month - 1)
    }
  }

  function nextMonth() {
    if (month === 11) {
      const y = year + 1
      setYear(y)
      setYearInput(String(y))
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
  }

  function applyYearInput() {
    const parsed = parseInt(yearInput, 10)
    if (!isNaN(parsed) && parsed > 0) {
      setYear(parsed)
    } else {
      setYearInput(String(year))
    }
  }

  function dayTitle(day: number) {
    const d = String(day).padStart(2, '0')
    const m = String(month + 1).padStart(2, '0')
    return `${d}/${m}/${year}`
  }

  function isToday(day: number, current: boolean) {
    return current && toDateKey(year, month, day) === todayKey
  }

  function commitTaskDraft() {
    const title = taskDraft.trim()
    if (title && selectedDay) onCreateTask(selectedDay, title, taskProject)
    cancelTaskDraft()
  }

  function cancelTaskDraft() {
    setTaskDraft('')
    setTaskProject({ notebookId: INBOX_NOTEBOOK_ID })
    setAddingTask(false)
  }

  function renderTaskCard(t: Task, extraClass: string) {
    return (
      <div
        key={t.id}
        className={`${styles.taskCard} ${extraClass}`}
        onClick={() => onOpenTask(t.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpenTask(t.id) }}
      >
        <input
          type="checkbox"
          className={styles.taskCheckbox}
          checked={t.status === 'done'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onToggleTaskDone(t.id, e.target.checked)}
          aria-label="done"
        />
        <span className={styles.taskCardTitle}>{t.title}</span>
        {t.dueDate && <span className={styles.taskCardDue}>{formatDueShort(t.dueDate)}</span>}
      </div>
    )
  }

  return (
    <aside className={`${styles.calendar} ${collapsed ? styles.collapsed : ''}`} style={{ width }}>
      {!collapsed && <div className={styles.resizeHandle} onMouseDown={onMouseDown} />}
      {collapsed ? (
        <div className={styles.collapsedTop}>
          <button
            className={styles.headerToggle}
            onClick={onToggleCollapsed}
            aria-label="expand calendar"
            title="expand calendar"
            type="button"
          >
            <SidebarSimple size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.header}>
            <div className={styles.monthNav}>
              <button className={styles.navBtn} onClick={prevMonth} aria-label="previous month" type="button">
                <CaretLeft size={13} weight="bold" />
              </button>
              <span className={styles.monthName}>{MONTH_NAMES[month]}</span>
              <button className={styles.navBtn} onClick={nextMonth} aria-label="next month" type="button">
                <CaretRight size={13} weight="bold" />
              </button>
            </div>
            <div className={styles.headerRight}>
              <button
                className={styles.headerToggle}
                onClick={onToggleCollapsed}
                aria-label="collapse calendar"
                title="collapse calendar"
                type="button"
              >
                <SidebarSimple size={16} aria-hidden />
              </button>
              <input
                type="number"
                className={styles.yearInput}
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                onBlur={applyYearInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { applyYearInput(); e.currentTarget.blur() }
                }}
                aria-label="year"
              />
            </div>
          </div>

          <div className={styles.grid}>
            {DAY_LABELS.map((d) => (
              <div key={d} className={styles.dayLabel}>{d}</div>
            ))}
            {cells.map((cell, i) => {
              const title = cell.current ? dayTitle(cell.day) : ''
              const dateKey = cell.current ? toDateKey(year, month, cell.day) : ''
              const dotType = cell.current ? (dayDotMap.get(title) ?? dayDotMap.get(dateKey) ?? null) : null
              const taskMark = cell.current ? taskDayMap.get(dateKey) : undefined
              const today_ = isToday(cell.day, cell.current)
              const isSelected = cell.current && selectedDay === dateKey
              return (
                <div
                  key={i}
                  className={[
                    styles.cell,
                    !cell.current ? styles.adjacent : '',
                    today_ ? styles.today : '',
                    isSelected ? styles.selected : '',
                  ].join(' ')}
                  onClick={cell.current ? () => {
                    setSelectedDay(dateKey)
                    onDayClick(new Date(year, month, cell.day))
                  } : undefined}
                  role={cell.current ? 'button' : undefined}
                  tabIndex={cell.current ? 0 : undefined}
                  onKeyDown={cell.current ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedDay(dateKey)
                      onDayClick(new Date(year, month, cell.day))
                    }
                  } : undefined}
                >
                  <span className={styles.dayNumber}>{cell.day}</span>
                  {dotType && <span className={`${styles.dot} ${dotType === 'todo' ? styles.dotTodo : ''}`} aria-hidden />}
                  {today_ && hasActivityToday && !dotType && (
                    <span className={`${styles.dot} ${styles.dotActivity}`} aria-hidden />
                  )}
                  {taskMark && (
                    <span
                      className={`${styles.taskBar} ${taskMark === 'due' ? styles.taskBarDue : ''}`}
                      aria-hidden
                    />
                  )}
                </div>
              )
            })}
          </div>

          {selectedDay && (
            <div className={styles.cards}>
              {overdueTasks.length > 0 && (
                <div className={styles.overdueBlock}>
                  <div className={styles.sectionTitle}>Overdue</div>
                  {overdueTasks.map((t) => renderTaskCard(t, styles.taskCardOverdue))}
                </div>
              )}
              <div className={styles.sectionTitle}>
                <span>Tasks</span>
                <button
                  type="button"
                  className={styles.addTaskBtn}
                  onClick={() => setAddingTask(true)}
                >
                  + task
                </button>
              </div>
              {addingTask && (
                <div
                  className={styles.addTaskForm}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTaskDraft()
                    if (e.key === 'Escape') cancelTaskDraft()
                  }}
                  onBlur={(e) => {
                    // Fecha só quando o foco sai do formulário (input + projeto).
                    // Checagem adiada: o seletor troca de select para input ao
                    // escolher "+ New notebook…", e o foco só chega no novo
                    // elemento depois do blur.
                    const form = e.currentTarget
                    setTimeout(() => {
                      if (!form.contains(document.activeElement)) cancelTaskDraft()
                    }, 0)
                  }}
                >
                  <input
                    autoFocus
                    className={styles.addTaskInput}
                    value={taskDraft}
                    onChange={(e) => setTaskDraft(e.target.value)}
                    placeholder="New task…"
                    aria-label="new task"
                  />
                  <ProjectPicker notebooks={notebooks} value={taskProject} onChange={setTaskProject} />
                </div>
              )}
              {dayTasks.map((t) =>
                renderTaskCard(t, t.status === 'done' ? styles.taskCardDone : '')
              )}
              {dayCards.map(({ note, dated }) => {
                const nbName = note.notebookId
                  ? notebookNameById.get(note.notebookId)
                  : undefined
                return (
                  <div
                    key={note.id}
                    className={`${styles.noteCard} ${dated ? '' : styles.noteCardActive}`}
                    onClick={() => onNoteClick(note.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNoteClick(note.id) }}
                  >
                    {nbName && <span className={styles.noteCardNotebook}>{nbName}</span>}
                    <span className={styles.noteCardTitle}>{note.title || 'untitled'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
