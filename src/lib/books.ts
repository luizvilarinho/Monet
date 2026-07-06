import { invoke } from '@tauri-apps/api/core'
import type { Book } from '../types'
import { storage } from '../storage'
import { extractPdfInfo, openPdf } from './pdf'

export interface BookImportResult {
  destPath: string
  fileName: string
}

export async function booksImportFile(): Promise<BookImportResult | null> {
  const result = await invoke<BookImportResult | null>('books_import_file')
  return result ?? null
}

export async function booksReadFile(path: string): Promise<Uint8Array> {
  const bytes = await invoke<ArrayBuffer>('books_read_file', { path })
  return new Uint8Array(bytes)
}

export async function booksDeleteFile(path: string): Promise<void> {
  await invoke('books_delete_file', { path })
}

// Fluxo completo de import: dialog + cópia (Rust) → validação/metadados via
// pdfjs → registro no banco. A validação acontece ANTES do insert: se o PDF
// for inválido/protegido, a cópia é desfeita e nenhum livro órfão é criado.
export async function importBook(): Promise<Book | null> {
  const picked = await booksImportFile()
  if (!picked) return null

  let title: string | null
  let author: string | null
  let totalPages: number
  try {
    const data = await booksReadFile(picked.destPath)
    const doc = await openPdf(data)
    const info = await extractPdfInfo(doc)
    await doc.destroy()
    title = info.title
    author = info.author
    totalPages = info.totalPages
  } catch (err) {
    // Desfaz a cópia — nunca registrar livro órfão. Falha do rollback é só
    // logada: não pode mascarar a mensagem amigável abaixo.
    try {
      await booksDeleteFile(picked.destPath)
    } catch (rollbackErr) {
      console.error('failed to undo book file copy', rollbackErr)
    }
    const name = err instanceof Error ? err.name : ''
    if (name === 'PasswordException') {
      throw new Error('This PDF is password-protected and cannot be imported.')
    }
    throw new Error('This file is corrupted or is not a valid PDF.')
  }

  const book: Book = {
    id: crypto.randomUUID(),
    title: title ?? picked.fileName,
    author,
    filePath: picked.destPath,
    totalPages,
    lastPage: 1,
    addedAt: Date.now(),
    lastOpenedAt: null,
  }
  await storage.saveBook(book)
  return book
}
