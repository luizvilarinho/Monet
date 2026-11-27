import { describe, expect, it } from 'vitest'
import type { VocabularyItem } from '../types'
import {
  buildFeedbackMessage,
  buildRetellBlock,
  extractLastRetell,
  hasRetell,
  retellItems,
  retellRangeLabel,
  retellWords,
} from './retell'

function item(overrides: Partial<VocabularyItem> & { id: string; text: string }): VocabularyItem {
  return {
    bookId: 'book-1',
    kind: 'word',
    sentence: 'Élise monte au grenier.',
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

const none: ReadonlySet<string> = new Set()

describe('retellWords', () => {
  const items = [
    item({ id: 'a', text: 'entrebâillée' }),
    item({ id: 'b', text: 'en tâtonnant', kind: 'expression', page: 43 }),
    item({ id: 'c', text: 'Elle sursauta.', kind: 'sentence' }),
    item({ id: 'd', text: 'malle', sentAt: '2026-11-27T11:00:00.000Z' }),
  ]

  it('takes the new words and expressions when nothing is ticked, and leaves out sentences and what was sent', () => {
    expect(retellWords(items, none)).toEqual(['entrebâillée', 'en tâtonnant'])
  })

  it('takes the ticked ones, even one that was already sent, but still no sentence', () => {
    expect(retellWords(items, new Set(['d', 'c', 'a']))).toEqual(['entrebâillée', 'malle'])
  })

  it('a form saved in two sentences shows once', () => {
    const twice = [
      item({ id: 'a', text: 'malle', sentence: 'Une malle.' }),
      item({ id: 'b', text: 'Malle', sentence: 'Une autre malle.' }),
    ]
    expect(retellWords(twice, none)).toEqual(['malle'])
  })

  it('nothing to use gives an empty list', () => {
    expect(retellWords([], none)).toEqual([])
    expect(retellItems([item({ id: 'a', text: 'Elle sursauta.', kind: 'sentence' })], none)).toEqual([])
  })
})

describe('retellRangeLabel', () => {
  it('one page of the PDF', () => {
    expect(retellRangeLabel([item({ id: 'a', text: 'malle', page: 42 })], 'pdf')).toBe('p. 42')
  })

  it('two pages of the PDF, by the lowest and the highest', () => {
    const items = [
      item({ id: 'a', text: 'malle', page: 43 }),
      item({ id: 'b', text: 'grenier', page: 42 }),
      item({ id: 'c', text: 'lumière', page: 43 }),
    ]
    expect(retellRangeLabel(items, 'pdf')).toBe('p. 42–43')
  })

  it('the chapter of the first item of the EPUB, without the percentage', () => {
    const items = [item({ id: 'a', text: 'malle', positionLabel: 'Chapter 3, 41%' })]
    expect(retellRangeLabel(items, 'epub')).toBe('Chapter 3')
  })

  it('a label that is only the percentage stays as it is', () => {
    expect(retellRangeLabel([item({ id: 'a', text: 'malle', positionLabel: '41%' })], 'epub')).toBe('41%')
  })

  it('no items, no label', () => {
    expect(retellRangeLabel([], 'pdf')).toBe('')
  })
})

describe('buildRetellBlock', () => {
  it('has the header with the range and the date, and the line of words', () => {
    expect(buildRetellBlock(['entrebâillée', 'en tâtonnant', 'malle', 'fouiller'], 'p. 42–43', 'Nov 27')).toBe(
      '### Retell · p. 42–43 · Nov 27\n\nWords: entrebâillée · en tâtonnant · malle · fouiller',
    )
  })
})

describe('extractLastRetell', () => {
  const block = buildRetellBlock(['entrebâillée', 'malle'], 'p. 42–43', 'Nov 27')

  it('reads what was written below the line of words', () => {
    const content = `${block}\n\nÉlise monte au grenier. Elle trouve une malle.`
    expect(extractLastRetell(content)).toBe('Élise monte au grenier. Elle trouve une malle.')
  })

  it('keeps the paragraphs of the retelling', () => {
    const content = `${block}\n\nElle monte.\n\nElle trouve une malle.`
    expect(extractLastRetell(content)).toBe('Elle monte.\n\nElle trouve une malle.')
  })

  it('nothing written gives null', () => {
    expect(extractLastRetell(block)).toBeNull()
    expect(extractLastRetell(`${block}\n\n   \n`)).toBeNull()
  })

  it('a note without a Retell gives null', () => {
    expect(extractLastRetell('> Elle sursauta.\n\n— *La Maison des dunes*, p. 43')).toBeNull()
    expect(extractLastRetell('')).toBeNull()
  })

  it('with two retellings, takes the last one', () => {
    const second = buildRetellBlock(['fouiller'], 'p. 44', 'Nov 28')
    const content = `${block}\n\nPremier reconto.\n\n${second}\n\nDeuxième reconto.`
    expect(extractLastRetell(content)).toBe('Deuxième reconto.')
  })

  it('stops at the next header, and a header the editor writes with more words stays out of it', () => {
    const vocabulary = '### From *La Maison des dunes* · Nov 28\n\n**malle**\n\n> Une malle.'
    const content = `${block}\n\nElle monte au grenier.\n\n${vocabulary}`
    expect(extractLastRetell(content)).toBe('Elle monte au grenier.')
  })

  it('the text before the header is not part of it', () => {
    const content = `Notes de lecture.\n\n${block}\n\nElle monte.`
    expect(extractLastRetell(content)).toBe('Elle monte.')
  })

  it('a bold line of words is not part of the retelling either', () => {
    const content = '### Retell · p. 42 · Nov 27\n\n**Words:** malle\n\nElle monte.'
    expect(extractLastRetell(content)).toBe('Elle monte.')
  })
})

describe('hasRetell', () => {
  it('knows a note with a Retell block, and a note without one', () => {
    expect(hasRetell(buildRetellBlock(['malle'], 'p. 42', 'Nov 27'))).toBe(true)
    expect(hasRetell('Notes de lecture.\n\n### Retell · p. 42 · Nov 27\n\nWords: malle')).toBe(true)
    expect(hasRetell('> Elle sursauta.\n\n— *La Maison des dunes*, p. 43')).toBe(false)
    expect(hasRetell('')).toBe(false)
  })
})

describe('buildFeedbackMessage', () => {
  it('quotes the retelling and asks for comments, not for a rewrite', () => {
    expect(buildFeedbackMessage('Élise monte au grenier.\n\nElle trouve une malle.')).toBe(
      "> Élise monte au grenier.\n>\n> Elle trouve une malle.\n\nComment on my retelling. Don't rewrite it.",
    )
  })

  it('cuts a long retelling at 1,500 characters, with an ellipsis', () => {
    const message = buildFeedbackMessage('a'.repeat(2000))
    const quote = message.split('\n\n')[0]
    expect(quote).toBe(`> ${'a'.repeat(1500)}…`)
    expect(message.endsWith("Don't rewrite it.")).toBe(true)
  })
})
