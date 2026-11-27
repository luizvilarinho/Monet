import { beforeEach, describe, expect, it } from 'vitest'
import type { Note, Notebook } from '../types'
import {
  defaultNotebooks,
  getVocabularyDestination,
  resolveDestination,
  setVocabularyDestination,
  vocabularyNoteTitle,
} from './vocabularyDestination'

function note(id: string): Note {
  return { id, notebookId: 'nb-1', title: 'Vocabulary — La Maison des dunes', content: '', tags: [], createdAt: 1, updatedAt: 1 }
}

beforeEach(() => {
  localStorage.clear()
})

describe('the remembered destination', () => {
  it('is remembered per book', () => {
    setVocabularyDestination('book-1', { notebookId: 'nb-1', noteId: 'n-1' })
    setVocabularyDestination('book-2', { notebookId: 'nb-2', noteId: 'n-2' })
    expect(getVocabularyDestination('book-1')).toEqual({ notebookId: 'nb-1', noteId: 'n-1' })
    expect(getVocabularyDestination('book-2')).toEqual({ notebookId: 'nb-2', noteId: 'n-2' })
    expect(getVocabularyDestination('book-3')).toBeNull()
  })

  it('is forgotten with null, and only for that book', () => {
    setVocabularyDestination('book-1', { notebookId: 'nb-1', noteId: 'n-1' })
    setVocabularyDestination('book-2', { notebookId: 'nb-2', noteId: 'n-2' })
    setVocabularyDestination('book-1', null)
    expect(getVocabularyDestination('book-1')).toBeNull()
    expect(getVocabularyDestination('book-2')).not.toBeNull()
  })

  it('ignores what the storage holds when it is not a destination', () => {
    localStorage.setItem('monet:vocab-destinations', '{"book-1":{"notebookId":1},"book-2":"x"}')
    expect(getVocabularyDestination('book-1')).toBeNull()
    expect(getVocabularyDestination('book-2')).toBeNull()
    localStorage.setItem('monet:vocab-destinations', 'not json')
    expect(getVocabularyDestination('book-1')).toBeNull()
  })
})

describe('resolveDestination', () => {
  it('finds the note of the destination', () => {
    expect(resolveDestination({ notebookId: 'nb-1', noteId: 'n-2' }, [note('n-1'), note('n-2')])?.id).toBe('n-2')
  })

  it('is null when the note was deleted, so the send asks for the destination again', () => {
    expect(resolveDestination({ notebookId: 'nb-1', noteId: 'gone' }, [note('n-1')])).toBeNull()
    expect(resolveDestination(null, [note('n-1')])).toBeNull()
  })
})

describe('vocabularyNoteTitle', () => {
  it('names the note after the book', () => {
    expect(vocabularyNoteTitle('La Maison des dunes')).toBe('Vocabulary — La Maison des dunes')
  })
})

describe('defaultNotebooks', () => {
  const calendar = { id: 'calendar', name: 'Calendar' } as Notebook
  const study = { id: 'nb-study', name: 'Study' } as Notebook
  const work = { id: 'nb-work', name: 'Work' } as Notebook

  it('never offers the Calendar, which usually comes first in the order', () => {
    expect(defaultNotebooks([calendar, study, work]).map((nb) => nb.id)).toEqual(['nb-study', 'nb-work'])
  })

  it('leaves out the notebooks with AI turned off when asked', () => {
    expect(defaultNotebooks([calendar, study, work], new Set(['nb-study'])).map((nb) => nb.id)).toEqual(['nb-work'])
  })

  it('only the Calendar (or only notebooks with AI off) leaves nothing to choose', () => {
    expect(defaultNotebooks([calendar])).toEqual([])
    expect(defaultNotebooks([study], new Set(['nb-study']))).toEqual([])
    expect(defaultNotebooks([])).toEqual([])
  })
})
