import { useMemo, useState, type ReactNode } from 'react'
import {
  addDaysKey,
  byTodosId,
  compareTasks,
  computeTaskSummary,
  endOfWeekKey,
  filterBySummary,
  filterTasksForView,
  formatDueShort,
  isOpen,
  isOverdue,
  planDate,
  startOfWeekKey,
  type ChecklistProgress,
  type TaskSummaryKey,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { TasksHeader, type NewTaskDraft } from './TasksHeader'
import { useTasksEnv } from './TasksEnv'
import type { TasksMainView } from './views'
import { TaskCard } from './TaskCard'
import type { TaskChanges } from './useTaskKeyboard'
import styles from './WeeklyReview.module.css'

// Weekly review guiado da semana corrente (respeita o filtro de projeto):
// concluídas, escorregadas, pendências (mover para a próxima segunda) e uma
// reflexão acrescentada à nota diária de hoje no Calendar.
interface WeeklyReviewProps {
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
  onConvertPipeTitles: (tasks: Task[]) => void
  onOpenTask: (task: Task) => void
  onToggleTask: (id: string, done: boolean) => void
  onUpdateTasks: (changes: TaskChanges) => void
  checklist: Map<string, ChecklistProgress>
  // Acrescenta o review (markdown) à nota diária de hoje. `askAi`: também
  // acrescenta uma linha `/week` e abre a nota para o usuário executá-la.
  onSaveReview: (markdown: string, askAi: boolean) => Promise<void>
}

export function WeeklyReview({
  tasks,
  notebooks,
  todayKey,
  mainView,
  onMainViewChange,
  filter,
  onFilterChange,
  onSummaryFilterChange,
  onCreateTask,
  onConvertPipeTitles,
  onOpenTask,
  onToggleTask,
  onUpdateTasks,
  checklist,
  onSaveReview,
}: WeeklyReviewProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [reflection, setReflection] = useState('')
  const [saved, setSaved] = useState(false)

  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )
  const notebookColorById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.color ?? null])),
    [notebooks]
  )
  const { search, todosById } = useTasksEnv()
  const projectTasks = useMemo(
    () => filterTasksForView(tasks, filter, search, todosById),
    [tasks, filter, search, todosById]
  )
  const summary = useMemo(() => computeTaskSummary(projectTasks, todayKey), [projectTasks, todayKey])

  const weekStart = startOfWeekKey(todayKey)
  const weekEnd = endOfWeekKey(todayKey)
  const nextMonday = addDaysKey(weekStart, 7)
  const weekLabel = `${formatDueShort(weekStart)} – ${formatDueShort(weekEnd)}`

  const done = useMemo(() => filterBySummary(projectTasks, 'doneWeek', todayKey), [projectTasks, todayKey])
  const slipped = useMemo(
    () =>
      projectTasks
        .filter((t) => {
          if (!isOpen(t)) return false
          if (isOverdue(t, todayKey)) return true
          const plan = planDate(t)
          return t.rescheduleCount >= 1 && plan !== null && plan >= weekStart && plan <= weekEnd
        })
        .sort(compareTasks),
    [projectTasks, todayKey, weekStart, weekEnd]
  )
  const stillOpen = useMemo(
    () =>
      projectTasks
        .filter((t) => {
          const plan = planDate(t)
          return isOpen(t) && plan !== null && plan <= weekEnd
        })
        .sort(compareTasks),
    [projectTasks, weekEnd]
  )
  // Seleção só vale para o que ainda está pendente.
  const selectedOpen = stillOpen.filter((t) => selected.has(t.id))

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function moveToNextMonday() {
    onUpdateTasks(selectedOpen.map((t) => ({ id: t.id, patch: { scheduledDate: nextMonday } })))
    setSelected(new Set())
  }

  function buildMarkdown(): string {
    const lines = [`## Weekly review — ${weekLabel}`, '', `Done: ${done.length} · Slipped: ${slipped.length}`]
    if (done.length > 0) {
      lines.push('', '### Done')
      for (const group of groupsOf(done)) {
        if (group.label !== null) lines.push(`#### ${group.label}`)
        lines.push(...group.tasks.map((t) => `- ${t.title}`))
      }
    }
    if (slipped.length > 0) {
      lines.push('', '### Slipped')
      for (const group of groupsOf(slipped)) {
        if (group.label !== null) lines.push(`#### ${group.label}`)
        lines.push(
          ...group.tasks.map((t) => `- ${t.title}${t.rescheduleCount > 0 ? ` (↻${t.rescheduleCount})` : ''}`)
        )
      }
    }
    if (reflection.trim()) lines.push('', '### Reflection', reflection.trim())
    return lines.join('\n')
  }

  async function save(askAi: boolean) {
    await onSaveReview(buildMarkdown(), askAi)
    setReflection('')
    setSaved(true)
  }

  function renderLine(t: Task) {
    return (
      <TaskCard
        task={t}
        todayKey={todayKey}
        projectName={filter === null ? notebookNameById.get(t.notebookId) : undefined}
        projectColor={notebookColorById.get(t.notebookId) ?? null}
        checklist={checklist.get(t.id)}
        onSelect={() => onOpenTask(t)}
        onToggle={(isDone) => onToggleTask(t.id, isDone)}
      />
    )
  }

  // TODOS por título (alfabético) com o "sem TODOS" no fim, como na lista.
  // Sem nenhuma TODOS na lista: um grupo só, sem título (label null).
  function groupsOf(list: Task[]) {
    const groups = [...byTodosId(list, todosById).entries()]
    const flat = groups.length === 1 && groups[0][0] === null
    return groups.map(([id, group]) => ({
      id,
      label: flat ? null : id ? todosById.get(id)?.title.trim() || 'Untitled' : 'No TODOS',
      tasks: group,
    }))
  }

  function renderGrouped(
    list: Task[],
    emptyText: string,
    renderRow: (t: Task) => ReactNode = (t) => <div key={t.id}>{renderLine(t)}</div>
  ) {
    if (list.length === 0) return <span className={styles.empty}>{emptyText}</span>
    return (
      <>
        {groupsOf(list).map((group) => (
          <div key={group.id ?? ''} className={styles.group}>
            {group.label !== null && (
              <h4 className={styles.groupTitle}>
                {group.label} <span className={styles.count}>{group.tasks.length}</span>
              </h4>
            )}
            {group.tasks.map((t) => renderRow(t))}
          </div>
        ))}
      </>
    )
  }

  function renderSelectRow(t: Task) {
    return (
      <div key={t.id} className={styles.selectRow}>
        <input
          type="checkbox"
          className={styles.selectBox}
          checked={selected.has(t.id)}
          onChange={() => toggleSelected(t.id)}
          aria-label={`select "${t.title}"`}
        />
        <div className={styles.selectLine}>{renderLine(t)}</div>
      </div>
    )
  }

  return (
    <section className={styles.review} aria-label="weekly review">
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
      <div className={styles.page}>
        <h2 className={styles.title}>Weekly review · {weekLabel}</h2>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Done this week <span className={styles.count}>{done.length}</span>
          </h3>
          {renderGrouped(done, 'Nothing done yet this week.')}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Slipped <span className={styles.count}>{slipped.length}</span>
          </h3>
          {renderGrouped(slipped, 'Nothing slipped.')}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Still open this week <span className={styles.count}>{stillOpen.length}</span>
          </h3>
          {stillOpen.length > 0 && (
            <div className={styles.actions}>
              <label className={styles.selectAll}>
                <input
                  type="checkbox"
                  checked={selectedOpen.length === stillOpen.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(stillOpen.map((t) => t.id)) : new Set())
                  }
                />
                Select all
              </label>
              <button
                type="button"
                className={styles.button}
                disabled={selectedOpen.length === 0}
                onClick={moveToNextMonday}
                title={`Set the do date to ${formatDueShort(nextMonday)} (deadline unchanged)`}
              >
                Move to next Monday{selectedOpen.length > 0 ? ` (${selectedOpen.length})` : ''}
              </button>
            </div>
          )}
          {renderGrouped(stillOpen, 'No pending tasks for this week.', renderSelectRow)}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Reflection</h3>
          <textarea
            className={styles.textarea}
            value={reflection}
            onChange={(e) => {
              setReflection(e.target.value)
              setSaved(false)
            }}
            placeholder="What went well? What got in the way? What matters next week?"
            rows={5}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.buttonPrimary} onClick={() => void save(false)}>
              Save to Calendar
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => void save(true)}
              title="Saves the review and opens today's note with a /week line for you to run (Enter)"
            >
              Ask AI (/week)
            </button>
            {saved && <span className={styles.saved}>Saved to today's note.</span>}
          </div>
        </div>
      </div>
    </section>
  )
}
