import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import { nanoid } from 'nanoid'
import type { Task, TaskRecurrence, TaskStatus } from '../types'
import { storage } from '../storage'
import { dateKeyFromMs } from '../lib/calendar'
import { applyTaskPatch, buildNextOccurrence, normalizeGroup, type TaskPatch } from '../lib/tasks'

export interface NewTaskInput {
  title: string
  status?: TaskStatus
  dueDate?: string | null
  scheduledDate?: string | null
  group?: string | null
  important?: boolean
  recurrence?: TaskRecurrence | null
  notebookId: string
  noteId: string | null
  sourceNoteId?: string | null
}

// Tabela de tasks. A nota-corpo e o caderno-projeto são orquestrados no App;
// este hook só persiste a task. Toda mutação persistida emite `tasks-changed`, que faz
// as outras janelas recarregarem. A emissora não recarrega: seu estado otimista já
// está à frente do banco, e um reload em voo poderia trazer uma linha defasada.
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  // Primeira leitura concluída com sucesso: antes disso `tasks=[]` não é
  // confiável (usado pelo sync de notas no RAG).
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const originRef = useRef(nanoid())

  const reload = useCallback(async () => {
    try {
      setTasks(await storage.getTasks())
      setLoaded(true)
      setLoadFailed(false)
    } catch (err) {
      console.error('failed to load tasks', err)
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    void reload()
    let cancelled = false
    let unlisten: (() => void) | undefined
    void listen<{ origin: string }>('tasks-changed', (e) => {
      if (e.payload?.origin !== originRef.current) void reload()
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [reload])

  const persist = useCallback(async (op: () => Promise<void>, what: string) => {
    try {
      await op()
      setSaveError(null)
      void emit('tasks-changed', { origin: originRef.current })
    } catch (err) {
      console.error(`failed to ${what}`, err)
      setSaveError('Failed to save task.')
    }
  }, [])

  const createTasks = useCallback(
    async (inputs: NewTaskInput[]): Promise<Task[]> => {
      const now = Date.now()
      let order = tasksRef.current.reduce((m, t) => Math.max(m, t.sortOrder), 0)
      const created: Task[] = inputs.map((i) => {
        const status = i.status ?? 'todo'
        order += 1
        return {
          id: nanoid(),
          title: i.title,
          status,
          notebookId: i.notebookId,
          noteId: i.noteId,
          dueDate: i.dueDate ?? null,
          scheduledDate: i.scheduledDate ?? null,
          group: normalizeGroup(i.group ?? null),
          important: i.important ?? false,
          recurrence: i.recurrence ?? null,
          recurrenceNextId: null,
          createdAt: now,
          updatedAt: now,
          completedAt: status === 'done' ? now : null,
          sourceNoteId: i.sourceNoteId ?? null,
          rescheduleCount: 0,
          sortOrder: order,
        }
      })
      setTasks((prev) => [...prev, ...created])
      await persist(async () => {
        for (const t of created) await storage.saveTask(t)
      }, 'create tasks')
      return created
    },
    [persist]
  )

  // Lote: um único setTasks e um único `tasks-changed`; os saves são
  // sequenciais (sem transação manual pelo plugin SQL).
  // Recorrente que entra em `done` gera a próxima ocorrência uma única vez:
  // `recurrenceNextId` aponta para ela, então desmarcar e remarcar não duplica.
  const updateTasks = useCallback(
    async (changes: Array<{ id: string; patch: TaskPatch }>) => {
      const now = Date.now()
      const current = tasksRef.current
      const nextById = new Map<string, Task>()
      const prevById = new Map<string, Task>()
      for (const { id, patch } of changes) {
        const original = current.find((t) => t.id === id)
        if (!original) continue
        if (!prevById.has(id)) prevById.set(id, original)
        nextById.set(id, applyTaskPatch(nextById.get(id) ?? original, patch, now))
      }
      if (nextById.size === 0) return
      const existing = new Set(current.map((t) => t.id))
      const generated: Task[] = []
      let order = current.reduce((m, t) => Math.max(m, t.sortOrder), 0)
      for (const [id, next] of nextById) {
        const becameDone = prevById.get(id)!.status !== 'done' && next.status === 'done'
        const alreadyGenerated = next.recurrenceNextId !== null && existing.has(next.recurrenceNextId)
        if (!becameDone || !next.recurrence || alreadyGenerated) continue
        order += 1
        const occurrence = buildNextOccurrence(next, nanoid(), order, dateKeyFromMs(now), now)
        generated.push(occurrence)
        nextById.set(id, { ...next, recurrenceNextId: occurrence.id })
      }
      setTasks((list) => [...list.map((t) => nextById.get(t.id) ?? t), ...generated])
      await persist(async () => {
        for (const t of nextById.values()) await storage.saveTask(t)
        for (const t of generated) await storage.saveTask(t)
      }, 'save tasks')
    },
    [persist]
  )

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => updateTasks([{ id, patch }]),
    [updateTasks]
  )

  // Deletes sequenciais, sem BEGIN/COMMIT (o tauri-plugin-sql usa pool).
  const deleteTasks = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      const set = new Set(ids)
      setTasks((list) => list.filter((t) => !set.has(t.id)))
      await persist(async () => {
        for (const id of ids) await storage.deleteTask(id)
      }, 'delete tasks')
    },
    [persist]
  )

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  return {
    tasks,
    tasksById,
    loaded,
    loadFailed,
    saveError,
    reload,
    createTasks,
    updateTask,
    updateTasks,
    deleteTasks,
  }
}
