import type { Note, Tracker, TrackerMark } from '../types'
import { withWeekday } from './agenda'
import { dateKeyFromMs, toDateKey } from './calendar'
import { canHaveType } from './noteTypes'
import { addDaysKey, normalizeName, startOfWeekKey, TASK_COLOR_PALETTE, weekDayKeys, WEEKDAY_SHORT } from './tasks'

// Trackers de constância: contas de semana e mês (puras, sem storage nem
// Tauri). Chave de dia = YYYY-MM-DD local; a semana vai de segunda a domingo.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const MIN_WEEKLY_TARGET = 1
export const MAX_WEEKLY_TARGET = 7
export const MAX_TRACKER_NAME = 32
export const DEFAULT_TRACKER_ICON = 'target'
// Pontos de tracker por célula da grade do Calendar; acima disso, um "+".
export const MAX_CELL_DOTS = 3

// Cores da rotação automática de um tracker novo: a paleta das tasks sem o cinza
// e sem as duas que coincidem com marcadores da grade do Calendar (o ponto de nota,
// `--accent`, e a barra de task, `--accent-task`). Seguem disponíveis na escolha
// manual.
const GRID_MARKER_COLORS = ['#7b6ed4', '#ef9f27']
const AUTO_COLORS = TASK_COLOR_PALETTE.slice(1).filter((c) => !GRID_MARKER_COLORS.includes(c))

// Cor do próximo tracker, dado quantos já existem (arquivados incluídos).
export function autoTrackerColor(existingCount: number): string {
  return AUTO_COLORS[existingCount % AUTO_COLORS.length]
}

// Um dia feito: marca manual, nota do tipo vinculado, ou as duas (conta uma vez).
export interface TrackerDay {
  manual: boolean
  fromNote: boolean
  // Com `fromNote`: a nota mais recente do dia entre as ativas do tipo (o clique no
  // dia abre essa nota).
  noteId?: string
}
// Só dias <= hoje.
export type TrackerDays = Map<string, TrackerDay>

// Dia da nota: a `date`, senão o dia da criação.
export function noteDayKey(note: Note): string {
  return note.date && ISO_DATE_RE.test(note.date) ? note.date : dateKeyFromMs(note.createdAt)
}

// Nota ativa do tipo (a mesma regra de quem pode ter tipo).
export function isTrackerTypeNote(note: Note, typeId: string): boolean {
  return note.typeId === typeId && !note.archivedAt && canHaveType(note)
}

export function trackerDays(
  tracker: Tracker,
  marks: TrackerMark[],
  notes: Note[],
  todayKey: string
): TrackerDays {
  const days: TrackerDays = new Map()
  for (const m of marks) {
    if (m.trackerId !== tracker.id || !ISO_DATE_RE.test(m.day) || m.day > todayKey) continue
    days.set(m.day, { manual: true, fromNote: false })
  }
  const typeId = tracker.linkedTypeId
  if (typeId) {
    const latest = new Map<string, Note>()
    for (const n of notes) {
      if (!isTrackerTypeNote(n, typeId)) continue
      const day = noteDayKey(n)
      if (day > todayKey) continue
      const current = latest.get(day)
      if (!current || isMoreRecent(n, current)) latest.set(day, n)
    }
    for (const [day, n] of latest) {
      days.set(day, { manual: days.get(day)?.manual ?? false, fromNote: true, noteId: n.id })
    }
  }
  return days
}

// A mais recente: a editada por último; empate, a criada por último.
function isMoreRecent(a: Note, b: Note): boolean {
  return a.updatedAt !== b.updatedAt ? a.updatedAt > b.updatedAt : a.createdAt > b.createdAt
}

// Dias que só contam por causa do tipo vinculado (sem marca manual): os que deixam
// de contar quando o vínculo sai.
export function noteOnlyDayCount(days: TrackerDays): number {
  let n = 0
  for (const day of days.values()) if (day.fromNote && !day.manual) n++
  return n
}

