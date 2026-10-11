import { createContext, useContext } from 'react'
import type { Task } from '../../types'

export interface TasksContextValue {
  tasksById: Map<string, Task>
  todayKey: string
  onOpenTask?: (id: string) => void
}

const EMPTY: TasksContextValue = { tasksById: new Map(), todayKey: '' }

const Ctx = createContext<TasksContextValue>(EMPTY)

export const TasksProvider = Ctx.Provider

export function useTasksContext(): TasksContextValue {
  return useContext(Ctx)
}
