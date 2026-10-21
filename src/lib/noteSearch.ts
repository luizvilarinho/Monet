import type { Note, Notebook, NoteType, Task } from '../types'
import { cleanNoteContentForAi, decodeEntities } from './noteFileText'
import { compareTasks, findProjectByTag, isOpen, normalizeName, todosTitleOf, type TodosInfo } from './tasks'

// Busca do Ctrl+P sobre as notas já em memória: texto limpo (sem base64, tags
// internas e sintaxe Markdown), normalizado sem acentos, tokens com AND e
// ranking por título. Filtros `#Caderno` e `type:Nome` e tasks por título ou
// TODOS.

export interface Snippet {
  before: string
  match: string
  after: string
}

export interface NoteSearchResult {
  note: Note
  score: number
  snippet: Snippet | null
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
const HTML_TAG_RE = /<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>/g
const MD_LINK_RE = /!?\[([^\]\n]*)\]\([^)\n]*\)/g
const MD_LINE_PREFIX_RE = /^\s*(?:#{1,6}\s+|[-*+]\s+\[[ xX]\]\s*|[-*+]\s+|\d+\.\s+|>\s?)+/gm
const MD_INLINE_RE = /(?<!\\)(?:\*\*|\*|`)/g
const MD_ESCAPE_RE = /\\([\\`*_{}[\]()#+\-.!|<>~])/g
const WORD_CHAR_RE = /[\p{L}\p{N}]/u
const WORD_SPLIT_RE = /[^\p{L}\p{N}]+/u

const cache = new Map<string, Entry>()

export function normalizeSearch(s: string): string {
  return normalizeName(s)
}

function noteSearchText(content: string): string {
  // Entidades por último: `-&gt;` vira `->` sem que o `<` decodificado conte
  // como tag.
  return decodeEntities(
    cleanNoteContentForAi(content, { resolveNoteTitle: () => undefined })
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

export interface SearchChip {
  // Token como está na consulta (remover o chip tira este texto).
  raw: string
  label: string
  kind: 'notebook' | 'type'
}

export interface ParsedSearchQuery {
  text: string
  notebookId: string | null
  typeId: string | null
  chips: SearchChip[]
}

// Nome do tipo como token: sem acentos, minúsculo e sem espaços.
function typeTokenName(name: string): string {
  return normalizeName(name).replace(/\s+/g, '')
}

// Separa os filtros do texto: `#Nome` (caderno, como no quick add) e
// `type:Nome` (tipo, sem espaços). Nome desconhecido, ou um segundo filtro do
// mesmo tipo, fica no texto.
export function parseSearchQuery(raw: string, notebooks: Notebook[], noteTypes: NoteType[]): ParsedSearchQuery {
  const words: string[] = []
  const chips: SearchChip[] = []
  let notebookId: string | null = null
  let typeId: string | null = null
  for (const word of raw.split(/\s+/).filter(Boolean)) {
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
  return { text: words.join(' '), notebookId, typeId, chips }
}

// Token `type:` de um tipo (chip clicável da palette).
export function typeToken(type: NoteType): string {
  return `type:${typeTokenName(type.name)}`
}

export function searchNotes(
  notes: Note[],
  query: string,
  opts?: { limit?: number; notebookId?: string | null; typeId?: string | null },
): NoteSearchResult[] {
  const notebookId = opts?.notebookId ?? null
  const typeId = opts?.typeId ?? null
  const scoped =
    notebookId || typeId
      ? notes.filter(
          (n) => (!notebookId || n.notebookId === notebookId) && (!typeId || n.typeId === typeId),
        )
      : notes
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    // Só filtros: as notas do filtro por recência.
    return scoped === notes ? [] : recentNotes(scoped, opts?.limit ?? DEFAULT_LIMIT)
  }
  const normQuery = tokens.join(' ')
  const results: NoteSearchResult[] = []
  for (const note of scoped) {
    const entry = entryOf(note)
    const missing = tokens.filter(
      (t) => !entry.normTitle.includes(t) && !entry.normText.includes(t) && !entry.normTags.includes(t),
    )
    if (missing.length === 0) {
      results.push({ note, score: titleScore(entry, tokens, normQuery), snippet: snippetOf(entry, tokens) })
      continue
    }
    // Tolerância a erro de digitação, só no título e em termos longos.
    const words = entry.normTitle.split(WORD_SPLIT_RE).filter(Boolean)
    const fuzzy = missing.every((t) => t.length >= 5 && words.some((w) => withinOneEdit(t, w)))
    if (fuzzy) results.push({ note, score: 50, snippet: snippetOf(entry, tokens) })
  }
  return results
    .sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt)
    .slice(0, opts?.limit ?? DEFAULT_LIMIT)
}

// Consulta vazia: troca rápida entre as notas mexidas por último.
export function recentNotes(notes: Note[], limit = 10): NoteSearchResult[] {
  return [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
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