export function buildTrackerDays(
  trackers: Tracker[],
  marks: TrackerMark[],
  notes: Note[],
  todayKey: string
): Map<string, TrackerDays> {
  return new Map(trackers.map((t) => [t.id, trackerDays(t, marks, notes, todayKey)]))
}

// Início do tracker: a criação ou o primeiro dia feito, o que vier antes (um
// dia vindo de nota conta como marca).
export function trackerStartDay(tracker: Tracker, days: TrackerDays): string {
  let start = dateKeyFromMs(tracker.createdAt)
  for (const key of days.keys()) if (key < start) start = key
  return start
}

// Dias feitos em [from, to] (inclusivo).
export function countDone(days: TrackerDays, from: string, to: string): number {
  let n = 0
  for (const key of days.keys()) if (key >= from && key <= to) n++
  return n
}

function monthPrefix(year: number, month0: number): string {
  return toDateKey(year, month0, 1).slice(0, 7)
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

// Segundas-feiras das semanas do mês. A semana pertence ao mês em que cai a
// quinta-feira dela.
export function monthWeekStarts(year: number, month0: number): string[] {
  const prefix = monthPrefix(year, month0)
  const inMonth = (weekStart: string) => addDaysKey(weekStart, 3).startsWith(prefix)
  let start = startOfWeekKey(toDateKey(year, month0, 1))
  if (!inMonth(start)) start = addDaysKey(start, 7)
  const starts: string[] = []
  while (inMonth(start)) {
    starts.push(start)
    start = addDaysKey(start, 7)
  }
  return starts
}

// Semana em foco da faixa, derivada: a do dia selecionado quando ele está no mês
// exibido; senão a de hoje, se hoje está no mês exibido; senão a do último dia
// do mês exibido. Devolve a segunda-feira.
export function focusWeekStart(
  selectedDay: string | null,
  year: number,
  month0: number,
  todayKey: string
): string {
  const prefix = monthPrefix(year, month0)
  if (selectedDay?.startsWith(prefix)) return startOfWeekKey(selectedDay)
  if (todayKey.startsWith(prefix)) return startOfWeekKey(todayKey)
  return startOfWeekKey(toDateKey(year, month0, daysInMonth(year, month0)))
}

// `startBelow`: a semana em que o tracker começa, já terminada abaixo da meta. Só
// entra nas semanas na meta quando bate a meta (a mesma regra da semana atual):
// começar no meio da semana não faz dela uma semana perdida.
export type WeekStatus = 'future' | 'beforeStart' | 'inProgress' | 'onTarget' | 'below' | 'startBelow'

export interface WeekResult {
  start: string
  end: string
  done: number
  target: number
  status: WeekStatus
}

// A meta é a atual do tracker: mudá-la reavalia as semanas passadas.
export function weekResult(
  tracker: Tracker,
  days: TrackerDays,
  weekStart: string,
  todayKey: string
): WeekResult {
  const end = addDaysKey(weekStart, 6)
  const done = countDone(days, weekStart, end)
  const target = tracker.weeklyTarget
  const start = trackerStartDay(tracker, days)
  let status: WeekStatus
  if (weekStart > todayKey) status = 'future'
  else if (end < start) status = 'beforeStart'
  else if (done >= target) status = 'onTarget'
  else if (todayKey <= end) status = 'inProgress'
  else if (start >= weekStart) status = 'startBelow'
  else status = 'below'
  return { start: weekStart, end, done, target, status }
}

export interface MonthStats {
  // Dias feitos dentro do mês (só os dias do mês, mesmo numa semana que o cruza).
  total: number
  weeksOnTarget: number
  // Semanas que bateram a meta mais as terminadas abaixo dela; a semana atual e a
  // semana de início só entram quando já bateram, e as anteriores ao início do
  // tracker ficam de fora.
  weeksCounted: number
}

export function monthStats(
  tracker: Tracker,
  days: TrackerDays,
  year: number,
  month0: number,
  todayKey: string
): MonthStats {
  const total = countDone(days, toDateKey(year, month0, 1), toDateKey(year, month0, daysInMonth(year, month0)))
  let weeksOnTarget = 0
  let weeksCounted = 0
  for (const start of monthWeekStarts(year, month0)) {
    const { status } = weekResult(tracker, days, start, todayKey)
    if (status === 'onTarget') {
      weeksOnTarget++
      weeksCounted++
    } else if (status === 'below') {
      weeksCounted++
    }
  }
  return { total, weeksOnTarget, weeksCounted }
}

// "13 days · 3 of 4 weeks on target"; sem semana contada, só "13 days". O nome do
// mês não entra: ele já está no cabeçalho do Calendar.
export function formatMonthLine(stats: MonthStats): string {
  const head = countOf(stats.total, 'day')
  if (stats.weeksCounted === 0) return head
  const weeks = stats.weeksCounted === 1 ? 'week' : 'weeks'
  return `${head} · ${stats.weeksOnTarget} of ${stats.weeksCounted} ${weeks} on target`
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "20 Nov"; com `withYear`, "20 Nov 2025".
function shortDate(key: string, withYear: boolean): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${d} ${MONTH_SHORT[m - 1]}${withYear ? ` ${y}` : ''}`
}

// "16–22 Nov"; com meses diferentes, "26 Oct–1 Nov".
export function weekRangeLabel(weekStart: string): string {
  const [, m1, d1] = weekStart.split('-').map(Number)
  const [, m2, d2] = addDaysKey(weekStart, 6).split('-').map(Number)
  return m1 === m2
    ? `${d1}–${d2} ${MONTH_SHORT[m2 - 1]}`
    : `${d1} ${MONTH_SHORT[m1 - 1]}–${d2} ${MONTH_SHORT[m2 - 1]}`
}

// A semana (segunda a domingo) contém hoje.
function weekHasToday(weekStart: string, todayKey: string): boolean {
  return weekStart <= todayKey && todayKey <= addDaysKey(weekStart, 6)
}

// Cabeçalho da faixa: "This week · 16–22 Nov" na semana de hoje; nas outras, só o
// intervalo ("9–15 Nov").
export function weekHeaderLabel(weekStart: string, todayKey: string): string {
  const range = weekRangeLabel(weekStart)
  return weekHasToday(weekStart, todayKey) ? `This week · ${range}` : range
}

// Tooltip do "n/meta": "1 of 3 this week" na semana de hoje; nas outras, com o
// intervalo ("1 of 3 in 9–15 Nov").
export function weekCountTitle(done: number, target: number, weekStart: string, todayKey: string): string {
  const when = weekHasToday(weekStart, todayKey) ? 'this week' : `in ${weekRangeLabel(weekStart)}`
  return `${done} of ${target} ${when}`
}

// "2/3 · 1/4": o n/meta de cada tracker na semana em foco (a faixa recolhida).
export function weekCountsLine(trackers: Tracker[], days: Map<string, TrackerDays>, weekStart: string): string {
  const end = addDaysKey(weekStart, 6)
  return trackers
    .map((t) => `${countDone(days.get(t.id) ?? new Map(), weekStart, end)}/${t.weeklyTarget}`)
    .join(' · ')
}

// Linha do mês de um tracker na faixa: "13 days · 3 of 4 weeks on target". Mês
// futuro: null (nada a mostrar). Mês que terminou antes do início do tracker:
// "Started 20 Nov" (com o ano só quando é outro que o do mês exibido), no lugar
// de "0 days".
export function trackerMonthLine(
  tracker: Tracker,
  days: TrackerDays,
  year: number,
  month0: number,
  todayKey: string
): string | null {
  if (toDateKey(year, month0, 1) > todayKey) return null
  const start = trackerStartDay(tracker, days)
  if (start > toDateKey(year, month0, daysInMonth(year, month0))) {
    return `Started ${shortDate(start, Number(start.slice(0, 4)) !== year)}`
  }
  return formatMonthLine(monthStats(tracker, days, year, month0, todayKey))
}

// Tooltip da linha do mês: o resultado de cada semana do mês que já conta
// ("29 Sep–5 Oct 3/3 · 6–12 Oct 2/3"). Semana futura, semana antes do início do
// tracker e semana de início abaixo da meta (que não conta nas semanas na meta)
// ficam de fora; a atual abaixo da meta leva "(in progress)". Sem semana a
// mostrar: undefined.
export function trackerMonthTitle(
  tracker: Tracker,
  days: TrackerDays,
  year: number,
  month0: number,
  todayKey: string
): string | undefined {
  const parts: string[] = []
  for (const start of monthWeekStarts(year, month0)) {
    const week = weekResult(tracker, days, start, todayKey)
    if (week.status === 'future' || week.status === 'beforeStart' || week.status === 'startBelow') continue
    const progress = week.status === 'inProgress' ? ' (in progress)' : ''
    parts.push(`${weekRangeLabel(start)} ${week.done}/${week.target}${progress}`)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

// "Fri 20/11"
export function shortDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const weekday = WEEKDAY_SHORT[new Date(y, m - 1, d).getDay()]
  return `${weekday} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

// Tooltip e rótulo acessível do dia do tracker.
export function trackerDayTitle(
  tracker: Tracker,
  day: TrackerDay | undefined,
  dayKey: string,
  todayKey: string,
  linkedTypeName: string | null
): string {
  const head = `${tracker.name} · ${shortDayLabel(dayKey)}`
  if (dayKey > todayKey) return `${head} · future days can't be marked`
  if (day?.fromNote) {
    const type = linkedTypeName ?? 'linked type'
    // Dia marcado à mão e com nota: arquivar a nota não o desfaz, a marca fica.
    if (day.manual) {
      return `${head} · Done (marked, and from a ${type} note) · click to open the note. To undo, archive the note or change its date, then click the day again to unmark it.`
    }
    return `${head} · Done from a ${type} note · click to open it. To undo, archive the note or change its date.`
  }
  if (day?.manual) return `${head} · done (click to unmark)`
  return `${head} · not done (click to mark)`
}

// Linha de erro quando a marca de um dia não grava (faixa e chips).
export function markSaveError(trackerName: string, dayKey: string): string {
  return `Couldn't save ${trackerName} · ${shortDayLabel(dayKey)}. Try again.`
}

// "Practice notes": o rótulo do tipo vinculado no seletor "From notes".
export function typeNotesLabel(typeName: string): string {
  return `${typeName} notes`
}

// Dica sob "From notes" (só com vínculo).
export function linkHint(typeName: string): string {
  return `Days with a ${typeName} note count as done.`
}

// Confirmação ao trocar o vínculo ("None" ou outro tipo) quando há `count` dias que
// só contam pelas notas. As notas ficam.
export function unlinkConfirmText(trackerName: string, typeName: string, count: number): string {
  const days = countOf(count, 'day')
  const stop = count === 1 ? 'It stops' : 'They stop'
  return `${trackerName} counts ${days} from ${typeNotesLabel(typeName)}. ${stop} counting if you change this. The notes are kept.`
}

// Confirmação de excluir o tracker; com tipo vinculado, diz que as notas ficam.
export function deleteTrackerText(trackerName: string, marks: number, linkedTypeName: string | null): string {
  const base = `Delete "${trackerName}"? This removes it and its ${countOf(marks, 'marked day')}. This can't be undone.`
  return linkedTypeName ? `${base} Your ${typeNotesLabel(linkedTypeName)} are kept.` : base
}

// Acrescenta à confirmação de apagar um tipo de nota: os trackers vinculados a ele
// deixam de contar as notas. null sem tracker vinculado.
export function deleteTypeTrackersNote(trackerNames: string[]): string | null {
  if (trackerNames.length === 0) return null
  const quoted = trackerNames.map((n) => `"${n}"`)
  const list = quoted.length === 1 ? quoted[0] : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`
  return `${trackerNames.length === 1 ? 'The tracker' : 'The trackers'} ${list} will stop counting days from its notes.`
}

// ─── Resumo para a IA (Coach, Plan week, /week-review e a tool query_trackers) ──
// Os números vêm das contas acima; nenhum texto de nota entra, só contagens e
// nomes de tracker e de tipo. Todos os formatadores ignoram os arquivados.

// Período máximo da tool, em dias.
const MAX_QUERY_DAYS = 366
// Dias listados por tracker na tool; o resto vira "+N more".
const MAX_QUERY_LISTED_DAYS = 120

// A semana em que o tracker começou terminou abaixo da meta: não é uma semana perdida.
const START_WEEK_BELOW = 'the tracker started that week; not counted as below target'

function activeTrackers(trackers: Tracker[]): Tracker[] {
  return trackers.filter((t) => t.archivedAt === null)
}

function daysOf(days: Map<string, TrackerDays>, tracker: Tracker): TrackerDays {
  return days.get(tracker.id) ?? new Map()
}

function countOf(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

// "09/11"
function dayMonth(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`
}

// "09/11–15/11"
function weekRange(start: string, end: string): string {
  return `${dayMonth(start)}–${dayMonth(end)}`
}

// "November 2026"
function monthLabel(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Dias feitos em [from, to], em ordem crescente.
function doneDaysIn(days: TrackerDays, from: string, to: string): string[] {
  return [...days.keys()].filter((k) => k >= from && k <= to).sort()
}

// `[Tracker "Guitar"] target 3 per week · also counts days with a "Practice" note`;
// tipo vinculado que não existe mais = sem vínculo.
function trackerHead(tracker: Tracker, typeNameById: Map<string, string>): string {
  const typeName = tracker.linkedTypeId ? typeNameById.get(tracker.linkedTypeId) : undefined
  const head = `[Tracker "${tracker.name}"] target ${tracker.weeklyTarget} per week`
  return typeName ? `${head} · also counts days with a "${typeName}" note` : head
}

// "13 days, 3 of 4 weeks on target"; sem semana contada, só os dias.
function monthSummary(stats: MonthStats): string {
  if (stats.weeksCounted === 0) return countOf(stats.total, 'day')
  const weeks = stats.weeksCounted === 1 ? 'week' : 'weeks'
  return `${countOf(stats.total, 'day')}, ${stats.weeksOnTarget} of ${stats.weeksCounted} ${weeks} on target`
}

// Coach: um bloco por tracker ativo. null sem tracker ativo.
export function formatTrackersForAi(
  trackers: Tracker[],
  days: Map<string, TrackerDays>,
  todayKey: string,
  typeNameById: Map<string, string>
): string | null {
  const active = activeTrackers(trackers)
  if (active.length === 0) return null
  const weekStart = startOfWeekKey(todayKey)
  const [year, month] = todayKey.split('-').map(Number)
  const prevMonth = new Date(year, month - 2, 1)
  const blocks = active.map((tracker) => {
    const own = daysOf(days, tracker)
    const week = weekResult(tracker, own, weekStart, todayKey)
    const doneList = doneDaysIn(own, week.start, week.end).map(shortDayLabel)
    let thisWeek = `This week (${week.start} to ${week.end}): ${week.done} of ${week.target} done`
    if (doneList.length > 0) thisWeek += ` (${doneList.join(', ')})`
    if (week.done >= week.target) {
      thisWeek += ' · target reached.'
    } else {
      const open = weekDayKeys(weekStart)
        .filter((k) => k >= todayKey && !own.has(k))
        .map(shortDayLabel)
      thisWeek += ` · ${week.target - week.done} to go · `
      thisWeek += open.length > 0 ? `open days left including today: ${open.join(', ')}.` : 'no open days left.'
    }

    const past = [1, 2, 3, 4]
      .map((i) => weekResult(tracker, own, addDaysKey(weekStart, -7 * i), todayKey))
      .filter((r) => r.status !== 'beforeStart' && r.status !== 'startBelow')
    const lastWeeks =
      past.length > 0
        ? `Last 4 weeks: ${past
            .map(
              (r) =>
                `${weekRange(r.start, r.end)} ${r.done}/${r.target} ${r.status === 'onTarget' ? 'on target' : 'below target'}`
            )
            .join('; ')}.`
        : 'Last 4 weeks: none yet (the tracker is new; its first week counts only when it reaches the target).'

    const thisMonthStats = monthStats(tracker, own, year, month - 1, todayKey)
    const lastMonthStats = monthStats(tracker, own, prevMonth.getFullYear(), prevMonth.getMonth(), todayKey)
    let months = `This month (${monthLabel(year, month - 1)}): ${monthSummary(thisMonthStats)}.`
    // Mês anterior sem dia nem semana contada = o tracker ainda não existia.
    if (lastMonthStats.total > 0 || lastMonthStats.weeksCounted > 0) {
      months += ` Last month (${monthLabel(prevMonth.getFullYear(), prevMonth.getMonth())}): ${monthSummary(lastMonthStats)}.`
    }
    return [trackerHead(tracker, typeNameById), thisWeek, lastWeeks, months].join('\n')
  })
  return [
    'Trackers (habits the user marks in the Calendar; counts computed by the app — use them as given, never estimate). Weeks run Monday to Sunday.',
    ...blocks,
  ].join('\n\n')
}

// Plan week: sessões que faltam em cada semana coberta e os dias candidatos
// (qualquer dia, fim de semana incluído). null sem tracker ativo.
export function formatTrackersForPlanWeek(
  trackers: Tracker[],
  days: Map<string, TrackerDays>,
  todayKey: string,
  weeks: { thisWeek: boolean; nextWeek: boolean }
): string | null {
  const thisStart = startOfWeekKey(todayKey)
  const nextStart = addDaysKey(thisStart, 7)
  const lines: string[] = []
  for (const tracker of activeTrackers(trackers)) {
    if (weeks.thisWeek) {
      const own = daysOf(days, tracker)
      const week = weekResult(tracker, own, thisStart, todayKey)
      const head = `- "${tracker.name}" (target ${week.target} per week) this week: ${week.done} of ${week.target} done`
      if (week.done >= week.target) {
        lines.push(`${head} → target reached.`)
      } else {
        const candidates = weekDayKeys(thisStart)
          .filter((k) => k >= todayKey && !own.has(k))
          .map(shortDayLabel)
        lines.push(
          `${head} → ${week.target - week.done} to go; ` +
            (candidates.length > 0 ? `candidate days: ${candidates.join(', ')}.` : 'no candidate days left.')
        )
      }
    }
    if (weeks.nextWeek) {
      lines.push(
        `- "${tracker.name}" next week (${weekRange(nextStart, addDaysKey(nextStart, 6))}): ${tracker.weeklyTarget} to go; ` +
          `candidate days: ${weekDayKeys(nextStart).map(shortDayLabel).join(', ')}.`
      )
    }
  }
  if (lines.length === 0) return null
  return [
    "Trackers (habits; counts computed by the app). Sessions have no hours: they do not use capacity and do not count toward the 4 items per day. Suggest days only from each line's candidate days (any day, weekends included).",
    ...lines,
  ].join('\n')
}

// /week-review: o resultado da semana (segunda a domingo) de cada tracker que já
// existia até o domingo dela. null sem nenhum.
export function formatTrackersWeekForAi(
  trackers: Tracker[],
  days: Map<string, TrackerDays>,
  weekStart: string,
  todayKey: string
): string | null {
  const end = addDaysKey(weekStart, 6)
  const left = weekDayKeys(weekStart).filter((k) => k >= todayKey).length
  const lines: string[] = []
  for (const tracker of activeTrackers(trackers)) {
    const own = daysOf(days, tracker)
    if (trackerStartDay(tracker, own) > end) continue
    const week = weekResult(tracker, own, weekStart, todayKey)
    const doneList = doneDaysIn(own, week.start, week.end).map(shortDayLabel)
    // Aqui o status nunca é beforeStart: o tracker já existia até `end`.
    const status =
      week.status === 'onTarget'
        ? 'on target'
        : week.status === 'below'
          ? 'below target'
          : week.status === 'inProgress'
            ? `in progress, ${countOf(left, 'day')} left including today`
            : week.status === 'startBelow'
              ? START_WEEK_BELOW
              : 'the week has not started'
    lines.push(
      `- "${tracker.name}": ${week.done} of ${week.target} done` +
        (doneList.length > 0 ? ` (${doneList.join(', ')})` : '') +
        ` · ${status}`
    )
  }
  if (lines.length === 0) return null
  return [
    `Trackers in this week (${weekStart} to ${end}; counts computed by the app — use them as given):`,
    ...lines,
  ].join('\n')
}

export interface TrackerQuery {
  tracker?: string
  from: string
  to: string
}

// YYYY-MM-DD que existe no calendário (2026-02-31 não vale).
function isDateKey(key: string): boolean {
  if (!ISO_DATE_RE.test(key)) return false
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

// Dias entre duas chaves (b - a), sem depender do horário de verão.
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

const QUERY_WEEK_STATUS: Record<WeekStatus, string> = {
  future: 'not started',
  beforeStart: 'before the tracker started',
  inProgress: 'in progress',
  onTarget: 'on target',
  below: 'below target',
  startBelow: START_WEEK_BELOW,
}

// Tool query_trackers: o texto que volta ao modelo (ou o erro legível do pedido).
export function queryTrackersText(
  trackers: Tracker[],
  days: Map<string, TrackerDays>,
  query: TrackerQuery,
  todayKey: string,
  typeNameById: Map<string, string>
): string {
  if (!isDateKey(query.from) || !isDateKey(query.to)) {
    return 'Invalid period: use YYYY-MM-DD for from and to.'
  }
  const [from, to] = query.from <= query.to ? [query.from, query.to] : [query.to, query.from]
  if (daysBetween(from, to) + 1 > MAX_QUERY_DAYS) {
    return `Period too long: ask for at most ${MAX_QUERY_DAYS} days.`
  }
  const active = activeTrackers(trackers)
  if (active.length === 0) return 'The user has no active trackers.'
  const name = query.tracker?.trim() ?? ''
  const wanted = normalizeName(name)
  const picked = name ? active.filter((t) => normalizeName(t.name).includes(wanted)) : active
  if (picked.length === 0) {
    return `No active tracker matches "${name}". Active trackers: ${active.map((t) => `"${t.name}"`).join(', ')}.`
  }

  const header = `Period ${withWeekday(from)} to ${withWeekday(to)}; today is ${todayKey}. Days after today are not counted.`
  const blocks = picked.map((tracker) => {
    const own = daysOf(days, tracker)
    const done = doneDaysIn(own, from, to)

    const weeks: string[] = []
    for (let start = startOfWeekKey(from); start <= to; start = addDaysKey(start, 7)) {
      const week = weekResult(tracker, own, start, todayKey)
      const inPeriod = countDone(own, start > from ? start : from, week.end < to ? week.end : to)
      weeks.push(
        `${weekRange(start, week.end)}: ${inPeriod}${weeks.length === 0 ? ' in the period' : ''} ` +
          `(week ${week.done}/${week.target}, ${QUERY_WEEK_STATUS[week.status]})`
      )
    }

    const listed = done.slice(0, MAX_QUERY_LISTED_DAYS).map((key) => {
      const day = own.get(key)
      return `${key} (${day?.manual && day.fromNote ? 'manual and note' : day?.fromNote ? 'note' : 'manual'})`
    })
    if (done.length > MAX_QUERY_LISTED_DAYS) listed.push(`+${done.length - MAX_QUERY_LISTED_DAYS} more`)

    return [
      trackerHead(tracker, typeNameById),
      `Total in the period: ${countOf(done.length, 'day')}.`,
      `Weeks (Monday to Sunday; days in the period / weekly result): ${weeks.join('; ')}`,
      `Days: ${listed.length > 0 ? listed.join(', ') : 'none'}`,
    ].join('\n')
  })
  return [header, ...blocks].join('\n\n')
}
