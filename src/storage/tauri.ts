import Database from '@tauri-apps/plugin-sql'
import type {
  AiResponse,
  AiResponseStatus,
  AiSource,
  Book,
  BookHighlight,
  BookHighlightRect,
  BookQuote,
  MetadataDef,
  MetadataType,
  MetadataValue,
  Note,
  Notebook,
  Subject,
  Task,
  TaskRecurrence,
  TaskStatus,
  TaskStatusDef,
  TaskView,
  TaskViewConfig,
} from '../types'
import { BUILTIN_STATUS_DEFS } from '../lib/tasks'
import type { StorageAdapter } from './index'

const DB_URL = 'sqlite:monet.db'

interface NotebookRow {
  id: string
  name: string
  created_at: number
  updated_at: number
  // Coluna `color` adicionada por ensureNotebookColorColumn (nula em linhas antigas).
  color?: string | null
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


interface BookRow {
  id: string
  title: string
  author: string | null
  file_path: string
  total_pages: number
  last_page: number
  added_at: number
  last_opened_at: number | null
  zoom: number | null
  // Colunas da v16 (EPUB). Nulas em livros gravados antes da migration.
  format: string | null
  cfi: string | null
  locations_json: string | null
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
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    color: r.color ?? null,
  }
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

// Limites de zoom espelhados do Reader (src/components/Reader/Reader.tsx).
// O frontend é dono da tabela `books`; o storage apenas garante que valores
// inválidos vindos do banco (NULL, NaN, fora do range) caiam em algo
// utilizável ao abrir o livro.
const BOOK_MIN_ZOOM = 0.5
const BOOK_MAX_ZOOM = 3

function clampZoom(z: number | null | undefined): number {
  if (z == null || !Number.isFinite(z)) return 1
  return Math.min(Math.max(BOOK_MIN_ZOOM, z), BOOK_MAX_ZOOM)
}

function rowToBook(r: BookRow): Book {
  const common = {
    id: r.id,
    title: r.title,
    author: r.author,
    filePath: r.file_path,
    totalPages: r.total_pages,
    // Clamp defensivo: dados inconsistentes (last_page fora de 1..total_pages)
    // são corrigidos na leitura.
    lastPage: Math.min(Math.max(1, r.last_page), r.total_pages),
    addedAt: r.added_at,
    lastOpenedAt: r.last_opened_at,
    zoom: clampZoom(r.zoom),
  }
  if (r.format === 'epub') {
    return {
      ...common,
      format: 'epub',
      cfi: r.cfi ?? null,
      locationsJson: r.locations_json ?? null,
    }
  }
  // Qualquer outro valor — inclusive NULL/ausente em livros anteriores à v16
  // — é PDF: é o DEFAULT da migration e o único formato que existia antes.
  return { ...common, format: 'pdf' }
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

interface BookHighlightRow {
  id: string
  book_id: string
  page: number
  text: string
  color: string
  rects_json: string
  cfi: string | null
  created_at: number
}

function parseHighlightRects(raw: string): BookHighlightRect[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid: BookHighlightRect[] = []
    for (const item of parsed) {
      if (
        item &&
        typeof item.x === 'number' &&
        typeof item.y === 'number' &&
        typeof item.w === 'number' &&
        typeof item.h === 'number' &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y) &&
        Number.isFinite(item.w) &&
        Number.isFinite(item.h) &&
        item.w > 0 &&
        item.h > 0
      ) {
        valid.push({
          x: Math.min(Math.max(0, item.x), 1),
          y: Math.min(Math.max(0, item.y), 1),
          w: Math.min(Math.max(0, item.w), 1),
          h: Math.min(Math.max(0, item.h), 1),
        })
      }
    }
    return valid
  } catch {
    return []
  }
}

function rowToHighlight(r: BookHighlightRow): BookHighlight {
  return {
    id: r.id,
    bookId: r.book_id,
    page: r.page,
    text: r.text,
    color: r.color,
    rects: parseHighlightRects(r.rects_json),
    cfi: r.cfi ?? null,
    createdAt: r.created_at,
  }
}


