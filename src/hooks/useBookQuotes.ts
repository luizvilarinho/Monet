import { useCallback, useEffect, useRef, useState } from 'react'
import type { BookQuote, Note, Notebook } from '../types'
import {
  appendQuoteToNote,
  registerSavedQuote,
  resolveLinkedNote,
  type BookQuoteDeps,
} from '../lib/bookQuotes'

const SAVE_TOAST_MS = 2500

export interface UseBookQuotesParams {
  bookId: string
  bookTitle: string
  notes: Note[]
  notebooks: Notebook[]
  onSaveNote: (note: Note) => Promise<void>
}

// Tudo que o chamador precisa para montar o QuoteToNoteModal. É `null`
// enquanto não há citação pendente.
export interface BookQuoteModalState {
  open: boolean
  quoteText: string
  page: number
  positionLabel: string
  onSaved: (quote: BookQuote) => void
  onClose: () => void
}

// Casca fina sobre `lib/bookQuotes`: segura o estado do toast e do modal e
// delega toda a lógica ao service.
export function useBookQuotes(params: UseBookQuotesParams) {
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [quoteContext, setQuoteContext] = useState<{
    text: string
    page: number
    positionLabel: string
  } | null>(null)

  // Os parâmetros são lidos por ref dentro dos callbacks: capturá-los na
  // closure faria uma citação disparada depois de o pai atualizar `notes`
  // procurar a nota numa lista obsoleta.
  const paramsRef = useRef(params)
  paramsRef.current = params

  const showToast = useCallback((message: string) => {
    // Um toast novo antes de o anterior sumir reinicia a contagem.
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, SAVE_TOAST_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

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

  const handleSavedQuote = useCallback(
    async (quote: BookQuote) => {
      const { toastMessage } = await registerSavedQuote(buildDeps(), quote)
      if (toastMessage) showToast(toastMessage)
    },
    [buildDeps, showToast],
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
  const copyCitationAbout = useCallback(
    (text: string, page: number, positionLabel: string) => {
      const p = paramsRef.current
      const note = resolveLinkedNote(p.bookId, p.notes)
      if (note) {
        appendQuoteToNote(buildDeps(), note, { text, page, positionLabel })
          .then(({ toastMessage }) => {
            if (toastMessage) showToast(toastMessage)
          })
          .catch((err) => {
            console.error('failed to append quote to linked note', err)
            openQuoteModal(text, page, positionLabel)
          })
        return
      }
      openQuoteModal(text, page, positionLabel)
    },
    [buildDeps, openQuoteModal, showToast],
  )

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
          onClose: closeQuoteModal,
        }
      : null

  return { copyCitationAbout, modal, toast }
}
