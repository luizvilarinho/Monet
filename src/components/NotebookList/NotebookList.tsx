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
  ArrowRight,
  ArrowSquareOut,
  Books,
  CalendarBlank,
  CaretRight,
  DotsSixVertical,
  FileText,
  FolderSimple,
  Gear,
  Hash,
  Highlighter,
  Kanban,
  Lightning,
  ListChecks,
  Notebook as NotebookIcon,
  Plus,
  PlusCircle,
  SidebarSimple,
  X,
} from '@phosphor-icons/react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { countNotebookChatConversations } from '../../hooks/useChat'
import { useConfirm } from '../../hooks/useConfirm'
import { INBOX_NOTEBOOK_ID, QUICK_NOTES_NAME, type NotebookTaskProgress } from '../../lib/tasks'
import { markLabelKey, type MarkLabelFilter, type MarkSummary } from '../../lib/noteMarks'
import { tagKey, type TagCount } from '../../lib/noteTags'
import type { Notebook, NoteType, Subject } from '../../types'
import { NotebookPickerModal } from '../NotebookPickerModal/NotebookPickerModal'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import styles from './NotebookList.module.css'

const MIN_WIDTH = 140
const MAX_WIDTH = 320
// Selo de idade do Quick Notes: aparece quando a nota mais antiga passa disso.
const QUICK_NOTES_STALE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const TAGS_COLLAPSED_KEY = 'monet:notebook-tags-collapsed'
const MARKS_COLLAPSED_KEY = 'monet:notebook-marks-collapsed'

function readCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // sem storage: o estado vale só até recarregar
  }
}

function TaskProgressBadge({ progress }: { progress: NotebookTaskProgress }) {
  return (
    <span
      className={`${styles.taskProgress} ${progress.overdue > 0 ? styles.taskProgressOverdue : ''}`}
      title={`${progress.done} of ${progress.total} tasks done · ${progress.open} open${
        progress.overdue > 0 ? ` · ${progress.overdue} overdue` : ''
      }`}
    >
      {progress.done}/{progress.total}
    </span>
  )
}

