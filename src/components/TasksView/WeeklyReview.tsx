import { useMemo, useState, type ReactNode } from 'react'
import { CaretLeft, CaretRight, Copy } from '@phosphor-icons/react'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  addDaysKey,
  byTodosId,
  compareTasks,
  computeTaskSummary,
  filterTasksForView,
  formatDueShort,
  isDone,
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
import { TaskUndoBar } from './TaskBatchBar'
import { useTaskActions } from './useTaskActions'
import type { TaskChanges } from './useTaskKeyboard'
import styles from './WeeklyReview.module.css'

// Weekly review guiado (respeita o filtro de projeto), da semana corrente ou
// de semanas anteriores: concluídas, escorregadas, pendências (mover para a
// próxima segunda; uma task aparece numa seção só) e uma reflexão
// acrescentada à nota diária de hoje no Calendar, ou copiada.
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
  onCreateTask: (draft: NewTaskDraft) => Promise<Task | undefined>
  onConvertPipeTitles: (tasks: Task[]) => void
  onOpenTask: (task: Task) => void
  onToggleTask: (id: string, done: boolean) => void
  onUpdateTasks: (changes: TaskChanges) => void
  // Undo de uma recorrente concluída aqui: apaga a ocorrência gerada.
  onDeleteTasks?: (ids: string[]) => void
  checklist: Map<string, ChecklistProgress>
  // Acrescenta o review (markdown) à nota diária de hoje. `askAi`: também
  // acrescenta uma linha `/week-review` e abre a nota para o usuário executá-la.
  // false = não gravou (o texto fica no campo).
  onSaveReview: (markdown: string, askAi: boolean) => Promise<boolean>
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
  onDeleteTasks,
  checklist,
  onSaveReview,
}: WeeklyReviewProps) {
  const currentWeek = startOfWeekKey(todayKey)
  const [weekStart, setWeekStart] = useState(currentWeek)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [reflection, setReflection] = useState('')
  // Resultado da última ação do rodapé (salvar/copiar).
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const actions = useTaskActions({ tasksById, todayKey, onUpdateTasks, onDeleteTasks })

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

  const isCurrentWeek = weekStart === currentWeek
  const weekEnd = addDaysKey(weekStart, 6)
  // Destino do "Move to…": a segunda seguinte à semana revista, ou a próxima
  // segunda a partir de hoje quando aquela já passou.
  const nextMonday = addDaysKey(currentWeek, 7)
  const target = addDaysKey(weekStart, 7) >= todayKey ? addDaysKey(weekStart, 7) : nextMonday
  const weekLabel = `${formatDueShort(weekStart)} – ${formatDueShort(weekEnd)}`

  const done = useMemo(
    () =>
      projectTasks
        .filter((t) => {
          if (!isDone(t) || t.completedAt === null) return false
          const day = dateKeyFromMs(t.completedAt)
          return day >= weekStart && day <= weekEnd
        })
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [projectTasks, weekStart, weekEnd]
  )
  const slipped = useMemo(
    () =>
      projectTasks
        .filter((t) => {
          if (!isOpen(t)) return false
          const plan = planDate(t)
          if (plan === null) return false
          if (isOverdue(t, todayKey)) return plan <= weekEnd
          return t.rescheduleCount >= 1 && plan >= weekStart && plan <= weekEnd
        })
        .sort(compareTasks),
    [projectTasks, todayKey, weekStart, weekEnd]
  )
  // Pendências da semana que não escorregaram (sem duplicar o Slipped).
  const stillOpen = useMemo(() => {
    const slippedIds = new Set(slipped.map((t) => t.id))
    return projectTasks
      .filter((t) => {
        const plan = planDate(t)
        return isOpen(t) && plan !== null && plan <= weekEnd && !slippedIds.has(t.id)
      })
      .sort(compareTasks)
  }, [projectTasks, weekEnd, slipped])
  // Seleção: escorregadas e pendências que ainda estão na tela.
  const selectable = [...slipped, ...stillOpen]
  const selectedOpen = selectable.filter((t) => selected.has(t.id))

  function changeWeek(next: string) {
    setWeekStart(next)
    setSelected(new Set())
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function moveSelected() {
    void actions.reschedule(
      selectedOpen.map((t) => ({ id: t.id, date: target })),
      target === nextMonday ? 'moved to next Monday' : `moved to ${formatDueShort(target)}`
    )
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
          ...group.tasks.map((t) => `- ${t.title}${t.rescheduleCount > 0 ? ` (postponed ${t.rescheduleCount}×)` : ''}`)
        )
      }
    }
    if (reflection.trim()) lines.push('', '### Reflection', reflection.trim())
    return lines.join('\n')
  }

  // Falha ao gravar: a reflexão fica no campo e o erro aparece no lugar do "Saved".
  async function save(askAi: boolean) {
    setNotice(null)
    let ok = false
    try {
      ok = await onSaveReview(buildMarkdown(), askAi)
    } catch (err) {
      console.error('failed to save weekly review', err)
    }
    if (!ok) {
      setNotice({ text: "Couldn't save the review. Your text is kept.", error: true })
      return
    }
    setReflection('')
    setNotice({ text: "Saved to today's note.", error: false })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildMarkdown())
      setNotice({ text: 'Copied as Markdown.', error: false })
    } catch {
      setNotice({ text: "Couldn't copy to the clipboard.", error: true })
    }
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
        onToggle={(checked) =>
          actions.track(checked ? 'marked done' : 'reopened', [t.id], () => onToggleTask(t.id, checked))
        }
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
          onOpenTask={onOpenTask}
          onConvertPipeTitles={onConvertPipeTitles}
        />
      </div>
      <div className={styles.page}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Weekly review · {weekLabel}</h2>
          <div className={styles.weekNav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => changeWeek(addDaysKey(weekStart, -7))}
              aria-label="previous week"
            >
              <CaretLeft size={13} weight="bold" aria-hidden />
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => changeWeek(currentWeek)}
              disabled={isCurrentWeek}
            >
              This week
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => changeWeek(addDaysKey(weekStart, 7))}
              disabled={isCurrentWeek}
              aria-label="next week"
            >
              <CaretRight size={13} weight="bold" aria-hidden />
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {isCurrentWeek ? 'Done this week' : 'Done'} <span className={styles.count}>{done.length}</span>
          </h3>
          {renderGrouped(done, isCurrentWeek ? 'Nothing done yet this week.' : 'Nothing done that week.')}
        </div>

        {selectable.length > 0 && (
          <div className={styles.actions}>
            <label className={styles.selectAll}>
              <input
                type="checkbox"
                checked={selectedOpen.length === selectable.length}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(selectable.map((t) => t.id)) : new Set())
                }
              />
              Select all
            </label>
            <button
              type="button"
              className={styles.button}
              disabled={selectedOpen.length === 0}
              onClick={moveSelected}
              title={`Set the do date to ${formatDueShort(target)}`}
            >
              {target === nextMonday ? 'Move to next Monday' : `Move to Mon ${formatDueShort(target)}`}
              {selectedOpen.length > 0 ? ` (${selectedOpen.length})` : ''}
            </button>
          </div>
        )}

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Slipped <span className={styles.count}>{slipped.length}</span>
          </h3>
          {renderGrouped(slipped, 'Nothing slipped.', renderSelectRow)}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {isCurrentWeek ? 'Still open this week' : 'Still open'}{' '}
            <span className={styles.count}>{stillOpen.length}</span>
          </h3>
          {renderGrouped(stillOpen, 'No pending tasks for this week.', renderSelectRow)}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Reflection</h3>
          <textarea
            className={styles.textarea}
            value={reflection}
            onChange={(e) => {
              setReflection(e.target.value)
              setNotice(null)
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
              title="Saves the review and opens today's note with a /week-review line for you to run (Enter)"
            >
              Ask AI (/week-review)
            </button>
            <button type="button" className={`${styles.button} ${styles.iconButton}`} onClick={() => void copy()}>
              <Copy size={12} aria-hidden />
              Copy
            </button>
            {notice && (
              <span className={notice.error ? styles.error : styles.saved} role={notice.error ? 'alert' : 'status'}>
                {notice.text}
              </span>
            )}
          </div>
        </div>
        <TaskUndoBar actions={actions} />
      </div>
      {actions.modal}
    </section>
  )
}
