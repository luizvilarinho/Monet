import { CaretDown, CaretRight, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import {
  computeTaskSummary,
  filterBySummary,
  filterTasksForView,
  groupTasksBy,
  type ChecklistProgress,
  type TaskGroupBy,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { SUMMARY_LABEL, TasksHeader, type NewTaskDraft } from './TasksHeader'
import { useTasksEnv } from './TasksEnv'
import type { TasksMainView } from './views'
import { TaskCard } from './TaskCard'
import { TaskBatchBar } from './TaskBatchBar'
import { useTaskKeyboard, type TaskChanges } from './useTaskKeyboard'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import styles from './TasksView.module.css'

// Lista de tasks no slot da Sidebar. Selecionar uma task abre a nota-corpo
// dela no editor principal (a seleção é a task cuja nota está aberta).
interface TasksViewProps {
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  mainView: TasksMainView
  onMainViewChange: (view: TasksMainView) => void
  width: number
  // Cadernos ocultos: a coluna aceita largura maior (largura própria).
  wide?: boolean
  onWidthChange: (w: number) => void
  // Caderno-projeto filtrado (null = todos).
  filter: string | null
  onFilterChange: (notebookId: string | null) => void
  // Filtro da faixa de resumo (null = lista agrupada por data).
  summaryFilter: TaskSummaryKey | null
  onSummaryFilterChange: (key: TaskSummaryKey | null) => void
  groupBy: TaskGroupBy
  onGroupByChange: (mode: TaskGroupBy) => void
  onConvertPipeTitles: (tasks: Task[]) => void
  selectedTaskId: string | null
  onSelectTask: (task: Task) => void
  // Cria a task (com a nota-corpo) e a abre no editor.
  onCreateTask: (draft: NewTaskDraft) => Promise<Task | undefined>
  onToggleTask: (id: string, done: boolean) => void
  onUpdateTasks: (changes: TaskChanges) => void
  onDeleteTasks: (ids: string[]) => void
  // Progresso do checklist da nota-corpo, por task.
  checklist: Map<string, ChecklistProgress>
}

// Acima disso o grupo "In progress" mostra um aviso discreto.
const IN_PROGRESS_SOFT_LIMIT = 3

export function TasksView({
  tasks,
  notebooks,
  todayKey,
  mainView,
  onMainViewChange,
  width,
  wide = false,
  onWidthChange,
  filter,
  onFilterChange,
  summaryFilter,
  onSummaryFilterChange,
  groupBy,
  onGroupByChange,
  onConvertPipeTitles,
  selectedTaskId,
  onSelectTask,
  onCreateTask,
  onToggleTask,
  onUpdateTasks,
  onDeleteTasks,
  checklist,
}: TasksViewProps) {
  // Seções recolhíveis (Done/Dropped) abertas pelo usuário.
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set())
  // Done: as concluídas antes da janela de 14 dias ("Show older").
  const [showOlder, setShowOlder] = useState(false)
  const onResizeMouseDown = useSidebarResize(width, onWidthChange, wide)

  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )

  const { statuses, search, onSearchChange, todosById } = useTasksEnv()
  const notebookColorById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.color ?? null])),
    [notebooks]
  )

  const projectTasks = useMemo(
    () => filterTasksForView(tasks, filter, search, todosById),
    [tasks, filter, search, todosById]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])
  const sections = useMemo(
    () => groupTasksBy(groupBy, projectTasks, todayKey, notebooks, statuses, todosById),
    [groupBy, projectTasks, todayKey, notebooks, statuses, todosById]
  )
  const filtered = useMemo(
    () => (summaryFilter ? filterBySummary(projectTasks, summaryFilter, todayKey) : []),
    [projectTasks, summaryFilter, todayKey]
  )
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const orderedIds = useMemo(
    () =>
      (summaryFilter
        ? filtered
        : sections.flatMap((s) =>
            s.collapsible && !openSections.has(s.key)
              ? []
              : [...s.tasks, ...(showOlder ? s.older ?? [] : [])]
          )
      ).map((t) => t.id),
    [summaryFilter, filtered, sections, openSections, showOlder]
  )
  const kb = useTaskKeyboard({
    orderedIds,
    tasksById,
    todayKey,
    onOpen: onSelectTask,
    onUpdateTasks,
    onDeleteTasks,
  })

  function renderTask(t: Task) {
    return (
      <TaskCard
        key={t.id}
        task={t}
        todayKey={todayKey}
        projectName={filter === null && groupBy !== 'project' && groupBy !== 'todos' ? notebookNameById.get(t.notebookId) : undefined}
        projectColor={notebookColorById.get(t.notebookId) ?? null}
        showTodos={summaryFilter !== null || (groupBy !== 'project' && groupBy !== 'todos')}
        checklist={checklist.get(t.id)}
        maxMetadata={2}
        list
        selected={t.id === selectedTaskId}
        cursor={t.id === kb.cursorId}
        inSelection={kb.selectedIds.has(t.id)}
        onSelect={(e) => {
          if (kb.handleClick(e, t.id)) onSelectTask(t)
        }}
        onToggle={(done) => kb.toggleTask(t.id, done, () => onToggleTask(t.id, done))}
        onDelete={() => void kb.requestDelete([t.id], 'Delete task')}
        onSnooze={(kind) => kb.snoozeTask(t, kind)}
        planned={t.plannedDay === todayKey}
        onTogglePlan={() => kb.togglePlanTask(t)}
      />
    )
  }

  // Lista vazia: diz o que fazer, ou o que o filtro escondeu.
  function emptyState() {
    const projectName = filter !== null ? notebookNameById.get(filter) ?? 'this project' : null
    if (search.trim()) {
      return (
        <div className={styles.emptyState}>
          <span>
            No tasks match “{search.trim()}”{projectName ? ` in ${projectName}` : ''}.
          </span>
          <button type="button" className={styles.headerAction} onClick={() => onSearchChange('')}>
            Clear search
          </button>
        </div>
      )
    }
    if (projectName) {
      return <span className={styles.empty}>No tasks in {projectName} yet. Type one above to add it here.</span>
    }
    return (
      <span className={styles.empty}>No tasks yet. Type one above, e.g. “Send report fri #Work”.</span>
    )
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <aside className={styles.tasksView} style={{ width }}>
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
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
        groupBy={groupBy}
        onGroupByChange={onGroupByChange}
        onConvertPipeTitles={onConvertPipeTitles}
      />
      <div
        className={styles.groups}
        {...kb.containerProps}
        aria-label="tasks"
      >
        {summaryFilter ? (
          <section className={styles.group}>
            <button type="button" className={styles.groupHeader} disabled>
              {SUMMARY_LABEL[summaryFilter]}
              <span className={styles.count}>{filtered.length}</span>
            </button>
            {filtered.length === 0 ? (
              <span className={styles.empty}>
                No tasks in {SUMMARY_LABEL[summaryFilter]}
                {search.trim() ? ` matching “${search.trim()}”` : ''}.
              </span>
            ) : (
              filtered.map(renderTask)
            )}
          </section>
        ) : sections.length === 0 ? (
          emptyState()
        ) : (
          sections.map((section) => {
            const { key, label, tasks: list } = section
            const older = section.older ?? []
            const collapsed = section.collapsible && !openSections.has(key)
            const tone =
              section.tone === 'overdue' ? styles.groupOverdue : section.tone === 'late' ? styles.groupLate : ''
            return (
              <section key={key} className={styles.group}>
                <div className={styles.groupHeaderRow}>
                  <button
                    type="button"
                    className={`${styles.groupHeader} ${tone}`}
                    onClick={section.collapsible ? () => toggleSection(key) : undefined}
                    disabled={!section.collapsible}
                    title={
                      key === 'overdue'
                        ? 'Deadline passed, no new do date'
                        : key === 'slipped'
                          ? 'Do date passed, no deadline missed'
                          : key === 'done'
                            ? 'Done in the last 14 days'
                            : undefined
                    }
                  >
                    {section.collapsible &&
                      (collapsed ? (
                        <CaretRight size={10} weight="bold" aria-hidden />
                      ) : (
                        <CaretDown size={10} weight="bold" aria-hidden />
                      ))}
                    {label}
                    <span className={styles.count}>{list.length + older.length}</span>
                    {key === 'inProgress' && list.length > IN_PROGRESS_SOFT_LIMIT && (
                      <span
                        className={styles.groupWarning}
                        title="More than 3 in progress — consider finishing before starting more"
                      >
                        <Warning size={11} aria-hidden />
                      </span>
                    )}
                  </button>
                  {key === 'slipped' && (
                    <button
                      type="button"
                      className={styles.headerAction}
                      onClick={() => kb.schedule(todayKey, list.map((t) => t.id))}
                    >
                      Move all to today
                    </button>
                  )}
                </div>
                {!collapsed &&
                  (section.subgroups
                    ? section.subgroups.map((g, i) => (
                        <div key={`${i}-${g.label ?? ''}`} className={styles.subgroup}>
                          {g.label !== null && (
                            <span
                              className={`${styles.subgroupLabel} ${groupBy === 'project' ? styles.subgroupTodos : ''}`}
                              title={g.label}
                            >
                              {g.label}
                            </span>
                          )}
                          {g.tasks.map(renderTask)}
                        </div>
                      ))
                    : list.map(renderTask))}
                {!collapsed && older.length > 0 && (
                  <>
                    {showOlder && older.map(renderTask)}
                    <button
                      type="button"
                      className={styles.showOlder}
                      onClick={() => setShowOlder((v) => !v)}
                    >
                      {showOlder ? 'Hide older' : `Show older (${older.length})`}
                    </button>
                  </>
                )}
              </section>
            )
          })
        )}
        <TaskBatchBar kb={kb} todayKey={todayKey} />
      </div>
    </aside>
  )
}
