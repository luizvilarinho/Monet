import { Gauge } from '@phosphor-icons/react'
import { withWeekday } from '../agenda'
import { collectPlans, formatPlanForAi } from '../planNotes'
import { loadPlanData } from './agentData'
import type { AgentContext, AgentContextInput, ChatAgentDef } from './chat'

// Agente coach (chat): vê se os planos estão no prazo e cobra o ritmo. Só lê
// planos (D13: entregas de tasks são do plan-week); o progresso é o checklist,
// medido pelo app (src/lib/plan.ts).

const UPCOMING_MAX = 3

async function buildCoachContext(input: AgentContextInput): Promise<AgentContext> {
  const data = await loadPlanData()
  const today = input.todayKey
  const notebookName = new Map(data.notebooks.map((nb) => [nb.id, nb.name]))
  const plans = collectPlans({
    notes: data.notes,
    defs: data.defs,
    types: data.types,
    todayKey: today,
    disabledNotebookIds: data.disabledNotebookIds,
  })
  const tracked = plans.filter((e) => (e.state === 'active' || e.state === 'overdue') && e.checklist)
  const noChecklist = plans.filter((e) => e.state === 'active' && !e.checklist)
  const upcoming = plans.filter((e) => e.state === 'upcoming').slice(0, UPCOMING_MAX)
  const title = (e: (typeof plans)[number]) => `"${e.note.title.trim() || 'Untitled'}"`

  const out = [
    'Coach context (rebuilt by the app for this message; it replaces any earlier one).',
    `Today: ${withWeekday(today)}.`,
    tracked.length > 0
      ? `Active plans: ${tracked.length}. A plan is a note whose type has a start/end date pair and either a plan name or a checklist with dated items; its progress is the checklist.`
      : 'No active plan: no plan note has Start ≤ today ≤ End, or is past its End with open items.',
  ]
  for (const e of tracked) {
    out.push('', formatPlanForAi(e, data.books, notebookName.get(e.note.notebookId ?? '') ?? null, today))
  }
  if (noChecklist.length > 0) {
    out.push(
      '',
      `Plans without a checklist (no metric): ${noChecklist
        .map((e) => `${title(e)} (${e.info.start ?? 'start not set'} → ${e.info.end})`)
        .join('; ')}.`
    )
  }
  if (upcoming.length > 0) {
    out.push('', `Not started yet: ${upcoming.map((e) => `${title(e)} (starts ${e.info.start})`).join('; ')}.`)
  }
  return { text: out.join('\n') }
}

function coachPrompt(language: string): string {
  return `You are Monet's coach. You check whether the user's plans are on schedule and push for the pace needed to finish them. You read plans; you never create or change them. Redoing a plan is the planner's job (/planner).

Respond in the language of the user's latest message (if unclear: ${language}). Short Markdown, no greetings, no lectures, no motivational filler. Section titles (such as What to do) in the user's language too.

Data: the "Coach context" system block is rebuilt by the app for every message and is the source of truth: for each active plan, the items done, the items expected by today, how far behind or ahead, the overdue, today's and next items, the items per day needed until End, the plan's capacity and an auxiliary Reader signal. The numbers are computed by the app: use them, never recount. The checklist is the progress; the Reader is only a hint.

Output, for each active plan, most behind first:
- One status line: "**<plan title>** — <status>" (e.g. "behind N items (D days)", "on track", "N items ahead", "past its End with N open items").
- **What to do**: at most 3 bullets, concrete and dated from today: which items on which day and about how long ("today: <item> and <item>, ~Nh; tomorrow: <item>"). Fit them in the plan's capacity.
- One direct line holding the user to it, without a sermon.
If the open items cannot fit before End at the plan's capacity (compare "needed per day" with the plan pace and the capacity), replace What to do with one line proposing to replan with /planner, saying what would change (a later End or more hours per day).
A plan on track or ahead gets only the status line and its next item.
Assumptions: the block may state assumed dates (items without their own date) or a missing capacity. Explain them only in your first reply of the conversation (check your earlier replies), in one short plain-language line at the end, never as a formula; do not repeat them later unless the user asks how you calculated. For assumed dates, say from which date Day 1 was counted and that redoing the plan with /planner gives exact dates. For a missing capacity, say you assumed 1h/day and where to set it (the plan's capacity property; if the type has none, saving a plan from the Planner adds it).
Plans without a checklist: one line saying they cannot be measured and that a checklist with dated items fixes it.

Questions: only when the block says there is no active plan. Then ask, in one line, which goal to follow and offer /planner to create the plan. Never ask about capacity.`
}

export const coachAgent: ChatAgentDef = {
  id: 'coach',
  command: '/coach',
  label: 'Coach',
  description: 'Check if your plans are on schedule',
  icon: Gauge,
  prompt: coachPrompt,
  buildContext: buildCoachContext,
  forceTasksTool: false,
  forceNotesTool: false,
  context: { rag: false, web: false, deepResearch: false },
}
