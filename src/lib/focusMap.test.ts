import { describe, expect, it } from 'vitest'
import type { Book, MetadataDef, Note, Notebook, NoteType } from '../types'
import type { AgentScope } from './agents/scope'
import {
  ACTIVE_NOTEBOOKS_MAX,
  BOARD_CARDS_MAX,
  BOOKS_MAX,
  buildFocusMap,
  FOCUS_MAX_CHARS,
  PLANS_MAX,
  RADAR_PROFILE_CHARS,
  RADAR_PROFILE_SAVED_NOTE,
  RECENT_TITLES_CHARS,
  RECENT_TITLES_MAX,
  TITLES_PER_NOTEBOOK,
  type FocusMapInput,
} from './focusMap'
import type { NotePlanInfo, PlanEntry } from './planNotes'
import { tasksSubjectId } from './tasks'

// Mapa de foco: o que entra no bloco de cada escopo, o que fica de fora, o
// orçamento de itens e de caracteres e os assuntos de fallback.

const TODAY = '2026-11-20'

// Meio-dia local do dia (evita borda de fuso no dateKeyFromMs).
function at(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

let seq = 0
function note(patch: Partial<Note> = {}): Note {
  seq++
  return {
    id: `n${seq}`,
    notebookId: 'nb1',
    title: `Note ${seq}`,
    content: '',
    tags: [],
    createdAt: 0,
    updatedAt: at('2026-11-10'),
    ...patch,
  }
}

function notebook(id: string, name: string): Notebook {
  return { id, name, createdAt: 0, updatedAt: 0 }
}

const PHYSICS = notebook('nb1', 'Physics')
const RUST = notebook('nb2', 'Rust Lab')
const PRIVATE = notebook('off', 'Private')
const CALENDAR = notebook('calendar', 'Calendar')
const NOTEBOOKS = [PHYSICS, RUST, PRIVATE, CALENDAR]

const STATUS: MetadataDef = {
  id: 'd1',
  name: 'Status',
  type: 'select',
  sortOrder: 1,
  createdAt: 0,
  scope: 'note',
  noteTypeId: 't1',
  options: [
    { id: 'o1', name: 'Reading', color: null },
    { id: 'o2', name: 'Done', color: null },
  ],
  showInList: false,
}

const PAPER: NoteType = {
  id: 't1',
  name: 'Paper',
  icon: null,
  color: null,
  template: null,
  sortOrder: 0,
  builtin: false,
  createdAt: 0,
  board: { columnDefId: 'd1', sectionDefId: null, cardDefIds: [], showTags: true, hideEmpty: false, filterDefId: null },
  log: null,
}

function input(scope: AgentScope, notes: Note[], over: Partial<FocusMapInput> = {}): FocusMapInput {
  return {
    scope,
    notes,
    notebooks: NOTEBOOKS,
    defs: [STATUS],
    books: [],
    disabledNotebookIds: new Set(['off']),
    radarProfile: null,
    todayKey: TODAY,
    plans: [],
    ...over,
  }
}

const inNotebook = (nb: Notebook): AgentScope => ({ kind: 'notebook', notebook: nb, source: 'folder' })
const ALL: AgentScope = { kind: 'all', source: 'default' }

function book(patch: Partial<Book> & { format?: 'pdf' | 'epub' } = {}): Book {
  const base = {
    id: `b${++seq}`,
    title: `Book ${seq}`,
    author: null,
    filePath: '',
    totalPages: 300,
    lastPage: 120,
    addedAt: 0,
    lastOpenedAt: at('2026-11-15'),
    zoom: 1,
    language: null,
  }
  return patch.format === 'epub'
    ? { ...base, format: 'epub', cfi: null, locationsJson: null, ...patch }
    : ({ ...base, format: 'pdf', ...patch } as Book)
}

function plan(n: Note, end: string | null, state: PlanEntry['state'] = 'active'): PlanEntry {
  const info: NotePlanInfo = {
    start: '2026-11-01',
    end,
    capacity: null,
    capacityDefName: null,
    book: null,
    bookDefName: null,
  }
  return { note: n, info, checklist: null, progress: null, state }
}

describe('exclusões', () => {
  it('arquivada, nota-corpo de task, Calendar, IA desligada e a nota de perfil ficam de fora', () => {
    const profile = note({ title: 'Radar profile', tags: ['radar profile'], content: 'Follow: Rust' })
    const notes = [
      note({ title: 'Visible note' }),
      note({ title: 'Archived note', archivedAt: 1 }),
      note({ title: 'Task body note', subjectId: tasksSubjectId('nb1') }),
      note({ title: 'Calendar day note', notebookId: 'calendar' }),
      note({ title: 'Private note', notebookId: 'off' }),
      profile,
    ]
    const map = buildFocusMap(input(ALL, notes, { radarProfile: profile }))
    expect(map.text).toContain('Visible note')
    for (const hidden of ['Archived note', 'Task body note', 'Calendar day note', 'Private note']) {
      expect(map.text).not.toContain(hidden)
    }
    // A nota de perfil entra pelo bloco "Radar profile", não como nota recente.
    expect(map.text).not.toContain('"Radar profile"')
    expect(map.text).toContain('Radar profile:\nFollow: Rust')
  })
})

describe('escopos', () => {
  it('notebook: só as notas do caderno, da mais nova para a mais antiga', () => {
    const notes = [
      note({ title: 'Old physics', updatedAt: at('2026-11-02') }),
      note({ title: 'New physics', updatedAt: at('2026-11-18') }),
      note({ title: 'Rust note', notebookId: 'nb2' }),
    ]
    const map = buildFocusMap(input(inNotebook(PHYSICS), notes))
    expect(map.text).toContain('Scope: notebook "Physics" (from the chat folder)')
    expect(map.text).toContain('Recent notes (newest first): "New physics" (18/11), "Old physics" (02/11)')
    expect(map.text).not.toContain('Rust note')
    expect(map.scopeNotebookId).toBe('nb1')
  })

  it('a origem do escopo aparece na linha Scope', () => {
    const fromName = buildFocusMap(input({ kind: 'notebook', notebook: PHYSICS, source: 'folderName' }, []))
    expect(fromName.text).toContain('(from the folder name)')
    const fromMessage = buildFocusMap(input({ kind: 'all', source: 'message' }, []))
    expect(fromMessage.text).toContain('Scope: all notebooks (from your message)')
    expect(buildFocusMap(input(ALL, [])).text).toContain('Scope: all notebooks (default: no scope named)')
    expect(buildFocusMap(input({ kind: 'tag', tag: 'rust' }, [])).text).toContain('Scope: tag #rust (from your message)')
  })

  it('tag: as notas com a tag, de qualquer caderno, com o nome do caderno', () => {
    const notes = [
      note({ title: 'In physics', tags: ['Rust'], updatedAt: at('2026-11-12') }),
      note({ title: 'In rust lab', tags: ['rust'], notebookId: 'nb2', updatedAt: at('2026-11-14') }),
      note({ title: 'No tag' }),
    ]
    const map = buildFocusMap(input({ kind: 'tag', tag: 'rust' }, notes))
    expect(map.text).toContain('Recent notes (newest first): "In rust lab" (Rust Lab, 14/11), "In physics" (Physics, 12/11)')
    expect(map.text).not.toContain('No tag')
    expect(map.scopeNotebookId).toBeNull()
  })

  it('board: as notas do tipo, as colunas e os cards com a coluna', () => {
    const notes = [
      note({ title: 'Paper A', typeId: 't1', properties: { d1: 'o1' }, updatedAt: at('2026-11-12') }),
      note({ title: 'Paper B', typeId: 't1', properties: { d1: 'o2' }, updatedAt: at('2026-11-16') }),
      note({ title: 'Paper C', typeId: 't1', updatedAt: at('2026-11-14') }),
      note({ title: 'Other type' }),
    ]
    const map = buildFocusMap(input({ kind: 'board', type: PAPER }, notes))
    expect(map.text).toContain('Scope: board "Paper" (from your message)')
    expect(map.text).toContain('Board "Paper" — columns: Reading, Done, No value')
    expect(map.text).toContain('Cards: "Paper A" · Reading; "Paper B" · Done; "Paper C" · No value')
    expect(map.text).toContain('Recent notes (newest first): "Paper B" (16/11), "Paper C" (14/11), "Paper A" (12/11)')
    expect(map.text).not.toContain('Other type')
  })

  it('board com a configuração inválida não escreve as linhas do board', () => {
    const map = buildFocusMap(input({ kind: 'board', type: PAPER }, [note({ typeId: 't1' })], { defs: [] }))
    expect(map.text).not.toContain('Board "Paper"')
    expect(map.text).not.toContain('Cards:')
  })

  it('all: cadernos editados nos últimos 30 dias, por atividade, no lugar das notas recentes', () => {
    const notes = [
      note({ title: 'P1', updatedAt: at('2026-11-18') }),
      note({ title: 'P2', updatedAt: at('2026-11-17') }),
      note({ title: 'R1', notebookId: 'nb2', updatedAt: at('2026-11-19') }),
      note({ title: 'Stale', notebookId: 'nb2', updatedAt: at('2026-10-01') }),
    ]
    const map = buildFocusMap(input(ALL, notes))
    expect(map.text).toContain('Active notebooks (last 30 days):')
    expect(map.text).toContain('- "Physics" (2 notes edited): "P1", "P2"')
    expect(map.text).toContain('- "Rust Lab" (1 note edited): "R1"')
    expect(map.text.indexOf('"Physics"')).toBeLessThan(map.text.indexOf('"Rust Lab"'))
    expect(map.text).not.toContain('Stale')
    expect(map.text).not.toContain('Recent notes')
  })

  it('all: limita cadernos e títulos por caderno', () => {
    const notebooks = Array.from({ length: 15 }, (_, i) => notebook(`x${i}`, `Notebook ${i}`))
    const notes = notebooks.flatMap((nb, i) =>
      Array.from({ length: i === 0 ? 8 : 1 }, (_, j) => note({ title: `T${i}-${j}`, notebookId: nb.id, updatedAt: at('2026-11-18') }))
    )
    const map = buildFocusMap(input(ALL, notes, { notebooks }))
    const lines = map.text.split('\n').filter((l) => l.startsWith('- "Notebook'))
    expect(lines).toHaveLength(ACTIVE_NOTEBOOKS_MAX)
    expect(lines[0].split('", "')).toHaveLength(TITLES_PER_NOTEBOOK)
    expect(lines[0]).toContain('(8 notes edited)')
  })

  it('all: o perfil de estudo vai por caderno ativo', () => {
    const notes = [
      note({ title: 'Study profile', tags: ['study profile'], content: 'Goal: learn waves.', updatedAt: at('2026-11-18') }),
    ]
    const map = buildFocusMap(input(ALL, notes))
    expect(map.text).toContain('Study profiles: "Physics": Goal: learn waves.')
  })
})

describe('perfis, planos, tags e livros', () => {
  it('sem perfil do Radar, escreve "none"; com perfil, o corpo limpo e cortado', () => {
    expect(buildFocusMap(input(ALL, [])).text).toContain('Radar profile: none.')
    const long = note({ tags: ['radar profile'], content: `Follow: ${'x'.repeat(2000)}` })
    const map = buildFocusMap(input(ALL, [], { radarProfile: long }))
    const body = map.text.split('\n')[2]
    expect(body.length).toBeLessThanOrEqual(RADAR_PROFILE_CHARS)
    expect(body.endsWith('…')).toBe(true)
  })

  it('perfil de estudo do caderno em uma linha', () => {
    const notes = [note({ title: 'Study profile', tags: ['study profile'], content: 'Goal: waves.\n\nLevel: beginner' })]
    const map = buildFocusMap(input(inNotebook(PHYSICS), notes))
    expect(map.text).toContain('Study profile: Goal: waves. Level: beginner')
  })

  it('planos ativos e vencidos do escopo, com a data de fim', () => {
    const inPhysics = note({ title: 'Waves plan' })
    const inRust = note({ title: 'Rust plan', notebookId: 'nb2' })
    const plans = [
      plan(inPhysics, '2026-12-05'),
      plan(inRust, '2026-11-30'),
      plan(note({ title: 'Late plan' }), '2026-11-10', 'overdue'),
      plan(note({ title: 'Future plan' }), '2027-01-01', 'upcoming'),
      plan(note({ title: 'Done plan' }), '2026-11-01', 'finished'),
    ]
    const map = buildFocusMap(input(inNotebook(PHYSICS), [inPhysics, inRust], { plans }))
    expect(map.text).toContain('Active plans: "Waves plan" (until 05/12) · "Late plan" (until 10/11)')
    expect(map.text).not.toContain('Rust plan')
    expect(map.text).not.toContain('Future plan')
    expect(map.text).not.toContain('Done plan')
    expect(buildFocusMap(input(ALL, [], { plans })).text).toContain('"Rust plan" (until 30/11)')
  })

  it('limita os planos', () => {
    const plans = Array.from({ length: PLANS_MAX + 3 }, (_, i) => plan(note({ title: `Plan ${i}` }), '2026-12-01'))
    const text = buildFocusMap(input(ALL, [], { plans })).text
    expect(text).toContain(`"Plan ${PLANS_MAX - 1}"`)
    expect(text).not.toContain(`"Plan ${PLANS_MAX}"`)
  })

  it('top tags por contagem, das notas do escopo', () => {
    const notes = [
      note({ tags: ['b', 'a'] }),
      note({ tags: ['c', 'a'] }),
      note({ tags: ['a', 'b'] }),
      note({ tags: ['other'], notebookId: 'nb2' }),
      note({ tags: ['hidden'], archivedAt: 1 }),
    ]
    const map = buildFocusMap(input(inNotebook(PHYSICS), notes))
    expect(map.text).toContain('Top tags: #a (3), #b (2), #c (1)')
    expect(map.text).not.toContain('#other')
    expect(map.text).not.toContain('#hidden')
  })

  it('livros em andamento: PDF por página, EPUB por location, o mais recente primeiro', () => {
    const books = [
      { book: book({ title: 'Old pdf', lastPage: 10, totalPages: 50, lastOpenedAt: at('2026-11-01') }), maxHighlightPage: null },
      { book: book({ title: 'Reading pdf', lastPage: 120, totalPages: 300, lastOpenedAt: at('2026-11-19') }), maxHighlightPage: 90 },
      { book: book({ format: 'epub', title: 'Reading epub', lastPage: 40, totalPages: 400, lastOpenedAt: at('2026-11-10') }), maxHighlightPage: null },
      { book: book({ title: 'Finished', lastPage: 300, totalPages: 300 }), maxHighlightPage: null },
      { book: book({ title: 'Never opened', lastOpenedAt: null }), maxHighlightPage: null },
    ]
    const text = buildFocusMap(input(ALL, [], { books })).text
    expect(text).toContain(
      'Books in progress: "Reading pdf" (p. 120 of 300) · "Reading epub" (location 40 of 400) · "Old pdf" (p. 10 of 50)'
    )
    expect(text).not.toContain('Finished')
    expect(text).not.toContain('Never opened')
  })

  it('limita os livros', () => {
    const books = Array.from({ length: BOOKS_MAX + 2 }, (_, i) => ({
      book: book({ title: `Book ${i}`, lastOpenedAt: at('2026-11-15') - i }),
      maxHighlightPage: null,
    }))
    const line = buildFocusMap(input(ALL, [], { books })).text.split('\n').find((l) => l.startsWith('Books in progress'))!
    expect(line.split(' · ')).toHaveLength(BOOKS_MAX)
  })
})

describe('orçamento', () => {
  it('limita as notas recentes por número e por caracteres, com títulos de 90 caracteres no máximo', () => {
    const many = Array.from({ length: 60 }, (_, i) => note({ title: `Short ${i}`, updatedAt: at('2026-11-10') + i }))
    const countLine = (text: string) => text.split('\n').find((l) => l.startsWith('Recent notes'))!
    const byCount = countLine(buildFocusMap(input(inNotebook(PHYSICS), many)).text)
    expect(byCount.match(/"/g)!.length / 2).toBe(RECENT_TITLES_MAX)

    const wide = Array.from({ length: 60 }, (_, i) => note({ title: `${'w'.repeat(200)}${i}`, updatedAt: at('2026-11-10') + i }))
    const byChars = countLine(buildFocusMap(input(inNotebook(PHYSICS), wide)).text)
    expect(byChars.length).toBeLessThanOrEqual('Recent notes (newest first): '.length + RECENT_TITLES_CHARS)
    expect(byChars).toContain(`"${'w'.repeat(89)}…"`)
    expect(byChars).not.toContain('w'.repeat(91))
  })

  it('passou do teto: tira primeiro as notas recentes e depois os cards, até caber', () => {
    const notes = Array.from({ length: 80 }, (_, i) =>
      note({ title: `${'c'.repeat(100)}-${i}`, typeId: 't1', properties: { d1: 'o1' }, updatedAt: at('2026-11-10') + i })
    )
    const map = buildFocusMap(input({ kind: 'board', type: PAPER }, notes))
    expect(map.text.length).toBeLessThanOrEqual(FOCUS_MAX_CHARS)
    const cards = map.text.split('\n').find((l) => l.startsWith('Cards:'))!
    expect(cards.split('; ').length).toBeLessThanOrEqual(BOARD_CARDS_MAX)
    expect(cards.split('; ').length).toBeGreaterThan(0)
    expect(map.text).toContain('Radar profile: none.')
  })

  it('o escopo all com muitos cadernos também cabe no teto', () => {
    const notebooks = Array.from({ length: 12 }, (_, i) => notebook(`x${i}`, `Notebook ${i}`))
    const notes = notebooks.flatMap((nb, i) =>
      Array.from({ length: 6 }, (_, j) => note({ title: `${'t'.repeat(120)}${i}-${j}`, notebookId: nb.id, updatedAt: at('2026-11-18') }))
    )
    const profile = note({ tags: ['radar profile'], content: `Follow: ${'y'.repeat(1500)}` })
    const profiles = notebooks.map((nb) => note({ title: 'Study profile', tags: ['study profile'], notebookId: nb.id, content: 'g'.repeat(400), updatedAt: at('2026-11-18') }))
    const map = buildFocusMap(input(ALL, [...notes, ...profiles], { notebooks, radarProfile: profile }))
    expect(map.text.length).toBeLessThanOrEqual(FOCUS_MAX_CHARS)
    expect(map.text).toContain('Study profiles:')
  })
})

describe('empty', () => {
  it('sem notas no escopo e sem perfil', () => {
    expect(buildFocusMap(input(inNotebook(PHYSICS), [note({ notebookId: 'nb2' })])).empty).toBe(true)
    expect(buildFocusMap(input(ALL, [])).empty).toBe(true)
  })

  it('nota no escopo tira o empty; o perfil do Radar só o tira no escopo "tudo"', () => {
    expect(buildFocusMap(input(inNotebook(PHYSICS), [note()])).empty).toBe(false)
    const profile = note({ tags: ['radar profile'], content: 'Follow: Rust' })
    expect(buildFocusMap(input(ALL, [], { radarProfile: profile })).empty).toBe(false)
  })

  it('caderno, tag ou board sem notas é vazio mesmo com perfil (o perfil não ancora o escopo estreito)', () => {
    const profile = note({ tags: ['radar profile'], content: 'Follow: Rust\nSources: lwn.net\nIgnore: crypto' })
    expect(buildFocusMap(input(inNotebook(PHYSICS), [], { radarProfile: profile })).empty).toBe(true)
    expect(buildFocusMap(input({ kind: 'tag', tag: 'rust' }, [], { radarProfile: profile })).empty).toBe(true)
    expect(buildFocusMap(input({ kind: 'board', type: PAPER }, [], { radarProfile: profile })).empty).toBe(true)
    // Com uma nota no escopo, deixa de ser vazio.
    expect(buildFocusMap(input(inNotebook(PHYSICS), [note()], { radarProfile: profile })).empty).toBe(false)
  })

  it('só com notas excluídas, o escopo continua vazio', () => {
    expect(buildFocusMap(input(ALL, [note({ archivedAt: 1 }), note({ notebookId: 'off' })])).empty).toBe(true)
  })
})

describe('terms', () => {
  it('escopo estreito: o nome do caderno (2+ palavras) e as tags do escopo, sem o Follow do perfil', () => {
    const profile = note({ tags: ['radar profile'], content: 'Follow: WebAssembly, Rust async\nSources: lwn.net\nIgnore: crypto' })
    const notes = [note({ notebookId: 'nb2', tags: ['async-tag'] }), note({ tags: ['physics-tag'] })]
    const map = buildFocusMap(input(inNotebook(RUST), notes, { radarProfile: profile }))
    expect(map.terms).toEqual(['Rust Lab', 'async-tag'])
    const tag = buildFocusMap(input({ kind: 'tag', tag: 'rust' }, [note({ tags: ['rust', 'async-tag'] })], { radarProfile: profile }))
    expect(tag.terms).toEqual(['rust', 'async-tag'])
    const board = buildFocusMap(input({ kind: 'board', type: PAPER }, [note({ typeId: 't1', tags: ['graphs'] })], { radarProfile: profile }))
    expect(board.terms).toEqual(['graphs'])
  })

  it('nome de caderno de uma palavra só não é assunto de reserva (ficam as tags; o Follow nunca)', () => {
    const profile = note({ tags: ['radar profile'], content: 'Follow: WebAssembly' })
    const map = buildFocusMap(input(inNotebook(PHYSICS), [note({ tags: ['physics-tag'] })], { radarProfile: profile }))
    expect(map.terms).toEqual(['physics-tag'])
    expect(buildFocusMap(input(inNotebook(PHYSICS), [], { radarProfile: profile })).terms).toEqual([])
  })

  it('o Quick Notes nunca é assunto, nem pelo id nem pelo nome', () => {
    const inbox = notebook('inbox', 'Quick Notes')
    const renamed = notebook('nb9', 'quick notes')
    expect(buildFocusMap(input(inNotebook(inbox), [note({ notebookId: 'inbox', tags: ['t1'] })])).terms).toEqual(['t1'])
    expect(buildFocusMap(input(inNotebook(renamed), [note({ notebookId: 'nb9', tags: ['t2'] })])).terms).toEqual(['t2'])
  })

  it('o nome da tag entra como assunto do escopo; o nome do tipo do board não', () => {
    expect(buildFocusMap(input({ kind: 'tag', tag: 'rust' }, [])).terms).toEqual(['rust'])
    expect(buildFocusMap(input({ kind: 'board', type: PAPER }, [])).terms).toEqual([])
    const cards = [note({ typeId: 't1', tags: ['graphs'] })]
    expect(buildFocusMap(input({ kind: 'board', type: PAPER }, cards)).terms).toEqual(['graphs'])
  })

  it('all: o Follow do perfil e as top tags, e nenhum nome de caderno', () => {
    const profile = note({ tags: ['radar profile'], content: 'Follow: WebAssembly' })
    const notes = [note({ updatedAt: at('2026-11-18'), tags: ['physics-tag'] }), note({ notebookId: 'nb2', updatedAt: at('2026-11-19') })]
    const map = buildFocusMap(input(ALL, notes, { radarProfile: profile }))
    expect(map.terms).toEqual(['WebAssembly', 'physics-tag'])
    expect(buildFocusMap(input(ALL, notes)).terms).toEqual(['physics-tag'])
    // Os cadernos ativos continuam no bloco, só não viram consulta.
    expect(map.text).toContain('- "Rust Lab" (1 note edited)')
  })

  it('sem repetição por tagKey e com teto de 6', () => {
    const profile = note({ tags: ['radar profile'], content: 'Follow: Rust, rust, RUST , Física, fisica' })
    expect(buildFocusMap(input(ALL, [], { radarProfile: profile })).terms).toEqual(['Rust', 'Física'])

    const many = note({ tags: ['radar profile'], content: 'Follow: a1, a2, a3, a4, a5, a6, a7, a8' })
    expect(buildFocusMap(input(ALL, [], { radarProfile: many })).terms).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])
  })

  it('o assunto do perfil lido do corpo cortado também entra', () => {
    const profile = note({ tags: ['radar profile'], content: `Ignore: ${'z'.repeat(1500)}\nFollow: last-term` })
    expect(buildFocusMap(input(ALL, [], { radarProfile: profile })).terms).toEqual(['last-term'])
  })
})

describe('profileUse: ignore (o Papers)', () => {
  const profile = note({
    tags: ['radar profile'],
    content: 'Follow: WebAssembly, Rust async\nSources: lwn.net\nIgnore: crypto, sports',
  })
  const ignoreOnly = (scope: AgentScope, notes: Note[], radarProfile: Note | null = profile) =>
    buildFocusMap(input(scope, notes, { radarProfile, profileUse: 'ignore' }))

  it('o bloco leva só a linha Ignore, sem o Follow nem as Sources', () => {
    const map = ignoreOnly(inNotebook(PHYSICS), [note()])
    expect(map.text).toContain('Radar profile (ignore only): crypto, sports')
    expect(map.text).not.toContain('WebAssembly')
    expect(map.text).not.toContain('lwn.net')
    expect(map.text).not.toContain('Radar profile: none.')
    expect(map.profileUsed).toBe(true)
  })

  it('sem perfil ou sem linha Ignore, nenhuma linha de perfil (nem "none")', () => {
    for (const p of [null, note({ tags: ['radar profile'], content: 'Follow: Rust' }), note({ tags: ['radar profile'], content: 'Ignore: nothing yet' })]) {
      const map = ignoreOnly(inNotebook(PHYSICS), [note()], p)
      expect(map.text).not.toContain('Radar profile')
      expect(map.profileUsed).toBe(false)
    }
  })

  it('o Follow do perfil não vira assunto de reserva', () => {
    const map = ignoreOnly(inNotebook(PHYSICS), [note({ tags: ['physics-tag'] })])
    expect(map.terms).toEqual(['physics-tag'])
    expect(ignoreOnly(ALL, [], profile).terms).toEqual([])
  })

  it('escopo sem notas é vazio mesmo com perfil (o perfil não ancora a busca)', () => {
    expect(ignoreOnly(inNotebook(PHYSICS), []).empty).toBe(true)
    expect(ignoreOnly(inNotebook(PHYSICS), [note()]).empty).toBe(false)
  })

  it('o modo padrão no escopo "tudo" continua com o perfil inteiro e profileUsed', () => {
    const map = buildFocusMap(input(ALL, [note()], { radarProfile: profile }))
    expect(map.text).toContain('Radar profile:\nFollow: WebAssembly, Rust async')
    expect(map.profileUsed).toBe(true)
    expect(buildFocusMap(input(ALL, [note()])).profileUsed).toBe(false)
  })
})

describe('perfil do Radar em caderno, tag ou board (o Follow não entra)', () => {
  const profile = note({
    tags: ['radar profile'],
    content: 'Follow: WebAssembly, Rust async\nSources: lwn.net, arxiv.org\nIgnore: crypto, sports',
  })
  const scopes: Array<[string, AgentScope, Note[]]> = [
    ['caderno', inNotebook(PHYSICS), [note()]],
    ['tag', { kind: 'tag', tag: 'waves' }, [note({ tags: ['waves'] })]],
    ['board', { kind: 'board', type: PAPER }, [note({ typeId: 't1', properties: { d1: 'o1' } })]],
  ]

  it('o bloco leva só Sources e Ignore, e o rótulo diz isso; o Follow some do texto', () => {
    for (const [name, scope, notes] of scopes) {
      const map = buildFocusMap(input(scope, notes, { radarProfile: profile }))
      expect(map.text, name).toContain('Radar profile (sources and ignore only):\nSources: lwn.net, arxiv.org\nIgnore: crypto, sports')
      expect(map.text, name).not.toContain('WebAssembly')
      expect(map.text, name).not.toContain('Follow')
      expect(map.text, name).not.toContain('Radar profile: none.')
      expect(map.profileUsed, name).toBe(true)
    }
  })

  it('só Ignore ou só Sources: a linha que existe entra; "Sources: any" e "Ignore: nothing yet" não contam', () => {
    const onlyIgnore = note({ tags: ['radar profile'], content: 'Follow: Rust\nSources: any\nIgnore: crypto' })
    const a = buildFocusMap(input(inNotebook(PHYSICS), [note()], { radarProfile: onlyIgnore }))
    expect(a.text).toContain('Radar profile (sources and ignore only):\nIgnore: crypto')
    expect(a.text).not.toContain('Sources:')
    const onlySources = note({ tags: ['radar profile'], content: 'Follow: Rust\nSources: lwn.net\nIgnore: nothing yet' })
    const b = buildFocusMap(input(inNotebook(PHYSICS), [note()], { radarProfile: onlySources }))
    expect(b.text).toContain('Radar profile (sources and ignore only):\nSources: lwn.net')
    expect(b.text).not.toContain('Ignore:')
  })

  it('perfil só com Follow (ou sem nada a usar): a linha "saved" diz que o perfil existe, sem o "none" nem o Follow, e profileUsed falso', () => {
    for (const content of ['Follow: WebAssembly', 'Follow: Rust\nSources: any\nIgnore: nothing yet']) {
      for (const [name, scope, notes] of scopes) {
        const map = buildFocusMap(input(scope, notes, { radarProfile: note({ tags: ['radar profile'], content }) }))
        expect(map.text, name).toContain(RADAR_PROFILE_SAVED_NOTE)
        expect(map.text, name).toContain(
          'Radar profile: saved. Its Follow line applies only to the "all notebooks" scope, so nothing from it is used here. Do not propose a profile.'
        )
        expect(map.text, name).not.toContain('Radar profile: none.')
        expect(map.text, name).not.toContain('Radar profile (sources and ignore only)')
        expect(map.text, name).not.toContain('WebAssembly')
        expect(map.text, name).not.toContain('Follow:')
        expect(map.profileUsed, name).toBe(false)
      }
    }
  })

  it('a linha "saved" só aparece sem Sources nem Ignore: com uma delas entra o bloco do escopo estreito, e no "tudo" o perfil inteiro', () => {
    const withSources = note({ tags: ['radar profile'], content: 'Follow: Rust\nSources: lwn.net' })
    const follow = note({ tags: ['radar profile'], content: 'Follow: WebAssembly' })
    for (const [name, scope, notes] of scopes) {
      expect(buildFocusMap(input(scope, notes, { radarProfile: withSources })).text, name).not.toContain('Radar profile: saved.')
    }
    const all = buildFocusMap(input(ALL, [note()], { radarProfile: follow }))
    expect(all.text).toContain('Radar profile:\nFollow: WebAssembly')
    expect(all.text).not.toContain('Radar profile: saved.')
  })

  it('sem perfil, a linha "none" continua (é ela que dispara a proposta de perfil)', () => {
    for (const [name, scope, notes] of scopes) {
      const map = buildFocusMap(input(scope, notes))
      expect(map.text, name).toContain('Radar profile: none.')
      expect(map.profileUsed, name).toBe(false)
    }
  })

  it('o Follow nem entra nas consultas de reserva, e o escopo estreito sem notas é vazio', () => {
    for (const [name, scope, notes] of scopes) {
      const map = buildFocusMap(input(scope, notes, { radarProfile: profile }))
      expect(map.terms.join(' '), name).not.toMatch(/WebAssembly|Rust async/)
      expect(map.empty, name).toBe(false)
      expect(buildFocusMap(input(scope, [], { radarProfile: profile })).empty, name).toBe(true)
    }
  })

  it('no escopo "tudo" nada muda: o perfil inteiro, o Follow nos assuntos de reserva e o perfil que ancora', () => {
    const map = buildFocusMap(input(ALL, [], { radarProfile: profile }))
    expect(map.text).toContain('Radar profile:\nFollow: WebAssembly, Rust async\nSources: lwn.net, arxiv.org\nIgnore: crypto, sports')
    expect(map.terms).toEqual(['WebAssembly', 'Rust async'])
    expect(map.empty).toBe(false)
    expect(map.profileUsed).toBe(true)
  })
})
