import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { buildBaseExtensions } from '../components/Editor/extensions'
import type { Book, VocabularyItem } from '../types'

// O Library grava pelo storage; aqui só as funções puras são exercitadas.
vi.mock('../storage', () => ({ storage: {} }))

import { appendQuoteToContent, removeAppendedBlock } from './bookQuotes'
import {
  buildListenSource,
  buildVocabularyItem,
  buildVocabularyNoteBlock,
  findDuplicate,
  formatVocabularyDate,
  groupBySentMark,
  itemsToListen,
  itemsToSend,
  normalizeTerm,
  parseVocabularyAnchor,
  sendButtonLabel,
  splitAtTerm,
  splitBySent,
  translationFields,
  vocabularyDedupKey,
} from './vocabulary'

// Texto inventado do Apêndice E do plano: o livro, as frases e a posição.
const TITLE = 'La Maison des dunes'
const SENTENCE_1 = 'La porte du grenier était entrebâillée.'
const SENTENCE_2 = 'Elle sursauta.'

const book: Book = {
  id: 'book-1',
  title: TITLE,
  author: null,
  filePath: 'books/book-1.pdf',
  totalPages: 300,
  lastPage: 42,
  addedAt: 1,
  lastOpenedAt: null,
  zoom: 1,
  language: 'fr',
  format: 'pdf',
}

function item(over: Partial<VocabularyItem> = {}): VocabularyItem {
  return {
    id: 'i1',
    bookId: 'book-1',
    text: 'entrebâillée',
    kind: 'word',
    sentence: SENTENCE_1,
    sense: null,
    baseForm: null,
    language: 'fr',
    page: 42,
    positionLabel: 'p. 42',
    anchor: { format: 'pdf', page: 42, start: 0, end: 12, rects: [] },
    createdAt: '2026-11-27T10:00:00.000Z',
    sentAt: null,
    sentNotebookId: null,
    sentNoteId: null,
    ...over,
  }
}

describe('normalizeTerm', () => {
  it('lowercases, collapses spaces and straightens typographic quotes', () => {
    expect(normalizeTerm('  L’Homme   « Fort »\n')).toBe('l\'homme " fort "')
  })

  it('composes accents (NFC)', () => {
    expect(normalizeTerm('entrebâillée'.normalize('NFD'))).toBe('entrebâillée')
  })
})

describe('duplicates', () => {
  it('the same text in the same sentence is the same item, whatever the spacing', () => {
    const items = [item()]
    const candidate = {
      bookId: 'book-1',
      text: 'Entrebâillée ',
      sentence: 'La porte  du grenier\nétait entrebâillée.',
    }
    expect(findDuplicate(items, candidate)?.id).toBe('i1')
  })

  it('the same word in another sentence is a new item', () => {
    const candidate = { bookId: 'book-1', text: 'entrebâillée', sentence: 'La fenêtre restait entrebâillée.' }
    expect(findDuplicate([item()], candidate)).toBeNull()
  })

  it('the same text in another book is a new item', () => {
    expect(vocabularyDedupKey('a', 'x', 'y')).not.toBe(vocabularyDedupKey('b', 'x', 'y'))
  })
})

describe('buildVocabularyItem', () => {
  const draft = {
    book,
    text: ' entrebâillée ',
    sentence: SENTENCE_1,
    kind: 'word' as const,
    sense: 'entreaberta',
    baseForm: 'entrebâiller',
    page: 42,
    positionLabel: 'p. 42',
    anchor: { format: 'pdf' as const, page: 42, start: 21, end: 33, rects: [] },
  }

  it('copies the base language of the book and starts unsent', () => {
    const built = buildVocabularyItem({ ...draft, book: { ...book, language: 'fr' } })
    expect(built.language).toBe('fr')
    expect(built.text).toBe('entrebâillée')
    expect(built.sentAt).toBeNull()
    expect(built.id).toMatch(/[0-9a-f-]{36}/)
    expect(Number.isNaN(Date.parse(built.createdAt))).toBe(false)
  })

  it('a saved sentence is its own source sentence', () => {
    const built = buildVocabularyItem({ ...draft, text: SENTENCE_2, kind: 'sentence', sentence: 'outra' })
    expect(built.sentence).toBe(SENTENCE_2)
  })

  it('empty sense and base form become null', () => {
    const built = buildVocabularyItem({ ...draft, sense: '  ', baseForm: '' })
    expect(built.sense).toBeNull()
    expect(built.baseForm).toBeNull()
  })
})

