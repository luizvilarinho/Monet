import {
  Archive,
  ArrowsDownUp,
  ArrowsMerge,
  CaretDown,
  CaretRight,
  Check,
  DotsSixVertical,
  FolderSimple,
  Notebook as NotebookIcon,
  PlusCircle,
  SidebarSimple,
  Target,
  Trash,
  X,
} from '@phosphor-icons/react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MetadataDef, Note, Notebook, NoteType, Subject } from '../../types'
import { useConfirm } from '../../hooks/useConfirm'
import { CALENDAR_NOTEBOOK_ID } from '../../lib/calendar'
import { isTodosNote, listPropertyValues } from '../../lib/noteTypes'
import { formatDueShort, type TodosProgress } from '../../lib/tasks'
import {
  findGroupOf,
  groupNotesByType,
  isGroupCollapsed,
  isNearGroup,
  loadGroupCollapsed,
  NOTE_SORT_OPTIONS,
  reorderWithinGroup,
  saveGroupCollapsed,
  setGroupsCollapsed,
  type NoteGroup,
  type NoteSort,
} from '../../lib/noteOrder'
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
  // Tipo da nota (ícone + nome acima do título, na cor do tipo); null na lista
  // agrupada, onde o cabeçalho do grupo já diz o tipo. Abaixo do título, numa
  // linha que quebra, o progresso da TODOS e as propriedades "show in list". O
  // título fica com a largura toda.
  type: NoteType | null
  meta: { progress: string; due: string | null; tone: 'overdue' | 'complete' | null } | null
  properties: Array<{ def: MetadataDef; text: string }>
  isActive: boolean
  // Lista ordenada (não manual): sem arrastar.
  dragDisabled: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onArchive?: (id: string) => void
  onMerge?: (id: string) => void
  onMoveNote?: (id: string) => void
  // Subjects do caderno da própria nota (em "All notes", cada linha é de um
  // caderno): lista pronta ou lida na hora em que o menu abre.
  subjectsFor?: (notebookId: string) => Subject[] | Promise<Subject[]>
  onAssignSubject?: (noteId: string, subjectId: string | null) => void
  currentSubjectId?: string | null
}

// Menu "Assign to subject": portal com posição fixa (a lista rola e cortaria
// um dropdown absoluto), z-index acima de 1000, ↑↓ entre os itens e Esc.
function SubjectMenu({
  anchor,
  subjects,
  currentSubjectId,
  onPick,
  onClose,
}: {
  anchor: HTMLElement
  subjects: Subject[] | null
  currentSubjectId: string | null
  onPick: (subjectId: string | null) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = anchor.getBoundingClientRect()
    const height = menu.offsetHeight
    const width = menu.offsetWidth
    // Perto do rodapé, abre para cima.
    const below = rect.bottom + 4
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - 4 - height) : below
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    setPos({ top, left })
  }, [anchor, subjects])

  useEffect(() => {
    if (!pos) return
    const current = menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    ;(current ?? menuRef.current?.querySelector<HTMLButtonElement>('button'))?.focus()
  }, [pos])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
      anchor.focus()
    }
    // A posição é calculada uma vez: rolar a lista (fora do menu, que tem a
    // própria rolagem) ou mudar o tamanho da janela fecha o menu.
    function onScroll(e: Event) {
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1)
    items[next]?.focus()
  }

  return createPortal(
    <div
      ref={menuRef}
      className={styles.subjectMenu}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
      role="menu"
      aria-label="Assign to subject"
      onKeyDown={onMenuKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
      {subjects === null ? (
        <div className={styles.subjectMenuEmpty}>Loading…</div>
      ) : (
        <>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentSubjectId === null}
            onClick={() => onPick(null)}
          >
            No subject
          </button>
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={currentSubjectId === s.id}
              onClick={() => onPick(s.id)}
            >
              {s.name || 'unnamed'}
            </button>
          ))}
          {subjects.length === 0 && (
            <div className={styles.subjectMenuEmpty}>This notebook has no subjects yet.</div>
          )}
        </>
      )}
    </div>,
    document.body
  )
}

