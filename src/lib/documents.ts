import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Document, DocumentStatus } from '../types'
import { normalizeName } from './tasks'

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

// Arquivos fora da versão atual do índice (ou em erro). As notas se
// reindexam sozinhas; os demais esperam o "Update index".
export interface IndexOutdatedCount {
  files: number
  notes: number
}

export async function documentsIndexOutdatedCount(): Promise<IndexOutdatedCount> {
  return invoke<IndexOutdatedCount>('documents_index_outdated_count')
}

// Dispara a reindexação dos arquivos pendentes (sem as notas) e volta na hora;
// o andamento chega por onReindexProgress. Já rodando, não faz nada.
export async function documentsReindexOutdated(): Promise<void> {
  await invoke('documents_reindex_outdated')
}

export interface ReindexProgressEvent {
  done: number
  total: number
  failed: number
  currentName: string | null
  finished: boolean
}

export function onReindexProgress(
  handler: (event: ReindexProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<ReindexProgressEvent>('documents://reindex-progress', (e) => handler(e.payload))
}

export async function documentsDelete(documentId: string): Promise<void> {
  await invoke('documents_delete', { documentId })
}

interface DocumentRaw extends Omit<Document, 'errorMessage' | 'parentFolderId' | 'lastModifiedMs' | 'originalPath' | 'alias'> {
  originalPath: string | null
  errorMessage: string | null
  parentFolderId: string | null
  lastModifiedMs: number | null
  alias: string | null
}

export async function documentsListGlobal(): Promise<Document[]> {
  const rows = await invoke<DocumentRaw[]>('documents_list_global')
  return rows.map((d) => ({
    ...d,
    originalPath: d.originalPath ?? undefined,
    errorMessage: d.errorMessage ?? undefined,
    parentFolderId: d.parentFolderId ?? undefined,
    lastModifiedMs: d.lastModifiedMs ?? undefined,
    alias: d.alias ?? undefined,
  }))
}

// Vazio ou null remove o apelido. Recusado para pastas de notas.
export async function documentsSetFolderAlias(folderId: string, alias: string | null): Promise<void> {
  await invoke('documents_set_folder_alias', { folderId, alias })
}

// Conjunto de documentos (preset de RAG), global no SQLite: ids de
// visibilidade (arquivos e pastas da KB) aplicáveis a qualquer pasta de chat.
export interface DocumentSet {
  id: string
  name: string
  documentIds: string[]
  createdAt: number
  updatedAt: number
}

export async function documentSetsList(): Promise<DocumentSet[]> {
  return invoke<DocumentSet[]>('document_sets_list')
}

// Sem `id` cria; com `id` regrava nome e ids. Devolve o id do conjunto.
export async function documentSetsSave(id: string | null, name: string, documentIds: string[]): Promise<string> {
  return invoke<string>('document_sets_save', { id, name, documentIds })
}

export async function documentSetsRename(id: string, name: string): Promise<void> {
  await invoke('document_sets_rename', { id, name })
}

export async function documentSetsDelete(id: string): Promise<void> {
  await invoke('document_sets_delete', { id })
}

// Filtro dos modais da KB: nome, apelido ou caminho, sem caixa nem acentos.
export function documentMatchesFilter(doc: Document, query: string): boolean {
  const q = normalizeName(query.trim())
  if (!q) return true
  return [doc.name, doc.alias, doc.originalPath].some((s) => !!s && normalizeName(s).includes(q))
}

// Pastas web (origin='ai') ficam em web-research/<chatFolderId>: o último
// componente do caminho é o id da pasta de chat dona. null se não for pasta web.
export function webFolderChatFolderId(doc: Document): string | null {
  if (doc.docType !== 'folder' || doc.origin !== 'ai' || !doc.originalPath) return null
  return doc.originalPath.split(/[\\/]/).pop() || null
}

// Apaga a pasta web (KB e disco) de uma pasta de chat, se existir.
export async function deleteChatWebFolder(chatFolderId: string): Promise<void> {
  const docs = await documentsListGlobal()
  const webFolder = docs.find((d) => webFolderChatFolderId(d) === chatFolderId)
  if (webFolder) await documentsDeleteWatchedFolder(webFolder.id)
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

export type NotesIndexUpsertResult = 'disabled' | 'removed' | 'no_key' | 'unchanged' | 'indexed'

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
  // `YYYY-MM-DD`, vai no cabeçalho dos chunks.
  noteDate: string | null
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
// pesquisáveis. A regra mora em Rust (`rag::resolve_scope`) para que o golden
// set (`examples/rag_eval.rs`) use o mesmo escopo do app.
export async function resolveSearchableIds(
  rawIds: string[],
  opts: {
    notebookId?: string | null
    excludeNoteId?: string | null
    includeAiFolders: boolean
  },
): Promise<string[]> {
  return invoke<string[]>('documents_resolve_searchable_ids', {
    rawIds,
    notebookId: opts.notebookId ?? null,
    excludeNoteId: opts.excludeNoteId ?? null,
    includeAiFolders: opts.includeAiFolders,
  })
}
