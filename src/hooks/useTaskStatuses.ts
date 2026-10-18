import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { TaskStatusDef } from '../types'
import { storage } from '../storage'
import { BUILTIN_STATUS_DEFS, isTerminalStatus } from '../lib/tasks'
import { emitTasksChanged, onTasksChangedElsewhere } from '../lib/tasksEvents'

// Registro de status (SQLite, compartilhado entre janelas). Antes da primeira
// leitura, e se ela falhar, vale o registro built-in. Abertos na ordem do
// registro, depois Done e Dropped (bancos antigos têm custom depois de Dropped).
function withBuiltins(list: TaskStatusDef[]): TaskStatusDef[] {
  const have = new Set(list.map((s) => s.id))
  const missing = BUILTIN_STATUS_DEFS.filter((s) => !have.has(s.id))
  return [...list, ...missing].sort(
    (a, b) => Number(isTerminalStatus(a.id)) - Number(isTerminalStatus(b.id)) || a.sortOrder - b.sortOrder
  )
}

// sort_order normalizado: abertos 0..n-1 na ordem dada, depois Done e Dropped.
function normalizeOrder(open: TaskStatusDef[], list: TaskStatusDef[]): TaskStatusDef[] {
  return [...open, ...list.filter((s) => isTerminalStatus(s.id))].map((s, i) => ({ ...s, sortOrder: i }))
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

  // Aplica a ordem no estado e grava só as linhas cujo sort_order mudou, uma
  // execução por linha (sem BEGIN/COMMIT: pool sqlx). Falha parcial é segura:
  // a leitura põe Done/Dropped no fim e o próximo reorder renormaliza.
  const applyOrder = useCallback(
    async (next: TaskStatusDef[], what: string): Promise<boolean> => {
      const before = new Map(statusesRef.current.map((s) => [s.id, s.sortOrder]))
      const changed = next.filter((s) => before.get(s.id) !== s.sortOrder)
      setStatuses(next)
      return persist(async () => {
        for (const s of changed) await storage.saveTaskStatus(s)
      }, what)
    },
    [persist]
  )

  // Novo status entra no fim dos abertos, antes de Done/Dropped.
  const create = useCallback(
    async (name: string, color: string | null) => {
      const list = statusesRef.current
      const draft: TaskStatusDef = {
        id: `st_${nanoid(8)}`,
        name: name.trim(),
        color,
        sortOrder: 0,
        wipLimit: null,
        builtin: false,
      }
      const open = [...list.filter((s) => !isTerminalStatus(s.id)), draft]
      await applyOrder(normalizeOrder(open, list), 'create status')
    },
    [applyOrder]
  )

  // `openIds`: ids dos status abertos na nova ordem. Em falha, recarrega do banco
  // aqui e avisa as outras janelas (a gravação pode ter sido parcial).
  const reorder = useCallback(
    async (openIds: string[]) => {
      const list = statusesRef.current
      const open = openIds
        .map((id) => list.find((s) => s.id === id && !isTerminalStatus(s.id)))
        .filter((s): s is TaskStatusDef => !!s)
      if (open.length !== list.filter((s) => !isTerminalStatus(s.id)).length) return
      if (await applyOrder(normalizeOrder(open, list), 'reorder statuses')) return
      void reload()
      emitTasksChanged()
    },
    [applyOrder, reload]
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

  return { statuses, saveError, reload, create, rename, update, remove, reorder }
}
