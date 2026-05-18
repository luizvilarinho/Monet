import { createPortal } from 'react-dom'
import styles from './ConfirmModal.module.css'

export interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'delete',
  cancelLabel = 'cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={styles.card} role="dialog" aria-modal="true">
        <p className={styles.title}>{title}</p>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className={styles.btnConfirm} onClick={onConfirm} type="button" autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
