import type { MetadataDef, Note, Notebook, Task, TaskStatusDef } from '../types'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs, getWeekdayName, parseCalendarTitle, toDateKey } from './calendar'
import { isTodosNote, typeDefs } from './noteTypes'
import {
  compareTasks,
  isDone,
  isInProgress,
  isOpen,
  isOverdue,
  isTaskBodyNote,
  taskLineForAi,
  todosProgressByNote,
  type ChecklistProgress,
  type TodosProgress,
} from './tasks'

// Agenda para a IA: datas de uma nota num período (tool do chat e slash
// commands) e o contexto comum do /week-review e do /today. Funções puras: quem
// chama passa notas, tasks e defs.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── Datas de uma nota ──────────────────────────────────────────────────────

// 'date' = campo date da nota; 'calendar' = título da nota diária;
// 'property' = propriedade de data do tipo atual da nota.
export type NoteDateKind = 'date' | 'calendar' | 'property'

export interface NoteDateField {
  kind: NoteDateKind
  name: string
  // YYYY-MM-DD
  date: string
}

export interface NoteDateMatch {
  matched: NoteDateField[]
  other: NoteDateField[]
  ongoing: boolean
}

// Todas as datas da nota. Propriedades guardadas de outro tipo não contam.
export function noteDateFields(note: Note, defs: MetadataDef[]): NoteDateField[] {
  const out: NoteDateField[] = []
  if (note.date && ISO_DATE_RE.test(note.date)) out.push({ kind: 'date', name: 'Date', date: note.date })
  if (note.notebookId === CALENDAR_NOTEBOOK_ID) {
    const day = parseCalendarTitle(note.title)
    if (day) {
      out.push({
        kind: 'calendar',
        name: 'Daily note',
        date: toDateKey(day.getFullYear(), day.getMonth(), day.getDate()),
      })
    }
  }
  for (const def of typeDefs(defs, note.typeId)) {
    if (def.type !== 'date') continue
    const value = note.properties?.[def.id]
    if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
      out.push({ kind: 'property', name: def.name, date: value })
    }
  }
  return out
}

function byDate(a: NoteDateField, b: NoteDateField): number {
  return a.date.localeCompare(b.date)
}

// Datas da nota no período (inclusivo), por data. Sem nenhuma dentro, a nota
// está "em andamento" (ongoing) só se não está arquivada e tem 2+ propriedades
// de data, a menor antes do período e a maior depois (o `date` e o título do
// Calendar não contam: TODOS com uma Entrega não viram ruído toda semana).
export function matchNoteDates(
  note: Note,
  defs: MetadataDef[],
  from: string,
  to: string
): NoteDateMatch | null {
  const fields = noteDateFields(note, defs)
  const matched = fields.filter((f) => f.date >= from && f.date <= to).sort(byDate)
  if (matched.length > 0) {
    return { matched, other: fields.filter((f) => !matched.includes(f)).sort(byDate), ongoing: false }
  }
  if (note.archivedAt) return null
  const props = fields.filter((f) => f.kind === 'property').sort(byDate)
  if (props.length >= 2 && props[0].date < from && props[props.length - 1].date > to) {
    return { matched: [], other: props, ongoing: true }
  }
  return null
}

