import { describe, expect, it } from 'vitest'
import { LANGUAGE_CODES } from './language'
import type { Book } from '../types'
import { pickTestLanguage, testSentenceFor } from './voiceTest'

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

describe('pickTestLanguage', () => {
  it('takes the language of the book opened last that is not in the native language', () => {
    const books = [
      book({ id: 'a', language: 'fr', lastOpenedAt: 100 }),
      book({ id: 'b', language: 'en', lastOpenedAt: 300 }),
      book({ id: 'c', language: 'pt', lastOpenedAt: 900 }),
    ]
    expect(pickTestLanguage(books, 'pt')).toBe('en')
  })

  it('compares base languages (pt-BR is pt)', () => {
    const books = [book({ id: 'a', language: 'pt', lastOpenedAt: 900 }), book({ id: 'b', language: 'es', lastOpenedAt: 5 })]
    expect(pickTestLanguage(books, 'pt-BR')).toBe('es')
  })

  it('ignores books never opened and books without a language', () => {
    const books = [
      book({ id: 'a', language: 'de', lastOpenedAt: null }),
      book({ id: 'b', language: '', lastOpenedAt: 50 }),
      book({ id: 'c', language: null, lastOpenedAt: 60 }),
    ]
    expect(pickTestLanguage(books, 'pt')).toBe('fr')
  })

  it('without a book in another language, French', () => {
    expect(pickTestLanguage([], 'pt')).toBe('fr')
    expect(pickTestLanguage([book({ id: 'a', language: 'pt', lastOpenedAt: 1 })], 'pt')).toBe('fr')
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
    const french = testSentenceFor('fr')
    for (const code of LANGUAGE_CODES) {
      const sentence = testSentenceFor(code)
      expect(sentence.length).toBeGreaterThan(10)
      if (code !== 'fr') expect(sentence).not.toBe(french)
    }
  })

  it('accepts a region tag and falls back to French for an unknown language', () => {
    expect(testSentenceFor('pt-BR')).toBe(testSentenceFor('pt'))
    expect(testSentenceFor('ja')).toBe(testSentenceFor('fr'))
    expect(testSentenceFor('')).toBe(testSentenceFor('fr'))
  })
})
