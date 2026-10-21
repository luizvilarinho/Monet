import { createContext, useContext } from 'react'
import type { MetadataDef, TaskStatusDef, TaskView, TaskViewConfig } from '../../types'
import { BUILTIN_STATUS_DEFS, type TodosInfo } from '../../lib/tasks'

// Estado compartilhado das visões de Tasks (registro de status, visões
// salvas, busca, ações de projeto, notas TODOS), entregue pelo App para evitar
// repassar as mesmas props por TasksView/Week/Kanban/Projects/TODOS/Today/Review.
export interface TasksEnv {
  statuses: TaskStatusDef[]
  onManageStatuses: () => void
  // Definições de metadados personalizados (exibidos nos cards).
  metadataDefs: MetadataDef[]
  // Visões salvas e a configuração atual da TasksView (para "Save current view").
  savedViews: TaskView[]
  currentViewConfig: TaskViewConfig
  onApplyView: (view: TaskView) => void
  onSaveView: (name: string) => void
  onRenameView: (id: string, name: string) => void
  onDeleteView: (id: string) => void
  // Id da visão salva aplicada (null = visão built-in).
  activeSavedViewId: string | null
  // Busca de texto (título/TODOS), válida para todas as visões.
  search: string
  onSearchChange: (text: string) => void
  // Mover a task (e a nota-corpo) para o projeto `notebookId`.
  onMoveTaskToProject: (taskId: string, notebookId: string) => void
  onSetProjectColor: (notebookId: string, color: string | null) => void
  // Notas TODOS por id (pai ausente daqui = sem TODOS).
  todosById: Map<string, TodosInfo>
  onOpenNote: (noteId: string) => void
  // Cria uma nota TODOS no caderno e devolve o id.
  onCreateTodos: (notebookId: string, title: string) => Promise<string>
}

const noop = () => {}

export const DEFAULT_TASKS_ENV: TasksEnv = {
  statuses: BUILTIN_STATUS_DEFS,
  onManageStatuses: noop,
  metadataDefs: [],
  savedViews: [],
  currentViewConfig: { base: 'list', project: null, summary: null, text: '', groupBy: null },
  onApplyView: noop,
  onSaveView: noop,
  onRenameView: noop,
  onDeleteView: noop,
  activeSavedViewId: null,
  search: '',
  onSearchChange: noop,
  onMoveTaskToProject: noop,
  onSetProjectColor: noop,
  todosById: new Map(),
  onOpenNote: noop,
  onCreateTodos: () => Promise.reject(new Error('TODOS cannot be created here.')),
}

const TasksEnvContext = createContext<TasksEnv>(DEFAULT_TASKS_ENV)

export const TasksEnvProvider = TasksEnvContext.Provider

export function useTasksEnv(): TasksEnv {
  return useContext(TasksEnvContext)
}
