import { nanoid } from 'nanoid'
import type { MetadataDef, MetadataValue, Note, NoteType, SelectOption } from '../types'
import { citationsText, dmy, linkUrl, type PaperItem } from './agentItems'
import { METADATA_TYPE_LABEL } from './metadata'
import { MAX_LIST_PROPERTIES, typeDefs } from './noteTypes'
import { normalizeDoi } from './openalex'
import { nameKey } from './plan'
import { normalizeName } from './tasks'

// Fila de leitura (Fase E): o tipo de nota "Paper" (propriedades, board por
// Status), a chave de dedupe dos artigos e o conteúdo da nota. Módulo puro (sem
// `storage`): a gravação fica em `paperSetup.ts`.

export const PAPER_TYPE_NAME = 'Paper'

export const PAPER_STATUS_OPTIONS = [
  { name: 'To read', color: '#9a9aae' },
  { name: 'Reading', color: '#5b9cf0' },
  { name: 'Read', color: '#5cc185' },
]

const AUTHORS_SHOWN = 3
const TITLE_MAX = 200
const OPENALEX_SOURCE_RE = /openalex\.org\/(W\d+)/i
// A linha `PDF: <url>` da nota: o editor pode reescrever a URL como autolink
// (`<url>`) ou como link (`[url](url)`), então vale a 1ª URL da linha. Um
// caractere com barra (`\]`, `\_`) faz parte da URL; o `]`, o `)` e o `>` soltos a
// terminam.
const PDF_LINE_RE = /^[ \t]*PDF:[^\n]*?(https?:\/\/(?:\\\S|[^\s<>\]"')\\])+)/im

export interface PaperSaveIds {
  status: string | null // propriedade Status (select)
  toRead: string | null // opção "To read" do Status
  year: string | null
  authors: string | null
  doi: string | null
}

export interface PaperSavePlan {
  type: NoteType
  newType: boolean
  typeChanged: boolean // o board foi escrito agora
  newDefs: MetadataDef[] // só o que falta
  changedDefs: MetadataDef[] // o Status existente que ganhou opções
  ids: PaperSaveIds // null = a propriedade de mesmo nome tem outro tipo de dado
  warnings: string[]
}

function sameName(a: string, b: string): boolean {
  return normalizeName(a.trim()) === normalizeName(b.trim())
}

// Tipo Paper: não embutido e chamado Paper (sem caixa, acento nem ":" no fim).
export function isPaperType(type: NoteType): boolean {
  return !type.builtin && nameKey(type.name) === nameKey(PAPER_TYPE_NAME)
}

// O 1º tipo Paper.
function pickPaperType(types: NoteType[]): NoteType | undefined {
  return [...types].sort((a, b) => a.sortOrder - b.sortOrder).find(isPaperType)
}

// Tipo alvo: o Paper que já existe (reaproveitado), senão um novo. Acrescenta só
// as propriedades que faltam, por nome, e as opções que faltam no Status quando
// ele é select. Nome igual com outro tipo de dado não é recriado (o nome é único
// no tipo): vira aviso e a propriedade fica de fora (`ids` null). O board só é
// escrito quando o tipo ainda não tem e o Status é select; o existente nunca é
// sobrescrito. Idempotente (a 2ª chamada não cria nem muda nada).
export function paperSaveChanges(types: NoteType[], defs: MetadataDef[]): PaperSavePlan {
  const now = Date.now()
  const existing = pickPaperType(types)
  const base: NoteType = existing ?? {
    id: `nt_${nanoid(8)}`,
    name: PAPER_TYPE_NAME,
    icon: 'file-text',
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
  const changedDefs: MetadataDef[] = []
  const warnings: string[] = []
  let order = own.reduce((m, d) => Math.max(m, d.sortOrder), 0)
  let listed = own.filter((d) => d.showInList).length

  const resolve = (name: string, kind: MetadataDef['type'], showInList: boolean, options: SelectOption[] | null = null) => {
    const found = own.find((d) => sameName(d.name, name))
    if (found) {
      if (found.type === kind) return found
      warnings.push(
        `Saved without ${name}: your ${PAPER_TYPE_NAME} type has ${found.name} as ${METADATA_TYPE_LABEL[found.type]}. Change it in Note types.`
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
      options,
      showInList: show,
    }
    newDefs.push(def)
    return def
  }

  // Ordem das propriedades novas; "show in list" nas três primeiras.
  let status = resolve(
    'Status',
    'select',
    true,
    PAPER_STATUS_OPTIONS.map((o) => ({ id: `opt_${nanoid(6)}`, name: o.name, color: o.color }))
  )
  const year = resolve('Year', 'number', true)
  const authors = resolve('Authors', 'text', true)
  const doi = resolve('DOI', 'text', false)

  // Status existente sem alguma das opções: acrescenta as que faltam, no fim.
  if (status) {
    const current = status.options ?? []
    const missing = PAPER_STATUS_OPTIONS.filter((o) => !current.some((c) => sameName(c.name, o.name)))
    if (missing.length > 0) {
      status = {
        ...status,
        options: [...current, ...missing.map((o) => ({ id: `opt_${nanoid(6)}`, name: o.name, color: o.color }))],
      }
      changedDefs.push(status)
    }
  }
  const toRead = status?.options?.find((o) => sameName(o.name, PAPER_STATUS_OPTIONS[0].name))?.id ?? null

  const board =
    base.board === null && status
      ? {
          columnDefId: status.id,
          sectionDefId: null,
          cardDefIds: [authors?.id, year?.id].filter((id): id is string => !!id),
          showTags: true,
          hideEmpty: false,
          filterDefId: null,
        }
      : base.board
  const type: NoteType = board !== base.board ? { ...base, board } : base

  return {
    type,
    newType: !existing,
    typeChanged: type !== base,
    newDefs,
    changedDefs,
    ids: {
      status: status?.id ?? null,
      toRead,
      year: year?.id ?? null,
      authors: authors?.id ?? null,
      doi: doi?.id ?? null,
    },
    warnings,
  }
}

// ─── Fila de leitura ────────────────────────────────────────────────────────

// O editor grava o texto com escapes de markdown (`\_`, `\~`, `\*`, `\[`…), que
// uma URL nunca tem de verdade: a barra invertida não é válida nela. Tirar todas
// as barras devolve a URL que o app escreveu (inclusive o escape duplicado de um
// autolink regravado).
function unescapeMarkdownUrl(url: string): string {
  return url.replace(/\\/g, '')
}

// O id do OpenAlex da linha `Source:` do conteúdo ('W123'), lido com o texto como
// o editor o grava (com escapes, autolink ou link). null = sem a linha.
function sourceOpenalexId(content: string): string | null {
  for (const line of content.match(/Source:[^\n]*/gi) ?? []) {
    const id = unescapeMarkdownUrl(line).match(OPENALEX_SOURCE_RE)?.[1]
    if (id) return id
  }
  return null
}

export interface ReadingListEntry {
  noteId: string
  notebookId: string | null
  archived: boolean // a nota Paper está arquivada (artigo já lido, por exemplo)
}

export type ReadingListKeys = Map<string, ReadingListEntry>

// As notas do tipo Paper (ativas e arquivadas) por chave de dedupe: `doi:<doi>`,
// lido da propriedade DOI, e `openalex:W<n>`, lido da linha `Source:` do
// conteúdo. Uma nota pode entrar com as duas chaves; a ativa vence a arquivada.
export function readingListKeys(notes: Note[], types: NoteType[], defs: MetadataDef[]): ReadingListKeys {
  const keys: ReadingListKeys = new Map()
  const type = pickPaperType(types)
  if (!type) return keys
  const doiDef = typeDefs(defs, type.id).find((d) => d.type === 'text' && sameName(d.name, 'DOI'))
  const own = notes.filter((n) => n.typeId === type.id)
  for (const note of [...own.filter((n) => !n.archivedAt), ...own.filter((n) => !!n.archivedAt)]) {
    const entry: ReadingListEntry = { noteId: note.id, notebookId: note.notebookId, archived: !!note.archivedAt }
    const rawDoi = doiDef ? note.properties?.[doiDef.id] : null
    const doi = typeof rawDoi === 'string' ? normalizeDoi(rawDoi) : null
    const openalexId = sourceOpenalexId(note.content)
    for (const key of [doi ? `doi:${doi}` : null, openalexId ? `openalex:${openalexId}` : null]) {
      if (key && !keys.has(key)) keys.set(key, entry)
    }
  }
  return keys
}

// O artigo está na fila quando a chave `doi:` ou a `openalex:` dele está no mapa;
// `archived` diz se a nota Paper dele está arquivada.
export function readingListMatch(item: Pick<PaperItem, 'doi' | 'openalexId'>, keys: ReadingListKeys): ReadingListEntry | null {
  return (item.doi ? keys.get(`doi:${item.doi}`) : undefined) ?? keys.get(`openalex:${item.openalexId}`) ?? null
}

// ─── Nota Paper ─────────────────────────────────────────────────────────────

export function paperNoteTitle(item: PaperItem): string {
  return item.title.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX).trimEnd()
}

// Os `display_name` completos, separados por vírgula; " et al." com mais de 3
// autores. '' sem autores.
export function paperAuthorsText(item: PaperItem): string {
  const names = item.authors.map((a) => a.trim()).filter(Boolean)
  return item.authorCount > AUTHORS_SHOWN ? `${names.join(', ')} et al.` : names.join(', ')
}

// PDF de acesso aberto: o `pdf_url` do melhor local, ou o `oa_url` quando ele
// termina em .pdf. null = sem PDF direto.
export function paperPdfLink(item: Pick<PaperItem, 'pdfUrl' | 'oaUrl'>): string | null {
  if (item.pdfUrl) return item.pdfUrl
  return item.oaUrl && /\.pdf($|[?#])/i.test(item.oaUrl) ? item.oaUrl : null
}

// O PDF de acesso aberto gravado na nota (linha `PDF: <url>`), lido com
// tolerância: a URL pode ter virado autolink ou link, e o editor grava com barra
// os caracteres de markdown dela (`/_private/` vira `/\_private/`), barra que sai
// daqui. null = sem a linha.
export function paperPdfFromContent(content: string): string | null {
  const url = content.match(PDF_LINE_RE)?.[1]
  return url ? unescapeMarkdownUrl(url) : null
}

// A URL do PDF como texto de markdown: os caracteres que o editor leria como
// formatação (`_final_` vira itálico e perde os sublinhados) saem com barra e
// voltam a ser texto; o editor os regrava do mesmo jeito e a leitura os desfaz.
function escapeUrlText(url: string): string {
  return url.replace(/[`*_~[\]]/g, '\\$&')
}

// O texto da propriedade Authors da nota Paper ('' sem ela ou vazia). `typeDefsList`
// = as propriedades do tipo.
export function paperNoteAuthors(note: Pick<Note, 'properties'>, typeDefsList: MetadataDef[]): string {
  const def = typeDefsList.find((d) => d.type === 'text' && sameName(d.name, 'Authors'))
  const value = def ? note.properties?.[def.id] : null
  return typeof value === 'string' ? value.trim() : ''
}

// Conteúdo (markdown) da nota Paper: link do DOI (ou da URL), autores, ano, tipo,
// citações e acesso; a linha `Source:` com o id do OpenAlex (chave de dedupe sem
// DOI); a linha `PDF:` quando há PDF de acesso aberto (o "Open in Library" da
// nota); o abstract ("Abstract (excerpt)" quando veio cortado: o `abstractFromIndex`
// marca o corte com "…" no fim); o motivo marcado como sugestão da IA (sem motivo,
// sem a linha) e, por último, a seção "My notes" vazia, que é do usuário. Não usa
// `<mark data-mark>`, que é a marca de atenção do usuário.
export function paperNoteContent(
  item: PaperItem,
  reason: string,
  todayKey: string,
  agentLabel: 'Papers' | 'Radar'
): string {
  const link = item.doi ? `https://doi.org/${item.doi}` : item.url
  const meta = [
    paperAuthorsText(item),
    item.year === null ? 'n.d.' : String(item.year),
    item.type,
    citationsText(item.citations),
    item.isOa ? 'Open access' : 'Closed access',
  ]
    .filter(Boolean)
    .join(' · ')
  const blocks = [`[${link}](${linkUrl(link)})`, meta, `Source: https://openalex.org/${item.openalexId}`]
  const pdf = paperPdfLink(item)
  if (pdf) blocks.push(`PDF: ${escapeUrlText(linkUrl(pdf))}`)
  const abstract = item.abstract?.trim()
  if (abstract) blocks.push(abstract.endsWith('…') ? '## Abstract (excerpt)' : '## Abstract', abstract)
  const why = reason.replace(/\s+/g, ' ').trim()
  if (why) blocks.push(`> **AI suggestion** (${agentLabel}, ${dmy(todayKey)}): ${why}`)
  blocks.push('## My notes')
  return blocks.join('\n\n')
}

// Valores da nota: Status "To read", Year só com ano, Authors só com texto e DOI
// só com DOI. A propriedade que não existe (id null) fica de fora.
export function paperProperties(
  ids: PaperSaveIds,
  v: { year: number | null; authors: string; doi: string | null }
): Record<string, MetadataValue> {
  const props: Record<string, MetadataValue> = {}
  if (ids.status && ids.toRead) props[ids.status] = ids.toRead
  if (ids.year && v.year !== null) props[ids.year] = v.year
  if (ids.authors && v.authors.trim()) props[ids.authors] = v.authors
  if (ids.doi && v.doi) props[ids.doi] = v.doi
  return props
}
