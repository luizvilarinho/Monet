import { useMemo, useState } from 'react'
import {
  formatDueShort,
  groupTasks,
  INBOX_NOTEBOOK_ID,
  isOpen,
  isOverdue,
  type ProjectChoice,
  type TaskGroups,
} from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { ProjectPicker } from './ProjectPicker'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import styles from './TasksView.module.css'

// Lista de tasks no slot da Sidebar. Selecionar uma task abre a nota-corpo
// dela no editor principal (a seleção é a task cuja nota está aberta).
interface TasksViewProps {
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  width: number
  onWidthChange: (w: number) => void
  // Caderno-projeto filtrado (null = todos).
  filter: string | null
  onFilterChange: (notebookId: string | null) => void
  selectedTaskId: string | null
  onSelectTask: (task: Task) => void
  // Cria a task (com a nota-corpo) e a abre no editor.
  onCreateTask: (title: string, project: ProjectChoice) => Promise<void>
  onToggleTask: (id: string, done: boolean) => void
}

const GROUPS: Array<{ key: keyof TaskGroups; label: string }> = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'later', label: 'Later' },
  { key: 'noDate', label: 'No date' },
  { key: 'done', label: 'Done' },
]

const ALL_PROJECTS = '__all__'

export function TasksView({
  tasks,
  notebooks,
  todayKey,
  width,
  onWidthChange,
  filter,
  onFilterChange,
  selectedTaskId,
  onSelectTask,
  onCreateTask,
  onToggleTask,
}: TasksViewProps) {
  const [newTitle, setNewTitle] = useState('')
  // null = projeto padrão (o filtrado, ou o Inbox).
  const [newProject, setNewProject] = useState<ProjectChoice | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  const onResizeMouseDown = useSidebarResize(width, onWidthChange)

  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )

  // Filtro: cadernos que têm tasks (mais o filtrado, para o select não ficar
  // sem opção quando o projeto ainda não tem tasks).
  const filterNotebooks = useMemo(
    () => notebooks.filter((nb) => nb.id === filter || tasks.some((t) => t.notebookId === nb.id)),
    [notebooks, tasks, filter]
  )

  const groups = useMemo(
    () => groupTasks(filter === null ? tasks : tasks.filter((t) => t.notebookId === filter), todayKey),
    [tasks, filter, todayKey]
  )

  const newProjectValue = newProject ?? { notebookId: filter ?? INBOX_NOTEBOOK_ID }

  async function handleCreate() {
    const title = newTitle.trim()
    if (!title) return
    setNewTitle('')
    setNewProject(null)
    await onCreateTask(title, newProjectValue)
  }

  return (
    <aside className={styles.tasksView} style={{ width }}>
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
      <div className={styles.listHeader}>
        <span className={styles.heading}>Tasks</span>
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
        />
        <ProjectPicker notebooks={notebooks} value={newProjectValue} onChange={setNewProject} />
      </div>
      <div className={styles.groups}>
        {GROUPS.map(({ key, label }) => {
          const list = groups[key]
          if (list.length === 0) return null
          const isDone = key === 'done'
          const collapsed = isDone && !doneOpen
          return (
            <section key={key} className={styles.group}>
              <button
                type="button"
                className={`${styles.groupHeader} ${key === 'overdue' ? styles.groupOverdue : ''}`}
                onClick={isDone ? () => setDoneOpen((v) => !v) : undefined}
                disabled={!isDone}
              >
                {isDone && <span className={styles.caret}>{doneOpen ? '▾' : '▸'}</span>}
                {label}
                <span className={styles.count}>{list.length}</span>
              </button>
              {!collapsed &&
                list.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    todayKey={todayKey}
                    projectName={filter === null ? notebookNameById.get(t.notebookId) : undefined}
                    selected={t.id === selectedTaskId}
                    onSelect={() => onSelectTask(t)}
                    onToggle={(done) => onToggleTask(t.id, done)}
                  />
                ))}
            </section>
          )
        })}
      </div>
    </aside>
  )
}

interface TaskRowProps {
  task: Task
  todayKey: string
  projectName?: string
  selected: boolean
  onSelect: () => void
  onToggle: (done: boolean) => void
}

function TaskRow({ task, todayKey, projectName, selected, onSelect, onToggle }: TaskRowProps) {
  const closed = !isOpen(task)
  return (
    <div
      className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect()
      }}
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={task.status === 'done'}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label="done"
      />
      <span className={`${styles.rowTitle} ${closed ? styles.rowTitleClosed : ''}`}>
        {task.title}
      </span>
      {task.status === 'doing' && <span className={styles.doingBadge}>doing</span>}
      {projectName && <span className={styles.rowProject}>{projectName}</span>}
      {task.dueDate && (
        <span className={`${styles.rowDue} ${isOverdue(task, todayKey) ? styles.rowDueOverdue : ''}`}>
          {formatDueShort(task.dueDate)}
        </span>
      )}
    </div>
  )
}
