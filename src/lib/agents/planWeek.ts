import { CalendarCheck } from '@phosphor-icons/react'
import {
  agendaContents,
  formatAgendaContext,
  lastOpenDeadline,
  selectAgenda,
  withWeekday,
  type AgendaInput,
} from '../agenda'
import { notesIndexGetDisabledNotebooks } from '../documents'
import { ocrTextsForContent } from '../imageOcr'
import { cleanNoteContentForAi, loadEmbedResponses } from '../noteFileText'
import { agendaPlanSummaries, isPlanType } from '../planNotes'
import {
  addDaysKey,
  checklistProgress,
  isBuiltinStatus,
  isOpen,
  startOfWeekKey,
  weekDayKeys,
  WEEKDAY_SHORT,
  type ChecklistProgress,
} from '../tasks'
import { DEFAULT_WORK_HOURS_PER_DAY, loadWorkCapacity } from '../workCapacity'
import { storage } from '../../storage'
import { loadReaderBooks } from './agentData'
import type { ChatAgentDef } from './chat'

// Agente plan-week (chat): plano da semana de trabalho a partir das tasks,
// TODOS, Plans em andamento e notas diárias, com a capacidade de Settings ›
// Agenda. O contexto é lido do storage a cada mensagem.

// Prazos depois da semana planejada entram até este número de dias à frente.
const UPCOMING_DAYS = 28

export type PlanWeekCoverage = 'thisWeek' | 'todayAndNextWeek' | 'nextWeek'

export interface PlanWeekWindow {
  // thisWeek = de hoje ao fim desta semana de trabalho; todayAndNextWeek =
  // hoje (último dia de trabalho) e a próxima; nextWeek = só a próxima.
  coverage: PlanWeekCoverage
  planDays: string[] // dias de trabalho a planejar (YYYY-MM-DD)
  planEnd: string // domingo da última semana coberta
}

// Num dia antes do último dia de trabalho da semana, o plano começa hoje; no
// último, cobre hoje e a próxima semana; depois dele, só a próxima.
export function planWeekWindow(todayKey: string, workDays: number[]): PlanWeekWindow {
  const work = new Set(workDays.map((d) => (d + 6) % 7)) // 0 = segunda
  const lastWork = Math.max(...work)
  const weekStart = startOfWeekKey(todayKey)
  const todayIdx = weekDayKeys(weekStart).indexOf(todayKey)
  const nextStart = addDaysKey(weekStart, 7)
  const nextDays = weekDayKeys(nextStart).filter((_, i) => work.has(i))
  if (todayIdx < lastWork) {
    return {
      coverage: 'thisWeek',
      planDays: weekDayKeys(weekStart).filter((k, i) => work.has(i) && k >= todayKey),
      planEnd: addDaysKey(weekStart, 6),
    }
  }
  return {
    coverage: todayIdx === lastWork ? 'todayAndNextWeek' : 'nextWeek',
    planDays: todayIdx === lastWork ? [todayKey, ...nextDays] : nextDays,
    planEnd: addDaysKey(nextStart, 6),
  }
}

function coverageLine(win: PlanWeekWindow): string {
  const range = `${withWeekday(win.planDays[0])} to ${withWeekday(win.planDays[win.planDays.length - 1])}`
  if (win.coverage === 'thisWeek') return `Plan covers: the rest of this work week — ${range}.`
  if (win.coverage === 'todayAndNextWeek') {
    return `Plan covers: TODAY (the last work day of this week) and the NEXT work week — ${range}.`
  }
  return `Plan covers: the NEXT work week (today is after the last work day of this week) — ${range}.`
}

