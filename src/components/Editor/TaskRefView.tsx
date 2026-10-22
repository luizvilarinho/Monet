import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretDown,
  Check,
  Checks,
  Flag,
  PencilSimple,
  Repeat,
  Star,
} from '@phosphor-icons/react'
import { formatMetadataValue, visibleMetadata } from '../../lib/metadata'
import {
  BUILTIN_STATUS_DEFS,
  describeRecurrence,
  formatDueShort,
  isOpen,
  overdueKind,
  statusColor,
  statusName,
} from '../../lib/tasks'
import type { TaskStatus, TaskStatusDef } from '../../types'
import { TaskFields } from '../TasksView/TaskFields'
import { useTasksContext } from './TasksContext'
import styles from './TaskRef.module.css'

// Altura estimada de um item do menu (para abrir para cima perto do rodapé).
const MENU_ITEM_HEIGHT = 28

// Propriedades custom listadas embaixo do card (como no TaskCard); o resto vira
// "+N more".
const MAX_CARD_METADATA = 3

// Nenhum taskRef antes deste no parágrafo (o mesmo critério do `firstTaskRefId`).
function isFirstTaskRef(doc: ProseMirrorNode, pos: number | undefined): boolean {
  if (pos === undefined) return true
  const $pos = doc.resolve(pos)
  for (let i = 0; i < $pos.index(); i++) {
    if ($pos.parent.child(i).type.name === 'taskRef') return false
  }
  return true
}

