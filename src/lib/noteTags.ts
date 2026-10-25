import type { Note } from '../types'
import { normalizeName } from './tasks'

// Tags de nota: tema transversal aos cadernos (spec DOCS/specs/tags.md). A
// comparação ignora caixa, acento e espaço repetido ("física" = "Física"); a
// grafia gravada em cada nota não muda.

export function tagKey(tag: string): string {
  return normalizeName(tag.replace(/\s+/g, ' ').trim())
}

export function hasTag(note: Note, tag: string): boolean {
  const key = tagKey(tag)
  return note.tags.some((t) => tagKey(t) === key)
}

export interface TagCount {
  // Grafia mais usada (as variações de caixa/acento contam juntas).
  tag: string
  // Notas com a tag, arquivadas inclusive.
  count: number
}

// Tags das notas de caderno (as que abrem pela lista), em ordem alfabética.
export function summarizeTags(notes: Note[]): TagCount[] {
  const byKey = new Map<string, { count: number; spellings: Map<string, number> }>()
  for (const note of notes) {
    if (!note.notebookId) continue
    const seen = new Set<string>()
    for (const tag of note.tags) {
      const key = tagKey(tag)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const slot = byKey.get(key) ?? { count: 0, spellings: new Map<string, number>() }
      slot.count++
      slot.spellings.set(tag, (slot.spellings.get(tag) ?? 0) + 1)
      byKey.set(key, slot)
    }
  }
  return Array.from(byKey.values())
    .map(({ count, spellings }) => ({
      tag: Array.from(spellings).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      count,
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}
