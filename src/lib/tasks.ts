import type { Note, Notebook, Subject, Task, TaskRecurrence, TaskStatus } from '../types'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs, toDateKey } from './calendar'

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
  Pick<
    Task,
    | 'title'
    | 'status'
    | 'notebookId'
    | 'noteId'
    | 'dueDate'
    | 'scheduledDate'
    | 'group'
    | 'important'
    | 'recurrence'
    | 'recurrenceNextId'
  >
>

// Group é texto livre: sempre aparado; vazio vira null.
export function normalizeGroup(group: string | null): string | null {
  const g = group?.trim() ?? ''
  return g ? g : null
}

// Regras de negócio de uma edição de task:
// - reschedule_count conta quando havia deadline e ele muda para outro
//   deadline, ou quando havia do date e ele é adiado (rollover); definir o
//   primeiro valor, antecipar o do date ou limpar não contam;
// - completed_at é gravado ao entrar em `done` e limpo ao sair dele.
export function applyTaskPatch(prev: Task, patch: TaskPatch, now: number): Task {
  const next: Task = { ...prev, ...patch, updatedAt: now }
  if (patch.group !== undefined) next.group = normalizeGroup(patch.group)
  if (
    patch.dueDate !== undefined &&
    prev.dueDate !== null &&
    patch.dueDate !== null &&
    patch.dueDate !== prev.dueDate
  ) {
    next.rescheduleCount = prev.rescheduleCount + 1
  } else if (
    patch.scheduledDate !== undefined &&
    prev.scheduledDate !== null &&
    patch.scheduledDate !== null &&
    patch.scheduledDate > prev.scheduledDate
  ) {
    next.rescheduleCount = prev.rescheduleCount + 1
  }
  if (patch.status !== undefined && patch.status !== prev.status) {
    if (patch.status === 'done') next.completedAt = now
    else if (prev.status === 'done') next.completedAt = null
  }
  return next
}

// Confirmação de exclusão: a task leva a nota-corpo junto e não há desfazer.
export function deleteTasksMessage(tasks: Task[]): string {
  if (tasks.length === 1) return `Delete task "${tasks[0].title}" and its note? This can't be undone.`
  return `Delete ${tasks.length} tasks and their notes? This can't be undone.`
}

export function isOpen(t: Task): boolean {
  return t.status === 'todo' || t.status === 'doing'
}

// Data de planejamento: base única de agrupamento e contagem das tasks.
export function planDate(t: Task): string | null {
  return t.scheduledDate ?? t.dueDate
}

export type OverdueKind = 'deadline' | 'plan'

// Tipo de atraso de uma task aberta: 'deadline' = prazo de entrega estourado
// (vermelho); 'plan' = do date passou mas o deadline não (amarelo).
export function overdueKind(t: Task, todayKey: string): OverdueKind | null {
  if (!isOpen(t)) return null
  if (t.dueDate !== null && t.dueDate < todayKey) return 'deadline'
  if (t.scheduledDate !== null && t.scheduledDate < todayKey) return 'plan'
  return null
}

// Do date depois do deadline: permitido, só sinalizado.
export function scheduledAfterDeadline(t: Task): boolean {
  return t.scheduledDate !== null && t.dueDate !== null && t.scheduledDate > t.dueDate
}

export function isOverdue(t: Task, todayKey: string): boolean {
  return overdueKind(t, todayKey) !== null
}

// Período que a task ocupa no Calendar. Vencidas não têm período (aparecem
// no bloco Overdue); concluídas/descartadas também não.
export function taskSpan(
  t: Task,
  todayKey: string
): { start: string; end: string } | null {
  if (!isOpen(t) || isOverdue(t, todayKey)) return null
  const { scheduledDate: sched, dueDate: due } = t
  if (sched === null && due === null) return { start: todayKey, end: todayKey }
  if (sched === null && due !== null) {
    const created = dateKeyFromMs(t.createdAt)
    if (due < created) return { start: due, end: due }
    return { start: created, end: due }
  }
  if (sched !== null && (due === null || sched > due)) return { start: sched, end: sched }
  return { start: sched!, end: due! }
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDaysKey(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate())
}

// Domingo da semana de `key` (a semana começa no domingo, como no Calendar).
export function startOfWeekKey(key: string): string {
  return addDaysKey(key, -parseKey(key).getDay())
}

// As 7 chaves de dia da semana que começa em `startKey`.
export function weekDayKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(startKey, i))
}

