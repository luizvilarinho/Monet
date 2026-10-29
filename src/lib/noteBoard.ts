import type { MetadataDef, MetadataValue, Note, NoteBoardConfig, NoteType } from '../types'
import { canHaveType, typeDefs } from './noteTypes'

// Board em cards de um tipo de nota: regras puras de config (leitura
// defensiva, candidatas, limpeza ao apagar propriedade) e de colunas. Nada
// aqui conhece um tipo específico.

export const MAX_CARD_FIELDS = 3

// Chaves de coluna/seção que não são id de opção.
export const NO_VALUE_KEY = '__none__'
export const YES_KEY = 'yes'
export const NO_KEY = 'no'

// JSON da coluna `note_types.board`. Inválido ou sem coluna = sem board.
export function parseBoardConfig(raw: string | null): NoteBoardConfig | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  if (typeof o.columnDefId !== 'string') return null
  return {
    columnDefId: o.columnDefId,
    sectionDefId: typeof o.sectionDefId === 'string' ? o.sectionDefId : null,
    cardDefIds: Array.isArray(o.cardDefIds)
      ? o.cardDefIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_CARD_FIELDS)
      : [],
    showTags: typeof o.showTags === 'boolean' ? o.showTags : true,
    hideEmpty: typeof o.hideEmpty === 'boolean' ? o.hideEmpty : false,
    filterDefId: typeof o.filterDefId === 'string' ? o.filterDefId : null,
  }
}

// Candidatas entre as propriedades do tipo (`typeDefs`).
export function boardColumnCandidates(defs: MetadataDef[]): MetadataDef[] {
  return defs.filter((d) => d.type === 'select' || d.type === 'checkbox')
}

export function boardSectionCandidates(defs: MetadataDef[], columnDefId: string): MetadataDef[] {
  return defs.filter((d) => d.type === 'select' && d.id !== columnDefId)
}

export function boardFilterCandidates(defs: MetadataDef[], columnDefId: string): MetadataDef[] {
  return defs.filter((d) => d.type === 'checkbox' && d.id !== columnDefId)
}

export function boardCardCandidates(defs: MetadataDef[], columnDefId: string): MetadataDef[] {
  return defs.filter((d) => d.id !== columnDefId)
}

export interface ResolvedBoard {
  config: NoteBoardConfig
  column: MetadataDef
  section: MetadataDef | null
  // Na ordem das propriedades do tipo.
  cardDefs: MetadataDef[]
  filter: MetadataDef | null
}

// Leitura defensiva: a config pode apontar para uma propriedade apagada (até
// por outra janela), de outro tipo ou de tipo de dado errado. Coluna inválida
// = sem board; seção, filtro e campos inválidos são ignorados.
export function resolveBoard(type: NoteType, allDefs: MetadataDef[]): ResolvedBoard | null {
  const config = type.board
  if (!config) return null
  const defs = typeDefs(allDefs, type.id)
  const column = boardColumnCandidates(defs).find((d) => d.id === config.columnDefId)
  if (!column) return null
  return {
    config,
    column,
    section: boardSectionCandidates(defs, column.id).find((d) => d.id === config.sectionDefId) ?? null,
    cardDefs: boardCardCandidates(defs, column.id)
      .filter((d) => config.cardDefIds.includes(d.id))
      .slice(0, MAX_CARD_FIELDS),
    filter: boardFilterCandidates(defs, column.id).find((d) => d.id === config.filterDefId) ?? null,
  }
}

// "Show as board" ligado: 1º select (senão 1º checkbox) nas colunas e os
// campos "show in list" no card. null = o tipo não tem candidata.
export function defaultBoardConfig(defs: MetadataDef[]): NoteBoardConfig | null {
  const column = defs.find((d) => d.type === 'select') ?? defs.find((d) => d.type === 'checkbox')
  if (!column) return null
  return {
    columnDefId: column.id,
    sectionDefId: null,
    cardDefIds: defs
      .filter((d) => d.showInList && d.id !== column.id)
      .slice(0, MAX_CARD_FIELDS)
      .map((d) => d.id),
    showTags: true,
    hideEmpty: false,
    filterDefId: null,
  }
}

// Propriedade apagada: sendo a coluna, o board some; senão só a referência
// sai. Devolve o mesmo objeto quando nada muda.
export function stripDefFromBoard(board: NoteBoardConfig, defId: string): NoteBoardConfig | null {
  if (board.columnDefId === defId) return null
  const cardDefIds = board.cardDefIds.filter((id) => id !== defId)
  if (
    board.sectionDefId !== defId &&
    board.filterDefId !== defId &&
    cardDefIds.length === board.cardDefIds.length
  ) {
    return board
  }
  return {
    ...board,
    sectionDefId: board.sectionDefId === defId ? null : board.sectionDefId,
    filterDefId: board.filterDefId === defId ? null : board.filterDefId,
    cardDefIds,
  }
}

