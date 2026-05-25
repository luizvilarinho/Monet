import type { AiResponse, DocumentStatus, Note, Notebook, Subject } from '../types'
import { TauriStorage } from './tauri'
import { BrowserStorage } from './browser'

export interface StorageAdapter {
  getNotebooks(): Promise<Notebook[]>
  saveNotebook(notebook: Notebook): Promise<void>
  deleteNotebook(id: string): Promise<void>

  getSubjects(notebookId: string): Promise<Subject[]>
  saveSubject(subject: Subject): Promise<void>
  deleteSubject(id: string): Promise<void>
  deleteSubjectsByNotebook(notebookId: string): Promise<void>

  getNotes(): Promise<Note[]>
  getNote(id: string): Promise<Note | null>
  saveNote(note: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  searchNotes(query: string): Promise<Note[]>

  getResponses(noteId: string): Promise<AiResponse[]>
  saveResponse(response: AiResponse): Promise<void>
  deleteResponse(id: string): Promise<void>
  deleteResponses(noteId: string): Promise<void>

  updateDocumentStatus(
    id: string,
    status: DocumentStatus,
    errorMessage?: string | null,
  ): Promise<void>

  exportMarkdown(note: Note): Promise<void>
  importFile(accept: string): Promise<{ name: string; content: string }>
}

declare global {
  interface Window {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
}

export function createStorage(): StorageAdapter {
  const isTauri =
    typeof window !== 'undefined' &&
    (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined)
  if (isTauri) return new TauriStorage()
  return new BrowserStorage()
}

export const storage = createStorage()
