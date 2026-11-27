import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Book, VocabularyItem } from '../types'
import type { VocabularyDraft } from '../lib/vocabulary'

// O banco é simulado: o que se testa é o estado do hook.
const getBookVocabulary = vi.fn<(bookId: string) => Promise<VocabularyItem[]>>()
const saveVocabularyItem = vi.fn<(item: VocabularyItem) => Promise<void>>()
vi.mock('../storage', () => ({
  storage: {
    getBookVocabulary: (bookId: string) => getBookVocabulary(bookId),
    saveVocabularyItem: (item: VocabularyItem) => saveVocabularyItem(item),
  },
}))

import { useBookVocabulary, type BookVocabulary } from './useBookVocabulary'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function book(language: string): Book {
  return { id: 'book-1', title: 'Livre', language } as unknown as Book
}

function item(over: Partial<VocabularyItem>): VocabularyItem {
  return {
    id: 'saved-1',
    bookId: 'book-1',
    text: 'malle',
    kind: 'word',
    sentence: 'La malle était lourde.',
    sense: null,
    baseForm: null,
    language: 'it',
    page: 3,
    positionLabel: 'p. 3',
    anchor: { format: 'pdf', page: 3, start: 3, end: 8, rects: [] },
    createdAt: '2026-11-01T10:00:00.000Z',
    sentAt: null,
    sentNotebookId: null,
    sentNoteId: null,
    ...over,
  }
}

function draft(text: string, sentence: string): VocabularyDraft {
  return {
    text,
    sentence,
    kind: 'word',
    sense: null,
    baseForm: null,
    page: 3,
    positionLabel: 'p. 3',
    anchor: { format: 'pdf', page: 3, start: 0, end: text.length, rects: [] },
  }
}

let host: HTMLDivElement
let root: Root
let latest: BookVocabulary

function Probe({ current }: { current: Book }) {
  const vocabulary = useBookVocabulary(current, true)
  useEffect(() => {
    latest = vocabulary
  })
  return null
}

function render(current: Book) {
  act(() => root.render(<Probe current={current} />))
}

const flush = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  getBookVocabulary.mockReset()
  saveVocabularyItem.mockReset()
  saveVocabularyItem.mockResolvedValue(undefined)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('the language of the items follows the language of the book', () => {
  it('correcting the book language updates the items in memory, so the next upsert keeps it', async () => {
    getBookVocabulary.mockResolvedValue([item({ language: 'it' })])
    render(book('it'))
    await flush()
    expect(latest.items[0].language).toBe('it')

    render(book('fr'))
    expect(latest.items.map((i) => i.language)).toEqual(['fr'])

    // Gravar o sentido de um item usa o item em memória: a língua corrigida vai ao banco.
    await act(() => latest.update({ ...latest.items[0], sense: 'baú' }))
    expect(saveVocabularyItem).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'fr', sense: 'baú' }))
  })

  it('an item added after the correction already has the new language', async () => {
    getBookVocabulary.mockResolvedValue([])
    render(book('fr'))
    await flush()
    await act(async () => {
      await latest.add(draft('malle', 'La malle était lourde.'))
    })
    expect(latest.items[0].language).toBe('fr')
  })
})

describe('Add before the first load of the list', () => {
  it('waits for the list: the saved item is not dropped by the load, and a duplicate is seen', async () => {
    let finish!: (list: VocabularyItem[]) => void
    getBookVocabulary.mockReturnValue(new Promise<VocabularyItem[]>((resolve) => (finish = resolve)))
    render(book('fr'))

    let result: Promise<'added' | 'duplicate'>
    await act(async () => {
      // Já está no banco, mas a lista ainda não chegou.
      result = latest.add(draft('malle', 'La malle était lourde.'))
      await Promise.resolve()
    })
    expect(saveVocabularyItem).not.toHaveBeenCalled()

    await act(async () => {
      finish([item({ language: 'fr' })])
      await Promise.resolve()
    })
    await expect(result!).resolves.toBe('duplicate')
    expect(latest.items).toHaveLength(1)
    expect(saveVocabularyItem).not.toHaveBeenCalled()
  })

  it('a new item added during the load is still in the list when the load ends', async () => {
    let finish!: (list: VocabularyItem[]) => void
    getBookVocabulary.mockReturnValue(new Promise<VocabularyItem[]>((resolve) => (finish = resolve)))
    render(book('fr'))

    let result: Promise<'added' | 'duplicate'>
    await act(async () => {
      result = latest.add(draft('lampe', 'Elle chercha une lampe.'))
      await Promise.resolve()
    })
    await act(async () => {
      finish([item({ language: 'fr' })])
      await Promise.resolve()
    })
    await expect(result!).resolves.toBe('added')
    expect(latest.items.map((i) => i.text).sort()).toEqual(['lampe', 'malle'])
  })
})
