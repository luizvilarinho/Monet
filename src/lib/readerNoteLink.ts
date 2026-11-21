// Vínculo livro ↔ nota da aba "Notes" do Reader — Record<bookId, ReaderNoteLink>
// em localStorage, mesmo padrão de src/hooks/useChat.ts (vínculo livro↔pasta de
// chat), mas com chave própria e SEM cascade delete: notebook/nota são
// conteúdo do usuário (pré-existente), diferente da pasta de chat que é
// exclusiva do livro e apagada em cascata.
const READER_NOTE_LINK_KEY = 'monet:reader-book-note-link'

export interface ReaderNoteLink {
  notebookId: string
  noteId: string | null
}

export type ReaderNoteLinks = Record<string, ReaderNoteLink>

// Evento de janela: o registro mudou de verdade (o `detail` leva o `bookId`).
// Quem mostra o vínculo (a barra da nota Paper) o relê por ele. O painel Notes do
// Reader não precisa dele: a Library e o editor da nota nunca estão montados juntos
// na mesma janela, e o painel lê o vínculo ao montar.
export const READER_NOTE_LINK_EVENT = 'monet:reader-note-link-changed'

export function sameReaderNoteLink(
  a: ReaderNoteLink | null | undefined,
  b: ReaderNoteLink | null | undefined,
): boolean {
  if (!a || !b) return !a && !b
  return a.notebookId === b.notebookId && a.noteId === b.noteId
}

// O livro já está ligado a OUTRA nota? Vínculo só com o caderno (sem nota) não conta.
export function isLinkedToOtherNote(link: ReaderNoteLink | null | undefined, noteId: string): boolean {
  return !!link && link.noteId !== null && link.noteId !== noteId
}

function loadReaderNoteLinks(): ReaderNoteLinks {
  try {
    const raw = localStorage.getItem(READER_NOTE_LINK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: ReaderNoteLinks = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (
          v &&
          typeof v === 'object' &&
          typeof (v as { notebookId?: unknown }).notebookId === 'string' &&
          (typeof (v as { noteId?: unknown }).noteId === 'string' ||
            (v as { noteId?: unknown }).noteId === null)
        ) {
          out[k] = {
            notebookId: (v as { notebookId: string }).notebookId,
            noteId: (v as { noteId: string | null }).noteId,
          }
        }
      }
      return out
    }
  } catch {
    /* ignore */
  }
  return {}
}

function saveReaderNoteLinks(links: ReaderNoteLinks): boolean {
  try {
    localStorage.setItem(READER_NOTE_LINK_KEY, JSON.stringify(links))
    return true
  } catch (err) {
    console.error('failed to persist reader note links', err)
    return false
  }
}

function notifyReaderNoteLinkChanged(bookId: string): void {
  window.dispatchEvent(new CustomEvent(READER_NOTE_LINK_EVENT, { detail: { bookId } }))
}

export function getReaderNoteLink(bookId: string): ReaderNoteLink | null {
  const links = loadReaderNoteLinks()
  return links[bookId] ?? null
}

// Todos os vínculos de uma vez (o seletor de livros da nota Paper marca os que já
// estão ligados a outra nota).
export function getReaderNoteLinks(): ReaderNoteLinks {
  return loadReaderNoteLinks()
}

// Vínculo inverso: o livro ligado a uma nota (o "Open in Library" reaproveita o
// livro já baixado). Com vários, o primeiro.
export function findBookIdForNote(noteId: string): string | null {
  for (const [bookId, link] of Object.entries(loadReaderNoteLinks())) {
    if (link.noteId === noteId) return bookId
  }
  return null
}

export function setReaderNoteLink(
  bookId: string,
  notebookId: string,
  noteId: string | null,
): void {
  const links = loadReaderNoteLinks()
  const next = { notebookId, noteId }
  // O painel Notes do Reader chama isto dentro de efeitos: o mesmo valor não
  // grava nem avisa.
  if (sameReaderNoteLink(links[bookId], next)) return
  links[bookId] = next
  if (saveReaderNoteLinks(links)) notifyReaderNoteLinkChanged(bookId)
}

// Remove somente o VÍNCULO em localStorage — nunca apaga a nota/notebook em
// si (diferente de unlinkBookFromReaderFolder, que no chat coexiste com o
// delete da pasta exclusiva do livro).
export function unlinkBookFromReaderNote(bookId: string): void {
  const links = loadReaderNoteLinks()
  if (!(bookId in links)) return
  delete links[bookId]
  if (saveReaderNoteLinks(links)) notifyReaderNoteLinkChanged(bookId)
}
