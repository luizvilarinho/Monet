import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import { nanoid } from 'nanoid'
import type { Task, TaskStatus } from '../types'
import { storage } from '../storage'
import { applyTaskPatch, type TaskPatch } from '../lib/tasks'

export interface NewTaskInput {
  title: string
  status?: TaskStatus
  dueDate?: string | null
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

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      const prev = tasksRef.current.find((t) => t.id === id)
      if (!prev) return
      const next = applyTaskPatch(prev, patch, Date.now())
      setTasks((list) => list.map((t) => (t.id === id ? next : t)))
      await persist(() => storage.saveTask(next), 'save task')
    },
    [persist]
  )

  const deleteTask = useCallback(
    async (id: string) => {
      setTasks((list) => list.filter((t) => t.id !== id))
      await persist(() => storage.deleteTask(id), 'delete task')
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
    deleteTask,
  }
}
