// Onde cada palavra guardada aparece no texto da página: o casamento do
// vocabulário com o texto, sem DOM e sem React. Os leitores montam o texto da
// página (e a tabela de offsets) e recebem de volta as posições a marcar.
import type { VocabularyItem } from '../types'
import { findContextSentence, splitSentences } from './sentences'
import { normalizeTerm } from './vocabulary'

// Uma forma (a guardada ou a base) e os itens que a têm, normalizada como o
// `normalizeTerm`: o texto da página é comparado sem diferença de caixa.
export interface MatchTerm {
  form: string
  itemIds: string[]
}

export interface TermOccurrence {
  start: number
  end: number
  itemIds: string[]
}

// Formas por expressão regular: uma passada por lote, para centenas de itens
// custarem poucas passadas sobre o texto.
const BATCH_SIZE = 200

// As letras, as marcas combinantes e os dígitos fecham a palavra: "malle" não
// casa dentro de "mallette". Hífen e apóstrofo não fecham ("l'homme", "peut-être").
const WORD_CHAR = '[\\p{L}\\p{M}\\p{N}]'

// Só palavra e expressão marcam o texto inteiro (uma frase só marca o lugar de
// origem). Cada forma, a guardada e a base (quando existe), vale uma vez e leva
// todos os itens que a têm.
export function buildMatchTerms(items: VocabularyItem[]): MatchTerm[] {
  const byForm = new Map<string, Set<string>>()
  for (const item of items) {
    if (item.kind === 'sentence') continue
    for (const raw of [item.text, item.baseForm]) {
      const form = raw ? normalizeTerm(raw) : ''
      if (!form) continue
      const ids = byForm.get(form)
      if (ids) ids.add(item.id)
      else byForm.set(form, new Set([item.id]))
    }
  }
  return [...byForm].map(([form, ids]) => ({ form, itemIds: [...ids] }))
}

// A forma como expressão regular: espaço casa qualquer quebra (a expressão pode
// atravessar linhas), e o apóstrofo e as aspas casam as variantes tipográficas.
function formPattern(form: string): string {
  return form
    .replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    .replace(/ /g, '\\s+')
    .replace(/'/g, "['‘’‚‛]")
    .replace(/"/g, '["“”„‟«»]')
}

function batchRegex(forms: string[]): RegExp {
  const alternatives = forms.map(formPattern).join('|')
  return new RegExp(`(?<!${WORD_CHAR})(?:${alternatives})(?!${WORD_CHAR})`, 'giu')
}

// Todas as ocorrências das formas no texto, por palavra inteira e sem diferença
// de caixa. Ocorrências que se sobrepõem (de lotes diferentes) ficam com a mais
// longa. Em ordem de posição.
export function findTermOccurrences(text: string, terms: MatchTerm[]): TermOccurrence[] {
  if (!text || terms.length === 0) return []
  const idsByForm = new Map(terms.map((t) => [t.form, t.itemIds]))
  // As formas mais longas primeiro: na alternância, "en tâtonnant" vence "tâtonnant".
  const forms = terms.map((t) => t.form).sort((a, b) => b.length - a.length)
  const found: TermOccurrence[] = []
  for (let i = 0; i < forms.length; i += BATCH_SIZE) {
    for (const match of text.matchAll(batchRegex(forms.slice(i, i + BATCH_SIZE)))) {
      const itemIds = idsByForm.get(normalizeTerm(match[0]))
      if (!itemIds || match.index === undefined) continue
      found.push({ start: match.index, end: match.index + match[0].length, itemIds })
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const kept: TermOccurrence[] = []
  for (const occurrence of found) {
    const last = kept[kept.length - 1]
    if (!last || occurrence.start >= last.end) {
      kept.push(occurrence)
    } else if (
      occurrence.end - occurrence.start > last.end - last.start &&
      (kept.length < 2 || occurrence.start >= kept[kept.length - 2].end)
    ) {
      kept[kept.length - 1] = occurrence
    }
  }
  return kept
}

// ─── Frases guardadas: só no lugar de origem ─────────────────────────────

export interface PdfSentenceAnchor {
  itemId: string
  start: number
  end: number
}

// As frases deste livro guardadas nesta página do PDF, pelos offsets que a seleção
// tinha no texto juntado. Item sem offsets (a seleção vazou da camada de texto)
// não marca nada.
export function pdfSentenceAnchors(items: VocabularyItem[], bookId: string, page: number): PdfSentenceAnchor[] {
  const anchors: PdfSentenceAnchor[] = []
  for (const item of items) {
    if (item.kind !== 'sentence' || item.bookId !== bookId) continue
    const a = item.anchor
    if (a.format === 'pdf' && a.page === page && a.end > a.start) {
      anchors.push({ itemId: item.id, start: a.start, end: a.end })
    }
  }
  return anchors
}

export interface EpubSentenceAnchor {
  itemId: string
  cfiRange: string
}

// As frases deste livro guardadas no EPUB: quem decide se estão no trecho exibido
// é o `rendition.getRange` de cada CFI (sem range, a seção não está na tela).
export function epubSentenceAnchors(items: VocabularyItem[], bookId: string): EpubSentenceAnchor[] {
  const anchors: EpubSentenceAnchor[] = []
  for (const item of items) {
    if (item.kind !== 'sentence' || item.bookId !== bookId) continue
    if (item.anchor.format === 'epub') anchors.push({ itemId: item.id, cfiRange: item.anchor.cfiRange })
  }
  return anchors
}

// ─── A frase de uma ocorrência ───────────────────────────────────────────

// Quantas vezes o termo aparece em `text` antes de `offset` (palavra inteira, sem
// diferença de caixa): é o número da ocorrência que o usuário selecionou.
export function countTermBefore(text: string, term: string, offset: number): number {
  const form = normalizeTerm(term)
  if (!form) return 0
  return findTermOccurrences(text, [{ form, itemIds: ['term'] }]).filter((o) => o.start < offset).length
}

// A frase da página em que o termo aparece pela (`occurrence` + 1)-ésima vez, por
// palavra inteira: "malle" não está em "mallette", e a segunda "malle" da página
// dá a frase dela, não a da primeira. Sem achar a ocorrência (o termo atravessa
// frases, ou é pedaço de uma palavra), vale a regra de `findContextSentence`.
export function contextSentenceAt(text: string, selection: string, language: string, occurrence: number): string {
  const form = normalizeTerm(selection)
  if (form) {
    const term = [{ form, itemIds: ['term'] }]
    let seen = 0
    for (const sentence of splitSentences(text, language)) {
      const count = findTermOccurrences(sentence, term).length
      if (occurrence < seen + count) return sentence
      seen += count
    }
  }
  return findContextSentence(text, selection, language)
}
