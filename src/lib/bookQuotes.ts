// Fluxo "citação do livro → nota", sem React e sem UI. Vive fora do
// Reader.tsx porque nada aqui depende de PDF: o leitor só informa o texto e a
// posição, e recebe de volta a mensagem do toast — quem decide como (ou se)
// exibi-la é o chamador.
import type { BookQuote, Note, Notebook } from '../types'
import { storage } from '../storage'
import { getReaderNoteLink } from './readerNoteLink'

const QUOTE_BLOCKQUOTE_LIMIT = 2000

export interface BookQuoteDeps {
  bookId: string
  bookTitle: string
  // Getters, e não arrays, porque a mensagem do toast é montada DEPOIS de
  // awaits: até lá o título da nota ou o notebook podem ter mudado, e um
  // array capturado na entrada devolveria o valor antigo.
  getNotes: () => Note[]
  getNotebooks: () => Notebook[]
  onSaveNote: (note: Note) => Promise<void>
}

export interface QuoteTarget {
  text: string
  page: number
  // Rótulo de posição já formatado ("p. 47" no PDF). Vem pronto do leitor
  // porque cada formato monta o seu — no EPUB será capítulo + porcentagem.
  positionLabel: string
}

// Monta o bloco markdown da citação. `label` chega formatado pelo leitor:
// aqui não se sabe (nem se decide) o formato do livro.
export function buildQuoteBlock(rawText: string, bookTitle: string, label: string): {
  content: string
  truncated: boolean
} {
  const text = rawText.trim()
  const truncated = text.length > QUOTE_BLOCKQUOTE_LIMIT
  const quote = truncated
    ? text.slice(0, QUOTE_BLOCKQUOTE_LIMIT).trimEnd() + '…'
    : text
  const content = `> ${quote}\n\n— *${bookTitle}*, ${label}`
  return { content, truncated }
}

export function appendQuoteToContent(existing: string, block: string): string {
  if (!existing.trim()) return block
  const trimmedEnd = existing.replace(/\n+$/, '')
  return `${trimmedEnd}\n\n${block}`
}

// Nota vinculada ao livro pela aba "Notes" do leitor, se o vínculo ainda
// apontar para uma nota existente.
export function resolveLinkedNote(bookId: string, notes: Note[]): Note | null {
  const link = getReaderNoteLink(bookId)
  if (!link?.noteId) return null
  return notes.find((n) => n.id === link.noteId) ?? null
}

// Registra o BookQuote e devolve a mensagem do toast. A falha de gravação é
// só logada: a citação já está dentro da nota (que é o que o usuário vê), e
// avisar de erro aqui daria a impressão errada de que nada foi salvo.
// Sem notebook resolvível não há mensagem — nada é exibido.
export async function registerSavedQuote(
  deps: BookQuoteDeps,
  quote: BookQuote,
): Promise<{ toastMessage: string | null }> {
  try {
    await storage.saveQuote(quote)
  } catch (err) {
    console.error('failed to save quote', err)
  }
  const note = deps.getNotes().find((n) => n.id === quote.targetNoteId)
  const notebookId = note?.notebookId ?? null
  if (!notebookId) return { toastMessage: null }
  const notebook = deps.getNotebooks().find((x) => x.id === notebookId)
  const noteTitle = note?.title.trim() || 'note'
  const nbName = notebook?.name ?? 'notebook'
  return { toastMessage: `Saved to ${nbName} / ${noteTitle}` }
}

// Anexa a citação direto numa nota já existente, sem passar pelo
// QuoteToNoteModal. Usa as mesmas funções de montagem de bloco/conteúdo deste
// arquivo — as mesmas que o modal importa daqui — e o mesmo registro de
// BookQuote, para manter paridade de comportamento entre os dois caminhos.
export async function appendQuoteToNote(
  deps: BookQuoteDeps,
  note: Note,
  { text, page, positionLabel }: QuoteTarget,
): Promise<{ toastMessage: string | null }> {
  const { content: block } = buildQuoteBlock(text, deps.bookTitle, positionLabel)
  const newContent = appendQuoteToContent(note.content, block)
  await deps.onSaveNote({ ...note, content: newContent, updatedAt: Date.now() })
  const quote: BookQuote = {
    id: crypto.randomUUID(),
    bookId: deps.bookId,
    page,
    text,
    targetNoteId: note.id,
    createdAt: Date.now(),
  }
  return registerSavedQuote(deps, quote)
}
