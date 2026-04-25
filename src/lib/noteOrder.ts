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