interface TaskRow {
  id: string
  title: string
  status: string
  notebook_id: string
  note_id: string | null
  due_date: string | null
  scheduled_date: string | null
  task_group: string | null
  important: number | null
  recurrence: string | null
  recurrence_next_id: string | null
  created_at: number
  updated_at: number
  completed_at: number | null
  source_note_id: string | null
  reschedule_count: number
  sort_order: number
  doing_since: number | null
  planned_day: string | null
  metadata: string | null
}

interface MetadataDefRow {
  id: string
  name: string
  type: string
  sort_order: number
  created_at: number
}

interface TaskStatusRow {
  id: string
  name: string
  color: string | null
  sort_order: number
  wip_limit: number | null
  builtin: number
}

interface TaskViewRow {
  id: string
  name: string
  config: string
  sort_order: number
}

// Qualquer string não vazia é um status válido (built-in ou custom); vazio
// vira 'todo'. Ids desconhecidos não são descartados nem reescritos.
function normalizeTaskStatus(s: string | null): TaskStatus {
  return s && s.trim() ? s : 'todo'
}

function rowToTaskStatus(r: TaskStatusRow): TaskStatusDef {
  return {
    id: r.id,
    name: r.name,
    color: r.color ?? null,
    sortOrder: r.sort_order,
    wipLimit: r.wip_limit ?? null,
    builtin: r.builtin === 1,
  }
}

function rowToTaskView(r: TaskViewRow): TaskView {
  let config: TaskViewConfig = { base: 'list', project: null, summary: null, text: '', groupBy: null }
  try {
    const parsed = JSON.parse(r.config) as Partial<TaskViewConfig>
    config = {
      base: typeof parsed.base === 'string' ? parsed.base : 'list',
      project: typeof parsed.project === 'string' ? parsed.project : null,
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      text: typeof parsed.text === 'string' ? parsed.text : '',
      groupBy: typeof parsed.groupBy === 'string' ? parsed.groupBy : null,
    }
  } catch {
    // config inválida: usa o padrão
  }
  return { id: r.id, name: r.name, config, sortOrder: r.sort_order }
}

// Recorrência gravada como JSON; inválida ou ausente vira null.
function parseRecurrence(raw: string | null): TaskRecurrence | null {
  if (!raw) return null
  try {
    const r = JSON.parse(raw) as TaskRecurrence
    if (r.freq === 'daily') return { freq: 'daily' }
    if (r.freq === 'monthly') {
      return typeof r.day === 'number' ? { freq: 'monthly', day: r.day } : { freq: 'monthly' }
    }
    if (r.freq === 'weekly' && Array.isArray(r.days) && r.days.length > 0) {
      return { freq: 'weekly', days: [...r.days].sort((a, b) => a - b) }
    }
  } catch {
    // ignora
  }
  return null
}

// Metadados gravados como JSON; só aceita objeto com valores primitivos.
function parseMetadata(raw: string | null): Record<string, MetadataValue> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, MetadataValue> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function rowToMetadataDef(r: MetadataDefRow): MetadataDef {
  return {
    id: r.id,
    name: r.name,
    type: r.type as MetadataType,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    status: normalizeTaskStatus(r.status),
    notebookId: r.notebook_id,
    noteId: r.note_id,
    dueDate: r.due_date,
    scheduledDate: r.scheduled_date ?? null,
    group: r.task_group ?? null,
    important: r.important === 1,
    recurrence: parseRecurrence(r.recurrence),
    recurrenceNextId: r.recurrence_next_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
    sourceNoteId: r.source_note_id,
    rescheduleCount: r.reschedule_count ?? 0,
    sortOrder: r.sort_order ?? 0,
    doingSince: r.doing_since ?? null,
    plannedDay: r.planned_day ?? null,
    metadata: parseMetadata(r.metadata),
  }
}

