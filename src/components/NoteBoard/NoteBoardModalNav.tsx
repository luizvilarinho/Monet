import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowSquareOut, ArrowUp } from '@phosphor-icons/react'
import styles from './NoteBoard.module.css'

// Rodapé do modal "Edit note" aberto pelo board: Previous/Next na ordem dos
// cards do board (também Alt+↑/Alt+↓, que o editor não usa) e "Open in
// notebook".
interface NoteBoardModalNavProps {
  // Posição (0 = primeiro) da nota na ordem; null = fora dela (nota nova).
  position: number | null
  total: number
  // Ausente = sem nota antes/depois.
  onPrev?: () => void
  onNext?: () => void
  onOpenInNotebook: () => void
}

export function NoteBoardModalNav({ position, total, onPrev, onNext, onOpenInNotebook }: NoteBoardModalNavProps) {
  const ref = useRef<HTMLDivElement>(null)
  const actionsRef = useRef({ onPrev, onNext })
  actionsRef.current = { onPrev, onNext }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      // Alt+↓ num select ou num campo de data abre a lista/o seletor dele.
      if ((e.target as HTMLElement | null)?.closest?.('select, input')) return
      // Outro modal por cima (confirmação, Note types) fica com o teclado.
      const dialog = ref.current?.closest('[aria-modal="true"]')
      const modals = document.querySelectorAll('[aria-modal="true"]')
      if (!dialog || modals[modals.length - 1] !== dialog) return
      const go = e.key === 'ArrowUp' ? actionsRef.current.onPrev : actionsRef.current.onNext
      if (!go) return
      e.preventDefault()
      go()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={ref} className={styles.modalNav}>
      <button type="button" className={styles.headerBtn} onClick={onPrev} disabled={!onPrev} title="Alt+↑">
        <ArrowUp size={14} aria-hidden />
        Previous
      </button>
      <button type="button" className={styles.headerBtn} onClick={onNext} disabled={!onNext} title="Alt+↓">
        <ArrowDown size={14} aria-hidden />
        Next
      </button>
      {position !== null && (
        <span className={styles.count}>
          {position + 1} of {total}
        </span>
      )}
      <button type="button" className={`${styles.headerBtn} ${styles.modalNavEnd}`} onClick={onOpenInNotebook}>
        <ArrowSquareOut size={14} aria-hidden />
        Open in notebook
      </button>
    </div>
  )
}
