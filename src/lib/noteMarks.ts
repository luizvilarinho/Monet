import MarkdownIt from 'markdown-it'
import type { Note } from '../types'
import { normalizeName } from './tasks'

// Marcas de atenção (mark `noteMark`, spec DOCS/specs/notemark.md): trecho de
// nota que o usuário marcou para voltar a ele, com rótulo opcional
// ("Pesquisar", "Revisar"...). Persistidas como `<mark data-mark="Rótulo">` no
// markdown (atributo vazio = sem rótulo), no mesmo padrão do `<span data-bg>`
// do highlight. O `==texto==` existe só como atalho de digitação no editor e
// como a forma que a IA lê e cita.

export interface NoteMarkEntry {
  // Posição da marca na nota, em ordem de documento. O Editor conta os runs
  // do mark na mesma ordem (noteMarkRuns) e navega por ela.
  index: number
  text: string
  label: string | null
  // Texto do bloco em volta da marca (contexto na lista e para a IA), com o
  // espaço da borda como está: a marca pode estar no meio de uma palavra.
  before: string
  after: string
}

const EMPTY: NoteMarkEntry[] = []
const CONTEXT_CHARS = 90
const LABEL_MAX = 40
// Blocos de texto do markdown renderizado: o contexto da marca é o do bloco
// mais próximo (listas aninhadas ficam de fora).
const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, dt, dd'

// Mesmo parser (markdown-it com HTML) e opções do tiptap-markdown: o que vira
// marca aqui é o que o editor mostra como marca, inclusive dentro de toggles
// (HTML) e nunca dentro de código.
const md = new MarkdownIt({ html: true, linkify: false, breaks: false })
// Imagens coladas viram data URL de MB: fora do parse (marca não fica dentro
// de imagem), senão a extração da nota com imagem custa ~100 ms por tecla.
const DATA_URL_RE = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// Texto visível: <br> vale um espaço; nós atômicos (chips, pills) não têm texto.
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? ''
  if (node.nodeName === 'BR') return ' '
  let s = ''
  node.childNodes.forEach((child) => {
    s += textOf(child)
  })
  return s
}

// Texto do bloco com o intervalo ocupado pelos elementos da marca.
function contextOf(block: Element, els: Element[]): { before: string; after: string } {
  let acc = ''
  let start = -1
  let end = -1
  const walk = (node: Node) => {
    if (node === els[0]) start = acc.length
    if (node.nodeType === Node.TEXT_NODE) acc += node.nodeValue ?? ''
    else if (node.nodeName === 'BR') acc += ' '
    else if (node !== block && (node.nodeName === 'UL' || node.nodeName === 'OL')) return
    else node.childNodes.forEach(walk)
    if (node === els[els.length - 1]) end = acc.length
  }
  walk(block)
  if (start < 0 || end < 0) return { before: '', after: '' }
  let before = acc.slice(0, start).replace(/\s+/g, ' ').trimStart()
  let after = acc.slice(end).replace(/\s+/g, ' ').trimEnd()
  if (before.length > CONTEXT_CHARS) before = `…${before.slice(-CONTEXT_CHARS).trimStart()}`
  if (after.length > CONTEXT_CHARS) after = `${after.slice(0, CONTEXT_CHARS).trimEnd()}…`
  return { before, after }
}

function labelAttr(el: Element): string | null {
  return normalizeMarkLabel(el.getAttribute('data-mark') ?? '')
}