// Sábado da semana corrente.
export function endOfWeekKey(todayKey: string): string {
  return addDaysKey(startOfWeekKey(todayKey), 6)
}

const DONE_LIMIT = 50

export interface TaskGroups {
  inProgress: Task[]
  overdue: Task[]
  today: Task[]
  thisWeek: Task[]
  later: Task[]
  noDate: Task[]
  done: Task[]
}

export function groupTasks(tasks: Task[], todayKey: string): TaskGroups {
  const groups: TaskGroups = {
    inProgress: [],
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    noDate: [],
    done: [],
  }
  const weekEnd = endOfWeekKey(todayKey)
  for (const t of tasks) {
    const plan = planDate(t)
    if (!isOpen(t)) groups.done.push(t)
    else if (t.status === 'doing') groups.inProgress.push(t)
    else if (isOverdue(t, todayKey)) groups.overdue.push(t)
    else if (plan === null) groups.noDate.push(t)
    else if (plan === todayKey) groups.today.push(t)
    else if (plan <= weekEnd) groups.thisWeek.push(t)
    else groups.later.push(t)
  }
  groups.inProgress.sort(compareTasks)
  groups.overdue.sort(compareTasks)
  groups.today.sort(compareTasks)
  groups.thisWeek.sort(compareTasks)
  groups.later.sort(compareTasks)
  groups.noDate.sort(compareTasks)
  groups.done = groups.done.sort(byCompletedDesc).slice(0, DONE_LIMIT)
  return groups
}

// Ordem dentro de um grupo/coluna: important primeiro, depois a data de
// planejamento.
export function compareTasks(a: Task, b: Task): number {
  if (a.important !== b.important) return a.important ? -1 : 1
  return byPlanDate(a, b)
}

// Data de planejamento asc (sem data por último), depois a ordem manual.
function byPlanDate(a: Task, b: Task): number {
  const pa = planDate(a)
  const pb = planDate(b)
  if (pa !== pb) {
    if (pa === null) return 1
    if (pb === null) return -1
    return pa.localeCompare(pb)
  }
  return a.sortOrder - b.sortOrder
}

function byCompletedDesc(a: Task, b: Task): number {
  return (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt)
}

// Filtros da faixa de resumo da TasksView.
export type TaskSummaryKey = 'overdue' | 'today' | 'week' | 'doing' | 'doneWeek'

export interface TaskSummary {
  overdue: number
  // Algum atraso é de deadline (chip vermelho); senão o chip fica amarelo.
  overdueHasDeadline: boolean
  today: number
  week: number
  doing: number
  doneThisWeek: number
  // Denominador da barra da semana: concluídas na semana + abertas com
  // planejamento até o fim da semana (inclui atrasadas).
  weekTotal: number
}

export function summaryMatches(key: TaskSummaryKey, t: Task, todayKey: string): boolean {
  const plan = planDate(t)
  switch (key) {
    case 'overdue':
      return isOverdue(t, todayKey)
    case 'today':
      return isOpen(t) && !isOverdue(t, todayKey) && plan === todayKey
    case 'week':
      return (
        isOpen(t) &&
        !isOverdue(t, todayKey) &&
        plan !== null &&
        plan >= todayKey &&
        plan <= endOfWeekKey(todayKey)
      )
    case 'doing':
      return t.status === 'doing'
    case 'doneWeek':
      return (
        t.status === 'done' &&
        t.completedAt !== null &&
        dateKeyFromMs(t.completedAt) >= startOfWeekKey(todayKey) &&
        dateKeyFromMs(t.completedAt) <= endOfWeekKey(todayKey)
      )
  }
}

export function computeTaskSummary(tasks: Task[], todayKey: string): TaskSummary {
  const weekEnd = endOfWeekKey(todayKey)
  const summary: TaskSummary = {
    overdue: 0,
    overdueHasDeadline: false,
    today: 0,
    week: 0,
    doing: 0,
    doneThisWeek: 0,
    weekTotal: 0,
  }
  for (const t of tasks) {
    if (summaryMatches('overdue', t, todayKey)) summary.overdue++
    if (overdueKind(t, todayKey) === 'deadline') summary.overdueHasDeadline = true
    if (summaryMatches('today', t, todayKey)) summary.today++
    if (summaryMatches('week', t, todayKey)) summary.week++
    if (summaryMatches('doing', t, todayKey)) summary.doing++
    if (summaryMatches('doneWeek', t, todayKey)) summary.doneThisWeek++
    const plan = planDate(t)
    if (isOpen(t) && plan !== null && plan <= weekEnd) summary.weekTotal++
  }
  summary.weekTotal += summary.doneThisWeek
  return summary
}

