import { addDaysKey, normalizeName } from './tasks'

// Contrato do plano (planner → nota → coach): parser do checklist de uma nota
// de plano, progresso numa data e extração do plano de uma resposta do
// planner. Módulo puro (sem storage).

// ─── Nomes (aliases PT/EN, comparados por nameKey) ──────────────────────────

// Nome sem caixa/acento, espaços colapsados e sem ":"/"." no fim.
export function nameKey(s: string): string {
  return normalizeName(s.replace(/\s+/g, ' ').trim()).replace(/[.:]+$/, '')
}

export const START_NAMES = ['inicio', 'comeco', 'start', 'begin', 'from', 'de']
export const END_NAMES = ['fim', 'termino', 'prazo', 'end', 'deadline', 'until', 'ate', 'due']
export const CAPACITY_NAMES = ['capacidade', 'capacity', 'ritmo', 'pace']
export const BOOK_NAMES = ['livro', 'book', 'material']
export const TITLE_NAMES = ['plan', 'plano', 'title', 'titulo', 'objetivo', 'goal']

// Horas por dia de um valor (number ou texto com número: "1,5", "1.5h");
// aceito se 0 < n <= 24.
export function parseHours(value: unknown): number | null {
  let n: number | null = null
  if (typeof value === 'number') n = value
  else if (typeof value === 'string') {
    const m = value.match(/\d+(?:[.,]\d+)?/)
    if (m) n = Number(m[0].replace(',', '.'))
  }
  return n !== null && Number.isFinite(n) && n > 0 && n <= 24 ? n : null
}

// ─── Regex do checklist ─────────────────────────────────────────────────────

// Mesmo prefixo do CHECKLIST_RE de tasks.ts: os totais batem com checklistProgress.
const ITEM_RE = /^\s*- \[([ xX])\]\s*(.*)$/
// Dia da semana (PT/EN, curto ou por extenso) opcional antes da data: "Seg", "Qua.", "Wed,", "segunda-feira".
const WEEKDAY_PREFIX = String.raw`(?:(?:seg|ter|qua|qui|sex|s[aá]b|dom|mon|tue|wed|thu|fri|sat|sun)[\p{L}-]*\.?,?\s+)?`
// aaaa-mm-dd (grupos 1–3) ou dd/mm[/aaaa] (grupos 4–6).
const DATE_PART = String.raw`(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?)`
// **[dia] data [(dia)] [· rótulo][:]** conteúdo   (o ":" pode estar dentro ou fora do negrito)
const NEW_ITEM_RE = new RegExp(
  String.raw`^\*\*\s*${WEEKDAY_PREFIX}${DATE_PART}(?:\s*\([^)]*\))?\s*(?:[·•|–—-]\s*)?([^*]*?)\s*:?\s*\*\*\s*:?\s*(.*)$`,
  'iu'
)
// Sem negrito: [dia] data [(dia)], um separador (·, :, —…) e o conteúdo.
const PLAIN_ITEM_RE = new RegExp(String.raw`^${WEEKDAY_PREFIX}${DATE_PART}(?:\s*\([^)]*\))?\s*[·•|:–—-]\s*(.*)$`, 'iu')
// Formato antigo: [**]Dia N [(…)][:][**] conteúdo  (PT e EN); "Dias N–M" conta no 1º dia.
const OLD_ITEM_RE =
  /^(?:\*\*)?\s*(?:dias?|days?)\s+(\d{1,3})(?:\s*(?:[–—-]|a|to|até)\s*(\d{1,3}))?\b(?:\s*\([^)]*\))?\s*:?\s*(?:\*\*)?\s*:?\s*(.*)$/i
