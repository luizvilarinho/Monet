import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Note } from '../../types'
import styles from './Sidebar.module.css'

interface SortableNoteItemProps {
  note: Note
  isActive: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function SortableNoteItem({ note, isActive, onSelect, onDelete }: SortableNoteItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`${styles.row} ${isActive ? styles.active : ''}`}
      onClick={() => onSelect(note.id)}
    >
      <span
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="arrastar para reordenar"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="4" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="11" cy="4" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="11" cy="12" r="1.2" />
        </svg>
      </span>
      <span className={styles.rowLabel}>{note.title || 'sem título'}</span>
      <button
        className={styles.rowDelete}
        onClick={(e) => {
          e.stopPropagation()
          if (window.confirm(`apagar a anotação "${note.title || 'sem título'}"?`)) {
            onDelete(note.id)
          }
        }}
        aria-label={`apagar anotação ${note.title || 'sem título'}`}
        type="button"
      >
        ×
      </button>
    </li>
  )
}

export interface SidebarProps {
  notes: Note[]
  activeId: string | null
  notebookSelected: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onReorder: (newOrder: string[]) => void
}

export function Sidebar({
  notes,
  activeId,
  notebookSelected,
  onSelect,
  onCreate,
  onDelete,
  onReorder,
}: SidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = notes.findIndex((n) => n.id === active.id)
    const newIndex = notes.findIndex((n) => n.id === over.id)
    const reordered = arrayMove(notes, oldIndex, newIndex)
    onReorder(reordered.map((n) => n.id))
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>anotações</div>
      <button
        className={styles.newNote}
        onClick={onCreate}
        disabled={!notebookSelected}
      >
        + nova anotação
      </button>
      <ul className={styles.list}>
        {notes.length === 0 ? (
          <li className={styles.empty}>nenhuma anotação</li>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              {notes.map((n) => (
                <SortableNoteItem
                  key={n.id}
                  note={n}
                  isActive={n.id === activeId}
                  onSelect={onSelect}
                  onDelete={onDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </ul>
    </aside>
  )
}
