import type { Note, Notebook, NoteType, Task } from '../types'
import { cleanNoteContentForAi, decodeEntities } from './noteFileText'
import { markLabelKey, noteMarksOf, type NoteMarkEntry } from './noteMarks'
import { hasTag, tagKey } from './noteTags'
import { compareTasks, findProjectByTag, isOpen, normalizeName, todosTitleOf, type TodosInfo } from './tasks'

// Busca do Ctrl+P sobre as notas já em memória: texto limpo (sem base64, tags
// internas e sintaxe Markdown), normalizado sem acentos, tokens com AND e
// ranking por título. Filtros `#Caderno`, `type:Nome`, `tag:Nome`,
// `is:archived`, `has:mark` e `mark:Rótulo`; arquivadas depois das ativas.
// Tasks por título ou TODOS.

export interface Snippet {
  before: string
  match: string
  after: string
}

export interface NoteSearchResult {
  note: Note
  score: number
  snippet: Snippet | null
  // Tag da nota que casou com a consulta (ou a do filtro `tag:`): aparece no
  // resultado, para mostrar por que a nota veio.
  tag?: string
}

interface Entry {
  updatedAt: number
  content: string
  title: string
  text: string
  normText: string
  // offsets[i] = índice em `text` do caractere que gerou normText[i].
  offsets: number[]
  normTitle: string
  normTags: string
}

const DEFAULT_LIMIT = 30
const TASKS_LIMIT = 8
const SNIPPET_BEFORE = 40
const SNIPPET_AFTER = 80
const PREVIEW_CHARS = 100

