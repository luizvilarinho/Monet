import { CaretLeft, CaretRight, Plus, SidebarSimple, Target } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note, Notebook, NoteType, Task } from '../../types'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs, toDateKey } from '../../lib/calendar'
import {
  formatDueShort,
  INBOX_NOTEBOOK_ID,
  isOpen,
  isOverdue,
  overdueKind,
  planDate,
  taskSpan,
  type ProjectChoice,
} from '../../lib/tasks'
import { ProjectPicker } from '../TasksView/ProjectPicker'
import { TypeIcon } from '../NoteTypes/TypeIcon'
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

// Aberta e marcada no My Day de hoje (sol): vai para hoje em todas as visões.
function isInMyDay(t: Task, todayKey: string): boolean {
  return isOpen(t) && t.plannedDay === todayKey
}

function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number)
  return { y, m: m - 1, d }
}

// Semana de segunda a domingo, como nas Tasks (Week board).
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// Por getDay() (domingo = 0), para o rótulo acessível da célula.
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
// Faixa do campo de ano: fora dela o valor digitado é descartado.
const YEAR_MIN = 1900
const YEAR_MAX = 2999
// "Edited this day" mostra até 5 cards; o resto atrás de "Show N more".
const EDITED_LIMIT = 5

type NoteCard = { note: Note; dated: boolean }

interface CalendarViewProps {
  notes: Note[]
  datedNotes: Note[]
  notebooks: Notebook[]
  /** Tipos de nota: ícone e nome do tipo nos cards de notas do dia. */
  noteTypes?: NoteType[]
  /** Todas as notas — usadas para destacar no dia selecionado as que foram
   *  criadas ou editadas nesse dia. */
  recentlyActiveNotes?: Note[]
  onDayClick: (date: Date) => void
  onNoteClick: (noteId: string) => void
  width?: number
  // Cadernos ocultos: a coluna aceita largura maior (largura própria).
  wide?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onWidthChange?: (w: number) => void
  // Falso na janela keep: a largura é fixa e o arrasto gravaria a largura da
  // sidebar da main (localStorage compartilhado entre janelas).
  resizable?: boolean
  tasks: Task[]
  todayKey: string
  onToggleTaskDone: (id: string, done: boolean) => void
  /** Ausente (janela keep): esconde o "+ task". */
  onCreateTask?: (scheduledDate: string, title: string, project: ProjectChoice) => void
  onOpenTask: (id: string) => void
}

