import { createContext, useContext } from 'react'
import type { ChecklistProgress } from '../../lib/tasks'
import type { Notebook, Task } from '../../types'

export interface TasksContextValue {
  tasksById: Map<string, Task>
  todayKey: string
  onOpenTask?: (id: string) => void
  // Bloco `/tasks`: resolução de `#Projeto` e checkbox das linhas.
  notebooks?: Notebook[]
  onToggleTask?: (id: string, done: boolean) => void
  // Progresso do checklist da nota-corpo, por task.
  checklist?: Map<string, ChecklistProgress>
}

const EMPTY: TasksContextValue = { tasksById: new Map(), todayKey: '' }

const Ctx = createContext<TasksContextValue>(EMPTY)

export const TasksProvider = Ctx.Provider

export function useTasksContext(): TasksContextValue {
  return useContext(Ctx)
}
