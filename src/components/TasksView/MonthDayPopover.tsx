import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatDueShort, WEEKDAY_SHORT } from '../../lib/tasks'
import type { Task } from '../../types'
import styles from './MonthBoard.module.css'

const WIDTH = 300
const MARGIN = 8

// Lista do dia ("+N more" e contagem de concluídas): as abertas (arrastáveis e
// clicáveis) e as concluídas. Fecha com Esc e com clique fora; começar um
// arrasto de dentro dele fecha pelo MonthBoard.
interface MonthDayPopoverProps {
  day: string
  // Retângulo da célula do dia (o popover nasce logo abaixo do cabeçalho dela).
  anchor: DOMRect
  open: Task[]
  done: Task[]
  renderRow: (task: Task) => ReactNode
  onClose: () => void
}

export function MonthDayPopover({ day, anchor, open, done, renderRow, onClose }: MonthDayPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const left = Math.min(anchor.left, window.innerWidth - WIDTH - MARGIN)
    const top = Math.min(anchor.top + 22, window.innerHeight - el.offsetHeight - MARGIN)
    el.style.left = `${Math.max(MARGIN, left)}px`
    el.style.top = `${Math.max(MARGIN, top)}px`
  }, [anchor, open.length, done.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    // O botão que abriu (`data-day-list`) alterna sozinho pelo clique.
    function onDown(e: MouseEvent) {
      const target = e.target as Element
      if (!rootRef.current?.contains(target) && !target.closest('[data-day-list]')) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])

  const weekday = WEEKDAY_SHORT[new Date(`${day}T00:00:00`).getDay()]
  return createPortal(
    <div ref={rootRef} className={styles.popover} role="dialog" aria-label="Tasks of the day">
      <div className={styles.popoverHead}>
        {weekday}, {formatDueShort(day)}
        <span>
          {open.length} open{done.length > 0 ? ` · ${done.length} done` : ''}
        </span>
      </div>
      {open.map((t) => renderRow(t))}
      {done.length > 0 && (
        <>
          <div className={styles.popoverSub}>Done</div>
          {done.map((t) => renderRow(t))}
        </>
      )}
    </div>,
    document.body
  )
}
