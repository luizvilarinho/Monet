// Para onde o vocabulário de cada livro vai no caderno: a nota escolhida na
// primeira vez, lembrada por livro em localStorage (Record<bookId, destino>).
import type { Note, Notebook } from '../types'
import { CALENDAR_NOTEBOOK_ID } from './calendar'

const DESTINATIONS_KEY = 'monet:vocab-destinations'

export interface VocabularyDestination {
  notebookId: string
  noteId: string
}

type Destinations = Record<string, VocabularyDestination>

function readDestinations(): Destinations {
  try {
    const raw = localStorage.getItem(DESTINATIONS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Destinations = {}
    for (const [bookId, value] of Object.entries(parsed)) {
      const v = value as Partial<VocabularyDestination> | null
      if (v && typeof v.notebookId === 'string' && typeof v.noteId === 'string') {
        out[bookId] = { notebookId: v.notebookId, noteId: v.noteId }
      }
    }
    return out
  } catch {
    return {}
  }
}

export function getVocabularyDestination(bookId: string): VocabularyDestination | null {
  return readDestinations()[bookId] ?? null
}

// `null` esquece o destino do livro.
export function setVocabularyDestination(bookId: string, dest: VocabularyDestination | null): void {
  try {
    const all = readDestinations()
    if (dest) all[bookId] = dest
    else delete all[bookId]
    localStorage.setItem(DESTINATIONS_KEY, JSON.stringify(all))
  } catch (err) {
    console.error('failed to persist the vocabulary destination', err)
  }
}

// A nota do destino, se ainda existe. null (nota apagada) faz o envio pedir o
// destino de novo.
export function resolveDestination(dest: VocabularyDestination | null, notes: Note[]): Note | null {
  if (!dest) return null
  return notes.find((n) => n.id === dest.noteId) ?? null
}

// Os cadernos que servem de destino padrão de uma nota nova (de vocabulário ou de
// perfil): nunca o Calendar, que é a agenda (o primeiro da ordem costuma ser ele),
// e nunca os de `excluded` (os com a IA desligada, que a nota de perfil não pode
// ocupar: o professor não a leria).
export function defaultNotebooks(
  notebooks: Notebook[],
  excluded: ReadonlySet<string> = new Set(),
): Notebook[] {
  return notebooks.filter((nb) => nb.id !== CALENDAR_NOTEBOOK_ID && !excluded.has(nb.id))
}

// Título da nota nova de vocabulário do livro.
export function vocabularyNoteTitle(bookTitle: string): string {
  return `Vocabulary — ${bookTitle}`
}
