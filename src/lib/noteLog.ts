import { nanoid } from 'nanoid'
import type { MetadataDef, MetadataType, Note, NoteLogConfig, NoteType } from '../types'
import { METADATA_TYPE_LABEL } from './metadata'
import { MAX_LIST_PROPERTIES, typeDefs } from './noteTypes'
import { addDaysKey, normalizeName } from './tasks'
import { isTrackerTypeNote, noteDayKey } from './trackers'

// Log de um tipo de nota: as notas do tipo como sessões ao longo do tempo
// (contagem, soma, tendência e agrupamento). Regras puras de config (leitura
// defensiva, candidatas, limpeza ao apagar propriedade), de entradas e de
// agregação. Nada aqui conhece um tipo específico, exceto `practiceSaveChanges`.

// JSON da coluna `note_types.log`. Inválido ou que não é objeto = Log desligado;
// `{}` é um Log ligado sem nenhuma propriedade.
export function parseLogConfig(raw: string | null): NoteLogConfig | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  return {
    sumDefId: typeof o.sumDefId === 'string' ? o.sumDefId : null,
    trendDefId: typeof o.trendDefId === 'string' ? o.trendDefId : null,
    groupDefId: typeof o.groupDefId === 'string' ? o.groupDefId : null,
  }
}

// Candidatas entre as propriedades do tipo (`typeDefs`).
export function logSumCandidates(defs: MetadataDef[]): MetadataDef[] {
  return defs.filter((d) => d.type === 'number')
}

export function logTrendCandidates(defs: MetadataDef[]): MetadataDef[] {
  return defs.filter((d) => d.type === 'number')
}

export function logGroupCandidates(defs: MetadataDef[]): MetadataDef[] {
  return defs.filter((d) => d.type === 'select' || d.type === 'text')
}

export interface ResolvedLog {
  config: NoteLogConfig
  sum: MetadataDef | null
  trend: MetadataDef | null
  group: MetadataDef | null
}

// Leitura defensiva: a config pode apontar para uma propriedade apagada (até
// por outra janela), de outro tipo ou de tipo de dado errado; a referência
// inválida é ignorada e o Log continua ligado, mesmo sem nenhuma.
export function resolveLog(type: NoteType, allDefs: MetadataDef[]): ResolvedLog | null {
  const config = type.log
  if (!config) return null
  const defs = typeDefs(allDefs, type.id)
  return {
    config,
    sum: logSumCandidates(defs).find((d) => d.id === config.sumDefId) ?? null,
    trend: logTrendCandidates(defs).find((d) => d.id === config.trendDefId) ?? null,
    group: logGroupCandidates(defs).find((d) => d.id === config.groupDefId) ?? null,
  }
}

// Propriedade apagada: só a referência sai. Devolve o mesmo objeto quando nada
// muda.
export function stripDefFromLog(log: NoteLogConfig, defId: string): NoteLogConfig {
  if (log.sumDefId !== defId && log.trendDefId !== defId && log.groupDefId !== defId) return log
  return {
    sumDefId: log.sumDefId === defId ? null : log.sumDefId,
    trendDefId: log.trendDefId === defId ? null : log.trendDefId,
    groupDefId: log.groupDefId === defId ? null : log.groupDefId,
  }
}

export type LogPeriod = 'month' | 'lastMonth' | '90d' | '12m'

export const LOG_PERIODS: Array<{ id: LogPeriod; label: string }> = [
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: '90d', label: '90 days' },
  { id: '12m', label: '12 months' },
]

// Janelas móveis (terminam hoje, hoje incluído): 90 days e 12 months.
const ROLLING_DAYS = { '90d': 90, '12m': 365 }

function monthStartKey(key: string): string {
  return `${key.slice(0, 7)}-01`
}

// Primeiro e último dia (inclusivos) do período. "This month" vai do dia 1 até
// hoje; "Last month" é o mês de calendário anterior inteiro.
export function logPeriodRange(period: LogPeriod, todayKey: string): { from: string; to: string } {
  if (period === 'month') return { from: monthStartKey(todayKey), to: todayKey }
  if (period === 'lastMonth') {
    const to = addDaysKey(monthStartKey(todayKey), -1)
    return { from: monthStartKey(to), to }
  }
  return { from: addDaysKey(todayKey, -(ROLLING_DAYS[period] - 1)), to: todayKey }
}

export interface LogEntry {
  note: Note
  day: string
}

