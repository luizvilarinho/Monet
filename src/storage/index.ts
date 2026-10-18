import type {
  AiResponse,
  Book,
  BookHighlight,
  BookQuote,
  MetadataDef,
  Note,
  Notebook,
  NoteSummary,
  Subject,
  Task,
  TaskStatusDef,
  TaskView,
} from '../types'
import { TauriStorage } from './tauri'
import { BrowserStorage } from './browser'

export interface StorageAdapter {
  getNotebooks(): Promise<Notebook[]>
  saveNotebook(notebook: Notebook): Promise<void>
  deleteNotebook(id: string): Promise<void>
  setNotebookColor(id: string, color: string | null): Promise<void>

  getSubjects(notebookId: string): Promise<Subject[]>
  saveSubject(subject: Subject): Promise<void>
  deleteSubject(id: string): Promise<void>
  deleteSubjectsByNotebook(notebookId: string): Promise<void>

  getNotes(): Promise<Note[]>
  getNote(id: string): Promise<Note | null>
  saveNote(note: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  searchNotes(query: string): Promise<Note[]>
  // Notas com `date` no período (YYYY-MM-DD, inclusivo) e as do Calendar cujo
  // título é uma data no período.
  getNotesByDateRange(from: string, to: string): Promise<Note[]>
  getNoteSummaries(): Promise<NoteSummary[]>

  getBooks(): Promise<Book[]>
  saveBook(book: Book): Promise<void>
  deleteBook(id: string): Promise<void>

  getHighlights(bookId: string): Promise<BookHighlight[]>
  saveHighlight(highlight: BookHighlight): Promise<void>
  deleteHighlight(id: string): Promise<void>
  deleteHighlightsByBook(bookId: string): Promise<void>

  saveQuote(quote: BookQuote): Promise<void>
  deleteQuotesByBook(bookId: string): Promise<void>

  getFiredReminderIds(noteId: string): Promise<string[]>
  markRemindersFired(ids: string[], noteId: string): Promise<void>

  getTasks(): Promise<Task[]>
  saveTask(task: Task): Promise<void>
  deleteTask(id: string): Promise<void>

  getTaskStatuses(): Promise<TaskStatusDef[]>
  saveTaskStatus(status: TaskStatusDef): Promise<void>
  deleteTaskStatus(id: string): Promise<void>
  getTaskViews(): Promise<TaskView[]>
  saveTaskView(view: TaskView): Promise<void>
  deleteTaskView(id: string): Promise<void>
  getMetadataDefs(): Promise<MetadataDef[]>
  saveMetadataDef(def: MetadataDef): Promise<void>
  deleteMetadataDef(id: string): Promise<void>

  getResponses(noteId: string): Promise<AiResponse[]>
  getResponsesByIds(ids: string[]): Promise<AiResponse[]>
  saveResponse(response: AiResponse): Promise<void>
  deleteResponse(id: string): Promise<void>
  deleteResponses(noteId: string): Promise<void>

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
