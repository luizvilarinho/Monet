import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import styles from './ShellToast.module.css'

export interface ShellNotice {
  message: string
  action?: { label: string; onClick: () => void }
}

interface ShellToastProps {
  notice: ShellNotice
  onDismiss: () => void
}

const DISMISS_MS = 6000

// Aviso curto da casca ("Moved to X · Open"): some sozinho em 6 s.
export function ShellToast({ notice, onDismiss }: ShellToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [notice, onDismiss])

  return createPortal(
    <div className={styles.toast} role="status">
      <span className={styles.message}>{notice.message}</span>
      {notice.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            notice.action?.onClick()
            onDismiss()
          }}
        >
          {notice.action.label}
        </button>
      )}
      <button type="button" className={styles.close} onClick={onDismiss} aria-label="Dismiss" title="Dismiss">
        <X size={12} aria-hidden />
      </button>
    </div>,
    document.body
  )
}
