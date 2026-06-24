import Database from '@tauri-apps/plugin-sql'
import type {
  AiResponse,
  AiResponseStatus,
  AiSource,
  DocumentStatus,
  Note,
  Notebook,
  Subject,
} from '../types'
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
  subject_id: string | null
  title: string
  content: string
  tags: string
  date: string | null
  created_at: number
  updated_at: number
}

interface SubjectRow {
  id: string
  notebook_id: string
  name: string
  sort_order: number
  created_at: number
  updated_at: number
}


interface AiResponseRow {
  id: string
  note_id: string | null
  command: string
  query: string
  model: string
  response: string
  status: string
  created_at: number
  command_id: string | null
  sources: string | null
}

function normalizeStatus(s: string): AiResponseStatus {
  if (s === 'streaming' || s === 'completed' || s === 'interrupted' || s === 'error') {
    return s
  }
  return 'completed'
}

function parseSources(raw: string | null): AiSource[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    const valid: AiSource[] = []
    for (const item of parsed) {
      if (
        item &&
        typeof item.documentId === 'string' &&
        typeof item.documentName === 'string' &&
        typeof item.chunkIndex === 'number' &&
        typeof item.snippet === 'string'
      ) {
        valid.push(item)
      }
    }
    return valid.length > 0 ? valid : undefined
  } catch {
    return undefined
  }
}

function rowToResponse(r: AiResponseRow): AiResponse {
  return {
    id: r.id,
    noteId: r.note_id,
    command: r.command,
    query: r.query,
    model: r.model ?? '',
    response: r.response,
    status: normalizeStatus(r.status ?? 'completed'),
    createdAt: r.created_at,
    commandId: r.command_id ?? null,
    sources: parseSources(r.sources),
  }
}

function rowToNotebook(r: NotebookRow): Notebook {
  return { id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at }
}

