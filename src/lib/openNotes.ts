// Notas abertas no dia (aba Open da coluna da direita), da mais recente para a
// mais antiga. É estado de navegação, não dado da nota: fica no localStorage,
// sobrevive a reabrir o app e zera na virada do dia.
export interface OpenNoteEntry {
  noteId: string
  openedAt: number
}

const STORAGE_KEY = 'monet:open-notes'

export function loadOpenNotes(day: string): OpenNoteEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
      day?: unknown
      entries?: unknown
    } | null
    if (!parsed || parsed.day !== day || !Array.isArray(parsed.entries)) return []
    return parsed.entries.filter(
      (e): e is OpenNoteEntry => typeof e?.noteId === 'string' && typeof e?.openedAt === 'number',
    )
  } catch {
    return []
  }
}

export function saveOpenNotes(day: string, entries: OpenNoteEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ day, entries }))
  } catch {
    /* ignorar */
  }
}

// A nota aberta vai para o topo; uma entrada por nota.
export function recordOpenNote(entries: OpenNoteEntry[], noteId: string, at: number): OpenNoteEntry[] {
  return [{ noteId, openedAt: at }, ...entries.filter((e) => e.noteId !== noteId)]
}
