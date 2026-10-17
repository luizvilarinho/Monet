import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import { MAX_METADATA_NAME } from '../../hooks/useMetadataDefs'
import { METADATA_TYPE_LABEL, metadataUsageCount } from '../../lib/metadata'
import type { MetadataDef, Task } from '../../types'
import styles from './StatusManagerModal.module.css'
import own from './MetadataManagerModal.module.css'

// "Manage properties": renomear e excluir definições de metadados. O tipo é
// somente leitura; definições novas nascem no popover da task.
interface MetadataManagerModalProps {
  open: boolean
  onClose: () => void
  defs: MetadataDef[]
  tasks: Task[]
  onRename: (id: string, name: string) => Promise<void>
  onRemove: (id: string) => void
  // Definição cujo nome recebe o foco ao abrir (lápis da propriedade na task).
  focusId?: string | null
}

export function MetadataManagerModal({
  open,
  onClose,
  defs,
  tasks,
  onRename,
  onRemove,
  focusId = null,
}: MetadataManagerModalProps) {
  const { confirm, modal } = useConfirm()
  const [error, setError] = useState<string | null>(null)
  // Contagem recalculada no momento do confirm (não a do render).
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  // Esc no input descarta o rascunho (o blur que segue não grava).
  const cancelRef = useRef(false)
  // Foco do lápis só na primeira montagem: renomear remonta o input (key).
  const focusedRef = useRef(false)

  if (!open) {
    focusedRef.current = false
    return null
  }

  async function commitRename(d: MetadataDef, input: HTMLInputElement) {
    if (cancelRef.current) {
      cancelRef.current = false
      input.value = d.name
      return
    }
    if (input.value.trim() === d.name) return
    try {
      await onRename(d.id, input.value)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      input.value = d.name
    }
  }

  async function handleRemove(d: MetadataDef) {
    const count = metadataUsageCount(tasksRef.current, d.id)
    const message =
      count > 0
        ? `Delete property "${d.name}"? It is set on ${count} task${count === 1 ? '' : 's'}; those values will be removed.`
        : `Delete property "${d.name}"?`
    const ok = await confirm(message, {
      title: 'Delete property',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (ok) onRemove(d.id)
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Manage properties"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) onClose()
        }}
      >
        <div className={styles.header}>
          <p className={styles.title}>Manage properties</p>
          <button type="button" className={styles.close} onClick={onClose}>
            Done
          </button>
        </div>
        <div className={styles.list}>
          {defs.length === 0 && <p className={own.empty}>No properties yet. Add one from a task.</p>}
          {defs.map((d) => (
            <div key={d.id} className={styles.row}>
              <input
                className={styles.nameInput}
                key={d.name}
                defaultValue={d.name}
                maxLength={MAX_METADATA_NAME}
                ref={(el) => {
                  if (el && d.id === focusId && !focusedRef.current) {
                    focusedRef.current = true
                    el.focus()
                  }
                }}
                aria-label={`rename ${d.name}`}
                onBlur={(e) => void commitRename(d, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    cancelRef.current = true
                    e.currentTarget.blur()
                  }
                }}
              />
              <span className={own.type}>{METADATA_TYPE_LABEL[d.type]}</span>
              <button
                type="button"
                className={styles.delete}
                onClick={() => void handleRemove(d)}
                aria-label={`delete ${d.name}`}
                title="Delete property"
              >
                <Trash size={13} aria-hidden />
              </button>
            </div>
          ))}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {modal}
      </div>
    </div>,
    document.body
  )
}
