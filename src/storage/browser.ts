import type { AiResponse, DocumentStatus, Note, Notebook } from '../types'
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
