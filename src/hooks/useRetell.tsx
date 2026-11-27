import { useRef, useState, type ReactNode } from 'react'
import type { Book, Note, NoteType, Notebook, VocabularyItem } from '../types'
import { appendBlockToNote, resolveLinkedNote } from '../lib/bookQuotes'
import { getUserLocale } from '../lib/languageSettings'
import { buildRetellBlock, retellItems, retellRangeLabel, retellWords } from '../lib/retell'
import { noteDateLabel } from '../lib/vocabulary'
import { QuoteToNoteModal } from '../components/Reader/QuoteToNoteModal'
import type { ShowReaderToast } from '../components/Reader/ReaderToast'

export interface UseRetellParams {
  book: Book
  format: 'pdf' | 'epub'
  items: VocabularyItem[]
  selectedIds: ReadonlySet<string>
  notes: Note[]
  notebooks: Notebook[]
  noteTypes: NoteType[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (
    notebookId: string,
    title: string,
    content: string,
    requestId?: string,
    typeId?: string | null,
  ) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  showToast: ShowReaderToast
  // Mostra a nota na aba Notes do leitor, vinculada ao livro (o "Open" das citações).
  openNote: (notebookId: string, noteId: string) => void
}

// Recontar: acrescenta à nota vinculada ao livro (a que a aba Notes mostra) um bloco
// "Retell" com as palavras guardadas e abre a aba Notes. Sem nota vinculada, pede o
// destino pelos dois passos do modal de citação; a nota escolhida passa a ser a
// vinculada ao livro, como a aba Notes faz.
export function useRetell(params: UseRetellParams): {
  canRetell: boolean
  retell: () => void
  modal: ReactNode
} {
  const { book, items, selectedIds, notes, notebooks, noteTypes } = params
  const [picking, setPicking] = useState(false)
  // Os callbacks assíncronos leem o que há de mais novo (a nota pode ter mudado
  // enquanto o destino era escolhido).
  const paramsRef = useRef(params)
  paramsRef.current = params
  const busyRef = useRef(false)

  const canRetell = retellWords(items, selectedIds).length > 0

  async function writeTo(note: Note) {
    if (busyRef.current) return
    busyRef.current = true
    const p = paramsRef.current
    try {
      const words = retellWords(p.items, p.selectedIds)
      if (words.length === 0) return
      const block = buildRetellBlock(
        words,
        retellRangeLabel(retellItems(p.items, p.selectedIds), p.format),
        noteDateLabel(new Date(), getUserLocale()),
      )
      const current = paramsRef.current.notes.find((n) => n.id === note.id) ?? note
      if (!current.notebookId) throw new Error('The note is not in a notebook.')
      await appendBlockToNote(p.onSaveNote, current, block)
      p.openNote(current.notebookId, current.id)
    } catch (err) {
      console.error('failed to add the retelling to the note', err)
      p.showToast({ message: "Couldn't add the retelling to the note. Try again.", tone: 'error' })
    } finally {
      busyRef.current = false
    }
  }

  function retell() {
    if (!canRetell) return
    const linked = resolveLinkedNote(book.id, notes)
    if (linked) void writeTo(linked)
    else setPicking(true)
  }

  const modal = picking ? (
    <QuoteToNoteModal
      open
      notebooks={notebooks}
      notes={notes}
      noteTypes={noteTypes}
      onCreateNotebook={params.onCreateNotebook}
      onCreateNote={params.onCreateNote}
      onSaveNote={params.onSaveNote}
      onPickDestination={(_notebookId, note) => {
        setPicking(false)
        void writeTo(note)
      }}
      onClose={() => setPicking(false)}
    />
  ) : null

  return { canRetell, retell, modal }
}