// Mesmo schema da migration v18 (src-tauri/src/lib.rs), sem os DROPs das
// tabelas da v17, um statement por execute.
// A coluna `description` não é mais usada (o corpo da task é a nota-corpo);
// fica no schema para não editar a migration já aplicada.
const TASKS_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS notebook_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    notebook_id TEXT NOT NULL,
    note_id TEXT,
    due_date TEXT,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    source_note_id TEXT,
    reschedule_count INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS idx_notebook_tasks_notebook ON notebook_tasks(notebook_id)',
  'CREATE INDEX IF NOT EXISTS idx_notebook_tasks_source_note ON notebook_tasks(source_note_id)',
  `CREATE TABLE IF NOT EXISTS task_statuses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER NOT NULL,
    wip_limit INTEGER,
    builtin INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS task_views (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS metadata_defs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
]

// Colunas de notebook_tasks posteriores à v18. Entram aqui, e não em
// migrations, porque as migrations não rodam no DB de produção (checksum v11)
// e ALTER TABLE ADD COLUMN não é idempotente: o ensureTasksTables só adiciona
// as que faltam (PRAGMA table_info). Linhas existentes ficam com NULL.
const TASKS_EXTRA_COLUMNS = [
  { name: 'scheduled_date', ddl: 'scheduled_date TEXT' },
  { name: 'task_group', ddl: 'task_group TEXT' },
  { name: 'important', ddl: 'important INTEGER NOT NULL DEFAULT 0' },
  { name: 'recurrence', ddl: 'recurrence TEXT' },
  { name: 'recurrence_next_id', ddl: 'recurrence_next_id TEXT' },
  { name: 'doing_since', ddl: 'doing_since INTEGER' },
  { name: 'planned_day', ddl: 'planned_day TEXT' },
  { name: 'metadata', ddl: 'metadata TEXT' },
]

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
  private tasksTablesReady: Promise<void> | null = null
  private notebookColorReady: Promise<void> | null = null

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

  async setNotebookColor(id: string, color: string | null): Promise<void> {
    const db = await this.db()
    await this.ensureNotebookColorColumn(db)
    await db.execute('UPDATE notebooks SET color = $1 WHERE id = $2', [color, id])
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
    await db.execute(
      'DELETE FROM ai_responses WHERE note_id IN (SELECT id FROM notes WHERE subject_id = $1)',
      [id]
    )
    await db.execute('DELETE FROM notes WHERE subject_id = $1', [id])
    await db.execute('DELETE FROM subjects WHERE id = $1', [id])
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

  // Garante idempotente que reminder_state existe. Ela é criada pela migration
  // v11, mas builds antigos do MSI aplicaram uma v11 diferente
  // (notes_rag_doc_ids) no DB de produção, deixando o sistema de migrations
  // quebrado em upgrades (sqlx aborta por checksum mismatch na 1ª carga; o
  // retry do plugin pula o migrate). Criar a tabela aqui desacopla o runtime
  // do estado de migrations e impede que a keep quebre ao carregar a nota.
  private async ensureReminderStateTable(db: Database): Promise<void> {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS reminder_state (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        fired_at INTEGER NOT NULL
      )`
    )
  }

  // Adiciona `notebooks.color` se faltar; "duplicate column" (outra janela
  // adicionou entre o PRAGMA e o ALTER) conta como sucesso. Memoizado. Só roda
  // ao gravar a cor: a leitura (`SELECT *`) já traz a coluna quando existe, e
  // fica sem DDL no cold start.
  private ensureNotebookColorColumn(db: Database): Promise<void> {
    if (!this.notebookColorReady) {
      const p = (async () => {
        const cols = await db.select<Array<{ name: string }>>('PRAGMA table_info(notebooks)')
        if (cols.some((c) => c.name === 'color')) return
        try {
          await db.execute('ALTER TABLE notebooks ADD COLUMN color TEXT')
        } catch (e) {
          if (!String(e).toLowerCase().includes('duplicate column')) throw e
        }
      })()
      this.notebookColorReady = p
      p.catch(() => {
        if (this.notebookColorReady === p) this.notebookColorReady = null
      })
    }
    return this.notebookColorReady
  }

  // Mesmo motivo do ensureReminderStateTable: não depender do estado das
  // migrations (v18) para as tabelas de tasks existirem. Memoizado; se falhar,
  // zera para tentar de novo na próxima chamada.
  private ensureTasksTables(db: Database): Promise<void> {
    if (!this.tasksTablesReady) {
      const p = (async () => {
        for (const sql of TASKS_TABLES_SQL) await db.execute(sql)
        const cols = await db.select<Array<{ name: string }>>(
          'PRAGMA table_info(notebook_tasks)'
        )
        const existing = new Set(cols.map((c) => c.name))
        for (const col of TASKS_EXTRA_COLUMNS) {
          if (!existing.has(col.name)) {
            try {
              await db.execute(`ALTER TABLE notebook_tasks ADD COLUMN ${col.ddl}`)
            } catch (e) {
              // Outra janela (main/keep) pode ter adicionado a coluna entre o
              // PRAGMA e o ALTER: "duplicate column name" conta como sucesso.
              if (!String(e).toLowerCase().includes('duplicate column')) throw e
            }
          }
        }
        // Seed dos built-ins (ids fixos) e backfill aproximado de doing_since;
        // cada statement é independente e idempotente.
        for (const def of BUILTIN_STATUS_DEFS) {
          await db.execute(
            `INSERT OR IGNORE INTO task_statuses (id, name, color, sort_order, wip_limit, builtin)
             VALUES ($1, $2, NULL, $3, NULL, 1)`,
            [def.id, def.name, def.sortOrder]
          )
        }
        await db.execute(
          "UPDATE notebook_tasks SET doing_since = updated_at WHERE status = 'doing' AND doing_since IS NULL"
        )
      })()
      this.tasksTablesReady = p
      p.catch(() => {
        if (this.tasksTablesReady === p) this.tasksTablesReady = null
      })
    }
    return this.tasksTablesReady
  }

  async getTasks(): Promise<Task[]> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    const rows = await db.select<TaskRow[]>(
      'SELECT * FROM notebook_tasks ORDER BY sort_order ASC'
    )
    return rows.map(rowToTask)
  }

  async saveTask(t: Task): Promise<void> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    await db.execute(
      `INSERT INTO notebook_tasks (id, title, status, notebook_id, note_id, due_date, created_at, updated_at, completed_at, source_note_id, reschedule_count, sort_order, scheduled_date, task_group, important, recurrence, recurrence_next_id, doing_since, planned_day, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         status = excluded.status,
         notebook_id = excluded.notebook_id,
         note_id = excluded.note_id,
         due_date = excluded.due_date,
         updated_at = excluded.updated_at,
         completed_at = excluded.completed_at,
         source_note_id = excluded.source_note_id,
         reschedule_count = excluded.reschedule_count,
         sort_order = excluded.sort_order,
         scheduled_date = excluded.scheduled_date,
         task_group = excluded.task_group,
         important = excluded.important,
         recurrence = excluded.recurrence,
         recurrence_next_id = excluded.recurrence_next_id,
         doing_since = excluded.doing_since,
         planned_day = excluded.planned_day,
         metadata = excluded.metadata`,
      [
        t.id,
        t.title,
        t.status,
        t.notebookId,
        t.noteId,
        t.dueDate,
        t.createdAt,
        t.updatedAt,
        t.completedAt,
        t.sourceNoteId,
        t.rescheduleCount,
        t.sortOrder,
        t.scheduledDate,
        t.group,
        t.important ? 1 : 0,
        t.recurrence ? JSON.stringify(t.recurrence) : null,
        t.recurrenceNextId,
        t.doingSince,
        t.plannedDay,
        Object.keys(t.metadata).length > 0 ? JSON.stringify(t.metadata) : null,
      ]
    )
    this.scheduleCheckpoint()
  }

  async deleteTask(id: string): Promise<void> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    await db.execute('DELETE FROM notebook_tasks WHERE id = $1', [id])
    this.scheduleCheckpoint()
  }

  async getTaskStatuses(): Promise<TaskStatusDef[]> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    const rows = await db.select<TaskStatusRow[]>(
      'SELECT * FROM task_statuses ORDER BY sort_order ASC, id ASC'
    )
    return rows.map(rowToTaskStatus)
  }

  async saveTaskStatus(s: TaskStatusDef): Promise<void> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    await db.execute(
      `INSERT INTO task_statuses (id, name, color, sort_order, wip_limit, builtin)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         color = excluded.color,
         sort_order = excluded.sort_order,
         wip_limit = excluded.wip_limit`,
      [s.id, s.name, s.color, s.sortOrder, s.wipLimit, s.builtin ? 1 : 0]
    )
    this.scheduleCheckpoint()
  }

  // Duas execuções separadas, nesta ordem (sem BEGIN/COMMIT: pool sqlx):
  // falha entre elas é segura, reexecutar é idempotente.
  async deleteTaskStatus(id: string): Promise<void> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    await db.execute("UPDATE notebook_tasks SET status = 'todo' WHERE status = $1", [id])
    await db.execute('DELETE FROM task_statuses WHERE id = $1 AND builtin = 0', [id])
    this.scheduleCheckpoint()
  }

  async getMetadataDefs(): Promise<MetadataDef[]> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    const rows = await db.select<MetadataDefRow[]>(
      'SELECT * FROM metadata_defs ORDER BY sort_order ASC, id ASC'
    )
    return rows.map(rowToMetadataDef)
  }

  async saveMetadataDef(d: MetadataDef): Promise<void> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    await db.execute(
      `INSERT INTO metadata_defs (id, name, type, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         type = excluded.type,
         sort_order = excluded.sort_order`,
      [d.id, d.name, d.type, d.sortOrder, d.createdAt]
    )
    this.scheduleCheckpoint()
  }

  // Duas execuções separadas (sem BEGIN/COMMIT: pool sqlx): tira a chave do
  // JSON das tasks e depois apaga a definição; reexecutar é idempotente.
  async deleteMetadataDef(id: string): Promise<void> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    await db.execute(
      `UPDATE notebook_tasks SET metadata = json_remove(metadata, '$."' || $1 || '"')
       WHERE metadata IS NOT NULL AND json_valid(metadata)`,
      [id]
    )
    await db.execute('DELETE FROM metadata_defs WHERE id = $1', [id])
    this.scheduleCheckpoint()
  }

  async getTaskViews(): Promise<TaskView[]> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    const rows = await db.select<TaskViewRow[]>(
      'SELECT * FROM task_views ORDER BY sort_order ASC, id ASC'
    )
    return rows.map(rowToTaskView)
  }

  async saveTaskView(v: TaskView): Promise<void> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    await db.execute(
      `INSERT INTO task_views (id, name, config, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         config = excluded.config,
         sort_order = excluded.sort_order`,
      [v.id, v.name, JSON.stringify(v.config), v.sortOrder]
    )
    this.scheduleCheckpoint()
  }

  async deleteTaskView(id: string): Promise<void> {
    const db = await this.db()
    await this.ensureTasksTables(db)
    await db.execute('DELETE FROM task_views WHERE id = $1', [id])
    this.scheduleCheckpoint()
  }

  async getBooks(): Promise<Book[]> {
    const db = await this.db()
    const rows = await db.select<BookRow[]>(
      'SELECT * FROM books ORDER BY added_at DESC'
    )
    return rows.map(rowToBook)
  }

  async saveBook(b: Book): Promise<void> {
    const db = await this.db()
    // COALESCE só no `locations_json`: o leitor de EPUB chama saveBook a cada
    // troca de posição e nem sempre carrega o cache de locations junto — sem
    // ele, cada movimento apagaria o cache. O `cfi` continua sobrescrevendo
    // normalmente; ele É a posição que está sendo salva.
    await db.execute(
      `INSERT INTO books (id, title, author, file_path, total_pages, last_page, added_at, last_opened_at, zoom, format, cfi, locations_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         author = excluded.author,
         last_page = excluded.last_page,
         last_opened_at = excluded.last_opened_at,
         zoom = excluded.zoom,
         cfi = excluded.cfi,
         locations_json = COALESCE(excluded.locations_json, locations_json)`,
      [
        b.id,
        b.title,
        b.author,
        b.filePath,
        b.totalPages,
        b.lastPage,
        b.addedAt,
        b.lastOpenedAt,
        clampZoom(b.zoom),
        // `format` fica fora do DO UPDATE: o formato de um livro não muda.
        b.format,
        b.format === 'epub' ? b.cfi : null,
        b.format === 'epub' ? b.locationsJson : null,
      ]
    )
    this.scheduleCheckpoint()
  }

  async deleteBook(id: string): Promise<void> {
    const db = await this.db()
    // Cascata explícita: garante ordem determinística e um scheduleCheckpoint
    // por tabela. A FK ON DELETE CASCADE na v13 é só defesa em profundidade
    // (a migration pode ter sido aplicada parcialmente, ou o WAL pode atrasar).
    await db.execute('DELETE FROM book_highlights WHERE book_id = $1', [id])
    this.scheduleCheckpoint()
    await db.execute('DELETE FROM book_quotes WHERE book_id = $1', [id])
    this.scheduleCheckpoint()
    await db.execute('DELETE FROM books WHERE id = $1', [id])
    this.scheduleCheckpoint()
  }

  async getHighlights(bookId: string): Promise<BookHighlight[]> {
    const db = await this.db()
    const rows = await db.select<BookHighlightRow[]>(
      'SELECT * FROM book_highlights WHERE book_id = $1 ORDER BY page ASC, created_at DESC',
      [bookId]
    )
    return rows.map(rowToHighlight)
  }

  async saveHighlight(h: BookHighlight): Promise<void> {
    const db = await this.db()
    await db.execute(
      `INSERT INTO book_highlights (id, book_id, page, text, color, rects_json, cfi, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(id) DO UPDATE SET
         page = excluded.page,
         text = excluded.text,
         color = excluded.color,
         rects_json = excluded.rects_json,
         cfi = excluded.cfi`,
      [
        h.id,
        h.bookId,
        h.page,
        h.text,
        h.color,
        JSON.stringify(h.rects),
        h.cfi ?? null,
        h.createdAt,
      ]
    )
    this.scheduleCheckpoint()
  }

  async deleteHighlight(id: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM book_highlights WHERE id = $1', [id])
    this.scheduleCheckpoint()
  }

  async deleteHighlightsByBook(bookId: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM book_highlights WHERE book_id = $1', [bookId])
    this.scheduleCheckpoint()
  }

  async saveQuote(q: BookQuote): Promise<void> {
    const db = await this.db()
    await db.execute(
      `INSERT INTO book_quotes (id, book_id, page, text, target_note_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id) DO UPDATE SET
         page = excluded.page,
         text = excluded.text,
         target_note_id = excluded.target_note_id`,
      [q.id, q.bookId, q.page, q.text, q.targetNoteId, q.createdAt]
    )
    this.scheduleCheckpoint()
  }

  async deleteQuotesByBook(bookId: string): Promise<void> {
    const db = await this.db()
    await db.execute('DELETE FROM book_quotes WHERE book_id = $1', [bookId])
    this.scheduleCheckpoint()
  }

  async getFiredReminderIds(noteId: string): Promise<string[]> {
    const db = await this.db()
    await this.ensureReminderStateTable(db)
    const rows = await db.select<{ id: string }[]>(
      'SELECT id FROM reminder_state WHERE note_id = $1',
      [noteId]
    )
    return rows.map((r) => r.id)
  }

  async markRemindersFired(ids: string[], noteId: string): Promise<void> {
    if (ids.length === 0) return
    const db = await this.db()
    await this.ensureReminderStateTable(db)
    const now = Date.now()
    for (const id of ids) {
      await db.execute(
        'INSERT OR IGNORE INTO reminder_state (id, note_id, fired_at) VALUES ($1, $2, $3)',
        [id, noteId, now]
      )
    }
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

  async getResponsesByIds(ids: string[]): Promise<AiResponse[]> {
    if (ids.length === 0) return []
    const db = await this.db()
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const rows = await db.select<AiResponseRow[]>(
      `SELECT * FROM ai_responses WHERE id IN (${placeholders})`,
      ids
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
