import { describe, expect, it } from 'vitest'
import type { VocabularyItem } from '../types'
import {
  buildMatchTerms,
  contextSentenceAt,
  countTermBefore,
  epubSentenceAnchors,
  findTermOccurrences,
  pdfSentenceAnchors,
} from './vocabMatch'

// O parágrafo inventado do Apêndice E do plano.
const TEXT =
  "Élise monte au grenier à 21 h 30. La porte du grenier était entrebâillée et il n'y avait pas de lumière, " +
  'alors elle monta en tâtonnant. Au fond, une vieille malle pleine de lettres attendait.'

function item(overrides: Partial<VocabularyItem> & { id: string; text: string }): VocabularyItem {
  return {
    bookId: 'book-1',
    kind: 'word',
    sentence: TEXT,
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
    ...overrides,
  }
}

function occurrencesOf(items: VocabularyItem[], text = TEXT) {
  return findTermOccurrences(text, buildMatchTerms(items)).map((o) => ({
    word: text.slice(o.start, o.end),
    itemIds: o.itemIds,
  }))
}

describe('buildMatchTerms', () => {
  it('takes words and expressions, and leaves sentences out', () => {
    const terms = buildMatchTerms([
      item({ id: 'a', text: 'malle' }),
      item({ id: 'b', text: 'en tâtonnant', kind: 'expression' }),
      item({ id: 'c', text: 'Elle monta en tâtonnant.', kind: 'sentence' }),
    ])
    expect(terms.map((t) => t.form).sort()).toEqual(['en tâtonnant', 'malle'])
  })

  it('has the stored form and the base form, normalized', () => {
    const terms = buildMatchTerms([item({ id: 'a', text: 'Entrebâillée', baseForm: 'entrebâiller' })])
    expect(terms.map((t) => t.form).sort()).toEqual(['entrebâiller', 'entrebâillée'])
  })

  it('groups the items that share a form', () => {
    const terms = buildMatchTerms([
      item({ id: 'a', text: 'malle' }),
      item({ id: 'b', text: 'Malle', sentence: 'Une autre malle.' }),
      item({ id: 'c', text: 'mallette', baseForm: 'malle' }),
    ])
    expect(terms.find((t) => t.form === 'malle')?.itemIds.sort()).toEqual(['a', 'b', 'c'])
    expect(terms.find((t) => t.form === 'mallette')?.itemIds).toEqual(['c'])
  })

  it('ignores a base form that is empty', () => {
    expect(buildMatchTerms([item({ id: 'a', text: 'malle', baseForm: '  ' })])).toHaveLength(1)
  })
})

