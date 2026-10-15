import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import { statusColor } from '../../lib/tasks'
import type { Task, TaskStatusDef } from '../../types'
import { ColorDots } from './ColorDots'
import styles from './StatusManagerModal.module.css'

// "Manage statuses": criar (nome + cor), editar cor e limite WIP, renomear e
// excluir status custom. Built-ins só aceitam cor e WIP (Done/Dropped sem WIP).
const MAX_NAME = 24

interface StatusManagerModalProps {
  open: boolean
  onClose: () => void
  statuses: TaskStatusDef[]
  tasks: Task[]
  onCreate: (name: string, color: string | null) => Promise<unknown>
  onRename: (id: string, name: string) => void
  onUpdate: (id: string, change: { color?: string | null; wipLimit?: number | null }) => void
  onRemove: (id: string) => void
}

export function StatusManagerModal({
  open,
  onClose,
  statuses,
  tasks,
  onCreate,
  onRename,
  onUpdate,
  onRemove,
}: StatusManagerModalProps) {
  const { confirm, modal } = useConfirm()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Contagem recalculada no momento do confirm (não a do render).
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  if (!open) return null

  // Erro de validação do nome (null = válido); `selfId` ignora o próprio status.
  function validateName(raw: string, selfId?: string): string | null {
    const name = raw.trim()
    if (!name) return 'Name cannot be empty.'
    if (name.length > MAX_NAME) return `Name must have at most ${MAX_NAME} characters.`
    const clash = statuses.some((s) => s.id !== selfId && s.name.toLowerCase() === name.toLowerCase())
    return clash ? 'A status with this name already exists.' : null
  }

  async function handleCreate() {
    const problem = validateName(newName)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    await onCreate(newName, newColor)
    setNewName('')
    setNewColor(null)
  }

  function commitRename(s: TaskStatusDef, raw: string) {
    if (raw.trim() === s.name) return
    const problem = validateName(raw, s.id)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    onRename(s.id, raw)
  }

  function commitWip(s: TaskStatusDef, raw: string) {
    const n = Number.parseInt(raw, 10)
    const wipLimit = Number.isFinite(n) && n > 0 ? n : null
    if (wipLimit !== s.wipLimit) onUpdate(s.id, { wipLimit })
  }

  async function handleRemove(s: TaskStatusDef) {
    const count = tasksRef.current.filter((t) => t.status === s.id).length
    const message =
      count > 0
        ? `Delete status "${s.name}"? ${count} task${count === 1 ? '' : 's'} will move to To do.`
        : `Delete status "${s.name}"?`
    const ok = await confirm(message, {
      title: 'Delete status',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (ok) onRemove(s.id)
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
        aria-label="Manage statuses"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <div className={styles.header}>
          <p className={styles.title}>Manage statuses</p>
          <button type="button" className={styles.close} onClick={onClose}>
            Done
          </button>
        </div>
        <div className={styles.list}>
          {statuses.map((s) => {
            const hasWip = s.id !== 'done' && s.id !== 'dropped'
            return (
              <div key={s.id} className={styles.row}>
                <span
                  className={styles.swatch}
                  style={{ background: statusColor(s.id, statuses) }}
                  aria-hidden
                />
                {s.builtin ? (
                  <span className={styles.name}>{s.name}</span>
                ) : (
                  <input
                    className={styles.nameInput}
                    key={s.name}
                    defaultValue={s.name}
                    maxLength={MAX_NAME}
                    aria-label={`rename ${s.name}`}
                    onBlur={(e) => commitRename(s, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                  />
                )}
                <ColorDots
                  value={s.color}
                  onChange={(color) => onUpdate(s.id, { color })}
                  label={`${s.name} color`}
                  allowNone={s.builtin}
                />
                {hasWip ? (
                  <input
                    className={styles.wip}
                    type="number"
                    key={s.wipLimit ?? 'none'}
                    min={1}
                    defaultValue={s.wipLimit ?? ''}
                    placeholder="WIP"
                    title="WIP limit (warns when exceeded)"
                    aria-label={`${s.name} WIP limit`}
                    onBlur={(e) => commitWip(s, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                  />
                ) : (
                  <span className={styles.wipSpacer} />
                )}
                {s.builtin ? (
                  <span className={styles.deleteSpacer} />
                ) : (
                  <button
                    type="button"
                    className={styles.delete}
                    onClick={() => void handleRemove(s)}
                    aria-label={`delete ${s.name}`}
                    title="Delete status"
                  >
                    <Trash size={13} aria-hidden />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className={styles.create}>
          <input
            className={styles.nameInput}
            value={newName}
            maxLength={MAX_NAME}
            placeholder="New status…"
            aria-label="new status name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
            }}
          />
          <ColorDots value={newColor} onChange={setNewColor} label="new status color" allowNone />
          <button type="button" className={styles.add} onClick={() => void handleCreate()}>
            Add
          </button>
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