// Notas do Log: as notas ativas do tipo, de todos os cadernos (a mesma regra dos
// dias vindos de nota dos trackers).
export function logNotes(notes: Note[], typeId: string): Note[] {
  return notes.filter((n) => isTrackerTypeNote(n, typeId))
}

// Caderno da nota nova do "New session": o da nota mais recente do tipo (por
// criação); sem nenhuma nota do tipo, null (quem chama usa o caderno ativo).
export function logNewNoteNotebookId(notes: Note[], typeId: string): string | null {
  let latest: Note | null = null
  for (const n of logNotes(notes, typeId)) if (!latest || n.createdAt > latest.createdAt) latest = n
  return latest?.notebookId ?? null
}

// Entradas com o dia em [from, to] (inclusivo), da mais recente para a mais
// antiga (dia desc, depois `updatedAt` desc).
export function logEntries(notes: Note[], typeId: string, from: string, to: string): LogEntry[] {
  return logNotes(notes, typeId)
    .map((note) => ({ note, day: noteDayKey(note) }))
    .filter((e) => e.day >= from && e.day <= to)
    .sort((a, b) => (a.day === b.day ? b.note.updatedAt - a.note.updatedAt : a.day < b.day ? 1 : -1))
}

export interface LogTrend {
  first: number
  last: number
  points: number[]
}

export interface LogGroup {
  key: string
  label: string
  sessions: number
  sum: number | null
  trend: LogTrend | null
}

export interface LogSummary {
  sessions: number
  // Dias distintos com ao menos uma sessão (duas notas no mesmo dia contam um dia).
  days: number
  sum: number | null
  trend: LogTrend | null
  groups: LogGroup[]
}

// Chave e rótulo do grupo sem valor (select vazio ou com opção apagada, text vazio).
export const LOG_NO_VALUE_KEY = '__none__'
const NO_VALUE_LABEL = 'No value'

function numberValue(note: Note, def: MetadataDef): number | null {
  const v = note.properties?.[def.id]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// `entries` em ordem cronológica.
function sumOf(entries: LogEntry[], def: MetadataDef | null): number | null {
  if (!def) return null
  return entries.reduce((total, e) => total + (numberValue(e.note, def) ?? 0), 0)
}

function trendOf(entries: LogEntry[], def: MetadataDef | null): LogTrend | null {
  if (!def) return null
  const points = entries.flatMap((e) => {
    const v = numberValue(e.note, def)
    return v === null ? [] : [v]
  })
  return points.length > 0 ? { first: points[0], last: points[points.length - 1], points } : null
}

// Grupo da entrada pela propriedade `def`. Select: id da opção (opção apagada
// ou vazio = sem valor). Text: o texto aparado, sem caixa e com os acentos; o
// rótulo é o texto aparado como foi escrito.
function groupOf(note: Note, def: MetadataDef): { key: string; label: string } {
  const v = note.properties?.[def.id]
  const none = { key: LOG_NO_VALUE_KEY, label: NO_VALUE_LABEL }
  if (v === undefined || v === null) return none
  if (def.type === 'select') {
    const option = def.options?.find((o) => o.id === v)
    return option ? { key: option.id, label: option.name } : none
  }
  const text = String(v).trim()
  return text ? { key: text.toLowerCase(), label: text } : none
}

export function sessionsLabel(n: number): string {
  return `${n} ${n === 1 ? 'session' : 'sessions'}`
}

// Linha de totais: "14 sessions on 12 days" (dias distintos; duas sessões no
// mesmo dia contam um dia). Sem sessão, só "0 sessions".
export function logTotalsLabel(sessions: number, days: number): string {
  return sessions === 0 ? sessionsLabel(0) : `${sessionsLabel(sessions)} on ${days} ${days === 1 ? 'day' : 'days'}`
}

// Sessões, soma, tendência e grupos das entradas. A tendência vai do primeiro
// ao último valor em ordem cronológica; valor não numérico é ignorado.
export function summarizeLog(entries: LogEntry[], resolved: ResolvedLog): LogSummary {
  const chronological = [...entries].sort((a, b) =>
    a.day === b.day ? a.note.updatedAt - b.note.updatedAt : a.day < b.day ? -1 : 1
  )
  const byGroup = new Map<string, { label: string; entries: LogEntry[] }>()
  if (resolved.group) {
    for (const entry of chronological) {
      const { key, label } = groupOf(entry.note, resolved.group)
      const group = byGroup.get(key)
      if (group) group.entries.push(entry)
      else byGroup.set(key, { label, entries: [entry] })
    }
  }
  const groups = [...byGroup].map(([key, g]) => ({
    key,
    label: g.label,
    sessions: g.entries.length,
    sum: sumOf(g.entries, resolved.sum),
    trend: trendOf(g.entries, resolved.trend),
  }))
  groups.sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label))
  return {
    sessions: entries.length,
    days: new Set(entries.map((e) => e.day)).size,
    sum: sumOf(chronological, resolved.sum),
    trend: trendOf(chronological, resolved.trend),
    groups,
  }
}

