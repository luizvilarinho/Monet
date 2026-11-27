import { describe, expect, it } from 'vitest'
import { LANGUAGE_CODES } from './language'
import type { Book } from '../types'
import { pickStudyLanguage, pickTestLanguage, testSentenceFor } from './voiceTest'

function book(over: Partial<Book> & { id: string }): Book {
  return {
    title: 'La Maison des dunes',
    author: null,
    filePath: 'books/x.pdf',
    totalPages: 100,
    lastPage: 1,
    addedAt: 1,
    lastOpenedAt: null,
    zoom: 1,
    format: 'pdf',
    language: null,
    ...over,
  } as Book
}

describe('pickStudyLanguage', () => {
  it('takes the language of the book opened last that is not in the native language', () => {
    const books = [
      book({ id: 'a', language: 'fr', lastOpenedAt: 100 }),
      book({ id: 'b', language: 'en', lastOpenedAt: 300 }),
      book({ id: 'c', language: 'pt', lastOpenedAt: 900 }),
    ]
    expect(pickStudyLanguage(books, 'pt')).toBe('en')
  })

  it('compares base languages (pt-BR is pt)', () => {
    const books = [book({ id: 'a', language: 'pt', lastOpenedAt: 900 }), book({ id: 'b', language: 'es', lastOpenedAt: 5 })]
    expect(pickStudyLanguage(books, 'pt-BR')).toBe('es')
  })

  it('ignores books never opened and books without a language', () => {
    const books = [
      book({ id: 'a', language: 'de', lastOpenedAt: null }),
      book({ id: 'b', language: '', lastOpenedAt: 50 }),
      book({ id: 'c', language: null, lastOpenedAt: 60 }),
    ]
    expect(pickStudyLanguage(books, 'pt')).toBeNull()
  })

  it('without a book in another language, null (no language is assumed)', () => {
    expect(pickStudyLanguage([], 'pt')).toBeNull()
    expect(pickStudyLanguage([book({ id: 'a', language: 'pt', lastOpenedAt: 1 })], 'pt')).toBeNull()
  })
})

describe('pickTestLanguage', () => {
  it('takes the study language when there is a book in another language', () => {
    const books = [
      book({ id: 'a', language: 'de', lastOpenedAt: 100 }),
      book({ id: 'b', language: 'fr', lastOpenedAt: 300 }),
    ]
    expect(pickTestLanguage(books, 'pt')).toBe('fr')
    expect(pickTestLanguage(books, 'en')).toBe('fr')
  })

  it('without a book in another language, the native language (base code)', () => {
    expect(pickTestLanguage([], 'pt')).toBe('pt')
    expect(pickTestLanguage([], 'pt-BR')).toBe('pt')
    expect(pickTestLanguage([book({ id: 'a', language: 'de', lastOpenedAt: null })], 'es')).toBe('es')
    expect(pickTestLanguage([book({ id: 'a', language: 'pt', lastOpenedAt: 1 })], 'pt')).toBe('pt')
  })

  it('without a native language either, English', () => {
    expect(pickTestLanguage([], '')).toBe('en')
    expect(pickTestLanguage([], 'und')).toBe('en')
  })

  it('never falls back to French', () => {
    expect(pickTestLanguage([], 'pt')).not.toBe('fr')
    expect(pickTestLanguage([], '')).not.toBe('fr')
  })
})

describe('testSentenceFor', () => {
  it('French and English use the first sentence of the text of the plan', () => {
    expect(testSentenceFor('fr')).toBe('Élise monte au grenier à 21 h 30.')
    expect(testSentenceFor('en')).toBe(
      'The attic door was ajar and there was no light, so she climbed the stairs by feel.',
    )
  })

  it('every language the app offers has a sentence of its own', () => {
    const english = testSentenceFor('en')
    for (const code of LANGUAGE_CODES) {
      const sentence = testSentenceFor(code)
      expect(sentence.length).toBeGreaterThan(10)
      if (code !== 'en') expect(sentence).not.toBe(english)
    }
  })

  it('accepts a region tag and falls back to English for an unknown language', () => {
    expect(testSentenceFor('pt-BR')).toBe(testSentenceFor('pt'))
    expect(testSentenceFor('ja')).toBe(testSentenceFor('en'))
    expect(testSentenceFor('')).toBe(testSentenceFor('en'))
    expect(testSentenceFor('ja')).not.toBe(testSentenceFor('fr'))
  })
})
