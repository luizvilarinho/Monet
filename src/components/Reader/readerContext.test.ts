import { describe, expect, it } from 'vitest'
import type { BookHighlight } from '../../types'
import { buildTeacherBlock } from '../../lib/teacherContext'
import { buildReaderContext, type ReaderContextInput } from './readerContext'

// O texto inventado do Apêndice E do plano.
const PAGE_TEXT =
  "Élise monte au grenier à 21 h 30. La porte du grenier était entrebâillée et il n'y avait pas de lumière, " +
  'alors elle monta en tâtonnant.'

const HIGHLIGHT: BookHighlight = {
  id: 'h1',
  bookId: 'book-1',
  page: 42,
  text: 'une vieille malle',
  color: '#FFEB3B',
  rects: [],
  createdAt: Date.UTC(2026, 10, 20),
}

const INPUT: ReaderContextInput = {
  bookTitle: 'La Maison des dunes',
  bookAuthor: null,
  pageNum: 42,
  totalPages: 310,
  pageText: PAGE_TEXT,
  highlights: [HIGHLIGHT],
}

// A saída de sempre, escrita à mão: o que o chat do leitor mandava antes do
// professor de língua existir.
const TODAY = [
  "[Reading context — automatically attached; reflects the user's reading session at the moment this message was sent. Not visible to the user.]",
  'Book: "La Maison des dunes"',
  'Position: page 42 of 310',
  '',
  `Current page text: ${PAGE_TEXT}`,
  '',
  'Highlights (most recent first, 1 of 1):',
  '- [p. 42, 2026-11-20] "une vieille malle"',
].join('\n')

describe('buildReaderContext', () => {
  it('without the teacher block, the output is the one it always was', () => {
    expect(buildReaderContext(INPUT)).toBe(TODAY)
  })

  it('an absent, undefined or empty teacher block changes nothing', () => {
    expect(buildReaderContext({ ...INPUT, teacherBlock: undefined })).toBe(TODAY)
    expect(buildReaderContext({ ...INPUT, teacherBlock: '' })).toBe(TODAY)
  })

  it('with the teacher block, the only difference is the block at the end', () => {
    const teacherBlock = buildTeacherBlock({
      bookLanguage: 'fr',
      nativeLanguage: 'pt',
      level: 'B1',
      explain: null,
      avoid: null,
      savedOnPage: [{ text: 'entrebâillée', sense: 'entreaberta' }],
    })
    const withTeacher = buildReaderContext({ ...INPUT, teacherBlock })
    expect(withTeacher).toBe(`${TODAY}\n\n${teacherBlock}`)
    expect(withTeacher.startsWith(TODAY)).toBe(true)
  })

  it('the block also goes at the end when the page has no highlights or no text', () => {
    const teacherBlock = 'Language teacher (on)'
    const bare = buildReaderContext({ ...INPUT, highlights: [], pageText: null })
    expect(buildReaderContext({ ...INPUT, highlights: [], pageText: null, teacherBlock })).toBe(
      `${bare}\n\n${teacherBlock}`,
    )
  })

  it('keeps the labels of the EPUB', () => {
    const output = buildReaderContext({
      ...INPUT,
      positionLabel: 'Chapter 3, 41%',
      highlightLabel: () => '41%',
      teacherBlock: 'Language teacher (on)',
    })
    expect(output).toContain('Position: Chapter 3, 41%')
    expect(output).toContain('- [41%, 2026-11-20] "une vieille malle"')
    expect(output.endsWith('Language teacher (on)')).toBe(true)
  })
})
