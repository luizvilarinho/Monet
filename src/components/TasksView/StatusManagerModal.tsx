import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical, Trash } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import { isTerminalStatus, openStatuses, statusColor } from '../../lib/tasks'
import type { Task, TaskStatusDef } from '../../types'
import { ColorDots } from './ColorDots'
import styles from './StatusManagerModal.module.css'

// "Manage statuses": criar (nome + cor), editar cor e limite WIP, renomear,
// excluir status custom e reordenar os abertos pelo handle. Built-ins só aceitam
// cor e WIP (Done/Dropped sem WIP, fixos no fim).
const MAX_NAME = 24

// Linha arrastável: só o handle inicia o drag (inputs e cores seguem clicáveis).
function SortableStatusRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className={styles.row}>
      <span className={styles.dragHandle} {...attributes} {...listeners} aria-label="drag to reorder">
        <DotsSixVertical size={12} weight="bold" aria-hidden />
      </span>
      {children}
    </div>
  )
}

interface StatusManagerModalProps {
  open: boolean
  onClose: () => void
  statuses: TaskStatusDef[]
  tasks: Task[]
  onCreate: (name: string, color: string | null) => Promise<unknown>
  onRename: (id: string, name: string) => void
  onUpdate: (id: string, change: { color?: string | null; wipLimit?: number | null }) => void
  onRemove: (id: string) => void
  onReorder: (openIds: string[]) => void
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
  onReorder,
}: StatusManagerModalProps) {
  const { confirm, modal } = useConfirm()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Contagem recalculada no momento do confirm (não a do render).
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (!open) return null

  const openList = openStatuses(statuses)
  const terminal = statuses.filter((s) => isTerminalStatus(s.id))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = openList.findIndex((s) => s.id === active.id)
    const newIndex = openList.findIndex((s) => s.id === over.id)
    onReorder(arrayMove(openList, oldIndex, newIndex).map((s) => s.id))
  }

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

  function renderCells(s: TaskStatusDef) {
    const hasWip = !isTerminalStatus(s.id)
    return (
      <>
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
      </>
    )
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
          if (e.key === 'Escape') {
            // O modal da task (por baixo) ignora o Esc já tratado.
            e.preventDefault()
            onClose()
          }
        }}
      >
        <div className={styles.header}>
          <p className={styles.title}>Manage statuses</p>
          <button type="button" className={styles.close} onClick={onClose}>
            Done
          </button>
        </div>
        <div className={styles.list}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={openList.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {openList.map((s) => (
                <SortableStatusRow key={s.id} id={s.id}>
                  {renderCells(s)}
                </SortableStatusRow>
              ))}
            </SortableContext>
          </DndContext>
          {terminal.map((s) => (
            <div key={s.id} className={styles.row}>
              <span className={styles.dragSpacer} />
              {renderCells(s)}
            </div>
          ))}
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
