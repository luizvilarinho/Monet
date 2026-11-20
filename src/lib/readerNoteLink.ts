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

type ReaderNoteLinks = Record<string, ReaderNoteLink>

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

function saveReaderNoteLinks(links: ReaderNoteLinks): void {
  try {
    localStorage.setItem(READER_NOTE_LINK_KEY, JSON.stringify(links))
  } catch (err) {
    console.error('failed to persist reader note links', err)
  }
}

export function getReaderNoteLink(bookId: string): ReaderNoteLink | null {
  const links = loadReaderNoteLinks()
  return links[bookId] ?? null
}

export function setReaderNoteLink(
  bookId: string,
  notebookId: string,
  noteId: string | null,
): void {
  const links = loadReaderNoteLinks()
  links[bookId] = { notebookId, noteId }
  saveReaderNoteLinks(links)
}

// Remove somente o VÍNCULO em localStorage — nunca apaga a nota/notebook em
// si (diferente de unlinkBookFromReaderFolder, que no chat coexiste com o
// delete da pasta exclusiva do livro).
export function unlinkBookFromReaderNote(bookId: string): void {
  const links = loadReaderNoteLinks()
  if (!(bookId in links)) return
  delete links[bookId]
  saveReaderNoteLinks(links)
}
