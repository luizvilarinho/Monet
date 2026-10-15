import {
  ArrowsMerge,
  DotsSixVertical,
  FolderSimple,
  Notebook as NotebookIcon,
  PlusCircle,
  SidebarSimple,
  X,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import type { Note, Notebook, Subject } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { CALENDAR_NOTEBOOK_ID } from '../../lib/calendar'
import { MergeNoteModal } from './MergeNoteModal'
import { NotebookPickerModal } from '../NotebookPickerModal/NotebookPickerModal'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import styles from './Sidebar.module.css'

interface SortableNoteItemProps {
  note: Note
  isActive: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onMerge?: (id: string) => void
  onMoveNote?: (id: string) => void
  subjects?: Subject[]
  onAssignSubject?: (noteId: string, subjectId: string | null) => void
  currentSubjectId?: string | null
}

function SortableNoteItem({ note, isActive, onSelect, onDelete, onMerge, onMoveNote, subjects, onAssignSubject, currentSubjectId }: SortableNoteItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [dropdownOpen])

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
        aria-label="drag to reorder"
      >
        <DotsSixVertical size={12} weight="bold" aria-hidden />
      </span>
      <span className={styles.rowLabel}>{note.title || 'untitled'}</span>
      {onMerge && (
        <button
          className={styles.rowMerge}
          onClick={(e) => { e.stopPropagation(); onMerge(note.id) }}
          aria-label={`merge note ${note.title || 'untitled'}`}
          type="button"
          title="merge into another note"
        >
          <ArrowsMerge size={11} aria-hidden />
        </button>
      )}
      {onAssignSubject && (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            className={`${styles.rowAssign} ${currentSubjectId ? styles.rowAssignActive : ''}`}
            onClick={(e) => { e.stopPropagation(); setDropdownOpen((v) => !v) }}
            aria-label={`assign subject to note ${note.title || 'untitled'}`}
            type="button"
            title="assign to subject"
          >
            <FolderSimple size={11} aria-hidden />
          </button>
          {dropdownOpen && (
            <div className={styles.subjectDropdown} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { onAssignSubject(note.id, null); setDropdownOpen(false) }}>
                No subject
              </button>
              {subjects?.map(s => (
                <button key={s.id} onClick={() => { onAssignSubject(note.id, s.id); setDropdownOpen(false) }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {onMoveNote && (
        <button
          className={styles.rowMove}
          onClick={(e) => { e.stopPropagation(); onMoveNote(note.id) }}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label={`move note ${note.title || 'untitled'} to another notebook`}
          type="button"
          title="move to another notebook"
        >
          <NotebookIcon size={11} aria-hidden />
        </button>
      )}
      <button
        className={styles.rowDelete}
        onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
        aria-label={`delete note ${note.title || 'untitled'}`}
        type="button"
      >
        <X size={12} weight="bold" aria-hidden />
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
  onMerge?: (sourceId: string, targetId: string) => void
  notebooks: Notebook[]
  onMoveNote?: (noteId: string, destNotebookId: string) => void
  width?: number
  // Cadernos ocultos: a coluna aceita largura maior (largura própria).
  wide?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onWidthChange?: (w: number) => void
  subjects?: Subject[]
  onAssignSubject?: (noteId: string, subjectId: string | null) => void
  // Seção de tasks do caderno ativo, abaixo da lista de notas.
  tasksSection?: ReactNode
}

export function Sidebar({
  notes,
  activeId,
  notebookSelected,
  onSelect,
  onCreate,
  onDelete,
  onReorder,
  onMerge,
  notebooks,
  onMoveNote,
  width = 220,
  wide = false,
  collapsed = false,
  onToggleCollapsed,
  onWidthChange,
  subjects,
  onAssignSubject,
  tasksSection,
}: SidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )
  const { confirm, modal } = useConfirm()
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null)
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const onMouseDown = useSidebarResize(width, onWidthChange, wide)

  async function handleDeleteNote(id: string, title: string) {
    const ok = await confirm(
      `Delete note "${title || 'untitled'}"?`,
      { title: 'Delete note' }
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
      {moveNoteId !== null && (() => {
        const moveNote = notes.find((n) => n.id === moveNoteId)
        if (!moveNote) return null
        return (
          <NotebookPickerModal
            title={`Move \u201C${moveNote.title || 'untitled'}\u201D to:`}
            confirmLabel="Move"
            notebooks={notebooks.filter(
              (nb) => nb.id !== moveNote.notebookId && nb.id !== CALENDAR_NOTEBOOK_ID
            )}
            onConfirm={(destNotebookId) => {
              onMoveNote?.(moveNoteId, destNotebookId)
              setMoveNoteId(null)
            }}
            onClose={() => setMoveNoteId(null)}
          />
        )
      })()}
      {mergeSourceId !== null && (() => {
        const sourceNote = notes.find((n) => n.id === mergeSourceId)
        if (!sourceNote) return null
        return (
          <MergeNoteModal
            sourceNote={sourceNote}
            notes={notes.filter((n) => n.id !== mergeSourceId)}
            onMerge={(targetId) => {
              onMerge?.(mergeSourceId, targetId)
              setMergeSourceId(null)
            }}
            onClose={() => setMergeSourceId(null)}
          />
        )
      })()}
      {!collapsed && <div className={styles.resizeHandle} onMouseDown={onMouseDown} />}
      {collapsed ? (
        <div className={styles.collapsedTop}>
          <button
            className={styles.headerToggle}
            onClick={onToggleCollapsed}
            aria-label="expand notes"
            title="expand notes"
            type="button"
          >
            <SidebarSimple size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <span>notes</span>
            <div className={styles.headerActions}>
              <button
                className={styles.headerToggle}
                onClick={onToggleCollapsed}
                aria-label="collapse notes"
                title="collapse notes"
                type="button"
              >
                <SidebarSimple size={16} aria-hidden />
              </button>
              <button
                className={styles.headerAdd}
                onClick={onCreate}
                disabled={!notebookSelected}
                aria-label="new note"
                type="button"
              >
                <PlusCircle size={16} weight="fill" aria-hidden />
              </button>
            </div>
          </div>
          <ul className={styles.list}>
            {notes.length === 0 ? (
              <li className={styles.empty}>no notes</li>
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
                      onMerge={onMerge ? setMergeSourceId : undefined}
                      onMoveNote={onMoveNote ? setMoveNoteId : undefined}
                      subjects={subjects}
                      onAssignSubject={onAssignSubject}
                      currentSubjectId={n.subjectId}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </ul>
          {tasksSection}
        </>
      )}
    </aside>
  )
}