describe('translationFields', () => {
  it('takes the sense and base form of a word, the translation of a passage', () => {
    expect(
      translationFields({
        kind: 'word',
        term: 'entrebâillée',
        baseForm: 'entrebâiller',
        partOfSpeech: null,
        gender: null,
        sense: 'entreaberta',
        note: null,
      }),
    ).toEqual({ sense: 'entreaberta', baseForm: 'entrebâiller' })
    expect(translationFields({ kind: 'passage', translation: 'Ela se assustou.', grammar: [] })).toEqual({
      sense: 'Ela se assustou.',
      baseForm: null,
    })
    expect(translationFields(null)).toEqual({ sense: null, baseForm: null })
  })
})

describe('parseVocabularyAnchor', () => {
  it('reads a PDF anchor, dropping rects that do not read', () => {
    const raw = JSON.stringify({
      format: 'pdf',
      page: 42,
      start: 3,
      end: 9,
      rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.04 }, { x: 'a' }],
    })
    expect(parseVocabularyAnchor(raw)).toEqual({
      format: 'pdf',
      page: 42,
      start: 3,
      end: 9,
      rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.04 }],
    })
  })

  it('reads an EPUB anchor', () => {
    const raw = JSON.stringify({ format: 'epub', cfiRange: 'epubcfi(/6/4!/4/2,/1:0,/1:5)' })
    expect(parseVocabularyAnchor(raw)).toEqual({ format: 'epub', cfiRange: 'epubcfi(/6/4!/4/2,/1:0,/1:5)' })
  })

  it('refuses what is not an anchor', () => {
    expect(parseVocabularyAnchor('{nope')).toBeNull()
    expect(parseVocabularyAnchor('null')).toBeNull()
    expect(parseVocabularyAnchor('{"format":"epub","cfiRange":""}')).toBeNull()
    expect(parseVocabularyAnchor('{"format":"pdf","page":"4"}')).toBeNull()
    expect(parseVocabularyAnchor('{"format":"docx"}')).toBeNull()
  })
})

describe('the note block', () => {
  const word = item({ sense: 'entreaberta', baseForm: 'entrebâiller' })
  const sentence = item({
    id: 'i2',
    text: SENTENCE_2,
    kind: 'sentence',
    sentence: SENTENCE_2,
    sense: 'Ela se assustou.',
    page: 43,
    positionLabel: 'p. 43',
  })

  const TOGGLE = '<div data-type="toggle-block" data-title="Translation" data-collapsed="true">'

  it('writes the word in bold with its base form, the sentence as a quote and the translation in a toggle', () => {
    expect(buildVocabularyNoteBlock([word, sentence], TITLE, true, 'Nov 27')).toBe(
      [
        `### From *${TITLE}* · Nov 27`,
        '',
        '**entrebâillée** (entrebâiller)',
        '',
        `> ${SENTENCE_1}`,
        '',
        `— *${TITLE}*, p. 42`,
        '',
        TOGGLE,
        '',
        'entreaberta',
        '',
        '</div>',
        '',
        `> ${SENTENCE_2}`,
        '',
        `— *${TITLE}*, p. 43`,
        '',
        TOGGLE,
        '',
        'Ela se assustou.',
        '',
        '</div>',
      ].join('\n'),
    )
  })

  it('leaves the toggles out when the translation is off', () => {
    const block = buildVocabularyNoteBlock([word, sentence], TITLE, false, 'Nov 27')
    expect(block).not.toContain('toggle-block')
    expect(block).not.toContain('entreaberta')
  })

  it('an item without a sense has no toggle', () => {
    const block = buildVocabularyNoteBlock([item()], TITLE, true, 'Nov 27')
    expect(block).not.toContain('toggle-block')
  })

  it('shows no parentheses when the base form is the term', () => {
    const same = buildVocabularyNoteBlock([item({ baseForm: 'Entrebâillée' })], TITLE, true, 'Nov 27')
    expect(same).toContain('**entrebâillée**\n')
    expect(same).not.toContain('(')
  })

  it('a saved sentence goes as a quote only, without the bold line', () => {
    const block = buildVocabularyNoteBlock([sentence], TITLE, false, 'Nov 27')
    expect(block).not.toContain('**')
    expect(block).toContain(`> ${SENTENCE_2}\n\n— *${TITLE}*, p. 43`)
  })

  it('a text with line breaks stays one quote line', () => {
    const block = buildVocabularyNoteBlock(
      [item({ sentence: 'La porte\ndu grenier\n\nétait entrebâillée.' })],
      TITLE,
      false,
      'Nov 27',
    )
    expect(block).toContain('> La porte du grenier était entrebâillée.')
  })
})

