import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Target } from '@phosphor-icons/react'
import { fitDayRows } from '../../lib/tasks'
import type { Task } from '../../types'
import styles from './MonthBoard.module.css'

// A partir daqui o dia conta como carregado: o "N open" fica em destaque.
const HEAVY_DAY = 4
// Linha de task de 22px + 2px de espaço entre as linhas.
const ROW_STEP = 24

// Medida do texto por canvas: o título cabe numa linha? Não depende de a linha
// já estar com a 2ª linha liberada (o `-webkit-line-clamp` esconde o excesso).
let measureCtx: CanvasRenderingContext2D | null | undefined
function textWidth(font: string, text: string): number {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return 0
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

function sameList(a: boolean[], b: boolean[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

interface MonthDayCellProps {
  day: string
  label: string
  // Rótulo com o mês num dia que não é a 1ª célula (em destaque).
  monthStart: boolean
  todayKey: string
  // Abertas do dia, já em byBoardOrder.
  open: Task[]
  doneCount: number
  // Deadlines abertos que caem no dia (estejam planejadas onde estiverem).
  due: Task[]
  // day >= todayKey
  droppable: boolean
  // overKey === day com arrasto
  over: boolean
  // Há uma task no ar.
  dragging: boolean
  // Dia do deadline da task no ar (barra + "Deadline").
  deadlineDay: boolean
  // Dia do deadline da task sob o mouse (só a barra).
  deadlineHover: boolean
  // Depois do deadline da task no ar (hachura).
  afterDeadline: boolean
  weekend: boolean
  renderRow: (task: Task, wrap: boolean) => ReactNode
  onOpenList: (day: string, anchor: HTMLElement) => void
  onDueHover: (day: string | null) => void
}

export function MonthDayCell({
  day,
  label,
  monthStart,
  todayKey,
  open,
  doneCount,
  due,
  droppable,
  over,
  dragging,
  deadlineDay,
  deadlineHover,
  afterDeadline,
  weekend,
  renderRow,
  onOpenList,
  onDueHover,
}: MonthDayCellProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [measured, setMeasured] = useState<boolean[]>([])

  // A célula mede o próprio corpo (a grade a dimensiona, não o conteúdo).
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const read = () =>
      setSize((prev) =>
        prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }
      )
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const capacity = Math.max(1, Math.floor((size.h + 2) / ROW_STEP))
  const { shown, more, wrap } = fitDayRows(
    capacity,
    open.map((_, i) => measured[i] ?? false)
  )

  // Quais títulos não cabem numa linha: medidos com o canvas contra a largura
  // do próprio título (a mesma com uma ou duas linhas).
  useLayoutEffect(() => {
    const titles = bodyRef.current?.querySelectorAll<HTMLElement>('[data-row-title]')
    if (!titles) return
    const next = open.map((_, i) => {
      const el = titles[i]
      if (!el) return false
      return textWidth(getComputedStyle(el).font, el.textContent ?? '') > el.clientWidth + 1
    })
    setMeasured((prev) => (sameList(prev, next) ? prev : next))
  }, [open, capacity, size.w])

  const cut = open.length > capacity
  const heavy = open.length >= HEAVY_DAY
  const past = day < todayKey

  return (
    <div
      data-day={day}
      data-drop-key={droppable ? day : undefined}
      className={[
        styles.day,
        past ? styles.past : '',
        day === todayKey ? styles.today : '',
        weekend ? styles.weekend : '',
        over ? styles.over : '',
        afterDeadline ? styles.afterDeadline : '',
        deadlineDay || deadlineHover ? styles.deadlineBar : '',
        // Durante o arrasto, dias que não aceitam drop esmaecem.
        dragging && !droppable ? styles.blocked : '',
      ].join(' ')}
    >
      <div className={styles.dayHead}>
        <span className={`${styles.dayLabel} ${monthStart ? styles.monthStart : ''}`}>{label}</span>
        <span className={styles.marks}>
          {(cut || heavy) && (
            <span
              className={`${styles.openCount} ${heavy ? styles.heavy : ''}`}
              title={`${open.length} open tasks planned for this day`}
            >
              {open.length}
              <span className={styles.word}>&nbsp;open</span>
            </span>
          )}
          {doneCount > 0 && !deadlineDay && (
            <button
              type="button"
              data-day-list
              className={styles.doneCount}
              title={`${doneCount} done on this day. Click to list`}
              onClick={(e) => onOpenList(day, e.currentTarget)}
            >
              <Check size={11} aria-hidden />
              {doneCount}
              {past && <span className={styles.word}>&nbsp;done</span>}
            </button>
          )}
          {due.length > 0 && !deadlineDay && (
            <span
              className={`${styles.dueCount} ${past ? styles.dueLate : ''} ${deadlineHover ? styles.dueHover : ''}`}
              title={`Deadline on this day: ${due.map((t) => t.title).join(', ')}`}
              onMouseEnter={() => onDueHover(day)}
              onMouseLeave={() => onDueHover(null)}
            >
              <Target size={11} aria-hidden />
              {due.length}
              <span className={styles.word}>&nbsp;due</span>
            </span>
          )}
          {deadlineDay && (
            <span className={styles.deadlineFlag}>
              <Target size={11} aria-hidden />
              Deadline
            </span>
          )}
        </span>
      </div>
      <div ref={bodyRef} className={styles.dayBody}>
        {open.slice(0, shown).map((t, i) => renderRow(t, wrap[i]))}
        {more > 0 && (
          <button
            type="button"
            data-day-list
            className={styles.more}
            onClick={(e) => onOpenList(day, e.currentTarget)}
          >
            {shown > 0 ? `+${more} more` : `${open.length} tasks`}
          </button>
        )}
      </div>
    </div>
  )
}