export async function buildPlanWeekContext(todayKey: string): Promise<string> {
  const capacity = loadWorkCapacity()
  const [tasks, notes, notebooks, statuses, defs, disabledIds, types] = await Promise.all([
    storage.getTasks(),
    storage.getNotes(),
    storage.getNotebooks(),
    storage.getTaskStatuses(),
    storage.getMetadataDefs(),
    notesIndexGetDisabledNotebooks(),
    storage.getNoteTypes(),
  ])
  const disabledNotebookIds = new Set(disabledIds)
  const noteById = new Map(notes.map((n) => [n.id, n]))
  const checklist = new Map<string, ChecklistProgress>()
  for (const t of tasks) {
    const body = t.noteId ? noteById.get(t.noteId) : undefined
    const progress = body ? checklistProgress(body.content) : null
    if (progress) checklist.set(t.id, progress)
  }

  const win = planWeekWindow(todayKey, capacity.workDays)
  const base = { today: todayKey, tasks, notes, notebooks, defs, statuses, checklist, disabledNotebookIds }
  const last = lastOpenDeadline(base)
  const horizon = addDaysKey(win.planEnd, UPCOMING_DAYS)
  const to = last && last > win.planEnd ? (last < horizon ? last : horizon) : win.planEnd
  // `from` é sempre hoje (atrasadas e o que é de hoje); sem bloco de concluídas.
  const input: AgendaInput = { ...base, from: todayKey, to, done: null }
  const sel = selectAgenda(input)

  const contents = agendaContents(sel)
  const [embeds, imageTexts] = await Promise.all([
    loadEmbedResponses(contents),
    ocrTextsForContent(contents.join('\n')),
  ])
  const titles = new Map(
    notes.filter((n) => !n.notebookId || !disabledNotebookIds.has(n.notebookId)).map((n) => [n.id, n.title])
  )
  const toAiText = (content: string) =>
    cleanNoteContentForAi(content, {
      resolveNoteTitle: (id) => titles.get(id),
      resolveEmbed: (id) => embeds.get(id),
      resolveImageText: (url) => imageTexts.get(url),
    })

  // Dias de trabalho na ordem seg→dom.
  const workDayNames = [...capacity.workDays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => WEEKDAY_SHORT[d])
  const openListed = sel.openTasks.length + sel.todos.reduce((n, e) => n + e.tasks.filter(isOpen).length, 0)
  const custom = statuses.filter((s) => !isBuiltinStatus(s.id)).map((s) => s.name.trim() || s.id)
  const header = [
    'Plan week context (rebuilt by the app for this message; it replaces any earlier one).',
    `Today: ${withWeekday(todayKey)}.`,
    `Work days: ${workDayNames.join(', ')}. Capacity: ${capacity.hoursPerDay}h per work day.`,
    capacity.configured
      ? 'Capacity source: set by the user in Settings › Agenda.'
      : 'Capacity source: default — not configured by the user (Settings › Agenda).',
    coverageLine(win),
    `Days to plan: ${win.planDays.map(withWeekday).join(', ')}.`,
    `Agenda window: ${todayKey} to ${to}.` +
      (to > win.planEnd
        ? ` Items dated after ${win.planEnd} are upcoming deadlines (up to 4 weeks ahead): do not schedule them day by day; list them under Upcoming, use them for Risks, or start early when a day has room.`
        : ''),
    `Open tasks listed: ${openListed}. Last open deadline: ${last ?? 'none'}${last && last > to ? ' (beyond the agenda window)' : ''}.`,
    custom.length > 0 ? `Parked statuses (custom): ${custom.join(', ')}.` : 'No custom statuses: nothing is parked.',
  ].join('\n')

  // Os livros do Reader só são lidos se alguma nota datada pode ser plano; os
  // itens de cada plano nos dias a planejar vão junto do resumo.
  const planSummaries = agendaPlanSummaries({
    notes: sel.datedNotes.map((e) => e.note),
    defs,
    types,
    notebooks,
    books: sel.datedNotes.some((e) => isPlanType(e.note.typeId, defs)) ? await loadReaderBooks() : [],
    todayKey,
    disabledNotebookIds,
    planDays: { from: win.planDays[0], to: win.planDays[win.planDays.length - 1] },
  })
  return `${header}\n\n${formatAgendaContext(sel, input, toAiText, planSummaries)}`
}