export function filterBySummary(tasks: Task[], key: TaskSummaryKey, todayKey: string): Task[] {
  return tasks
    .filter((t) => summaryMatches(key, t, todayKey))
    .sort(key === 'doneWeek' ? byCompletedDesc : compareTasks)
}

export interface NotebookTaskProgress {
  done: number
  total: number
  open: number
  overdue: number
}

// Progresso de tasks por caderno (total sem as descartadas). Só entram
// cadernos com alguma task aberta.
export function taskProgressByNotebook(
  tasks: Task[],
  todayKey: string
): Map<string, NotebookTaskProgress> {
  const all = new Map<string, NotebookTaskProgress>()
  for (const t of tasks) {
    if (t.status === 'dropped') continue
    let p = all.get(t.notebookId)
    if (!p) {
      p = { done: 0, total: 0, open: 0, overdue: 0 }
      all.set(t.notebookId, p)
    }
    p.total++
    if (t.status === 'done') p.done++
    else p.open++
    if (isOverdue(t, todayKey)) p.overdue++
  }
  for (const [id, p] of all) if (p.open === 0) all.delete(id)
  return all
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

// ─── Group (agrupamento livre dentro do projeto) ────────────────────────────

// Groups distintos já usados no caderno (sugestões do campo Group).
export function groupsOfNotebook(tasks: Task[], notebookId: string): string[] {
  const set = new Set<string>()
  for (const t of tasks) if (t.notebookId === notebookId && t.group) set.add(t.group)
  return [...set].sort((a, b) => a.localeCompare(b))
}

// "sistema | ação" → group "sistema", título "ação". Divide no PRIMEIRO `|`;
// os dois lados precisam ficar não-vazios.
export function splitPipeTitle(title: string): { group: string; title: string } | null {
  const i = title.indexOf('|')
  if (i < 0) return null
  const group = title.slice(0, i).trim()
  const rest = title.slice(i + 1).trim()
  return group && rest ? { group, title: rest } : null
}

// Título vindo da nota de origem de uma task com group: remove o prefixo
// "group | " (sem diferenciar maiúsculas) para não reintroduzi-lo no título.
export function stripGroupPrefix(title: string, group: string | null): string {
  if (!group) return title
  const split = splitPipeTitle(title)
  if (!split || split.group.toLowerCase() !== group.toLowerCase()) return title
  return split.title
}

// ─── Group by da lista ──────────────────────────────────────────────────────

export type TaskGroupBy = 'date' | 'project' | 'status'

export interface TaskSection {
  key: string
  label: string
  tone?: 'overdue'
  // Subtítulos (Group by projeto): label null = tasks sem group, sem subtítulo.
  subgroups?: Array<{ label: string | null; tasks: Task[] }>
  // Todas as tasks da seção, na ordem de exibição.
  tasks: Task[]
  // Seção que começa recolhida (Done/Dropped).
  collapsible: boolean
}

const DATE_SECTIONS: Array<{ key: keyof TaskGroups; label: string }> = [
  { key: 'inProgress', label: 'In progress' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'later', label: 'Later' },
  { key: 'noDate', label: 'No date' },
  { key: 'done', label: 'Done' },
]

// Seções da lista conforme o Group by (seções vazias ficam de fora).
export function groupTasksBy(
  mode: TaskGroupBy,
  tasks: Task[],
  todayKey: string,
  notebooks: Notebook[]
): TaskSection[] {
  let sections: TaskSection[]
  if (mode === 'date') {
    const groups = groupTasks(tasks, todayKey)
    sections = DATE_SECTIONS.map(({ key, label }) => ({
      key,
      label,
      tone: key === 'overdue' ? 'overdue' : undefined,
      tasks: groups[key],
      collapsible: key === 'done',
    }))
  } else if (mode === 'status') {
    const withStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s)
    sections = [
      { key: 'doing', label: TASK_STATUS_LABEL.doing, tasks: withStatus('doing').sort(compareTasks), collapsible: false },
      { key: 'todo', label: TASK_STATUS_LABEL.todo, tasks: withStatus('todo').sort(compareTasks), collapsible: false },
      {
        key: 'done',
        label: TASK_STATUS_LABEL.done,
        tasks: withStatus('done').sort(byCompletedDesc).slice(0, DONE_LIMIT),
        collapsible: true,
      },
      { key: 'dropped', label: TASK_STATUS_LABEL.dropped, tasks: withStatus('dropped').sort(byCompletedDesc), collapsible: true },
    ]
  } else {
    const byNotebook = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!isOpen(t)) continue
      const list = byNotebook.get(t.notebookId) ?? []
      list.push(t)
      byNotebook.set(t.notebookId, list)
    }
    const known = new Set(notebooks.map((nb) => nb.id))
    const order = [
      ...notebooks.map((nb) => ({ id: nb.id, name: nb.name || 'unnamed' })),
      ...[...byNotebook.keys()].filter((id) => !known.has(id)).map((id) => ({ id, name: 'unnamed' })),
    ]
    sections = order.map(({ id, name }) => {
      const subgroups = subgroupsByGroup(byNotebook.get(id) ?? [])
      return {
        key: `project:${id}`,
        label: name,
        subgroups,
        tasks: subgroups.flatMap((g) => g.tasks),
        collapsible: false,
      }
    })
    sections.push({
      key: 'done',
      label: 'Done',
      tasks: tasks.filter((t) => !isOpen(t)).sort(byCompletedDesc).slice(0, DONE_LIMIT),
      collapsible: true,
    })
  }
  return sections.filter((s) => s.tasks.length > 0)
}