// Notas do board: do tipo, ativas e de caderno (fora Calendar e nota-corpo
// de task), de todos os cadernos.
export function isBoardNote(note: Note, typeId: string): boolean {
  return note.typeId === typeId && !note.archivedAt && canHaveType(note)
}

// Com filtro (checkbox), só as notas com a caixa marcada.
export function boardNotes(notes: Note[], resolved: ResolvedBoard, typeId: string): Note[] {
  const { filter } = resolved
  return notes.filter((n) => isBoardNote(n, typeId) && (!filter || n.properties?.[filter.id] === true))
}

// Coluna (ou seção) da nota pela propriedade `def`. Select: id da opção;
// vazio ou id de opção apagada (`orphan`) = "No value". Checkbox: só `true`
// é Yes; sem valor conta como No.
export function columnKeyOf(note: Note, def: MetadataDef): { key: string; orphan: boolean } {
  const value = note.properties?.[def.id]
  if (def.type === 'checkbox') return { key: value === true ? YES_KEY : NO_KEY, orphan: false }
  if (value === undefined || value === null || value === '') return { key: NO_VALUE_KEY, orphan: false }
  if (def.options?.some((o) => o.id === value)) return { key: value as string, orphan: false }
  return { key: NO_VALUE_KEY, orphan: true }
}

// Valor gravado ao soltar o card na coluna `key` (null remove a chave).
export function valueForKey(def: MetadataDef, key: string): MetadataValue {
  if (def.type === 'checkbox') return key === YES_KEY
  return key === NO_VALUE_KEY ? null : key
}

// Propriedades com um valor trocado; null ou '' remove a chave (como a barra
// de propriedades da nota).
export function withPropertyValue(
  props: Record<string, MetadataValue> | undefined,
  defId: string,
  value: MetadataValue
): Record<string, MetadataValue> {
  const { [defId]: _old, ...rest } = props ?? {}
  return value === null || value === '' ? rest : { ...rest, [defId]: value }
}

function titleOf(note: Note): string {
  return note.title.trim() || 'Untitled'
}

export function compareNoteTitles(a: Note, b: Note): number {
  return titleOf(a).localeCompare(titleOf(b))
}

export interface BoardNoteSection {
  key: string
  label: string
  notes: Note[]
}

export interface BoardNoteColumn {
  key: string
  title: string
  color: string | null
  notes: Note[]
  // Notas com id de opção apagada (só na coluna "No value").
  orphanCount: number
  sections?: BoardNoteSection[]
}

// Rótulo da seção (e do chip) sem valor: "No <Seção>", para não repetir o
// "No value" da coluna.
export function noSectionLabel(section: MetadataDef): string {
  return `No ${section.name}`
}

// Colunas do board. Select: opções na ordem da propriedade + "No value" no
// fim (oculta com `hideEmpty`, a não ser que tenha nota com opção apagada).
// Checkbox: Yes e No. Com seção: opções do select de seção + "No <Seção>" no
// fim, todas, inclusive as vazias (alvo de drop e de "New"), e só as
// escolhidas em `sectionFilter` (quem chama já tirou as notas fora do
// filtro). Cards por título.
export function buildBoardColumns(
  notes: Note[],
  resolved: ResolvedBoard,
  sectionFilter: Set<string> | null
): BoardNoteColumn[] {
  const { column, section, config } = resolved
  const heads =
    column.type === 'checkbox'
      ? [
          { key: YES_KEY, title: 'Yes', color: null },
          { key: NO_KEY, title: 'No', color: null },
        ]
      : [
          ...(column.options ?? []).map((o) => ({ key: o.id, title: o.name, color: o.color })),
          { key: NO_VALUE_KEY, title: 'No value', color: null },
        ]
  const columns: BoardNoteColumn[] = heads.map((h) => ({ ...h, notes: [], orphanCount: 0 }))
  const byKey = new Map(columns.map((c) => [c.key, c]))
  for (const note of [...notes].sort(compareNoteTitles)) {
    const { key, orphan } = columnKeyOf(note, column)
    const target = byKey.get(key)
    if (!target) continue
    target.notes.push(note)
    if (orphan) target.orphanCount += 1
  }
  const visible =
    column.type === 'select' && config.hideEmpty
      ? columns.filter((c) => c.key !== NO_VALUE_KEY || c.orphanCount > 0)
      : columns
  if (!section) return visible
  const sectionHeads = [
    ...(section.options ?? []).map((o) => ({ key: o.id, label: o.name })),
    { key: NO_VALUE_KEY, label: noSectionLabel(section) },
  ].filter((s) => !sectionFilter || sectionFilter.has(s.key))
  return visible.map((c) => ({
    ...c,
    sections: sectionHeads
      .map((s) => ({ ...s, notes: c.notes.filter((n) => columnKeyOf(n, section).key === s.key) })),
  }))
}

