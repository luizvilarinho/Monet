import MarkdownIt from 'markdown-it'
import type { Note } from '../types'
import { DATA_URL_RE } from './noteFileText'
import { BLOCK_SELECTOR } from './noteMarks'
import { noteNormText, withinOneEdit, type NoteNormText } from './noteSearch'
import { normalizeName } from './tasks'

// Termos do Related content (mark `relatedTerm`, src/components/Editor/
// RelatedTerm.ts): trecho que o usuário sinalizou na nota, persistido como
// `<span data-related>`. Cada termo acha as notas que o citam (título ou
// corpo, frase inteira nas fronteiras de palavra, sem acento nem caixa), e a
// ligação vale nos dois sentidos.
//
// A extração segue a de src/lib/noteMarks.ts: o mesmo parser do editor, e um
// termo é um run contíguo de texto com o mark dentro de um bloco, como o
// ProseMirror junta (termo partido por link, negrito ou marca é um só; <br>
// vale um espaço; chip não tem texto).

export interface RelatedTerm {
  // Grafia como está na nota.
  text: string
  // Palavras normalizadas unidas por espaço (comparação e deduplicação).
  key: string
  words: string[]
}

export interface TermReason {
  term: string
  // Chave do termo (RelatedTerm.key): filtro por termo no Related content.
  key: string
  // Grafia achada quando difere do termo (erro de digitação tolerado).
  found: string | null
}

export interface TermLinkedNote {
  note: Note
  reasons: TermReason[]
  // Um termo da nota ativa está no título desta nota.
  inTitle: boolean
}

const EMPTY: RelatedTerm[] = []
const WORD_SPLIT_RE = /[^\p{L}\p{N}]+/u
// Termo mais curto que isso é ignorado.
const MIN_KEY_LENGTH = 2
// Erro de digitação só em termo longo: em termo curto, um caractere troca a
// palavra ("Fernando" ≈ "Fernanda" ainda passa e o motivo mostra a grafia).
const FUZZY_MIN_LENGTH = 8

const md = new MarkdownIt({ html: true, linkify: false, breaks: false })

function words(s: string): string[] {
  return s.split(WORD_SPLIT_RE).filter(Boolean)
}

// Runs do termo num bloco, pelas folhas em ordem (texto, <br> e elementos
// sem filhos). Bloco interno e lista aninhada têm a sua própria vez.
function blockRuns(block: Element, out: string[]) {
  let current: string | null = null
  const close = () => {
    if (current !== null) out.push(current)
    current = null
  }
  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node !== block) {
      const el = node as Element
      if (el.matches(BLOCK_SELECTOR) || el.nodeName === 'UL' || el.nodeName === 'OL') {
        close()
        return
      }
    }
    if (node === block || (node.nodeType === Node.ELEMENT_NODE && node.firstChild)) {
      node.childNodes.forEach(walk)
      return
    }
    if (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE) return
    const term = node.parentElement?.closest('span[data-related]')
    if (!term || !block.contains(term)) {
      close()
      return
    }
    const text = node.nodeType === Node.TEXT_NODE ? (node.nodeValue ?? '') : node.nodeName === 'BR' ? ' ' : ''
    current = (current ?? '') + text
  }
  walk(block)
  close()
}