// Card da task no item de checklist. O `li` vira card pelo CSS do Editor
// (`data-task-status`, decoration do TaskStatus); este node fica no fim do
// título e mostra o ícone que abre a task e, numa linha abaixo do título
// (absoluta no 1º parágrafo, para o node continuar inline e o cursor no título
// seguir natural), as propriedades com valor: status (menu de troca, só com o
// editor editável), do date, ⚑ deadline, ↻n, ★ e TODOS (se for outra nota).
// Numa nota TODOS a linha mostra também projeto, checklist e recorrência, e o
// lápis abre o popover de edição dos campos (TaskFields). As propriedades
// custom vêm embaixo, depois de uma divisória, em pares nome/valor (até
// MAX_CARD_METADATA e "+N more"); o 1º parágrafo reserva a altura pelo número
// de linhas (`data-rows`, Editor.module.css). Shift+click no ↗ abre a task no
// modal sem trocar a nota. Fora do card (keep, item sem a decoration), fica
// inline.
// Só o 1º taskRef do parágrafo é a task do card (`firstTaskRefId`); os demais
// (ex.: colados de outra nota) ficam como chip compacto: ícone e status, inline.
export function TaskRefView({ node, editor, getPos }: NodeViewProps) {
  const id = (node.attrs.id as string) ?? ''
  const {
    tasksById,
    todayKey,
    onOpenTask,
    notebooks = [],
    checklist,
    statuses = BUILTIN_STATUS_DEFS,
    onSetStatus,
    metadataDefs = [],
    todosTitle,
    currentNoteId = null,
    onUpdateTask,
    currentNoteIsTodos,
    onOpenTaskModal,
  } = useTasksContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const statusRef = useRef<HTMLButtonElement>(null)
  const fieldsRef = useRef<HTMLButtonElement>(null)
  const task = tasksById.get(id)

  // Task inexistente (excluída): não renderiza nada; o item vira checkbox comum.
  if (!task) return <NodeViewWrapper as="span" />

  const primary = isFirstTaskRef(editor.state.doc, getPos())
  const late = overdueKind(task, todayKey)
  const project = notebooks.find((nb) => nb.id === task.notebookId)
  const parent =
    task.parentNoteId && task.parentNoteId !== currentNoteId ? todosTitle?.(task.parentNoteId) : undefined
  const progress = checklist?.get(task.id)
  const metadata = visibleMetadata(task, metadataDefs)
  const canSetStatus = !!onSetStatus && editor.isEditable
  // Edição inline dos campos só na nota TODOS e com o editor editável (R5).
  const canEdit = !!onUpdateTask && editor.isEditable && !!currentNoteIsTodos
  const currentStatusName = statusName(task.status, statuses)
  const tooltip = [
    onOpenTask ? 'Open task' : '',
    onOpenTaskModal ? 'Shift+click to open in a modal' : '',
    project ? `Project: ${project.name || 'unnamed'}` : '',
    progress ? `Checklist ${progress.done}/${progress.total}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  // Campos nativos do card como pills, na ordem de prioridade (a linha é
  // overflow: hidden; o lápis vem antes e abre todos no popover).
  const pills: Array<{ id: string; className: string; title: string; content: ReactNode }> = []
  if (primary && canEdit) {
    if (project) {
      pills.push({
        id: 'project',
        className: styles.pill,
        title: 'Project',
        content: (
          <>
            <span
              className={styles.dot}
              style={{ background: project.color ?? 'var(--text-muted)' }}
              aria-hidden
            />
            <span className={styles.text}>{project.name || 'unnamed'}</span>
          </>
        ),
      })
    }
    if (parent !== undefined) {
      pills.push({
        id: 'todos',
        className: styles.pill,
        title: 'TODOS',
        content: (
          <>
            <Checks size={11} aria-hidden />
            <span className={styles.text}>{parent.trim() || 'Untitled'}</span>
          </>
        ),
      })
    }
    if (progress) {
      pills.push({
        id: 'checklist',
        className: styles.pill,
        title: 'Checklist',
        content: `${progress.done}/${progress.total}`,
      })
    }
    if (task.recurrence) {
      pills.push({
        id: 'recurrence',
        className: styles.pill,
        title: `Repeats ${describeRecurrence(task.recurrence)}`,
        content: <Repeat size={11} aria-hidden />,
      })
    }
    if (task.scheduledDate) {
      pills.push({
        id: 'scheduledDate',
        className: `${styles.pill} ${late === 'plan' ? styles.late : ''}`,
        title: 'Do date',
        content: (
          <>
            <CalendarBlank size={11} aria-hidden />
            {formatDueShort(task.scheduledDate)}
          </>
        ),
      })
    }
    if (task.dueDate) {
      pills.push({
        id: 'dueDate',
        className: `${styles.pill} ${late === 'deadline' ? styles.overdue : ''}`,
        title: 'Deadline',
        content: (
          <>
            <Flag size={11} aria-hidden />
            {formatDueShort(task.dueDate)}
          </>
        ),
      })
    }
    if (task.rescheduleCount > 0) {
      pills.push({
        id: 'rescheduleCount',
        className: styles.pill,
        title: `Postponed ${task.rescheduleCount}×`,
        content: `↻${task.rescheduleCount}`,
      })
    }
    if (task.important) {
      pills.push({
        id: 'important',
        className: `${styles.pill} ${styles.important}`,
        title: 'Important',
        content: <Star size={11} weight="fill" aria-label="Important" />,
      })
    }
  }
  const metadataRows =
    Math.min(metadata.length, MAX_CARD_METADATA) + (metadata.length > MAX_CARD_METADATA ? 1 : 0)

  return (
    <NodeViewWrapper as="span" className={styles.ref} contentEditable={false}>
      {onOpenTask ? (
        <button
          type="button"
          className={styles.open}
          title={tooltip}
          aria-label="Open task"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            if (e.shiftKey && onOpenTaskModal) {
              e.preventDefault()
              onOpenTaskModal(id)
              return
            }
            onOpenTask(id)
          }}
        >
          <ArrowSquareOut size={12} aria-hidden />
        </button>
      ) : (
        <span className={styles.open} title={tooltip || undefined} aria-hidden>
          <ArrowSquareOut size={12} />
        </span>
      )}
      <span className={`${primary ? 'monetTaskProps' : ''} ${styles.props} ${isOpen(task) ? '' : styles.closed}`}>
        <button
          ref={statusRef}
          type="button"
          className={styles.status}
          style={{ '--status-color': statusColor(task.status, statuses) } as CSSProperties}
          title={canSetStatus ? 'Change status' : currentStatusName}
          aria-haspopup={canSetStatus ? 'menu' : undefined}
          aria-expanded={canSetStatus ? menuOpen : undefined}
          disabled={!canSetStatus}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (canSetStatus && editor.isEditable) setMenuOpen((v) => !v)
          }}
        >
          <span className={styles.dot} aria-hidden />
          {currentStatusName}
          {canSetStatus && <CaretDown size={9} aria-hidden />}
        </button>
        {canEdit && (
          <button
            ref={fieldsRef}
            type="button"
            className={styles.edit}
            title="Edit task"
            aria-expanded={fieldsOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFieldsOpen((v) => !v)}
          >
            <PencilSimple size={11} aria-hidden />
          </button>
        )}
        {primary &&
          (canEdit ? (
            pills.map((pill) => (
              <span key={pill.id} className={pill.className} title={pill.title}>
                {pill.content}
              </span>
            ))
          ) : (
            <>
              {task.scheduledDate && (
                <span className={`${styles.pill} ${late === 'plan' ? styles.late : ''}`} title="Do date">
                  <CalendarBlank size={11} aria-hidden />
                  {formatDueShort(task.scheduledDate)}
                </span>
              )}
              {task.dueDate && (
                <span className={`${styles.pill} ${late === 'deadline' ? styles.overdue : ''}`} title="Deadline">
                  <Flag size={11} aria-hidden />
                  {formatDueShort(task.dueDate)}
                </span>
              )}
              {task.rescheduleCount > 0 && (
                <span className={styles.pill} title={`Postponed ${task.rescheduleCount}×`}>
                  ↻{task.rescheduleCount}
                </span>
              )}
              {task.important && (
                <span className={`${styles.pill} ${styles.important}`} title="Important">
                  <Star size={11} weight="fill" aria-label="Important" />
                </span>
              )}
              {parent !== undefined && (
                <span className={styles.pill} title="TODOS">
                  <Checks size={11} aria-hidden />
                  <span className={styles.text}>{parent.trim() || 'Untitled'}</span>
                </span>
              )}
            </>
          ))}
      </span>
      {primary && metadataRows > 0 && (
        <span className={`monetTaskMeta ${styles.meta}`} data-rows={metadataRows}>
          {metadata.slice(0, MAX_CARD_METADATA).map(({ def, value }) => {
            const text = formatMetadataValue(def, value)
            return (
              <Fragment key={def.id}>
                <span className={styles.metaKey} title={def.name}>
                  {def.name}
                </span>
                <span className={styles.metaValue} title={text}>
                  {text}
                </span>
              </Fragment>
            )
          })}
          {metadata.length > MAX_CARD_METADATA &&
            (canEdit ? (
              <button
                type="button"
                className={styles.metaMore}
                title="Show all fields"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setFieldsOpen(true)}
              >
                +{metadata.length - MAX_CARD_METADATA} more
              </button>
            ) : (
              <span className={styles.metaMore}>+{metadata.length - MAX_CARD_METADATA} more</span>
            ))}
        </span>
      )}
      {menuOpen && canSetStatus && (
        <StatusMenu
          anchorRef={statusRef}
          statuses={statuses}
          current={task.status}
          onPick={(status) => {
            setMenuOpen(false)
            if (status !== task.status) onSetStatus(id, status)
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}
      {fieldsOpen && canEdit && (
        <CardFieldsPopover taskId={id} anchorRef={fieldsRef} onClose={() => setFieldsOpen(false)} />
      )}
    </NodeViewWrapper>
  )
}

interface CardFieldsPopoverProps {
  taskId: string
  anchorRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

// Popover dos campos do card em portal (a linha de propriedades corta o que
// transborda). Lê a task do contexto a cada render — editar um campo atualiza o
// card sem cópia local. Abre para baixo e vira para cima quando não cabe;
// fecha com Esc, clique fora, rolagem ou resize.
function CardFieldsPopover({ taskId, anchorRef, onClose }: CardFieldsPopoverProps) {
  const {
    tasksById,
    notebooks = [],
    statuses = BUILTIN_STATUS_DEFS,
    todosOptions = [],
    onOpenTodos,
    onCreateTodos,
    metadataDefs = [],
    onUpdateTask,
    onMoveTask,
    onManageMetadata,
  } = useTasksContext()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [placeAbove, setPlaceAbove] = useState(false)
  const task = tasksById.get(taskId)

  useLayoutEffect(() => {
    const el = popoverRef.current
    const anchor = anchorRef.current?.getBoundingClientRect()
    if (!el || !anchor) return
    const spaceBelow = window.innerHeight - anchor.bottom - 8
    const spaceAbove = anchor.top - 8
    setPlaceAbove(el.scrollHeight > spaceBelow && spaceAbove > spaceBelow)
  }, [anchorRef, task])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    function handleScroll(e: Event) {
      if (popoverRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchorRef, onClose])

  if (!task || !onUpdateTask || !onMoveTask || !onManageMetadata) return null

  const rect = anchorRef.current?.getBoundingClientRect()
  if (!rect) return null
  const width = Math.min(360, window.innerWidth - 16)
  const space = placeAbove ? rect.top - 8 : window.innerHeight - rect.bottom - 8
  const style: CSSProperties = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    width,
    // Nunca maior que a janela; abaixo do card, limitado pelo espaço restante.
    maxHeight: Math.min(window.innerHeight - 16, Math.max(space, 0)),
    overflowY: 'auto',
    ...(placeAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
  }

  return createPortal(
    <div ref={popoverRef} className={styles.popover} style={style} role="dialog" aria-label="Task fields">
      <TaskFields
        layout="compact"
        task={task}
        notebooks={notebooks}
        statuses={statuses}
        todosOptions={todosOptions}
        onOpenTodos={onOpenTodos}
        onCreateTodos={onCreateTodos}
        onUpdate={(patch) => onUpdateTask(task.id, patch)}
        onMove={(project) => onMoveTask(task.id, project)}
        metadataDefs={metadataDefs}
        onManageMetadata={onManageMetadata}
      />
    </div>,
    document.body
  )
}

interface StatusMenuProps {
  anchorRef: RefObject<HTMLButtonElement | null>
  statuses: TaskStatusDef[]
  current: TaskStatus
  onPick: (status: TaskStatus) => void
  onClose: () => void
}

// Menu de status em portal (a linha de propriedades corta o que transborda),
// na ordem do registro; status atual desconhecido (excluído em outra janela)
// entra no fim, como na barra de propriedades. Fecha com Esc, clique fora,
// rolagem ou resize. Os itens não tiram o foco do editor.
function StatusMenu({ anchorRef, statuses, current, onPick, onClose }: StatusMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const options = statuses.some((s) => s.id === current)
    ? statuses
    : [...statuses, { id: current, name: current, color: null, sortOrder: statuses.length, wipLimit: null, builtin: false }]

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    function handleScroll(e: Event) {
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchorRef, onClose])

  const rect = anchorRef.current?.getBoundingClientRect()
  if (!rect) return null
  const height = options.length * MENU_ITEM_HEIGHT + 8
  const above = rect.bottom + 4 + height > window.innerHeight && rect.top - 4 - height >= 0
  const style: CSSProperties = above
    ? { left: rect.left, bottom: window.innerHeight - rect.top + 4 }
    : { left: rect.left, top: rect.bottom + 4 }

  return createPortal(
    <div ref={menuRef} className={styles.menu} style={style} role="menu">
      {options.map((s) => (
        <button
          key={s.id}
          type="button"
          role="menuitemradio"
          aria-checked={s.id === current}
          className={styles.menuItem}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(s.id)}
        >
          <span className={styles.dot} style={{ background: statusColor(s.id, statuses) }} aria-hidden />
          <span className={styles.menuName}>{s.name}</span>
          {s.id === current && <Check size={12} aria-hidden />}
        </button>
      ))}
    </div>,
    document.body
  )
}
