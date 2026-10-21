import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ArrowSquareOut, CalendarBlank, CaretDown, Check, Checks, Flag, Star } from '@phosphor-icons/react'
import { formatMetadataValue, visibleMetadata } from '../../lib/metadata'
import {
  BUILTIN_STATUS_DEFS,
  formatDueShort,
  isOpen,
  overdueKind,
  statusColor,
  statusName,
} from '../../lib/tasks'
import type { TaskStatus, TaskStatusDef } from '../../types'
import { useTasksContext } from './TasksContext'
import styles from './TaskRef.module.css'

// Altura estimada de um item do menu (para abrir para cima perto do rodapé).
const MENU_ITEM_HEIGHT = 28

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
// editor editável), do date, ⚑ deadline, ↻n, ★, TODOS (se for outra nota) e
// metadados custom. Fora do card (keep, item sem a decoration), fica inline.
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
  } = useTasksContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const statusRef = useRef<HTMLButtonElement>(null)
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
  const currentStatusName = statusName(task.status, statuses)
  const tooltip = [
    onOpenTask ? 'Open task' : '',
    project ? `Project: ${project.name || 'unnamed'}` : '',
    progress ? `Checklist ${progress.done}/${progress.total}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <NodeViewWrapper as="span" className={styles.ref} contentEditable={false}>
      {onOpenTask ? (
        <button
          type="button"
          className={styles.open}
          title={tooltip}
          aria-label="Open task"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onOpenTask(id)}
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
        {primary && (
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
            {metadata.map(({ def, value }) => {
              const text = `${def.name}: ${formatMetadataValue(def, value)}`
              return (
                <span key={def.id} className={styles.pill} title={text}>
                  <span className={styles.text}>{text}</span>
                </span>
              )
            })}
          </>
        )}
      </span>
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
    </NodeViewWrapper>
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
