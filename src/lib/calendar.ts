// O notebook "Calendar" é um singleton com id fixo. Antes era identificado por
// um id aleatório guardado em localStorage; quando localStorage e banco
// divergiam, o app recriava um Calendar novo a cada abertura (duplicatas, e
// notas que "sumiam" por ficarem sob um Calendar antigo). Com id fixo, a PK do
// banco garante unicidade e o save é idempotente.
export const CALENDAR_NOTEBOOK_ID = 'calendar'

export const CALENDAR_TITLE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/

export function formatCalendarTitle(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

export function parseCalendarTitle(title: string): Date | null {
  const match = title.trim().match(CALENDAR_TITLE_RE)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function getWeekdayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}