describe('findTermOccurrences', () => {
  it('finds a whole word and gives its position', () => {
    const [occurrence] = findTermOccurrences(TEXT, buildMatchTerms([item({ id: 'a', text: 'malle' })]))
    expect(TEXT.slice(occurrence.start, occurrence.end)).toBe('malle')
    expect(occurrence.itemIds).toEqual(['a'])
  })

  it('does not match a word inside another one', () => {
    const text = 'Une mallette posée près de la malle.'
    expect(occurrencesOf([item({ id: 'a', text: 'malle' })], text)).toEqual([{ word: 'malle', itemIds: ['a'] }])
    expect(occurrencesOf([item({ id: 'a', text: 'malle' })], 'Une mallette posée là.')).toEqual([])
  })

  it('does not match when a digit or an accented letter follows', () => {
    expect(occurrencesOf([item({ id: 'a', text: 'porte' })], 'La portée du son et porte2.')).toEqual([])
  })

  it('ignores the case', () => {
    expect(occurrencesOf([item({ id: 'a', text: 'grenier' })], 'GRENIER. Grenier. grenier.')).toHaveLength(3)
  })

  it('matches the base form when it is stored', () => {
    const items = [item({ id: 'a', text: 'en tâtonnant', kind: 'expression', baseForm: 'tâtonner' })]
    const text = 'Elle monta en tâtonnant. Il faut tâtonner dans le noir.'
    expect(occurrencesOf(items, text)).toEqual([
      { word: 'en tâtonnant', itemIds: ['a'] },
      { word: 'tâtonner', itemIds: ['a'] },
    ])
  })

  it('an item without a base form only matches its exact form', () => {
    // Ponto 15 do UX report: guardado sem traduzir, "tâtonnant" não tem forma base.
    const items = [item({ id: 'a', text: 'tâtonnant' })]
    const text = 'Elle tâtonnait. Il faut tâtonner. Elle monta en tâtonnant.'
    expect(occurrencesOf(items, text)).toEqual([{ word: 'tâtonnant', itemIds: ['a'] }])
  })

  it('matches an expression across a line break and extra spaces', () => {
    const items = [item({ id: 'a', text: 'en tâtonnant', kind: 'expression' })]
    const text = 'alors elle monta en\ntâtonnant jusqu’au fond, puis en   tâtonnant encore.'
    expect(occurrencesOf(items, text)).toEqual([
      { word: 'en\ntâtonnant', itemIds: ['a'] },
      { word: 'en   tâtonnant', itemIds: ['a'] },
    ])
  })

  it('matches the typographic apostrophe for the straight one, and the other way around', () => {
    const straight = [item({ id: 'a', text: "n'y avait", kind: 'expression' })]
    expect(occurrencesOf(straight, 'Il n’y avait pas de lumière.')).toEqual([{ word: 'n’y avait', itemIds: ['a'] }])
    const curly = [item({ id: 'b', text: 'n’y avait', kind: 'expression' })]
    expect(occurrencesOf(curly, "Il n'y avait pas de lumière.")).toEqual([{ word: "n'y avait", itemIds: ['b'] }])
  })

  it('a word after an apostrophe is a word (l’homme)', () => {
    expect(occurrencesOf([item({ id: 'a', text: 'homme' })], "L'homme et l’homme.")).toHaveLength(2)
  })

  it('the longer overlap wins', () => {
    const items = [
      item({ id: 'a', text: 'tâtonnant' }),
      item({ id: 'b', text: 'en tâtonnant', kind: 'expression' }),
    ]
    expect(occurrencesOf(items, 'Elle monta en tâtonnant.')).toEqual([{ word: 'en tâtonnant', itemIds: ['b'] }])
  })

  it('the longer overlap wins across batches too', () => {
    // 260 formas de enchimento forçam a divisão em dois lotes; a forma curta cai no
    // segundo, a longa no primeiro.
    const filler = Array.from({ length: 260 }, (_, i) => item({ id: `f${i}`, text: `xmot${String(i).padStart(3, '0')}zz` }))
    const items = [
      ...filler,
      item({ id: 'short', text: 'tâtonnant' }),
      item({ id: 'long', text: 'monta en tâtonnant', kind: 'expression' }),
    ]
    expect(occurrencesOf(items, 'Elle monta en tâtonnant.')).toEqual([
      { word: 'monta en tâtonnant', itemIds: ['long'] },
    ])
  })

  it('a form with regex characters is taken literally', () => {
    const items = [item({ id: 'a', text: 'c.-à-d.', kind: 'expression' })]
    expect(occurrencesOf(items, 'On dit c.-à-d. ou cXàXd.')).toEqual([{ word: 'c.-à-d.', itemIds: ['a'] }])
  })

  it('no terms or no text, no occurrences', () => {
    expect(findTermOccurrences(TEXT, [])).toEqual([])
    expect(findTermOccurrences('', buildMatchTerms([item({ id: 'a', text: 'malle' })]))).toEqual([])
  })

  it('500 terms in a 5,000-character text take a single pass per batch', () => {
    const items = Array.from({ length: 500 }, (_, i) =>
      item({ id: `i${i}`, text: i % 50 === 0 ? 'grenier' : `terme${String(i).padStart(3, '0')}`, baseForm: i % 7 === 0 ? `base${i}` : null }),
    )
    let text = ''
    while (text.length < 5000) text += TEXT + ' '
    const terms = buildMatchTerms(items)
    expect(terms.length).toBeGreaterThan(400)
    const started = performance.now()
    const occurrences = findTermOccurrences(text, terms)
    const elapsed = performance.now() - started
    expect(occurrences.length).toBeGreaterThan(5)
    // O alvo é 50 ms; a folga cobre a máquina de CI.
    expect(elapsed).toBeLessThan(400)
  })
})