// '2026-11-06' → '2026-11-06 (Friday)'
export function withWeekday(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${key} (${getWeekdayName(new Date(y, m - 1, d))})`
}

// Campo(s) que casaram, para o cabeçalho da nota na IA:
// 'Entrega: 2026-11-06 (Friday) (also: Date 2026-10-25)' ou
// 'ongoing: Início 2026-10-25 (Saturday) → Fim 2026-11-17 (Monday)'.
export function formatNoteDateMatch(m: NoteDateMatch): string {
  if (m.ongoing) {
    const first = m.other[0]
    const last = m.other[m.other.length - 1]
    return `ongoing: ${first.name} ${withWeekday(first.date)} → ${last.name} ${withWeekday(last.date)}`
  }
  const main = m.matched.map((f) => `${f.name}: ${withWeekday(f.date)}`).join(' · ')
  if (m.other.length === 0) return main
  return `${main} (also: ${m.other.map((f) => `${f.name} ${f.date}`).join(', ')})`
}

// ─── Contexto do /week-review e do /today ───────────────────────────────────

// usado pelo plan-week (fase 2)
export const PLANNER_DEFAULT_HOURS_PER_DAY = 6

// Orçamentos de texto (caracteres) por bloco; cada nota leva uma parte do
// orçamento do bloco, no mínimo AGENDA_MIN_SHARE.
const AGENDA_TASKS_BUDGET = 12000
const AGENDA_TODOS_BUDGET = 8000
const AGENDA_DATED_BUDGET = 16000
const AGENDA_DAILY_BUDGET = 8000
const AGENDA_MIN_SHARE = 1500

export interface AgendaInput {
  from: string
  to: string
  today: string
  // Período das tasks concluídas; null = sem esse bloco (/today num dia futuro).
  done: { from: string; to: string } | null
  tasks: Task[]
  notes: Note[]
  notebooks: Notebook[]
  defs: MetadataDef[]
  statuses: TaskStatusDef[]
  checklist: Map<string, ChecklistProgress>
  disabledNotebookIds: Set<string>
}

export interface AgendaSelection {
  doneTasks: Task[]
  openTasks: Task[]
  todos: Array<{ note: Note; match: NoteDateMatch | null; progress: TodosProgress | undefined; tasks: Task[] }>
  datedNotes: Array<{ note: Note; match: NoteDateMatch }>
  dailyNotes: Array<{ note: Note; date: string }>
}

function inRange(key: string | null, from: string, to: string): boolean {
  return key !== null && key >= from && key <= to
}

// Nota que a IA pode ler: não arquivada e fora de caderno com a IA desligada.
function isVisibleNote(note: Note, disabled: Set<string>): boolean {
  return !note.archivedAt && (!note.notebookId || !disabled.has(note.notebookId))
}

// Não-ongoing pela 1ª data casada; ongoing por último.
function compareMatches(a: NoteDateMatch, b: NoteDateMatch): number {
  if (a.ongoing !== b.ongoing) return a.ongoing ? 1 : -1
  return (a.matched[0]?.date ?? '').localeCompare(b.matched[0]?.date ?? '')
}

// O que entra na agenda do período. As tasks de uma TODOS listada aparecem só
// sob ela (todas as abertas + as concluídas no período).
export function selectAgenda(input: AgendaInput): AgendaSelection {
  const { from, to, today, done, notes, defs, disabledNotebookIds: disabled } = input
  const tasks = input.tasks.filter((t) => !disabled.has(t.notebookId))
  const doneTasks = done
    ? tasks.filter(
        (t) => isDone(t) && t.completedAt !== null && inRange(dateKeyFromMs(t.completedAt), done.from, done.to)
      )
    : []
  const openTasks = tasks
    .filter(
      (t) =>
        isOpen(t) &&
        (isOverdue(t, today) ||
          isInProgress(t) ||
          inRange(t.scheduledDate, from, to) ||
          inRange(t.dueDate, from, to) ||
          inRange(t.plannedDay, from, to))
    )
    .sort(compareTasks)

  const progressByNote = todosProgressByNote(tasks, today)
  const withListedTasks = new Set(
    [...openTasks, ...doneTasks].map((t) => t.parentNoteId).filter((id): id is string => !!id)
  )
  const doneIds = new Set(doneTasks.map((t) => t.id))
  const todos: AgendaSelection['todos'] = []
  for (const note of notes) {
    if (!isTodosNote(note) || !isVisibleNote(note, disabled)) continue
    const match = matchNoteDates(note, defs, from, to)
    if (!match && !withListedTasks.has(note.id)) continue
    const own = tasks.filter((t) => t.parentNoteId === note.id)
    todos.push({
      note,
      match,
      progress: progressByNote.get(note.id),
      tasks: [...own.filter(isOpen).sort(compareTasks), ...own.filter((t) => doneIds.has(t.id))],
    })
  }
  // Pela data que casou; sem data no período, pelo próximo deadline.
  const todosKey = (e: AgendaSelection['todos'][number]) =>
    (e.match && !e.match.ongoing ? e.match.matched[0].date : null) ?? e.progress?.nextDeadline ?? '9999-12-31'
  todos.sort((a, b) => todosKey(a).localeCompare(todosKey(b)))
  const underTodos = new Set(todos.flatMap((e) => e.tasks.map((t) => t.id)))

  const datedNotes: AgendaSelection['datedNotes'] = []
  for (const note of notes) {
    if (note.notebookId === CALENDAR_NOTEBOOK_ID || isTaskBodyNote(note) || isTodosNote(note)) continue
    if (!isVisibleNote(note, disabled)) continue
    const match = matchNoteDates(note, defs, from, to)
    if (match) datedNotes.push({ note, match })
  }
  datedNotes.sort((a, b) => compareMatches(a.match, b.match))

  const dailyNotes: AgendaSelection['dailyNotes'] = []
  if (!disabled.has(CALENDAR_NOTEBOOK_ID)) {
    for (const note of notes) {
      if (note.notebookId !== CALENDAR_NOTEBOOK_ID || note.archivedAt || !note.content.trim()) continue
      const day = parseCalendarTitle(note.title)
      if (!day) continue
      const date = toDateKey(day.getFullYear(), day.getMonth(), day.getDate())
      if (inRange(date, from, to)) dailyNotes.push({ note, date })
    }
    dailyNotes.sort((a, b) => a.date.localeCompare(b.date))
  }

  return {
    doneTasks: doneTasks.filter((t) => !underTodos.has(t.id)),
    openTasks: openTasks.filter((t) => !underTodos.has(t.id)),
    todos,
    datedNotes,
    dailyNotes,
  }
}

// Conteúdos das notas da agenda (para carregar embeds e OCR antes de formatar).
export function agendaContents(sel: AgendaSelection): string[] {
  return [
    ...sel.todos.map((e) => e.note.content),
    ...sel.datedNotes.map((e) => e.note.content),
    ...sel.dailyNotes.map((e) => e.note.content),
  ]
}

function truncate(body: string, cap: number): string {
  return body.length > cap ? `${body.slice(0, cap)} [truncated]` : body
}

function omittedLine(n: number): string {
  return `(${n} more omitted: content budget reached)`
}

// Agenda em texto para a IA. Seções sempre presentes (vazia = "(none)").
export function formatAgendaContext(
  sel: AgendaSelection,
  input: AgendaInput,
  toAiText: (content: string) => string
): string {
  const { today, defs, disabledNotebookIds: disabled } = input
  const names = new Map(input.notebooks.map((nb) => [nb.id, nb.name || 'unnamed']))
  const noteById = new Map(input.notes.map((n) => [n.id, n]))
  const notebookName = (id: string | null) => (id ? names.get(id) ?? 'unnamed' : null)

  const taskLine = (t: Task) => {
    const todos = t.parentNoteId ? noteById.get(t.parentNoteId) : undefined
    const todosVisible = todos && (!todos.notebookId || !disabled.has(todos.notebookId)) ? todos : undefined
    const line = taskLineForAi(
      t,
      today,
      notebookName(t.notebookId),
      input.checklist.get(t.id) ?? null,
      input.statuses,
      todosVisible ? todosVisible.title : null,
      !!todosVisible?.archivedAt,
      { from: input.from, to: input.to }
    )
    return isDone(t) && t.completedAt !== null ? `${line} · completed ${dateKeyFromMs(t.completedAt)}` : line
  }

  // Tasks: um orçamento para concluídas e abertas; estourou, para a lista.
  let tasksLeft = AGENDA_TASKS_BUDGET
  const taskSection = (title: string, list: Task[]) => {
    const lines: string[] = []
    for (let i = 0; i < list.length; i++) {
      const line = taskLine(list[i])
      if (line.length > tasksLeft) {
        lines.push(omittedLine(list.length - i))
        break
      }
      tasksLeft -= line.length
      lines.push(line)
    }
    return `${title}\n${lines.length > 0 ? lines.join('\n') : '(none)'}`
  }

  // Blocos de notas: cada nota leva uma parte do orçamento do bloco.
  const noteSection = <T,>(
    title: string,
    entries: T[],
    budget: number,
    render: (entry: T, cap: number) => string
  ) => {
    const share = Math.max(AGENDA_MIN_SHARE, Math.floor(budget / Math.max(entries.length, 1)))
    const blocks: string[] = []
    let used = 0
    for (let i = 0; i < entries.length; i++) {
      if (used >= budget) {
        blocks.push(omittedLine(entries.length - i))
        break
      }
      const block = render(entries[i], Math.min(share, budget - used))
      used += block.length
      blocks.push(block)
    }
    return `${title}\n${blocks.length > 0 ? blocks.join('\n\n') : '(none)'}`
  }

  const sections: string[] = []
  if (input.done) {
    sections.push(taskSection(`Completed tasks (${input.done.from} → ${input.done.to}):`, sel.doneTasks))
  }
  sections.push(taskSection('Open and overdue tasks:', sel.openTasks))

  sections.push(
    noteSection('TODOS deliverables:', sel.todos, AGENDA_TODOS_BUDGET, ({ note, match, progress, tasks }, cap) => {
      // Sem data no período, as datas da TODOS entram assim mesmo (o prazo
      // de entrega importa para o "falta").
      const dates = match
        ? formatNoteDateMatch(match)
        : noteDateFields(note, defs).map((f) => `${f.name}: ${f.date}`).join(' · ')
      const header = [
        `TODOS "${note.title.trim() || 'Untitled'}" — ${notebookName(note.notebookId) ?? 'No notebook'}`,
        dates,
        progress ? `${progress.done}/${progress.total} tasks done` : '',
        progress?.nextDeadline ? `next deadline ${progress.nextDeadline}` : '',
        progress?.overdue ? 'deadline missed' : '',
      ]
        .filter(Boolean)
        .join(' · ')
      const lines = tasks.map(taskLine)
      const body = truncate(toAiText(note.content).trim(), cap)
      return `[${header}]\nTasks:\n${lines.length > 0 ? lines.join('\n') : '(none)'}\nNote:\n${body || '(empty note)'}`
    })
  )

  sections.push(
    noteSection('Dated notes:', sel.datedNotes, AGENDA_DATED_BUDGET, ({ note, match }, cap) => {
      const folder = notebookName(note.notebookId)
      const header = `${note.title.trim() || 'Untitled'}${folder ? ` — ${folder}` : ''} · ${formatNoteDateMatch(match)}`
      const body = truncate(toAiText(note.content).trim(), cap)
      return `[${header}]\n${body || '(empty note)'}`
    })
  )

  sections.push(
    noteSection('Calendar daily notes:', sel.dailyNotes, AGENDA_DAILY_BUDGET, ({ note, date }, cap) => {
      const body = truncate(toAiText(note.content).trim(), cap)
      return `[${withWeekday(date)}]\n${body || '(empty note)'}`
    })
  )

  return sections.join('\n\n')
}

// usado pelo plan-week (fase 2)
// Último prazo aberto (>= hoje): deadline das tasks abertas e datas das
// propriedades das TODOS com tasks abertas. null = nenhum.
export function lastOpenDeadline(
  input: Pick<AgendaInput, 'tasks' | 'notes' | 'defs' | 'today' | 'disabledNotebookIds'>
): string | null {
  const { today, defs, disabledNotebookIds: disabled } = input
  const open = input.tasks.filter((t) => isOpen(t) && !disabled.has(t.notebookId))
  let last: string | null = null
  const consider = (key: string) => {
    if (key >= today && (last === null || key > last)) last = key
  }
  for (const t of open) if (t.dueDate) consider(t.dueDate)
  const todosWithOpen = new Set(open.map((t) => t.parentNoteId).filter((id): id is string => !!id))
  for (const note of input.notes) {
    if (!todosWithOpen.has(note.id) || !isTodosNote(note) || !isVisibleNote(note, disabled)) continue
    for (const f of noteDateFields(note, defs)) if (f.kind === 'property') consider(f.date)
  }
  return last
}
