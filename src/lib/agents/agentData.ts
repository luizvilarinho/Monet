import type { MetadataDef, Note, Notebook, NoteType, Tracker } from '../../types'
import { notesIndexGetDisabledNotebooks } from '../documents'
import type { ReaderBookInfo } from '../planNotes'
import {
  buildTrackerDays,
  formatTrackersWeekForAi,
  queryTrackersText,
  type TrackerDays,
  type TrackerQuery,
} from '../trackers'
import { storage } from '../../storage'

// Dados comuns aos agentes de plano (planner, coach; o tutor reusa): notas,
// tipos, propriedades, cadernos, cadernos com a IA desligada e os livros do
// Reader. Lidos do storage a cada mensagem.

export interface PlanData {
  notes: Note[]
  defs: MetadataDef[] // só scope 'note'
  types: NoteType[]
  notebooks: Notebook[]
  disabledNotebookIds: Set<string>
  books: ReaderBookInfo[]
}

// Livros com a página do destaque mais avançado, abertos mais recentemente
// primeiro. Falha do Reader = lista vazia: o Reader não bloqueia o agente.
export async function loadReaderBooks(): Promise<ReaderBookInfo[]> {
  try {
    const books = await storage.getBooks()
    const highlights = await Promise.all(books.map((b) => storage.getHighlights(b.id).catch(() => [])))
    return books
      .map((book, i) => ({
        book,
        maxHighlightPage: highlights[i].length > 0 ? Math.max(...highlights[i].map((h) => h.page)) : null,
      }))
      .sort((a, b) => (b.book.lastOpenedAt ?? -1) - (a.book.lastOpenedAt ?? -1))
  } catch (err) {
    console.warn('reader books failed:', err)
    return []
  }
}

export async function loadPlanData(): Promise<PlanData> {
  const [notes, defs, types, notebooks, disabledIds, books] = await Promise.all([
    storage.getNotes(),
    storage.getMetadataDefs(),
    storage.getNoteTypes(),
    storage.getNotebooks(),
    notesIndexGetDisabledNotebooks(),
    loadReaderBooks(),
  ])
  return {
    notes,
    defs: defs.filter((d) => d.scope === 'note'),
    types,
    notebooks,
    disabledNotebookIds: new Set(disabledIds),
    books,
  }
}

// '"<title>" · <N> pages (PDF) · furthest highlight p. <n> · last opened p. <n>'
// EPUB: '… · <N> locations (EPUB, not pages) · no highlights · last opened location <n>'
export function bookLine({ book, maxHighlightPage }: ReaderBookInfo): string {
  const epub = book.format === 'epub'
  const unit = epub ? 'location' : 'p.'
  return [
    `"${book.title}"`,
    epub ? `${book.totalPages} locations (EPUB, not pages)` : `${book.totalPages} pages (PDF)`,
    maxHighlightPage !== null ? `furthest highlight ${unit} ${maxHighlightPage}` : 'no highlights',
    `last opened ${unit} ${book.lastPage}`,
  ].join(' · ')
}

// Trackers ativos, os dias feitos de cada um (marcas e notas do tipo vinculado) e
// o nome dos tipos, para o resumo dos agentes e a tool query_trackers.
export interface TrackerData {
  trackers: Tracker[]
  days: Map<string, TrackerDays>
  typeNameById: Map<string, string>
}

// Lido do storage na chamada. `base` evita reler as notas e os tipos que quem
// chama já tem. Cadernos com a IA desligada contam: só a contagem vai ao agente.
export async function loadTrackerData(
  todayKey: string,
  base?: { notes: Note[]; types: NoteType[] }
): Promise<TrackerData> {
  const [all, marks, notes, types] = await Promise.all([
    storage.getTrackers(),
    storage.getTrackerMarks(),
    base ? base.notes : storage.getNotes(),
    base ? base.types : storage.getNoteTypes(),
  ])
  const trackers = all.filter((t) => t.archivedAt === null)
  return {
    trackers,
    days: buildTrackerDays(trackers, marks, notes, todayKey),
    typeNameById: new Map(types.map((t) => [t.id, t.name])),
  }
}

// Para os agentes que juntam os trackers a um contexto que não depende deles
// (Coach e Plan week): falha de leitura = null, e o agente segue sem o bloco de
// trackers (como o /week-review), com os planos e as tasks intactos.
export async function loadTrackerDataSafe(
  todayKey: string,
  base: { notes: Note[]; types: NoteType[] }
): Promise<TrackerData | null> {
  try {
    return await loadTrackerData(todayKey, base)
  } catch (err) {
    console.warn('trackers failed:', err)
    return null
  }
}

// Tool query_trackers.
export async function queryTrackersTool(query: TrackerQuery, todayKey: string): Promise<string> {
  const data = await loadTrackerData(todayKey)
  return queryTrackersText(data.trackers, data.days, query, todayKey, data.typeNameById)
}

// Bloco dos trackers da semana (/week-review); null sem tracker na semana.
export async function loadTrackersWeekText(
  weekStart: string,
  todayKey: string,
  base: { notes: Note[]; types: NoteType[] }
): Promise<string | null> {
  const data = await loadTrackerData(todayKey, base)
  return formatTrackersWeekForAi(data.trackers, data.days, weekStart, todayKey)
}
