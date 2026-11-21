import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaperItem } from './agentItems'

// "Open in Library" com o storage e o Rust simulados (nenhum teste faz
// requisição nem grava arquivo); o vínculo livro ↔ nota usa o localStorage real.
const mocks = vi.hoisted(() => ({
  getBooks: vi.fn(),
  booksDownloadPdf: vi.fn(),
  registerBookFile: vi.fn(),
}))

vi.mock('../storage', () => ({ storage: { getBooks: mocks.getBooks } }))
vi.mock('./books', () => ({
  booksDownloadPdf: mocks.booksDownloadPdf,
  registerBookFile: mocks.registerBookFile,
}))

import { LinkedBookGoneError, openPaperInLibrary, openPdfInLibrary } from './paperPdf'
import { OPEN_BOOK_KEY, requestOpenBook } from './libraryOpen'
import { findBookIdForNote, getReaderNoteLink, setReaderNoteLink } from './readerNoteLink'

function paper(patch: Partial<PaperItem> = {}): PaperItem {
  return {
    kind: 'paper',
    key: 'P1',
    section: 'foundational',
    id: 'doi:10.1000/abc',
    openalexId: 'W123',
    title: 'Graph neural networks: a review',
    authors: ['Ana Smith', 'Bo Lee'],
    authorCount: 5,
    year: 2021,
    date: '2021-03-01',
    doi: '10.1000/abc',
    url: 'https://doi.org/10.1000/abc',
    citations: 10,
    type: 'review',
    isOa: true,
    pdfUrl: 'https://repo.example.org/paper.pdf',
    oaUrl: null,
    abstract: null,
    ...patch,
  }
}

const NOTE = { id: 'note1', notebookId: 'nb1' }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.getBooks.mockResolvedValue([])
  mocks.booksDownloadPdf.mockResolvedValue({ destPath: 'C:/books/x.pdf', fileName: 'paper' })
  mocks.registerBookFile.mockResolvedValue({ id: 'book1' })
})

describe('openPaperInLibrary', () => {
  it('baixa o PDF, registra o livro com o título e os autores do artigo e o liga à nota', async () => {
    await expect(openPaperInLibrary(paper(), NOTE)).resolves.toBe('book1')
    expect(mocks.booksDownloadPdf).toHaveBeenCalledWith('https://repo.example.org/paper.pdf')
    expect(mocks.registerBookFile).toHaveBeenCalledWith(
      { destPath: 'C:/books/x.pdf', fileName: 'paper' },
      { title: 'Graph neural networks: a review', author: 'Ana Smith, Bo Lee et al.' }
    )
    expect(getReaderNoteLink('book1')).toEqual({ notebookId: 'nb1', noteId: 'note1' })
    expect(findBookIdForNote('note1')).toBe('book1')
  })

  it('usa o oa_url quando ele termina em .pdf', async () => {
    await openPaperInLibrary(paper({ pdfUrl: null, oaUrl: 'https://repo.example.org/files/p.pdf?dl=1' }), NOTE)
    expect(mocks.booksDownloadPdf).toHaveBeenCalledWith('https://repo.example.org/files/p.pdf?dl=1')
  })

  it('reaproveita o livro já ligado à nota, sem baixar de novo', async () => {
    setReaderNoteLink('book9', 'nb1', 'note1')
    mocks.getBooks.mockResolvedValue([{ id: 'book9' }])
    await expect(openPaperInLibrary(paper(), NOTE)).resolves.toBe('book9')
    expect(mocks.booksDownloadPdf).not.toHaveBeenCalled()
    expect(mocks.registerBookFile).not.toHaveBeenCalled()
  })

  it('o vínculo com um livro que não existe mais é removido e o PDF baixa uma vez só', async () => {
    setReaderNoteLink('gone', 'nb1', 'note1')
    await expect(openPaperInLibrary(paper(), NOTE)).resolves.toBe('book1')
    expect(mocks.booksDownloadPdf).toHaveBeenCalledTimes(1)
    expect(getReaderNoteLink('gone')).toBeNull()
    expect(findBookIdForNote('note1')).toBe('book1')

    // 2º clique: o livro novo existe e é só aberto, sem baixar nem registrar outro.
    mocks.getBooks.mockResolvedValue([{ id: 'book1' }])
    await expect(openPaperInLibrary(paper(), NOTE)).resolves.toBe('book1')
    expect(mocks.booksDownloadPdf).toHaveBeenCalledTimes(1)
    expect(mocks.registerBookFile).toHaveBeenCalledTimes(1)
  })

  it('o vínculo órfão sai mesmo quando o download falha (o próximo clique não o acha de novo)', async () => {
    setReaderNoteLink('gone', 'nb1', 'note1')
    mocks.booksDownloadPdf.mockRejectedValue('Download failed: HTTP 403 Forbidden')
    await expect(openPaperInLibrary(paper(), NOTE)).rejects.toThrow('HTTP 403')
    expect(findBookIdForNote('note1')).toBeNull()
  })

  it('sem PDF de acesso aberto, lança e não baixa nada', async () => {
    const item = paper({ pdfUrl: null, oaUrl: 'https://repo.example.org/landing' })
    await expect(openPaperInLibrary(item, NOTE)).rejects.toThrow('No open-access PDF')
    expect(mocks.booksDownloadPdf).not.toHaveBeenCalled()
  })

  it('o erro do Rust (uma string) sai como Error com a mesma mensagem', async () => {
    mocks.booksDownloadPdf.mockRejectedValue('The link did not return a PDF (the publisher may require a browser). Use Open to read the paper in your browser.')
    const err = await openPaperInLibrary(paper(), NOTE).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe(
      'The link did not return a PDF (the publisher may require a browser). Use Open to read the paper in your browser.'
    )
    expect(mocks.registerBookFile).not.toHaveBeenCalled()
  })

  it('o erro do registro (PDF inválido) sobe, e nada é ligado à nota', async () => {
    mocks.registerBookFile.mockRejectedValue(new Error('This file is corrupted or is not a valid PDF.'))
    await expect(openPaperInLibrary(paper(), NOTE)).rejects.toThrow('This file is corrupted or is not a valid PDF.')
    expect(findBookIdForNote('note1')).toBeNull()
  })

  it('nota sem caderno: registra o livro e não grava vínculo', async () => {
    await expect(openPaperInLibrary(paper(), { id: 'note1', notebookId: null })).resolves.toBe('book1')
    expect(findBookIdForNote('note1')).toBeNull()
  })
})

