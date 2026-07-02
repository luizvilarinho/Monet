import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChatFolder } from '../../hooks/useChat'
import styles from './FolderMemoryModal.module.css'

export interface FolderMemoryModalProps {
  open: boolean
  folder: ChatFolder | null
  onConfirm: (folderId: string, text: string) => void
  onClose: () => void
}

export function FolderMemoryModal({
  open,
  folder,
  onConfirm,
  onClose,
}: FolderMemoryModalProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!open || !folder) return
    setText(folder.memory ?? '')
  }, [open, folder])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !folder) return null
  const folderId = folder.id

  function handleConfirm() {
    onConfirm(folderId, text)
    onClose()
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Folder memory"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            Folder memory — {folder.name || 'unnamed'}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="close"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          <p className={styles.intro}>
            This is the AI's working memory for this folder — a summary of
            what it considers worth remembering across conversations here.
            Read it, edit it, or clear it freely; it is only updated
            automatically when "Folder memory" is enabled in Tools.
          </p>

          <label className={styles.label} htmlFor="folder-memory-text">
            Memory content
          </label>
          <textarea
            id="folder-memory-text"
            ref={textareaRef}
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nothing recorded yet. The AI fills this in automatically as you chat (when Folder memory is enabled), or you can write your own notes here."
            rows={12}
            aria-label="folder memory content"
          />

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleConfirm}
            >
              save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
