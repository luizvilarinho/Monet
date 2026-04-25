import { useCallback, useState } from 'react'
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface ConfirmState {
  message: string
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ message, options, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state?.resolve(true)
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve(false)
    setState(null)
  }

  const modal = (
    <ConfirmModal
      open={state !== null}
      title={state?.options.title}
      message={state?.message ?? ''}
      confirmLabel={state?.options.confirmLabel}
      cancelLabel={state?.options.cancelLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, modal }
}
