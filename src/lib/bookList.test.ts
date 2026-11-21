import { describe, expect, it } from 'vitest'
import type { Book } from '../types'
import { BOOK_FILTER_MIN, bookChoices, filterBooks, showBookFilter } from './bookList'

function book(id: string, patch: Partial<Book> = {}): Book {
  return {
    id,
    title: `Livro ${id}`,
    author: null,
    filePath: `C:/books/${id}.pdf`,
    totalPages: 100,
    lastPage: 1,
    addedAt: 1000,
    lastOpenedAt: null,
    zoom: 1,
    format: 'pdf',
    ...patch,
  } as Book
}

describe('filterBooks', () => {
  it('ordena pela última abertura, ou pela importação do livro nunca aberto', () => {
    const books = [
      book('antigo', { addedAt: 100 }),
      book('aberto', { addedAt: 50, lastOpenedAt: 900 }),
      book('novo', { addedAt: 500 }),
    ]
    expect(filterBooks(books, '').map((b) => b.id)).toEqual(['aberto', 'novo', 'antigo'])
  })

  it('não muda a lista recebida', () => {
    const books = [book('a', { addedAt: 1 }), book('b', { addedAt: 2 })]
    filterBooks(books, '')
    expect(books.map((b) => b.id)).toEqual(['a', 'b'])
  })

  it('filtra por título ou autor, sem caixa nem acento', () => {
    const books = [
      book('a', { title: 'Redes Neurais', author: 'Ana Müller', addedAt: 3 }),
      book('b', { title: 'Graph Theory', author: null, addedAt: 2 }),
      book('c', { title: 'Cálculo', author: 'Bo Lee', addedAt: 1 }),
    ]
    expect(filterBooks(books, 'neurais').map((b) => b.id)).toEqual(['a'])
    expect(filterBooks(books, 'MULLER').map((b) => b.id)).toEqual(['a'])
    expect(filterBooks(books, '  calculo ').map((b) => b.id)).toEqual(['c'])
    expect(filterBooks(books, 'lee').map((b) => b.id)).toEqual(['c'])
    expect(filterBooks(books, 'null')).toEqual([])
    expect(filterBooks(books, 'zzz')).toEqual([])
  })
})

describe('showBookFilter', () => {
  it('só acima de 10 livros, ou com o filtro já escrito', () => {
    expect(BOOK_FILTER_MIN).toBe(10)
    expect(showBookFilter(10, '')).toBe(false)
    expect(showBookFilter(11, '')).toBe(true)
    expect(showBookFilter(3, 'abc')).toBe(true)
  })
})

describe('bookChoices', () => {
  const books = [book('a', { addedAt: 3 }), book('b', { addedAt: 2 }), book('c', { addedAt: 1 })]

  it('marca o livro ligado a outra nota, na ordem da Library', () => {
    const links = {
      a: { notebookId: 'nb1', noteId: 'outra' },
      b: { notebookId: 'nb1', noteId: null },
    }
    expect(bookChoices(books, '', links, 'esta').map((c) => [c.book.id, c.linkedElsewhere])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ])
  })

  it('o livro ligado a esta mesma nota não é "outra nota"', () => {
    const links = { a: { notebookId: 'nb1', noteId: 'esta' } }
    expect(bookChoices(books, '', links, 'esta')[0].linkedElsewhere).toBe(false)
  })

  it('aplica o filtro', () => {
    expect(bookChoices(books, 'livro b', {}, 'esta').map((c) => c.book.id)).toEqual(['b'])
    expect(bookChoices([], '', {}, 'esta')).toEqual([])
  })
})
