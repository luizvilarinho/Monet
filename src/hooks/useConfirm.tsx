import { useCallback, useState } from 'react'
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  altLabel?: string
}

type ConfirmChoice = 'confirm' | 'alt' | 'cancel'

interface ConfirmState {
  message: string
  options: ConfirmOptions
  resolve: (choice: ConfirmChoice) => void
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ message, options, resolve: (choice) => resolve(choice === 'confirm') })
    })
  }, [])

  // choose: três saídas (Cancel / alt / confirm).
  const choose = useCallback(
    (message: string, options: ConfirmOptions & { altLabel: string }): Promise<ConfirmChoice> => {
      return new Promise((resolve) => {
        setState({ message, options, resolve })
      })
    },
    []
  )

  const handleConfirm = () => {
    state?.resolve('confirm')
    setState(null)
  }

  const handleAlt = () => {
    state?.resolve('alt')
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve('cancel')
    setState(null)
  }

  const modal = (
    <ConfirmModal
      open={state !== null}
      title={state?.options.title}
      message={state?.message ?? ''}
      confirmLabel={state?.options.confirmLabel}
      cancelLabel={state?.options.cancelLabel}
      destructive={state?.options.destructive}
      altLabel={state?.options.altLabel}
      onAlt={handleAlt}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, choose, modal }
}
