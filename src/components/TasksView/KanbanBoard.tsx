import { useMemo } from 'react'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  compareTasks,
  computeTaskSummary,
  endOfWeekKey,
  startOfWeekKey,
  type ChecklistProgress,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task, TaskStatus } from '../../types'
import { TasksHeader, type NewTaskDraft, type TasksMainView } from './TasksHeader'
import { TaskLine } from './TaskLine'
import { TaskBatchBar } from './TaskBatchBar'
import { useCardDrag } from './useCardDrag'
import { useTaskKeyboard, type TaskChanges } from './useTaskKeyboard'
// Mesmo layout de colunas/cards do Week board.
import styles from './WeekBoard.module.css'

// Visão Kanban na área principal: To do | Doing | Done (concluídas nesta
// semana, esmaecidas). Arrastar um card entre colunas muda o status.
interface KanbanBoardProps {
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
}

const COLUMNS: Array<{ status: TaskStatus; label: string }> = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done this week' },
]

export function KanbanBoard({
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
}: KanbanBoardProps) {
  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )
  const projectTasks = useMemo(
    () => (filter === null ? tasks : tasks.filter((t) => t.notebookId === filter)),
    [tasks, filter]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])

  const columns = useMemo(() => {
    const weekStart = startOfWeekKey(todayKey)
    const weekEnd = endOfWeekKey(todayKey)
    return COLUMNS.map(({ status, label }) => ({
      status,
      label,
      tasks:
        status === 'done'
          ? projectTasks
              .filter((t) => {
                if (t.status !== 'done' || t.completedAt === null) return false
                const day = dateKeyFromMs(t.completedAt)
                return day >= weekStart && day <= weekEnd
              })
              .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
          : projectTasks.filter((t) => t.status === status).sort(compareTasks),
    }))
  }, [projectTasks, todayKey])

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

  const { draggingId, overKey, onCardMouseDown } = useCardDrag((id, dropKey) => {
    const task = tasksById.get(id)
    const status = dropKey as TaskStatus
    if (!task || task.status === status) return
    onUpdateTasks([{ id, patch: { status } }])
  })

  return (
    <section className={styles.board} {...kb.containerProps} aria-label="kanban board">
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
      <div
        className={styles.columns}
        style={{ gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))' }}
      >
        {columns.map((c) => (
          <div
            key={c.status}
            data-drop-key={c.status}
            className={`${styles.column} ${draggingId && overKey === c.status ? styles.columnOver : ''}`}
          >
            <div className={styles.columnHeader}>
              <span className={styles.columnLabel}>{c.label}</span>
              <span className={styles.columnCount}>{c.tasks.length}</span>
              {c.status === 'done' && c.tasks.length > 0 && (
                <button
                  type="button"
                  className={styles.clearDone}
                  onClick={() => void kb.requestDelete(c.tasks.map((t) => t.id), 'Clear done')}
                >
                  Clear done
                </button>
              )}
            </div>
            <div className={styles.cards}>
              {c.tasks.map((t) => (
                <div
                  key={t.id}
                  className={`${styles.card} ${t.id === draggingId ? styles.cardDragging : ''} ${
                    c.status === 'done' ? styles.cardFaded : ''
                  }`}
                  onMouseDown={(e) => onCardMouseDown(e, t.id)}
                >
                  <TaskLine
                    task={t}
                    todayKey={todayKey}
                    projectName={filter === null ? notebookNameById.get(t.notebookId) : undefined}
                    showDoing={false}
                    checklist={checklist.get(t.id)}
                    lines={3}
                    cursor={t.id === kb.cursorId}
                    inSelection={kb.selectedIds.has(t.id)}
                    onSelect={(e) => {
                      if (kb.handleClick(e, t.id)) onOpenTask(t)
                    }}
                    onToggle={(done) => onToggleTask(t.id, done)}
                    onDelete={() => void kb.requestDelete([t.id], 'Delete task')}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <TaskBatchBar kb={kb} todayKey={todayKey} />
    </section>
  )
}
