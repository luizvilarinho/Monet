import { nanoid } from 'nanoid'
import type { Book, MetadataDef, Note, Notebook, NoteType } from '../types'
import { noteDateFields, withWeekday } from './agenda'
import { CALENDAR_NOTEBOOK_ID } from './calendar'
import { MAX_LIST_PROPERTIES, TODOS_TYPE_ID, typeDefs } from './noteTypes'
import {
  BOOK_NAMES,
  CAPACITY_NAMES,
  daysBetweenKeys,
  END_NAMES,
  nameKey,
  parseHours,
  parsePlanChecklist,
  planProgress,
  START_NAMES,
  type PlanChecklist,
  type PlanItem,
  type PlanProgress,
} from './plan'
import { isTaskBodyNote, normalizeName } from './tasks'

// Notas de plano: qual tipo é de plano, valores da nota, coleta com o
// progresso do checklist, texto para a IA e o acréscimo idempotente de tipo e
// propriedades no "Save as Plan note". Módulo puro (sem storage).
//
// Tipo de plano = tipo de nota (fora o TODOS) com 2+ propriedades `date`. Na
// leitura, a nota conta como plano se o tipo tem nome de plano ou se o
// checklist segue o contrato (data no início do item ou "Dia N"); na gravação,
// só um tipo com nome de plano. Nomes genéricos ("Schedule", "Cronograma",
// "Planning") são ambíguos (podem ser de eventos): contam como os tipos sem
// nome de plano.

export const PLAN_TYPE_NAMES = ['plan', 'plans', 'plano', 'planos', 'study plan', 'plano de estudo',
  'plano de estudos', 'plano de leitura', 'reading plan']
// Datas com nome em PT: Capacidade e Livro seguem o idioma do tipo.
const PT_DATE_NAMES = ['inicio', 'comeco', 'fim', 'termino', 'prazo']
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── Tipo de plano ──────────────────────────────────────────────────────────

export function isPlanType(typeId: string | null | undefined, defs: MetadataDef[]): boolean {
  return !!typeId && typeId !== TODOS_TYPE_ID && typeDefs(defs, typeId).filter((d) => d.type === 'date').length >= 2
}

export function isPlanTypeName(name: string): boolean {
  return PLAN_TYPE_NAMES.includes(nameKey(name))
}

export interface PlanDefs {
  start: MetadataDef
  end: MetadataDef
  capacity: MetadataDef | null
  book: MetadataDef | null
}

// Início e fim pelo nome (aliases); sem casamento, a 1ª e a última `date` por
// sortOrder. Capacidade e livro = 1ª def com nome de alias (qualquer tipo de
// dado). null = o tipo não é de plano.
export function planDefs(defs: MetadataDef[], typeId: string | null | undefined): PlanDefs | null {
  if (!isPlanType(typeId, defs)) return null
  const all = typeDefs(defs, typeId)
  const dates = all.filter((d) => d.type === 'date')
  const named = (names: string[], except?: MetadataDef) =>
    dates.find((d) => d !== except && names.includes(nameKey(d.name)))
  let start = named(START_NAMES)
  let end = named(END_NAMES, start)
  if (!start) start = dates.find((d) => d !== end)!
  if (!end) end = [...dates].reverse().find((d) => d !== start)!
  const alias = (names: string[]) => all.find((d) => names.includes(nameKey(d.name))) ?? null
  return { start, end, capacity: alias(CAPACITY_NAMES), book: alias(BOOK_NAMES) }
}

// ─── Valores da nota ────────────────────────────────────────────────────────

export interface NotePlanInfo {
  start: string | null // a def de início (por nome); sem nome, a menor data das propriedades (com 2+ datas)
  end: string | null // a def de fim (por nome); sem nome, a maior
  capacity: number | null
  capacityDefName: string | null // null = o tipo não tem propriedade de capacidade
  book: string | null
  bookDefName: string | null // null = o tipo não tem propriedade de livro
}

