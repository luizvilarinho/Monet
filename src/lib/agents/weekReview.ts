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
Use only the "Agenda" block (tasks, TODOS deliverables, dated notes, ongoing plans and Calendar daily notes).
Three short sections, titled in the user's language:
- **Done**: what was completed or happened in the "Done" period (completed tasks, TODOS progress, activities in notes and daily notes).
- **Pending**: what was due in the week and was not done, plus anything overdue, ordered by deadline, with overdue items marked.
- **Slipped**: postponed tasks ("postponed Nx") and ongoing plans that are behind (checklist progress lower than expected for the date), when the agenda shows it.
Start Done and Pending with their period as a short date range. One line per item. No hour estimates and no distribution across days. If a section has nothing, say so in one line. If a Parameter is given, focus on it. Never invent tasks, dates or deliverables.`,
  context: {
    note: 'none',
    noteMeta: false,
    rag: null,
    web: 'none',
    agenda: weekReviewAgenda,
    datedNotes: false,
    previousDefinition: false,
  },
}
