import { X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useConfirm } from '../../hooks/useConfirm'
import type { ChatFolder, SystemPromptMode } from '../../hooks/useChat'
import { DISCARD_CHANGES_CONFIRM } from './discardChanges'
import styles from './FolderSystemPromptModal.module.css'

export interface FolderSystemPromptModalProps {
  open: boolean
  folder: ChatFolder | null
  onConfirm: (folderId: string, text: string, mode: SystemPromptMode) => void
  onClose: () => void
}

export function FolderSystemPromptModal({
  open,
  folder,
  onConfirm,
  onClose,
}: FolderSystemPromptModalProps) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<SystemPromptMode>('replace')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const { confirm, modal: confirmModal } = useConfirm()

  // Load saved folder values on open
  useEffect(() => {
    if (!open || !folder) return
    setText(folder.systemPrompt ?? '')
    setMode(folder.systemPromptMode ?? 'replace')
  }, [open, folder])

  // Auto-foco no textarea
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  // Edição não salva: fechar sem o Save pede confirmação.
  const dirty =
    !!folder && (text !== (folder.systemPrompt ?? '') || mode !== (folder.systemPromptMode ?? 'replace'))
  const requestCloseRef = useRef<() => void>(() => {})
  requestCloseRef.current = () => {
    if (!dirty) {
      onClose()
      return
    }
    void confirm('Your changes to this prompt will be lost.', DISCARD_CHANGES_CONFIRM).then((ok) => {
      if (ok) onClose()
    })
  }

  // Fecha com ESC (o modal de confirmação, aberto, fica com o ESC)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !folder) return null
  // Captura local com narrowing preservado — o TS perde o narrowing de
  // `folder` dentro de closures (handleConfirm), entao guardamos o id aqui.
  const folderId = folder.id

  function handleConfirm() {
    onConfirm(folderId, text, mode)
    onClose()
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Configure folder system prompt"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestCloseRef.current()
      }}
    >
      {confirmModal}
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            System prompt — {folder.name || 'unnamed'}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={() => requestCloseRef.current()}
            aria-label="Close"
            title="Close"
          >
            <X size={14} aria-hidden />
          </button>
        </header>

        <div className={styles.body}>
          <p className={styles.intro}>
            This is a space to customize how the AI behaves in conversations
            within this folder. Write an instruction to set tone, focus, or
            context — all conversations inside the folder will use it automatically.
          </p>

          <label className={styles.label} htmlFor="folder-sysprompt-text">
            Instruction for the AI
          </label>
          <textarea
            id="folder-sysprompt-text"
            ref={textareaRef}
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g.: You are a biology tutor. Use technical language, cite recent studies, and always relate concepts to practical examples."
            rows={8}
            aria-label="instruction for the AI"
          />

          <label className={styles.label} htmlFor="folder-sysprompt-mode">
            Application mode
          </label>
          <select
            id="folder-sysprompt-mode"
            className={styles.select}
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as SystemPromptMode)
            }
            aria-label="application mode"
          >
            <option value="replace">
              Replace — use only this prompt
            </option>
            <option value="append">
              Append — combine with the default prompt
            </option>
          </select>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => requestCloseRef.current()}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleConfirm}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
