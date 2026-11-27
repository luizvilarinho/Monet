import { useMemo, useRef, useState } from 'react'
import type { Book, Note, NoteType, Notebook, VocabularyItem } from '../types'
import {
  appendBlockToNote,
  noteDestinationLabel,
  type AppendedBlock,
} from '../lib/bookQuotes'
import {
  getUserLocale,
  getVocabSendTranslation,
  setVocabSendTranslation,
} from '../lib/languageSettings'
import {
  buildVocabularyNoteBlock,
  groupBySentMark,
  itemsToListen,
  itemsToSend,
  noteDateLabel,
  sendButtonLabel,
  type SentMark,
} from '../lib/vocabulary'
import {
  getVocabularyDestination,
  resolveDestination,
  setVocabularyDestination,
  vocabularyNoteTitle,
} from '../lib/vocabularyDestination'
import type {
  SendVocabularyModalProps,
  VocabularyDestinationChoice,
} from '../components/LanguageTools/SendVocabularyModal'
import type { ShowReaderToast } from '../components/Reader/ReaderToast'
import { announceAppendedBlock } from './useBookQuotes'
import type { BookVocabulary } from './useBookVocabulary'

export interface UseVocabularySendParams {
  book: Book
  items: VocabularyItem[]
  notes: Note[]
  notebooks: Notebook[]
  noteTypes: NoteType[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: SendVocabularyModalProps['onCreateNote']
  onSaveNote: (note: Note) => Promise<void>
  showToast: ShowReaderToast
  // Mostra a nota na aba Notes do leitor SEM trocar a nota vinculada ao livro
  // (`showNote` do `useBookQuotes`): o "Open" do aviso e o chip "Sent to notebook".
  showNote: (notebookId: string, noteId: string) => void
  markSent: BookVocabulary['markSent']
}

// O envio do vocabulário ao caderno: a seleção da lista, o destino lembrado por
// livro, o envio direto (ou o modal, na primeira vez e no "Change") e o aviso
// com Open e Undo. O Undo tira o bloco da nota e devolve aos itens a marca de
// enviado de antes (a de antes do reenvio, quando era um reenvio).
export function useVocabularySend(params: UseVocabularySendParams) {
  const { book, items, notes, notebooks } = params
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [dest, setDest] = useState(() => getVocabularyDestination(book.id))
  // Os callbacks assíncronos leem o que há de mais novo (a nota pode ter mudado
  // enquanto o envio esperava).
  const paramsRef = useRef(params)
  paramsRef.current = params
  const busyRef = useRef(false)

  const toSend = itemsToSend(items, selectedIds)
  const selectedItems = items.filter((i) => selectedIds.has(i.id))
  const newCount = items.filter((i) => !i.sentAt).length
  const destNote = useMemo(() => resolveDestination(dest, notes), [dest, notes])

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function deliver(
    sending: VocabularyItem[],
    choice: VocabularyDestinationChoice,
    withTranslation: boolean,
  ) {
    if (busyRef.current) return
    busyRef.current = true
    const p = paramsRef.current
    try {
      const block =
        sending.length > 0
          ? buildVocabularyNoteBlock(
              sending,
              p.book.title,
              withTranslation,
              noteDateLabel(new Date(), getUserLocale()),
            )
          : null
      let note: Note
      let appended: AppendedBlock | null = null
      if (choice.kind === 'new') {
        // A nota nasce já com o bloco: o Undo o tira, a nota fica.
        note = await p.onCreateNote(choice.notebookId, vocabularyNoteTitle(p.book.title), block ?? '')
        if (block) appended = { noteId: note.id, block }
      } else {
        note = paramsRef.current.notes.find((n) => n.id === choice.note.id) ?? choice.note
        if (!note.notebookId) throw new Error('The note is not in a notebook.')
        if (block) appended = await appendBlockToNote(p.onSaveNote, note, block)
      }
      const notebookId = note.notebookId ?? (choice.kind === 'new' ? choice.notebookId : null)
      if (!notebookId) throw new Error('The note is not in a notebook.')

      setVocabularyDestination(p.book.id, { notebookId, noteId: note.id })
      setDest({ notebookId, noteId: note.id })
      const label = noteDestinationLabel(note, paramsRef.current.notebooks)
      if (!block || !appended) {
        p.showToast({ message: `Destination saved: ${label}` })
        return
      }

      const sent: SentMark = { at: new Date().toISOString(), notebookId, noteId: note.id }
      // O Undo devolve a cada item a marca de antes: `sending` guarda os itens
      // como estavam antes de serem marcados.
      const before = sending
      let marked = true
      await p
        .markSent(
          sending.map((i) => i.id),
          sent,
        )
        .catch((err) => {
          marked = false
          console.error('failed to mark the vocabulary as sent', err)
        })
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const i of sending) next.delete(i.id)
        return next
      })
      announceAppendedBlock({
        showToast: p.showToast,
        destination: label,
        // O bloco já está na nota; sem a marca, o próximo envio o repetiria: o aviso diz.
        message: `Sent ${sending.length} ${sending.length === 1 ? 'item' : 'items'} to ${label}${
          marked ? '' : ", but they couldn't be marked as sent here"
        }`,
        appended,
        getNotes: () => paramsRef.current.notes,
        onSaveNote: p.onSaveNote,
        onOpen: () => paramsRef.current.showNote(notebookId, note.id),
        onUndone: () => {
          for (const group of groupBySentMark(before)) {
            void paramsRef.current
              .markSent(group.ids, group.sent)
              .catch((err) => console.error('failed to restore the vocabulary marks', err))
          }
        },
      })
    } catch (err) {
      console.error('failed to send the vocabulary', err)
      p.showToast({ message: "Couldn't send to the note. Try again.", tone: 'error' })
    } finally {
      busyRef.current = false
    }
  }

  // O botão principal: direto quando há destino lembrado e a nota ainda existe;
  // senão o modal (primeira vez, ou nota apagada).
  function send() {
    if (toSend.length === 0) return
    if (destNote) void deliver(toSend, { kind: 'note', note: destNote }, getVocabSendTranslation())
    else setModalOpen(true)
  }

  // O chip "Sent to notebook": abre a nota, se ela ainda existe.
  function openSent(item: VocabularyItem) {
    const note = item.sentNoteId ? paramsRef.current.notes.find((n) => n.id === item.sentNoteId) : null
    const notebookId = note?.notebookId ?? item.sentNotebookId
    if (!note || !notebookId) {
      paramsRef.current.showToast({ message: 'That note no longer exists.', tone: 'error' })
      return
    }
    paramsRef.current.showNote(notebookId, note.id)
  }

  const modalProps: SendVocabularyModalProps | null = modalOpen
    ? {
        book,
        items: toSend,
        notebooks,
        notes,
        noteTypes: params.noteTypes,
        current: destNote,
        onCreateNotebook: params.onCreateNotebook,
        onCreateNote: params.onCreateNote,
        onSaveNote: params.onSaveNote,
        onConfirm: (choice, withTranslation) => {
          setVocabSendTranslation(withTranslation)
          setModalOpen(false)
          void deliver(toSend, choice, withTranslation)
        },
        onClose: () => setModalOpen(false),
      }
    : null

  return {
    selectedIds,
    toggleSelected,
    sendLabel: sendButtonLabel(newCount, selectedItems),
    canSend: toSend.length > 0,
    send,
    openChange: () => setModalOpen(true),
    openSent,
    destinationLabel: destNote ? noteDestinationLabel(destNote, notebooks) : null,
    // O que o "Listen to list" lê: os marcados, ou os novos.
    listenItems: itemsToListen(items, selectedIds),
    modalProps,
  }
}
