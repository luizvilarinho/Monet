import type { Note, RagChunk } from '../types'
import type { StorageAdapter } from './index'

export class TauriStorage implements StorageAdapter {
  async getNotes(): Promise<Note[]> {
    throw new Error('TauriStorage.getNotes not implemented')
  }
  async getNote(_id: string): Promise<Note | null> {
    throw new Error('TauriStorage.getNote not implemented')
  }
  async saveNote(_note: Note): Promise<void> {
    throw new Error('TauriStorage.saveNote not implemented')
  }
  async deleteNote(_id: string): Promise<void> {
    throw new Error('TauriStorage.deleteNote not implemented')
  }
  async searchNotes(_query: string): Promise<Note[]> {
    throw new Error('TauriStorage.searchNotes not implemented')
  }
  async saveChunks(_chunks: RagChunk[]): Promise<void> {
    throw new Error('TauriStorage.saveChunks not implemented')
  }
  async searchChunks(_embedding: Float32Array, _topK: number): Promise<RagChunk[]> {
    throw new Error('TauriStorage.searchChunks not implemented')
  }
  async deleteChunks(_noteId: string): Promise<void> {
    throw new Error('TauriStorage.deleteChunks not implemented')
  }
  async exportMarkdown(_note: Note): Promise<void> {
    throw new Error('TauriStorage.exportMarkdown not implemented')
  }
  async importFile(_accept: string): Promise<{ name: string; content: string }> {
    throw new Error('TauriStorage.importFile not implemented')
  }
}
