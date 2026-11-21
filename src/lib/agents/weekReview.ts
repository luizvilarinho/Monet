import { withWeekday } from '../agenda'
import { addDaysKey, startOfWeekKey } from '../tasks'
import type { AgendaPolicy, AgentDef } from './core'

// Revisão da semana do calendário da nota (segunda a domingo): feito,
// pendente e escorregado. Não é plano.

// Semana futura: o "Done" fica vazio (doneTo < from).
const weekReviewAgenda: AgendaPolicy = ({ calendarKey, todayKey }) => {
  const from = startOfWeekKey(calendarKey)
  const to = addDaysKey(from, 6)
  const doneTo = to < todayKey ? to : todayKey
  return {
    from,
    to,
    done: { from, to: doneTo },
    header: [
      `Agenda — calendar week of the Calendar note of ${withWeekday(calendarKey)}: ${from} (Monday) to ${to} (Sunday).`,
      doneTo >= from
        ? `"Done" period: ${from} to ${doneTo}.`
        : '"Done" period: none (the week has not started yet).',
      `"Pending": open tasks due, scheduled or planned in the week, plus anything overdue as of today (${todayKey}).`,
    ].join('\n'),
  }
}

export const weekReviewAgent: AgentDef = {
  command: {
    name: '/week-review',
    description: 'Done, pending and slipped in the calendar week (Mon–Sun)',
    example: '/week-review',
    takesQuery: true,
    optionalQuery: true,
    calendarOnly: true,
  },
  label: 'Week review',
  complementRules: false,
  behavior: `Role: record the user's calendar week in the daily note. It is a review, not a plan.
Use only the "Agenda" block (tasks, TODOS deliverables, dated notes, ongoing plans and Calendar daily notes). Plan notes come as a "[Plan …]" summary computed by the app (progress, behind or ahead, overdue items): use its numbers as given; never count days or items yourself.
Up to four short sections, titled in the user's language:
- **Done**: what was completed or happened in the "Done" period (completed tasks, TODOS progress, activities in notes and daily notes).
- **Pending**: what was due in the week and was not done, plus anything overdue, ordered by deadline, with overdue items marked.
- **Slipped**: postponed tasks ("postponed Nx") and plans whose summary says they are behind or past their End, with the summary's numbers.
- **Trackers**: only when the Agenda has a "Trackers in this week" block. One line per tracker: "<name>: n/target" and its status from the block (on target, below target, in progress with days left). Use the block's numbers; never estimate.
Start Done and Pending with their period as a short date range. One line per item. No hour estimates and no distribution across days. If Done, Pending or Slipped has nothing, say so in one line. Without a "Trackers in this week" block in the Agenda, leave out the Trackers section: do not write it, not even to say there is nothing. If a Parameter is given, focus on it. Never invent tasks, dates or deliverables.`,
  context: {
    note: 'none',
    noteMeta: false,
    rag: null,
    web: 'none',
    agenda: weekReviewAgenda,
    datedNotes: false,
    previousDefinition: false,
    trackers: true,
  },
}
