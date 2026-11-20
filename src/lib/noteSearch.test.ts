import { describe, expect, it } from 'vitest'
import type { MetadataDef, Note, Notebook, NoteType } from '../types'
import { filterSuggestions, parseSearchQuery, recentNotes, searchNotes } from './noteSearch'

// Ctrl+P: prefixo único nos filtros, autocomplete, valores de propriedade e
// recentes por abertura.

let seq = 0
function note(patch: Partial<Note>): Note {
  seq++
  return {
    id: `n${seq}`,
    notebookId: 'nb1',
    title: '',
    content: '',
    tags: [],
    createdAt: seq,
    updatedAt: seq,
    ...patch,
  }
}

function notebook(id: string, name: string): Notebook {
  return { id, name, createdAt: 0, updatedAt: 0 }
}

function noteType(id: string, name: string): NoteType {
  return { id, name, icon: null, color: null, template: null, sortOrder: 0, builtin: false, createdAt: 0, board: null }
}

const notebooks = [
  notebook('nb1', 'Estatística'),
  notebook('nb2', 'Machine Learning'),
  notebook('nb3', 'Math'),
  notebook('nb4', 'Math 2'),
]
const types = [noteType('t1', 'Fichamento'), noteType('t2', 'Fiction'), noteType('t3', 'Plan')]
const vocab = { tags: ['Física', 'Filosofia', 'Química'], markLabels: ['Pesquisar', 'Revisar'] }

describe('parseSearchQuery', () => {
  it('takes a unique prefix as the filter', () => {
    const parsed = parseSearchQuery('#estat media', notebooks, types, vocab)
    expect(parsed.notebookId).toBe('nb1')
    expect(parsed.text).toBe('media')
    expect(parseSearchQuery('type:pl', notebooks, types, vocab).typeId).toBe('t3')
    expect(parseSearchQuery('tag:qui', notebooks, types, vocab).tag).toBe('Química')
    expect(parseSearchQuery('mark:rev', notebooks, types, vocab).markLabel).toBe('Revisar')
  })

  it('keeps an ambiguous prefix as text', () => {
    const parsed = parseSearchQuery('type:fic tag:fi', notebooks, types, vocab)
    expect(parsed.typeId).toBeNull()
    expect(parsed.tag).toBeNull()
    expect(parsed.text).toBe('type:fic tag:fi')
  })

  it('prefers the exact name over a longer one with the same start', () => {
    expect(parseSearchQuery('#math', notebooks, types, vocab).notebookId).toBe('nb3')
    expect(parseSearchQuery('#math2', notebooks, types, vocab).notebookId).toBe('nb4')
  })
})

describe('filterSuggestions', () => {
  it('lists names by prefix first, then by word start', () => {
    const s = filterSuggestions('#m', notebooks, types, vocab)
    expect(s?.kind).toBe('notebook')
    expect(s?.items.map((i) => i.label)).toEqual(['Machine Learning', 'Math', 'Math 2'])
    expect(filterSuggestions('#learn', notebooks, types, vocab)?.items.map((i) => i.token)).toEqual([
      '#MachineLearning',
    ])
  })

  it('completes with tokens that parse back to the filter', () => {
    const [nb] = filterSuggestions('#machine', notebooks, types, vocab)!.items
    expect(parseSearchQuery(nb.token, notebooks, types, vocab).notebookId).toBe('nb2')
    const [tag] = filterSuggestions('tag:#fis', notebooks, types, vocab)!.items
    expect(parseSearchQuery(tag.token, notebooks, types, vocab).tag).toBe('Física')
    const [label] = filterSuggestions('mark:pes', notebooks, types, vocab)!.items
    expect(parseSearchQuery(label.token, notebooks, types, vocab).markLabel).toBe('Pesquisar')
    const [type] = filterSuggestions('TYPE:fich', notebooks, types, vocab)!.items
    expect(parseSearchQuery(type.token, notebooks, types, vocab).typeId).toBe('t1')
  })

  it('returns no items for an unknown name and null for a plain word', () => {
    expect(filterSuggestions('#zzz', notebooks, types, vocab)).toEqual({ kind: 'notebook', query: 'zzz', items: [] })
    expect(filterSuggestions('kahneman', notebooks, types, vocab)).toBeNull()
  })
})

describe('searchNotes with property values', () => {
  const defs: MetadataDef[] = [
    {
      id: 'author', name: 'Author', type: 'text', sortOrder: 1, createdAt: 0,
      scope: 'note', noteTypeId: 't1', options: null, showInList: false,
    },
    {
      id: 'status', name: 'Status', type: 'select', sortOrder: 2, createdAt: 0,
      scope: 'note', noteTypeId: 't1', options: [{ id: 'o1', name: 'Reading', color: null }], showInList: false,
    },
    {
      id: 'done', name: 'Done', type: 'checkbox', sortOrder: 3, createdAt: 0,
      scope: 'note', noteTypeId: 't1', options: null, showInList: false,
    },
  ]

  it('finds a note by a property value and says which property matched', () => {
    const book = note({ title: 'Thinking, Fast and Slow', typeId: 't1', properties: { author: 'Daniel Kahneman' } })
    const [hit] = searchNotes([book], 'kahneman', { defs })
    expect(hit.note.id).toBe(book.id)
    expect(hit.property).toEqual({ name: 'Author', value: 'Daniel Kahneman' })
  })

  it('searches the option name of a select, not its id, and skips checkboxes', () => {
    const book = note({ title: 'Book', typeId: 't1', properties: { status: 'o1', done: true } })
    expect(searchNotes([book], 'reading', { defs })[0]?.property).toEqual({ name: 'Status', value: 'Reading' })
    expect(searchNotes([book], 'o1', { defs })).toEqual([])
    expect(searchNotes([book], 'done', { defs })).toEqual([])
  })

  it('ranks a property match below the title and above the body', () => {
    const byTitle = note({ title: 'Kahneman summary' })
    const byBody = note({ title: 'Notes', content: 'Kahneman said so', updatedAt: 1000 })
    const byProp = note({ title: 'Book', typeId: 't1', properties: { author: 'Kahneman' } })
    const order = searchNotes([byBody, byProp, byTitle], 'kahneman', { defs }).map((r) => r.note.id)
    expect(order).toEqual([byTitle.id, byProp.id, byBody.id])
  })

  it('ignores values kept from another type', () => {
    const other = note({ title: 'Plan', typeId: 't3', properties: { author: 'Kahneman' } })
    expect(searchNotes([other], 'kahneman', { defs })).toEqual([])
  })
})

describe('recentNotes', () => {
  it('lists the notes opened last first, then the edited ones', () => {
    const a = note({ title: 'A', updatedAt: 10 })
    const b = note({ title: 'B', updatedAt: 30 })
    const c = note({ title: 'C', updatedAt: 20 })
    const archived = note({ title: 'Z', updatedAt: 40, archivedAt: 1 })
    const order = recentNotes([a, b, c, archived], 10, [archived.id, a.id]).map((r) => r.note.title)
    expect(order).toEqual(['A', 'B', 'C', 'Z'])
  })
})
