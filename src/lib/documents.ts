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
  status: DocumentStatus
  errorMessage?: string | null
}

export async function documentsUploadGlobal(
  sourcePath: string,
): Promise<string> {
  return invoke<string>('documents_upload_global', { sourcePath })
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

export async function documentsListGlobal(): Promise<Document[]> {
  const rows = await invoke<DocumentRaw[]>('documents_list_global')
  return rows.map((d) => ({
    ...d,
    errorMessage: d.errorMessage ?? undefined,
  }))
}

export async function setNotebookDocumentVisibility(
  notebookId: string,
  documentId: string,
  visible: boolean,
): Promise<void> {
  await invoke('documents_set_notebook_visibility', {
    notebookId,
    documentId,
    visible,
  })
}

export async function getNotebookVisibleDocumentIds(
  notebookId: string,
): Promise<string[]> {
  return invoke<string[]>('documents_get_notebook_visible_ids', { notebookId })
}

export async function getNotebooksWithVisibleDocs(): Promise<string[]> {
  return invoke<string[]>('documents_get_notebooks_with_visible_docs')
}

export async function documentsSearchByIds(
  documentIds: string[],
  queryEmbedding: number[],
  topK: number,
): Promise<ChunkResult[]> {
  return invoke<ChunkResult[]>('documents_search_by_ids', {
    documentIds,
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
