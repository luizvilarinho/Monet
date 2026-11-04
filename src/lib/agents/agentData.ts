import type { MetadataDef, Note, Notebook, NoteType } from '../../types'
import { notesIndexGetDisabledNotebooks } from '../documents'
import type { ReaderBookInfo } from '../planNotes'
import { storage } from '../../storage'

// Dados comuns aos agentes de plano (planner, coach; o tutor reusa): notas,
// tipos, propriedades, cadernos, cadernos com a IA desligada e os livros do
// Reader. Lidos do storage a cada mensagem.

export interface PlanData {
  notes: Note[]
  defs: MetadataDef[] // só scope 'note'
  types: NoteType[]
  notebooks: Notebook[]
  disabledNotebookIds: Set<string>
  books: ReaderBookInfo[]
}

// Livros com a página do destaque mais avançado, abertos mais recentemente
// primeiro. Falha do Reader = lista vazia: o Reader não bloqueia o agente.
export async function loadReaderBooks(): Promise<ReaderBookInfo[]> {
  try {
    const books = await storage.getBooks()
    const highlights = await Promise.all(books.map((b) => storage.getHighlights(b.id).catch(() => [])))
    return books
      .map((book, i) => ({
        book,
        maxHighlightPage: highlights[i].length > 0 ? Math.max(...highlights[i].map((h) => h.page)) : null,
      }))
      .sort((a, b) => (b.book.lastOpenedAt ?? -1) - (a.book.lastOpenedAt ?? -1))
  } catch (err) {
    console.warn('reader books failed:', err)
    return []
  }
}

export async function loadPlanData(): Promise<PlanData> {
  const [notes, defs, types, notebooks, disabledIds, books] = await Promise.all([
    storage.getNotes(),
    storage.getMetadataDefs(),
    storage.getNoteTypes(),
    storage.getNotebooks(),
    notesIndexGetDisabledNotebooks(),
    loadReaderBooks(),
  ])
  return {
    notes,
    defs: defs.filter((d) => d.scope === 'note'),
    types,
    notebooks,
    disabledNotebookIds: new Set(disabledIds),
    books,
  }
}

// '"<title>" · <N> pages (PDF) · furthest highlight p. <n> · last opened p. <n>'
// EPUB: '… · <N> locations (EPUB, not pages) · no highlights · last opened location <n>'
export function bookLine({ book, maxHighlightPage }: ReaderBookInfo): string {
  const epub = book.format === 'epub'
  const unit = epub ? 'location' : 'p.'
  return [
    `"${book.title}"`,
    epub ? `${book.totalPages} locations (EPUB, not pages)` : `${book.totalPages} pages (PDF)`,
    maxHighlightPage !== null ? `furthest highlight ${unit} ${maxHighlightPage}` : 'no highlights',
    `last opened ${unit} ${book.lastPage}`,
  ].join(' · ')
}
