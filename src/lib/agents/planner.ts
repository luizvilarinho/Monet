import { ListChecks } from '@phosphor-icons/react'
import { withWeekday } from '../agenda'
import { collectPlans, formatPlanForAi, isPlanType, isPlanTypeName, planDefs } from '../planNotes'
import { WEEKDAY_SHORT } from '../tasks'
import { loadWorkCapacity } from '../workCapacity'
import { bookLine, loadPlanData } from './agentData'
import type { AgentContext, AgentContextInput, ChatAgentDef } from './chat'

// Agente planner (chat): traça ou refaz o plano de um objetivo com prazo. A
// resposta segue o contrato do plano (src/lib/plan.ts) e vira nota pelo botão
// "Save as Plan note".

const BOOKS_MAX = 15

async function buildPlannerContext(input: AgentContextInput): Promise<AgentContext> {
  const data = await loadPlanData()
  const capacity = loadWorkCapacity()
  const today = input.todayKey
  const notebookName = new Map(data.notebooks.map((nb) => [nb.id, nb.name]))
  const plans = collectPlans({
    notes: data.notes,
    defs: data.defs,
    types: data.types,
    todayKey: today,
    disabledNotebookIds: data.disabledNotebookIds,
  }).filter((e) => e.state === 'active' || e.state === 'overdue')

  // Dias de trabalho na ordem seg→dom.
  const workDayNames = [...capacity.workDays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => WEEKDAY_SHORT[d])
  const planTypes = data.types
    .filter((t) => isPlanType(t.id, data.defs) && isPlanTypeName(t.name))
    .map((t) => {
      const pd = planDefs(data.defs, t.id)!
      return `${t.name} (${pd.start.name} → ${pd.end.name})`
    })

  const text = [
    'Planner context (rebuilt by the app for this message; it replaces any earlier one).',
    `Today: ${withWeekday(today)}.`,
    `Work capacity (Settings › Agenda; reference only — a study plan has its own Capacity): ` +
      `${capacity.hoursPerDay}h per work day, ${workDayNames.join(', ')}` +
      (capacity.configured ? '.' : ' (default, not configured).'),
    `Plan note types (plan-named types with a start/end date pair): ` +
      (planTypes.length > 0
        ? `${planTypes.join(', ')}.`
        : 'none — "Save as Plan note" creates the type "Plan" (Start, End, Capacity, Book).'),
    '',
    'Reader books:',
    ...(data.books.length > 0 ? data.books.slice(0, BOOKS_MAX).map((b) => `- ${bookLine(b)}`) : ['(none)']),
    'Table of contents: not available to the app (the Reader reads it only while the book is open). ' +
      'Use the chapters the user gives; otherwise estimate them from the page count and say so in Assumptions.',
    '',
    'Active plans (progress computed by the app):',
    plans.length > 0
      ? plans
          .map((e) => formatPlanForAi(e, data.books, notebookName.get(e.note.notebookId ?? '') ?? null, today))
          .join('\n\n')
      : '(none)',
  ].join('\n')
  return { text }
}

function plannerPrompt(language: string): string {
  return `You are Monet's planner. You draft or redo the plan for one goal with a deadline: reading a book, taking a course, a video series or a deliverable with steps. You only suggest: the user saves the plan as a note with the "Save as Plan note" button and owns it from then on.

Respond in the language of the user's latest message (if unclear: ${language}). Concise Markdown, no greetings or filler. Never invent chapters, page counts or dates you were not given; estimate only what the block says is missing, and say so.

Data: the "Planner context" system block is rebuilt by the app for every message and is the source of truth: today, the Reader books (pages, furthest highlighted page), whether a table of contents is available, the active plans with progress computed by the app, and the user's work capacity (reference only). Ignore older versions of it.

What you need: (1) the goal and the material (which book, course or list); (2) the deadline (the plan's End); (3) the pace: hours per day and rest days; (4) when replanning, what is already done (the active plan's progress in the block).

Questions — at most one per reply:
- No deadline: ask one focused question with a suggested answer (e.g. "Until when? If it is the end of the month, <dd/mm of that day>."). If the material is missing too, ask for both in that same question. Do not draft a plan in that reply.
- No pace: do not ask. Assume 1h per day, every day, and state it in Assumptions.
- No table of contents: do not ask. Use the chapters the user gave or estimate them from the page count, and state it in Assumptions.
- Never ask about anything the block already has.

Replanning: when the user asks to redo, adjust or recover an active plan, plan only its open items, starting today, keep the same End unless the user changes it, and add "Replaces: <plan title>" to the Assumptions, with the plan title exactly as in the block.

Output — exactly this, nothing before or after:
Assumptions: <at most 2 lines: pace, rest days, where the chapters came from>

**Plan:** <short title>
**Start:** dd/mm/yyyy · **End:** dd/mm/yyyy · **Capacity:** <hours>h/day · **Book:** <exact title from the Reader list, or —>

- [ ] **dd/mm (Wkd) · <label>:** <what to do>
(one checklist line per study day)

Checklist rules:
- Every item starts with its date in bold: "**dd/mm (Wkd) · label:**". Wkd is the short weekday in the user's language; the label is short ("Day 1", "Watch", "Review", "Exercise").
- Dates are in order, between Start and End, and skip the rest days.
- One item per study day, sized to the capacity. For a Reader book, name chapters and page ranges ("Ch. <n> (p. <first>–<last>)"); the furthest highlighted page only hints where the user is.
- At most 60 items: for longer plans, let an item cover two or three days and date it on its first day.
- The field labels (Plan, Start, End, Capacity, Book) may be in the user's language; keep the bold and the dates exactly in the format above (dd/mm/yyyy for Start and End, dd/mm at the start of each item).

Follow-ups: when the user asks for a change ("no <weekday>", "until <dd/mm>", "<N>h a day"), redo the whole plan in the same format.`
}

export const plannerAgent: ChatAgentDef = {
  id: 'planner',
  command: '/planner',
  label: 'Planner',
  description: 'Draft or redo the plan for a goal with a deadline',
  icon: ListChecks,
  prompt: plannerPrompt,
  buildContext: buildPlannerContext,
  forceTasksTool: false,
  forceNotesTool: false,
  context: { rag: false, web: false, deepResearch: false },
}