export function extractNoteMarks(content: string): NoteMarkEntry[] {
  if (!content.includes('data-mark')) return EMPTY
  const doc = new DOMParser().parseFromString(md.render(content.replace(DATA_URL_RE, 'data:,')), 'text/html')
  // Marcas coladas com o mesmo rótulo são um run só no editor (o ProseMirror
  // funde texto vizinho com o mesmo mark): aqui também.
  const groups: Element[][] = []
  for (const el of Array.from(doc.querySelectorAll('mark[data-mark]'))) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    if (prev && el.previousSibling === prev && labelAttr(prev) === labelAttr(el)) last.push(el)
    else groups.push([el])
  }
  const marks: NoteMarkEntry[] = []
  for (const els of groups) {
    const text = collapse(els.map(textOf).join(''))
    if (!text) continue
    const block = els[0].closest(BLOCK_SELECTOR)
    const context = block ? contextOf(block, els) : { before: '', after: '' }
    marks.push({ index: marks.length, text, label: labelAttr(els[0]), ...context })
  }
  return marks
}

// Fim do texto antes da marca, para a marca aparecer logo no começo das
// linhas de lista (o contexto guardado tem até CONTEXT_CHARS).
export function clipContextStart(before: string, max = 36): string {
  return before.length > max ? `…${before.slice(-max).trimStart()}` : before
}

// Cache por nota (mesmo padrão do cache de noteSearch.ts): a extração roda a
// cada tecla do Ctrl+P e a cada render da lista de marcas.
const cache = new Map<string, { content: string; marks: NoteMarkEntry[] }>()

export function noteMarksOf(note: Note): NoteMarkEntry[] {
  const cached = cache.get(note.id)
  if (cached && cached.content === note.content) return cached.marks
  const marks = extractNoteMarks(note.content)
  cache.set(note.id, { content: note.content, marks })
  return marks
}

// ─── Rótulos ────────────────────────────────────────────────────────────────

// Rótulo como o usuário digitou, limpo (um espaço, sem bordas, curto); vazio
// = sem rótulo.
export function normalizeMarkLabel(raw: string): string | null {
  const label = collapse(raw).slice(0, LABEL_MAX).trim()
  return label || null
}

// Comparação de rótulos sem caixa nem acento ("pesquisar" = "Pesquisar").
export function markLabelKey(label: string): string {
  return normalizeName(collapse(label))
}

// Filtro de marcas por rótulo: null = todas; `{ label: null }` = sem rótulo.
export type MarkLabelFilter = { label: string | null } | null

export function matchesLabelFilter(entry: NoteMarkEntry, filter: MarkLabelFilter): boolean {
  if (!filter) return true
  if (filter.label === null) return entry.label === null
  return entry.label !== null && markLabelKey(entry.label) === markLabelKey(filter.label)
}

export interface MarkLabelCount {
  // Grafia mais usada do rótulo (as variações de caixa/acento contam juntas).
  label: string
  count: number
}

export interface MarkSummary {
  total: number
  unlabeled: number
  // Mais usados primeiro.
  labels: MarkLabelCount[]
}

export function summarizeMarks(entries: NoteMarkEntry[]): MarkSummary {
  const byKey = new Map<string, { count: number; spellings: Map<string, number> }>()
  let unlabeled = 0
  for (const e of entries) {
    if (!e.label) {
      unlabeled++
      continue
    }
    const key = markLabelKey(e.label)
    const slot = byKey.get(key) ?? { count: 0, spellings: new Map<string, number>() }
    slot.count++
    slot.spellings.set(e.label, (slot.spellings.get(e.label) ?? 0) + 1)
    byKey.set(key, slot)
  }
  const labels = Array.from(byKey.values()).map(({ count, spellings }) => ({
    label: Array.from(spellings).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    count,
  }))
  labels.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return { total: entries.length, unlabeled, labels }
}

// Marcas das notas que entram nas listas (Marks, coluna de cadernos): só de
// nota de caderno e, salvo `includeArchived`, não arquivada; as notas mexidas
// por último primeiro.
export interface NoteMarkHit {
  note: Note
  entry: NoteMarkEntry
}

export function collectNoteMarks(notes: Note[], opts?: { includeArchived?: boolean }): NoteMarkHit[] {
  const hits: NoteMarkHit[] = []
  const sorted = notes
    .filter((n) => n.notebookId && (opts?.includeArchived || !n.archivedAt))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  for (const note of sorted) {
    for (const entry of noteMarksOf(note)) hits.push({ note, entry })
  }
  return hits
}

