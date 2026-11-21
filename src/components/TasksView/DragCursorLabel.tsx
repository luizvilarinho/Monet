import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Target } from '@phosphor-icons/react'
import styles from './DragCursorLabel.module.css'

// Rótulo que acompanha o cursor durante o arrasto de um card (desenhado pela
// visão; o useCardDrag continua clonando o card como fantasma).
interface DragCursorLabelProps {
  // draggingId !== null
  active: boolean
  // null = nada a mostrar
  text: string | null
  tone?: 'default' | 'late' | 'danger' | 'accent'
}

const TONE_CLASS = {
  default: '',
  late: styles.late,
  danger: styles.danger,
  accent: styles.accent,
}

export function DragCursorLabel({ active, text, tone = 'default' }: DragCursorLabelProps) {
  const elRef = useRef<HTMLSpanElement>(null)
  // Última posição do cursor; `moved` fica falso até o 1º movimento do arrasto
  // (antes disso a posição não é conhecida e o rótulo fica escondido).
  const posRef = useRef({ x: 0, y: 0, moved: false })

  const place = useCallback(() => {
    const el = elRef.current
    if (!el) return
    const { x, y, moved } = posRef.current
    el.style.visibility = moved ? 'visible' : 'hidden'
    el.style.transform = `translate(${x + 14}px, ${y + 18}px)`
  }, [])

  useEffect(() => {
    if (!active) {
      posRef.current.moved = false
      return
    }
    function onMove(e: MouseEvent) {
      posRef.current = { x: e.clientX, y: e.clientY, moved: true }
      place()
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [active, place])

  // O texto passou de null a algo: posiciona antes de pintar.
  const shown = active && text !== null
  useLayoutEffect(() => {
    if (shown) place()
  }, [shown, place])

  if (!shown) return null
  return createPortal(
    <span ref={elRef} className={`${styles.label} ${TONE_CLASS[tone]}`} aria-hidden>
      <Target size={11} aria-hidden />
      {text}
    </span>,
    document.body
  )
}