function rowToNote(r: NoteRow): Note {
  let tags: string[] = []
  try {
    const parsed = JSON.parse(r.tags)
    if (
      Array.isArray(parsed) &&
      parsed.every((t): t is string => typeof t === 'string')
    ) {
      tags = parsed
    }
  } catch {
    tags = []
  }
  return {
    id: r.id,
    notebookId: r.notebook_id,
    subjectId: r.subject_id ?? null,
    title: r.title,
    content: r.content,
    tags,
    date: r.date ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToSubject(r: SubjectRow): Subject {
  return {
    id: r.id,
    notebookId: r.notebook_id,
    name: r.name,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}


// O banco roda em modo WAL (default do SQLite). Com o pool de múltiplas
// conexões do tauri-plugin-sql, o autocheckpoint PASSIVE quase nunca
// completa (sempre há um leitor segurando o lock), então o WAL cresce e o
// monet.db principal nunca é atualizado. Se o processo é encerrado sem
// checkpoint (ex. "Sair" na bandeja → app.exit(0)), a próxima abertura pode
// voltar a ver só o monet.db congelado e as notas "somem".
//
// Solução em duas frentes:
//  1. Um checkpoint no startup (logo após Database.load) drena qualquer WAL
//     acumulado de sessões anteriores para o monet.db — recupera dados presos
//     no WAL e zera o seu crescimento.
//  2. Após cada escrita, um PRAGMA wal_checkpoint(TRUNCATE) throttled mantém o
//     monet.db sempre atualizado, independente de como o processo é encerrado.
// O checkpoint convive com leitores em WAL (não exige lock exclusivo, ao
// contrário de trocar journal_mode, que falhava com SQLITE_BUSY) e nunca
// rejeita o dbPromise: uma falha é apenas logada.
const CHECKPOINT_INTERVAL_MS = 1500

export class TauriStorage implements StorageAdapter {
  private dbPromise?: Promise<Database>
  private checkpointTimer?: ReturnType<typeof setTimeout>
  private lastCheckpoint = 0

  private db(): Promise<Database> {
    if (!this.dbPromise) {
      const p = this.load()
      this.dbPromise = p
      // Nunca cacheia uma rejeição: se a carga falhar, limpa o cache para que a
      // próxima chamada tente de novo (senão um único erro transitório quebraria
      // todos os save/load da sessão até um reload da página).
      p.catch(() => {
        if (this.dbPromise === p) this.dbPromise = undefined
      })
    }
    return this.dbPromise
  }

  private async load(): Promise<Database> {
    // O backend (documents.rs) abre o MESMO monet.db via rusqlite no startup
    // (scan de watched folders). Enquanto esse lock existe, as migrations do
    // tauri-plugin-sql podem falhar com "database is locked" e rejeitar o
    // Database.load. O lock é transitório, então tentamos algumas vezes antes
    // de desistir — é o que torna o cold start confiável (antes só funcionava
    // após um F5, que recriava o load depois do scan terminar).
    const MAX_ATTEMPTS = 15
    const RETRY_DELAY_MS = 200
    let lastErr: unknown
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const db = await Database.load(DB_URL)
        // Drena o WAL acumulado para o monet.db logo na abertura. Nunca derruba
        // a carga (uma falha de checkpoint é só logada).
        try {
          await db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        } catch (err) {
          console.error('initial wal_checkpoint failed', err)
        }
        return db
      } catch (err) {
        lastErr = err
        console.error(`Database.load falhou (tentativa ${attempt}/${MAX_ATTEMPTS})`, err)
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        }
      }
    }
    throw lastErr
  }

  // Throttle: roda no máximo 1×/CHECKPOINT_INTERVAL_MS. Dispara na borda de
  // subida (primeira escrita após o intervalo) e agenda uma execução de
  // saída (garante que a última escrita de uma rajada seja persistida).
  // Não é awaited pelos saves — uma falha de checkpoint nunca quebra a escrita.
  private scheduleCheckpoint(): void {
    const elapsed = Date.now() - this.lastCheckpoint
    if (elapsed >= CHECKPOINT_INTERVAL_MS) {
      void this.checkpoint()
    } else if (!this.checkpointTimer) {
      this.checkpointTimer = setTimeout(() => {
        this.checkpointTimer = undefined
        void this.checkpoint()
      }, CHECKPOINT_INTERVAL_MS - elapsed)
    }
  }

  private async checkpoint(): Promise<void> {
    this.lastCheckpoint = Date.now()
    try {
      const db = await this.db()
      await db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch (err) {
      console.error('wal_checkpoint failed', err)
    }
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
    this.scheduleCheckpoint()
  }

  async deleteNotebook(id: string): Promise<void> {
    const db = await this.db()
    await db.execute(
      'DELETE FROM ai_responses WHERE note_id IN (SELECT id FROM notes WHERE notebook_id = $1)',
      [id]
    )
    await db.execute('DELETE FROM notes WHERE notebook_id = $1', [id])
    await db.execute('DELETE FROM subjects WHERE notebook_id = $1', [id])
    await db.execute('DELETE FROM notebooks WHERE id = $1', [id])
    this.scheduleCheckpoint()
  }

  async getSubjects(notebookId: string): Promise<Subject[]> {
    const db = await this.db()
    const rows = await db.select<SubjectRow[]>(
      'SELECT * FROM subjects WHERE notebook_id = $1 ORDER BY sort_order ASC',
      [notebookId]
    )
    return rows.map(rowToSubject)
  }

  async saveSubject(s: Subject): Promise<void> {
    const db = await this.db()
    await db.execute(
      `INSERT INTO subjects (id, notebook_id, name, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
      [s.id, s.notebookId, s.name, s.sortOrder, s.createdAt, s.updatedAt]
    )
    this.scheduleCheckpoint()
  }

  async deleteSubject(id: string): Promise<void> {
    const db = await this.db()
    await db.execute('BEGIN')
    try {
      await db.execute(
        'DELETE FROM ai_responses WHERE note_id IN (SELECT id FROM notes WHERE subject_id = $1)',
        [id]
      )
      await db.execute('DELETE FROM notes WHERE subject_id = $1', [id])
      await db.execute('DELETE FROM subjects WHERE id = $1', [id])
      await db.execute('COMMIT')
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }
    this.scheduleCheckpoint()
  }

  async deleteSubjectsByNotebook(notebookId: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM subjects WHERE notebook_id = $1', [notebookId])
    this.scheduleCheckpoint()
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
      `INSERT INTO notes (id, notebook_id, subject_id, title, content, tags, date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(id) DO UPDATE SET
         notebook_id = excluded.notebook_id,
         subject_id = excluded.subject_id,
         title = excluded.title,
         content = excluded.content,
         tags = excluded.tags,
         date = excluded.date,
         updated_at = excluded.updated_at`,
      [
        n.id,
        n.notebookId,
        n.subjectId ?? null,
        n.title,
        n.content,
        JSON.stringify(n.tags),
        n.date ?? null,
        n.createdAt,
        n.updatedAt,
      ]
    )
    this.scheduleCheckpoint()
  }

  async deleteNote(id: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM notes WHERE id = $1', [id])
    this.scheduleCheckpoint()
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

  async updateDocumentStatus(
    id: string,
    status: DocumentStatus,
    errorMessage?: string | null,
  ): Promise<void> {
    const db = await this.db()
    await db.execute(
      `UPDATE documents
          SET status = $1,
              error_message = $2,
              updated_at = $3
        WHERE id = $4`,
      [status, errorMessage ?? null, Date.now(), id],
    )
    this.scheduleCheckpoint()
  }

  async getResponses(noteId: string): Promise<AiResponse[]> {
    const db = await this.db()
    const rows = await db.select<AiResponseRow[]>(
      'SELECT * FROM ai_responses WHERE note_id = $1 ORDER BY created_at DESC',
      [noteId]
    )
    return rows.map(rowToResponse)
  }

  async saveResponse(r: AiResponse): Promise<void> {
    const db = await this.db()
    const sourcesJson = r.sources && r.sources.length > 0 ? JSON.stringify(r.sources) : null
    await db.execute(
      `INSERT INTO ai_responses (id, note_id, command, query, model, response, status, created_at, command_id, sources)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(id) DO UPDATE SET
         note_id = excluded.note_id,
         command = excluded.command,
         query = excluded.query,
         model = excluded.model,
         response = excluded.response,
         status = excluded.status,
         command_id = excluded.command_id,
         sources = excluded.sources`,
      [
        r.id,
        r.noteId,
        r.command,
        r.query,
        r.model,
        r.response,
        r.status,
        r.createdAt,
        r.commandId ?? null,
        sourcesJson,
      ]
    )
    this.scheduleCheckpoint()
  }

  async deleteResponse(id: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM ai_responses WHERE id = $1', [id])
    this.scheduleCheckpoint()
  }

  async deleteResponses(noteId: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM ai_responses WHERE note_id = $1', [noteId])
    this.scheduleCheckpoint()
  }

  async exportMarkdown(_note: Note): Promise<void> {
    throw new Error('TauriStorage.exportMarkdown not implemented')
  }

  async importFile(_accept: string): Promise<{ name: string; content: string }> {
    throw new Error('TauriStorage.importFile not implemented')
  }
}
