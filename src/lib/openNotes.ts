// Notas e tasks abertas no dia (aba Open da coluna da direita), da mais recente
// para a mais antiga. É estado de navegação, não dado da nota: fica no
// localStorage, sobrevive a reabrir o app e zera na virada do dia.
export type OpenEntryKind = 'note' | 'task'

export interface OpenEntry {
  kind: OpenEntryKind
  id: string
  openedAt: number
}

const STORAGE_KEY = 'monet:open-notes'

export function loadOpenEntries(day: string): OpenEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
      day?: unknown
      entries?: unknown
    } | null
    if (!parsed || parsed.day !== day || !Array.isArray(parsed.entries)) return []
    return parsed.entries.filter(
      (e): e is OpenEntry =>
        (e?.kind === 'note' || e?.kind === 'task') && typeof e?.id === 'string' && typeof e?.openedAt === 'number',
    )
  } catch {
    return []
  }
}

export function saveOpenEntries(day: string, entries: OpenEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ day, entries }))
  } catch {
    /* ignorar */
  }
}

// A nota ou task aberta vai para o topo; uma entrada por item.
export function recordOpenEntry(entries: OpenEntry[], kind: OpenEntryKind, id: string, at: number): OpenEntry[] {
  return [{ kind, id, openedAt: at }, ...entries.filter((e) => e.kind !== kind || e.id !== id)]
}