// Cabeçalho de um grupo por tipo: botão que abre e fecha (seta, ícone e nome na
// cor do tipo, contagem). `type` null = "No type", em cor neutra e sem ícone.
// `locked` (filtro de texto ou de tipo ativo): grupo sempre aberto, sem seta nem
// clique. `activeTitle`: grupo fechado com a nota aberta dentro (título dela, ou
// 'untitled'); null nos outros casos.
function GroupHeader({
  type,
  count,
  collapsed,
  locked,
  activeTitle,
  onToggle,
}: {
  type: NoteType | null
  count: number
  collapsed: boolean
  locked: boolean
  activeTitle: string | null
  onToggle: () => void
}) {
  const name = type?.name ?? 'No type'
  const hasActive = activeTitle !== null
  const noun = count === 1 ? 'note' : 'notes'
  // O ícone reserva o espaço também em "No type", para os nomes se alinharem. O
  // botão tem o aria-label; o <div> travado ganha "notes" em texto só para leitor
  // de tela, senão o número ficaria solto depois do nome.
  const content = (
    <>
      {!locked && (collapsed ? <CaretRight size={10} aria-hidden /> : <CaretDown size={10} aria-hidden />)}
      <span className={styles.groupIcon} style={{ color: type?.color ?? undefined }}>
        {type && <TypeIcon name={type.icon} size={12} />}
      </span>
      <span className={styles.groupName} style={{ color: type?.color ?? undefined }}>
        {name}
      </span>
      {hasActive && <span className={styles.groupActiveDot} aria-hidden />}
      <span className={styles.groupCount}>
        {count}
        {locked && <span className={styles.srOnly}> {noun}</span>}
      </span>
    </>
  )
  return (
    <li className={styles.groupItem}>
      {locked ? (
        <div className={styles.groupHeader} title={name}>
          {content}
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.groupHeader} ${hasActive ? styles.groupHeaderActive : ''}`}
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${name}, ${count} ${noun}${hasActive ? ', contains the open note' : ''}`}
          title={hasActive ? `${name} · Contains the open note: ${activeTitle}` : name}
        >
          {content}
        </button>
      )}
    </li>
  )
}

