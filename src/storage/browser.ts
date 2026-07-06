import type {
  AiResponse,
  Book,
  BookHighlight,
  BookQuote,
  DocumentStatus,
  Note,
  Notebook,
  Subject,
} from '../types'
import type { StorageAdapter } from './index'

export class BrowserStorage implements StorageAdapter {
  async getNotebooks(): Promise<Notebook[]> {
    throw new Error('BrowserStorage.getNotebooks not implemented')
  }
  async saveNotebook(_notebook: Notebook): Promise<void> {
    throw new Error('BrowserStorage.saveNotebook not implemented')
  }
  async deleteNotebook(_id: string): Promise<void> {
    throw new Error('BrowserStorage.deleteNotebook not implemented')
  }
  async getSubjects(_notebookId: string): Promise<Subject[]> {
    throw new Error('BrowserStorage.getSubjects not implemented')
  }
  async saveSubject(_subject: Subject): Promise<void> {
    throw new Error('BrowserStorage.saveSubject not implemented')
  }
  async deleteSubject(_id: string): Promise<void> {
    throw new Error('BrowserStorage.deleteSubject not implemented')
  }
  async deleteSubjectsByNotebook(_notebookId: string): Promise<void> {
    throw new Error('BrowserStorage.deleteSubjectsByNotebook not implemented')
  }
  async getNotes(): Promise<Note[]> {
    throw new Error('BrowserStorage.getNotes not implemented')
  }
  async getNote(_id: string): Promise<Note | null> {
    throw new Error('BrowserStorage.getNote not implemented')
  }
  async saveNote(_note: Note): Promise<void> {
    throw new Error('BrowserStorage.saveNote not implemented')
  }
  async deleteNote(_id: string): Promise<void> {
    throw new Error('BrowserStorage.deleteNote not implemented')
  }
  async searchNotes(_query: string): Promise<Note[]> {
    throw new Error('BrowserStorage.searchNotes not implemented')
  }
  async getBooks(): Promise<Book[]> {
    throw new Error('BrowserStorage.getBooks not implemented')
  }
  async saveBook(_book: Book): Promise<void> {
    throw new Error('BrowserStorage.saveBook not implemented')
  }
  async deleteBook(_id: string): Promise<void> {
    throw new Error('BrowserStorage.deleteBook not implemented')
  }
  async getHighlights(_bookId: string): Promise<BookHighlight[]> {
    throw new Error('BrowserStorage.getHighlights not implemented')
  }
  async saveHighlight(_highlight: BookHighlight): Promise<void> {
    throw new Error('BrowserStorage.saveHighlight not implemented')
  }
  async deleteHighlight(_id: string): Promise<void> {
    throw new Error('BrowserStorage.deleteHighlight not implemented')
  }
  async deleteHighlightsByBook(_bookId: string): Promise<void> {
    throw new Error('BrowserStorage.deleteHighlightsByBook not implemented')
  }
  async saveQuote(_quote: BookQuote): Promise<void> {
    throw new Error('BrowserStorage.saveQuote not implemented')
  }
  async deleteQuotesByBook(_bookId: string): Promise<void> {
    throw new Error('BrowserStorage.deleteQuotesByBook not implemented')
  }
  // Estado de lembretes em localStorage (paridade de interface; o app em
  // browser não dispara notificações).
  private firedKey(noteId: string): string {
    return `monet:reminders-fired:${noteId}`
  }

  async getFiredReminderIds(noteId: string): Promise<string[]> {
    try {
      const raw = localStorage.getItem(this.firedKey(noteId))
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : []
    } catch {
      return []
    }
  }

  async markRemindersFired(ids: string[], noteId: string): Promise<void> {
    if (ids.length === 0) return
    const current = await this.getFiredReminderIds(noteId)
    const next = Array.from(new Set([...current, ...ids]))
    localStorage.setItem(this.firedKey(noteId), JSON.stringify(next))
  }

  async getResponses(_noteId: string): Promise<AiResponse[]> {
    throw new Error('BrowserStorage.getResponses not implemented')
  }
  async saveResponse(_response: AiResponse): Promise<void> {
    throw new Error('BrowserStorage.saveResponse not implemented')
  }
  async deleteResponse(_id: string): Promise<void> {
    throw new Error('BrowserStorage.deleteResponse not implemented')
  }
  async deleteResponses(_noteId: string): Promise<void> {
    throw new Error('BrowserStorage.deleteResponses not implemented')
  }
  async updateDocumentStatus(
    _id: string,
    _status: DocumentStatus,
    _errorMessage?: string | null,
  ): Promise<void> {
    throw new Error('BrowserStorage.updateDocumentStatus not implemented')
  }
  async exportMarkdown(_note: Note): Promise<void> {
    throw new Error('BrowserStorage.exportMarkdown not implemented')
  }
  async importFile(_accept: string): Promise<{ name: string; content: string }> {
    throw new Error('BrowserStorage.importFile not implemented')
  }
}
