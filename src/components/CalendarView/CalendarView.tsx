import { CaretLeft, CaretRight, SidebarSimple } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../../types'
import styles from './CalendarView.module.css'

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function noteHasContent(content: string): boolean {
  return content.trim().length > 0
}

function noteHasUnfinishedTodos(content: string): boolean {
  return /^- \[ \] .+/m.test(content)
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MIN_WIDTH = 160
const MAX_WIDTH = 400

interface CalendarViewProps {
  notes: Note[]
  datedNotes: Note[]
  onDayClick: (date: Date) => void
  onNoteClick: (noteId: string) => void
  width?: number
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onWidthChange?: (w: number) => void
}

export function CalendarView({
  notes,
  datedNotes,
  onDayClick,
  onNoteClick,
  width = 220,
  collapsed = false,
  onToggleCollapsed,
  onWidthChange,
}: CalendarViewProps) {
  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [yearInput, setYearInput] = useState(String(today.getFullYear()))

  const [selectedDay, setSelectedDay] = useState<string | null>(
    () => toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  )

  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const currentWidthRef = useRef(width)

  useEffect(() => {
    currentWidthRef.current = width
  }, [width])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      currentWidthRef.current = next
      onWidthChange?.(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('monet:sidebar-width', String(currentWidthRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onWidthChange])

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

  const dayCards = useMemo(() => {
    if (!selectedDay) return []
    return datedNotes.filter((n) => n.date === selectedDay)
  }, [selectedDay, datedNotes])

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
    return current &&
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
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
                  {dotType && <span className={`${styles.dot} ${dotType === 'todo' ? styles.dotPurple : ''}`} aria-hidden />}
                </div>
              )
            })}
          </div>

          {dayCards.length > 0 && (
            <div className={styles.cards}>
              {dayCards.map((note) => (
                <div
                  key={note.id}
                  className={styles.noteCard}
                  onClick={() => onNoteClick(note.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNoteClick(note.id) }}
                >
                  <span className={styles.noteCardTitle}>{note.title || 'untitled'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
