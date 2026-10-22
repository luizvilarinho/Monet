import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical, Trash } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import { MAX_METADATA_NAME } from '../../hooks/useMetadataDefs'
import { METADATA_TYPE_LABEL, metadataUsageCount } from '../../lib/metadata'
import type { MetadataDef, Task } from '../../types'
import styles from './StatusManagerModal.module.css'
import own from './MetadataManagerModal.module.css'

// Linha arrastável: só o handle inicia o drag (o input de renomear e o botão
// de excluir continuam clicáveis).
function SortableDefRow({ id, children }: { id: string; children: ReactNode }) {
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

// "Manage properties": renomear, excluir e reordenar (por arrasto) as
// definições de metadados. O tipo é somente leitura; definições novas nascem
// no popover da task.
interface MetadataManagerModalProps {
  open: boolean
  onClose: () => void
  defs: MetadataDef[]
  tasks: Task[]
  onRename: (id: string, name: string) => Promise<void>
  onRemove: (id: string) => void
  // Nova ordem dos metadados (ids na ordem final).
  onReorder?: (ids: string[]) => void
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
  onReorder,
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
  // O teclado assume o arrasto (o KeyboardSensor do dnd-kit); o ponteiro precisa
  // de 5px de deslocamento para não competir com o clique no input.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (!open) {
    focusedRef.current = false
    return null
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = defs.findIndex((d) => d.id === active.id)
    const newIndex = defs.findIndex((d) => d.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder?.(arrayMove(defs, oldIndex, newIndex).map((d) => d.id))
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
          if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) {
            // O modal da task (por baixo) ignora o Esc já tratado.
            e.preventDefault()
            onClose()
          }
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  'To pick up a property, press the space bar. While dragging, use the arrow keys to move the property. Press space again to drop it, or escape to cancel.',
              },
            }}
          >
            <SortableContext items={defs.map((d) => d.id)} strategy={verticalListSortingStrategy}>
              {defs.map((d) => (
                <SortableDefRow key={d.id} id={d.id}>
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
                </SortableDefRow>
              ))}
            </SortableContext>
          </DndContext>
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
