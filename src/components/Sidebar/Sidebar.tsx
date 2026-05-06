import { useCallback, useEffect, useRef } from 'react'
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
import { useConfirm } from '../../hooks/useConfirm'
import styles from './Sidebar.module.css'

const MIN_WIDTH = 160
const MAX_WIDTH = 400

const ChevronIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {collapsed ? <polyline points="6 3.5 10.5 8 6 12.5" /> : <polyline points="10 3.5 5.5 8 10 12.5" />}
  </svg>
)

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
        onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
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
  width?: number
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onWidthChange?: (w: number) => void
}

export function Sidebar({
  notes,
  activeId,
  notebookSelected,
  onSelect,
  onCreate,
  onDelete,
  onReorder,
  width = 220,
  collapsed = false,
  onToggleCollapsed,
  onWidthChange,
}: SidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )
  const { confirm, modal } = useConfirm()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const currentWidthRef = useRef(width)

  useEffect(() => {
    currentWidthRef.current = width
  }, [width])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      currentWidthRef.current = next
      onWidthChange?.(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('monet:sidebar-width', String(currentWidthRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onWidthChange])

  async function handleDeleteNote(id: string, title: string) {
    const ok = await confirm(
      `Apagar a anotação "${title || 'sem título'}"?`,
      { title: 'Apagar anotação' }
    )
    if (ok) onDelete(id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = notes.findIndex((n) => n.id === active.id)
    const newIndex = notes.findIndex((n) => n.id === over.id)
    const reordered = arrayMove(notes, oldIndex, newIndex)
    onReorder(reordered.map((n) => n.id))
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`} style={{ width }}>
      {modal}
      {!collapsed && <div className={styles.resizeHandle} onMouseDown={onMouseDown} />}
      {collapsed ? (
        <div className={styles.collapsedTop}>
          <button
            className={styles.headerToggle}
            onClick={onToggleCollapsed}
            aria-label="expandir anotações"
            title="expandir anotações"
            type="button"
          >
            <ChevronIcon collapsed />
          </button>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <span>anotações</span>
            <div className={styles.headerActions}>
              <button
                className={styles.headerToggle}
                onClick={onToggleCollapsed}
                aria-label="recolher anotações"
                title="recolher anotações"
                type="button"
              >
                <ChevronIcon collapsed={false} />
              </button>
              <button
                className={styles.headerAdd}
                onClick={onCreate}
                disabled={!notebookSelected}
                aria-label="nova anotação"
                type="button"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="8" y1="3" x2="8" y2="13" />
                  <line x1="3" y1="8" x2="13" y2="8" />
                </svg>
              </button>
            </div>
          </div>
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
                      onDelete={(id) => handleDeleteNote(id, n.title)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </ul>
        </>
      )}
    </aside>
  )
}
