import { createPortal } from 'react-dom'
import styles from './ConfirmModal.module.css'

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
  confirmLabel = 'delete',
  cancelLabel = 'cancel',
  destructive = true,
  altLabel,
  onAlt,
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
          {altLabel && onAlt && (
            <button className={styles.btnCancel} onClick={onAlt} type="button">
              {altLabel}
            </button>
          )}
          <button className={destructive ? styles.btnConfirm : styles.btnPrimary} onClick={onConfirm} type="button" autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
