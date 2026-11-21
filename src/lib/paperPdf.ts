import { storage } from '../storage'
import type { PaperItem } from './agentItems'
import { booksDownloadPdf, registerBookFile } from './books'
import { paperAuthorsText, paperPdfLink } from './papers'
import { findBookIdForNote, setReaderNoteLink, unlinkBookFromReaderNote } from './readerNoteLink'

// O livro ligado à nota saiu da Library e a nota não tem link de PDF para baixá-lo
// de novo. Tem classe própria porque a nota Paper corrige o botão com ela.
export class LinkedBookGoneError extends Error {
  constructor() {
    super('The linked book is no longer in the Library, and the note has no PDF link.')
    this.name = 'LinkedBookGoneError'
  }
}

// "Open in Library" de uma nota Paper: baixa o PDF de acesso aberto, registra o
// livro na Library (a mesma validação do import) e o liga à nota (o chat e as
// notas do Reader). Devolve o id do livro; quem chama o abre
// (`requestOpenBook`). A nota ligada a um livro que ainda existe reaproveita o
// livro, sem baixar de novo; o vínculo com um livro que já não existe é removido
// antes (senão o próximo clique o acharia de novo e baixaria outra cópia). Os
// erros saem como `Error` com a mensagem do Rust (link inválido, HTTP, tamanho,
// "não é PDF") ou do `registerBookFile`; a nota Paper fica de qualquer jeito.
// Vale para o item do chat (`openPaperInLibrary`) e para a própria nota
// (`openPdfInLibrary`, com o link da linha `PDF:`).
export async function openPdfInLibrary(
  note: { id: string; notebookId: string | null },
  pdf: { link: string | null; title: string; author: string }
): Promise<string> {
  const linkedId = findBookIdForNote(note.id)
  if (linkedId) {
    if ((await storage.getBooks()).some((b) => b.id === linkedId)) return linkedId
    unlinkBookFromReaderNote(linkedId)
  }

  if (!pdf.link) throw linkedId ? new LinkedBookGoneError() : new Error('No open-access PDF')

  let picked
  try {
    picked = await booksDownloadPdf(pdf.link)
  } catch (err) {
    // O `invoke` rejeita com a string do Rust, não com um Error.
    throw err instanceof Error ? err : new Error(String(err))
  }
  const book = await registerBookFile(picked, { title: pdf.title, author: pdf.author })
  if (note.notebookId) setReaderNoteLink(book.id, note.notebookId, note.id)
  return book.id
}

export function openPaperInLibrary(item: PaperItem, note: { id: string; notebookId: string | null }): Promise<string> {
  return openPdfInLibrary(note, { link: paperPdfLink(item), title: item.title, author: paperAuthorsText(item) })
}