// Marcadores que cleanNoteContentForAi injeta e que não são texto do usuário.
const AI_MARKER_RE = /\[(?:task|image)\]|\[Linked note: [^\]\n]*\]|\[Tasks block: [^\]\n]*\]|⏰ ?[\d:]*/g
// Rótulo de marca (` [mark: Rótulo]`), com o espaço antes: o snippet não
// ganha um espaço solto antes da pontuação.
const MARK_LABEL_RE = / ?\[mark: [^\]\n]*\]/g
const HTML_TAG_RE = /<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>/g
const MD_LINK_RE = /!?\[([^\]\n]*)\]\([^)\n]*\)/g
const MD_LINE_PREFIX_RE = /^\s*(?:#{1,6}\s+|[-*+]\s+\[[ xX]\]\s*|[-*+]\s+|\d+\.\s+|>\s?)+/gm
const MD_INLINE_RE = /(?<!\\)(?:\*\*|\*|==|`)/g
const MD_ESCAPE_RE = /\\([\\`*_{}[\]()#+\-.!|<>~])/g
const WORD_CHAR_RE = /[\p{L}\p{N}]/u
const WORD_SPLIT_RE = /[^\p{L}\p{N}]+/u

const cache = new Map<string, Entry>()

export function normalizeSearch(s: string): string {
  return normalizeName(s)
}

function noteSearchText(content: string): string {
  return stripSyntax(cleanNoteContentForAi(content, { resolveNoteTitle: () => undefined }))
}

// Texto do cleanNoteContentForAi sem a sintaxe Markdown/HTML, numa linha só.
function stripSyntax(text: string): string {
  // Entidades por último: `-&gt;` vira `->` sem que o `<` decodificado conte
  // como tag.
  return decodeEntities(
    text
      .replace(MARK_LABEL_RE, '')
      .replace(AI_MARKER_RE, ' ')
      .replace(HTML_TAG_RE, ' ')
      .replace(MD_LINK_RE, '$1')
      .replace(MD_LINE_PREFIX_RE, '')
      .replace(MD_INLINE_RE, '')
      .replace(MD_ESCAPE_RE, '$1')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function buildEntry(note: Note): Entry {
  const text = noteSearchText(note.content)
  let normText = ''
  const offsets: number[] = []
  let idx = 0
  // Caractere a caractere: a normalização pode mudar o comprimento.
  for (const c of text) {
    const n = normalizeSearch(c)
    for (let k = 0; k < n.length; k++) offsets.push(idx)
    normText += n
    idx += c.length
  }
  return {
    updatedAt: note.updatedAt,
    content: note.content,
    title: note.title,
    text,
    normText,
    offsets,
    normTitle: normalizeSearch(note.title).replace(/\s+/g, ' ').trim(),
    normTags: normalizeSearch(note.tags.join(' ')),
  }
}

// Recalcula só quando a nota muda: a limpeza é cara em nota com imagem.
function entryOf(note: Note): Entry {
  const cached = cache.get(note.id)
  if (
    cached &&
    cached.updatedAt === note.updatedAt &&
    cached.content === note.content &&
    cached.title === note.title
  ) {
    // Mesmo texto em outra string (refresh): guarda a referência nova para a
    // próxima comparação não ser caractere a caractere.
    cached.content = note.content
    return cached
  }
  const entry = buildEntry(note)
  cache.set(note.id, entry)
  return entry
}

function startsAtWord(haystack: string, token: string): boolean {
  for (let i = haystack.indexOf(token); i !== -1; i = haystack.indexOf(token, i + 1)) {
    if (i === 0 || !WORD_CHAR_RE.test(haystack[i - 1])) return true
  }
  return false
}

// Distância de edição ≤ 1 (inserção, remoção ou troca), em uma passada.
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

function titleScore(entry: Entry, tokens: string[], query: string): number {
  const title = entry.normTitle
  if (title === query) return 1000
  if (title.startsWith(query)) return 800
  if (tokens.every((t) => startsAtWord(title, t))) return 600
  if (tokens.every((t) => title.includes(t))) return 400
  if (tokens.some((t) => title.includes(t))) return 200
  return 100
}

function originalEnd(text: string, start: number): number {
  return start + ((text.codePointAt(start) ?? 0) > 0xffff ? 2 : 1)
}

function snippetOf(entry: Entry, tokens: string[]): Snippet | null {
  const { text, normText, offsets } = entry
  if (!text) return null
  for (const token of tokens) {
    const i = normText.indexOf(token)
    if (i === -1) continue
    const start = offsets[i]
    const end = originalEnd(text, offsets[i + token.length - 1])
    const from = Math.max(0, start - SNIPPET_BEFORE)
    const to = Math.min(text.length, end + SNIPPET_AFTER)
    return {
      before: (from > 0 ? '…' : '') + text.slice(from, start),
      match: text.slice(start, end),
      after: text.slice(end, to) + (to < text.length ? '…' : ''),
    }
  }
  return previewOf(text)
}

function previewOf(text: string): Snippet | null {
  if (!text) return null
  const cut = text.length > PREVIEW_CHARS
  return { before: text.slice(0, PREVIEW_CHARS) + (cut ? '…' : ''), match: '', after: '' }
}

// Começo do texto limpo da nota (sem sintaxe, imagens nem blocos internos),
// do mesmo cache da busca: a prévia das listas fora do Ctrl+P.
export function notePreview(note: Note): string {
  return previewOf(entryOf(note).text)?.before ?? ''
}

// Bloco que não é parágrafo de texto: título, item de lista ou checklist,
// tabela, código ou divisória.
const NON_PARAGRAPH_RE = /^(?:#{1,6}\s|[-*+]\s|\d+\.\s|\||```|~~~|(?:[-*_]\s*){3,}$)/
// Blocos que podem ter linha em branco dentro: código entre cercas e tabela
// em HTML (o tiptap-markdown grava assim a tabela com célula rica). Saem
// inteiros antes de dividir em blocos.
const MULTI_BLOCK_RE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$|<table[\s\S]*?<\/table>/gim

// 1º parágrafo de texto da nota, limpo como a busca (sem sintaxe, imagens nem
// blocos internos) e cortado em `max` caracteres (export CSV do board).
export function noteFirstParagraph(note: Note, max: number): string {
  const blocks = cleanNoteContentForAi(note.content, { resolveNoteTitle: () => undefined })
    .replace(MULTI_BLOCK_RE, '')
    .split(/\n\s*\n/)
  for (const block of blocks) {
    if (NON_PARAGRAPH_RE.test(block.trim())) continue
    const text = stripSyntax(block)
    if (!text) continue
    if (text.length <= max) return text
    // O corte não parte um par substituto (emoji).
    return `${text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '').trimEnd()}…`
  }
  return ''
}

export interface SearchChip {
  // Token como está na consulta (remover o chip tira este texto).
  raw: string
  label: string
  kind: 'notebook' | 'type' | 'archived' | 'marked' | 'markLabel' | 'tag'
}

export interface ParsedSearchQuery {
  text: string
  notebookId: string | null
  typeId: string | null
  archived: boolean
  // `has:mark` ou `mark:Rótulo`: os resultados passam a ser as marcas (uma
  // linha por marca), não as notas.
  marked: boolean
  // Rótulo do `mark:` (grafia de um rótulo existente).
  markLabel: string | null
  // Tag do `tag:` (grafia de uma tag existente).
  tag: string | null
  chips: SearchChip[]
}

// Tags e rótulos de marca existentes: `tag:` e `mark:` só filtram por nomes
// que existem (desconhecido fica no texto, como no `type:`).
export interface SearchVocabulary {
  tags: string[]
  markLabels: string[]
}

// Nome como token: sem acentos, minúsculo e sem espaços.
function typeTokenName(name: string): string {
  return normalizeName(name).replace(/\s+/g, '')
}

// Separa os filtros do texto: `#Nome` (caderno, como no quick add),
// `type:Nome` (tipo, sem espaços), `tag:Nome` (tag da nota), `is:archived`
// (só arquivadas), `has:mark` (marcas) e `mark:Rótulo` (marcas com o rótulo).
// Nome desconhecido, ou um segundo filtro do mesmo tipo, fica no texto.
export function parseSearchQuery(
  raw: string,
  notebooks: Notebook[],
  noteTypes: NoteType[],
  vocab?: SearchVocabulary,
): ParsedSearchQuery {
  const words: string[] = []
  const chips: SearchChip[] = []
  let notebookId: string | null = null
  let typeId: string | null = null
  let archived = false
  let marked = false
  let markLabel: string | null = null
  let tag: string | null = null
  for (const word of raw.split(/\s+/).filter(Boolean)) {
    if (!archived && word.toLowerCase() === 'is:archived') {
      archived = true
      chips.push({ raw: word, label: 'Archived', kind: 'archived' })
      continue
    }
    if (word.toLowerCase() === 'has:mark' && !chips.some((c) => c.kind === 'marked')) {
      marked = true
      chips.push({ raw: word, label: 'Marks', kind: 'marked' })
      continue
    }
    if (/^mark:./i.test(word) && !markLabel && vocab) {
      const wanted = typeTokenName(word.slice('mark:'.length))
      const label = vocab.markLabels.find((l) => typeTokenName(l) === wanted)
      if (label) {
        marked = true
        markLabel = label
        chips.push({ raw: word, label, kind: 'markLabel' })
        continue
      }
    }
    if (/^tag:./i.test(word) && !tag && vocab) {
      const wanted = typeTokenName(word.slice('tag:'.length).replace(/^#/, ''))
      const found = vocab.tags.find((t) => typeTokenName(t) === wanted)
      if (found) {
        tag = found
        chips.push({ raw: word, label: found, kind: 'tag' })
        continue
      }
    }
    if (word.startsWith('#') && word.length > 1 && !notebookId) {
      const nb = findProjectByTag(notebooks, word.slice(1))
      if (nb) {
        notebookId = nb.id
        chips.push({ raw: word, label: nb.name, kind: 'notebook' })
        continue
      }
    }
    if (/^type:./i.test(word) && !typeId) {
      const wanted = normalizeName(word.slice('type:'.length))
      const type = noteTypes.find((t) => typeTokenName(t.name) === wanted)
      if (type) {
        typeId = type.id
        chips.push({ raw: word, label: type.name, kind: 'type' })
        continue
      }
    }
    words.push(word)
  }
  return { text: words.join(' '), notebookId, typeId, archived, marked, markLabel, tag, chips }
}

// Token `type:` de um tipo (chip clicável da palette).
export function typeToken(type: NoteType): string {
  return `type:${typeTokenName(type.name)}`
}

// Token `mark:` de um rótulo de marca (chip clicável da palette).
export function markLabelToken(label: string): string {
  return `mark:${typeTokenName(label)}`
}

export interface SearchScope {
  limit?: number
  notebookId?: string | null
  typeId?: string | null
  archived?: boolean
  tag?: string | null
}

function inScope(n: Note, scope: SearchScope | undefined): boolean {
  return (
    (!scope?.notebookId || n.notebookId === scope.notebookId) &&
    (!scope?.typeId || n.typeId === scope.typeId) &&
    (!scope?.archived || !!n.archivedAt) &&
    (!scope?.tag || hasTag(n, scope.tag))
  )
}

// Tag que explica o resultado: a do filtro, ou uma que casou com um token que
// o título não explica.
function matchedTag(note: Note, entry: Entry, tokens: string[], filterTag: string | null): string | undefined {
  if (filterTag) return note.tags.find((t) => tagKey(t) === tagKey(filterTag))
  const fromTags = tokens.filter((t) => !entry.normTitle.includes(t) && entry.normTags.includes(t))
  if (fromTags.length === 0) return undefined
  return note.tags.find((t) => fromTags.some((tok) => normalizeSearch(t).includes(tok)))
}

export function searchNotes(notes: Note[], query: string, opts?: SearchScope): NoteSearchResult[] {
  const filtered = !!(opts?.notebookId || opts?.typeId || opts?.archived || opts?.tag)
  const scoped = filtered ? notes.filter((n) => inScope(n, opts)) : notes
  const filterTag = opts?.tag ?? null
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    // Só filtros: as notas do filtro por recência.
    if (!filtered) return []
    return recentNotes(scoped, opts?.limit ?? DEFAULT_LIMIT).map((r) => ({
      ...r,
      tag: matchedTag(r.note, entryOf(r.note), [], filterTag),
    }))
  }
  const normQuery = tokens.join(' ')
  const results: NoteSearchResult[] = []
  for (const note of scoped) {
    const entry = entryOf(note)
    const missing = tokens.filter(
      (t) => !entry.normTitle.includes(t) && !entry.normText.includes(t) && !entry.normTags.includes(t),
    )
    if (missing.length === 0) {
      results.push({
        note,
        score: titleScore(entry, tokens, normQuery),
        snippet: snippetOf(entry, tokens),
        tag: matchedTag(note, entry, tokens, filterTag),
      })
      continue
    }
    // Tolerância a erro de digitação, só no título e em termos longos.
    const words = entry.normTitle.split(WORD_SPLIT_RE).filter(Boolean)
    const fuzzy = missing.every((t) => t.length >= 5 && words.some((w) => withinOneEdit(t, w)))
    if (fuzzy) {
      results.push({ note, score: 50, snippet: snippetOf(entry, tokens), tag: matchedTag(note, entry, [], filterTag) })
    }
  }
  return results
    .sort(
      (a, b) =>
        Number(!!a.note.archivedAt) - Number(!!b.note.archivedAt) ||
        b.score - a.score ||
        b.note.updatedAt - a.note.updatedAt,
    )
    .slice(0, opts?.limit ?? DEFAULT_LIMIT)
}

// Uma linha por marca (filtro `has:mark`/`mark:` do Ctrl+P).
export interface MarkSearchResult {
  note: Note
  entry: NoteMarkEntry
}

// Marcas das notas do escopo. O texto filtra pelo trecho, o rótulo, o
// contexto e o título da nota; sem texto, as marcas das notas mexidas por
// último. Arquivadas por último, como os demais resultados da palette.
export function searchMarks(
  notes: Note[],
  query: string,
  opts?: SearchScope & { label?: string | null },
): MarkSearchResult[] {
  const labelKey = opts?.label ? markLabelKey(opts.label) : null
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
  const results: MarkSearchResult[] = []
  for (const note of notes) {
    if (!inScope(note, opts)) continue
    const marks = noteMarksOf(note)
    if (marks.length === 0) continue
    const title = normalizeSearch(note.title)
    for (const entry of marks) {
      if (labelKey && (!entry.label || markLabelKey(entry.label) !== labelKey)) continue
      if (tokens.length > 0) {
        const hay = normalizeSearch(`${entry.text} ${entry.label ?? ''} ${entry.before} ${entry.after}`)
        if (!tokens.every((t) => hay.includes(t) || title.includes(t))) continue
      }
      results.push({ note, entry })
    }
  }
  return results
    .sort(
      (a, b) =>
        Number(!!a.note.archivedAt) - Number(!!b.note.archivedAt) ||
        b.note.updatedAt - a.note.updatedAt ||
        a.entry.index - b.entry.index,
    )
    .slice(0, opts?.limit ?? DEFAULT_LIMIT)
}

// Consulta vazia: troca rápida entre as notas mexidas por último (arquivadas
// por último).
export function recentNotes(notes: Note[], limit = 10): NoteSearchResult[] {
  return [...notes]
    .sort((a, b) => Number(!!a.archivedAt) - Number(!!b.archivedAt) || b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((note) => ({ note, score: 0, snippet: previewOf(entryOf(note).text) }))
}

// Tasks do Ctrl+P: AND dos tokens sobre título + título da TODOS; abertas
// primeiro (ordem das visões), depois as fechadas mais recentes.
export function searchTasks(
  tasks: Task[],
  query: string,
  todosById: Map<string, TodosInfo>,
  opts?: { notebookId?: string | null; limit?: number },
): Task[] {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const notebookId = opts?.notebookId ?? null
  const open: Task[] = []
  const closed: Task[] = []
  for (const t of tasks) {
    if (notebookId && t.notebookId !== notebookId) continue
    const hay = normalizeSearch(`${t.title} ${todosTitleOf(t, todosById) ?? ''}`)
    if (!tokens.every((tok) => hay.includes(tok))) continue
    if (isOpen(t)) open.push(t)
    else closed.push(t)
  }
  open.sort(compareTasks)
  closed.sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt))
  return [...open, ...closed].slice(0, opts?.limit ?? TASKS_LIMIT)
}
