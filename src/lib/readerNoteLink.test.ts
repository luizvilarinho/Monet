import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  READER_NOTE_LINK_EVENT,
  findBookIdForNote,
  getReaderNoteLink,
  getReaderNoteLinks,
  isLinkedToOtherNote,
  sameReaderNoteLink,
  setReaderNoteLink,
  unlinkBookFromReaderNote,
} from './readerNoteLink'

describe('sameReaderNoteLink', () => {
  it('compara caderno e nota; ausente só é igual a ausente', () => {
    const a = { notebookId: 'nb1', noteId: 'n1' }
    expect(sameReaderNoteLink(a, { notebookId: 'nb1', noteId: 'n1' })).toBe(true)
    expect(sameReaderNoteLink(a, { notebookId: 'nb2', noteId: 'n1' })).toBe(false)
    expect(sameReaderNoteLink(a, { notebookId: 'nb1', noteId: 'n2' })).toBe(false)
    expect(sameReaderNoteLink(a, { notebookId: 'nb1', noteId: null })).toBe(false)
    expect(sameReaderNoteLink({ notebookId: 'nb1', noteId: null }, { notebookId: 'nb1', noteId: null })).toBe(true)
    expect(sameReaderNoteLink(a, null)).toBe(false)
    expect(sameReaderNoteLink(undefined, a)).toBe(false)
    expect(sameReaderNoteLink(null, undefined)).toBe(true)
  })
})

describe('isLinkedToOtherNote', () => {
  it('só conta o vínculo com OUTRA nota', () => {
    expect(isLinkedToOtherNote(null, 'n1')).toBe(false)
    expect(isLinkedToOtherNote(undefined, 'n1')).toBe(false)
    // Só o caderno, sem nota: nenhuma nota perde o livro.
    expect(isLinkedToOtherNote({ notebookId: 'nb1', noteId: null }, 'n1')).toBe(false)
    expect(isLinkedToOtherNote({ notebookId: 'nb1', noteId: 'n1' }, 'n1')).toBe(false)
    expect(isLinkedToOtherNote({ notebookId: 'nb1', noteId: 'n2' }, 'n1')).toBe(true)
  })
})

describe('vínculo livro ↔ nota', () => {
  const heard: Array<{ bookId: string }> = []
  const listener = (e: Event) => heard.push((e as CustomEvent<{ bookId: string }>).detail)

  beforeEach(() => {
    localStorage.clear()
    heard.length = 0
    window.addEventListener(READER_NOTE_LINK_EVENT, listener)
  })
  afterEach(() => {
    window.removeEventListener(READER_NOTE_LINK_EVENT, listener)
    vi.restoreAllMocks()
  })

  it('grava, lê e acha a nota ligada ao livro e o livro ligado à nota', () => {
    setReaderNoteLink('b1', 'nb1', 'n1')
    setReaderNoteLink('b2', 'nb1', null)
    expect(getReaderNoteLink('b1')).toEqual({ notebookId: 'nb1', noteId: 'n1' })
    expect(getReaderNoteLink('b3')).toBeNull()
    expect(findBookIdForNote('n1')).toBe('b1')
    expect(findBookIdForNote('n9')).toBeNull()
    expect(Object.keys(getReaderNoteLinks()).sort()).toEqual(['b1', 'b2'])
  })

  it('avisa a janela uma vez por mudança, com o livro no detail', () => {
    setReaderNoteLink('b1', 'nb1', 'n1')
    expect(heard).toEqual([{ bookId: 'b1' }])
    setReaderNoteLink('b1', 'nb1', 'n2')
    expect(heard).toEqual([{ bookId: 'b1' }, { bookId: 'b1' }])
    unlinkBookFromReaderNote('b1')
    expect(heard).toHaveLength(3)
  })

  it('não avisa nem regrava quando o valor é o mesmo (o painel do Reader chama isto em efeitos)', () => {
    setReaderNoteLink('b1', 'nb1', 'n1')
    heard.length = 0
    const setItem = vi.spyOn(localStorage, 'setItem')
    setReaderNoteLink('b1', 'nb1', 'n1')
    setReaderNoteLink('b1', 'nb1', 'n1')
    expect(heard).toEqual([])
    expect(setItem).not.toHaveBeenCalled()
  })

  it('desligar um livro sem vínculo não avisa', () => {
    unlinkBookFromReaderNote('nunca-ligado')
    expect(heard).toEqual([])
    setReaderNoteLink('b1', 'nb1', 'n1')
    heard.length = 0
    unlinkBookFromReaderNote('b1')
    unlinkBookFromReaderNote('b1')
    expect(heard).toEqual([{ bookId: 'b1' }])
    expect(getReaderNoteLink('b1')).toBeNull()
  })

  it('a gravação que falha não avisa', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    setReaderNoteLink('b1', 'nb1', 'n1')
    expect(heard).toEqual([])
  })
})