// ─── IA ─────────────────────────────────────────────────────────────────────

const MARK_TAG_RE = /<mark\b[^>]*?\bdata-mark(?:="([^"]*)")?[^>]*>([\s\S]*?)<\/mark>/g

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function decodeHtmlText(html: string): string {
  const body = html.replace(/<br\s*\/?>/gi, ' ')
  return new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html').body.textContent ?? ''
}

// Texto da nota para a IA/RAG: cada marca vira `==texto==`, com o rótulo em
// ` [mark: Rótulo]` — a forma que o system prompt descreve e que a IA cita.
// O conteúdo da marca vira texto simples (a citação precisa casar com ele).
export function markTagsToAiText(content: string): string {
  if (!content.includes('data-mark')) return content
  return content.replace(MARK_TAG_RE, (_, rawLabel: string | undefined, inner: string) => {
    const text = collapse(decodeHtmlText(md.renderInline(inner)))
    if (!text) return ''
    const label = rawLabel ? normalizeMarkLabel(decodeHtmlText(rawLabel)) : null
    return `==${escapeText(text)}==${label ? ` [mark: ${escapeText(label)}]` : ''}`
  })
}

const FENCE_RE = /^\s*(```|~~~)/
const INLINE_CODE_RE = /(`[^`\n]*`)/
// Citação de marca na resposta da IA: `==texto==` com bordas sem espaço, numa
// linha só, e o rótulo opcional que a IA às vezes repete.
const CITED_MARK_RE = /==([^=\s]|[^=\s][^\n]*?[^=\s])==(?:\s*\[mark: [^\]\n]*\])?/g

// Resposta da IA que vai para uma nota (Insert, Save to note): a citação
// `==texto==` volta a ser texto simples. A IA nunca cria marcas (R10).
export function stripMarkCitations(markdown: string): string {
  if (!markdown.includes('==')) return markdown
  let inFence = false
  return markdown
    .split('\n')
    .map((line) => {
      if (FENCE_RE.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return line
      return line
        .split(INLINE_CODE_RE)
        .map((part, i) => (i % 2 === 1 ? part : part.replace(CITED_MARK_RE, '$1')))
        .join('')
    })
    .join('\n')
}

// Marca (`==texto==`) citada numa resposta da IA: pós-processa o HTML já
// sanitizado (DOMParser) envolvendo o trecho em <mark data-nm> clicável — sem
// tocar no pipeline do remark nem no whitelist do sanitize. Fora de pre/code;
// bordas sem espaço. O atributo é `data-nm`, não `data-mark`: copiar a
// resposta para uma nota não cria marca. Compartilhado pelos balões de chat.
export function linkNoteMarks(html: string): string {
  if (!html.includes('==')) return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const root = doc.body
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    const value = t.nodeValue
    if (!value || !value.includes('==')) continue
    let p: Node | null = t.parentNode
    let inCode = false
    while (p && p !== root) {
      const name = p.nodeName
      if (name === 'PRE' || name === 'CODE') {
        inCode = true
        break
      }
      p = p.parentNode
    }
    if (!inCode) targets.push(t)
  }
  for (const t of targets) {
    const value = t.nodeValue ?? ''
    const matches = Array.from(value.matchAll(CITED_MARK_RE))
    if (matches.length === 0) continue
    const frag = doc.createDocumentFragment()
    let last = 0
    for (const m of matches) {
      if (m.index > last) frag.appendChild(doc.createTextNode(value.slice(last, m.index)))
      const el = doc.createElement('mark')
      el.setAttribute('data-nm', m[1])
      el.textContent = m[1]
      frag.appendChild(el)
      last = m.index + m[0].length
    }
    if (last < value.length) frag.appendChild(doc.createTextNode(value.slice(last)))
    t.parentNode?.replaceChild(frag, t)
  }
  return root.innerHTML
}
