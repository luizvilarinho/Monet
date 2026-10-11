import type { Note, Subject, Task, TaskStatus } from '../types'
import { dateKeyFromMs, toDateKey } from './calendar'

export const TASK_REF_TAG = 'task-ref'

// Projeto de uma task = caderno. O "Inbox" é um caderno singleton de id fixo
// (mesmo princípio do Calendar) que recebe as tasks sem projeto.
export const INBOX_NOTEBOOK_ID = 'inbox'

// Subject "Tasks" de um caderno-projeto: id derivado do caderno, então criar
// é idempotente (UPSERT por id) e identificá-lo não depende do nome.
export const TASKS_SUBJECT_NAME = 'Tasks'

export function tasksSubjectId(notebookId: string): string {
  return `tasks-${notebookId}`
}

export function isTasksSubject(subject: Subject): boolean {
  return subject.id === tasksSubjectId(subject.notebookId)
}

// Documento-resumo das tasks de um caderno na pasta de notas do RAG: não é
// uma nota real, só um id de documento (`note:tasks-<notebookId>`).
export function tasksSummaryNoteId(notebookId: string): string {
  return `tasks-${notebookId}`
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
  dropped: 'Dropped',
}

// Nota-corpo de task: fica no subject "Tasks" do próprio caderno.
export function isTaskBodyNote(note: Note): boolean {
  return !!note.notebookId && note.subjectId === tasksSubjectId(note.notebookId)
}

// Escolha de projeto nos seletores: caderno existente ou nome de um caderno
// novo, criado na hora ao confirmar.
export type ProjectChoice = { notebookId: string } | { newName: string }

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'status' | 'notebookId' | 'noteId' | 'dueDate'>
>

// Regras de negócio de uma edição de task:
// - reschedule_count só conta quando havia prazo e ele muda para outro prazo
//   (definir o primeiro prazo ou limpar o prazo não contam);
// - completed_at é gravado ao entrar em `done` e limpo ao sair dele.
export function applyTaskPatch(prev: Task, patch: TaskPatch, now: number): Task {
  const next: Task = { ...prev, ...patch, updatedAt: now }
  if (
    patch.dueDate !== undefined &&
    prev.dueDate !== null &&
    patch.dueDate !== null &&
    patch.dueDate !== prev.dueDate
  ) {
    next.rescheduleCount = prev.rescheduleCount + 1
  }
  if (patch.status !== undefined && patch.status !== prev.status) {
    if (patch.status === 'done') next.completedAt = now
    else if (prev.status === 'done') next.completedAt = null
  }
  return next
}

export function isOpen(t: Task): boolean {
  return t.status === 'todo' || t.status === 'doing'
}

export function isOverdue(t: Task, todayKey: string): boolean {
  return isOpen(t) && t.dueDate !== null && t.dueDate < todayKey
}

// Período que a task ocupa no Calendar. Vencidas não têm período (aparecem
// no bloco Overdue); concluídas/descartadas também não.
export function taskSpan(
  t: Task,
  todayKey: string
): { start: string; end: string } | null {
  if (!isOpen(t)) return null
  if (t.dueDate === null) return { start: todayKey, end: todayKey }
  if (t.dueDate < todayKey) return null
  const created = dateKeyFromMs(t.createdAt)
  if (t.dueDate < created) return { start: t.dueDate, end: t.dueDate }
  return { start: created, end: t.dueDate }
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Sábado da semana corrente (a semana começa no domingo, como no Calendar).
export function endOfWeekKey(todayKey: string): string {
  const d = parseKey(todayKey)
  d.setDate(d.getDate() + (6 - d.getDay()))
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate())
}

const DONE_LIMIT = 50

export interface TaskGroups {
  overdue: Task[]
  today: Task[]
  thisWeek: Task[]
  later: Task[]
  noDate: Task[]
  done: Task[]
}

export function groupTasks(tasks: Task[], todayKey: string): TaskGroups {
  const groups: TaskGroups = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    noDate: [],
    done: [],
  }
  const weekEnd = endOfWeekKey(todayKey)
  for (const t of tasks) {
    if (!isOpen(t)) groups.done.push(t)
    else if (t.dueDate === null) groups.noDate.push(t)
    else if (t.dueDate < todayKey) groups.overdue.push(t)
    else if (t.dueDate === todayKey) groups.today.push(t)
    else if (t.dueDate <= weekEnd) groups.thisWeek.push(t)
    else groups.later.push(t)
  }
  const byDue = (a: Task, b: Task) =>
    (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.sortOrder - b.sortOrder
  groups.overdue.sort(byDue)
  groups.today.sort(byDue)
  groups.thisWeek.sort(byDue)
  groups.later.sort(byDue)
  groups.noDate.sort(byDue)
  groups.done = groups.done
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt))
    .slice(0, DONE_LIMIT)
  return groups
}

const TASK_LINE_RE = /^\s*- \[[ xX]\] (.*)$/
const TASK_REF_ID_RE = /<task-ref data-id="([^"]+)"/

// Título de cada item de checklist vinculado a uma task no markdown da nota.
export function extractTaskRefTitles(
  markdown: string
): Array<{ id: string; title: string }> {
  const out: Array<{ id: string; title: string }> = []
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(TASK_LINE_RE)
    if (!m) continue
    const ref = m[1].match(TASK_REF_ID_RE)
    if (!ref) continue
    const title = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!title) continue
    out.push({ id: ref[1], title })
  }
  return out
}

// "Oct 14" a partir de uma chave `YYYY-MM-DD`.
export function formatDueShort(key: string): string {
  return parseKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