// Sem group primeiro (sem subtítulo), depois os groups em ordem alfabética.
function subgroupsByGroup(tasks: Task[]): Array<{ label: string | null; tasks: Task[] }> {
  const byGroup = new Map<string | null, Task[]>()
  for (const t of tasks) {
    const list = byGroup.get(t.group) ?? []
    list.push(t)
    byGroup.set(t.group, list)
  }
  return [...byGroup.keys()]
    .sort((a, b) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b)))
    .map((label) => ({ label, tasks: byGroup.get(label)!.sort(compareTasks) }))
}

// ─── Projeto por `#Nome` (quick add e bloco /tasks) ─────────────────────────

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Caderno cujo nome, sem espaços/acentos, casa com `name` (sem o `#`).
// O Calendar nunca é projeto.
export function findProjectByTag(notebooks: Notebook[], name: string): Notebook | undefined {
  const wanted = normalizeName(name)
  return notebooks.find(
    (n) => n.id !== CALENDAR_NOTEBOOK_ID && normalizeName(n.name).replace(/\s+/g, '') === wanted
  )
}

// ─── Bloco /tasks nas notas ─────────────────────────────────────────────────

export type TasksBlockPeriod = 'today' | 'overdue' | 'this week' | 'all'

export interface TasksBlockFilter {
  period: TasksBlockPeriod
  notebookId: string | null
  // `#Nome` sem caderno correspondente (o bloco fica vazio, com aviso).
  unknownProject?: string
}

// Filtro do bloco: `today`, `overdue`, `this week`/`week`, `all` e um
// `#Projeto`. Vazio = this week.
export function parseTasksFilter(text: string, notebooks: Notebook[]): TasksBlockFilter {
  const filter: TasksBlockFilter = { period: 'this week', notebookId: null }
  for (const word of text.trim().split(/\s+/)) {
    const lower = word.toLowerCase()
    if (word.length > 1 && word.startsWith('#')) {
      const nb = findProjectByTag(notebooks, word.slice(1))
      if (nb) filter.notebookId = nb.id
      else filter.unknownProject = word.slice(1)
    } else if (lower === 'today' || lower === 'overdue' || lower === 'all') {
      filter.period = lower
    } else if (lower === 'week') {
      filter.period = 'this week'
    }
  }
  return filter
}

// Tasks abertas do bloco, por data de planejamento. `this week` inclui as
// atrasadas e as em andamento (doing), mesmo sem data.
export function filterTasksForBlock(
  tasks: Task[],
  filter: TasksBlockFilter,
  todayKey: string
): Task[] {
  if (filter.unknownProject) return []
  const weekEnd = endOfWeekKey(todayKey)
  return tasks
    .filter((t) => {
      if (!isOpen(t)) return false
      if (filter.notebookId !== null && t.notebookId !== filter.notebookId) return false
      const plan = planDate(t)
      const late = isOverdue(t, todayKey)
      switch (filter.period) {
        case 'today':
          return !late && plan === todayKey
        case 'overdue':
          return late
        case 'this week':
          return late || t.status === 'doing' || (plan !== null && plan <= weekEnd)
        case 'all':
          return true
      }
    })
    .sort(compareTasks)
}

