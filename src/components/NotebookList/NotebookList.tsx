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
import {
  Books,
  CalendarBlank,
  DotsSixVertical,
  FileText,
  Folder,
  Gear,
  Plus,
  PlusCircle,
  SidebarSimple,
  X,
} from '@phosphor-icons/react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useConfirm } from '../../hooks/useConfirm'
import type { Notebook, Subject } from '../../types'
import styles from './NotebookList.module.css'

const MIN_WIDTH = 140
const MAX_WIDTH = 320

interface SortableNotebookItemProps {
  nb: Notebook
  isActive: boolean
  hasVisibleDocs: boolean
  editing: { id: string; value: string } | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onOpenDocuments: (id: string) => void
  onStartEdit: (id: string, value: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onEditChange: (id: string, value: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

function SortableNotebookItem({
  nb,
  isActive,
  hasVisibleDocs,
  editing,
  onSelect,
  onDelete,
  onOpenDocuments,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onEditChange,
  inputRef,
}: SortableNotebookItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: nb.id,
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
      onClick={() => {
        if (editing?.id === nb.id) return
        onSelect(nb.id)
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        onStartEdit(nb.id, nb.name)
      }}
    >
      {editing?.id !== nb.id && (
        <span
          className={styles.dragHandle}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="drag to reorder"
        >
          <DotsSixVertical size={12} weight="bold" aria-hidden />
        </span>
      )}
      {editing?.id === nb.id ? (
        <input
          autoFocus
          ref={inputRef}
          className={styles.renameInput}
          value={editing.value}
          onChange={(e) => onEditChange(nb.id, e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitEdit()
            if (e.key === 'Escape') onCancelEdit()
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={styles.rowLabel}>{nb.name || 'unnamed'}</span>
      )}
      {editing?.id !== nb.id && (
        <>
          <button
            className={`${styles.rowDocs} ${hasVisibleDocs ? styles.rowDocsActive : ''}`}
            onClick={(e) => { e.stopPropagation(); onSelect(nb.id); onOpenDocuments(nb.id) }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`documents for notebook ${nb.name}`}
            title={hasVisibleDocs ? 'notebook documents (active)' : 'notebook documents'}
            type="button"
          >
            <FileText size={13} aria-hidden />
          </button>
          <button
            className={styles.rowDelete}
            onClick={(e) => { e.stopPropagation(); onDelete(nb.id) }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`delete notebook ${nb.name}`}
            type="button"
          >
            <X size={12} weight="bold" aria-hidden />
          </button>
        </>
      )}
    </li>
  )
}

interface SortableSubjectItemProps {
  subject: Subject
  isActive: boolean
  editing: { id: string; value: string } | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onStartEdit: (id: string, value: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onEditChange: (id: string, value: string) => void
  subjectInputRef: React.RefObject<HTMLInputElement | null>
}

function SortableSubjectItem({
  subject,
  isActive,
  editing,
  onSelect,
  onDelete,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onEditChange,
  subjectInputRef,
}: SortableSubjectItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subject.id,
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
      className={`${styles.subjectRow} ${isActive ? styles.active : ''}`}
      onClick={() => {
        if (editing?.id === subject.id) return
        onSelect(subject.id)
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        onStartEdit(subject.id, subject.name)
      }}
    >
      {editing?.id !== subject.id && (
        <span
          className={styles.subjectDragHandle}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="drag to reorder"
        >
          <DotsSixVertical size={10} weight="bold" aria-hidden />
        </span>
      )}
      <span className={styles.subjectIcon}>
        <Folder size={13} aria-hidden />
      </span>
      {editing?.id === subject.id ? (
        <input
          autoFocus
          ref={subjectInputRef}
          className={styles.subjectRenameInput}
          value={editing.value}
          onChange={(e) => onEditChange(subject.id, e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitEdit()
            if (e.key === 'Escape') onCancelEdit()
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={styles.subjectLabel}>{subject.name || 'unnamed'}</span>
      )}
      {editing?.id !== subject.id && (
        <button
          className={styles.subjectDelete}
          onClick={(e) => { e.stopPropagation(); onDelete(subject.id) }}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label={`delete subject ${subject.name}`}
          type="button"
        >
          <X size={11} weight="bold" aria-hidden />
        </button>
      )}
    </li>
  )
}

export interface NotebookListProps {
  notebooks: Notebook[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onOpenDocuments: (id: string) => void
  onOpenKnowledgeBase: () => void
  notebooksWithDocs: Set<string>
  tags: string[]
  activeTag: string | null
  onSelectTag: (tag: string | null) => void
  onOpenSettings: () => void
  calendarNotebookId?: string | null
  subjects: Subject[]
  activeSubjectId: string | null
  onSelectSubject: (id: string | null) => void
  onCreateSubject: () => void
  onDeleteSubject: (id: string) => void
  onRenameSubject: (id: string, name: string) => void
  onReorderSubjects: (newOrder: string[]) => void
  width?: number
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onWidthChange?: (w: number) => void
  onReorder?: (newOrder: string[]) => void
}

export function NotebookList({
  notebooks,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onOpenDocuments,
  onOpenKnowledgeBase,
  notebooksWithDocs,
  tags,
  activeTag,
  onSelectTag,
  onOpenSettings,
  calendarNotebookId,
  subjects,
  activeSubjectId,
  onSelectSubject,
  onCreateSubject,
  onDeleteSubject,
  onRenameSubject,
  onReorderSubjects,
  width = 180,
  collapsed = false,
  onToggleCollapsed,
  onWidthChange,
  onReorder,
}: NotebookListProps) {
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [subjectEditing, setSubjectEditing] = useState<{ id: string; value: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const { confirm, modal } = useConfirm()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const currentWidthRef = useRef(width)

  useEffect(() => {
    currentWidthRef.current = width
  }, [width])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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
      localStorage.setItem('monet:notebook-width', String(currentWidthRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onWidthChange])

  async function handleDeleteNotebook(id: string, name: string) {
    const ok = await confirm(
      `Delete notebook "${name}" and all its notes?`,
      { title: 'Delete notebook' }
    )
    if (ok) onDelete(id)
  }

  async function handleDeleteSubject(id: string, name: string) {
    const ok = await confirm(
      `Delete subject "${name}" and all its notes?`,
      { title: 'Delete subject' }
    )
    if (ok) onDeleteSubject(id)
  }

  function commitEdit() {
    if (!editing) return
    const name = editing.value.trim()
    if (name) onRename(editing.id, name)
    setEditing(null)
  }

  function commitSubjectEdit() {
    if (!subjectEditing) return
    const name = subjectEditing.value.trim()
    if (name) onRenameSubject(subjectEditing.id, name)
    setSubjectEditing(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = notebooks.findIndex((n) => n.id === active.id)
    const newIndex = notebooks.findIndex((n) => n.id === over.id)
    const reordered = arrayMove(notebooks, oldIndex, newIndex)
    onReorder?.(reordered.map((n) => n.id))
  }

  function handleSubjectDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = subjects.findIndex((s) => s.id === active.id)
    const newIndex = subjects.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(subjects, oldIndex, newIndex)
    onReorderSubjects(reordered.map((s) => s.id))
  }

  return (
    <aside className={`${styles.notebooks} ${collapsed ? styles.collapsed : ''}`} style={{ width }}>
      {modal}
      {!collapsed && <div className={styles.resizeHandle} onMouseDown={onMouseDown} />}
      {collapsed ? (
        <div className={styles.collapsedTop}>
          <button
            className={styles.headerToggle}
            onClick={onToggleCollapsed}
            aria-label="expand notebooks"
            title="expand notebooks"
            type="button"
          >
            <SidebarSimple size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <div className={styles.scrollArea}>
          <section className={styles.section}>
            <div className={styles.header}>
              <span>notebooks</span>
              <div className={styles.headerActions}>
                <button
                  className={styles.headerToggle}
                  onClick={onToggleCollapsed}
                  aria-label="collapse notebooks"
                  title="collapse notebooks"
                  type="button"
                >
                  <SidebarSimple size={16} aria-hidden />
                </button>
                <button className={styles.headerAdd} onClick={onCreate} aria-label="new notebook" type="button">
                  <PlusCircle size={16} weight="fill" aria-hidden />
                </button>
              </div>
            </div>
            <ul className={styles.list}>
              <li
                className={`${styles.row} ${activeId === null ? styles.active : ''}`}
                onClick={() => onSelect(null)}
              >
                <span className={`${styles.rowLabel} ${styles.allNotes}`}>all notes</span>
              </li>

              {calendarNotebookId && (() => {
                const calNb = notebooks.find((n) => n.id === calendarNotebookId)
                if (!calNb) return null
                return (
                  <li
                    className={`${styles.row} ${calNb.id === activeId ? styles.active : ''}`}
                    onClick={() => onSelect(calNb.id)}
                  >
                    <span className={styles.calendarIcon}>
                      <CalendarBlank size={16} aria-hidden />
                    </span>
                    <span className={styles.rowLabel}>{calNb.name}</span>
                  </li>
                )
              })()}

              {notebooks.filter((n) => n.id !== calendarNotebookId).length === 0 &&
               !calendarNotebookId ? (
                <li className={styles.empty}>no notebooks</li>
              ) : notebooks.filter((n) => n.id !== calendarNotebookId).length === 0 ? null : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={notebooks.filter((n) => n.id !== calendarNotebookId).map((n) => n.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {notebooks.filter((n) => n.id !== calendarNotebookId).map((nb) => (
                      <Fragment key={nb.id}>
                        <SortableNotebookItem
                          nb={nb}
                          isActive={nb.id === activeId}
                          hasVisibleDocs={notebooksWithDocs.has(nb.id)}
                          editing={editing}
                          onSelect={onSelect}
                          onDelete={(id) => handleDeleteNotebook(id, nb.name)}
                          onOpenDocuments={onOpenDocuments}
                          onStartEdit={(id, value) => setEditing({ id, value })}
                          onCommitEdit={commitEdit}
                          onCancelEdit={() => setEditing(null)}
                          onEditChange={(id, value) => setEditing({ id, value })}
                          inputRef={inputRef}
                        />
                        <li className={`${styles.subjectContainer} ${nb.id === activeId ? styles.open : ''}`}>
                          {nb.id === activeId && (
                            <>
                              <div className={styles.subjectHeader}>
                                <span className={styles.subjectHeaderLabel}>subjects</span>
                                <button
                                  className={styles.subjectAdd}
                                  onClick={onCreateSubject}
                                  aria-label="new subject"
                                  type="button"
                                  title="New subject"
                                >
                                  <Plus size={12} weight="bold" aria-hidden />
                                </button>
                              </div>
                              {subjects.length > 0 && (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubjectDragEnd}>
                                  <SortableContext
                                    items={subjects.map((s) => s.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <ul className={styles.subjectList}>
                                      {subjects.map((subject) => (
                                        <SortableSubjectItem
                                          key={subject.id}
                                          subject={subject}
                                          isActive={subject.id === activeSubjectId}
                                          editing={subjectEditing}
                                          onSelect={onSelectSubject}
                                          onDelete={(id) => handleDeleteSubject(id, subject.name)}
                                          onStartEdit={(id, value) => setSubjectEditing({ id, value })}
                                          onCommitEdit={commitSubjectEdit}
                                          onCancelEdit={() => setSubjectEditing(null)}
                                          onEditChange={(id, value) => setSubjectEditing({ id, value })}
                                          subjectInputRef={subjectInputRef}
                                        />
                                      ))}
                                    </ul>
                                  </SortableContext>
                                </DndContext>
                              )}
                            </>
                          )}
                        </li>
                      </Fragment>
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </ul>
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <div className={styles.header}>tags</div>
            <ul className={styles.list}>
              {tags.length === 0 ? (
                <li className={styles.empty}>no tags</li>
              ) : (
                tags.map((t) => (
                  <li
                    key={t}
                    className={t === activeTag ? styles.active : undefined}
                    onClick={() => onSelectTag(t === activeTag ? null : t)}
                  >
                    #{t}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      )}

      <div className={`${styles.footer} ${collapsed ? styles.footerCollapsed : ''}`}>
        {!collapsed && <span className={styles.version}>v1.3.8</span>}
        <button
          className={styles.settings}
          onClick={onOpenKnowledgeBase}
          aria-label="knowledge base"
          type="button"
          title="Knowledge Base"
        >
          <Books size={16} aria-hidden />
        </button>
        <button
          className={styles.settings}
          onClick={onOpenSettings}
          aria-label="settings"
          type="button"
        >
          <Gear size={16} aria-hidden />
        </button>
      </div>
    </aside>
  )
}
