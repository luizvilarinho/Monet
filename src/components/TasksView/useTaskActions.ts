import { useEffect, useRef, useState } from 'react'
import { useConfirm } from '../../hooks/useConfirm'
import { deadlinePassedFor, formatDueShort, reschedulePatch, undoPatch } from '../../lib/tasks'
import type { Task } from '../../types'
import { useTasksEnv } from './TasksEnv'
import type { TaskChanges } from './useTaskKeyboard'

// Ações das visões de Tasks com "Undo" (concluir, drop, snooze, arrasto, lote)
// e o reagendamento que pergunta pelo deadline estourado.

const UNDO_MS = 6000

// Opcional nas ações com Undo: `note` soma um aviso à mensagem; `extra` põe
// uma ação a mais na barra (ex.: "Move deadline too") que aplica `changes` e
// continua desfazível pelo mesmo Undo.
export interface UndoOptions {
  note?: string
  extra?: { label: string; changes: TaskChanges; message: string }
}

interface UndoEntry {
  message: string
  // Estado das tasks antes da ação.
  before: Task[]
  extra?: UndoOptions['extra']
}

interface Options {
  tasksById: Map<string, Task>
  todayKey: string
  onUpdateTasks: (changes: TaskChanges) => void
  // Undo de uma recorrente concluída: apaga a ocorrência que a conclusão gerou.
  onDeleteTasks?: (ids: string[]) => void
}

export function useTaskActions({ tasksById, todayKey, onUpdateTasks, onDeleteTasks }: Options) {
  const { choose, modal } = useConfirm()
  const { onMoveTaskToProject } = useTasksEnv()
  const [undo, setUndo] = useState<UndoEntry | null>(null)
  // O Undo e o reagendamento (depois do modal) leem o estado atual.
  const tasksRef = useRef(tasksById)
  tasksRef.current = tasksById

  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [undo])

  // Roda a ação e guarda o estado anterior; `run` devolve false = nada mudou.
  function track(verb: string, ids: string[], run: () => boolean | void, options?: UndoOptions) {
    const before = ids.map((id) => tasksRef.current.get(id)).filter((t): t is Task => !!t)
    if (run() === false || before.length === 0) return
    const message = before.length === 1 ? `Task ${verb}.` : `${before.length} tasks ${verb}.`
    setUndo({ message: options?.note ? `${message} ${options.note}` : message, before, extra: options?.extra })
  }

  function update(changes: TaskChanges, verb: string, options?: UndoOptions) {
    if (changes.length === 0) return
    track(verb, [...new Set(changes.map((c) => c.id))], () => onUpdateTasks(changes), options)
  }

  // Novo do date por task. Deadline já estourado pergunta se ele vai junto.
  async function reschedule(
    items: Array<{ id: string; date: string | null }>,
    verb = 'rescheduled',
    options?: UndoOptions
  ) {
    const list = items.flatMap(({ id, date }) => {
      const task = tasksRef.current.get(id)
      return task ? [{ task, date }] : []
    })
    const missed = list.filter(({ task, date }) => deadlinePassedFor(task, date, todayKey))
    let moveDeadline = false
    if (missed.length > 0) {
      const [{ task, date }] = missed
      const message =
        missed.length === 1
          ? `The deadline (${formatDueShort(task.dueDate!)}) has already passed. Move it to ${formatDueShort(date!)} too?`
          : `${missed.length} of these tasks have a deadline that has already passed. Move their deadlines to the new date too?`
      const choice = await choose(message, {
        title: 'Deadline passed',
        confirmLabel: 'Move deadline too',
        altLabel: 'Keep deadline',
        cancelLabel: 'Cancel',
      })
      if (choice === 'cancel') return
      moveDeadline = choice === 'confirm'
    }
    const missedIds = new Set(missed.map(({ task }) => task.id))
    const changes: TaskChanges = []
    for (const { task, date } of list) {
      const patch = reschedulePatch(task, date, todayKey, moveDeadline && missedIds.has(task.id))
      if (patch) changes.push({ id: task.id, patch })
    }
    update(changes, verb, options)
  }

  // Ação extra da barra: aplica as mudanças dela e mantém o `before` original,
  // então o Undo seguinte desfaz o arrasto e a ação extra juntos.
  function runUndoExtra() {
    if (!undo?.extra) return
    onUpdateTasks(undo.extra.changes)
    // Objeto novo: reinicia o prazo do Undo.
    setUndo({ message: undo.extra.message, before: undo.before })
  }

  // Volta as tasks ao estado anterior: campos, projeto e a ocorrência gerada.
  function runUndo() {
    if (!undo) return
    setUndo(null)
    const changes: TaskChanges = []
    const moves: Array<{ id: string; notebookId: string }> = []
    const generated: string[] = []
    for (const before of undo.before) {
      const current = tasksRef.current.get(before.id)
      if (!current) continue
      const patch = undoPatch(before, current)
      if (patch) changes.push({ id: before.id, patch })
      if (current.notebookId !== before.notebookId) moves.push({ id: before.id, notebookId: before.notebookId })
      if (current.recurrenceNextId !== null && current.recurrenceNextId !== before.recurrenceNextId) {
        generated.push(current.recurrenceNextId)
      }
    }
    if (changes.length > 0) onUpdateTasks(changes)
    for (const m of moves) onMoveTaskToProject(m.id, m.notebookId)
    if (generated.length > 0) onDeleteTasks?.(generated)
  }

  return {
    track,
    update,
    reschedule,
    undoMessage: undo?.message ?? null,
    undoExtraLabel: undo?.extra?.label ?? null,
    runUndoExtra,
    runUndo,
    dismissUndo: () => setUndo(null),
    modal,
  }
}

export type TaskActions = ReturnType<typeof useTaskActions>
