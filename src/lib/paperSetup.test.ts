import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetadataDef, Note, NoteType } from '../types'

// O storage simulado: nenhum teste grava nada nem faz requisição.
const mocks = vi.hoisted(() => ({
  getNoteTypes: vi.fn(),
  getMetadataDefs: vi.fn(),
  getNotes: vi.fn(),
  getNote: vi.fn(),
  saveMetadataDef: vi.fn(),
  saveNoteType: vi.fn(),
}))

vi.mock('../storage', () => ({ storage: mocks }))
vi.mock('./tasksEvents', () => ({ emitTasksChanged: vi.fn() }))

import { findReadingListNote, inspectPaperType, setUpPaperType } from './paperSetup'

function type(patch: Partial<NoteType> = {}): NoteType {
  return {
    id: 'nt_paper',
    name: 'Paper',
    icon: null,
    color: null,
    template: null,
    sortOrder: 1,
    builtin: false,
    createdAt: 0,
    board: null,
    log: null,
    ...patch,
  }
}

function def(patch: Partial<MetadataDef> = {}): MetadataDef {
  return {
    id: 'md1',
    name: 'Year',
    type: 'text',
    sortOrder: 1,
    createdAt: 0,
    scope: 'note',
    noteTypeId: 'nt_paper',
    options: null,
    showInList: false,
    ...patch,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('inspectPaperType', () => {
  it('sem o tipo Paper: não existe e não há aviso', async () => {
    mocks.getNoteTypes.mockResolvedValue([type({ id: 'other', name: 'Practice' })])
    mocks.getMetadataDefs.mockResolvedValue([])
    await expect(inspectPaperType()).resolves.toEqual({ exists: false, warnings: [] })
  })

  it('com o tipo Paper e as propriedades certas: existe, sem aviso', async () => {
    mocks.getNoteTypes.mockResolvedValue([type()])
    mocks.getMetadataDefs.mockResolvedValue([def({ type: 'number' })])
    await expect(inspectPaperType()).resolves.toEqual({ exists: true, warnings: [] })
  })

  it('propriedade de mesmo nome com outro tipo de dado: existe e avisa', async () => {
    mocks.getNoteTypes.mockResolvedValue([type()])
    mocks.getMetadataDefs.mockResolvedValue([def({ type: 'text' })])
    await expect(inspectPaperType()).resolves.toEqual({
      exists: true,
      warnings: ['Saved without Year: your Paper type has Year as Text. Change it in Note types.'],
    })
  })

  it('só lê: não grava tipo nem propriedade', async () => {
    mocks.getNoteTypes.mockResolvedValue([])
    mocks.getMetadataDefs.mockResolvedValue([])
    await inspectPaperType()
    expect(mocks.saveNoteType).not.toHaveBeenCalled()
    expect(mocks.saveMetadataDef).not.toHaveBeenCalled()
  })

  it('só olha as propriedades de nota (a de task com o mesmo nome não conta)', async () => {
    mocks.getNoteTypes.mockResolvedValue([type()])
    mocks.getMetadataDefs.mockResolvedValue([def({ scope: 'task', noteTypeId: null })])
    await expect(inspectPaperType()).resolves.toEqual({ exists: true, warnings: [] })
  })
})

describe('setUpPaperType: ordem das gravações', () => {
  // Cada gravação entra na lista na ordem em que acontece.
  let writes: string[]

  beforeEach(() => {
    writes = []
    mocks.saveNoteType.mockImplementation(async (t: NoteType) => {
      writes.push(`type:${t.board ? 'board' : 'no-board'}`)
    })
    mocks.saveMetadataDef.mockImplementation(async (d: MetadataDef) => {
      writes.push(`def:${d.name}`)
    })
  })

  it('tipo novo: o tipo sem board, depois as propriedades e por último o tipo com o board', async () => {
    mocks.getNoteTypes.mockResolvedValue([])
    mocks.getMetadataDefs.mockResolvedValue([])
    await setUpPaperType()
    expect(writes).toEqual(['type:no-board', 'def:Status', 'def:Year', 'def:Authors', 'def:DOI', 'type:board'])
  })

  it('falha numa propriedade: o tipo já existe (nenhuma propriedade órfã) e o board não é escrito', async () => {
    mocks.getNoteTypes.mockResolvedValue([])
    mocks.getMetadataDefs.mockResolvedValue([])
    mocks.saveMetadataDef.mockImplementation(async (d: MetadataDef) => {
      if (d.name === 'Year') throw new Error('disk full')
      writes.push(`def:${d.name}`)
    })
    await expect(setUpPaperType()).rejects.toThrow('disk full')
    expect(writes).toEqual(['type:no-board', 'def:Status'])
    const typeId = (mocks.saveNoteType.mock.calls[0][0] as NoteType).id
    expect(mocks.saveMetadataDef.mock.calls.every(([d]) => (d as MetadataDef).noteTypeId === typeId)).toBe(true)
  })

  it('tipo já existente sem board: só as propriedades que faltam e o tipo com o board no fim', async () => {
    mocks.getNoteTypes.mockResolvedValue([type()])
    mocks.getMetadataDefs.mockResolvedValue([
      def({ id: 'md_status', name: 'Status', type: 'select', options: [{ id: 'o1', name: 'To read', color: '#999' }] }),
    ])
    await setUpPaperType()
    // O Status ganha as opções que faltam; o tipo não é regravado antes das propriedades.
    expect(writes).toEqual(['def:Year', 'def:Authors', 'def:DOI', 'def:Status', 'type:board'])
  })

  it('tudo já no lugar: não grava nada', async () => {
    const board = {
      columnDefId: 'md_status',
      sectionDefId: null,
      cardDefIds: [],
      showTags: true,
      hideEmpty: false,
      filterDefId: null,
    }
    mocks.getNoteTypes.mockResolvedValue([type({ board })])
    mocks.getMetadataDefs.mockResolvedValue([
      def({
        id: 'md_status',
        name: 'Status',
        type: 'select',
        options: ['To read', 'Reading', 'Read'].map((name, i) => ({ id: `o${i}`, name, color: '#999' })),
      }),
      def({ id: 'md_year', name: 'Year', type: 'number' }),
      def({ id: 'md_authors', name: 'Authors', type: 'text' }),
      def({ id: 'md_doi', name: 'DOI', type: 'text' }),
    ])
    await setUpPaperType()
    expect(writes).toEqual([])
  })
})

describe('findReadingListNote', () => {
  function note(patch: Partial<Note> = {}): Note {
    return {
      id: 'n1',
      notebookId: 'nb1',
      subjectId: null,
      title: 'A paper',
      content: 'Source: https://openalex.org/W123',
      tags: [],
      date: null,
      createdAt: 0,
      updatedAt: 0,
      typeId: 'nt_paper',
      properties: {},
      archivedAt: null,
      ...patch,
    }
  }

  beforeEach(() => {
    mocks.getNoteTypes.mockResolvedValue([type()])
    mocks.getMetadataDefs.mockResolvedValue([def({ id: 'md_doi', name: 'DOI', type: 'text' })])
  })

  it('o artigo na fila (pelo OpenAlex ou pelo DOI): devolve a nota lida do storage', async () => {
    const saved = note({ properties: { md_doi: '10.1000/abc' } })
    mocks.getNotes.mockResolvedValue([saved])
    mocks.getNote.mockResolvedValue(saved)
    await expect(findReadingListNote({ doi: null, openalexId: 'W123' })).resolves.toBe(saved)
    await expect(findReadingListNote({ doi: '10.1000/abc', openalexId: 'W999' })).resolves.toBe(saved)
    expect(mocks.getNote).toHaveBeenCalledWith('n1')
  })

  it('a nota arquivada conta: o artigo já lido não entra duas vezes', async () => {
    const archived = note({ archivedAt: 1 })
    mocks.getNotes.mockResolvedValue([archived])
    mocks.getNote.mockResolvedValue(archived)
    await expect(findReadingListNote({ doi: null, openalexId: 'W123' })).resolves.toBe(archived)
  })

  it('fora da fila, ou sem a nota no storage: null', async () => {
    mocks.getNotes.mockResolvedValue([note()])
    await expect(findReadingListNote({ doi: null, openalexId: 'W555' })).resolves.toBeNull()
    expect(mocks.getNote).not.toHaveBeenCalled()
    mocks.getNote.mockResolvedValue(null)
    await expect(findReadingListNote({ doi: null, openalexId: 'W123' })).resolves.toBeNull()
  })
})
