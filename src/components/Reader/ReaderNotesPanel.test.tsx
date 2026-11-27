import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Book, Note, Notebook } from '../../types'
import { getReaderNoteLink, setReaderNoteLink } from '../../lib/readerNoteLink'
import type { NoteViewRequest } from '../../hooks/useBookQuotes'

// O Editor, os ícones e o seletor de tipo pesam e não interessam aqui: o que se
// testa é qual nota a aba mostra e o que acontece com o vínculo livro → nota.
vi.mock('../Editor/Editor', () => ({
  Editor: (props: { value: string }) => <div data-testid="editor">{props.value}</div>,
}))
vi.mock('../NoteTypes/NoteTypePicker', () => ({ NoteTypePicker: () => null }))
vi.mock('@phosphor-icons/react', () => ({
  Plus: () => null,
  Sparkle: () => null,
  X: () => null,
}))

import { ReaderNotesPanel } from './ReaderNotesPanel'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BOOK = { id: 'book-1', title: 'Livre' } as unknown as Book
const NOTEBOOKS = [
  { id: 'nb-book', name: 'Book notes' },
  { id: 'nb-vocab', name: 'Vocabulary' },
] as Notebook[]

function note(id: string, notebookId: string, content: string): Note {
  return { id, notebookId, title: id, content, tags: [], updatedAt: 1 } as unknown as Note
}
const BOOK_NOTE = note('note-book', 'nb-book', 'THE BOOK NOTE')
const VOCAB_NOTE = note('note-vocab', 'nb-vocab', 'THE VOCABULARY NOTE')

let host: HTMLDivElement
let root: Root

interface Props {
  notes: Note[]
  linkVersion: number
  viewRequest: NoteViewRequest | null
}

function render(props: Props) {
  act(() => {
    root.render(
      <ReaderNotesPanel
        book={BOOK}
        notebooks={NOTEBOOKS}
        notes={props.notes}
        noteTypes={[]}
        onCreateNotebook={vi.fn()}
        onCreateNote={vi.fn()}
        onSaveNote={vi.fn(() => Promise.resolve())}
        linkVersion={props.linkVersion}
        viewRequest={props.viewRequest}
        open
        onClose={vi.fn()}
        showToast={vi.fn()}
      />,
    )
  })
}

const request = (noteId: string, notebookId: string, seq = 1): NoteViewRequest => ({ noteId, notebookId, seq })

// A aba é montada com o leitor, sem pedido; o pedido chega depois.
function mountThenRequest(notes: Note[], req: NoteViewRequest) {
  render({ notes, linkVersion: 0, viewRequest: null })
  render({ notes, linkVersion: 0, viewRequest: req })
}
const shown = () => host.querySelector('[data-testid="editor"]')?.textContent ?? null
const bar = () => host.querySelector('[role="status"]')
const backButton = () =>
  Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Back to the book'))

