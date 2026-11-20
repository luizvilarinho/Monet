import { useCallback, useRef, useState } from 'react'
import type { BookQuote, Note, Notebook } from '../types'
import {
  appendQuoteToNote,
  noteDestinationLabel,
  registerSavedQuote,
  resolveLinkedNote,
  undoAppendedBlock,
  type AppendedBlock,
  type BookQuoteDeps,
} from '../lib/bookQuotes'
import { setReaderNoteLink } from '../lib/readerNoteLink'
import type { ShowReaderToast } from '../components/Reader/ReaderToast'

export interface UseBookQuotesParams {
  bookId: string
  bookTitle: string
  notes: Note[]
  notebooks: Notebook[]
  onSaveNote: (note: Note) => Promise<void>
  showToast: ShowReaderToast
  // Mostra a aba Notes do leitor (a nota vinculada é a que ela exibe).
  onShowNotes: () => void
}

// Tudo que o chamador precisa para montar o QuoteToNoteModal. É `null`
// enquanto não há citação pendente.
export interface BookQuoteModalState {
  open: boolean
  quoteText: string
  page: number
  positionLabel: string
  onSaved: (quote: BookQuote) => void
  onLinkNote: (notebookId: string, noteId: string) => void
  onClose: () => void
}

// Toast de um bloco anexado direto a uma nota (citação ou resposta do chat),
// com Open e Undo. O Undo tira o bloco da versão atual da nota.
export function announceAppendedBlock(params: {
  showToast: ShowReaderToast
  destination: string
  appended: AppendedBlock
  getNotes: () => Note[]
  onSaveNote: (note: Note) => Promise<void>
  onOpen: () => void
}): void {
  const { showToast, destination, appended, getNotes, onSaveNote, onOpen } = params
  showToast({
    message: `Added to ${destination}`,
    actions: [
      { label: 'Open', onClick: onOpen },
      {
        label: 'Undo',
        onClick: () => {
          undoAppendedBlock(getNotes, onSaveNote, appended)
            .then((ok) =>
              showToast(
                ok
                  ? { message: 'Removed from the note' }
                  : { message: "Couldn't undo: the note was edited.", tone: 'error' },
              ),
            )
            .catch((err) => {
              console.error('failed to undo append', err)
              showToast({ message: "Couldn't undo. Try again.", tone: 'error' })
            })
        },
      },
    ],
  })
}

// Casca fina sobre `lib/bookQuotes`: segura o estado do modal e delega toda a
// lógica ao service.
export function useBookQuotes(params: UseBookQuotesParams) {
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [quoteContext, setQuoteContext] = useState<{
    text: string
    page: number
    positionLabel: string
  } | null>(null)
  // Sobe quando o vínculo livro → nota muda fora da aba Notes (checkbox do
  // modal, "Open"): a aba relê o vínculo e passa a mostrar a nota nova.
  const [linkVersion, setLinkVersion] = useState(0)

  // Os parâmetros são lidos por ref dentro dos callbacks: capturá-los na
  // closure faria uma citação disparada depois de o pai atualizar `notes`
  // procurar a nota numa lista obsoleta.
  const paramsRef = useRef(params)
  paramsRef.current = params

  const buildDeps = useCallback((): BookQuoteDeps => {
    const p = paramsRef.current
    return {
      bookId: p.bookId,
      bookTitle: p.bookTitle,
      getNotes: () => paramsRef.current.notes,
      getNotebooks: () => paramsRef.current.notebooks,
      onSaveNote: p.onSaveNote,
    }
  }, [])

  const linkNote = useCallback((notebookId: string, noteId: string) => {
    setReaderNoteLink(paramsRef.current.bookId, notebookId, noteId)
    setLinkVersion((v) => v + 1)
  }, [])

  // Mostra a nota na aba Notes — que exibe a nota vinculada, por isso o
  // vínculo passa a ser ela.
  const openNote = useCallback(
    (notebookId: string, noteId: string) => {
      linkNote(notebookId, noteId)
      paramsRef.current.onShowNotes()
    },
    [linkNote],
  )

  const handleSavedQuote = useCallback(
    async (quote: BookQuote) => {
      const { toastMessage } = await registerSavedQuote(buildDeps(), quote)
      if (toastMessage) paramsRef.current.showToast({ message: toastMessage })
    },
    [buildDeps],
  )

  const openQuoteModal = useCallback(
    (text: string, page: number, positionLabel: string) => {
      setQuoteContext({ text, page, positionLabel })
      setQuoteModalOpen(true)
    },
    [],
  )

  const closeQuoteModal = useCallback(() => {
    setQuoteModalOpen(false)
    setQuoteContext(null)
  }, [])

  // Livro com nota vinculada recebe a citação direto nela; sem vínculo — ou
  // se a gravação falhar — cai no modal de escolha de notebook/nota.
  // `positionLabel` vem pronto do leitor: cada formato monta o seu rótulo.
  const addQuoteToNote = useCallback(
    (text: string, page: number, positionLabel: string) => {
      const p = paramsRef.current
      const note = resolveLinkedNote(p.bookId, p.notes)
      if (note) {
        appendQuoteToNote(buildDeps(), note, { text, page, positionLabel })
          .then((appended) => {
            const cur = paramsRef.current
            announceAppendedBlock({
              showToast: cur.showToast,
              destination: noteDestinationLabel(note, cur.notebooks),
              appended,
              getNotes: () => paramsRef.current.notes,
              onSaveNote: cur.onSaveNote,
              onOpen: () => cur.onShowNotes(),
            })
          })
          .catch((err) => {
            console.error('failed to append quote to linked note', err)
            openQuoteModal(text, page, positionLabel)
          })
        return
      }
      openQuoteModal(text, page, positionLabel)
    },
    [buildDeps, openQuoteModal],
  )

  // Tooltip do "Add to note": o destino quando há nota vinculada. Lido a cada
  // render porque o vínculo muda pela aba Notes, fora deste hook.
  const linkedNote = resolveLinkedNote(params.bookId, params.notes)
  const addToNoteTitle = linkedNote
    ? `Add to "${noteDestinationLabel(linkedNote, params.notebooks)}"`
    : 'Add to a note…'

  // Só existe quando há contexto E o modal está aberto: desmontar de verdade
  // entre uma citação e outra é o que dispara o reset do estado interno do
  // QuoteToNoteModal.
  const modal: BookQuoteModalState | null =
    quoteContext && quoteModalOpen
      ? {
          open: quoteModalOpen,
          quoteText: quoteContext.text,
          page: quoteContext.page,
          positionLabel: quoteContext.positionLabel,
          onSaved: (quote) => void handleSavedQuote(quote),
          onLinkNote: linkNote,
          onClose: closeQuoteModal,
        }
      : null

  return { addQuoteToNote, addToNoteTitle, openNote, linkVersion, modal }
}
