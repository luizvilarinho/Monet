// Generic localStorage helpers
export function loadOrder(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveOrder(key: string, ids: string[]): void {
  localStorage.setItem(key, JSON.stringify(ids))
}

// Shorthands for notes
const NOTE_KEY = 'monet:note-order'
export const loadNoteOrder = () => loadOrder(NOTE_KEY)
export const saveNoteOrder = (ids: string[]) => saveOrder(NOTE_KEY, ids)

// Replaces visible slots in globalOrder with newVisibleOrder, preserving non-visible positions
export function mergeOrder(globalOrder: string[], newVisibleOrder: string[]): string[] {
  const visibleSet = new Set(newVisibleOrder)
  const result: string[] = []
  let vi = 0
  for (const id of globalOrder) {
    result.push(visibleSet.has(id) ? newVisibleOrder[vi++] : id)
  }
  while (vi < newVisibleOrder.length) result.push(newVisibleOrder[vi++])
  return result
}

export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items
  const idx = new Map(order.map((id, i) => [id, i]))
  return [...items].sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity))
}

// Ordem de exibição da lista de notas, global (localStorage). 'manual' é a
// ordem arrastada acima; as outras só reordenam a exibição.
export type NoteSort = 'manual' | 'type' | 'alpha'

export const NOTE_SORT_OPTIONS: Array<{ id: NoteSort; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'type', label: 'By type' },
  { id: 'alpha', label: 'Alphabetical (A–Z)' },
]

const NOTE_SORT_KEY = 'monet:note-sort'

export function loadNoteSort(): NoteSort {
  try {
    const saved = localStorage.getItem(NOTE_SORT_KEY)
    return NOTE_SORT_OPTIONS.find((o) => o.id === saved)?.id ?? 'manual'
  } catch {
    return 'manual'
  }
}

export function saveNoteSort(sort: NoteSort): void {
  try {
    localStorage.setItem(NOTE_SORT_KEY, sort)
  } catch {
    /* ignorar */
  }
}

// Título como aparece na lista; sem caixa nem acento.
function compareTitles(a: { title: string }, b: { title: string }): number {
  return (a.title.trim() || 'untitled').localeCompare(b.title.trim() || 'untitled', undefined, {
    sensitivity: 'base',
  })
}

// Aplica `sort` sobre a lista já em ordem manual (o sort é estável: empate
// mantém a ordem manual). 'type': pela ordem dos tipos (`typeOrder`, ids na
// ordem do usuário) e A–Z dentro de cada tipo; sem tipo (ou tipo apagado) por
// último.
export function sortNotes<T extends { title: string; typeId?: string | null }>(
  notes: T[],
  sort: NoteSort,
  typeOrder: string[]
): T[] {
  if (sort === 'manual') return notes
  if (sort === 'alpha') return [...notes].sort(compareTitles)
  const rank = new Map(typeOrder.map((id, i) => [id, i]))
  const rankOf = (n: T) => (n.typeId ? rank.get(n.typeId) ?? typeOrder.length : typeOrder.length)
  return [...notes].sort((a, b) => rankOf(a) - rankOf(b) || compareTitles(a, b))
}
