import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import styles from './TaskEditorModal.module.css'

// Modal das visões que não são List (Week, Kanban, Projects, TODOS, My Day,
// Review): mostra o mesmo editor da nota-corpo (com a barra de propriedades)
// que a List abre ao lado. Também abre a nota de um card do board de notas
// (`ariaLabel` "Edit note", com `footer`). Fecha com Esc, clique fora ou o botão.
interface TaskEditorModalProps {
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
  // Barra abaixo do editor (ex.: Previous/Next do board de notas).
  footer?: ReactNode
}

export function TaskEditorModal({ onClose, children, ariaLabel = 'Edit task', footer }: TaskEditorModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    // O foco sai do card clicado no quadro: as teclas do quadro (useTaskKeyboard)
    // não podem agir na task de trás enquanto o modal está aberto.
    const card = cardRef.current
    if (card && !card.contains(document.activeElement)) card.focus()

    // No document (e não no card): um input que trata Esc e se desfoca deixa o
    // foco no body, e o Esc seguinte ainda precisa fechar.
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Esc em campo de texto é do campo (cancelar edição da propriedade).
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return
      // Outro modal por cima (confirmação, Manage properties) fica com o Esc.
      const modals = document.querySelectorAll('[aria-modal="true"]')
      if (modals[modals.length - 1] !== cardRef.current) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={cardRef} className={styles.card} role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1}>
        <button type="button" className={styles.close} aria-label="Close" title="Close" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
        {children}
        {footer}
      </div>
    </div>,
    document.body
  )
}
