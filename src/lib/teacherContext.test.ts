import { describe, expect, it } from 'vitest'
import { buildTeacherBlock, savedWordsCount, teacherChipLabel, type TeacherInput } from './teacherContext'

const BASE: TeacherInput = {
  bookLanguage: 'fr',
  nativeLanguage: 'pt',
  level: 'B1',
  explain: 'grammar in Portuguese, short, with one example from the page.',
  avoid: "translate whole pages for me. Don't rewrite what I write.",
  savedOnPage: [
    { text: 'entrebâillée', sense: 'entreaberta' },
    { text: 'malle', sense: null },
    { text: 'en tâtonnant', sense: null },
  ],
}

describe('buildTeacherBlock', () => {
  it('has the languages, the level, the profile lines and the words saved on the page', () => {
    expect(buildTeacherBlock(BASE).split('\n')).toEqual([
      'Language teacher (on)',
      "- Book language: French. Reader's language: Portuguese. Level in French: B1.",
      '- Answer in Portuguese. Quote examples in French from the page.',
      "- When the reader writes in French, comment on what to fix and why. Don't rewrite the whole text.",
      '- Explain: grammar in Portuguese, short, with one example from the page.',
      "- Avoid: translate whole pages for me. Don't rewrite what I write.",
      '- Words the reader saved on this page: entrebâillée (entreaberta); malle; en tâtonnant.',
    ])
  })

  it('without a level, it says nothing about the level', () => {
    const block = buildTeacherBlock({ ...BASE, level: null })
    expect(block).toContain("- Book language: French. Reader's language: Portuguese.\n")
    expect(block).not.toContain('Level in')
  })

  it('without profile lines or saved words, only the fixed lines stay', () => {
    const block = buildTeacherBlock({ ...BASE, level: null, explain: null, avoid: null, savedOnPage: [] })
    expect(block.split('\n')).toHaveLength(4)
    expect(block).not.toContain('Explain')
    expect(block).not.toContain('Avoid')
    expect(block).not.toContain('Words the reader saved')
  })

  it('a word saved twice on the page shows once', () => {
    const block = buildTeacherBlock({
      ...BASE,
      savedOnPage: [
        { text: 'Malle', sense: null },
        { text: 'malle', sense: 'baú' },
      ],
    })
    expect(block).toContain('saved on this page: Malle.')
  })

  it('a page full of words does not grow the block without a limit', () => {
    const savedOnPage = Array.from({ length: 50 }, (_, i) => ({ text: `mot${i}`, sense: null }))
    const line = buildTeacherBlock({ ...BASE, savedOnPage }).split('\n').pop() ?? ''
    expect(line.split(';')).toHaveLength(20)
  })

  it('a long meaning is cut', () => {
    const block = buildTeacherBlock({ ...BASE, savedOnPage: [{ text: 'malle', sense: 'x'.repeat(200) }] })
    expect(block).toContain(`malle (${'x'.repeat(60)})`)
  })
})

describe('teacherChipLabel', () => {
  it('has the language, the level and how many words are saved on the page', () => {
    expect(teacherChipLabel('fr', 'B1', 5)).toBe('French teacher (B1) · 5 saved')
  })

  it('without a level', () => {
    expect(teacherChipLabel('fr', null, 5)).toBe('French teacher · 5 saved')
  })

  it('with no saved words, there is no "saved" part', () => {
    expect(teacherChipLabel('fr', 'B1', 0)).toBe('French teacher (B1)')
    expect(teacherChipLabel('fr', null, 0)).toBe('French teacher')
  })
})

describe('savedWordsCount (the number on the chip)', () => {
  it('counts the words the block lists: the same word saved in two sentences counts once', () => {
    const saved = [
      { text: 'malle', sense: null },
      { text: 'Malle', sense: 'baú' },
      { text: 'grenier', sense: null },
    ]
    expect(savedWordsCount(saved)).toBe(2)
    const block = buildTeacherBlock({ ...BASE, savedOnPage: saved })
    expect(block.match(/malle/gi)).toHaveLength(1)
  })

  it('stops where the block stops, at twenty', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ text: `mot${i}`, sense: null }))
    expect(savedWordsCount(many)).toBe(20)
  })

  it('nothing saved counts zero', () => {
    expect(savedWordsCount([])).toBe(0)
  })
})
