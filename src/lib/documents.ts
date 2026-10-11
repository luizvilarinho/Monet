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

interface DocumentRaw extends Omit<Document, 'errorMessage' | 'parentFolderId' | 'lastModifiedMs' | 'originalPath'> {
  originalPath: string | null
  errorMessage: string | null
  parentFolderId: string | null
  lastModifiedMs: number | null
}

export async function documentsListGlobal(): Promise<Document[]> {
  const rows = await invoke<DocumentRaw[]>('documents_list_global')
  return rows.map((d) => ({
    ...d,
    originalPath: d.originalPath ?? undefined,
    errorMessage: d.errorMessage ?? undefined,
    parentFolderId: d.parentFolderId ?? undefined,
    lastModifiedMs: d.lastModifiedMs ?? undefined,
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
  dispatchNotebookVisibilityChanged(notebookId)
}

export async function replaceNotebookVisibility(
  notebookId: string,
  documentIds: string[],
): Promise<void> {
  await invoke('documents_replace_notebook_visibility', { notebookId, documentIds })
  dispatchNotebookVisibilityChanged(notebookId)
}

// Disparado após qualquer escrita na visibilidade de um caderno, para que
// outras telas que mostram a mesma seleção recarreguem (detail.notebookId).
export const NOTEBOOK_VISIBILITY_CHANGED_EVENT = 'monet:notebook-visibility-changed'

function dispatchNotebookVisibilityChanged(notebookId: string) {
  window.dispatchEvent(
    new CustomEvent(NOTEBOOK_VISIBILITY_CHANGED_EVENT, { detail: { notebookId } }),
  )
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

export async function pickDocumentFolder(): Promise<string | null> {
  const result = await invoke<string | null>('documents_pick_folder')
  return result ?? null
}

export async function documentsAddWatchedFolder(folderPath: string): Promise<string> {
  return invoke<string>('documents_add_watched_folder', { folderPath })
}

export async function documentsEnsureAiFolder(chatFolderId: string, folderName: string): Promise<string> {
  return invoke<string>('documents_ensure_ai_folder', { chatFolderId, folderName })
}

export async function documentsWriteAiSourceFile(
  folderId: string,
  filename: string,
  content: string,
): Promise<void> {
  await invoke('documents_write_ai_source_file', { folderId, filename, content })
}

export async function documentsScanWatchedFolder(folderId: string): Promise<void> {
  await invoke('documents_scan_watched_folder', { folderId })
}

export async function documentsDeleteWatchedFolder(folderId: string): Promise<void> {
  await invoke('documents_delete_watched_folder', { folderId })
}

export function onDocumentStatus(
  handler: (event: DocumentStatusEvent) => void,
): Promise<UnlistenFn> {
  return listen<DocumentStatusEvent>('documents://status', (e) => handler(e.payload))
}

// Disparado quando a pasta de notas de um caderno é removida ou o toggle muda
// (o backend não emite documents://status nesses casos).
export const NOTES_INDEX_CHANGED_EVENT = 'monet:notes-index-changed'

export function notesFolderDocId(notebookId: string): string {
  return `notes-folder:${notebookId}`
}

export function noteDocId(noteId: string): string {
  return `note:${noteId}`
}

export type NotesIndexUpsertResult = 'disabled' | 'removed' | 'no_key' | 'unchanged' | 'moved' | 'indexed'

export interface NotesIndexState {
  notebookIds: string[]
  notes: { noteId: string; notebookId: string; status: string }[]
}

export async function notesIndexUpsert(args: {
  notebookId: string
  notebookName: string
  noteId: string
  title: string
  fileText: string
}): Promise<NotesIndexUpsertResult> {
  return invoke<NotesIndexUpsertResult>('notes_index_upsert', args)
}

export async function notesIndexDelete(noteId: string): Promise<void> {
  await invoke('notes_index_delete', { noteId })
}

export async function notesIndexRemoveNotebook(notebookId: string): Promise<void> {
  await invoke('notes_index_remove_notebook', { notebookId })
}

export async function notesIndexSetNotebookEnabled(notebookId: string, enabled: boolean): Promise<void> {
  await invoke('notes_index_set_notebook_enabled', { notebookId, enabled })
}

export async function notesIndexGetDisabledNotebooks(): Promise<string[]> {
  return invoke<string[]>('notes_index_get_disabled_notebooks')
}

export async function notesIndexListState(): Promise<NotesIndexState> {
  return invoke<NotesIndexState>('notes_index_list_state')
}

// Expande ids de visibilidade (arquivos e pastas) para os ids de arquivo
// pesquisáveis. Pastas viram seus filhos `available` atuais; ids que não
// existem mais em `documents` são ignorados. Com `notebookId`, inclui a pasta
// de notas do caderno (se existir); `excludeNoteId` tira a cópia indexada
// daquela nota. Pastas `origin === 'ai'` só expandem com `includeAiFolders`.
export async function resolveSearchableIds(
  rawIds: string[],
  opts: {
    notebookId?: string | null
    excludeNoteId?: string | null
    includeAiFolders: boolean
  },
): Promise<string[]> {
  const allDocs = await documentsListGlobal()
  const docById = new Map(allDocs.map((d) => [d.id, d]))
  const ids = new Set(rawIds)
  if (opts.notebookId && docById.has(notesFolderDocId(opts.notebookId))) {
    ids.add(notesFolderDocId(opts.notebookId))
  }
  const expanded = new Set<string>()
  for (const id of ids) {
    const doc = docById.get(id)
    if (!doc) continue
    if (doc.docType === 'folder') {
      if (doc.origin === 'ai' && !opts.includeAiFolders) continue
      for (const child of allDocs) {
        if (child.parentFolderId === id && child.docType === 'file' && child.status === 'available') {
          expanded.add(child.id)
        }
      }
    } else if (doc.status === 'available') {
      expanded.add(id)
    }
  }
  if (opts.excludeNoteId) expanded.delete(noteDocId(opts.excludeNoteId))
  return Array.from(expanded)
}
