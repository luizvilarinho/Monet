import type { Notebook, TaskStatus, TaskStatusDef } from '../types'
import { toDateKey } from './calendar'
import {
  addDaysKey,
  BUILTIN_STATUS_DEFS,
  findProjectByTag,
  formatDueShort,
  normalizeName,
  type ProjectChoice,
} from './tasks'

// Quick add do "New task…": tokens isolados (separados por espaço) viram
// campos da task; o resto é o título.
//   today/hoje, tomorrow/amanhã, dia da semana (EN/PT), dd/mm[/yyyy] → Do date
//   !<data>   → Deadline
//   #Projeto  → caderno existente; nome desconhecido só após confirmação
//   @status   → status pelo nome (sem espaços, sem diferenciar maiúsculas)
//   !!        → important
// Repetição do mesmo tipo: o último vence (os anteriores ficam no título).

export type QuickAddTokenKind = 'date' | 'deadline' | 'project' | 'status' | 'important'

export interface QuickAddToken {
  start: number
  end: number
  // Texto do token como digitado (identifica o chip para ignorar/confirmar).
  raw: string
  kind: QuickAddTokenKind
  label: string
  // `#Nome` sem caderno correspondente: só vale depois de confirmado.
  needsConfirm?: boolean
}

export interface QuickAddResult {
  title: string
  scheduledDate: string | null
  dueDate: string | null
  status: TaskStatus | null
  important: boolean
  project: ProjectChoice | null
  tokens: QuickAddToken[]
}

interface QuickAddOptions {
  notebooks: Notebook[]
  todayKey: string
  // Tokens (raw, minúsculo) descartados pelo usuário: ficam no título.
  ignored: Set<string>
  // Projetos novos (`#Nome`, raw minúsculo) confirmados pelo usuário.
  confirmed: Set<string>
  // Registro de status (padrão: built-ins).
  statuses?: TaskStatusDef[]
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, dom: 0, domingo: 0,
  mon: 1, monday: 1, seg: 1, segunda: 1,
  tue: 2, tuesday: 2, ter: 2, terca: 2,
  wed: 3, wednesday: 3, qua: 3, quarta: 3,
  thu: 4, thursday: 4, qui: 4, quinta: 4,
  fri: 5, friday: 5, sex: 5, sexta: 5,
  sat: 6, saturday: 6, sab: 6, sabado: 6,
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function keyDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Data de um token (sem o `!`), ou null se não for data.
function parseDateWord(word: string, todayKey: string): string | null {
  const w = normalizeName(word)
  if (w === 'today' || w === 'hoje') return todayKey
  if (w === 'tomorrow' || w === 'amanha') return addDaysKey(todayKey, 1)
  if (w in WEEKDAYS) {
    // Próxima ocorrência, incluindo hoje.
    const diff = (WEEKDAYS[w] - keyDate(todayKey).getDay() + 7) % 7
    return addDaysKey(todayKey, diff)
  }
  const m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2]) - 1
  const today = keyDate(todayKey)
  let year = m[3] ? Number(m[3]) : today.getFullYear()
  const valid = (y: number) => {
    const d = new Date(y, month, day)
    return d.getMonth() === month && d.getDate() === day
  }
  if (!valid(year)) return null
  // Sem ano: se a data já passou neste ano, é a do ano seguinte.
  if (!m[3] && toDateKey(year, month, day) < todayKey) {
    year += 1
    if (!valid(year)) return null
  }
  return toDateKey(year, month, day)
}

// Status cujo nome, sem espaços/acentos, casa exatamente com `word` (sem o `@`).
function findStatusByTag(statuses: TaskStatusDef[], word: string): TaskStatusDef | undefined {
  const wanted = normalizeName(word)
  if (!wanted) return undefined
  return statuses.find((s) => normalizeName(s.name).replace(/\s+/g, '') === wanted || s.id === wanted)
}

function dayLabel(key: string): string {
  const d = keyDate(key)
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}`
}

export function parseQuickAdd(input: string, opts: QuickAddOptions): QuickAddResult {
  const { notebooks, todayKey, ignored, confirmed, statuses = BUILTIN_STATUS_DEFS } = opts
  const accepted = new Map<QuickAddTokenKind, QuickAddToken>()
  const pending: QuickAddToken[] = []
  let scheduledDate: string | null = null
  let dueDate: string | null = null
  let status: TaskStatus | null = null
  let important = false
  let project: ProjectChoice | null = null

  for (const m of input.matchAll(/\S+/g)) {
    const raw = m[0]
    const start = m.index ?? 0
    const end = start + raw.length
    const lower = raw.toLowerCase()
    if (ignored.has(lower)) continue
    const base = { start, end, raw }

    if (raw === '!!') {
      important = true
      accepted.set('important', { ...base, kind: 'important', label: '⚑ Important' })
      continue
    }
    if (raw.startsWith('!') && !raw.startsWith('!!')) {
      const date = parseDateWord(raw.slice(1), todayKey)
      if (date) {
        dueDate = date
        accepted.set('deadline', { ...base, kind: 'deadline', label: `Deadline ${formatDueShort(date)}` })
      }
      continue
    }
    const date = parseDateWord(raw, todayKey)
    if (date) {
      scheduledDate = date
      accepted.set('date', { ...base, kind: 'date', label: `Do ${dayLabel(date)}` })
      continue
    }
    if (raw.length > 1 && raw.startsWith('@')) {
      const def = findStatusByTag(statuses, raw.slice(1))
      if (def) {
        status = def.id
        accepted.set('status', { ...base, kind: 'status', label: def.name })
        continue
      }
    }
    // `#` só no início da palavra e com algo além de dígitos (`#1` não é projeto).
    if (raw.length > 1 && raw.startsWith('#') && !/^#\d+$/.test(raw)) {
      const name = raw.slice(1)
      const nb = findProjectByTag(notebooks, name)
      if (nb) {
        project = { notebookId: nb.id }
        accepted.set('project', { ...base, kind: 'project', label: `#${nb.name}` })
      } else if (confirmed.has(lower)) {
        project = { newName: name }
        accepted.set('project', { ...base, kind: 'project', label: `#${name}` })
      } else {
        pending.push({ ...base, kind: 'project', label: `Create #${name}?`, needsConfirm: true })
      }
    }
  }

  const tokens = [...accepted.values()].sort((a, b) => a.start - b.start)
  let title = ''
  let pos = 0
  for (const t of tokens) {
    title += input.slice(pos, t.start)
    pos = t.end
  }
  title = (title + input.slice(pos)).replace(/\s+/g, ' ').trim()

  return {
    title,
    scheduledDate,
    dueDate,
    status,
    important,
    project,
    tokens: [...tokens, ...pending].sort((a, b) => a.start - b.start),
  }
}