describe('sentence anchors', () => {
  const pdfSentence = (id: string, page: number, start: number, end: number, bookId = 'book-1') =>
    item({
      id,
      bookId,
      text: 'Elle sursauta.',
      kind: 'sentence',
      page,
      anchor: { format: 'pdf', page, start, end, rects: [] },
    })

  it('takes the sentences of this book saved on this page of the PDF', () => {
    const items = [
      pdfSentence('a', 42, 10, 24),
      pdfSentence('b', 43, 10, 24),
      pdfSentence('c', 42, 5, 30, 'book-2'),
      item({ id: 'd', text: 'malle' }),
    ]
    expect(pdfSentenceAnchors(items, 'book-1', 42)).toEqual([{ itemId: 'a', start: 10, end: 24 }])
  })

  it('a sentence without offsets marks nothing', () => {
    expect(pdfSentenceAnchors([pdfSentence('a', 42, 0, 0)], 'book-1', 42)).toEqual([])
  })

  it('takes the sentences of this book saved in the EPUB, with the CFI', () => {
    const items = [
      item({
        id: 'a',
        text: 'Elle sursauta.',
        kind: 'sentence',
        anchor: { format: 'epub', cfiRange: 'epubcfi(/6/4!/4/2,/1:0,/1:14)' },
      }),
      item({
        id: 'b',
        bookId: 'book-2',
        text: 'Elle sursauta.',
        kind: 'sentence',
        anchor: { format: 'epub', cfiRange: 'epubcfi(/6/8!/4/2,/1:0,/1:14)' },
      }),
      pdfSentence('c', 42, 10, 24),
    ]
    expect(epubSentenceAnchors(items, 'book-1')).toEqual([
      { itemId: 'a', cfiRange: 'epubcfi(/6/4!/4/2,/1:0,/1:14)' },
    ])
  })
})

// Duas "malle" na página, uma "mallette" antes delas (texto inventado).
const REPEATED =
  'Elle prit la mallette posée près du lit. La malle était lourde. Au grenier, elle ouvrit la malle avec effort. ' +
  'Une vieille malle ne se déplace pas seule.'

describe('countTermBefore and contextSentenceAt', () => {
  it('counts the whole-word occurrences before an offset, not "mallette"', () => {
    expect(countTermBefore(REPEATED, 'malle', 0)).toBe(0)
    // A "malle" de "La malle était lourde." é a primeira; a de "la malle avec effort", a segunda.
    const first = REPEATED.indexOf('La malle') + 3
    const second = REPEATED.indexOf('la malle avec') + 3
    expect(countTermBefore(REPEATED, 'malle', first)).toBe(0)
    expect(countTermBefore(REPEATED, 'malle', second)).toBe(1)
    expect(countTermBefore(REPEATED, 'malle', REPEATED.length)).toBe(3)
    expect(countTermBefore(REPEATED, 'MALLE', REPEATED.length)).toBe(3)
    expect(countTermBefore(REPEATED, '', 10)).toBe(0)
  })

  it('the first occurrence gives the first sentence with the word, skipping "mallette"', () => {
    expect(contextSentenceAt(REPEATED, 'malle', 'fr', 0)).toBe('La malle était lourde.')
  })

  it('the second and the third occurrence give their own sentences, not the first one again', () => {
    expect(contextSentenceAt(REPEATED, 'malle', 'fr', 1)).toBe('Au grenier, elle ouvrit la malle avec effort.')
    expect(contextSentenceAt(REPEATED, 'malle', 'fr', 2)).toBe('Une vieille malle ne se déplace pas seule.')
  })

  it('two occurrences in the same sentence give that sentence', () => {
    const text = 'La malle et la malle jumelle. Une autre phrase.'
    expect(contextSentenceAt(text, 'malle', 'fr', 0)).toBe('La malle et la malle jumelle.')
    expect(contextSentenceAt(text, 'malle', 'fr', 1)).toBe('La malle et la malle jumelle.')
  })

  it('an expression, case and spacing do not matter', () => {
    expect(contextSentenceAt(REPEATED, 'Au  grenier', 'fr', 0)).toBe('Au grenier, elle ouvrit la malle avec effort.')
  })

  it('an occurrence that does not exist, or a piece of a word, falls back to the old rule', () => {
    // Fora da contagem: a primeira frase que contém o texto, como antes.
    expect(contextSentenceAt(REPEATED, 'malle', 'fr', 9)).toBe('Elle prit la mallette posée près du lit.')
    expect(contextSentenceAt(REPEATED, 'mall', 'fr', 0)).toBe('Elle prit la mallette posée près du lit.')
    // Nem no texto: a própria seleção.
    expect(contextSentenceAt(REPEATED, 'cheval', 'fr', 0)).toBe('cheval')
  })
})
