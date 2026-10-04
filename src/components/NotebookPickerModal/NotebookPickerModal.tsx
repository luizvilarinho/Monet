import { useEffect, useState } from 'react'
import type { Notebook } from '../../types'
import styles from './NotebookPickerModal.module.css'

interface NotebookPickerModalProps {
  title: string
  confirmLabel: string
  notebooks: Notebook[]
  onConfirm: (notebookId: string) => void
  onClose: () => void
}

export function NotebookPickerModal({ title, confirmLabel, notebooks, onConfirm, onClose }: NotebookPickerModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleConfirm() {
    if (!selectedId) return
    onConfirm(selectedId)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <ul className={styles.list}>
          {notebooks.map((nb) => (
            <li
              key={nb.id}
              className={`${styles.item} ${selectedId === nb.id ? styles.itemSelected : ''}`}
              onClick={() => setSelectedId(nb.id)}
            >
              {nb.name || 'unnamed'}
            </li>
          ))}
        </ul>
        <div className={styles.footer}>
          <button className={styles.btnCancel} type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.btnConfirm}
            type="button"
            disabled={!selectedId}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