export function CalendarView({
  notes,
  datedNotes,
  notebooks,
  noteTypes = [],
  recentlyActiveNotes = [],
  onDayClick,
  onNoteClick,
  width = 220,
  wide = false,
  collapsed = false,
  onToggleCollapsed,
  onWidthChange,
  resizable = true,
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
  // Dia com o "Edited this day" aberto inteiro (outro dia volta recolhido).
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
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

  const onMouseDown = useSidebarResize(width, onWidthChange, wide)

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

  const typeById = useMemo(
    () => new Map(noteTypes.map((t) => [t.id, t])),
    [noteTypes]
  )

  // Notas mexidas que contam no Calendar: de caderno, não arquivadas e fora
  // do próprio Calendar (notas diárias).
  const editedNotes = useMemo(
    () =>
      recentlyActiveNotes.filter(
        (n) => n.notebookId && n.notebookId !== CALENDAR_NOTEBOOK_ID && !n.archivedAt
      ),
    [recentlyActiveNotes]
  )

  // Cards abaixo do calendário, em duas subseções com rótulo:
  // - "Dated" (note.date === selectedDay) → linha roxa
  // - "Edited this day" (criadas/editadas no dia selecionado) → linha neutra
  // Notas do próprio notebook Calendar (notas diárias) não aparecem aqui.
  // Sem duplicação: se uma nota for tanto dated quanto active, conta como dated.
  const dayCards = useMemo(() => {
    if (!selectedDay) return [] as NoteCard[]
    const seen = new Set<string>()
    const cards: NoteCard[] = []
    // Primeiro as dated (roxa) — têm prioridade
    for (const n of datedNotes) {
      if (n.date !== selectedDay) continue
      if (n.notebookId === CALENDAR_NOTEBOOK_ID) continue
      cards.push({ note: n, dated: true })
      seen.add(n.id)
    }
    // Depois as editadas no dia — sem duplicar
    for (const n of editedNotes) {
      if (seen.has(n.id)) continue
      const createdKey = dateKeyFromMs(n.createdAt)
      const updatedKey = dateKeyFromMs(n.updatedAt)
      if (createdKey === selectedDay || updatedKey === selectedDay) {
        cards.push({ note: n, dated: false })
      }
    }
    return cards
  }, [selectedDay, datedNotes, editedNotes])
  const datedCards = dayCards.filter((c) => c.dated)
  const editedCards = dayCards.filter((c) => !c.dated)
  const showAllEdited = expandedDay !== null && expandedDay === selectedDay
  const visibleEdited = showAllEdited ? editedCards : editedCards.slice(0, EDITED_LIMIT)

  // Indica se houve notas criadas ou editadas hoje (para destacar o dia atual).
  const hasActivityToday = useMemo(() => {
    return editedNotes.some((n) => {
      const createdKey = dateKeyFromMs(n.createdAt)
      const updatedKey = dateKeyFromMs(n.updatedAt)
      return createdKey === todayKey || updatedKey === todayKey
    })
  }, [editedNotes, todayKey])

  // Marcadores de task por dia do mês visível: 'active' dentro do período da
  // task (e hoje, para as do My Day), 'due' no dia da entrega (deadline) de
  // task aberta (prevalece). Itera só os dias do mês visível.
  const taskDayMap = useMemo(() => {
    const map = new Map<string, 'active' | 'due'>()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const spans: Array<{ start: string; end: string }> = []
    const dues = new Set<string>()
    for (const t of tasks) {
      const span = taskSpan(t, todayKey)
      if (span) spans.push(span)
      if (isInMyDay(t, todayKey)) spans.push({ start: todayKey, end: todayKey })
      if (isOpen(t) && t.dueDate !== null && t.dueDate >= todayKey) dues.add(t.dueDate)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = toDateKey(year, month, d)
      if (dues.has(key)) map.set(key, 'due')
      else if (spans.some((span) => span.start <= key && key <= span.end)) map.set(key, 'active')
    }
    return map
  }, [tasks, todayKey, year, month])

  // A do My Day de hoje fica nas tasks de hoje, mesmo atrasada (como na List,
  // no Week e no "Due today").
  const overdueTasks = useMemo(
    () =>
      selectedDay === todayKey ? tasks.filter((t) => isOverdue(t, todayKey) && !isInMyDay(t, todayKey)) : [],
    [tasks, selectedDay, todayKey]
  )

  // Tasks do dia selecionado: abertas cujo período contém o dia ou com
  // entrega no dia, as do My Day (hoje) + concluídas naquele dia.
  const dayTasks = useMemo(() => {
    if (!selectedDay) return [] as Task[]
    return tasks.filter((t) => {
      if (t.status === 'done') {
        return t.completedAt !== null && dateKeyFromMs(t.completedAt) === selectedDay
      }
      if (isOpen(t) && t.dueDate === selectedDay) return true
      if (selectedDay === todayKey && isInMyDay(t, todayKey)) return true
      const span = taskSpan(t, todayKey)
      return span !== null && span.start <= selectedDay && selectedDay <= span.end
    })
  }, [tasks, selectedDay, todayKey])

  const cells = useMemo(() => {
    // Coluna do dia 1 com a semana na segunda (getDay: domingo = 0).
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
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
      if (year <= YEAR_MIN) return
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
      if (year >= YEAR_MAX) return
      const y = year + 1
      setYear(y)
      setYearInput(String(y))
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
  }

  // Volta ao mês de hoje, marca o dia e abre a nota dele, como o clique no dia
  // (com o mês atual já à vista, só marca e abre).
  function goToToday() {
    const today = parseDateKey(todayKey)
    setYear(today.y)
    setYearInput(String(today.y))
    setMonth(today.m)
    setSelectedDay(todayKey)
    onDayClick(new Date(today.y, today.m, today.d))
  }

  // Ano fora da faixa (ou não inteiro) volta ao ano exibido.
  function applyYearInput() {
    const parsed = Number(yearInput)
    if (Number.isInteger(parsed) && parsed >= YEAR_MIN && parsed <= YEAR_MAX) {
      setYear(parsed)
      setYearInput(String(parsed))
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

  // Rótulo da célula (title e aria-label): a data e o que cada marcador diz,
  // ex. "Wed 19 Nov · today · note with open items · task deadline".
  function cellLabel(
    day: number,
    today: boolean,
    dotType: 'todo' | 'content' | null,
    activity: boolean,
    taskMark: 'active' | 'due' | undefined
  ) {
    const weekday = WEEKDAY_SHORT[new Date(year, month, day).getDay()]
    const parts = [`${weekday} ${day} ${MONTH_NAMES[month].slice(0, 3)}`]
    if (today) parts.push('today')
    if (dotType === 'todo') parts.push('note with open items')
    else if (dotType === 'content') parts.push('note')
    if (activity) parts.push('notes edited')
    if (taskMark === 'due') parts.push('task deadline')
    else if (taskMark === 'active') parts.push('tasks')
    return parts.join(' · ')
  }

  function renderNoteCard({ note, dated }: NoteCard) {
    const nbName = note.notebookId ? notebookNameById.get(note.notebookId) : undefined
    const type = note.typeId ? typeById.get(note.typeId) : undefined
    return (
      <div
        key={note.id}
        className={`${styles.noteCard} ${dated ? '' : styles.noteCardActive}`}
        onClick={() => onNoteClick(note.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNoteClick(note.id) }}
      >
        {(type || nbName) && (
          <span className={styles.noteCardMeta}>
            {type && (
              <span className={styles.noteCardType} style={{ color: type.color ?? undefined }} title={type.name}>
                <TypeIcon name={type.icon} size={11} />
                <span className={styles.noteCardTypeName}>{type.name}</span>
              </span>
            )}
            {type && nbName && <span className={styles.noteCardSep} aria-hidden>·</span>}
            {nbName && <span className={styles.noteCardNotebook}>{nbName}</span>}
          </span>
        )}
        <span className={styles.noteCardTitle}>{note.title || 'Untitled'}</span>
      </div>
    )
  }

  function commitTaskDraft() {
    const title = taskDraft.trim()
    if (title && selectedDay) onCreateTask?.(selectedDay, title, taskProject)
    cancelTaskDraft()
  }

  function cancelTaskDraft() {
    setTaskDraft('')
    setTaskProject({ notebookId: INBOX_NOTEBOOK_ID })
    setAddingTask(false)
  }

  function renderTaskCard(t: Task, extraClass: string) {
    const plan = planDate(t)
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
        <span className={styles.taskCardTitle} title={t.title}>{t.title}</span>
        {plan && <span className={styles.taskCardDue}>{formatDueShort(plan)}</span>}
        {t.dueDate && t.dueDate !== plan && (
          <span className={styles.taskCardDeadline} title="Deadline">
            <Target size={10} aria-hidden />
            {formatDueShort(t.dueDate)}
          </span>
        )}
      </div>
    )
  }

  return (
    <aside className={`${styles.calendar} ${collapsed ? styles.collapsed : ''}`} style={{ width }}>
      {!collapsed && resizable && <div className={styles.resizeHandle} onMouseDown={onMouseDown} />}
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
              <button
                className={styles.navBtn}
                onClick={prevMonth}
                aria-label="previous month"
                type="button"
                disabled={month === 0 && year <= YEAR_MIN}
              >
                <CaretLeft size={13} weight="bold" />
              </button>
              <span className={styles.monthName}>{MONTH_NAMES[month]}</span>
              <button
                className={styles.navBtn}
                onClick={nextMonth}
                aria-label="next month"
                type="button"
                disabled={month === 11 && year >= YEAR_MAX}
              >
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
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                onBlur={applyYearInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { applyYearInput(); e.currentTarget.blur() }
                }}
                aria-label="year"
              />
            </div>
            {/* Linha própria: na largura mínima (220px) o cabeçalho já não
                tem espaço para mais um botão. */}
            <div className={styles.todayRow}>
              <button type="button" className={styles.todayBtn} onClick={goToToday} title="Go to today and open its note">
                Today
              </button>
            </div>
          </div>

          {/* Grade e legenda juntas (o gap do .body afastaria a legenda). */}
          <div className={styles.month}>
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
                const label = cell.current
                  ? cellLabel(cell.day, today_, dotType, today_ && hasActivityToday, taskMark)
                  : undefined
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
                    title={label}
                    aria-label={label}
                    aria-pressed={cell.current ? isSelected : undefined}
                    aria-hidden={cell.current ? undefined : true}
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

            {/* Legenda dos marcadores, recolhida por padrão. */}
            <details className={styles.legend}>
              <summary className={styles.legendSummary}>Legend</summary>
              <ul className={styles.legendList}>
                <li><span className={styles.dot} aria-hidden /> Note</li>
                <li><span className={`${styles.dot} ${styles.dotTodo}`} aria-hidden /> Open items</li>
                <li><span className={`${styles.dot} ${styles.dotActivity}`} aria-hidden /> Edited today</li>
                <li><span className={styles.taskBar} aria-hidden /> Tasks</li>
                <li><span className={`${styles.taskBar} ${styles.taskBarDue}`} aria-hidden /> Deadline</li>
              </ul>
            </details>
          </div>

          {selectedDay && (
            <div className={styles.cards}>
              {overdueTasks.length > 0 && (
                <div className={styles.overdueBlock}>
                  <div className={styles.sectionTitle}>Overdue</div>
                  {overdueTasks.map((t) =>
                    renderTaskCard(
                      t,
                      overdueKind(t, todayKey) === 'deadline'
                        ? styles.taskCardOverdue
                        : styles.taskCardLate
                    )
                  )}
                </div>
              )}
              <div className={styles.sectionTitle}>
                <span>Tasks</span>
                {onCreateTask && (
                  <button
                    type="button"
                    className={styles.addTaskBtn}
                    onClick={() => setAddingTask(true)}
                    title="New task on this day"
                  >
                    <Plus size={11} aria-hidden />
                    Task
                  </button>
                )}
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
              {/* Atrasada no My Day ou já replanejada: fica no dia, com a cor do atraso. */}
              {dayTasks.map((t) => {
                const late = overdueKind(t, todayKey)
                return renderTaskCard(
                  t,
                  t.status === 'done'
                    ? styles.taskCardDone
                    : late === 'deadline'
                      ? styles.taskCardOverdue
                      : late === 'plan'
                        ? styles.taskCardLate
                        : ''
                )
              })}
              {datedCards.length > 0 && (
                <>
                  <div className={`${styles.sectionTitle} ${styles.noteSection}`}>Dated</div>
                  {datedCards.map(renderNoteCard)}
                </>
              )}
              {editedCards.length > 0 && (
                <>
                  <div className={`${styles.sectionTitle} ${styles.noteSection}`}>Edited this day</div>
                  {visibleEdited.map(renderNoteCard)}
                  {editedCards.length > EDITED_LIMIT && (
                    <button
                      type="button"
                      className={styles.moreBtn}
                      onClick={() => setExpandedDay(showAllEdited ? null : selectedDay)}
                    >
                      {showAllEdited ? 'Show less' : `Show ${editedCards.length - EDITED_LIMIT} more`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