describe('appending the block to a note', () => {
  const block = buildVocabularyNoteBlock(
    [item({ sense: 'entreaberta' })],
    TITLE,
    true,
    'Nov 27',
  )

  it('lands whole and at the end, after what the note already had', () => {
    const content = appendQuoteToContent('# Notes\n\nFirst line.', block)
    expect(content.startsWith('# Notes\n\nFirst line.\n\n')).toBe(true)
    expect(content.endsWith(block)).toBe(true)
    expect(content.split(block)).toHaveLength(2)
  })

  it('goes into an empty note as is', () => {
    expect(appendQuoteToContent('', block)).toBe(block)
  })

  it('comes out again with the Undo, leaving the note as it was', () => {
    const before = '# Notes\n\nFirst line.'
    expect(removeAppendedBlock(appendQuoteToContent(before, block), block)).toBe(before)
  })
})

// O bloco passa pelo editor real (as mesmas extensões do Editor): o toggle tem de
// abrir como toggle recolhido, e o editor tem de regravar o mesmo texto, senão o
// Undo (que procura o bloco na nota) não o acharia depois de a nota ser aberta.
describe('the block through the real editor', () => {
  let editor: Editor
  beforeEach(() => {
    editor = new Editor({ extensions: buildBaseExtensions('') })
  })
  afterEach(() => {
    editor.destroy()
  })

  function findAll(node: JSONContent, type: string): JSONContent[] {
    const own = node.type === type ? [node] : []
    return own.concat(...(node.content ?? []).map((child) => findAll(child, type)))
  }
  function saved(): string {
    return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
  }

  const items = [
    item({ sense: 'entreaberta', baseForm: 'entrebâiller' }),
    item({
      id: 'i2',
      text: SENTENCE_2,
      kind: 'sentence',
      sentence: SENTENCE_2,
      sense: 'Ela se assustou.',
      page: 43,
      positionLabel: 'p. 43',
    }),
  ]

  it('opens as collapsed Translation toggles', () => {
    editor.commands.setContent(appendQuoteToContent('Intro.', buildVocabularyNoteBlock(items, TITLE, true, 'Nov 27')))
    const toggles = findAll(editor.getJSON(), 'toggleBlock')
    expect(toggles).toHaveLength(2)
    for (const toggle of toggles) {
      expect(toggle.attrs).toMatchObject({ title: 'Translation', collapsed: true })
    }
    expect(findAll(editor.getJSON(), 'blockquote')).toHaveLength(2)
  })

  it('is written back unchanged', () => {
    const content = appendQuoteToContent('Intro.', buildVocabularyNoteBlock(items, TITLE, true, 'Nov 27'))
    editor.commands.setContent(content)
    expect(saved()).toBe(content)
  })
})