function SortableNoteItem({ note, type, meta, properties, isActive, dragDisabled, onSelect, onDelete, onArchive, onMerge, onMoveNote, subjectsFor, onAssignSubject, currentSubjectId }: SortableNoteItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    disabled: dragDisabled,
  })
  const assignButtonRef = useRef<HTMLButtonElement>(null)
  // Menu aberto: os subjects do caderno da nota (null enquanto carrega).
  const [menuSubjects, setMenuSubjects] = useState<Subject[] | null | undefined>(undefined)
  const menuOpen = menuSubjects !== undefined

  function openSubjectMenu() {
    if (menuOpen) {
      setMenuSubjects(undefined)
      return
    }
    if (!subjectsFor || !note.notebookId) return
    const result = subjectsFor(note.notebookId)
    if (Array.isArray(result)) {
      setMenuSubjects(result)
      return
    }
    setMenuSubjects(null)
    result.then(
      (list) => setMenuSubjects((cur) => (cur === undefined ? cur : list)),
      (err) => {
        console.error('failed to load subjects', err)
        setMenuSubjects((cur) => (cur === undefined ? cur : []))
      }
    )
  }

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
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(note.id)
        }
      }}
      tabIndex={0}
      aria-current={isActive ? 'page' : undefined}
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
          aria-label={`merge note ${note.title || 'untitled'} into another note`}
          type="button"
          title="Merge into another note…"
        >
          <ArrowsMerge size={11} aria-hidden />
        </button>
      )}
      {onAssignSubject && subjectsFor && (
        <div className={styles.rowAssignWrap}>
          <button
            ref={assignButtonRef}
            className={`${styles.rowAssign} ${currentSubjectId || menuOpen ? styles.rowAssignActive : ''}`}
            onClick={(e) => { e.stopPropagation(); openSubjectMenu() }}
            aria-label={`assign subject to note ${note.title || 'untitled'}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            type="button"
            title="Assign to subject"
          >
            <FolderSimple size={11} aria-hidden />
          </button>
          {menuOpen && assignButtonRef.current && (
            <SubjectMenu
              anchor={assignButtonRef.current}
              subjects={menuSubjects}
              currentSubjectId={currentSubjectId ?? null}
              onPick={(subjectId) => {
                setMenuSubjects(undefined)
                onAssignSubject(note.id, subjectId)
              }}
              onClose={() => setMenuSubjects(undefined)}
            />
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
          title="Move to another notebook…"
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
          title="Archive note"
        >
          <Archive size={11} aria-hidden />
        </button>
      )}
      <button
        className={styles.rowDelete}
        onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
        aria-label={`delete note ${note.title || 'untitled'}`}
        type="button"
        title="Delete note…"
      >
        <Trash size={12} aria-hidden />
      </button>
      {(meta || properties.length > 0) && (
        <div className={styles.rowDetails}>
          {meta && (
            <span
              className={`${styles.rowDetail} ${
                meta.tone === 'overdue' ? styles.rowMetaOverdue : meta.tone === 'complete' ? styles.rowMetaComplete : ''
              }`}
              title={meta.due ? `${meta.progress} · next deadline ${meta.due}` : meta.progress}
            >
              {meta.progress}
              {meta.due && (
                <>
                  {' · '}
                  <Target size={10} className={styles.rowDetailIcon} aria-label="deadline" />
                  {' '}
                  {meta.due}
                </>
              )}
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
  // Sem caderno ("All notes"), o "+" cria no Quick Notes (como o Ctrl+N).
  notebookSelected: boolean
  // De onde são as notas ("Caderno › Subject" ou "All notes").
  heading?: string
  // Filtro da Toolbar ativo: aviso no cabeçalho e estado vazio que o nomeia.
  filterText?: string
  onClearFilter?: () => void
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
  subjectsFor?: (notebookId: string) => Subject[] | Promise<Subject[]>
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
  // Seção "Subjects" do mesmo filtro: subjects do caderno aberto; escolher um
  // é o mesmo que clicá-lo na coluna de cadernos. null = sem subject.
  subjectFilterOptions?: Subject[]
  subjectFilter?: string | null
  onSubjectFilterChange?: (subjectId: string | null) => void
  // Ordem da lista (as notas já chegam ordenadas); fora de 'manual', sem
  // arrastar. "Reorder types…" abre o modal de tipos na ordem dos grupos.
  sort?: NoteSort
  onSortChange?: (sort: NoteSort) => void
  onReorderTypes?: () => void
  // Agrupamento por tipo (item "Group by type" do menu de ordem). `groupScope`
  // guarda o estado aberto/fechado dos grupos: id do caderno aberto, ou o
  // escopo de "All notes".
  groupByType?: boolean
  onGroupByTypeChange?: (on: boolean) => void
  groupScope: string
}

// Resumo abaixo do título: progresso na TODOS.
function noteMeta(
  note: Note,
  todosProgress: Map<string, TodosProgress>
): SortableNoteItemProps['meta'] {
  if (!isTodosNote(note)) return null
  const p = todosProgress.get(note.id)
  if (!p || p.total === 0) return null
  return {
    progress: `${p.done}/${p.total}`,
    due: p.nextDeadline ? formatDueShort(p.nextDeadline) : null,
    tone: p.overdue ? 'overdue' : p.done === p.total ? 'complete' : null,
  }
}

export function Sidebar({
  notes,
  archivedNotes = EMPTY_NOTES,
  onSetArchived,
  activeId,
  notebookSelected,
  heading = 'Notes',
  filterText = '',
  onClearFilter,
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
  subjectsFor,
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
  subjectFilterOptions = [],
  subjectFilter = null,
  onSubjectFilterChange,
  sort = 'manual',
  onSortChange,
  onReorderTypes,
  groupByType = false,
  onGroupByTypeChange,
  groupScope,
}: SidebarProps) {
  const typeById = new Map(noteTypes.map((t) => [t.id, t]))
  // Agrupado: uma seção por tipo; plano (sem nenhuma nota com tipo, ou com o
  // agrupamento desligado): uma seção só, sem cabeçalho. Com o filtro de texto
  // ou o de tipo, os grupos ficam todos abertos e travados para nenhum
  // resultado se esconder.
  const groups = groupByType ? groupNotesByType(notes, noteTypes.map((t) => t.id)) : null
  const sections: Array<NoteGroup<Note>> = groups ?? [{ key: 'flat', typeId: null, notes }]
  const filterActive = filterText.trim() !== ''
  const groupsLocked = filterActive || typeFilter !== null
  const [collapsedGroups, setCollapsedGroups] = useState(loadGroupCollapsed)
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
  // "Group by type" só existe (e só conta no rótulo do botão) com tipos criados.
  const canGroup = noteTypes.length > 0
  const groupingOn = groupByType && canGroup
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

  async function handleDeleteNote(id: string, title: string, archived = false) {
    const linked = todosTaskCount.get(id) ?? 0
    const ok = await confirm(
      `Delete note "${title || 'untitled'}"? This can't be undone.${archived ? '' : ' To keep it out of the list, archive it instead.'}${
        linked > 0 ? ` ${linked} task${linked === 1 ? '' : 's'} will have no TODOS (they are not deleted).` : ''
      }`,
      { title: 'Delete note', confirmLabel: 'Delete note' }
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

  // Fecha ou abre os grupos `keys` do escopo atual (um, pelo cabeçalho; todos, pelo menu).
  function setGroups(keys: string[], collapse: boolean) {
    setCollapsedGroups((prev) => {
      const next = setGroupsCollapsed(prev, groupScope, keys, collapse)
      saveGroupCollapsed(next)
      return next
    })
  }

  // Colisão do arrasto (R10). Perto do grupo da nota arrastada (o centro dela
  // dentro da extensão do grupo, com uma altura de linha de folga), só as notas
  // do grupo são alvo: a nota "gruda" na ponta, e arrastar até a última ou a
  // primeira posição não vira um gesto sem efeito. Longe, no meio de outro
  // grupo, não há alvo e soltar não faz nada. Além da ponta da lista (acima do
  // primeiro grupo, abaixo do último) não há outro grupo: a nota vai para a
  // ponta. Lista plana ou um grupo só: o closestCenter de sempre, sem a regra.
  const groupCollision: CollisionDetection = (args) => {
    const group = findGroupOf(sections, args.active.id)
    if (!group || sections.length < 2) return closestCenter(args)
    const ids = group.notes.map((n) => n.id)
    const { collisionRect } = args
    const centerY = collisionRect.top + collisionRect.height / 2
    const index = sections.indexOf(group)
    const open = { above: index === 0, below: index === sections.length - 1 }
    if (!isNearGroup(ids, args.droppableRects, centerY, collisionRect.height, open)) return []
    const own = new Set<string | number>(ids)
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => own.has(c.id)) })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const next = reorderWithinGroup(sections, notes.map((n) => n.id), active.id, over.id)
    if (next) onReorder(next)
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
          onDelete={(id) => void handleDeleteNote(id, archivedNotes.find((n) => n.id === id)?.title ?? '', true)}
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
            <span className={styles.headerTitle} title={heading}>{heading}</span>
            <div className={styles.headerActions}>
              {onTypeFilterChange && (typeFilterOptions.length > 0 || (onSubjectFilterChange && subjectFilterOptions.length > 0)) && (
                <select
                  className={styles.typeFilter}
                  // Um valor só no select: o tipo, senão o subject. Os dois
                  // filtros se somam; "All" limpa os dois.
                  value={typeFilter ? `type:${typeFilter}` : subjectFilter ? `subject:${subjectFilter}` : ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) {
                      onTypeFilterChange(null)
                      onSubjectFilterChange?.(null)
                    } else if (v.startsWith('type:')) {
                      onTypeFilterChange(v.slice(5))
                    } else if (v.startsWith('subject:')) {
                      onTypeFilterChange(null)
                      onSubjectFilterChange?.(v.slice(8))
                    }
                  }}
                  aria-label="filter notes by type or subject"
                  title="Filter by type or subject"
                >
                  <option value="">All</option>
                  {typeFilterOptions.length > 0 && (
                    <optgroup label="Types">
                      {typeFilterOptions.map((t) => (
                        <option key={t.id} value={`type:${t.id}`}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {onSubjectFilterChange && subjectFilterOptions.length > 0 && (
                    <optgroup label="Subjects">
                      {subjectFilterOptions.map((s) => (
                        <option key={s.id} value={`subject:${s.id}`}>
                          {s.name || 'unnamed'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
              {onSortChange && (
                <div className={styles.newMenuWrap} ref={sortMenuRef}>
                  <button
                    className={`${styles.headerToggle} ${sort !== 'manual' ? styles.headerToggleOn : ''}`}
                    onClick={() => setSortMenuOpen((v) => !v)}
                    aria-label={groupingOn ? `sort and group notes: ${sortLabel}, grouped by type` : `sort notes: ${sortLabel}`}
                    aria-haspopup="menu"
                    aria-expanded={sortMenuOpen}
                    title={groupingOn ? `Sort and group: ${sortLabel}, grouped by type` : `Sort: ${sortLabel}`}
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
                      {onGroupByTypeChange && canGroup && (
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={groupByType}
                          className={styles.sortItem}
                          onClick={() => {
                            setSortMenuOpen(false)
                            onGroupByTypeChange(!groupByType)
                          }}
                        >
                          <span className={styles.sortCheck}>{groupByType && <Check size={12} aria-hidden />}</span>
                          Group by type
                        </button>
                      )}
                      {groups && !groupsLocked &&
                        [
                          { label: 'Collapse all groups', collapse: true },
                          { label: 'Expand all groups', collapse: false },
                        ].map(({ label, collapse }) => {
                          // Sem efeito (todos já fechados, ou todos já abertos):
                          // aria-disabled, que mantém o item visível ao leitor de tela.
                          const noEffect = !groups.some((g) => isGroupCollapsed(collapsedGroups, groupScope, g.key) !== collapse)
                          return (
                            <button
                              key={label}
                              type="button"
                              role="menuitem"
                              className={styles.sortItem}
                              aria-disabled={noEffect}
                              onClick={() => {
                                if (noEffect) return
                                setSortMenuOpen(false)
                                setGroups(groups.map((g) => g.key), collapse)
                              }}
                            >
                              <span className={styles.sortCheck} />
                              {label}
                            </button>
                          )
                        })}
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
                className={styles.headerAdd}
                onClick={onCreate}
                aria-label={notebookSelected ? 'new note' : 'new quick note'}
                title={notebookSelected ? 'New note' : 'New quick note (Ctrl+N)'}
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
                    title={notebookSelected ? 'New note of a type' : 'Pick a notebook to create a note of a type'}
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
              <button
                className={styles.headerToggle}
                onClick={onToggleCollapsed}
                aria-label="collapse notes"
                title="Collapse notes"
                type="button"
              >
                <SidebarSimple size={16} aria-hidden />
              </button>
            </div>
          </div>
          {filterText.trim() && (
            <div className={styles.filterChip} role="status">
              <span className={styles.filterChipText} title={`Filtered by “${filterText.trim()}”`}>
                Filtered: &ldquo;{filterText.trim()}&rdquo;
              </span>
              {onClearFilter && (
                <button type="button" className={styles.filterChipClear} onClick={onClearFilter}>
                  <X size={11} aria-hidden />
                  Clear
                </button>
              )}
            </div>
          )}
          <ul className={styles.list}>
            {notes.length === 0 ? (
              <li className={styles.empty}>
                {filterText.trim() ? `No notes match “${filterText.trim()}”` : 'No notes'}
              </li>
            ) : (
              <DndContext sensors={sensors} collisionDetection={groupCollision} onDragEnd={handleDragEnd}>
                {sections.map((group) => {
                  const groupCollapsed = groups !== null && !groupsLocked && isGroupCollapsed(collapsedGroups, groupScope, group.key)
                  const activeNote = groupCollapsed ? group.notes.find((n) => n.id === activeId) : undefined
                  return (
                    <Fragment key={group.key}>
                      {groups && (
                        <GroupHeader
                          type={(group.typeId && typeById.get(group.typeId)) || null}
                          count={group.notes.length}
                          collapsed={groupCollapsed}
                          locked={groupsLocked}
                          activeTitle={activeNote ? activeNote.title || 'untitled' : null}
                          onToggle={() => setGroups([group.key], !groupCollapsed)}
                        />
                      )}
                      {!groupCollapsed && (
                        <SortableContext items={group.notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                          {group.notes.map((n) => (
                            <SortableNoteItem
                              key={n.id}
                              note={n}
                              type={groups ? null : (n.typeId && typeById.get(n.typeId)) || null}
                              meta={noteMeta(n, todosProgress)}
                              properties={listPropertyValues(n, noteDefs)}
                              isActive={n.id === activeId}
                              dragDisabled={sort !== 'manual'}
                              onSelect={onSelect}
                              onDelete={(id) => handleDeleteNote(id, n.title)}
                              onArchive={onSetArchived ? (id) => onSetArchived(id, true) : undefined}
                              onMerge={onMerge ? setMergeSourceId : undefined}
                              onMoveNote={onMoveNote ? setMoveNoteId : undefined}
                              subjectsFor={subjectsFor}
                              onAssignSubject={onAssignSubject}
                              currentSubjectId={n.subjectId}
                            />
                          ))}
                        </SortableContext>
                      )}
                    </Fragment>
                  )
                })}
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
