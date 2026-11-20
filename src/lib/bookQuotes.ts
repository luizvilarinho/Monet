// Fluxo "citação do livro → nota", sem React e sem UI. Vive fora do
// Reader.tsx porque nada aqui depende de PDF: o leitor só informa o texto e a
// posição, e recebe de volta a mensagem do toast — quem decide como (ou se)
// exibi-la é o chamador.
import type { BookQuote, Note, Notebook } from '../types'
import { storage } from '../storage'
import { formatLocalTimestamp } from './calendar'
import { stripMarkCitations } from './noteMarks'
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

// Inverso do appendQuoteToContent para o Undo: tira a última ocorrência do
// bloco e a linha em branco que o separava. null quando o bloco não está mais
// na nota (o usuário o editou).
export function removeAppendedBlock(content: string, block: string): string | null {
  const i = content.lastIndexOf(block)
  if (i < 0) return null
  return content.slice(0, i).replace(/\n+$/, '') + content.slice(i + block.length)
}

// Bloco de uma resposta do chat do Reader anexada a uma nota: o rótulo diz
// que veio da IA e de qual livro.
export function buildAiResponseBlock(rawMarkdown: string, bookTitle: string): string {
  // A citação `==texto==` de uma marca vira texto simples: a IA não cria marcas.
  const body = stripMarkCitations(rawMarkdown).trim()
  return `**AI · ${bookTitle} — ${formatLocalTimestamp()}**\n\n${body}`
}

// "Notebook · Note" para tooltips e toasts.
export function noteDestinationLabel(note: Note, notebooks: Notebook[]): string {
  const notebook = notebooks.find((nb) => nb.id === note.notebookId)
  const title = note.title.trim() || 'Untitled'
  return notebook ? `${notebook.name} · ${title}` : title
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
  if (!note?.notebookId) return { toastMessage: null }
  return { toastMessage: `Added to ${noteDestinationLabel(note, deps.getNotebooks())}` }
}

// Bloco anexado a uma nota, guardado para o Undo do toast.
export interface AppendedBlock {
  noteId: string
  block: string
}

export async function appendBlockToNote(
  onSaveNote: (note: Note) => Promise<void>,
  note: Note,
  block: string,
): Promise<AppendedBlock> {
  const content = appendQuoteToContent(note.content, block)
  await onSaveNote({ ...note, content, updatedAt: Date.now() })
  return { noteId: note.id, block }
}

// Desfaz um appendBlockToNote na versão atual da nota. false quando a nota
// sumiu ou o bloco não está mais nela.
export async function undoAppendedBlock(
  getNotes: () => Note[],
  onSaveNote: (note: Note) => Promise<void>,
  appended: AppendedBlock,
): Promise<boolean> {
  const note = getNotes().find((n) => n.id === appended.noteId)
  if (!note) return false
  const content = removeAppendedBlock(note.content, appended.block)
  if (content === null) return false
  await onSaveNote({ ...note, content, updatedAt: Date.now() })
  return true
}

// Anexa a citação direto numa nota já existente, sem passar pelo
// QuoteToNoteModal. Usa as mesmas funções de montagem de bloco/conteúdo deste
// arquivo — as mesmas que o modal importa daqui — e o mesmo registro de
// BookQuote, para manter paridade de comportamento entre os dois caminhos.
// O registro do BookQuote fica mesmo depois de um Undo: a tabela só é escrita.
export async function appendQuoteToNote(
  deps: BookQuoteDeps,
  note: Note,
  { text, page, positionLabel }: QuoteTarget,
): Promise<AppendedBlock> {
  const { content: block } = buildQuoteBlock(text, deps.bookTitle, positionLabel)
  const appended = await appendBlockToNote(deps.onSaveNote, note, block)
  const quote: BookQuote = {
    id: crypto.randomUUID(),
    bookId: deps.bookId,
    page,
    text,
    targetNoteId: note.id,
    createdAt: Date.now(),
  }
  await registerSavedQuote(deps, quote)
  return appended
}
