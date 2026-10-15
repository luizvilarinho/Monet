import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { TaskView, TaskViewConfig } from '../types'
import { storage } from '../storage'
import { emitTasksChanged, onTasksChangedElsewhere } from '../lib/tasksEvents'

// Visões salvas da TasksView (SQLite, compartilhadas entre janelas).
export function useTaskViews() {
  const [views, setViews] = useState<TaskView[]>([])
  const viewsRef = useRef(views)
  viewsRef.current = views

  const reload = useCallback(async () => {
    try {
      setViews(await storage.getTaskViews())
    } catch (err) {
      console.error('failed to load task views', err)
    }
  }, [])

  useEffect(() => {
    void reload()
    return onTasksChangedElsewhere(() => void reload())
  }, [reload])

  const persist = useCallback(async (op: () => Promise<void>, what: string) => {
    try {
      await op()
      emitTasksChanged()
    } catch (err) {
      console.error(`failed to ${what}`, err)
    }
  }, [])

  const create = useCallback(
    async (name: string, config: TaskViewConfig): Promise<TaskView> => {
      const sortOrder = viewsRef.current.reduce((m, v) => Math.max(m, v.sortOrder), 0) + 1
      const view: TaskView = { id: `tv_${nanoid(8)}`, name: name.trim(), config, sortOrder }
      setViews((list) => [...list, view])
      await persist(() => storage.saveTaskView(view), 'save view')
      return view
    },
    [persist]
  )

  const rename = useCallback(
    async (id: string, name: string) => {
      const current = viewsRef.current.find((v) => v.id === id)
      if (!current) return
      const next = { ...current, name: name.trim() }
      setViews((list) => list.map((v) => (v.id === id ? next : v)))
      await persist(() => storage.saveTaskView(next), 'rename view')
    },
    [persist]
  )

  const remove = useCallback(
    async (id: string) => {
      setViews((list) => list.filter((v) => v.id !== id))
      await persist(() => storage.deleteTaskView(id), 'delete view')
    },
    [persist]
  )

  return { views, reload, create, rename, remove }
}
