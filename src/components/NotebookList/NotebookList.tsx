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
  DotsSixVertical,
  FileText,
  Gear,
  PlusCircle,
  SidebarSimple,
  X,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfirm } from '../../hooks/useConfirm'
import type { Notebook } from '../../types'
import styles from './NotebookList.module.css'

const MIN_WIDTH = 140
const MAX_WIDTH = 320

interface SortableNotebookItemProps {
  nb: Notebook
  isActive: boolean
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
          aria-label="arrastar para reordenar"
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
        <span className={styles.rowLabel}>{nb.name || 'sem nome'}</span>
      )}
      {editing?.id !== nb.id && (
        <>
          <button
            className={styles.rowDocs}
            onClick={(e) => { e.stopPropagation(); onSelect(nb.id); onOpenDocuments(nb.id) }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`documentos do caderno ${nb.name}`}
            title="documentos do caderno"
            type="button"
          >
            <FileText size={13} aria-hidden />
          </button>
          <button
            className={styles.rowDelete}
            onClick={(e) => { e.stopPropagation(); onDelete(nb.id) }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`apagar caderno ${nb.name}`}
            type="button"
          >
            <X size={12} weight="bold" aria-hidden />
          </button>
        </>
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
  tags: string[]
  activeTag: string | null
  onSelectTag: (tag: string | null) => void
  onOpenSettings: () => void
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
  tags,
  activeTag,
  onSelectTag,
  onOpenSettings,
  width = 180,
  collapsed = false,
  onToggleCollapsed,
  onWidthChange,
  onReorder,
}: NotebookListProps) {
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
      `Apagar o caderno "${name}" e todas as anotações dele?`,
      { title: 'Apagar caderno' }
    )
    if (ok) onDelete(id)
  }

  function commitEdit() {
    if (!editing) return
    const name = editing.value.trim()
    if (name) onRename(editing.id, name)
    setEditing(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = notebooks.findIndex((n) => n.id === active.id)
    const newIndex = notebooks.findIndex((n) => n.id === over.id)
    const reordered = arrayMove(notebooks, oldIndex, newIndex)
    onReorder?.(reordered.map((n) => n.id))
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
            aria-label="expandir cadernos"
            title="expandir cadernos"
            type="button"
          >
            <SidebarSimple size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <div className={styles.scrollArea}>
          <section className={styles.section}>
            <div className={styles.header}>
              <span>cadernos</span>
              <div className={styles.headerActions}>
                <button
                  className={styles.headerToggle}
                  onClick={onToggleCollapsed}
                  aria-label="recolher cadernos"
                  title="recolher cadernos"
                  type="button"
                >
                  <SidebarSimple size={16} aria-hidden />
                </button>
                <button className={styles.headerAdd} onClick={onCreate} aria-label="novo caderno" type="button">
                  <PlusCircle size={16} weight="fill" aria-hidden />
                </button>
              </div>
            </div>
            <ul className={styles.list}>
              <li
                className={`${styles.row} ${activeId === null ? styles.active : ''}`}
                onClick={() => onSelect(null)}
              >
                <span className={`${styles.rowLabel} ${styles.allNotes}`}>todas as notas</span>
              </li>

              {notebooks.length === 0 ? (
                <li className={styles.empty}>nenhum caderno</li>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={notebooks.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                    {notebooks.map((nb) => (
                      <SortableNotebookItem
                        key={nb.id}
                        nb={nb}
                        isActive={nb.id === activeId}
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
                <li className={styles.empty}>nenhuma tag</li>
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
        {!collapsed && <span className={styles.version}>v1.2.2</span>}
        <button
          className={styles.settings}
          onClick={onOpenSettings}
          aria-label="configurações"
          type="button"
        >
          <Gear size={16} aria-hidden />
          
        </button>
        
      </div>
    </aside>
  )
}
