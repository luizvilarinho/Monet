import type { Book } from '../types'
import { isLinkedToOtherNote, type ReaderNoteLinks } from './readerNoteLink'

// Lista de livros da Library: a ordem e o filtro valem na Library e no seletor de
// livros da nota Paper (módulo puro, sem `storage`).

// Acima disso a lista ganha o campo de filtro.
export const BOOK_FILTER_MIN = 10

export function showBookFilter(total: number, filter: string): boolean {
  return total > BOOK_FILTER_MIN || filter !== ''
}

function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Mais recente primeiro: a última abertura, ou a importação para o livro
// nunca aberto (o recém-importado aparece no topo).
function recency(book: Book): number {
  return book.lastOpenedAt ?? book.addedAt
}

// Filtra por título ou autor (sem caixa nem acento) e ordena do mais recente.
export function filterBooks(books: Book[], filter: string): Book[] {
  const query = foldText(filter.trim())
  const filtered = query
    ? books.filter((b) => foldText(`${b.title} ${b.author ?? ''}`).includes(query))
    : books
  return [...filtered].sort((a, b) => recency(b) - recency(a))
}

export interface BookChoice {
  book: Book
  // Já ligado a outra nota: escolher troca o vínculo (pede confirmação).
  linkedElsewhere: boolean
}

// A lista do seletor de livros da nota `noteId`.
export function bookChoices(
  books: Book[],
  filter: string,
  links: ReaderNoteLinks,
  noteId: string,
): BookChoice[] {
  return filterBooks(books, filter).map((book) => ({
    book,
    linkedElsewhere: isLinkedToOtherNote(links[book.id], noteId),
  }))
}