interface SortableNotebookItemProps {
  nb: Notebook
  isActive: boolean
  // Caderno do subject aberto: texto claro, sem fundo (o fundo é do subject).
  isParent: boolean
  hasVisibleDocs: boolean
  taskProgress?: NotebookTaskProgress
  editing: { id: string; value: string } | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onMoveNotebook: (id: string) => void
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
  isParent,
  hasVisibleDocs,
  taskProgress,
  editing,
  onSelect,
  onDelete,
  onMoveNotebook,
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
      className={`${styles.row} ${styles.notebookRow} ${isActive ? styles.active : ''} ${isParent ? styles.parent : ''}`}
      onClick={() => {
        if (editing?.id === nb.id) return
        onSelect(nb.id)
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        onStartEdit(nb.id, nb.name)
      }}
    >
      {editing?.id === nb.id ? (
        <span className={styles.notebookIcon}>
          <NotebookIcon size={14} aria-hidden />
        </span>
      ) : (
        // Ícone do caderno; no hover vira a alça de arraste. Clique sem arraste
        // (o PointerSensor só arrasta depois de 5px) seleciona a linha.
        <span
          className={`${styles.notebookIcon} ${styles.dragSlot}`}
          {...attributes}
          {...listeners}
          aria-label="drag to reorder"
        >
          <span className={styles.slotIcon}>
            <NotebookIcon size={14} aria-hidden />
          </span>
          <span className={styles.slotGrip}>
            <DotsSixVertical size={12} weight="bold" aria-hidden />
          </span>
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
      {editing?.id !== nb.id && taskProgress && <TaskProgressBadge progress={taskProgress} />}
      {editing?.id !== nb.id && (
        <span className={styles.rowActions}>
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
            className={styles.rowMove}
            onClick={(e) => { e.stopPropagation(); onMoveNotebook(nb.id) }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`move notebook ${nb.name || 'unnamed'} to another notebook`}
            title="move to another notebook"
            type="button"
          >
            <ArrowRight size={13} aria-hidden />
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
        </span>
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
  onTurnIntoNotebook: (id: string) => void
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
  onTurnIntoNotebook,
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
      {editing?.id === subject.id ? (
        <span className={styles.subjectIcon}>
          <FolderSimple size={12} aria-hidden />
        </span>
      ) : (
        // Ícone do subject; no hover vira a alça de arraste (clique seleciona).
        <span
          className={`${styles.subjectIcon} ${styles.dragSlot}`}
          {...attributes}
          {...listeners}
          aria-label="drag to reorder"
        >
          <span className={styles.slotIcon}>
            <FolderSimple size={12} aria-hidden />
          </span>
          <span className={styles.slotGrip}>
            <DotsSixVertical size={10} weight="bold" aria-hidden />
          </span>
        </span>
      )}
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
        <span className={styles.rowActions}>
          <button
            className={styles.subjectMove}
            onClick={(e) => { e.stopPropagation(); onTurnIntoNotebook(subject.id) }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`turn subject ${subject.name || 'unnamed'} into a notebook`}
            title="Turn into notebook"
            type="button"
          >
            <ArrowSquareOut size={11} aria-hidden />
          </button>
          <button
            className={styles.subjectDelete}
            onClick={(e) => { e.stopPropagation(); onDelete(subject.id) }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`delete subject ${subject.name}`}
            type="button"
          >
            <X size={11} weight="bold" aria-hidden />
          </button>
        </span>
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
  onMoveNotebook: (sourceId: string, destNotebookId: string) => void
  onRename: (id: string, name: string) => void
  onOpenDocuments: (id: string) => void
  onOpenKnowledgeBase: () => void
  notebooksWithDocs: Set<string>
  // Quick Notes (caderno fixo `inbox`): notas sem as notas-corpo de task e sem
  // as arquivadas, a criação da mais antiga (selo de idade) e a nota nova
  // (mesmo handler do Ctrl+N).
  quickNotesCount: number
  quickNotesOldestAt: number | null
  onNewQuickNote: () => void
  // Seção "Tags": tags das notas (todos os cadernos) com a contagem. O clique
  // abre a lista das notas com a tag; clicar na tag ativa fecha a lista.
  tags: TagCount[]
  activeTag: string | null
  onOpenTag: (tag: string) => void
  onCloseTags: () => void
  // Seção "Marks": total e rótulos das marcas (todos os cadernos). O clique
  // abre a lista de marcas no filtro; clicar no filtro ativo fecha a lista.
  markSummary: MarkSummary
  marksActive: boolean
  marksFilter: MarkLabelFilter
  onOpenMarks: (filter: MarkLabelFilter) => void
  onCloseMarks: () => void
  // Boards logo abaixo de Tasks: um por tipo de nota com "Show as board"
  // (nome da propriedade das colunas e contagem de notas). Clicar no ativo
  // fecha. Sem boards, "Set up a board…" abre o modal de tipos na seção Board.
  boards: Array<{ type: NoteType; columnName: string; count: number }>
  activeBoardTypeId: string | null
  onOpenBoard: (typeId: string) => void
  onCloseBoard: () => void
  onSetUpBoard: () => void
  onOpenSettings: () => void
  calendarNotebookId?: string | null
  // Entrada virtual "Tasks" (não é linha em `notebooks`). Enquanto ativa,
  // nenhuma outra linha aparece ativa.
  tasksActive: boolean
  onOpenTasks: () => void
  // Progresso de tasks por caderno (só cadernos com tasks abertas).
  taskProgress: Map<string, NotebookTaskProgress>
  subjects: Subject[]
  activeSubjectId: string | null
  onSelectSubject: (id: string | null) => void
  onCreateSubject: () => void
  onDeleteSubject: (id: string) => void
  onTurnSubjectIntoNotebook: (id: string) => void
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
  onMoveNotebook,
  onRename,
  onOpenDocuments,
  onOpenKnowledgeBase,
  notebooksWithDocs,
  quickNotesCount,
  quickNotesOldestAt,
  onNewQuickNote,
  tags,
  activeTag,
  onOpenTag,
  onCloseTags,
  markSummary,
  marksActive,
  marksFilter,
  onOpenMarks,
  onCloseMarks,
  boards,
  activeBoardTypeId,
  onOpenBoard,
  onCloseBoard,
  onSetUpBoard,
  onOpenSettings,
  calendarNotebookId,
  tasksActive,
  onOpenTasks,
  taskProgress,
  subjects,
  activeSubjectId,
  onSelectSubject,
  onCreateSubject,
  onDeleteSubject,
  onTurnSubjectIntoNotebook,
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
  const [moveNotebookId, setMoveNotebookId] = useState<string | null>(null)
  const [tagsCollapsed, setTagsCollapsed] = useState(() => readCollapsed(TAGS_COLLAPSED_KEY))
  const [marksCollapsed, setMarksCollapsed] = useState(() => readCollapsed(MARKS_COLLAPSED_KEY))
  // Menu "Notebooks" da coluna recolhida: posição fixa ao lado do botão (a
  // coluna recolhida corta o que passa da largura).
  const [notebookMenu, setNotebookMenu] = useState<{ top: number; left: number } | null>(null)
  const notebookMenuRef = useRef<HTMLDivElement>(null)
  const notebookMenuButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const { confirm, modal } = useConfirm()
  // Tasks, Marks, uma tag ou um board aberto: nenhum caderno aparece ativo.
  const viewActive = tasksActive || marksActive || activeTag !== null || activeBoardTypeId !== null
  const activeTagKey = activeTag === null ? null : tagKey(activeTag)
  const allMarksActive = marksActive && marksFilter === null
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const currentWidthRef = useRef(width)

  useEffect(() => {
    currentWidthRef.current = width
  }, [width])

  useEffect(() => {
    if (!collapsed) setNotebookMenu(null)
  }, [collapsed])

  useEffect(() => {
    if (!notebookMenu) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (notebookMenuRef.current?.contains(target)) return
      if (notebookMenuButtonRef.current?.contains(target)) return
      setNotebookMenu(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNotebookMenu(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [notebookMenu])

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
    const chatCount = countNotebookChatConversations(id)
    const chatNote =
      chatCount === null
        ? ''
        : chatCount === 0
          ? ' Its chat folder and any web sources saved from it will also be deleted.'
          : ` Its chat (${chatCount} conversation${chatCount === 1 ? '' : 's'}) and any web sources saved from it will also be deleted.`
    const ok = await confirm(
      `Delete notebook "${name}" and all its notes?${chatNote}`,
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

  async function handleTurnSubjectIntoNotebook(id: string, name: string) {
    const ok = await confirm(
      `Turn subject "${name || 'unnamed'}" into a notebook? Its notes move to a notebook with the same name (merged into it if one already exists).`,
      { title: 'Turn into notebook', confirmLabel: 'Turn into notebook', destructive: false }
    )
    if (ok) onTurnSubjectIntoNotebook(id)
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

  function toggleTags() {
    setTagsCollapsed((v) => {
      writeCollapsed(TAGS_COLLAPSED_KEY, !v)
      return !v
    })
  }

  function toggleMarks() {
    setMarksCollapsed((v) => {
      writeCollapsed(MARKS_COLLAPSED_KEY, !v)
      return !v
    })
  }

  function toggleNotebookMenu() {
    if (notebookMenu) {
      setNotebookMenu(null)
      return
    }
    const rect = notebookMenuButtonRef.current?.getBoundingClientRect()
    if (!rect) return
    setNotebookMenu({ top: rect.top, left: rect.right + 4 })
  }

  // Cadernos do usuário (lista ordenável): Calendar e Quick Notes são views fixas.
  const userNotebooks = notebooks.filter((n) => n.id !== calendarNotebookId && n.id !== INBOX_NOTEBOOK_ID)
  const quickNotesNb = notebooks.find((n) => n.id === INBOX_NOTEBOOK_ID)
  const calendarNb = calendarNotebookId ? notebooks.find((n) => n.id === calendarNotebookId) : undefined
  const quickNotesProgress = taskProgress.get(INBOX_NOTEBOOK_ID)
  const quickNotesAgeDays =
    quickNotesOldestAt === null ? 0 : Math.floor((Date.now() - quickNotesOldestAt) / DAY_MS)
  const quickNotesStale = quickNotesCount > 0 && quickNotesAgeDays > QUICK_NOTES_STALE_DAYS
  // Um fundo de seleção só: com um subject aberto, o caderno fica como "pai".
  const notebookSelected = (id: string) => !viewActive && id === activeId && activeSubjectId === null
  const notebookParent = (id: string) => !viewActive && id === activeId && activeSubjectId !== null
  const activeUserNotebook = viewActive ? undefined : userNotebooks.find((n) => n.id === activeId)
  const userNotebooksActive = !viewActive && (activeId === null || activeUserNotebook !== undefined)

  // Subjects do caderno ativo, logo abaixo da linha do caderno; a última
  // linha cria um subject.
  function renderSubjects(nbId: string) {
    return (
      <li className={`${styles.subjectContainer} ${nbId === activeId ? styles.open : ''}`}>
        {nbId === activeId && (
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
                    onTurnIntoNotebook={(id) => handleTurnSubjectIntoNotebook(id, subject.name)}
                    onStartEdit={(id, value) => setSubjectEditing({ id, value })}
                    onCommitEdit={commitSubjectEdit}
                    onCancelEdit={() => setSubjectEditing(null)}
                    onEditChange={(id, value) => setSubjectEditing({ id, value })}
                    subjectInputRef={subjectInputRef}
                  />
                ))}
                <li className={`${styles.subjectRow} ${styles.subjectAddRow}`} onClick={onCreateSubject}>
                  <span className={styles.subjectIcon}>
                    <Plus size={12} aria-hidden />
                  </span>
                  <span className={styles.subjectLabel}>New subject</span>
                </li>
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </li>
    )
  }

  function renderRail() {
    return (
      <div className={styles.rail}>
        <button
          className={styles.railButton}
          onClick={onToggleCollapsed}
          aria-label="expand notebooks"
          title="expand notebooks"
          type="button"
        >
          <SidebarSimple size={16} aria-hidden />
        </button>
        <span className={styles.railSeparator} aria-hidden />
        {calendarNb && (
          <button
            className={`${styles.railButton} ${!viewActive && calendarNb.id === activeId ? styles.railActive : ''}`}
            onClick={() => onSelect(calendarNb.id)}
            aria-label={calendarNb.name}
            title={calendarNb.name}
            type="button"
          >
            <span className={styles.calendarIcon}>
              <CalendarBlank size={16} aria-hidden />
            </span>
          </button>
        )}
        {quickNotesNb && (
          <button
            className={`${styles.railButton} ${notebookSelected(INBOX_NOTEBOOK_ID) || notebookParent(INBOX_NOTEBOOK_ID) ? styles.railActive : ''}`}
            onClick={() => onSelect(INBOX_NOTEBOOK_ID)}
            aria-label={QUICK_NOTES_NAME}
            title={quickNotesCount > 0 ? `${QUICK_NOTES_NAME} (${quickNotesCount})` : QUICK_NOTES_NAME}
            type="button"
          >
            <span className={styles.quickNotesIcon}>
              <Lightning size={16} aria-hidden />
            </span>
            {quickNotesCount > 0 && (
              <span className={styles.railBadge}>{quickNotesCount > 99 ? '99+' : quickNotesCount}</span>
            )}
          </button>
        )}
        <button
          className={`${styles.railButton} ${tasksActive ? styles.railActive : ''}`}
          onClick={onOpenTasks}
          aria-label="Tasks"
          title="Tasks"
          type="button"
        >
          <span className={styles.tasksIcon}>
            <ListChecks size={16} aria-hidden />
          </span>
        </button>
        {boards.length === 0 ? (
          <button
            className={styles.railButton}
            onClick={onSetUpBoard}
            aria-label="Set up a board"
            title="Set up a board…"
            type="button"
          >
            <span className={styles.boardIcon}>
              <Kanban size={16} aria-hidden />
            </span>
          </button>
        ) : (
          boards.map((b) => {
            const active = b.type.id === activeBoardTypeId
            return (
              <button
                key={b.type.id}
                className={`${styles.railButton} ${active ? styles.railActive : ''}`}
                onClick={() => (active ? onCloseBoard() : onOpenBoard(b.type.id))}
                aria-label={`${b.type.name} board`}
                title={`${b.type.name} · ${b.columnName}`}
                type="button"
              >
                <span className={styles.boardIcon} style={{ color: b.type.color ?? undefined }}>
                  <TypeIcon name={b.type.icon} />
                </span>
              </button>
            )
          })
        )}
        <span className={styles.railSeparator} aria-hidden />
        <button
          ref={notebookMenuButtonRef}
          className={`${styles.railButton} ${userNotebooksActive || notebookMenu ? styles.railActive : ''}`}
          onClick={toggleNotebookMenu}
          aria-label="Notebooks"
          aria-haspopup="menu"
          aria-expanded={notebookMenu !== null}
          title={activeUserNotebook ? `Notebooks: ${activeUserNotebook.name || 'unnamed'}` : 'Notebooks'}
          type="button"
        >
          <NotebookIcon size={16} aria-hidden />
        </button>
        <button
          className={`${styles.railButton} ${activeTag !== null ? styles.railActive : ''}`}
          onClick={() => (activeTag !== null ? onCloseTags() : tags[0] && onOpenTag(tags[0].tag))}
          disabled={tags.length === 0 && activeTag === null}
          aria-label="Tags"
          title={tags.length === 0 ? 'Tags (no tags)' : 'Tags'}
          type="button"
        >
          <Hash size={16} aria-hidden />
        </button>
        <button
          className={`${styles.railButton} ${marksActive ? styles.railActive : ''}`}
          onClick={() => (marksActive ? onCloseMarks() : onOpenMarks(null))}
          disabled={markSummary.total === 0 && !marksActive}
          aria-label="Marks"
          title={markSummary.total === 0 ? 'Marks (no marks)' : `Marks (${markSummary.total})`}
          type="button"
        >
          <Highlighter size={16} aria-hidden />
        </button>
        {notebookMenu && (
          <div
            ref={notebookMenuRef}
            className={styles.notebookMenu}
            style={{ top: notebookMenu.top, left: notebookMenu.left }}
            role="menu"
          >
            <div className={styles.notebookMenuHeader}>Notebooks</div>
            <button
              className={`${styles.notebookMenuItem} ${!viewActive && activeId === null ? styles.active : ''}`}
              onClick={() => { onSelect(null); setNotebookMenu(null) }}
              role="menuitem"
              type="button"
            >
              <span className={`${styles.rowLabel} ${styles.allNotes}`}>All notes</span>
            </button>
            {userNotebooks.map((nb) => {
              const progress = taskProgress.get(nb.id)
              return (
                <button
                  key={nb.id}
                  className={`${styles.notebookMenuItem} ${!viewActive && nb.id === activeId ? styles.active : ''}`}
                  onClick={() => { onSelect(nb.id); setNotebookMenu(null) }}
                  role="menuitem"
                  type="button"
                >
                  <span className={styles.rowLabel}>{nb.name || 'unnamed'}</span>
                  {progress && <TaskProgressBadge progress={progress} />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className={`${styles.notebooks} ${collapsed ? styles.collapsed : ''}`} style={{ width }}>
      {modal}
      {moveNotebookId !== null && (() => {
        const moveNotebook = notebooks.find((n) => n.id === moveNotebookId)
        if (!moveNotebook) return null
        return (
          <NotebookPickerModal
            title={`Move “${moveNotebook.name || 'unnamed'}” to:`}
            confirmLabel="Move"
            notebooks={notebooks.filter(
              (n) => n.id !== moveNotebookId && n.id !== calendarNotebookId
            )}
            onConfirm={(destNotebookId) => {
              onMoveNotebook(moveNotebookId, destNotebookId)
              setMoveNotebookId(null)
            }}
            onClose={() => setMoveNotebookId(null)}
          />
        )
      })()}
      {!collapsed && <div className={styles.resizeHandle} onMouseDown={onMouseDown} />}
      {collapsed ? (
        renderRail()
      ) : (
        <div className={styles.scrollArea}>
          <section className={styles.section}>
            <div className={styles.header}>
              <span>Views</span>
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
              </div>
            </div>
            <ul className={styles.list}>
              {calendarNb && (
                <li
                  className={`${styles.row} ${!viewActive && calendarNb.id === activeId ? styles.active : ''}`}
                  onClick={() => onSelect(calendarNb.id)}
                >
                  <span className={styles.calendarIcon}>
                    <CalendarBlank size={16} aria-hidden />
                  </span>
                  <span className={styles.rowLabel}>{calendarNb.name}</span>
                  <span className={styles.rowActions}>
                    <button
                      className={`${styles.rowDocs} ${notebooksWithDocs.has(calendarNb.id) ? styles.rowDocsActive : ''}`}
                      onClick={(e) => { e.stopPropagation(); onSelect(calendarNb.id); onOpenDocuments(calendarNb.id) }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      aria-label={`documents for notebook ${calendarNb.name}`}
                      title={notebooksWithDocs.has(calendarNb.id) ? 'notebook documents (active)' : 'notebook documents'}
                      type="button"
                    >
                      <FileText size={13} aria-hidden />
                    </button>
                  </span>
                </li>
              )}

              {quickNotesNb && (
                <>
                  <li
                    className={`${styles.row} ${notebookSelected(INBOX_NOTEBOOK_ID) ? styles.active : ''} ${notebookParent(INBOX_NOTEBOOK_ID) ? styles.parent : ''}`}
                    onClick={() => onSelect(INBOX_NOTEBOOK_ID)}
                    title="Notes and tasks without a notebook yet"
                  >
                    <span className={styles.quickNotesIcon}>
                      <Lightning size={16} aria-hidden />
                    </span>
                    <span className={styles.rowLabel}>{QUICK_NOTES_NAME}</span>
                    {quickNotesStale && (
                      <span
                        className={styles.staleBadge}
                        title={`Oldest note: ${quickNotesAgeDays} days`}
                      >
                        {quickNotesAgeDays}d
                      </span>
                    )}
                    {quickNotesProgress && <TaskProgressBadge progress={quickNotesProgress} />}
                    {quickNotesCount > 0 && (
                      <span
                        className={styles.sectionCount}
                        title={`${quickNotesCount} note${quickNotesCount === 1 ? '' : 's'}`}
                      >
                        {quickNotesCount}
                      </span>
                    )}
                    <span className={styles.rowActions}>
                      <button
                        className={`${styles.rowDocs} ${notebooksWithDocs.has(INBOX_NOTEBOOK_ID) ? styles.rowDocsActive : ''}`}
                        onClick={(e) => { e.stopPropagation(); onSelect(INBOX_NOTEBOOK_ID); onOpenDocuments(INBOX_NOTEBOOK_ID) }}
                        aria-label={`documents for notebook ${QUICK_NOTES_NAME}`}
                        title={notebooksWithDocs.has(INBOX_NOTEBOOK_ID) ? 'notebook documents (active)' : 'notebook documents'}
                        type="button"
                      >
                        <FileText size={13} aria-hidden />
                      </button>
                      <button
                        className={styles.rowAdd}
                        onClick={(e) => { e.stopPropagation(); onNewQuickNote() }}
                        aria-label="new quick note"
                        title="New quick note (Ctrl+N)"
                        type="button"
                      >
                        <Plus size={13} aria-hidden />
                      </button>
                    </span>
                  </li>
                  {renderSubjects(INBOX_NOTEBOOK_ID)}
                </>
              )}

              <li
                className={`${styles.row} ${tasksActive ? styles.active : ''}`}
                onClick={onOpenTasks}
              >
                <span className={styles.tasksIcon}>
                  <ListChecks size={16} aria-hidden />
                </span>
                <span className={styles.rowLabel}>Tasks</span>
              </li>

              {boards.length === 0 ? (
                <li
                  className={`${styles.row} ${styles.boardSetUp}`}
                  title="Turn on “Show as board” in a note type"
                  onClick={onSetUpBoard}
                >
                  <span className={styles.boardIcon}>
                    <Kanban size={16} aria-hidden />
                  </span>
                  <span className={styles.rowLabel}>Set up a board…</span>
                </li>
              ) : (
                boards.map((b) => {
                  const active = b.type.id === activeBoardTypeId
                  return (
                    <li
                      key={b.type.id}
                      className={`${styles.row} ${active ? styles.active : ''}`}
                      title={`${b.type.name} notes by ${b.columnName}`}
                      onClick={() => (active ? onCloseBoard() : onOpenBoard(b.type.id))}
                    >
                      <span className={styles.boardIcon} style={{ color: b.type.color ?? undefined }}>
                        <TypeIcon name={b.type.icon} />
                      </span>
                      <span className={styles.rowLabel}>
                        {b.type.name} <span className={styles.boardProp}>· {b.columnName}</span>
                      </span>
                      <span className={styles.sectionCount}>{b.count}</span>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <div className={styles.header}>
              <span>Notebooks</span>
              <div className={styles.headerActions}>
                <button className={styles.headerAdd} onClick={onCreate} aria-label="new notebook" title="New notebook" type="button">
                  <PlusCircle size={16} weight="fill" aria-hidden />
                </button>
              </div>
            </div>
            <ul className={styles.list}>
              <li
                className={`${styles.row} ${!viewActive && activeId === null ? styles.active : ''}`}
                onClick={() => onSelect(null)}
              >
                <span className={`${styles.rowLabel} ${styles.allNotes}`}>All notes</span>
              </li>

              {userNotebooks.length === 0 ? (
                <li className={styles.empty}>no notebooks</li>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={userNotebooks.map((n) => n.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {userNotebooks.map((nb) => (
                      <Fragment key={nb.id}>
                        <SortableNotebookItem
                          nb={nb}
                          isActive={notebookSelected(nb.id)}
                          isParent={notebookParent(nb.id)}
                          hasVisibleDocs={notebooksWithDocs.has(nb.id)}
                          taskProgress={taskProgress.get(nb.id)}
                          editing={editing}
                          onSelect={onSelect}
                          onDelete={(id) => handleDeleteNotebook(id, nb.name)}
                          onMoveNotebook={setMoveNotebookId}
                          onOpenDocuments={onOpenDocuments}
                          onStartEdit={(id, value) => setEditing({ id, value })}
                          onCommitEdit={commitEdit}
                          onCancelEdit={() => setEditing(null)}
                          onEditChange={(id, value) => setEditing({ id, value })}
                          inputRef={inputRef}
                        />
                        {renderSubjects(nb.id)}
                      </Fragment>
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </ul>
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <button
              className={styles.sectionToggle}
              onClick={toggleTags}
              aria-expanded={!tagsCollapsed}
              type="button"
            >
              <span className={styles.sectionToggleLabel}>
                <span className={`${styles.caret} ${tagsCollapsed ? '' : styles.caretOpen}`}>
                  <CaretRight size={11} aria-hidden />
                </span>
                Tags
              </span>
              {tags.length > 0 && <span className={styles.sectionCount}>{tags.length}</span>}
            </button>
            {!tagsCollapsed && (
              <ul className={styles.list}>
                {tags.length === 0 ? (
                  <li className={styles.empty}>no tags</li>
                ) : (
                  tags.map((t) => {
                    const active = tagKey(t.tag) === activeTagKey
                    return (
                      <li
                        key={tagKey(t.tag)}
                        className={`${styles.row} ${active ? styles.active : ''}`}
                        title={`Notes tagged #${t.tag}, from every notebook`}
                        onClick={() => (active ? onCloseTags() : onOpenTag(t.tag))}
                      >
                        <span className={styles.rowLabel}>#{t.tag}</span>
                        <span className={styles.sectionCount}>{t.count}</span>
                      </li>
                    )
                  })
                )}
              </ul>
            )}
          </section>

          <hr className={styles.divider} />

          <section className={styles.section}>
            <button
              className={styles.sectionToggle}
              onClick={toggleMarks}
              aria-expanded={!marksCollapsed}
              type="button"
            >
              <span className={styles.sectionToggleLabel}>
                <span className={`${styles.caret} ${marksCollapsed ? '' : styles.caretOpen}`}>
                  <CaretRight size={11} aria-hidden />
                </span>
                Marks
              </span>
              {markSummary.total > 0 && <span className={styles.sectionCount}>{markSummary.total}</span>}
            </button>
            {!marksCollapsed && (
              <ul className={styles.list}>
                {markSummary.total === 0 ? (
                  <li className={styles.empty}>no marks</li>
                ) : (
                  <>
                    <li
                      className={`${styles.row} ${allMarksActive ? styles.active : ''}`}
                      onClick={() => (allMarksActive ? onCloseMarks() : onOpenMarks(null))}
                    >
                      <span className={`${styles.rowLabel} ${styles.allNotes}`}>All marks</span>
                      <span className={styles.sectionCount}>{markSummary.total}</span>
                    </li>
                    {markSummary.labels.map((l) => {
                      const active =
                        marksActive &&
                        marksFilter !== null &&
                        marksFilter.label !== null &&
                        markLabelKey(marksFilter.label) === markLabelKey(l.label)
                      return (
                        <li
                          key={markLabelKey(l.label)}
                          className={`${styles.row} ${active ? styles.active : ''}`}
                          title={l.label}
                          onClick={() => (active ? onCloseMarks() : onOpenMarks({ label: l.label }))}
                        >
                          <span className={styles.markDot} aria-hidden />
                          <span className={styles.rowLabel}>{l.label}</span>
                          <span className={styles.sectionCount}>{l.count}</span>
                        </li>
                      )
                    })}
                  </>
                )}
              </ul>
            )}
          </section>

        </div>
      )}

      <div className={`${styles.footer} ${collapsed ? styles.footerCollapsed : ''}`}>
        {!collapsed && <span className={styles.version}>v1.5.0</span>}
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
