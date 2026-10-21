import { createContext, useContext } from 'react'
import type { ChecklistProgress } from '../../lib/tasks'
import type { MetadataDef, Notebook, Task, TaskStatus, TaskStatusDef } from '../../types'

export interface TasksContextValue {
  tasksById: Map<string, Task>
  todayKey: string
  onOpenTask?: (id: string) => void
  // Bloco `/tasks`: resolução de `#Projeto` e checkbox das linhas.
  notebooks?: Notebook[]
  onToggleTask?: (id: string, done: boolean) => void
  // Progresso do checklist da nota-corpo, por task.
  checklist?: Map<string, ChecklistProgress>
  // Card da task: cor/nome do status e menu de status (troca direta).
  statuses?: TaskStatusDef[]
  onSetStatus?: (id: string, status: TaskStatus) => void
  // Metadados custom da task (pills `Nome: valor` do card).
  metadataDefs?: MetadataDef[]
  // Título da nota TODOS (pill do card, texto do bloco `/tasks`).
  todosTitle?: (noteId: string) => string | undefined
  // Nota aberta no editor (o card só cita a TODOS quando é outra nota).
  currentNoteId?: string | null
}

const EMPTY: TasksContextValue = { tasksById: new Map(), todayKey: '' }

const Ctx = createContext<TasksContextValue>(EMPTY)

export const TasksProvider = Ctx.Provider

export function useTasksContext(): TasksContextValue {
  return useContext(Ctx)
}