describe('openPdfInLibrary (a partir da nota)', () => {
  const PDF = { link: 'https://repo.example.org/files/p.pdf', title: 'Graph neural networks', author: 'Ana Smith' }

  it('baixa o link da nota, registra com o título e o autor da nota e liga o livro a ela', async () => {
    await expect(openPdfInLibrary(NOTE, PDF)).resolves.toBe('book1')
    expect(mocks.booksDownloadPdf).toHaveBeenCalledWith('https://repo.example.org/files/p.pdf')
    expect(mocks.registerBookFile).toHaveBeenCalledWith(
      { destPath: 'C:/books/x.pdf', fileName: 'paper' },
      { title: 'Graph neural networks', author: 'Ana Smith' }
    )
    expect(getReaderNoteLink('book1')).toEqual({ notebookId: 'nb1', noteId: 'note1' })
  })

  it('com o livro já ligado e ainda na Library, só devolve o livro (mesmo sem link)', async () => {
    setReaderNoteLink('book9', 'nb1', 'note1')
    mocks.getBooks.mockResolvedValue([{ id: 'book9' }])
    await expect(openPdfInLibrary(NOTE, { ...PDF, link: null })).resolves.toBe('book9')
    expect(mocks.booksDownloadPdf).not.toHaveBeenCalled()
  })

  it('sem livro ligado e sem link, lança e não baixa nada', async () => {
    await expect(openPdfInLibrary(NOTE, { ...PDF, link: null })).rejects.toThrow('No open-access PDF')
    expect(mocks.booksDownloadPdf).not.toHaveBeenCalled()
  })

  it('livro ligado apagado da Library e nota sem link: diz isso, remove o vínculo e não baixa nada', async () => {
    setReaderNoteLink('gone', 'nb1', 'note1')
    const err = await openPdfInLibrary(NOTE, { ...PDF, link: null }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LinkedBookGoneError)
    expect((err as Error).message).toBe('The linked book is no longer in the Library, and the note has no PDF link.')
    expect(findBookIdForNote('note1')).toBeNull()
    expect(mocks.booksDownloadPdf).not.toHaveBeenCalled()
    // Sem o vínculo, o clique seguinte volta à mensagem de sem PDF.
    await expect(openPdfInLibrary(NOTE, { ...PDF, link: null })).rejects.toThrow('No open-access PDF')
  })

  it('o download que falha deixa a nota sem vínculo', async () => {
    mocks.booksDownloadPdf.mockRejectedValue('Download failed: HTTP 403 Forbidden')
    await expect(openPdfInLibrary(NOTE, PDF)).rejects.toThrow('Download failed: HTTP 403 Forbidden')
    expect(findBookIdForNote('note1')).toBeNull()
  })
})

describe('findBookIdForNote e requestOpenBook', () => {
  it('findBookIdForNote: o primeiro livro ligado à nota; sem vínculo, null', () => {
    setReaderNoteLink('a', 'nb1', 'other')
    setReaderNoteLink('b', 'nb1', 'note1')
    setReaderNoteLink('c', 'nb1', 'note1')
    setReaderNoteLink('d', 'nb1', null)
    expect(findBookIdForNote('note1')).toBe('b')
    expect(findBookIdForNote('missing')).toBeNull()
  })

  it('requestOpenBook grava o livro a abrir e limpa a pasta de documentação aberta', () => {
    localStorage.setItem('monet:docs-open-folder', 'folderX')
    requestOpenBook('book1')
    expect(localStorage.getItem(OPEN_BOOK_KEY)).toBe('book1')
    expect(localStorage.getItem('monet:docs-open-folder')).toBeNull()
    expect(OPEN_BOOK_KEY).toBe('monet:reader-open-book')
  })
})