// Texto legível do bloco (cópia para o clipboard): a lista, não o filtro.
export function renderTasksBlockText(filterText: string, tasks: Task[]): string {
  const lines = [`Tasks — ${filterText.trim() || 'this week'}`]
  if (tasks.length === 0) lines.push('(no tasks)')
  for (const t of tasks) {
    const plan = planDate(t)
    const dates = [
      plan ? formatDueShort(plan) : '',
      t.dueDate && t.dueDate !== plan ? `deadline ${formatDueShort(t.dueDate)}` : '',
    ].filter(Boolean)
    const group = t.group ? `${t.group} | ` : ''
    lines.push(`- [ ] ${group}${t.title}${dates.length ? ` (${dates.join(', ')})` : ''}`)
  }
  return lines.join('\n')
}

// ─── Recorrência ────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((parseKey(toKey).getTime() - parseKey(fromKey).getTime()) / DAY_MS)
}

function lastDayOfMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate()
}

// Dia do mês que a regra mensal segue a partir de `anchorKey`. Se a âncora foi
// limitada ao fim de um mês curto (31 → 28), volta ao dia original guardado em
// `rec.day`; senão vale o dia da âncora (a data pode ter sido editada).
function monthlyDay(rec: TaskRecurrence, anchorKey: string): number {
  const d = parseKey(anchorKey)
  const day = d.getDate()
  const clamped = day === lastDayOfMonth(d.getFullYear(), d.getMonth())
  return rec.freq === 'monthly' && rec.day && rec.day > day && clamped ? rec.day : day
}

// Primeira data após `fromKey` segundo a regra (mensal: dia `monthDay` do mês
// seguinte, limitado ao último dia do mês).
function stepOccurrence(rec: TaskRecurrence, fromKey: string, monthDay: number): string {
  if (rec.freq === 'daily') return addDaysKey(fromKey, 1)
  if (rec.freq === 'weekly') {
    const day = parseKey(fromKey).getDay()
    for (let i = 1; i <= 7; i++) {
      if (rec.days.includes((day + i) % 7)) return addDaysKey(fromKey, i)
    }
    return addDaysKey(fromKey, 7)
  }
  const d = parseKey(fromKey)
  const nd = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  nd.setDate(Math.min(monthDay, lastDayOfMonth(nd.getFullYear(), nd.getMonth())))
  return toDateKey(nd.getFullYear(), nd.getMonth(), nd.getDate())
}

// Próxima ocorrência depois da âncora; nunca no passado (avança até hoje).
export function nextOccurrenceDate(rec: TaskRecurrence, anchorKey: string, todayKey: string): string {
  const monthDay = monthlyDay(rec, anchorKey)
  let next = stepOccurrence(rec, anchorKey, monthDay)
  while (next < todayKey) next = stepOccurrence(rec, next, monthDay)
  return next
}

// Próxima ocorrência de uma task recorrente concluída: mesmo título, projeto,
// group, important e regra; nasce em To do, sem nota-corpo. Mantém o formato
// das datas da original (só do date, só deadline, ou ambos com o mesmo
// intervalo entre eles).
export function buildNextOccurrence(
  task: Task,
  id: string,
  sortOrder: number,
  todayKey: string,
  now: number
): Task {
  const rec = task.recurrence!
  const anchor = planDate(task) ?? todayKey
  const next = nextOccurrenceDate(rec, anchor, todayKey)
  let scheduledDate: string | null = next
  let dueDate: string | null = null
  if (task.scheduledDate === null && task.dueDate !== null) {
    scheduledDate = null
    dueDate = next
  } else if (task.scheduledDate !== null && task.dueDate !== null) {
    dueDate = addDaysKey(next, daysBetween(task.scheduledDate, task.dueDate))
  }
  return {
    id,
    title: task.title,
    status: 'todo',
    notebookId: task.notebookId,
    noteId: null,
    dueDate,
    scheduledDate,
    group: task.group,
    important: task.important,
    recurrence: rec.freq === 'monthly' ? { freq: 'monthly', day: monthlyDay(rec, anchor) } : rec,
    recurrenceNextId: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    sourceNoteId: null,
    rescheduleCount: 0,
    sortOrder,
  }
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// "daily" | "weekly (Mon, Thu)" | "monthly"
export function describeRecurrence(rec: TaskRecurrence): string {
  if (rec.freq !== 'weekly') return rec.freq
  return `weekly (${rec.days.map((d) => WEEKDAY_SHORT[d]).join(', ')})`
}

// ─── Checklist da nota-corpo ────────────────────────────────────────────────

const CHECKLIST_RE = /^\s*- \[([ xX])\]/

export interface ChecklistProgress {
  done: number
  total: number
}

// Itens marcados/total do checklist (inclusive aninhados); sem itens → null.
export function checklistProgress(markdown: string): ChecklistProgress | null {
  let done = 0
  let total = 0
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(CHECKLIST_RE)
    if (!m) continue
    total++
    if (m[1] !== ' ') done++
  }
  return total === 0 ? null : { done, total }
}

