import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildJoinedPageText,
  buildRangeFromOffsets,
  findAllOccurrenceRanges,
  getPageSpans,
  rangeToJoinedOffsets,
} from './pdfTextLayer'
import { buildMatchTerms, findTermOccurrences } from '../../lib/vocabMatch'
import type { VocabularyItem } from '../../types'

// Camada de texto montada à mão, com o texto inventado do Apêndice E: um span
// por fragmento, como o pdf.js faz.
function makeLayer(parts: string[]): HTMLElement {
  const layer = document.createElement('div')
  for (const part of parts) {
    const span = document.createElement('span')
    span.textContent = part
    layer.append(span)
  }
  document.body.append(layer)
  return layer
}

const PARTS = ['La porte du grenier était', "entrebâillée et il n'y avait", 'pas de lumière.']

describe('pdfTextLayer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('junta o texto dos spans com um espaço e guarda o mapa de offsets', () => {
    const layer = makeLayer(PARTS)
    const { text, spanRanges } = buildJoinedPageText(getPageSpans(layer))
    expect(text).toBe("La porte du grenier était entrebâillée et il n'y avait pas de lumière.")
    expect(spanRanges.map((r) => [r.start, r.end])).toEqual([
      [0, 25],
      [26, 54],
      [55, 70],
    ])
  })

  it('ignora spans vazios', () => {
    const layer = makeLayer(['La porte', '', 'du grenier'])
    expect(buildJoinedPageText(getPageSpans(layer)).text).toBe('La porte du grenier')
  })

  it('monta o Range que atravessa spans e acha as ocorrências', () => {
    const layer = makeLayer(PARTS)
    const { spanRanges } = buildJoinedPageText(getPageSpans(layer))
    // De "était" (1º span) até "entrebâillée" (2º): o Range atravessa os dois.
    const text = buildJoinedPageText(getPageSpans(layer)).text
    const from = text.indexOf('était')
    const to = text.indexOf('entrebâillée') + 'entrebâillée'.length
    expect(buildRangeFromOffsets(spanRanges, from, to)?.toString()).toBe('étaitentrebâillée')
    expect(findAllOccurrenceRanges(layer, 'ENTREBÂILLÉE').map((r) => r.toString())).toEqual(['entrebâillée'])
    expect(findAllOccurrenceRanges(layer, 'malle')).toEqual([])
  })

  it('rangeToJoinedOffsets é o inverso do buildRangeFromOffsets', () => {
    const layer = makeLayer(PARTS)
    const { text, spanRanges } = buildJoinedPageText(getPageSpans(layer))
    const start = text.indexOf('entrebâillée')
    const range = buildRangeFromOffsets(spanRanges, start, start + 'entrebâillée'.length)
    expect(range).not.toBeNull()
    expect(rangeToJoinedOffsets(spanRanges, range!)).toEqual({ start, end: start + 'entrebâillée'.length })
  })

  it('rangeToJoinedOffsets devolve os offsets de um trecho que atravessa spans', () => {
    const layer = makeLayer(PARTS)
    const { text, spanRanges } = buildJoinedPageText(getPageSpans(layer))
    const from = text.indexOf('grenier')
    const to = text.indexOf('lumière') + 'lumière'.length
    const range = buildRangeFromOffsets(spanRanges, from, to)!
    expect(rangeToJoinedOffsets(spanRanges, range)).toEqual({ start: from, end: to })
    expect(range.toString()).toBe("grenier étaitentrebâillée et il n'y avaitpas de lumière")
  })

  it('rangeToJoinedOffsets dá null quando uma ponta está fora dos spans', () => {
    const layer = makeLayer(PARTS)
    const { spanRanges } = buildJoinedPageText(getPageSpans(layer))
    const outside = document.createElement('p')
    outside.textContent = 'fora da camada'
    document.body.append(outside)
    const range = document.createRange()
    range.setStart(layer.firstElementChild!.firstChild!, 3)
    range.setEnd(outside.firstChild!, 4)
    expect(rangeToJoinedOffsets(spanRanges, range)).toBeNull()
  })

  // O pontilhado das palavras guardadas: os offsets do casamento no texto juntado
  // viram Ranges sobre os spans da página, inclusive quando a expressão atravessa
  // dois spans.
  it('as palavras guardadas viram Ranges sobre os spans, também as que atravessam spans', () => {
    const layer = makeLayer(PARTS)
    const { text, spanRanges } = buildJoinedPageText(getPageSpans(layer))
    const item = (id: string, word: string, kind: VocabularyItem['kind']): VocabularyItem => ({
      id,
      bookId: 'book-1',
      text: word,
      kind,
      sentence: text,
      sense: null,
      baseForm: null,
      language: 'fr',
      page: 42,
      positionLabel: 'p. 42',
      anchor: { format: 'pdf', page: 42, start: 0, end: 0, rects: [] },
      createdAt: '2026-11-27T10:00:00.000Z',
      sentAt: null,
      sentNotebookId: null,
      sentNoteId: null,
    })
    const terms = buildMatchTerms([
      item('a', 'entrebâillée', 'word'),
      item('b', "il n'y avait pas", 'expression'),
    ])
    const marked = findTermOccurrences(text, terms).map((o) => ({
      word: buildRangeFromOffsets(spanRanges, o.start, o.end)?.toString(),
      itemIds: o.itemIds,
    }))
    expect(marked).toEqual([
      { word: 'entrebâillée', itemIds: ['a'] },
      // O Range atravessa o fim do 2º span e o começo do 3º, sem o espaço que os junta.
      { word: "il n'y avaitpas", itemIds: ['b'] },
    ])
  })
})