// Rótulo "Dia N"/"Day N" dentro do formato novo
const DAY_LABEL_RE = /^(?:dia|day)\s+(\d{1,3})$/i
// Escapes que o editor grava (ex.: "\~1h17")
const MD_ESCAPE_RE = /\\([\\`*_{}\[\]()#+\-.!~|>])/g
// Páginas de um item (sinal do Reader): "p. 41–62", "pág. 41-62", "pp. 41—62"
const PAGES_RE = /(?:pp?|p[aá]g(?:inas?)?|pages?)\.?\s*(\d+)\s*[–—-]\s*(\d+)/i
const LEADING_SEP_RE = /^[-–—:]\s*/
const HEADING_RE = /^#{1,6} /

// ─── Datas ──────────────────────────────────────────────────────────────────

function utcDays(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

// b − a em dias.
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round(utcDays(b) - utcDays(a))
}

function validKey(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// dd/mm[/aaaa] → ISO. Ano explícito ganha (2 dígitos = 2000 + aa). Sem ano, o
// candidato (Y−1, Y, Y+1; Y = ano de `lo`) mais perto de [lo, hi] vence.
function resolveDayMonth(d: number, m: number, year: string | undefined, lo: string, hi: string): string | null {
  if (year) return validKey(year.length === 2 ? 2000 + Number(year) : Number(year), m, d)
  const y = Number(lo.slice(0, 4))
  let best: string | null = null
  let bestDist = Infinity
  for (const cy of [y, y - 1, y + 1]) {
    const key = validKey(cy, m, d)
    if (!key) continue
    const dist = key < lo ? daysBetweenKeys(key, lo) : key > hi ? daysBetweenKeys(hi, key) : 0
    if (dist < bestDist) {
      best = key
      bestDist = dist
    }
  }
  return best
}

// Data de um casamento de DATE_PART (ISO ou dd/mm[/aaaa]).
function matchedDate(m: RegExpMatchArray, lo: string, hi: string): string | null {
  if (m[1]) return validKey(Number(m[1]), Number(m[2]), Number(m[3]))
  return resolveDayMonth(Number(m[4]), Number(m[5]), m[6], lo, hi)
}

// ─── Checklist ──────────────────────────────────────────────────────────────

export interface PlanItem {
  line: number // índice da linha no markdown
  done: boolean
  explicitDate: string | null // data no início do item (dd/mm ou ISO), ISO
  dayNumber: number | null // "Dia N"/"Day N" (rótulo ou formato antigo)
  date: string | null // data efetiva: explicitDate, senão início + N − 1
  label: string
  text: string
}

export type PlanDateRule = 'dated' | 'dayNumber' | 'mixed' | 'none'

export interface PlanChecklist {
  items: PlanItem[]
  rule: PlanDateRule
  warnings: string[] // em inglês, para a IA; o aviso da regra vem primeiro
}

// null = nenhuma linha de checklist.
export function parsePlanChecklist(
  markdown: string,
  start: string | null,
  end: string | null,
  todayKey: string
): PlanChecklist | null {
  const lo = start ?? end ?? todayKey
  const hi = end ?? start ?? todayKey
  const items: PlanItem[] = []
  markdown.split(/\r?\n/).forEach((raw, line) => {
    const m = raw.match(ITEM_RE)
    if (!m) return
    const done = m[1] !== ' '
    const body = m[2].replace(MD_ESCAPE_RE, '$1')
    const nw = body.match(NEW_ITEM_RE)
    const plain = nw ? null : body.match(PLAIN_ITEM_RE)
    const dated = nw ?? plain
    const explicitDate = dated ? matchedDate(dated, lo, hi) : null
    // Data inválida (ex.: 31/02) = item sem data.
    if (dated && explicitDate) {
      const label = nw ? nw[7].trim() : ''
      const day = label.match(DAY_LABEL_RE)
      items.push({
        line,
        done,
        explicitDate,
        dayNumber: day ? Number(day[1]) : null,
        date: null,
        label,
        text: (nw ? nw[8] : plain![7]).replace(LEADING_SEP_RE, '').trim(),
      })
      return
    }
    const old = body.match(OLD_ITEM_RE)
    if (old) {
      const n = Number(old[1])
      items.push({
        line,
        done,
        explicitDate: null,
        dayNumber: n,
        date: null,
        label: old[2] ? `Days ${n}–${old[2]}` : `Day ${n}`,
        text: old[3].replace(LEADING_SEP_RE, '').trim(),
      })
      return
    }
    items.push({ line, done, explicitDate: null, dayNumber: null, date: null, label: '', text: body.trim() })
  })
  if (items.length === 0) return null

  for (const it of items) {
    it.date = it.explicitDate ?? (it.dayNumber !== null && start ? addDaysKey(start, it.dayNumber - 1) : null)
  }

  const explicit = items.filter((i) => i.explicitDate).length
  const dayOnly = items.filter((i) => !i.explicitDate && i.dayNumber !== null).length
  const warnings: string[] = []
  // Avisos em linguagem simples: o agente os repassa ao usuário sem fórmula.
  const dayOneOn = start ? `the plan's start (${start})` : "the plan's start"
  const dayRule = `Day 1 is counted on ${dayOneOn} and each next day number on the next calendar day, weekends included. Redoing the plan with /planner gives each item its own date.`
  let rule: PlanDateRule
  if (explicit > 0 && dayOnly === 0) {
    rule = 'dated'
  } else if (explicit === 0 && dayOnly > 0) {
    rule = 'dayNumber'
    warnings.push(`Assumed dates: the checklist uses day numbers ("Day N") with no date per item. ${dayRule}`)
  } else if (explicit > 0) {
    rule = 'mixed'
    warnings.push(`Assumed dates: items with their own date use it; items with only a day number ("Day N") do not. ${dayRule}`)
  } else {
    rule = 'none'
    warnings.push('No dates in the checklist: only done/total.')
  }
  if (dayOnly > 0 && !start) warnings.push('Day numbers without a start date: "expected" is not computed.')

  const undated = items.filter((i) => i.date === null).length
  if (undated > 0 && undated < items.length) {
    warnings.push(`${undated} item(s) without a date are not counted in "expected".`)
  }
  let prev: string | null = null
  for (const it of items) {
    if (!it.explicitDate) continue
    if (prev && it.explicitDate < prev) {
      warnings.push("Item dates are out of order; the app uses each item's own date.")
      break
    }
    prev = it.explicitDate
  }
  const outside = items.filter(
    (i) => i.date !== null && ((start !== null && i.date < start) || (end !== null && i.date > end))
  ).length
  if (outside > 0) warnings.push(`${outside} item(s) dated outside Start–End.`)

  return { items, rule, warnings }
}

// ─── Progresso ──────────────────────────────────────────────────────────────

export type PlanStatus = 'done' | 'noDates' | 'overdue' | 'notStarted' | 'behind' | 'ahead' | 'onTrack'

export interface PlanProgress {
  total: number
  done: number
  expected: number | null // itens datados com data <= hoje (inclui o de hoje); null sem datas
  doneDated: number
  diffItems: number | null // doneDated − expected
  overdueOpen: PlanItem[] // datados, abertos, data < hoje (por data)
  dueToday: PlanItem[] // abertos com data = hoje
  next: PlanItem[] // até 3 abertos com data > hoje (por data)
  lateDays: number // hoje − data do item aberto mais antigo vencido (0 sem atraso)
  aheadDays: number // sem atrasados e sem item de hoje aberto: (1º aberto − hoje) − 1, mínimo 0
  openDated: number
  openUndated: number
  daysLeft: number | null // fim − hoje + 1 (>= 0); null sem fim
  neededPerDay: number | null // openDated / daysLeft (daysLeft > 0)
  planPace: number | null // itens datados / (fim − início + 1)
  expectedPage: number | null // maior "até" do PAGES_RE nos itens com data <= hoje
  status: PlanStatus
}

const byItemDate = (a: PlanItem, b: PlanItem) => (a.date ?? '').localeCompare(b.date ?? '')

export function planProgress(
  c: PlanChecklist,
  start: string | null,
  end: string | null,
  todayKey: string
): PlanProgress {
  const total = c.items.length
  const done = c.items.filter((i) => i.done).length
  const dated = c.items.filter((i) => i.date !== null)
  const due = dated.filter((i) => i.date! <= todayKey)
  const expected = dated.length > 0 ? due.length : null
  const doneDated = dated.filter((i) => i.done).length
  const open = dated.filter((i) => !i.done)
  const overdueOpen = open.filter((i) => i.date! < todayKey).sort(byItemDate)
  const dueToday = open.filter((i) => i.date === todayKey)
  const upcoming = open.filter((i) => i.date! > todayKey).sort(byItemDate)
  const lateDays = overdueOpen.length > 0 ? daysBetweenKeys(overdueOpen[0].date!, todayKey) : 0
  const aheadDays =
    overdueOpen.length === 0 && dueToday.length === 0 && upcoming.length > 0
      ? Math.max(0, daysBetweenKeys(todayKey, upcoming[0].date!) - 1)
      : 0
  const daysLeft = end ? Math.max(0, daysBetweenKeys(todayKey, end) + 1) : null
  let expectedPage: number | null = null
  for (const it of due) {
    // As páginas podem vir no rótulo ("Ch. 2 (p. 21–40)") ou no conteúdo.
    const m = `${it.label} ${it.text}`.match(PAGES_RE)
    if (m) expectedPage = Math.max(expectedPage ?? 0, Number(m[2]))
  }

  let status: PlanStatus
  if (done === total) status = 'done'
  else if (dated.length === 0) status = 'noDates'
  else if (end && end < todayKey) status = 'overdue'
  else if (start && todayKey < start && done === 0) status = 'notStarted'
  else if (overdueOpen.length > 0) status = 'behind'
  else if (expected !== null && doneDated > expected) status = 'ahead'
  else status = 'onTrack'

  return {
    total,
    done,
    expected,
    doneDated,
    diffItems: expected === null ? null : doneDated - expected,
    overdueOpen,
    dueToday,
    next: upcoming.slice(0, 3),
    lateDays,
    aheadDays,
    openDated: open.length,
    openUndated: c.items.filter((i) => i.date === null && !i.done).length,
    daysLeft,
    neededPerDay: daysLeft !== null && daysLeft > 0 ? open.length / daysLeft : null,
    planPace: start && end ? dated.length / (daysBetweenKeys(start, end) + 1) : null,
    expectedPage,
    status,
  }
}

// ─── Extração da resposta do planner ────────────────────────────────────────

// Rascunho que não pode virar nota de plano: nenhum item com data, ou End
// antes de Start.
export type PlanDraftIssue = 'noDates' | 'endBeforeStart'

export interface PlanDraft {
  title: string | null
  start: string | null // ISO
  end: string | null // ISO
  capacity: number | null
  book: string | null
  // Texto depois de "Replaces:" nas premissas (replanejamento), como veio.
  replaces: string | null
  body: string // o que vai para a nota
  items: number
  datedItems: number
  issue: PlanDraftIssue | null
}

const PAIR_RE = /\*\*\s*([^*:\n]{1,30}?)\s*(?::\s*\*\*|\*\*\s*:)\s*([^·|\n]*)/g
const REPLACES_RE = /\b(?:replaces|substitui)\s*:\s*(.+)$/im
const VALUE_DATE_RE = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?/
// Start sem ano: a ocorrência entre esta folga antes de hoje e ~1 ano depois.
const START_SLACK_DAYS = 7

// Sem ano, a única ocorrência em [lo, lo + 364].
function valueDate(value: string, lo: string): string | null {
  const m = value.match(VALUE_DATE_RE)
  return m ? matchedDate(m, lo, addDaysKey(lo, 364)) : null
}

function valueBook(value: string): string | null {
  const v = value.replace(/^[\s*_"'“”‘’]+|[\s*_"'“”‘’]+$/g, '')
  return !v || ['—', '–', '-', 'none', 'nenhum'].includes(v.toLowerCase()) ? null : v
}

// null = nenhuma linha de checklist (resposta que não é plano, ex.: pergunta).
// Checklist sem item datado ou End antes de Start = rascunho com `issue`.
export function extractPlanDraft(markdown: string, todayKey: string): PlanDraft | null {
  const lines = markdown.split(/\r?\n/)
  let title: string | null = null
  let startValue: string | null = null
  let endValue: string | null = null
  let capacity: number | null = null
  let book: string | null = null
  // 1º par de cada campo vale.
  const seen = new Set<string>()
  const first = (field: string) => {
    if (seen.has(field)) return false
    seen.add(field)
    return true
  }
  for (const line of lines) {
    if (ITEM_RE.test(line)) continue
    for (const m of line.matchAll(PAIR_RE)) {
      const key = nameKey(m[1])
      const value = m[2].trim()
      if (TITLE_NAMES.includes(key)) {
        if (first('title')) title = value.replace(/\*+/g, '').trim().slice(0, 90) || null
      } else if (START_NAMES.includes(key)) {
        if (first('start')) startValue = value
      } else if (END_NAMES.includes(key)) {
        if (first('end')) endValue = value
      } else if (CAPACITY_NAMES.includes(key)) {
        if (first('capacity')) capacity = parseHours(value)
      } else if (BOOK_NAMES.includes(key)) {
        if (first('book')) book = valueBook(value)
      }
    }
  }

  // Sem ano: o Start a partir de hoje (com folga), o End a partir do Start.
  const startLo = addDaysKey(todayKey, -START_SLACK_DAYS)
  let start = startValue ? valueDate(startValue, startLo) : null
  let end = endValue ? valueDate(endValue, start ?? startLo) : null

  // O início lido ancora a inferência de ano dos itens; sem ele, hoje.
  const checklist = parsePlanChecklist(markdown, start, end, todayKey)
  if (!checklist) return null
  const dated = checklist.items.filter((i) => i.date !== null)
  if (dated.length > 0) {
    const dates = dated.map((i) => i.date!).sort()
    if (!start) start = dates[0]
    if (!end) end = dates[dates.length - 1]
  }
  const issue: PlanDraftIssue | null =
    dated.length === 0 ? 'noDates' : start && end && end < start ? 'endBeforeStart' : null

  // Da 1ª à última linha de checklist: só checklist (marcador normalizado) e
  // cabeçalhos, estes com uma linha em branco antes e depois.
  const firstLine = checklist.items[0].line
  const lastLine = checklist.items[checklist.items.length - 1].line
  const out: string[] = []
  for (let i = firstLine; i <= lastLine; i++) {
    const line = lines[i]
    const m = line.match(ITEM_RE)
    if (m) {
      out.push(`- [${m[1] === ' ' ? ' ' : 'x'}] ${m[2]}`)
    } else if (HEADING_RE.test(line.trim())) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      out.push(line.trim(), '')
    }
  }

  const replaces = markdown.match(REPLACES_RE)?.[1].replace(/\*+/g, '').trim() || null

  return {
    title,
    start,
    end,
    capacity,
    book,
    replaces,
    body: out.join('\n').trim(),
    items: checklist.items.length,
    datedItems: dated.length,
    issue,
  }
}