// ─── Tool "Tasks" do chat ───────────────────────────────────────────────────

export type TasksQueryPeriod = 'overdue' | 'today' | 'this_week' | 'next_week' | 'open' | 'done_this_week'

export interface TasksQuery {
  period?: TasksQueryPeriod
  project?: string
  status?: TaskStatus
}

const QUERY_LIMIT = 100

function inRange(key: string | null, from: string, to: string): boolean {
  return key !== null && key >= from && key <= to
}

// Tasks que respondem à consulta da tool, em texto (uma por linha). Sem
// período nem status: as abertas.
export function queryTasksText(
  tasks: Task[],
  notebooks: Notebook[],
  q: TasksQuery,
  todayKey: string,
  checklist?: Map<string, ChecklistProgress>
): string {
  let notebookId: string | null = null
  if (q.project) {
    const nb = findProjectByTag(notebooks, q.project.replace(/^#/, '').replace(/\s+/g, ''))
    if (!nb) return `No project named "${q.project}".`
    notebookId = nb.id
  }
  const weekEnd = endOfWeekKey(todayKey)
  const nextStart = addDaysKey(weekEnd, 1)
  const nextEnd = addDaysKey(weekEnd, 7)
  const matches = tasks
    .filter((t) => {
      if (notebookId !== null && t.notebookId !== notebookId) return false
      if (q.status && t.status !== q.status) return false
      const plan = planDate(t)
      switch (q.period) {
        case 'overdue':
          return isOverdue(t, todayKey)
        case 'today':
          return isOpen(t) && (plan === todayKey || t.dueDate === todayKey)
        case 'this_week':
          return (
            isOpen(t) &&
            (isOverdue(t, todayKey) || inRange(plan, todayKey, weekEnd) || inRange(t.dueDate, todayKey, weekEnd))
          )
        case 'next_week':
          return isOpen(t) && (inRange(plan, nextStart, nextEnd) || inRange(t.dueDate, nextStart, nextEnd))
        case 'done_this_week':
          return summaryMatches('doneWeek', t, todayKey)
        case 'open':
          return isOpen(t)
        default:
          return q.status ? true : isOpen(t)
      }
    })
    .sort(compareTasks)
  if (matches.length === 0) return 'No tasks match.'
  const names = new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed']))
  const lines = matches
    .slice(0, QUERY_LIMIT)
    .map((t) =>
      taskLineForAi(t, todayKey, names.get(t.notebookId) ?? 'unnamed', checklist?.get(t.id) ?? null)
    )
  if (matches.length > QUERY_LIMIT) lines.push(`(${matches.length - QUERY_LIMIT} more not shown)`)
  return lines.join('\n')
}

// Uma task em uma linha para os chats (tool `query_tasks` e contexto do chat
// das Anotações): status, título, projeto/group e os metadados.
export function taskLineForAi(
  t: Task,
  todayKey: string,
  projectName: string | null,
  checklist: ChecklistProgress | null
): string {
  const where = [projectName, t.group].filter(Boolean).join(' / ')
  const late = overdueKind(t, todayKey)
  const meta = [
    t.scheduledDate ? `do ${t.scheduledDate}` : '',
    t.dueDate ? `deadline ${t.dueDate}` : '',
    late === 'deadline' ? 'deadline missed' : late === 'plan' ? 'do date passed' : '',
    t.rescheduleCount > 0 ? `postponed ${t.rescheduleCount}x` : '',
    t.important ? 'important' : '',
    t.recurrence ? `repeats ${describeRecurrence(t.recurrence)}` : '',
    checklist ? `checklist ${checklist.done}/${checklist.total}` : '',
  ].filter(Boolean)
  return `- [${t.status}] ${t.title}${where ? ` — ${where}` : ''}${meta.length ? ` · ${meta.join(' · ')}` : ''}`
}
