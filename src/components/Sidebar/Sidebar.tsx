import {
  Archive,
  ArrowsDownUp,
  ArrowsMerge,
  CaretDown,
  Check,
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
import type { MetadataDef, Note, Notebook, NoteType, Subject } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { CALENDAR_NOTEBOOK_ID } from '../../lib/calendar'
import { isTodosNote, listPropertyValues } from '../../lib/noteTypes'
import { formatDueShort, type TodosProgress } from '../../lib/tasks'
import { NOTE_SORT_OPTIONS, type NoteSort } from '../../lib/noteOrder'
import { ArchivedNotesModal } from './ArchivedNotesModal'
import { MergeNoteModal } from './MergeNoteModal'
import { NotebookPickerModal } from '../NotebookPickerModal/NotebookPickerModal'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import styles from './Sidebar.module.css'

const EMPTY_PROGRESS = new Map<string, TodosProgress>()
const EMPTY_COUNTS = new Map<string, number>()
const EMPTY_NOTES: Note[] = []

interface SortableNoteItemProps {
  note: Note
  // Tipo da nota (ícone + nome acima do título, na cor do tipo); abaixo do
  // título, numa linha que quebra, o progresso da TODOS e as propriedades
  // "show in list". O título fica com a largura toda.
  type: NoteType | null
  meta: { text: string; tone: 'overdue' | 'complete' | null } | null
  properties: Array<{ def: MetadataDef; text: string }>
  isActive: boolean
  // Lista ordenada (não manual): sem arrastar.
  dragDisabled: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onArchive?: (id: string) => void
  onMerge?: (id: string) => void
  onMoveNote?: (id: string) => void
  subjects?: Subject[]
  onAssignSubject?: (noteId: string, subjectId: string | null) => void
  currentSubjectId?: string | null
}

function SortableNoteItem({ note, type, meta, properties, isActive, dragDisabled, onSelect, onDelete, onArchive, onMerge, onMoveNote, subjects, onAssignSubject, currentSubjectId }: SortableNoteItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    disabled: dragDisabled,
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
      className={`${styles.row} ${type || meta || properties.length > 0 ? styles.rowWrap : ''} ${isActive ? styles.active : ''}`}
      onClick={() => onSelect(note.id)}
    >
      <span
        className={`${styles.dragHandle} ${dragDisabled ? styles.dragHandleOff : ''}`}
        {...(dragDisabled ? {} : { ...attributes, ...listeners })}
        onClick={(e) => e.stopPropagation()}
        aria-label={dragDisabled ? undefined : 'drag to reorder'}
        aria-hidden={dragDisabled || undefined}
      >
        <DotsSixVertical size={12} weight="bold" aria-hidden />
      </span>
      {type && (
        <span className={styles.rowEyebrow} style={{ color: type.color ?? undefined }} title={type.name}>
          <TypeIcon name={type.icon} size={11} />
          <span className={styles.rowEyebrowName}>{type.name}</span>
        </span>
      )}
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
        <div className={styles.rowAssignWrap} ref={dropdownRef}>
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
      {onArchive && (
        <button
          className={styles.rowArchive}
          onClick={(e) => { e.stopPropagation(); onArchive(note.id) }}
          aria-label={`archive note ${note.title || 'untitled'}`}
          type="button"
          title="archive note"
        >
          <Archive size={11} aria-hidden />
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
      {(meta || properties.length > 0) && (
        <div className={styles.rowDetails}>
          {meta && (
            <span
              className={`${styles.rowDetail} ${
                meta.tone === 'overdue' ? styles.rowMetaOverdue : meta.tone === 'complete' ? styles.rowMetaComplete : ''
              }`}
              title={meta.text}
            >
              {meta.text}
            </span>
          )}
          {properties.map(({ def, text }) => (
            <span key={def.id} className={styles.rowDetail} title={`${def.name}: ${text}`}>
              {def.name}: {text}
            </span>
          ))}
        </div>
      )}
    </li>
  )
}

export interface SidebarProps {
  notes: Note[]
  // Arquivadas do caderno atual (já ordenadas): rodapé "Archived · N", que
  // abre o modal das arquivadas.
  archivedNotes?: Note[]
  onSetArchived?: (id: string, archived: boolean) => void
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
  // "New <tipo>" no menu ao lado do "+" (só quando há tipos).
  noteTypes?: NoteType[]
  onCreateTyped?: (typeId: string) => void
  // Propriedades de nota (valores "show in list") e progresso de cada TODOS.
  noteDefs?: MetadataDef[]
  todosProgress?: Map<string, TodosProgress>
  // Tasks vinculadas a cada TODOS (aviso na exclusão).
  todosTaskCount?: Map<string, number>
  // Filtro por tipo (N4): opções = tipos presentes na lista; null = todos.
  typeFilterOptions?: NoteType[]
  typeFilter?: string | null
  onTypeFilterChange?: (typeId: string | null) => void
  // Ordem da lista (as notas já chegam ordenadas); fora de 'manual', sem
  // arrastar. "Reorder types…" abre o modal de tipos na ordem dos tipos.
  sort?: NoteSort
  onSortChange?: (sort: NoteSort) => void
  onReorderTypes?: () => void
}

// Resumo abaixo do título: progresso na TODOS.
function noteMeta(
  note: Note,
  todosProgress: Map<string, TodosProgress>
): SortableNoteItemProps['meta'] {
  if (!isTodosNote(note)) return null
  const p = todosProgress.get(note.id)
  if (!p || p.total === 0) return null
  const due = p.nextDeadline ? ` · ⚑ ${formatDueShort(p.nextDeadline)}` : ''
  return {
    text: `${p.done}/${p.total}${due}`,
    tone: p.overdue ? 'overdue' : p.done === p.total ? 'complete' : null,
  }
}

export function Sidebar({
  notes,
  archivedNotes = EMPTY_NOTES,
  onSetArchived,
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
  noteTypes = [],
  onCreateTyped,
  noteDefs = [],
  todosProgress = EMPTY_PROGRESS,
  todosTaskCount = EMPTY_COUNTS,
  typeFilterOptions = [],
  typeFilter = null,
  onTypeFilterChange,
  sort = 'manual',
  onSortChange,
  onReorderTypes,
}: SidebarProps) {
  const typeById = new Map(noteTypes.map((t) => [t.id, t]))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )
  const { confirm, modal } = useConfirm()
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null)
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const onMouseDown = useSidebarResize(width, onWidthChange, wide)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const sortLabel = NOTE_SORT_OPTIONS.find((o) => o.id === sort)?.label ?? 'Manual'
  const [archivedOpen, setArchivedOpen] = useState(false)

  useEffect(() => {
    if (!newMenuOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [newMenuOpen])

  useEffect(() => {
    if (!sortMenuOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setSortMenuOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setSortMenuOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [sortMenuOpen])

  async function handleDeleteNote(id: string, title: string) {
    const linked = todosTaskCount.get(id) ?? 0
    const ok = await confirm(
      `Delete note "${title || 'untitled'}"?${
        linked > 0 ? ` ${linked} task${linked === 1 ? '' : 's'} will have no TODOS (they are not deleted).` : ''
      }`,
      { title: 'Delete note' }
    )
    if (ok) onDelete(id)
  }

  // Mesclar uma TODOS numa nota que não é TODOS desvincula as tasks: avisa.
  async function handleMergeNote(sourceId: string, targetId: string) {
    const linked = todosTaskCount.get(sourceId) ?? 0
    const target = notes.find((n) => n.id === targetId)
    if (linked > 0 && target && !isTodosNote(target)) {
      const ok = await confirm(
        `${linked} task${linked === 1 ? '' : 's'} will have no TODOS (they are not deleted).`,
        { title: 'Merge notes', confirmLabel: 'Merge' }
      )
      if (!ok) return
    }
    onMerge?.(sourceId, targetId)
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
              setMergeSourceId(null)
              void handleMergeNote(mergeSourceId, targetId)
            }}
            onClose={() => setMergeSourceId(null)}
          />
        )
      })()}
      {archivedOpen && (
        <ArchivedNotesModal
          notes={archivedNotes}
          typeById={typeById}
          onOpen={(id) => {
            setArchivedOpen(false)
            onSelect(id)
          }}
          onUnarchive={(id) => onSetArchived?.(id, false)}
          onDelete={(id) => void handleDeleteNote(id, archivedNotes.find((n) => n.id === id)?.title ?? '')}
          onClose={() => setArchivedOpen(false)}
        />
      )}
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
            <span>Notes</span>
            <div className={styles.headerActions}>
              {onTypeFilterChange && typeFilterOptions.length > 0 && (
                <select
                  className={styles.typeFilter}
                  value={typeFilter ?? ''}
                  onChange={(e) => onTypeFilterChange(e.target.value || null)}
                  aria-label="filter notes by type"
                  title="Filter by type"
                >
                  <option value="">All</option>
                  {typeFilterOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              {onSortChange && (
                <div className={styles.newMenuWrap} ref={sortMenuRef}>
                  <button
                    className={`${styles.headerToggle} ${sort !== 'manual' ? styles.headerToggleOn : ''}`}
                    onClick={() => setSortMenuOpen((v) => !v)}
                    aria-label={`sort notes: ${sortLabel}`}
                    aria-haspopup="menu"
                    aria-expanded={sortMenuOpen}
                    title={`Sort: ${sortLabel}`}
                    type="button"
                  >
                    <ArrowsDownUp size={16} aria-hidden />
                  </button>
                  {sortMenuOpen && (
                    <div className={styles.subjectDropdown} role="menu">
                      {NOTE_SORT_OPTIONS.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={o.id === sort}
                          className={styles.sortItem}
                          onClick={() => {
                            setSortMenuOpen(false)
                            onSortChange(o.id)
                          }}
                        >
                          <span className={styles.sortCheck}>{o.id === sort && <Check size={12} aria-hidden />}</span>
                          {o.label}
                        </button>
                      ))}
                      {onReorderTypes && (
                        <button
                          type="button"
                          role="menuitem"
                          className={`${styles.sortItem} ${styles.sortExtra}`}
                          onClick={() => {
                            setSortMenuOpen(false)
                            onReorderTypes()
                          }}
                        >
                          <span className={styles.sortCheck} />
                          Reorder types…
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
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
              {onCreateTyped && noteTypes.length > 0 && (
                <div className={styles.newMenuWrap} ref={newMenuRef}>
                  <button
                    className={`${styles.headerAdd} ${styles.newMenuToggle}`}
                    onClick={() => setNewMenuOpen((v) => !v)}
                    disabled={!notebookSelected}
                    aria-label="new note of a type"
                    aria-haspopup="menu"
                    aria-expanded={newMenuOpen}
                    title="new note of a type"
                    type="button"
                  >
                    <CaretDown size={10} weight="bold" aria-hidden />
                  </button>
                  {newMenuOpen && (
                    <div className={styles.subjectDropdown} role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setNewMenuOpen(false)
                          onCreate()
                        }}
                      >
                        New note
                      </button>
                      {noteTypes.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="menuitem"
                          className={styles.newTypeItem}
                          onClick={() => {
                            setNewMenuOpen(false)
                            onCreateTyped(t.id)
                          }}
                        >
                          <span className={styles.newTypeIcon} style={{ color: t.color ?? undefined }}>
                            <TypeIcon name={t.icon} size={12} />
                          </span>
                          New {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                      type={(n.typeId && typeById.get(n.typeId)) || null}
                      meta={noteMeta(n, todosProgress)}
                      properties={listPropertyValues(n, noteDefs)}
                      isActive={n.id === activeId}
                      dragDisabled={sort !== 'manual'}
                      onSelect={onSelect}
                      onDelete={(id) => handleDeleteNote(id, n.title)}
                      onArchive={onSetArchived ? (id) => onSetArchived(id, true) : undefined}
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
          {archivedNotes.length > 0 && (
            <button type="button" className={styles.archivedFooter} onClick={() => setArchivedOpen(true)}>
              <Archive size={12} aria-hidden />
              Archived · {archivedNotes.length}
            </button>
          )}
        </>
      )}
    </aside>
  )
}