// Texto de cada run do termo, em ordem de documento, sem os vazios (a mesma
// regra de collectRuns + noteMarkRunText no editor).
export function extractRelatedTermRuns(content: string): string[] {
  if (!content.includes('data-related')) return []
  const doc = new DOMParser().parseFromString(md.render(content.replace(DATA_URL_RE, 'data:,')), 'text/html')
  const runs: string[] = []
  for (const block of Array.from(doc.querySelectorAll(BLOCK_SELECTOR))) blockRuns(block, runs)
  return runs.map((r) => r.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function toTerms(runs: string[]): RelatedTerm[] {
  const seen = new Set<string>()
  const terms: RelatedTerm[] = []
  for (const text of runs) {
    const w = words(normalizeName(text))
    const key = w.join(' ')
    if (key.length < MIN_KEY_LENGTH || seen.has(key)) continue
    seen.add(key)
    terms.push({ text, key, words: w })
  }
  return terms
}

// Cache por nota (padrão de noteMarksOf): roda a cada tecla na nota ativa.
const cache = new Map<string, { content: string; terms: RelatedTerm[] }>()

export function relatedTermsOf(note: Note): RelatedTerm[] {
  const cached = cache.get(note.id)
  if (cached && cached.content === note.content) return cached.terms
  const runs = extractRelatedTermRuns(note.content)
  const terms = runs.length === 0 ? EMPTY : toTerms(runs)
  cache.set(note.id, { content: note.content, terms })
  return terms
}

// Muda só quando os termos da nota mudam (dependência do recálculo).
export function relatedTermsKey(note: Note): string {
  return relatedTermsOf(note)
    .map((t) => t.key)
    .join('\n')
}

// Palavras do título e do texto limpo, do cache da busca do Ctrl+P.
const wordsCache = new WeakMap<NoteNormText, { title: string[]; text: string[] }>()

function noteWords(note: Note): { title: string[]; text: string[] } {
  const norm = noteNormText(note)
  let w = wordsCache.get(norm)
  if (!w) {
    w = { title: words(norm.normTitle), text: words(norm.normText) }
    wordsCache.set(norm, w)
  }
  return w
}

// O termo nas palavras: a chave (exato) ou a grafia achada com 1 erro, nas
// janelas de k-1, k e k+1 palavras (espaço a mais ou a menos); null = não.
function matchTerm(hay: string[], term: RelatedTerm): string | null {
  const k = term.words.length
  for (let i = 0; i + k <= hay.length; i++) {
    let j = 0
    while (j < k && hay[i + j] === term.words[j]) j++
    if (j === k) return term.key
  }
  if (term.key.length < FUZZY_MIN_LENGTH) return null
  for (const size of [k, k - 1, k + 1]) {
    if (size < 1) continue
    for (let i = 0; i + size <= hay.length; i++) {
      let len = size - 1
      for (let j = 0; j < size; j++) len += hay[i + j].length
      if (Math.abs(len - term.key.length) > 1) continue
      const window = hay.slice(i, i + size).join(' ')
      if (withinOneEdit(window, term.key)) return window
    }
  }
  return null
}

// Notas ligadas à nota ativa por termo: as que citam um termo dela e as que
// têm um termo que ela cita. Inclui tasks, diárias e arquivadas; nota sem
// caderno (Reader) fica de fora, como no Ctrl+P. Ordem: termo no título,
// mais motivos, mais recente. Sem corte.
export function findTermLinkedNotes(active: Note, notes: Note[]): TermLinkedNote[] {
  const activeTerms = relatedTermsOf(active)
  const byId = new Map<string, TermLinkedNote & { keys: Set<string> }>()
  const add = (note: Note, term: RelatedTerm, found: string, inTitle: boolean) => {
    let hit = byId.get(note.id)
    if (!hit) {
      hit = { note, reasons: [], inTitle: false, keys: new Set() }
      byId.set(note.id, hit)
    }
    if (inTitle) hit.inTitle = true
    if (hit.keys.has(term.key)) return
    hit.keys.add(term.key)
    hit.reasons.push({ term: term.text, key: term.key, found: found === term.key ? null : found })
  }
  let activeWords: { title: string[]; text: string[] } | null = null
  for (const note of notes) {
    if (note.id === active.id || !note.notebookId) continue
    if (activeTerms.length > 0) {
      const w = noteWords(note)
      for (const term of activeTerms) {
        const inTitle = matchTerm(w.title, term)
        const found = inTitle ?? matchTerm(w.text, term)
        if (found) add(note, term, found, inTitle !== null)
      }
    }
    const theirs = relatedTermsOf(note)
    if (theirs.length === 0) continue
    if (!activeWords) activeWords = noteWords(active)
    for (const term of theirs) {
      const found = matchTerm(activeWords.title, term) ?? matchTerm(activeWords.text, term)
      if (found) add(note, term, found, false)
    }
  }
  return Array.from(byId.values(), ({ note, reasons, inTitle }) => ({ note, reasons, inTitle })).sort(
    (a, b) =>
      Number(b.inTitle) - Number(a.inTitle) ||
      b.reasons.length - a.reasons.length ||
      b.note.updatedAt - a.note.updatedAt
  )
}
