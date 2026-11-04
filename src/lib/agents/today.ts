import { withWeekday } from '../agenda'
import { isBuiltinStatus } from '../tasks'
import type { AgendaPolicy, AgentDef } from './core'

// O dia da nota do Calendar: o que fazer, o que vence e o que está parado
// (status personalizados). Dia futuro = prévia; dia passado = feito e sobra.

const todayAgenda: AgendaPolicy = ({ calendarKey, todayKey, statuses }) => {
  const when =
    calendarKey === todayKey
      ? 'today'
      : calendarKey > todayKey
        ? 'a future day (preview of that day)'
        : 'a past day (what was done and what was left)'
  const custom = statuses.filter((s) => !isBuiltinStatus(s.id)).map((s) => s.name.trim() || s.id)
  return {
    from: calendarKey,
    to: calendarKey,
    done: calendarKey <= todayKey ? { from: calendarKey, to: calendarKey } : null,
    // O item do plano é o do dia da nota, não o de hoje.
    planDays: { from: calendarKey, to: calendarKey },
    header: [
      `Agenda — the day of the Calendar note: ${withWeekday(calendarKey)}, ${when}.`,
      `Open tasks listed: in progress, overdue as of today (${todayKey}), and planned, scheduled or due on that day.`,
      custom.length > 0
        ? `Custom statuses (Parked): ${custom.join(', ')}.`
        : 'No custom statuses: there is nothing parked.',
    ].join('\n'),
  }
}

export const todayAgent: AgentDef = {
  command: {
    name: '/today',
    description: 'What to do on this day, what is due and what is parked',
    example: '/today',
    takesQuery: false,
    calendarOnly: true,
  },
  label: 'Today',
  complementRules: false,
  behavior: `Role: say what to do on the day of the Calendar note, what is due and what is parked. One day only, no hour estimates.
Use only the "Agenda" block. Its header says whether the day is today, a future day or a past day.
Plan notes come as a "[Plan …]" summary computed by the app (progress, overdue items, and an "Items dated <day>" line with the plan's items for the day of the Calendar note, done or open): take the plan's item for the day from that line as given; never count days or items yourself.
A task is parked when its status (in brackets) is not todo, doing, done or dropped. Parked tasks appear only under Parked.
Today or a future day (for a future day it is a preview), sections titled in the user's language:
- **Today**: 3 to 5 items in the suggested order, chosen from tasks planned for the day ("planned for <day>"), in progress (doing), overdue, due on the day, the day's item of each plan and the commitments written in the daily note.
- **Due / overdue**: one line per item, with its deadline.
- **Parked**: grouped by status name, each group titled "In <status name>", one line per item. Do not call these tasks blocked.
A past day: what was done and what was left on that day. **Done** (completed on that day), **Left** (planned, scheduled or due that day and still open) and **Parked**.
At most about 10 lines in total. Omit an empty section, except the first one. Never invent tasks.`,
  context: {
    note: 'none',
    noteMeta: false,
    rag: null,
    web: 'none',
    agenda: todayAgenda,
    datedNotes: false,
    previousDefinition: false,
  },
}
