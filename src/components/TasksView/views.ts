// Visões da área de Tasks, declarativas: nova visão = uma entrada aqui + o
// componente correspondente no App. Visões salvas (task_views) entram no
// mesmo dropdown, num grupo "Saved".
export interface TaskViewDef {
  id: string
  label: string
  title?: string
}

export const TASK_VIEWS: TaskViewDef[] = [
  { id: 'list', label: 'List' },
  { id: 'week', label: 'Week' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'projects', label: 'Projects', title: 'Columns by project' },
  { id: 'groups', label: 'Groups', title: 'Columns by group' },
  { id: 'plan', label: 'My Day', title: 'Plan today' },
  { id: 'review', label: 'Review', title: 'Weekly review' },
]

export type TasksMainView = string

// A visão de revisão nunca é lembrada entre sessões.
export const EPHEMERAL_VIEW = 'review'

// Valor inválido (ou visão removida) cai em List.
export function resolveMainView(id: string | null | undefined): TasksMainView {
  return TASK_VIEWS.some((v) => v.id === id) ? (id as string) : 'list'
}
