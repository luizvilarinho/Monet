import { Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import {
  computeTaskSummary,
  filterBySummary,
  filterTasksForView,
  groupTasksBy,
  isOpen,
  snoozeDate,
  type ChecklistProgress,
  type TaskGroupBy,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { SUMMARY_LABEL, TasksHeader, type NewTaskDraft } from './TasksHeader'
import { useTasksEnv } from './TasksEnv'
import type { TasksMainView } from './views'
import { TaskLine } from './TaskLine'
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
  onCreateTask: (draft: NewTaskDraft) => Promise<void>
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
  const onResizeMouseDown = useSidebarResize(width, onWidthChange, wide)

  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )

  const { statuses, search } = useTasksEnv()
  const notebookColorById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.color ?? null])),
    [notebooks]
  )

  const projectTasks = useMemo(
    () => filterTasksForView(tasks, filter, search),
    [tasks, filter, search]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])
  const sections = useMemo(
    () => groupTasksBy(groupBy, projectTasks, todayKey, notebooks, statuses),
    [groupBy, projectTasks, todayKey, notebooks, statuses]
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
        : sections.flatMap((s) => (s.collapsible && !openSections.has(s.key) ? [] : s.tasks))
      ).map((t) => t.id),
    [summaryFilter, filtered, sections, openSections]
  )
  const kb = useTaskKeyboard({
    orderedIds,
    tasksById,
    todayKey,
    onOpen: onSelectTask,
    onUpdateTasks,
    onDeleteTasks,
  })

  function renderTask(t: Task, showDoing: boolean) {
    return (
      <TaskLine
        key={t.id}
        task={t}
        todayKey={todayKey}
        projectName={filter === null && groupBy !== 'project' && groupBy !== 'group' ? notebookNameById.get(t.notebookId) : undefined}
        showDoing={showDoing}
        projectColor={notebookColorById.get(t.notebookId) ?? null}
        showGroup={summaryFilter !== null || (groupBy !== 'project' && groupBy !== 'group')}
        checklist={checklist.get(t.id)}
        selected={t.id === selectedTaskId}
        cursor={t.id === kb.cursorId}
        inSelection={kb.selectedIds.has(t.id)}
        onSelect={(e) => {
          if (kb.handleClick(e, t.id)) onSelectTask(t)
        }}
        onToggle={(done) => onToggleTask(t.id, done)}
        onDelete={() => void kb.requestDelete([t.id], 'Delete task')}
        onSnooze={(kind) =>
          onUpdateTasks([{ id: t.id, patch: { scheduledDate: snoozeDate(t, kind, todayKey) } }])
        }
        planned={t.plannedDay === todayKey}
        onTogglePlan={() =>
          onUpdateTasks([{ id: t.id, patch: { plannedDay: t.plannedDay === todayKey ? null : todayKey } }])
        }
      />
    )
  }

  // "Clear done": o escopo inteiro do grupo Done (filtro de projeto atual,
  // sem o corte de exibição). No Group by status são só as concluídas; nos
  // demais o grupo também inclui as dropped.
  function clearDone() {
    const ids = projectTasks
      .filter((t) => (groupBy === 'status' ? t.status === 'done' : !isOpen(t)))
      .map((t) => t.id)
    void kb.requestDelete(ids, 'Clear done')
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
              <span className={styles.empty}>no tasks</span>
            ) : (
              filtered.map((t) => renderTask(t, summaryFilter !== 'doing'))
            )}
          </section>
        ) : (
          sections.map((section) => {
            const { key, label, tasks: list } = section
            const collapsed = section.collapsible && !openSections.has(key)
            return (
              <section key={key} className={styles.group}>
                <div className={styles.groupHeaderRow}>
                  <button
                    type="button"
                    className={`${styles.groupHeader} ${section.tone === 'overdue' ? styles.groupOverdue : ''}`}
                    onClick={section.collapsible ? () => toggleSection(key) : undefined}
                    disabled={!section.collapsible}
                  >
                    {section.collapsible && <span className={styles.caret}>{collapsed ? '▸' : '▾'}</span>}
                    {label}
                    <span className={styles.count}>{list.length}</span>
                    {key === 'inProgress' && list.length > IN_PROGRESS_SOFT_LIMIT && (
                      <span
                        className={styles.groupWarning}
                        title="More than 3 in progress — consider finishing before starting more"
                      >
                        <Warning size={11} aria-hidden />
                      </span>
                    )}
                  </button>
                  {key === 'done' && (
                    <button type="button" className={styles.clearDone} onClick={clearDone}>
                      Clear done
                    </button>
                  )}
                </div>
                {!collapsed &&
                  (section.subgroups
                    ? section.subgroups.map((g) => (
                        <div key={g.label ?? ''} className={styles.subgroup}>
                          {g.label !== null && (
                            <span className={styles.subgroupLabel} title={g.label}>
                              {g.label}
                            </span>
                          )}
                          {g.tasks.map((t) => renderTask(t, true))}
                        </div>
                      ))
                    : list.map((t) => renderTask(t, key !== 'inProgress' && groupBy !== 'status')))}
              </section>
            )
          })
        )}
        <TaskBatchBar kb={kb} todayKey={todayKey} />
      </div>
    </aside>
  )
}
