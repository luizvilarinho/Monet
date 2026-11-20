import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './ReaderToast.module.css'

// Toast dos leitores (PDF e EPUB) e do chat do Reader: uma mensagem por vez,
// com ações opcionais (Open, Undo). Um toast novo substitui o anterior.

export interface ReaderToastAction {
  label: string
  onClick: () => void
}

export interface ReaderToastMessage {
  message: string
  tone?: 'success' | 'error'
  actions?: ReaderToastAction[]
}

export type ShowReaderToast = (toast: ReaderToastMessage) => void

const TOAST_MS = 2500
// Com ações o toast fica mais tempo: dá tempo de chegar ao botão.
const TOAST_WITH_ACTIONS_MS = 6000

export function useReaderToast() {
  const [current, setCurrent] = useState<ReaderToastMessage | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setCurrent(null)
  }, [])

  const showToast = useCallback<ShowReaderToast>((toast) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setCurrent(toast)
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null
        setCurrent(null)
      },
      toast.actions?.length ? TOAST_WITH_ACTIONS_MS : TOAST_MS,
    )
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const isError = current?.tone === 'error'
  const toast = current ? (
    <div
      className={`${styles.toast} ${isError ? styles.toastError : ''}`}
      role={isError ? 'alert' : 'status'}
    >
      <span className={styles.message}>{current.message}</span>
      {current.actions?.map((action) => (
        <button
          key={action.label}
          type="button"
          className={styles.action}
          onClick={() => {
            dismiss()
            action.onClick()
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  ) : null

  return { toast, showToast }
}
