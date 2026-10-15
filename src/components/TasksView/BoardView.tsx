import { useMemo } from 'react'
import {
  computeTaskSummary,
  filterTasksForView,
  snoozeDate,
  type ChecklistProgress,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { BoardColumns, type BoardColumn } from './BoardColumns'
import { TasksHeader, type NewTaskDraft } from './TasksHeader'
import { TaskLine } from './TaskLine'
import { TaskBatchBar } from './TaskBatchBar'
import { useTaskKeyboard, type TaskChanges } from './useTaskKeyboard'
import { useTasksEnv } from './TasksEnv'
import type { TasksMainView } from './views'
// Mesmo layout de quadro do Week board.
import styles from './WeekBoard.module.css'

// Casca comum das visões em colunas (Kanban, Projects, Groups, Today): header,
// filtros (projeto + busca), colunas arrastáveis, teclado e barra de lote. Cada
// visão só diz quais colunas montar e o que um drop significa.
export interface BoardViewProps {
  ariaLabel: string
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  mainView: TasksMainView
  onMainViewChange: (view: TasksMainView) => void
  filter: string | null
  onFilterChange: (notebookId: string | null) => void
  // Chip da faixa de resumo: o App volta para a lista com o filtro aplicado.
  onSummaryFilterChange: (key: TaskSummaryKey | null) => void
  onCreateTask: (draft: NewTaskDraft) => Promise<void>
  onOpenTask: (task: Task) => void
  onToggleTask: (id: string, done: boolean) => void
  onUpdateTasks: (changes: TaskChanges) => void
  onDeleteTasks: (ids: string[]) => void
  onConvertPipeTitles: (tasks: Task[]) => void
  checklist: Map<string, ChecklistProgress>
  // Monta as colunas a partir das tasks já filtradas (projeto + busca).
  columnsFor: (projectTasks: Task[]) => BoardColumn[]
  onDrop: (taskId: string, columnKey: string, tasksById: Map<string, Task>) => void
  // Mostra o chip do projeto nos cards (falso onde a coluna já é o projeto).
  showProject?: boolean
  // Esconde o status "doing" no card (falso onde a coluna é o status).
  showDoing?: boolean
}

export function BoardView({
  ariaLabel,
  tasks,
  notebooks,
  todayKey,
  mainView,
  onMainViewChange,
  filter,
  onFilterChange,
  onSummaryFilterChange,
  onCreateTask,
  onOpenTask,
  onToggleTask,
  onUpdateTasks,
  onDeleteTasks,
  onConvertPipeTitles,
  checklist,
  columnsFor,
  onDrop,
  showProject = true,
  showDoing = true,
}: BoardViewProps) {
  const { search } = useTasksEnv()
  const notebookById = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb])), [notebooks])
  const projectTasks = useMemo(
    () => filterTasksForView(tasks, filter, search),
    [tasks, filter, search]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])
  const columns = useMemo(() => columnsFor(projectTasks), [columnsFor, projectTasks])

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const orderedIds = useMemo(() => columns.flatMap((c) => c.tasks.map((t) => t.id)), [columns])
  const kb = useTaskKeyboard({
    orderedIds,
    tasksById,
    todayKey,
    onOpen: onOpenTask,
    onUpdateTasks,
    onDeleteTasks,
  })

  return (
    <section className={styles.board} {...kb.containerProps} aria-label={ariaLabel}>
      <div className={styles.top}>
        <TasksHeader
          tasks={tasks}
          notebooks={notebooks}
          todayKey={todayKey}
          mainView={mainView}
          onMainViewChange={onMainViewChange}
          filter={filter}
          onFilterChange={onFilterChange}
          summary={summary}
          summaryFilter={null}
          onSummaryFilterChange={onSummaryFilterChange}
          onCreateTask={onCreateTask}
          onConvertPipeTitles={onConvertPipeTitles}
        />
      </div>
      <BoardColumns
        columns={columns}
        onDrop={(id, key) => onDrop(id, key, tasksById)}
        onClearColumn={(c) => void kb.requestDelete(c.tasks.map((t) => t.id), 'Clear done')}
        renderCard={(t) => {
          const nb = notebookById.get(t.notebookId)
          return (
            <TaskLine
              task={t}
              todayKey={todayKey}
              projectName={showProject && filter === null ? (nb?.name || 'unnamed') : undefined}
              projectColor={nb?.color ?? null}
              showDoing={showDoing}
              checklist={checklist.get(t.id)}
              lines={3}
              cursor={t.id === kb.cursorId}
              inSelection={kb.selectedIds.has(t.id)}
              onSelect={(e) => {
                if (kb.handleClick(e, t.id)) onOpenTask(t)
              }}
              onToggle={(done) => onToggleTask(t.id, done)}
              onDelete={() => void kb.requestDelete([t.id], 'Delete task')}
              onSnooze={(kind) =>
                onUpdateTasks([{ id: t.id, patch: { scheduledDate: snoozeDate(t, kind, todayKey) } }])
              }
              planned={t.plannedDay === todayKey}
              onTogglePlan={() =>
                onUpdateTasks([
                  { id: t.id, patch: { plannedDay: t.plannedDay === todayKey ? null : todayKey } },
                ])
              }
            />
          )
        }}
      />
      <TaskBatchBar kb={kb} todayKey={todayKey} />
    </section>
  )
}
