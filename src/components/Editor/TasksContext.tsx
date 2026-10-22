import { createContext, useContext } from 'react'
import type { ChecklistProgress, ProjectChoice, TaskPatch, TodosInfo } from '../../lib/tasks'
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
  // Card da task na nota TODOS (R5): edição dos campos no popover, com os
  // mesmos controles da barra de propriedades. Opcionais: a keep não os passa.
  onUpdateTask?: (id: string, patch: TaskPatch) => void
  onMoveTask?: (id: string, project: ProjectChoice) => void
  todosOptions?: TodosInfo[]
  onOpenTodos?: (noteId: string) => void
  onCreateTodos?: (notebookId: string, title: string) => Promise<string>
  onManageMetadata?: (focusId?: string) => void
  // Shift+click no ↗ do card: abre a task no modal sem trocar a nota.
  onOpenTaskModal?: (id: string) => void
  currentNoteIsTodos?: boolean
}

const EMPTY: TasksContextValue = { tasksById: new Map(), todayKey: '' }

const Ctx = createContext<TasksContextValue>(EMPTY)

export const TasksProvider = Ctx.Provider

export function useTasksContext(): TasksContextValue {
  return useContext(Ctx)
}