// Ids dos cards na ordem em que aparecem: coluna a coluna, seção a seção
// (Prev/Next do modal "Edit note").
export function boardNoteOrder(columns: BoardNoteColumn[]): string[] {
  return columns.flatMap((c) => (c.sections ?? [{ notes: c.notes }]).flatMap((s) => s.notes.map((n) => n.id)))
}

// Propriedades da nota criada pelo "New" de uma coluna (e seção): os mesmos
// valores que soltar o card ali gravaria e, com filtro, a caixa marcada (senão
// a nota não entra no board).
export function newNoteProperties(
  resolved: ResolvedBoard,
  columnKey: string,
  sectionKey?: string
): Record<string, MetadataValue> {
  let props = withPropertyValue({}, resolved.column.id, valueForKey(resolved.column, columnKey))
  if (resolved.section && sectionKey !== undefined) {
    props = withPropertyValue(props, resolved.section.id, valueForKey(resolved.section, sectionKey))
  }
  if (resolved.filter) props = withPropertyValue(props, resolved.filter.id, true)
  return props
}

// Campo CSV (RFC 4180): entre aspas se tiver vírgula, aspas, CR ou LF, com a
// aspa dobrada.
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Campo de dado que começa com = + - @ vira fórmula no Excel/Sheets: ganha o
// prefixo ' (vira texto). Número (ex.: -3) fica como está.
export function csvSafe(value: string): string {
  return /^[=+\-@]/.test(value) && !Number.isFinite(Number(value)) ? `'${value}` : value
}

// Valor de uma propriedade no CSV: select = nome da opção (vazio se apagada),
// checkbox = yes/no, demais = texto; vazio = ''.
function csvValue(note: Note, def: MetadataDef): string {
  const value = note.properties?.[def.id]
  if (value === undefined || value === null || value === '') return ''
  if (def.type === 'select') return def.options?.find((o) => o.id === value)?.name ?? ''
  if (def.type === 'checkbox') return value === true ? 'yes' : 'no'
  return String(value)
}

const BYOR_COLUMNS = ['name', 'ring', 'quadrant', 'isNew', 'description']
const DESCRIPTION_PROPERTY = 'description'

function byorKey(name: string): string {
  return name.trim().toLowerCase()
}

// CSV no formato do Build your own Radar (name, ring, quadrant, isNew,
// description) + as demais propriedades do tipo. ring = valor da coluna,
// quadrant = valor da seção, description = a propriedade "Description" (sem
// caixa) ou, sem ela ou vazia, `paragraphOf(note)` (1º parágrafo da nota, já
// limpo por quem chama). Extra com nome de coluna do BYOR ganha o sufixo
// " (property)". Linhas = os cards visíveis (`columns`), na ordem coluna →
// seção → título; CRLF, sem BOM; dados com `csvSafe` (o cabeçalho não, para o
// BYOR achar as colunas). `rings`/`quadrants` contam os valores distintos não
// vazios (o BYOR aceita até 4 de cada).
export function boardCsv(
  columns: BoardNoteColumn[],
  resolved: ResolvedBoard,
  defs: MetadataDef[],
  paragraphOf: (note: Note) => string
): { csv: string; rows: number; rings: number; quadrants: number } {
  const { column, section } = resolved
  const others = defs.filter((d) => d.id !== column.id && d.id !== section?.id)
  const description = others.find((d) => byorKey(d.name) === DESCRIPTION_PROPERTY) ?? null
  const extras = others.filter((d) => d !== description)
  const extraNames = extras.map((d) =>
    BYOR_COLUMNS.some((c) => byorKey(c) === byorKey(d.name)) ? `${d.name} (property)` : d.name
  )
  const lines = [[...BYOR_COLUMNS, ...extraNames]]
  const rings = new Set<string>()
  const quadrants = new Set<string>()
  for (const c of columns) {
    const ring = c.key === NO_VALUE_KEY ? '' : c.title
    const groups = c.sections ?? [{ key: NO_VALUE_KEY, label: '', notes: c.notes }]
    for (const g of groups) {
      const quadrant = section && g.key !== NO_VALUE_KEY ? g.label : ''
      for (const note of g.notes) {
        if (ring) rings.add(ring)
        if (quadrant) quadrants.add(quadrant)
        const text = (description && csvValue(note, description)) || paragraphOf(note)
        lines.push(
          [titleOf(note), ring, quadrant, 'FALSE', text, ...extras.map((d) => csvValue(note, d))].map(csvSafe)
        )
      }
    }
  }
  return {
    csv: lines.map((l) => l.map(csvField).join(',')).join('\r\n') + '\r\n',
    rows: lines.length - 1,
    rings: rings.size,
    quadrants: quadrants.size,
  }
}

export function boardCsvFileName(typeName: string): string {
  return `${typeName.replace(/[\\/:*?"<>|]/g, '-')}-board.csv`
}
