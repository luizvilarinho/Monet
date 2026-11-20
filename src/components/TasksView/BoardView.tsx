import { useMemo } from 'react'
import {
  computeTaskSummary,
  filterTasksForView,
  summaryMatches,
  type ChecklistProgress,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { BoardColumns, type BoardColumn } from './BoardColumns'
import { TasksHeader, type NewTaskDraft } from './TasksHeader'
import { TaskCard } from './TaskCard'
import { TaskBatchBar } from './TaskBatchBar'
import { useTaskKeyboard, type TaskChanges } from './useTaskKeyboard'
import { useTasksEnv } from './TasksEnv'
import type { TasksMainView } from './views'
// Mesmo layout de quadro do Week board.
import styles from './WeekBoard.module.css'

// Casca comum das visões em colunas (Kanban, Projects, TODOS, Today): header,
// filtros (projeto + busca + chip de resumo), colunas arrastáveis, teclado,
// barra de lote e Undo. Cada visão só diz quais colunas montar e o que um drop
// significa.
export interface BoardViewProps {
  ariaLabel: string
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  mainView: TasksMainView
  onMainViewChange: (view: TasksMainView) => void
  filter: string | null
  onFilterChange: (notebookId: string | null) => void
  // Chip da faixa de resumo: filtra os cards do board.
  summaryFilter: TaskSummaryKey | null
  onSummaryFilterChange: (key: TaskSummaryKey | null) => void
  onCreateTask: (draft: NewTaskDraft) => Promise<Task | undefined>
  // My Day: as tasks criadas no board já nascem planejadas para hoje.
  newTaskPlannedDay?: string
  onOpenTask: (task: Task) => void
  onToggleTask: (id: string, done: boolean) => void
  onUpdateTasks: (changes: TaskChanges) => void
  onDeleteTasks: (ids: string[]) => void
  onConvertPipeTitles: (tasks: Task[]) => void
  checklist: Map<string, ChecklistProgress>
  // Monta as colunas a partir das tasks já filtradas (projeto + busca).
  columnsFor: (projectTasks: Task[]) => BoardColumn<Task>[]
  // false = o drop não mudou nada (sem Undo).
  onDrop: (taskId: string, columnKey: string, tasksById: Map<string, Task>) => boolean | void
  // Mostra o chip do projeto nos cards (falso onde a coluna já é o projeto).
  showProject?: boolean
  // Kanban: a coluna já é o status; o card mostra só o quadrado de cor + tempo.
  compactStatus?: boolean
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
  summaryFilter,
  onSummaryFilterChange,
  onCreateTask,
  newTaskPlannedDay,
  onOpenTask,
  onToggleTask,
  onUpdateTasks,
  onDeleteTasks,
  onConvertPipeTitles,
  checklist,
  columnsFor,
  onDrop,
  showProject = true,
  compactStatus = false,
}: BoardViewProps) {
  const { search, todosById } = useTasksEnv()
  const notebookById = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb])), [notebooks])
  const projectTasks = useMemo(
    () => filterTasksForView(tasks, filter, search, todosById),
    [tasks, filter, search, todosById]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])
  const shownTasks = useMemo(
    () => (summaryFilter ? projectTasks.filter((t) => summaryMatches(summaryFilter, t, todayKey)) : projectTasks),
    [projectTasks, summaryFilter, todayKey]
  )
  const columns = useMemo(() => columnsFor(shownTasks), [columnsFor, shownTasks])

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const orderedIds = useMemo(() => columns.flatMap((c) => c.items.map((t) => t.id)), [columns])
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
          summaryFilter={summaryFilter}
          onSummaryFilterChange={onSummaryFilterChange}
          onCreateTask={onCreateTask}
          plannedDay={newTaskPlannedDay}
          onOpenTask={onOpenTask}
          onConvertPipeTitles={onConvertPipeTitles}
        />
      </div>
      <BoardColumns
        columns={columns}
        onDrop={(id, key) => kb.actions.track('moved', [id], () => onDrop(id, key, tasksById))}
        renderCard={(t) => {
          const nb = notebookById.get(t.notebookId)
          return (
            <TaskCard
              task={t}
              todayKey={todayKey}
              projectName={showProject && filter === null ? (nb?.name || 'unnamed') : undefined}
              projectColor={nb?.color ?? null}
              compactStatus={compactStatus}
              checklist={checklist.get(t.id)}
              cursor={t.id === kb.cursorId}
              inSelection={kb.selectedIds.has(t.id)}
              onSelect={(e) => {
                if (kb.handleClick(e, t.id)) onOpenTask(t)
              }}
              onToggle={(done) => kb.toggleTask(t.id, done, () => onToggleTask(t.id, done))}
              onDelete={() => void kb.requestDelete([t.id], 'Delete task')}
              onSnooze={(kind) => kb.snoozeTask(t, kind)}
              planned={t.plannedDay === todayKey}
              onTogglePlan={() => kb.togglePlanTask(t)}
            />
          )
        }}
      />
      <TaskBatchBar kb={kb} todayKey={todayKey} />
    </section>
  )
}
