import { useCallback, useState, type KeyboardEvent } from 'react'
import { useConfirm } from '../../hooks/useConfirm'
import {
  addDaysKey,
  deleteTasksMessage,
  isDone,
  isDropped,
  isOpen,
  nextStatus,
  snoozeDate,
  startOfWeekKey,
  type SnoozeKind,
  type TaskPatch,
} from '../../lib/tasks'
import type { Task } from '../../types'
import { useTasksEnv } from './TasksEnv'
import { useTaskActions } from './useTaskActions'
import { TASKS_SHORTCUTS_EVENT } from './TaskShortcuts'

// Atalhos e multi-seleção das visões de Tasks (lista, Week, Kanban). Ativos
// só com o foco dentro do container; eventos vindos de campos de texto são
// ignorados. As ações valem para a seleção (ou para o cursor, sem seleção):
//   ↑/↓ cursor (Shift estende) · Enter abre · Esc limpa a seleção
//   x concluir/reabrir · s cicla status · t para hoje · d escolher data
//   p planeja para hoje · z adia 1 dia · Z adia 1 semana · Delete → dropped
//   / ou Ctrl+F foca a busca · ? abre a lista de atalhos (TaskShortcuts)
// As ações que mudam tasks passam por useTaskActions (barra "Undo" e pergunta
// do deadline estourado ao reagendar).
// Clique abre; Ctrl/Cmd+clique alterna na seleção; Shift+clique seleciona o
// intervalo desde o cursor.

export type TaskChanges = Array<{ id: string; patch: TaskPatch }>

interface Options {
  // Ordem visual achatada das tasks visíveis.
  orderedIds: string[]
  tasksById: Map<string, Task>
  todayKey: string
  onOpen: (task: Task) => void
  onUpdateTasks: (changes: TaskChanges) => void
  // Exclusão definitiva (task + nota-corpo), depois da confirmação.
  onDeleteTasks: (ids: string[]) => void
}

interface ClickModifiers {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

function isTextTarget(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
  )
}