// ─── Gravação ("Create 'Practice' type") ────────────────────────────────────

export interface PracticeSavePlan {
  type: NoteType
  newType: boolean
  typeChanged: boolean // o Log foi ligado agora
  newDefs: MetadataDef[] // só o que falta; nada existente muda
  warnings: string[]
}

const PRACTICE_NAME = 'Practice'

// Tipo alvo: o 1º tipo não embutido chamado Practice; senão um tipo novo.
// Acrescenta só as propriedades que faltam, por nome (sem caixa e acentos), e
// liga o Log (Minutes = soma, BPM = tendência, Piece = grupo) quando o tipo
// ainda não tem Log. Nome igual com outro tipo de dado não é recriado (o nome é
// único no tipo): a referência do Log fica vazia e há um aviso. Idempotente (a
// 2ª chamada não cria nem muda nada).
export function practiceSaveChanges(types: NoteType[], defs: MetadataDef[]): PracticeSavePlan {
  const now = Date.now()
  const existing = [...types]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((t) => !t.builtin && normalizeName(t.name.trim()) === normalizeName(PRACTICE_NAME))
  const base: NoteType = existing ?? {
    id: `nt_${nanoid(8)}`,
    name: PRACTICE_NAME,
    icon: 'music',
    color: null,
    template: null,
    sortOrder: types.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1,
    builtin: false,
    createdAt: now,
    board: null,
    log: null,
  }

  const own = typeDefs(defs, base.id)
  const newDefs: MetadataDef[] = []
  const warnings: string[] = []
  let order = own.reduce((m, d) => Math.max(m, d.sortOrder), 0)
  let listed = own.filter((d) => d.showInList).length
  // `alsoSelect`: um select de mesmo nome também serve (Piece como grupo).
  const resolve = (name: string, kind: MetadataType, showInList: boolean, alsoSelect = false): MetadataDef | null => {
    const found = own.find((d) => normalizeName(d.name.trim()) === normalizeName(name))
    if (found) {
      if (found.type === kind || (alsoSelect && found.type === 'select')) return found
      warnings.push(
        `The "${PRACTICE_NAME}" type already has "${found.name}" as ${METADATA_TYPE_LABEL[found.type]}, so the log can't use it. Change it in Note types.`
      )
      return null
    }
    const show = showInList && listed < MAX_LIST_PROPERTIES
    if (show) listed++
    const def: MetadataDef = {
      id: `md_${nanoid(8)}`,
      name,
      type: kind,
      sortOrder: ++order,
      createdAt: now,
      scope: 'note',
      noteTypeId: base.id,
      options: null,
      showInList: show,
    }
    newDefs.push(def)
    return def
  }

  // Ordem das propriedades novas; "show in list" nas três primeiras.
  const piece = resolve('Piece', 'text', true, true)
  const minutes = resolve('Minutes', 'number', true)
  const bpm = resolve('BPM', 'number', true)
  resolve('Focus', 'text', false)

  const typeChanged = base.log === null
  const type: NoteType = typeChanged
    ? { ...base, log: { sumDefId: minutes?.id ?? null, trendDefId: bpm?.id ?? null, groupDefId: piece?.id ?? null } }
    : base
  return { type, newType: !existing, typeChanged, newDefs, warnings }
}

// Retorno do atalho: o que foi criado, completado ou só reaproveitado (a linha de
// status do "Create 'Practice' type").
export function practiceSetupMessage(plan: Pick<PracticeSavePlan, 'newType' | 'typeChanged' | 'newDefs'>): string {
  const names = plan.newDefs.map((d) => d.name).join(', ')
  if (plan.newType) return `Created the ${PRACTICE_NAME} type${names ? ` (${names})` : ''} with a log.`
  const parts: string[] = []
  if (plan.newDefs.length > 0) parts.push(`added ${names}`)
  if (plan.typeChanged) parts.push('turned on its log')
  return parts.length > 0
    ? `Updated the ${PRACTICE_NAME} type: ${parts.join('; ')}.`
    : `The ${PRACTICE_NAME} type was already set up.`
}
