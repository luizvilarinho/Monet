import { useEffect, useMemo, useRef, useState } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { compareTasks, isOpen, overdueKind, type ChecklistProgress } from '../../lib/tasks'
import { parseQuickAdd } from '../../lib/taskQuickAdd'
import { useTasksEnv } from '../TasksView/TasksEnv'
import type { Notebook, Task } from '../../types'
import type { NewTaskDraft } from '../TasksView/TasksHeader'
import { TaskLine } from '../TasksView/TaskLine'
import styles from './NotebookTasksSection.module.css'

const COLLAPSED_KEY = 'monet:notes-tasks-collapsed'
const HEIGHT_KEY = 'monet:notes-tasks-height'
const DEFAULT_HEIGHT = 240
const MIN_HEIGHT = 90
// Altura mínima que a lista de notas mantém acima da divisória.
const NOTES_MIN_HEIGHT = 100
const VISIBLE_LIMIT = 6

const NO_SET = new Set<string>()

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignorar */
  }
}

// Tasks abertas do caderno ativo, no fim da coluna de notas: divisória
// arrastável (altura persistida), cabeçalho recolhível com contagem, lista
// com TaskLine e "+ task" com quick add (projeto = caderno ativo).
interface NotebookTasksSectionProps {
  notebookId: string
  tasks: Task[]
  notebooks: Notebook[]
  todayKey: string
  checklist: Map<string, ChecklistProgress>
  onOpenTask: (task: Task) => void
  onToggleTask: (id: string, done: boolean) => void
  onCreateTask: (draft: NewTaskDraft) => Promise<void>
  onShowAll: () => void
  // Nota TODOS aberta no editor: o "+ task" já nasce nela (D8).
  defaultTodosNoteId?: string | null
}

export function NotebookTasksSection({
  notebookId,
  tasks,
  notebooks,
  todayKey,
  checklist,
  onOpenTask,
  onToggleTask,
  onCreateTask,
  onShowAll,
  defaultTodosNoteId = null,
}: NotebookTasksSectionProps) {
  const [collapsed, setCollapsed] = useState(() => readStorage(COLLAPSED_KEY) === '1')
  const [height, setHeight] = useState(() => {
    const saved = Number(readStorage(HEIGHT_KEY))
    return saved >= MIN_HEIGHT ? saved : DEFAULT_HEIGHT
  })
  const { statuses, todosById } = useTasksEnv()
  const todosList = useMemo(() => [...todosById.values()], [todosById])
  const [draft, setDraft] = useState('')
  const sectionRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startHeight: number; max: number } | null>(null)
  const heightRef = useRef(height)
  heightRef.current = height

  const open = useMemo(
    () => tasks.filter((t) => t.notebookId === notebookId && isOpen(t)).sort(compareTasks),
    [tasks, notebookId]
  )
  const late = open.map((t) => overdueKind(t, todayKey)).filter((k) => k !== null)
  const lateTone = late.includes('deadline') ? styles.lateDeadline : styles.latePlan

  const parsed = useMemo(
    () =>
      parseQuickAdd(draft, { notebooks, todayKey, ignored: NO_SET, confirmed: NO_SET, statuses, todos: todosList }),
    [draft, notebooks, todayKey, statuses, todosList]
  )

  async function handleCreate() {
    if (!parsed.title) return
    const next: NewTaskDraft = {
      title: parsed.title,
      scheduledDate: parsed.scheduledDate,
      dueDate: parsed.dueDate,
      status: parsed.status,
      important: parsed.important,
      project: parsed.project ?? { notebookId },
      todos: parsed.todos ?? (defaultTodosNoteId ? { noteId: defaultTodosNoteId } : null),
    }
    setDraft('')
    await onCreateTask(next)
  }

  function toggleCollapsed() {
    setCollapsed((v) => {
      writeStorage(COLLAPSED_KEY, v ? '0' : '1')
      return !v
    })
  }

  // Divisória: arrasto manual (mousedown/mousemove/mouseup); para cima cresce.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const next = drag.startHeight - (e.clientY - drag.startY)
      setHeight(Math.round(Math.min(drag.max, Math.max(MIN_HEIGHT, next))))
    }
    function onUp() {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      writeStorage(HEIGHT_KEY, String(heightRef.current))
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const column = sectionRef.current?.parentElement
    const max = Math.max(MIN_HEIGHT, (column?.clientHeight ?? 600) - NOTES_MIN_HEIGHT)
    dragRef.current = { startY: e.clientY, startHeight: height, max }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  const addRow = (
    <div className={styles.addRow}>
      <input
        className={styles.addInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleCreate()
          if (e.key === 'Escape') {
            setDraft('')
            e.currentTarget.blur()
          }
        }}
        placeholder="+ task"
        aria-label="new task in this notebook"
        title="Try: today, tomorrow, fri, 17/10, !fri (deadline), >TODOS, @status, !! (important)"
      />
      {parsed.tokens.some((t) => !t.needsConfirm) && (
        <div className={styles.tokens}>
          {parsed.tokens
            .filter((t) => !t.needsConfirm)
            .map((t) => (
              <span key={`${t.start}-${t.raw}`} className={styles.token}>
                {t.label}
              </span>
            ))}
        </div>
      )}
    </div>
  )

  // Sem tasks abertas: só o "+ task" discreto.
  if (open.length === 0) {
    return (
      <div ref={sectionRef} className={styles.emptySection}>
        {addRow}
      </div>
    )
  }

  return (
    <div
      ref={sectionRef}
      className={styles.section}
      style={collapsed ? undefined : { height }}
    >
      {!collapsed && (
        <div
          className={styles.divider}
          onMouseDown={handleDividerMouseDown}
          role="separator"
          aria-orientation="horizontal"
          aria-label="resize tasks section"
        />
      )}
      <button
        type="button"
        className={styles.header}
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
      >
        {collapsed ? <CaretRight size={10} aria-hidden /> : <CaretDown size={10} aria-hidden />}
        <span>Tasks</span>
        <span className={styles.count}>{open.length}</span>
        {late.length > 0 && <span className={lateTone}>· {late.length} overdue</span>}
      </button>
      {!collapsed && (
        <>
          <div className={styles.list}>
            {open.slice(0, VISIBLE_LIMIT).map((t) => (
              <TaskLine
                key={t.id}
                task={t}
                todayKey={todayKey}
                checklist={checklist.get(t.id) ?? null}
                onSelect={() => onOpenTask(t)}
                onToggle={(done) => onToggleTask(t.id, done)}
              />
            ))}
            {open.length > VISIBLE_LIMIT && (
              <button type="button" className={styles.showAll} onClick={onShowAll}>
                Show all ({open.length})
              </button>
            )}
          </div>
          {addRow}
        </>
      )}
    </div>
  )
}
