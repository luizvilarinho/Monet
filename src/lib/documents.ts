import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Document, DocumentStatus } from '../types'

export interface ChunkResult {
  documentId: string
  documentName: string
  chunkIndex: number
  snippet: string
  distance: number
}

export interface DocumentStatusEvent {
  documentId: string
  notebookId: string
  status: DocumentStatus
  errorMessage?: string | null
}

export async function documentsUpload(
  notebookId: string,
  sourcePath: string,
): Promise<string> {
  return invoke<string>('documents_upload', { notebookId, sourcePath })
}

export async function documentsReindex(documentId: string): Promise<void> {
  await invoke('documents_reindex', { documentId })
}

export async function documentsDelete(documentId: string): Promise<void> {
  await invoke('documents_delete', { documentId })
}

interface DocumentRaw extends Omit<Document, 'errorMessage'> {
  errorMessage: string | null
}

export async function documentsList(notebookId: string): Promise<Document[]> {
  const rows = await invoke<DocumentRaw[]>('documents_list', { notebookId })
  return rows.map((d) => ({
    ...d,
    errorMessage: d.errorMessage ?? undefined,
  }))
}

export async function documentsSearch(
  notebookId: string,
  queryEmbedding: number[],
  topK: number,
): Promise<ChunkResult[]> {
  return invoke<ChunkResult[]>('documents_search', {
    notebookId,
    queryEmbedding,
    topK,
  })
}

export async function embedText(text: string): Promise<number[]> {
  return invoke<number[]>('embed_text', { text })
}

export async function pickDocumentFile(): Promise<string | null> {
  const result = await invoke<string | null>('documents_pick_file')
  return result ?? null
}

export function onDocumentStatus(
  handler: (event: DocumentStatusEvent) => void,
): Promise<UnlistenFn> {
  return listen<DocumentStatusEvent>('documents://status', (e) => handler(e.payload))
}
