import { invoke } from '@tauri-apps/api/core'
import type { Book } from '../types'
import { storage } from '../storage'
import {
  EPUB_DRM_ERROR_NAME,
  EPUB_INCOMPLETE_ERROR_NAME,
  EPUB_TIMEOUT_ERROR_NAME,
  extractEpubInfo,
} from './epub'
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

// Baixa um PDF de acesso aberto para a pasta de livros (Rust); o registro no
// banco é do `registerBookFile`.
export async function booksDownloadPdf(url: string): Promise<BookImportResult> {
  return invoke<BookImportResult>('books_download_pdf', { url })
}

// Fluxo completo de import: dialog + cópia (Rust) → validação/metadados via
// pdfjs ou epubjs, conforme a extensão → registro no banco. A validação
// acontece ANTES do insert: se o arquivo for inválido/protegido, a cópia é
// desfeita e nenhum livro órfão é criado.
export async function importBook(): Promise<Book | null> {
  const picked = await booksImportFile()
  if (!picked) return null
  return registerBookFile(picked)
}

// Registra um arquivo que o Rust já gravou em books/ (o import da Library e o
// download do "Open in Library"): a validação e o registro descritos acima.
// `meta` (título e autor não vazios) substitui os do metadado do arquivo.
export async function registerBookFile(
  picked: BookImportResult,
  meta?: { title?: string; author?: string | null },
): Promise<Book> {
  // O Rust grava o destino com a extensão original em minúsculas, então
  // basta olhar o sufixo para saber por qual caminho validar.
  const isEpub = picked.destPath.toLowerCase().endsWith('.epub')

  let book: Book
  try {
    const data = await booksReadFile(picked.destPath)
    const common = {
      id: crypto.randomUUID(),
      filePath: picked.destPath,
      lastPage: 1,
      addedAt: Date.now(),
      lastOpenedAt: null,
      zoom: 1,
    }
    if (isEpub) {
      const info = await extractEpubInfo(data)
      book = {
        ...common,
        format: 'epub',
        title: info.title ?? picked.fileName,
        author: info.author,
        totalPages: info.locationCount,
        cfi: null,
        locationsJson: info.locationsJson,
      }
    } else {
      const doc = await openPdf(data)
      const info = await extractPdfInfo(doc)
      await doc.destroy()
      book = {
        ...common,
        format: 'pdf',
        title: info.title ?? picked.fileName,
        author: info.author,
        totalPages: info.totalPages,
      }
    }
  } catch (err) {
    // Desfaz a cópia — nunca registrar livro órfão. Falha do rollback é só
    // logada: não pode mascarar a mensagem amigável abaixo.
    try {
      await booksDeleteFile(picked.destPath)
    } catch (rollbackErr) {
      console.error('failed to undo book file copy', rollbackErr)
    }
    const name = err instanceof Error ? err.name : ''
    if (isEpub) {
      if (name === EPUB_DRM_ERROR_NAME) {
        throw new Error('This EPUB is DRM-protected and cannot be imported.')
      }
      if (name === EPUB_TIMEOUT_ERROR_NAME) {
        throw new Error('This EPUB took too long to read and was not imported.')
      }
      if (name === EPUB_INCOMPLETE_ERROR_NAME) {
        throw new Error(
          'This EPUB is missing part of its content and cannot be imported.',
        )
      }
      throw new Error('This file is corrupted or is not a valid EPUB.')
    }
    if (name === 'PasswordException') {
      throw new Error('This PDF is password-protected and cannot be imported.')
    }
    throw new Error('This file is corrupted or is not a valid PDF.')
  }

  const title = meta?.title?.trim()
  const author = meta?.author?.trim()
  if (title) book.title = title
  if (author) book.author = author

  await storage.saveBook(book)
  return book
}