export function notePlanInfo(note: Note, defs: MetadataDef[]): NotePlanInfo {
  const dates = noteDateFields(note, defs)
    .filter((f) => f.kind === 'property')
    .map((f) => f.date)
    .sort()
  const pd = planDefs(defs, note.typeId)
  const bookValue = pd?.book ? note.properties?.[pd.book.id] : undefined
  // Def com nome de início/fim (uma 3ª data, ex. "Revisão", não conta); sem
  // nome, a menor e a maior data preenchidas.
  const named = (d: MetadataDef | undefined, names: string[]) => (d && names.includes(nameKey(d.name)) ? d : null)
  const startDef = named(pd?.start, START_NAMES)
  const endDef = named(pd?.end, END_NAMES)
  const value = (d: MetadataDef) => {
    const v = note.properties?.[d.id]
    return typeof v === 'string' && ISO_DATE_RE.test(v) ? v : null
  }
  return {
    start: startDef ? value(startDef) : dates.length >= 2 ? dates[0] : null,
    end: endDef ? value(endDef) : dates.length >= 2 ? dates[dates.length - 1] : null,
    capacity: pd?.capacity ? parseHours(note.properties?.[pd.capacity.id]) : null,
    capacityDefName: pd?.capacity?.name ?? null,
    book: typeof bookValue === 'string' && bookValue.trim() ? bookValue.trim() : null,
    bookDefName: pd?.book?.name ?? null,
  }
}

// ─── Coleta ─────────────────────────────────────────────────────────────────

export type PlanState = 'active' | 'overdue' | 'upcoming' | 'finished' | 'undated'

export interface PlanEntry {
  note: Note
  info: NotePlanInfo
  checklist: PlanChecklist | null
  progress: PlanProgress | null
  state: PlanState
}

export function collectPlans(input: {
  notes: Note[]
  defs: MetadataDef[]
  types: NoteType[]
  todayKey: string
  disabledNotebookIds: Set<string>
  notebookId?: string
}): PlanEntry[] {
  const { defs, todayKey: today } = input
  const namedPlanTypes = new Set(input.types.filter((t) => isPlanTypeName(t.name)).map((t) => t.id))
  const out: PlanEntry[] = []
  for (const note of input.notes) {
    if (!note.notebookId || note.notebookId === CALENDAR_NOTEBOOK_ID) continue
    if (isTaskBodyNote(note) || note.archivedAt) continue
    if (input.disabledNotebookIds.has(note.notebookId)) continue
    if (input.notebookId && note.notebookId !== input.notebookId) continue
    if (!isPlanType(note.typeId, defs)) continue
    const info = notePlanInfo(note, defs)
    const checklist = parsePlanChecklist(note.content, info.start, info.end, today)
    // Tipo sem nome de plano: só com item no formato do contrato (data ou "Dia N").
    if (!namedPlanTypes.has(note.typeId!) && (!checklist || checklist.rule === 'none')) continue
    const progress = checklist ? planProgress(checklist, info.start, info.end, today) : null
    // Sem End = sem prazo (undated); só com End, o plano conta como iniciado.
    let state: PlanState
    if (!info.end) state = 'undated'
    else if (info.start && today < info.start) state = 'upcoming'
    else if (today <= info.end) state = 'active'
    else state = progress && progress.done < progress.total ? 'overdue' : 'finished'
    out.push({ note, info, checklist, progress, state })
  }
  // Vencidos, depois ativos atrasados (maior atraso primeiro), depois por fim.
  const rank = (e: PlanEntry) =>
    e.state === 'overdue' ? 0 : e.state === 'active' && e.progress?.status === 'behind' ? 1 : 2
  return out.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 1 ? b.progress!.lateDays - a.progress!.lateDays : 0) ||
      (a.info.end ?? '9999').localeCompare(b.info.end ?? '9999')
  )
}

// ─── Livro do Reader ────────────────────────────────────────────────────────