export function useTaskKeyboard({
  orderedIds,
  tasksById,
  todayKey,
  onOpen,
  onUpdateTasks,
  onDeleteTasks,
}: Options) {
  const { confirm, modal: confirmModal } = useConfirm()
  const { statuses } = useTasksEnv()
  const actions = useTaskActions({ tasksById, todayKey, onUpdateTasks, onDeleteTasks })
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  // Popover de data: posição na tela (linha do cursor ou barra de lote).
  const [datePickerAt, setDatePickerAt] = useState<{ top: number; left: number } | null>(null)

  // Seleção restrita ao que ainda está visível.
  const visible = new Set(orderedIds)
  const selection = [...selectedIds].filter((id) => visible.has(id))
  const cursor = cursorId !== null && visible.has(cursorId) ? cursorId : null
  const targets = selection.length > 0 ? selection : cursor ? [cursor] : []

  const rowEl = (root: HTMLElement, id: string) =>
    root.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(id)}"]`)

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  const closeDatePicker = useCallback(() => setDatePickerAt(null), [])

  function apply(patchFor: (t: Task) => TaskPatch | null, verb: string, ids = targets) {
    const changes: TaskChanges = []
    for (const id of ids) {
      const t = tasksById.get(id)
      const patch = t ? patchFor(t) : null
      if (patch) changes.push({ id, patch })
    }
    actions.update(changes, verb)
  }

  const taskList = (ids: string[]) => ids.map((id) => tasksById.get(id)).filter((t): t is Task => !!t)

  // Exclusão definitiva (sem Undo): só com confirmação.
  async function requestDelete(ids: string[], title = 'Delete tasks') {
    const list = taskList(ids)
    if (list.length === 0) return
    const ok = await confirm(deleteTasksMessage(list), {
      title,
      confirmLabel: 'Delete permanently',
      destructive: true,
    })
    if (!ok) return
    onDeleteTasks(list.map((t) => t.id))
    clearSelection()
  }

  function toggleDone() {
    const all = taskList(targets)
    const allDone = all.length > 0 && all.every(isDone)
    apply(() => ({ status: allDone ? 'todo' : 'done' }), allDone ? 'reopened' : 'marked done')
  }

  function schedule(key: string | null, ids = targets) {
    void actions.reschedule(
      ids.map((id) => ({ id, date: key })),
      key === todayKey ? 'moved to today' : 'rescheduled'
    )
  }

  // My Day: adiciona ao dia de hoje; se todas já estão, remove.
  function togglePlan(ids = targets) {
    const all = taskList(ids)
    const allPlanned = all.length > 0 && all.every((t) => t.plannedDay === todayKey)
    apply(
      (t) => (isOpen(t) ? { plannedDay: allPlanned ? null : todayKey } : null),
      allPlanned ? 'removed from My Day' : 'added to My Day',
      ids
    )
  }

  function snooze(kind: SnoozeKind, ids = targets) {
    const open = taskList(ids).filter((t) => !isDone(t) && !isDropped(t))
    void actions.reschedule(
      open.map((t) => ({ id: t.id, date: snoozeDate(t, kind, todayKey) })),
      'snoozed'
    )
  }

  function drop(ids = targets) {
    apply((t) => (isDropped(t) ? null : { status: 'dropped' }), 'dropped', ids)
  }

  function openDatePicker(anchor: HTMLElement | null) {
    if (targets.length === 0 || !anchor) return
    const rect = anchor.getBoundingClientRect()
    setDatePickerAt({ top: rect.bottom + 4, left: rect.left })
  }

  function moveCursor(root: HTMLElement, delta: number, extend: boolean) {
    if (orderedIds.length === 0) return
    const idx = cursor ? orderedIds.indexOf(cursor) : -1
    const nextIdx =
      idx < 0 ? (delta > 0 ? 0 : orderedIds.length - 1) : Math.min(orderedIds.length - 1, Math.max(0, idx + delta))
    const next = orderedIds[nextIdx]
    if (extend) {
      // Seleção nova: o Undo de uma ação anterior não esconde a barra de lote.
      actions.dismissUndo()
      setSelectedIds((prev) => {
        const set = new Set(prev)
        if (cursor) set.add(cursor)
        set.add(next)
        return set
      })
    } else {
      clearSelection()
    }
    setCursorId(next)
    const el = rowEl(root, next)
    el?.focus()
    el?.scrollIntoView({ block: 'nearest' })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (isTextTarget(e.target) || e.altKey) return
    // Eventos de portais (modal de confirmação) borbulham pela árvore React.
    if (!e.currentTarget.contains(e.target as Node)) return
    // Busca: `/` ou Ctrl/Cmd+F focam o campo do cabeçalho.
    if ((e.key === '/' && !e.ctrlKey && !e.metaKey) || (e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey))) {
      const input = document.querySelector<HTMLInputElement>('[data-tasks-search]')
      if (!input) return
      input.focus()
      input.select()
      e.preventDefault()
      return
    }
    if (e.ctrlKey || e.metaKey) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        moveCursor(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1, e.shiftKey)
        break
      case 'Enter': {
        // Linha focada trata o próprio Enter (TaskCard).
        if (e.target !== e.currentTarget || !cursor) return
        const t = tasksById.get(cursor)
        if (t) onOpen(t)
        break
      }
      case 'Escape':
        if (selection.length === 0) return
        clearSelection()
        break
      case 'x':
        toggleDone()
        break
      case 's':
        apply((t) => ({ status: nextStatus(t.status, statuses) }), 'status changed')
        break
      case 't':
        schedule(todayKey)
        break
      case 'p':
        togglePlan()
        break
      case 'z':
        snooze('1d')
        break
      case 'Z':
        snooze('1w')
        break
      case 'd':
        openDatePicker(cursor ? rowEl(e.currentTarget, cursor) : null)
        break
      case 'Delete':
        drop()
        break
      case '?':
        // Com o foco nas Tasks vale a lista de Tasks, não o ShortcutsOverlay da
        // casca: stopPropagation + o preventDefault abaixo (o handler global
        // ignora tecla já tratada) não deixam os dois abrirem juntos.
        e.stopPropagation()
        window.dispatchEvent(new Event(TASKS_SHORTCUTS_EVENT))
        break
      default:
        return
    }
    e.preventDefault()
  }

  // Clique numa task: devolve true quando ela deve ser aberta (clique simples).
  function handleClick(e: ClickModifiers, id: string): boolean {
    if (e.ctrlKey || e.metaKey || (e.shiftKey && cursor)) actions.dismissUndo()
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const set = new Set(prev)
        if (set.has(id)) set.delete(id)
        else set.add(id)
        return set
      })
      setCursorId(id)
      return false
    }
    if (e.shiftKey && cursor) {
      const a = orderedIds.indexOf(cursor)
      const b = orderedIds.indexOf(id)
      if (a >= 0 && b >= 0) {
        setSelectedIds(new Set(orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1)))
        return false
      }
    }
    clearSelection()
    setCursorId(id)
    return true
  }

  return {
    containerProps: { tabIndex: 0, onKeyDown },
    cursorId: cursor,
    selectedIds: new Set(selection),
    handleClick,
    clearSelection,
    actions,
    schedule,
    markDone: () => apply((t) => (isDone(t) ? null : { status: 'done' }), 'marked done'),
    // Uma task só (botões do card/linha), sem mexer na seleção.
    snoozeTask: (t: Task, kind: SnoozeKind) => snooze(kind, [t.id]),
    togglePlanTask: (t: Task) => togglePlan([t.id]),
    toggleTask: (id: string, done: boolean, run: () => void) =>
      actions.track(done ? 'marked done' : 'reopened', [id], run),
    dropSelected: () => drop(),
    requestDelete,
    deleteSelected: () => void requestDelete(targets),
    confirmModal,
    nextMonday: addDaysKey(startOfWeekKey(todayKey), 7),
    datePickerAt,
    openDatePicker,
    closeDatePicker,
  }
}
