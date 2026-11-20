import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './ConfirmModal.module.css'

// Confirmações abertas, na ordem em que abriram: o Esc só cancela a de cima.
const openConfirms: object[] = []

export interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  // Terceira saída (secundária), entre Cancel e Confirm; só com as duas props.
  altLabel?: string
  onAlt?: () => void
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  altLabel,
  onAlt,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const id = useId()

  // Esc cancela. Captura no window (o primeiro do caminho do evento) e
  // stopPropagation: o modal pai e os atalhos globais não recebem o Esc. Com
  // duas confirmações abertas, a de baixo deixa o Esc passar para a de cima.
  useEffect(() => {
    if (!open) return
    const entry = {}
    openConfirms.push(entry)
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || openConfirms[openConfirms.length - 1] !== entry) return
      e.preventDefault()
      e.stopImmediatePropagation()
      onCancelRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      openConfirms.splice(openConfirms.indexOf(entry), 1)
    }
  }, [open])

  if (!open) return null

  // Ação destrutiva: o foco começa no Cancel (um Enter distraído não apaga).
  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
      >
        <p className={styles.title} id={`${id}-title`}>{title}</p>
        <p className={styles.message} id={`${id}-message`}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onCancel} type="button" autoFocus={destructive}>
            {cancelLabel}
          </button>
          {altLabel && onAlt && (
            <button className={styles.btnCancel} onClick={onAlt} type="button">
              {altLabel}
            </button>
          )}
          <button
            className={destructive ? styles.btnConfirm : styles.btnPrimary}
            onClick={onConfirm}
            type="button"
            autoFocus={!destructive}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