export function bookKey(s: string): string {
  return normalizeName(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

// Igualdade de chave; senão, um único livro em que uma chave contém a outra
// (a menor com 6+ caracteres); senão null.
export function matchBook<T extends { title: string }>(title: string, books: T[]): T | null {
  const key = bookKey(title)
  if (!key) return null
  const exact = books.find((b) => bookKey(b.title) === key)
  if (exact) return exact
  const partial = books.filter((b) => {
    const k = bookKey(b.title)
    const [small, big] = k.length < key.length ? [k, key] : [key, k]
    return small.length >= 6 && big.includes(small)
  })
  return partial.length === 1 ? partial[0] : null
}

// ─── Texto para a IA ────────────────────────────────────────────────────────

export interface ReaderBookInfo {
  book: Book
  maxHighlightPage: number | null
}

const ITEM_MAX = 80
const OVERDUE_MAX = 5
const ITEMS_DATED_MAX = 14

const byDate = (a: PlanItem, b: PlanItem) => (a.date ?? '').localeCompare(b.date ?? '')

function itemText(it: PlanItem): string {
  const head = it.label ? `${it.label} (${it.date})` : `${it.date}`
  const line = it.text ? `${head}: ${it.text}` : head
  return line.length > ITEM_MAX ? `${line.slice(0, ITEM_MAX - 1)}…` : line
}

// "furthest highlight p. <n> of <N>, last opened p. <n>" (EPUB: locations).
function bookSignal({ book, maxHighlightPage }: ReaderBookInfo): string {
  const epub = book.format === 'epub'
  const unit = epub ? 'location' : 'p.'
  const total = epub ? `${book.totalPages} locations (EPUB, not pages)` : `${book.totalPages} pages`
  const furthest =
    maxHighlightPage !== null
      ? `furthest highlight ${unit} ${maxHighlightPage} of ${epub ? total : book.totalPages}`
      : `no highlights (${total})`
  return `${furthest}, last opened ${unit} ${book.lastPage}`
}

function progressLine(p: PlanProgress, info: NotePlanInfo, today: string): string {
  let line = `Items: ${p.done}/${p.total} done`
  if (p.expected !== null) line += ` · expected by end of today: ${p.expected}`
  const diff = p.diffItems ?? 0
  switch (p.status) {
    case 'done':
      return `${line} · all done`
    case 'noDates':
      return `${line} · no dates`
    case 'overdue':
      return `${line} · End passed ${daysBetweenKeys(info.end!, today)} days ago with ${p.total - p.done} open items`
    case 'notStarted':
      return `${line} · not started yet`
    case 'behind':
      return (
        line +
        (diff < 0 ? ` · behind by ${-diff} items` : '') +
        ` · oldest open item due ${p.overdueOpen[0].date} (${p.lateDays} days late)`
      )
    case 'ahead':
      return `${line} · ${diff} items ahead (${p.aheadDays} day${p.aheadDays === 1 ? '' : 's'})`
    default:
      return `${line} · on track`
  }
}

export function formatPlanForAi(
  e: PlanEntry,
  books: ReaderBookInfo[],
  notebookName: string | null,
  todayKey: string
): string {
  const { info, checklist, progress: p } = e
  const title = e.note.title.trim() || 'Untitled'
  const head = `[Plan "${title}"${notebookName ? ` — ${notebookName}` : ''}]`
  const range = `Start ${info.start ? withWeekday(info.start) : 'not set'} → End ${info.end ? withWeekday(info.end) : 'not set'}`
  if (!checklist || !p) return `${head} ${range} · no checklist: no metric (progress cannot be measured).`

  const out = [head, `${range} · state: ${e.state}`]
  if (!info.capacityDefName) {
    out.push('Capacity: not set — the type has no capacity property (it is added when a plan is saved from the Planner).')
  } else if (info.capacity !== null) {
    out.push(`Capacity: ${info.capacity}h/day.`)
  } else {
    out.push(`Capacity: empty — the property "${info.capacityDefName}" exists but has no value.`)
  }
  if (!info.book) {
    out.push('Book: not set.')
  } else {
    const match = matchBook(info.book, books.map((b) => b.book))
    const reader = match && books.find((b) => b.book.id === match.id)
    if (!reader) {
      out.push(`Book: "${info.book}" — no Reader book with this title.`)
    } else {
      let line = `Book: "${info.book}" — Reader: ${bookSignal(reader)} (auxiliary, not progress).`
      if (p.expectedPage !== null) line += ` Expected by today: around p. ${p.expectedPage}.`
      out.push(line)
    }
  }
  out.push(progressLine(p, info, todayKey))
  checklist.warnings.forEach((w, i) => out.push(`${i === 0 && checklist.rule !== 'dated' ? 'Assumption' : 'Note'}: ${w}`))
  if (p.overdueOpen.length > 0) {
    const shown = p.overdueOpen.slice(0, OVERDUE_MAX).map(itemText).join('; ')
    const more = p.overdueOpen.length - OVERDUE_MAX
    out.push(`Overdue open: ${shown}${more > 0 ? `; +${more} more` : ''}`)
  }
  if (p.dueToday.length > 0) out.push(`Today: ${p.dueToday.map(itemText).join('; ')}`)
  if (p.next.length > 0) out.push(`Next: ${p.next.map(itemText).join('; ')}`)
  if (p.daysLeft !== null && p.daysLeft > 0 && p.neededPerDay !== null) {
    out.push(
      `Remaining: ${p.openDated} open dated items, ${p.daysLeft} days left including today → ` +
        `${p.neededPerDay.toFixed(1)} items/day needed` +
        (p.planPace !== null ? ` (plan pace ${p.planPace.toFixed(1)}/day).` : '.') +
        (p.openUndated > 0 ? ` Plus ${p.openUndated} open undated item(s).` : '')
    )
  }
  return out.join('\n')
}

// "Items dated <dias>: …": os itens do plano nesses dias, feitos e abertos.
function itemsDatedLine(c: PlanChecklist | null, days: { from: string; to: string }): string {
  const range = days.from === days.to ? withWeekday(days.from) : `${withWeekday(days.from)} to ${withWeekday(days.to)}`
  const items = (c?.items ?? [])
    .filter((i) => i.date !== null && i.date >= days.from && i.date <= days.to)
    .sort(byDate)
  const shown = items.slice(0, ITEMS_DATED_MAX).map((i) => `${itemText(i)} [${i.done ? 'done' : 'open'}]`)
  const more = items.length - ITEMS_DATED_MAX
  return `Items dated ${range}: ${shown.length > 0 ? shown.join('; ') : 'none'}${more > 0 ? `; +${more} more` : ''}`
}

// Resumo de cada nota de plano entre `notes` (as notas datadas da agenda do
// plan-week, /today e /week-review), por id da nota: o mesmo texto do coach,
// mais os itens de `planDays` (o dia da nota do /today, os dias do plan-week).
// A agenda não importa este módulo (que já importa a agenda): quem chama passa
// o mapa.
export function agendaPlanSummaries(input: {
  notes: Note[]
  defs: MetadataDef[]
  types: NoteType[]
  notebooks: Notebook[]
  books: ReaderBookInfo[]
  todayKey: string
  disabledNotebookIds: Set<string>
  planDays?: { from: string; to: string }
}): Map<string, string> {
  const notebookName = new Map(input.notebooks.map((nb) => [nb.id, nb.name]))
  return new Map(
    collectPlans(input).map((e) => {
      const text = formatPlanForAi(e, input.books, notebookName.get(e.note.notebookId ?? '') ?? null, input.todayKey)
      return [e.note.id, input.planDays ? `${text}\n${itemsDatedLine(e.checklist, input.planDays)}` : text]
    })
  )
}

// ─── Gravação ("Save as Plan note") ─────────────────────────────────────────

export interface PlanSavePlan {
  type: NoteType
  newType: boolean
  newDefs: MetadataDef[] // só o que falta; nada existente muda
  startDefId: string
  endDefId: string
  capacityDef: MetadataDef
  bookDef: MetadataDef
}

// Tipo alvo: o 1º tipo de plano com nome de plano; senão um tipo "Plan" sem o
// par de datas (ganha as datas); senão um tipo "Plan" novo. Acrescenta só as
// propriedades que faltam por alias: idempotente (a 2ª chamada não cria nada).
export function planSaveChanges(types: NoteType[], defs: MetadataDef[]): PlanSavePlan {
  const now = Date.now()
  const sorted = [...types].sort((a, b) => a.sortOrder - b.sortOrder)
  const existing =
    sorted.find((t) => isPlanType(t.id, defs) && PLAN_TYPE_NAMES.includes(nameKey(t.name))) ??
    sorted.find((t) => t.id !== TODOS_TYPE_ID && nameKey(t.name) === 'plan')
  const type: NoteType = existing ?? {
    id: `nt_${nanoid(8)}`,
    name: 'Plan',
    icon: 'list-checks',
    color: null,
    template: null,
    sortOrder: types.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1,
    builtin: false,
    createdAt: now,
    board: null,
  }

  const own = typeDefs(defs, type.id)
  const newDefs: MetadataDef[] = []
  let order = own.reduce((m, d) => Math.max(m, d.sortOrder), 0)
  let listed = own.filter((d) => d.showInList).length
  const add = (name: string, kind: MetadataDef['type'], showInList: boolean) => {
    const show = showInList && listed < MAX_LIST_PROPERTIES
    if (show) listed++
    const def: MetadataDef = {
      id: `md_${nanoid(8)}`,
      name,
      type: kind,
      sortOrder: ++order,
      createdAt: now,
      scope: 'note',
      noteTypeId: type.id,
      options: null,
      showInList: show,
    }
    newDefs.push(def)
    return def
  }

  const current = planDefs(defs, type.id)
  let pt = false
  if (current) {
    pt = [current.start, current.end].some((d) => PT_DATE_NAMES.includes(nameKey(d.name)))
  } else {
    add('Start', 'date', true)
    add('End', 'date', true)
  }
  if (!current?.capacity) add(pt ? 'Capacidade' : 'Capacity', 'number', false)
  if (!current?.book) add(pt ? 'Livro' : 'Book', 'text', false)

  const final = planDefs([...defs, ...newDefs], type.id)!
  return {
    type,
    newType: !existing,
    newDefs,
    startDefId: final.start.id,
    endDefId: final.end.id,
    capacityDef: final.capacity!,
    bookDef: final.book!,
  }
}
