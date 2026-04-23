import Database from '@tauri-apps/plugin-sql'
import type { Note, Notebook, RagChunk } from '../types'
import type { StorageAdapter } from './index'

const DB_URL = 'sqlite:monet.db'

interface NotebookRow {
  id: string
  name: string
  created_at: number
  updated_at: number
}

interface NoteRow {
  id: string
  notebook_id: string | null
  title: string
  content: string
  tags: string
  created_at: number
  updated_at: number
}

interface ChunkRow {
  id: string
  note_id: string | null
  source_name: string
  content: string
  embedding: string
  chunk_index: number
}

function rowToNotebook(r: NotebookRow): Notebook {
  return { id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at }
}

function rowToNote(r: NoteRow): Note {
  let tags: string[] = []
  try {
    const parsed = JSON.parse(r.tags)
    if (Array.isArray(parsed)) tags = parsed
  } catch {
    tags = []
  }
  return {
    id: r.id,
    notebookId: r.notebook_id,
    title: r.title,
    content: r.content,
    tags,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToChunk(r: ChunkRow): RagChunk {
  let arr: number[] = []
  try {
    const parsed = JSON.parse(r.embedding)
    if (Array.isArray(parsed)) arr = parsed
  } catch {
    arr = []
  }
  return {
    id: r.id,
    noteId: r.note_id,
    sourceName: r.source_name,
    content: r.content,
    embedding: Float32Array.from(arr),
    chunkIndex: r.chunk_index,
  }
}

function cosine(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export class TauriStorage implements StorageAdapter {
  private dbPromise?: Promise<Database>

  private db(): Promise<Database> {
    if (!this.dbPromise) this.dbPromise = Database.load(DB_URL)
    return this.dbPromise
  }

  async getNotebooks(): Promise<Notebook[]> {
    const db = await this.db()
    const rows = await db.select<NotebookRow[]>(
      'SELECT * FROM notebooks ORDER BY updated_at DESC'
    )
    return rows.map(rowToNotebook)
  }

  async saveNotebook(nb: Notebook): Promise<void> {
    const db = await this.db()
    await db.execute(
      `INSERT INTO notebooks (id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         updated_at = excluded.updated_at`,
      [nb.id, nb.name, nb.createdAt, nb.updatedAt]
    )
  }

  async deleteNotebook(id: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM notebooks WHERE id = $1', [id])
  }

  async getNotes(): Promise<Note[]> {
    const db = await this.db()
    const rows = await db.select<NoteRow[]>(
      'SELECT * FROM notes ORDER BY updated_at DESC'
    )
    return rows.map(rowToNote)
  }

  async getNote(id: string): Promise<Note | null> {
    const db = await this.db()
    const rows = await db.select<NoteRow[]>(
      'SELECT * FROM notes WHERE id = $1 LIMIT 1',
      [id]
    )
    return rows[0] ? rowToNote(rows[0]) : null
  }

  async saveNote(n: Note): Promise<void> {
    const db = await this.db()
    await db.execute(
      `INSERT INTO notes (id, notebook_id, title, content, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(id) DO UPDATE SET
         notebook_id = excluded.notebook_id,
         title = excluded.title,
         content = excluded.content,
         tags = excluded.tags,
         updated_at = excluded.updated_at`,
      [
        n.id,
        n.notebookId,
        n.title,
        n.content,
        JSON.stringify(n.tags),
        n.createdAt,
        n.updatedAt,
      ]
    )
  }

  async deleteNote(id: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM notes WHERE id = $1', [id])
  }

  async searchNotes(query: string): Promise<Note[]> {
    const db = await this.db()
    const q = `%${query.trim().toLowerCase()}%`
    const rows = await db.select<NoteRow[]>(
      `SELECT * FROM notes
        WHERE LOWER(title) LIKE $1
           OR LOWER(content) LIKE $1
           OR LOWER(tags) LIKE $1
        ORDER BY updated_at DESC`,
      [q]
    )
    return rows.map(rowToNote)
  }

  async saveChunks(chunks: RagChunk[]): Promise<void> {
    const db = await this.db()
    for (const c of chunks) {
      const embedding = JSON.stringify(Array.from(c.embedding))
      await db.execute(
        `INSERT INTO rag_chunks (id, note_id, source_name, content, embedding, chunk_index)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(id) DO UPDATE SET
           note_id = excluded.note_id,
           source_name = excluded.source_name,
           content = excluded.content,
           embedding = excluded.embedding,
           chunk_index = excluded.chunk_index`,
        [c.id, c.noteId, c.sourceName, c.content, embedding, c.chunkIndex]
      )
    }
  }

  async searchChunks(embedding: Float32Array, topK: number): Promise<RagChunk[]> {
    const db = await this.db()
    const rows = await db.select<ChunkRow[]>('SELECT * FROM rag_chunks')
    const chunks = rows.map(rowToChunk)
    const scored = chunks.map((c) => ({ c, score: cosine(embedding, c.embedding) }))
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK).map(({ c }) => c)
  }

  async deleteChunks(noteId: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM rag_chunks WHERE note_id = $1', [noteId])
  }

  async exportMarkdown(_note: Note): Promise<void> {
    throw new Error('TauriStorage.exportMarkdown not implemented')
  }

  async importFile(_accept: string): Promise<{ name: string; content: string }> {
    throw new Error('TauriStorage.importFile not implemented')
  }
}
