import type {
  AiResponse,
  Book,
  BookHighlight,
  BookQuote,
  MetadataDef,
  MetadataValue,
  Note,
  Notebook,
  NoteOutline,
  NoteSummary,
  NoteType,
  Subject,
  Task,
  TaskStatusDef,
  TaskView,
  Tracker,
  TrackerMark,
  VocabularyItem,
} from '../types'
import { TauriStorage } from './tauri'
import { BrowserStorage } from './browser'

export interface DailyCleanupResult {
  deleted: Array<{ id: string; title: string }>
  keptLinked: Array<{ id: string; title: string }>
  skippedTitles: string[]
}

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
  // Nota de um caderno pelo título exato (a mais recente, se houver várias).
  findNoteByTitle(notebookId: string, title: string): Promise<Note | null>
  // Limpeza única das notas diárias duplicadas e vazias do Calendar; null =
  // já rodou antes.
  cleanupDuplicateDailyNotes(): Promise<DailyCleanupResult | null>
  saveNote(note: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  // Notas com `date` no período (YYYY-MM-DD, inclusivo) e as do Calendar cujo
  // título é uma data no período.
  getNotesByDateRange(from: string, to: string): Promise<Note[]>
  getNoteSummaries(): Promise<NoteSummary[]>
  // Notas de um caderno sem o conteúdo, editadas mais recentemente primeiro
  // (árvore do roteador do RAG).
  getNotebookNoteOutline(notebookId: string): Promise<NoteOutline[]>
  // Notas com alguma marca de atenção (`<mark data-mark>` no conteúdo): a
  // tool search_marks não carrega o conteúdo de todas as notas.
  getMarkedNotes(): Promise<Note[]>

  getBooks(): Promise<Book[]>
  saveBook(book: Book): Promise<void>
  // Única escrita de `books.language` depois do INSERT (o saveBook não a atualiza);
  // a língua dos itens de vocabulário do livro acompanha.
  setBookLanguage(id: string, language: string | null): Promise<void>
  deleteBook(id: string): Promise<void>

  getHighlights(bookId: string): Promise<BookHighlight[]>
  saveHighlight(highlight: BookHighlight): Promise<void>
  deleteHighlight(id: string): Promise<void>
  deleteHighlightsByBook(bookId: string): Promise<void>

  saveQuote(quote: BookQuote): Promise<void>
  deleteQuotesByBook(bookId: string): Promise<void>

  // Vocabulário por livro (aba Vocabulary), em ordem de criação.
  getBookVocabulary(bookId: string): Promise<VocabularyItem[]>
  // Itens de todos os livros de uma língua base (as marcas no texto, entrega 3).
  getVocabularyByLanguage(language: string): Promise<VocabularyItem[]>
  // INSERT … ON CONFLICT(id) DO UPDATE de todos os campos (guardar, atualizar e restaurar).
  saveVocabularyItem(item: VocabularyItem): Promise<void>
  deleteVocabularyItem(id: string): Promise<void>
  // Marca (ou, com null, desmarca) os itens como enviados a uma nota.
  setVocabularySent(
    ids: string[],
    sent: { at: string; notebookId: string; noteId: string } | null,
  ): Promise<void>

  getFiredReminderIds(noteId: string): Promise<string[]>
  markRemindersFired(ids: string[], noteId: string): Promise<void>

  getTasks(): Promise<Task[]>
  saveTask(task: Task): Promise<void>
  deleteTask(id: string): Promise<void>
  // `task_group` dormente (só a migração group → TODOS lê).
  getLegacyTaskGroups(): Promise<Array<{ taskId: string; notebookId: string; group: string }>>
  // Ids das notas TODOS cujas linhas da migração já foram resolvidas.
  getTodosMigrationDone(): Promise<string[]>
  markTodosMigrationDone(noteIds: string[]): Promise<void>

  getTaskStatuses(): Promise<TaskStatusDef[]>
  saveTaskStatus(status: TaskStatusDef): Promise<void>
  deleteTaskStatus(id: string): Promise<void>
  getTaskViews(): Promise<TaskView[]>
  saveTaskView(view: TaskView): Promise<void>
  deleteTaskView(id: string): Promise<void>
  getMetadataDefs(): Promise<MetadataDef[]>
  saveMetadataDef(def: MetadataDef): Promise<void>
  deleteMetadataDef(id: string): Promise<void>

  // Tipos de nota. Tipo, propriedades e arquivamento da nota só pelos setters
  // (o saveNote não os grava).
  getNoteTypes(): Promise<NoteType[]>
  saveNoteType(type: NoteType): Promise<void>
  deleteNoteType(id: string): Promise<void>
  setNoteType(noteId: string, typeId: string | null): Promise<void>
  setNoteProperties(noteId: string, properties: Record<string, MetadataValue>): Promise<void>
  setNoteArchived(noteId: string, archivedAt: number | null): Promise<void>

  // Trackers de constância (não são tasks). Todos, inclusive os arquivados, por
  // sort_order e depois created_at.
  getTrackers(): Promise<Tracker[]>
  // Upsert por id.
  saveTracker(tracker: Tracker): Promise<void>
  // Marcas e depois o tracker (duas execuções, sem BEGIN/COMMIT).
  deleteTracker(id: string): Promise<void>
  countTrackerMarks(trackerId: string): Promise<number>
  // Todas as marcas (volume pequeno: uma por tracker por dia), por day.
  getTrackerMarks(): Promise<TrackerMark[]>
  // on = INSERT OR IGNORE; off = DELETE. Idempotente.
  setTrackerMark(trackerId: string, day: string, on: boolean): Promise<void>

  // Radar
  // Dia (YYYY-MM-DD local) da última consulta concluída do escopo; null = nunca.
  getRadarLastRun(scopeKey: string): Promise<string | null>
  // Upsert por escopo ('notebook:<id>' | 'tag:<tagKey>' | 'board:<typeId>' | 'all').
  setRadarLastRun(scopeKey: string, dayKey: string): Promise<void>

  getResponses(noteId: string): Promise<AiResponse[]>
  getResponsesByIds(ids: string[]): Promise<AiResponse[]>
  // Respostas concluídas desses comandos, de todas as notas (inclusive as
  // órfãs), da mais nova para a mais antiga.
  getCompletedResponsesByCommands(commands: string[]): Promise<AiResponse[]>
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