describe('the list and the send button', () => {
  const fresh = item({ id: 'a' })
  const fresh2 = item({ id: 'b', text: 'malle', sentence: 'Une vieille malle attendait.' })
  const sentItem = item({
    id: 'c',
    text: 'fouiller',
    sentence: 'Ne fouille pas là-dedans.',
    sentAt: '2026-11-26T10:00:00.000Z',
    sentNotebookId: 'nb',
    sentNoteId: 'note-1',
  })
  const all = [fresh, fresh2, sentItem]

  it('splits new and sent', () => {
    const { fresh: news, sent } = splitBySent(all)
    expect(news.map((i) => i.id)).toEqual(['a', 'b'])
    expect(sent.map((i) => i.id)).toEqual(['c'])
  })

  it('sends the marked items in list order, or the new ones when none is marked', () => {
    expect(itemsToSend(all, new Set()).map((i) => i.id)).toEqual(['a', 'b'])
    expect(itemsToSend(all, new Set(['c', 'a'])).map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('listens to the same items, and to the whole list once everything is sent', () => {
    expect(itemsToListen(all, new Set()).map((i) => i.id)).toEqual(['a', 'b'])
    expect(itemsToListen([sentItem], new Set()).map((i) => i.id)).toEqual(['c'])
  })

  it('labels the button', () => {
    expect(sendButtonLabel(6, [])).toBe('Send 6 new to notebook')
    expect(sendButtonLabel(0, [])).toBe('Nothing new to send')
    expect(sendButtonLabel(6, [fresh, fresh2])).toBe('Send 2 selected')
    expect(sendButtonLabel(6, [sentItem])).toBe('Send 1 selected again')
    expect(sendButtonLabel(6, [fresh, fresh2, sentItem])).toBe('Send 3 selected (1 again)')
  })

  it('groups the items by the mark they had, so an Undo can give each its own back', () => {
    const groups = groupBySentMark(all)
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.sent === null)?.ids).toEqual(['a', 'b'])
    expect(groups.find((g) => g.sent)?.sent).toEqual({
      at: '2026-11-26T10:00:00.000Z',
      notebookId: 'nb',
      noteId: 'note-1',
    })
  })
})

describe('splitAtTerm', () => {
  it('splits around the term, whatever its case', () => {
    expect(splitAtTerm('La porte était Entrebâillée.', 'entrebâillée')).toEqual({
      before: 'La porte était ',
      match: 'Entrebâillée',
      after: '.',
    })
  })

  it('bolds the whole word, not the start of "mallette" that comes first', () => {
    expect(splitAtTerm('Elle prit la mallette. La malle était lourde.', 'malle')).toEqual({
      before: 'Elle prit la mallette. La ',
      match: 'malle',
      after: ' était lourde.',
    })
  })

  it('a term that is only a piece of a word still gets its first piece', () => {
    expect(splitAtTerm('Elle prit la mallette.', 'mall')).toEqual({
      before: 'Elle prit la ',
      match: 'mall',
      after: 'ette.',
    })
  })

  it('an expression and a term at the ends of the sentence', () => {
    expect(splitAtTerm('Malle: au fond, une malle', 'malle')?.before).toBe('')
    expect(splitAtTerm('Elle sort en tâtonnant', 'en tâtonnant')).toEqual({
      before: 'Elle sort ',
      match: 'en tâtonnant',
      after: '',
    })
  })

  it('is null when the term is not in the sentence', () => {
    expect(splitAtTerm('Elle sursauta.', 'malle')).toBeNull()
    expect(splitAtTerm('Elle sursauta.', ' ')).toBeNull()
  })
})

describe('formatVocabularyDate', () => {
  it('formats a date and gives nothing for a broken one', () => {
    expect(formatVocabularyDate('2026-11-27T12:00:00.000Z', 'en-US')).toMatch(/2026/)
    expect(formatVocabularyDate('not a date', 'en-US')).toBe('')
  })
})

describe('buildListenSource', () => {
  it('reads the source sentence of each item, in order, without a page', () => {
    const items = [item(), item({ id: 'b', text: 'sursauta', sentence: SENTENCE_2 })]
    const source = buildListenSource(items, 'fr')
    expect(source).toMatchObject({
      kind: 'list',
      originLabel: 'Vocabulary · 2 items',
      endLabel: 'End of the list',
      sentences: [SENTENCE_1, SENTENCE_2],
      page: null,
      backLabel: null,
      notice: null,
    })
    expect(source?.chars).toBe(SENTENCE_1.length + SENTENCE_2.length)
  })

  it('splits a long source into sentences of at most 400 characters', () => {
    const long = `${'Elle regardait la mer et les dunes, '.repeat(20)}puis elle partit.`
    const source = buildListenSource([item({ sentence: long })], 'fr')
    expect(source && source.sentences.length).toBeGreaterThan(1)
    expect(source?.sentences.every((s) => s.length <= 400)).toBe(true)
  })

  it('says "1 item" for one and is null with nothing to read', () => {
    expect(buildListenSource([item()], 'fr')?.originLabel).toBe('Vocabulary · 1 item')
    expect(buildListenSource([], 'fr')).toBeNull()
  })
})