function planWeekPrompt(language: string): string {
  return `You are Monet's week planner. You turn the user's tasks and deliverables into a plan for their work week. You suggest; you never claim to have scheduled or changed anything.

Respond in the language of the user's latest message (if unclear: ${language}). Use concise Markdown with no greetings or filler. Never invent tasks, dates or deliverables. Weeks start on Monday.

Data:
- The "Plan week context" system block is rebuilt by the app for every message and is the source of truth: today, work days, capacity, the days to plan and the agenda (open and overdue tasks, TODOS deliverables, dated notes, and Calendar daily notes). Ignore older versions of it in the conversation.
- Plan notes come among the dated notes as a "[Plan …]" summary computed by the app: state, items done and expected, overdue, Today and Next items, the plan's items on the days to plan ("Items dated …", done or open) and the plan's Capacity (hours per day). Use these numbers as given; never count days or items yourself.
- The query_tasks tool, when available, is only for a specific lookup the block does not answer. Do not wait for a tool to build the plan.

How to plan:
1. Plan only the days in "Days to plan". If the block says the plan covers the NEXT work week (with or without today), start with one line saying so.
2. Order: overdue first, then tasks planned for a day ("planned for"), tasks in progress (doing), and the nearest deadlines. Keep a task on the do date or planned day the user already set.
3. Commitments written in the Calendar daily notes take time from their day. Each plan takes its Capacity (1h when not set) on every day to plan up to its End, as one bullet with that day's open plan item (from "Items dated …") or the plan title.
4. Estimate each item's effort yourself from its title, notes and checklist, and fill each day up to the capacity. Never go over the capacity of a day.
5. Tasks in a parked status (custom statuses listed in the block) are not scheduled.
6. Deadlines after the planned days (the block's upcoming deadlines) are not spread over days: list them under Upcoming.

Output — exactly this, with titles in the user's language:
- One line per day to plan: "**<Wkd dd/mm> · ~Nh**" (short weekday, dd/mm, the day's total hours). Under it at most 4 bullets, each only the task or deliverable title, or a short step when you split one. No hours, source, notebook or "AI estimate" on the items. A day with nothing: "**<Wkd dd/mm> · free**".
- **Upcoming**: only when there are task deadlines or TODOS delivery dates after the planned days. One line per item, nearest first: "dd/mm · title". No hours and no split into days.
- **Parked**: at most 2 lines, only when there are parked tasks, grouped by status name.
- **Risks**: at most 2 lines, only when what is due does not fit in the capacity before its deadline. Name the deliverable and what would have to change (postpone, cut scope, renegotiate). Overdue items that do not fit go here.
- Last line, in italics: hours are AI estimates. When the capacity source is the default, add in the same line: "default ${DEFAULT_WORK_HOURS_PER_DAY}h/day, set yours in Settings › Agenda".
Nothing else: no reasoning, no explanation of the capacity, no summary.

Questions: never ask about capacity or work days; the block has them. Ask only when something missing blocks the plan: one focused question with a suggested answer. If there are no open tasks and no deadlines, say so in one line and do not make up a plan.

Follow-ups: when the user asks for a change ("drop <weekday>", "focus on <task>", "only <N>h on <weekday>"), redo the whole plan in the same format with the change applied.`
}

export const planWeekAgent: ChatAgentDef = {
  id: 'plan-week',
  command: '/plan-week',
  label: 'Plan week',
  description: 'Plan your work week from your tasks',
  icon: CalendarCheck,
  prompt: planWeekPrompt,
  buildContext: async (input) => ({ text: await buildPlanWeekContext(input.todayKey) }),
  forceTasksTool: true,
  forceNotesTool: false,
  context: { rag: false, web: false, deepResearch: false },
}
