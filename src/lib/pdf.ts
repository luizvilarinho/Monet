// Setup central do pdfjs-dist (5.6): worker offline empacotado pelo Vite
// (sem CDN — o app desktop funciona offline) e assets auxiliares (decoders
// WASM, fontes padrão, cmaps) servidos de public/pdfjs (copiados pelo
// vite.config.ts). Todo uso do pdfjs no app deve passar por este módulo.
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type { PDFDocumentProxy }
export { TextLayer } from 'pdfjs-dist'

export function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({
    data,
    wasmUrl: '/pdfjs/wasm/',
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
  }).promise
}

export interface PdfInfo {
  title: string | null
  author: string | null
  totalPages: number
}

function normalizeMetaString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function extractPdfInfo(doc: PDFDocumentProxy): Promise<PdfInfo> {
  let title: string | null = null
  let author: string | null = null
  try {
    const { info } = await doc.getMetadata()
    const meta = info as Record<string, unknown>
    title = normalizeMetaString(meta.Title)
    author = normalizeMetaString(meta.Author)
  } catch {
    // Metadados ilegíveis não impedem o import — fica o fallback do chamador.
  }
  return { title, author, totalPages: doc.numPages }
}
