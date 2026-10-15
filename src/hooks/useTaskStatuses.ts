import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { TaskStatusDef } from '../types'
import { storage } from '../storage'
import { BUILTIN_STATUS_DEFS } from '../lib/tasks'
import { emitTasksChanged, onTasksChangedElsewhere } from '../lib/tasksEvents'

// Registro de status (SQLite, compartilhado entre janelas). Antes da primeira
// leitura, e se ela falhar, vale o registro built-in.
function withBuiltins(list: TaskStatusDef[]): TaskStatusDef[] {
  const have = new Set(list.map((s) => s.id))
  const missing = BUILTIN_STATUS_DEFS.filter((s) => !have.has(s.id))
  return [...list, ...missing].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function useTaskStatuses(opts?: { onRemoved?: (id: string) => void }) {
  const [statuses, setStatuses] = useState<TaskStatusDef[]>(BUILTIN_STATUS_DEFS)
  const [saveError, setSaveError] = useState<string | null>(null)
  const statusesRef = useRef(statuses)
  statusesRef.current = statuses
  const onRemovedRef = useRef(opts?.onRemoved)
  onRemovedRef.current = opts?.onRemoved

  const reload = useCallback(async () => {
    try {
      setStatuses(withBuiltins(await storage.getTaskStatuses()))
    } catch (err) {
      console.error('failed to load task statuses', err)
    }
  }, [])

  useEffect(() => {
    void reload()
    return onTasksChangedElsewhere(() => void reload())
  }, [reload])

  const persist = useCallback(async (op: () => Promise<void>, what: string): Promise<boolean> => {
    try {
      await op()
      setSaveError(null)
      emitTasksChanged()
      return true
    } catch (err) {
      console.error(`failed to ${what}`, err)
      setSaveError('Failed to save status.')
      return false
    }
  }, [])

  const patch = useCallback(
    async (id: string, change: Partial<Pick<TaskStatusDef, 'name' | 'color' | 'wipLimit'>>) => {
      const current = statusesRef.current.find((s) => s.id === id)
      if (!current) return
      const next = { ...current, ...change }
      setStatuses((list) => list.map((s) => (s.id === id ? next : s)))
      await persist(() => storage.saveTaskStatus(next), 'save status')
    },
    [persist]
  )

  const create = useCallback(
    async (name: string, color: string | null): Promise<TaskStatusDef> => {
      const sortOrder = statusesRef.current.reduce((m, s) => Math.max(m, s.sortOrder), 0) + 1
      const def: TaskStatusDef = {
        id: `st_${nanoid(8)}`,
        name: name.trim(),
        color,
        sortOrder,
        wipLimit: null,
        builtin: false,
      }
      setStatuses((list) => [...list, def])
      await persist(() => storage.saveTaskStatus(def), 'create status')
      return def
    },
    [persist]
  )

  // Tasks no status excluído voltam a `todo` (banco: deleteTaskStatus; memória:
  // `onRemoved`). Built-ins não são excluíveis.
  const remove = useCallback(
    async (id: string) => {
      const current = statusesRef.current.find((s) => s.id === id)
      if (!current || current.builtin) return
      if (!(await persist(() => storage.deleteTaskStatus(id), 'delete status'))) return
      setStatuses((list) => list.filter((s) => s.id !== id))
      onRemovedRef.current?.(id)
    },
    [persist]
  )

  const rename = useCallback((id: string, name: string) => patch(id, { name: name.trim() }), [patch])
  const update = useCallback(
    (id: string, change: { color?: string | null; wipLimit?: number | null }) => patch(id, change),
    [patch]
  )

  return { statuses, saveError, reload, create, rename, update, remove }
}
