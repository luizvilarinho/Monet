import { useMemo, useState } from 'react'
import { DotsThree, GearSix, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import {
  INBOX_NOTEBOOK_ID,
  splitPipeTitle,
  type ProjectChoice,
  type TaskGroupBy,
  type TaskSummary,
  type TaskSummaryKey,
} from '../../lib/tasks'
import { parseQuickAdd } from '../../lib/taskQuickAdd'
import type { Notebook, Task, TaskStatus } from '../../types'
import { ProjectPicker } from './ProjectPicker'
import { useTasksEnv } from './TasksEnv'
import { ViewMenu } from './ViewMenu'
import type { TasksMainView } from './views'
import styles from './TasksHeader.module.css'

// Task a criar pelo "New task…" (campos vindos do quick add).
export interface NewTaskDraft {
  title: string
  scheduledDate: string | null
  dueDate: string | null
  status: TaskStatus | null
  important: boolean
  project: ProjectChoice
}

// Cabeçalho das Tasks: seletor de visão, filtro de projeto, faixa de resumo
// (contadores clicáveis que filtram a lista + barra da semana) e o
// "New task…" com quick add (tokens reconhecidos viram chips).
interface TasksHeaderProps {
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  mainView: TasksMainView
  onMainViewChange: (view: TasksMainView) => void
  // Caderno-projeto filtrado (null = todos).
  filter: string | null
  onFilterChange: (notebookId: string | null) => void
  summary: TaskSummary
  summaryFilter: TaskSummaryKey | null
  onSummaryFilterChange: (key: TaskSummaryKey | null) => void
  onCreateTask: (draft: NewTaskDraft) => Promise<void>
  // Group by da lista (só na visão List).
  groupBy?: TaskGroupBy
  onGroupByChange?: (mode: TaskGroupBy) => void
  // Converte "group | título" das tasks dadas (após confirmação).
  onConvertPipeTitles: (tasks: Task[]) => void
}

export const SUMMARY_LABEL: Record<TaskSummaryKey, string> = {
  overdue: 'Overdue',
  today: 'Today',
  week: 'Week',
  doing: 'Doing',
  doneWeek: 'Done this week',
}

const ALL_PROJECTS = '__all__'

const GROUP_BY_LABEL: Record<TaskGroupBy, string> = {
  date: 'Date',
  project: 'Project',
  status: 'Status',
  group: 'Group',
}

export function TasksHeader({
  tasks,
  notebooks,
  todayKey,
  mainView,
  onMainViewChange,
  filter,
  onFilterChange,
  summary,
  summaryFilter,
  onSummaryFilterChange,
  onCreateTask,
  groupBy,
  onGroupByChange,
  onConvertPipeTitles,
}: TasksHeaderProps) {
  const { statuses, onManageStatuses, search, onSearchChange } = useTasksEnv()
  const [newTitle, setNewTitle] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const { confirm, modal } = useConfirm()
  // null = projeto padrão (o filtrado, ou o Inbox).
  const [newProject, setNewProject] = useState<ProjectChoice | null>(null)

  // Filtro: cadernos que têm tasks (mais o filtrado, para o select não ficar
  // sem opção quando o projeto ainda não tem tasks).
  const filterNotebooks = useMemo(
    () => notebooks.filter((nb) => nb.id === filter || tasks.some((t) => t.notebookId === nb.id)),
    [notebooks, tasks, filter]
  )

  const newProjectValue = newProject ?? { notebookId: filter ?? INBOX_NOTEBOOK_ID }

  // Tasks do filtro atual sem group cujo título tem "group | título".
  const convertible = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (filter === null || t.notebookId === filter) &&
          t.group === null &&
          splitPipeTitle(t.title) !== null
      ),
    [tasks, filter]
  )

  async function handleConvert() {
    setMenuOpen(false)
    const sample = convertible[0]
    const split = sample ? splitPipeTitle(sample.title) : null
    if (!split) return
    const n = convertible.length
    const ok = await confirm(
      `Convert ${n} task${n === 1 ? '' : 's'}? '${sample.title}' → group '${split.group}', title '${split.title}'. Only the first '|' is used.`,
      { title: "Convert 'group | title'", confirmLabel: 'Convert' }
    )
    if (ok) onConvertPipeTitles(convertible)
  }

  // Chips descartados (ficam no título) e `#Nome` novos confirmados, pelo
  // texto do token em minúsculas.
  const [ignored, setIgnored] = useState<Set<string>>(() => new Set())
  const [confirmed, setConfirmed] = useState<Set<string>>(() => new Set())
  const parsed = useMemo(
    () => parseQuickAdd(newTitle, { notebooks, todayKey, ignored, confirmed, statuses }),
    [newTitle, notebooks, todayKey, ignored, confirmed, statuses]
  )

  function resetDraft() {
    setNewTitle('')
    setNewProject(null)
    setIgnored(new Set())
    setConfirmed(new Set())
  }

  async function handleCreate() {
    if (!parsed.title) return
    const draft: NewTaskDraft = {
      title: parsed.title,
      scheduledDate: parsed.scheduledDate,
      dueDate: parsed.dueDate,
      status: parsed.status,
      important: parsed.important,
      // `#Projeto` reconhecido sobrepõe o seletor.
      project: parsed.project ?? newProjectValue,
    }
    resetDraft()
    await onCreateTask(draft)
  }

  const counts: Record<TaskSummaryKey, number> = {
    overdue: summary.overdue,
    today: summary.today,
    week: summary.week,
    doing: summary.doing,
    doneWeek: summary.doneThisWeek,
  }

  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <span className={styles.heading}>Tasks</span>
        <ViewMenu mainView={mainView} onMainViewChange={onMainViewChange} />
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onManageStatuses}
          aria-label="manage statuses"
          title="Manage statuses"
        >
          <GearSix size={14} aria-hidden />
        </button>
        <select
          className={styles.select}
          value={filter ?? ALL_PROJECTS}
          onChange={(e) => onFilterChange(e.target.value === ALL_PROJECTS ? null : e.target.value)}
          aria-label="filter by project"
        >
          <option value={ALL_PROJECTS}>All projects</option>
          {filterNotebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.name || 'unnamed'}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.summary}>
        <div className={styles.chips}>
          {(Object.keys(SUMMARY_LABEL) as TaskSummaryKey[]).map((key) => {
            const tone =
              key === 'overdue' && counts.overdue > 0
                ? summary.overdueHasDeadline
                  ? styles.chipDanger
                  : styles.chipLate
                : ''
            return (
              <button
                key={key}
                type="button"
                className={`${styles.chip} ${tone} ${counts[key] === 0 ? styles.chipEmpty : ''} ${
                  summaryFilter === key ? styles.chipActive : ''
                }`}
                onClick={() => onSummaryFilterChange(summaryFilter === key ? null : key)}
                aria-pressed={summaryFilter === key}
              >
                {SUMMARY_LABEL[key]}
                <span className={styles.chipCount}>{counts[key]}</span>
              </button>
            )
          })}
        </div>
        {summary.weekTotal > 0 && (
          <div
            className={styles.weekBar}
            title={`${summary.doneThisWeek} of ${summary.weekTotal} tasks of this week done`}
          >
            <div className={styles.weekTrack}>
              <div
                className={styles.weekFill}
                style={{ width: `${(summary.doneThisWeek / summary.weekTotal) * 100}%` }}
              />
            </div>
            <span className={styles.weekLabel}>
              Week {summary.doneThisWeek}/{summary.weekTotal}
            </span>
          </div>
        )}
      </div>
      <label className={styles.searchRow}>
        <MagnifyingGlass size={12} aria-hidden />
        <input
          className={styles.search}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              if (search) onSearchChange('')
              else e.currentTarget.blur()
            }
          }}
          placeholder="Search tasks…"
          aria-label="search tasks"
          data-tasks-search
        />
      </label>
      {(onGroupByChange || convertible.length > 0) && (
        <div className={styles.toolbar}>
          {groupBy && onGroupByChange && (
            <label className={styles.groupBy}>
              Group by
              <select
                className={styles.groupBySelect}
                value={groupBy}
                onChange={(e) => onGroupByChange(e.target.value as TaskGroupBy)}
              >
                {(Object.keys(GROUP_BY_LABEL) as TaskGroupBy[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {GROUP_BY_LABEL[mode]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {convertible.length > 0 && (
            <span
              className={styles.menuWrap}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenuOpen(false)
              }}
            >
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="more actions"
                aria-expanded={menuOpen}
              >
                <DotsThree size={16} weight="bold" aria-hidden />
              </button>
              {menuOpen && (
                <div className={styles.menu} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => void handleConvert()}
                  >
                    Convert 'group | title'… ({convertible.length})
                  </button>
                </div>
              )}
            </span>
          )}
        </div>
      )}
      <div
        className={styles.newTaskRow}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleCreate()
          if (e.key === 'Escape') setNewProject(null)
        }}
      >
        <input
          className={styles.newTask}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New task…"
          aria-label="new task"
          title="Try: today, tomorrow, fri, 17/10, !fri (deadline), #Project, @status, !! (important)"
        />
        {parsed.tokens.length > 0 && (
          <div className={styles.tokens}>
            {parsed.tokens.map((t) => (
              <span
                key={`${t.start}-${t.raw}`}
                className={`${styles.token} ${t.needsConfirm ? styles.tokenConfirm : ''}`}
              >
                {t.needsConfirm ? (
                  <button
                    type="button"
                    className={styles.tokenLabel}
                    onClick={() => setConfirmed((prev) => new Set(prev).add(t.raw.toLowerCase()))}
                    title="Create this notebook when adding the task"
                  >
                    {t.label}
                  </button>
                ) : (
                  <span className={styles.tokenLabel}>{t.label}</span>
                )}
                <button
                  type="button"
                  className={styles.tokenRemove}
                  onClick={() => setIgnored((prev) => new Set(prev).add(t.raw.toLowerCase()))}
                  aria-label={`keep "${t.raw}" in the title`}
                  title="Keep as text"
                >
                  <X size={10} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
        <ProjectPicker notebooks={notebooks} value={newProjectValue} onChange={setNewProject} />
      </div>
      {modal}
    </div>
  )
}