function selectValue(label: string, value: string) {
  const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
  act(() => {
    setter.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

beforeEach(() => {
  localStorage.clear()
  setReaderNoteLink(BOOK.id, 'nb-book', 'note-book')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('the Notes tab without a "show this note" request (as it always was)', () => {
  it('restores the note linked to the book', () => {
    render({ notes: [BOOK_NOTE, VOCAB_NOTE], linkVersion: 0, viewRequest: null })
    expect(shown()).toBe('THE BOOK NOTE')
    expect(bar()).toBeNull()
  })

  it('a linked note that was deleted clears the link, as before', () => {
    render({ notes: [BOOK_NOTE, VOCAB_NOTE], linkVersion: 0, viewRequest: null })
    render({ notes: [VOCAB_NOTE], linkVersion: 0, viewRequest: null })
    expect(shown()).toBeNull()
    expect(getReaderNoteLink(BOOK.id)).toEqual({ notebookId: 'nb-book', noteId: null })
  })

  it('picking a note in the selector links it', () => {
    render({ notes: [BOOK_NOTE, VOCAB_NOTE], linkVersion: 0, viewRequest: null })
    selectValue('Notebook', 'nb-vocab')
    selectValue('Note', 'note-vocab')
    expect(getReaderNoteLink(BOOK.id)).toEqual({ notebookId: 'nb-vocab', noteId: 'note-vocab' })
  })

  it('a link changed outside the tab ("Open" of a quote) shows the new linked note', () => {
    render({ notes: [BOOK_NOTE, VOCAB_NOTE], linkVersion: 0, viewRequest: null })
    setReaderNoteLink(BOOK.id, 'nb-vocab', 'note-vocab')
    render({ notes: [BOOK_NOTE, VOCAB_NOTE], linkVersion: 1, viewRequest: null })
    expect(shown()).toBe('THE VOCABULARY NOTE')
    expect(bar()).toBeNull()
  })
})

describe('"Open" of the vocabulary: shows the note without linking it', () => {
  const notes = [BOOK_NOTE, VOCAB_NOTE]

  it('shows the vocabulary note and leaves the book link alone, with a way back', () => {
    mountThenRequest(notes, request('note-vocab', 'nb-vocab'))
    expect(shown()).toBe('THE VOCABULARY NOTE')
    expect(getReaderNoteLink(BOOK.id)).toEqual({ notebookId: 'nb-book', noteId: 'note-book' })
    expect(bar()?.textContent).toContain('Not linked to this book')
    expect(backButton()).toBeDefined()
  })

  it('"Back to the book\'s note" returns to the linked note, and the link never changed', () => {
    mountThenRequest(notes, request('note-vocab', 'nb-vocab'))
    act(() => backButton()!.click())
    expect(shown()).toBe('THE BOOK NOTE')
    expect(bar()).toBeNull()
    expect(getReaderNoteLink(BOOK.id)).toEqual({ notebookId: 'nb-book', noteId: 'note-book' })
  })

  it('the same note requested again shows it again', () => {
    mountThenRequest(notes, request('note-vocab', 'nb-vocab', 1))
    act(() => backButton()!.click())
    expect(shown()).toBe('THE BOOK NOTE')
    render({ notes, linkVersion: 0, viewRequest: request('note-vocab', 'nb-vocab', 2) })
    expect(shown()).toBe('THE VOCABULARY NOTE')
  })

  it('deleting the note being viewed goes back to the book note and keeps its link (Effect D guard)', () => {
    mountThenRequest(notes, request('note-vocab', 'nb-vocab'))
    render({ notes: [BOOK_NOTE], linkVersion: 0, viewRequest: request('note-vocab', 'nb-vocab') })
    expect(shown()).toBe('THE BOOK NOTE')
    expect(bar()).toBeNull()
    expect(getReaderNoteLink(BOOK.id)).toEqual({ notebookId: 'nb-book', noteId: 'note-book' })
  })

  it('picking a note in the selector afterwards links it on purpose', () => {
    mountThenRequest(notes, request('note-vocab', 'nb-vocab'))
    selectValue('Notebook', 'nb-book')
    selectValue('Note', 'note-book')
    expect(bar()).toBeNull()
    expect(getReaderNoteLink(BOOK.id)).toEqual({ notebookId: 'nb-book', noteId: 'note-book' })
    selectValue('Notebook', 'nb-vocab')
    selectValue('Note', 'note-vocab')
    expect(getReaderNoteLink(BOOK.id)).toEqual({ notebookId: 'nb-vocab', noteId: 'note-vocab' })
  })

  it('viewing the very note that is linked shows no notice', () => {
    mountThenRequest(notes, request('note-book', 'nb-book'))
    expect(shown()).toBe('THE BOOK NOTE')
    expect(bar()).toBeNull()
  })

  it('a book with no linked note can still see the vocabulary note, without a way back', () => {
    localStorage.clear()
    mountThenRequest(notes, request('note-vocab', 'nb-vocab'))
    expect(shown()).toBe('THE VOCABULARY NOTE')
    expect(getReaderNoteLink(BOOK.id)).toBeNull()
    expect(bar()).not.toBeNull()
    expect(backButton()).toBeUndefined()
  })

  it('a link made elsewhere while viewing (Retell, quote modal) takes over', () => {
    mountThenRequest(notes, request('note-vocab', 'nb-vocab'))
    setReaderNoteLink(BOOK.id, 'nb-book', 'note-book')
    render({ notes, linkVersion: 1, viewRequest: request('note-vocab', 'nb-vocab') })
    expect(shown()).toBe('THE BOOK NOTE')
    expect(bar()).toBeNull()
  })
})
