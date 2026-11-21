import { describe, expect, it } from 'vitest'
import type { MetadataDef, Note, NoteType } from '../types'
import type { PaperItem } from './agentItems'
import { MAX_LIST_PROPERTIES } from './noteTypes'
import {
  isPaperType,
  PAPER_STATUS_OPTIONS,
  paperAuthorsText,
  paperNoteAuthors,
  paperNoteContent,
  paperNoteTitle,
  paperPdfFromContent,
  paperPdfLink,
  paperProperties,
  paperSaveChanges,
  readingListKeys,
  readingListMatch,
  type PaperSaveIds,
} from './papers'

// Regras da Fase E: o tipo Paper (criação, complemento, idempotência), a chave
// de dedupe da fila de leitura e o conteúdo e as propriedades da nota.

const TYPE_ID = 'nt_paper'

let seq = 0
function noteType(patch: Partial<NoteType> = {}): NoteType {
  seq++
  return {
    id: `nt${seq}`,
    name: `Type ${seq}`,
    icon: null,
    color: null,
    template: null,
    sortOrder: seq,
    builtin: false,
    createdAt: 0,
    board: null,
    log: null,
    ...patch,
  }
}

function def(patch: Partial<MetadataDef> = {}): MetadataDef {
  seq++
  return {
    id: `md${seq}`,
    name: `Prop ${seq}`,
    type: 'text',
    sortOrder: seq,
    createdAt: 0,
    scope: 'note',
    noteTypeId: TYPE_ID,
    options: null,
    showInList: false,
    ...patch,
  }
}

function note(patch: Partial<Note> = {}): Note {
  seq++
  return {
    id: `n${seq}`,
    notebookId: 'nb1',
    subjectId: null,
    title: `Note ${seq}`,
    content: '',
    tags: [],
    date: null,
    createdAt: 0,
    updatedAt: 0,
    typeId: TYPE_ID,
    properties: {},
    archivedAt: null,
    ...patch,
  }
}

function paper(patch: Partial<PaperItem> = {}): PaperItem {
  return {
    kind: 'paper',
    key: 'P1',
    section: 'foundational',
    id: 'doi:10.1000/abc',
    openalexId: 'W123',
    title: 'Graph neural networks: a review',
    authors: ['Ana Smith', 'Bo Lee', 'Cy Chen'],
    authorCount: 3,
    year: 2021,
    date: '2021-03-01',
    doi: '10.1000/abc',
    url: 'https://doi.org/10.1000/abc',
    citations: 1234,
    type: 'review',
    isOa: true,
    pdfUrl: null,
    oaUrl: null,
    abstract: 'We survey the field.',
    ...patch,
  }
}

// Aplica o plano ao estado, como quem grava e relê.
function apply(types: NoteType[], defs: MetadataDef[], plan: ReturnType<typeof paperSaveChanges>) {
  return {
    types: [...types.filter((t) => t.id !== plan.type.id), plan.type],
    defs: [...defs.filter((d) => !plan.changedDefs.some((c) => c.id === d.id)), ...plan.changedDefs, ...plan.newDefs],
  }
}

describe('paperSaveChanges', () => {
  it('cria o tipo com as quatro propriedades, o board por Status e sem Log', () => {
    const others = [noteType({ sortOrder: 4 }), noteType({ sortOrder: 7 })]
    const plan = paperSaveChanges(others, [])
    expect(plan.newType).toBe(true)
    expect(plan.typeChanged).toBe(true)
    expect(plan.changedDefs).toEqual([])
    expect(plan.warnings).toEqual([])
    expect(plan.type).toMatchObject({ name: 'Paper', icon: 'file-text', color: null, template: null, builtin: false, sortOrder: 8, log: null })
    expect(plan.type.id).toMatch(/^nt_/)
    expect(plan.newDefs.map((d) => [d.name, d.type, d.showInList, d.noteTypeId, d.scope])).toEqual([
      ['Status', 'select', true, plan.type.id, 'note'],
      ['Year', 'number', true, plan.type.id, 'note'],
      ['Authors', 'text', true, plan.type.id, 'note'],
      ['DOI', 'text', false, plan.type.id, 'note'],
    ])
    expect(plan.newDefs.map((d) => d.sortOrder)).toEqual([1, 2, 3, 4])

    const [status, year, authors, doi] = plan.newDefs
    expect(status.options?.map((o) => [o.name, o.color])).toEqual(PAPER_STATUS_OPTIONS.map((o) => [o.name, o.color]))
    expect(status.options?.every((o) => o.id.startsWith('opt_'))).toBe(true)
    expect(plan.ids).toEqual({
      status: status.id,
      toRead: status.options?.[0].id,
      year: year.id,
      authors: authors.id,
      doi: doi.id,
    })
    expect(plan.type.board).toEqual({
      columnDefId: status.id,
      sectionDefId: null,
      cardDefIds: [authors.id, year.id],
      showTags: true,
      hideEmpty: false,
      filterDefId: null,
    })
    expect(plan.newDefs.filter((d) => d.showInList).length).toBeLessThanOrEqual(MAX_LIST_PROPERTIES)
  })

  it('reaproveita o tipo existente sem propriedades e cria as quatro', () => {
    const type = noteType({ id: TYPE_ID, name: ' paper ', sortOrder: 2 })
    const plan = paperSaveChanges([type], [])
    expect(plan.newType).toBe(false)
    expect(plan.type.id).toBe(TYPE_ID)
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Status', 'Year', 'Authors', 'DOI'])
    expect(plan.type.board?.columnDefId).toBe(plan.ids.status)
    expect(plan.typeChanged).toBe(true)
  })

  it('só acrescenta as propriedades que faltam, por nome sem caixa nem acento', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const year = def({ name: 'year', type: 'number', sortOrder: 5, showInList: true })
    const doi = def({ name: 'Doi', type: 'text', sortOrder: 6 })
    const plan = paperSaveChanges([type], [year, doi])
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Status', 'Authors'])
    expect(plan.newDefs.map((d) => d.sortOrder)).toEqual([7, 8])
    // Year já ocupa uma vaga em "show in list": Status e Authors completam as três.
    expect(plan.newDefs.map((d) => d.showInList)).toEqual([true, true])
    expect(plan.ids.year).toBe(year.id)
    expect(plan.ids.doi).toBe(doi.id)
  })

  it('respeita o limite de propriedades na lista', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const listed = [def({ showInList: true }), def({ showInList: true })]
    const plan = paperSaveChanges([type], listed)
    expect(plan.newDefs.map((d) => [d.name, d.showInList])).toEqual([
      ['Status', true],
      ['Year', false],
      ['Authors', false],
      ['DOI', false],
    ])
  })

  it('Status existente com opções faltando ganha só as que faltam', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const status = def({
      name: 'Status',
      type: 'select',
      options: [
        { id: 'o_read', name: 'read', color: '#111111' },
        { id: 'o_other', name: 'Parked', color: null },
      ],
    })
    const plan = paperSaveChanges([type], [status])
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Year', 'Authors', 'DOI'])
    expect(plan.changedDefs).toHaveLength(1)
    const changed = plan.changedDefs[0]
    expect(changed.id).toBe(status.id)
    expect(changed.options?.map((o) => o.name)).toEqual(['read', 'Parked', 'To read', 'Reading'])
    expect(changed.options?.slice(0, 2)).toEqual(status.options)
    expect(plan.ids.toRead).toBe(changed.options?.[2].id)
    expect(plan.type.board?.columnDefId).toBe(status.id)
  })

  it('Status como text: não recria, sem board nem Status na nota, e há um aviso', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const status = def({ name: 'Status', type: 'text' })
    const plan = paperSaveChanges([type], [status])
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Year', 'Authors', 'DOI'])
    expect(plan.changedDefs).toEqual([])
    expect(plan.ids.status).toBeNull()
    expect(plan.ids.toRead).toBeNull()
    expect(plan.type.board).toBeNull()
    expect(plan.typeChanged).toBe(false)
    expect(plan.warnings).toEqual(['Saved without Status: your Paper type has Status as Text. Change it in Note types.'])
  })

  it('Year como text: o aviso aparece e a nota fica sem Year', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const year = def({ name: 'Year', type: 'text' })
    const plan = paperSaveChanges([type], [year])
    expect(plan.ids.year).toBeNull()
    expect(plan.warnings).toEqual(['Saved without Year: your Paper type has Year as Text. Change it in Note types.'])
    expect(plan.type.board?.cardDefIds).toEqual([plan.ids.authors])
  })

  it('o aviso cita o nome que o usuário deu à propriedade e o tipo de dado dela', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const doi = def({ name: 'doi', type: 'number' })
    const plan = paperSaveChanges([type], [doi])
    expect(plan.ids.doi).toBeNull()
    expect(plan.warnings).toEqual(['Saved without DOI: your Paper type has doi as Number. Change it in Note types.'])
  })

  it('preserva o board que o tipo já tem', () => {
    const board = { columnDefId: 'x', sectionDefId: null, cardDefIds: [], showTags: false, hideEmpty: true, filterDefId: null }
    const type = noteType({ id: TYPE_ID, name: 'Paper', board })
    const plan = paperSaveChanges([type], [])
    expect(plan.typeChanged).toBe(false)
    expect(plan.type).toBe(type)
    expect(plan.type.board).toBe(board)
    // As propriedades que faltam continuam sendo criadas.
    expect(plan.newDefs.map((d) => d.name)).toEqual(['Status', 'Year', 'Authors', 'DOI'])
  })

  it('ignora tipo embutido chamado Paper', () => {
    const builtin = noteType({ id: 'embutido', name: 'Paper', builtin: true })
    const plan = paperSaveChanges([builtin], [])
    expect(plan.newType).toBe(true)
    expect(plan.type.id).not.toBe('embutido')
  })

  it('é idempotente: a 2ª chamada sobre o resultado da 1ª não cria nem muda nada', () => {
    const first = paperSaveChanges([noteType()], [])
    const state = apply([], [], first)
    const second = paperSaveChanges(state.types, state.defs)
    expect(second.newType).toBe(false)
    expect(second.typeChanged).toBe(false)
    expect(second.newDefs).toEqual([])
    expect(second.changedDefs).toEqual([])
    expect(second.warnings).toEqual([])
    expect(second.ids).toEqual(first.ids)
    expect(second.type).toEqual(first.type)
  })

  it('é idempotente também depois de completar um Status com opções faltando', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const status = def({ name: 'Status', type: 'select', options: [] })
    const first = paperSaveChanges([type], [status])
    const state = apply([type], [status], first)
    const second = paperSaveChanges(state.types, state.defs)
    expect(second.newDefs).toEqual([])
    expect(second.changedDefs).toEqual([])
    expect(second.typeChanged).toBe(false)
    expect(second.ids.toRead).toBe(first.ids.toRead)
  })
})

describe('readingListKeys e readingListMatch', () => {
  const type = noteType({ id: TYPE_ID, name: 'Paper' })
  const doiDef = def({ name: 'DOI', type: 'text' })

  it('chaveia por DOI normalizado, lido da propriedade DOI', () => {
    const n = note({ properties: { [doiDef.id]: 'https://doi.org/10.1000/ABC' } })
    const keys = readingListKeys([n], [type], [doiDef])
    expect(keys.get('doi:10.1000/abc')).toEqual({ noteId: n.id, notebookId: 'nb1', archived: false })
    expect(keys.size).toBe(1)
  })

  it('chaveia por OpenAlex lido da linha Source do conteúdo', () => {
    const plain = note({ content: 'Intro\n\nSource: https://openalex.org/W111\n\n## Abstract' })
    // O editor pode reescrever a URL como autolink ou como link.
    const autolink = note({ content: 'Source: <https://openalex.org/W222>' })
    const link = note({ content: 'Source: [https://openalex.org/W333](https://openalex.org/W333)' })
    const keys = readingListKeys([plain, autolink, link], [type], [])
    expect([...keys.keys()].sort()).toEqual(['openalex:W111', 'openalex:W222', 'openalex:W333'])
  })

  it('a nota com DOI e Source entra com as duas chaves', () => {
    const n = note({ content: 'Source: https://openalex.org/W9', properties: { [doiDef.id]: '10.1000/zzz' } })
    const keys = readingListKeys([n], [type], [doiDef])
    expect([...keys.keys()].sort()).toEqual(['doi:10.1000/zzz', 'openalex:W9'])
  })

  it('a nota arquivada conta, e a ativa vence a arquivada na mesma chave', () => {
    const archived = note({ archivedAt: 1, content: 'Source: https://openalex.org/W5' })
    const active = note({ content: 'Source: https://openalex.org/W5' })
    expect(readingListKeys([archived], [type], []).get('openalex:W5')?.noteId).toBe(archived.id)
    expect(readingListKeys([archived, active], [type], []).get('openalex:W5')?.noteId).toBe(active.id)
  })

  it('a entrada diz se a nota Paper está arquivada', () => {
    const archived = note({ archivedAt: 1, content: 'Source: https://openalex.org/W5' })
    const active = note({ content: 'Source: https://openalex.org/W6' })
    const keys = readingListKeys([archived, active], [type], [])
    expect(keys.get('openalex:W5')).toEqual({ noteId: archived.id, notebookId: 'nb1', archived: true })
    expect(keys.get('openalex:W6')?.archived).toBe(false)
    expect(readingListMatch(paper({ doi: null, openalexId: 'W5' }), keys)?.archived).toBe(true)
    expect(readingListMatch(paper({ doi: null, openalexId: 'W6' }), keys)?.archived).toBe(false)
  })

  it('com a ativa e a arquivada do mesmo artigo, o match não é arquivado', () => {
    const archived = note({ archivedAt: 1, content: 'Source: https://openalex.org/W5' })
    const active = note({ content: 'Source: https://openalex.org/W5' })
    expect(readingListMatch(paper({ doi: null, openalexId: 'W5' }), readingListKeys([archived, active], [type], []))?.archived).toBe(
      false
    )
  })

  it('nota de outro tipo não conta, nem sem o tipo Paper', () => {
    const other = note({ typeId: 'outro', content: 'Source: https://openalex.org/W7', properties: { [doiDef.id]: '10.1/x' } })
    expect(readingListKeys([other], [type], [doiDef]).size).toBe(0)
    const semTipo = note({ content: 'Source: https://openalex.org/W7' })
    expect(readingListKeys([semTipo], [], []).size).toBe(0)
  })

  it('DOI da propriedade vazia ou inválida é ignorado', () => {
    const n = note({ properties: { [doiDef.id]: 'não é doi' } })
    expect(readingListKeys([n], [type], [doiDef]).size).toBe(0)
  })

  it('readingListMatch: pelo DOI, pelo OpenAlex ou nenhum', () => {
    const byDoi = note({ properties: { [doiDef.id]: '10.1000/abc' } })
    const byOpenAlex = note({ content: 'Source: https://openalex.org/W42' })
    const keys = readingListKeys([byDoi, byOpenAlex], [type], [doiDef])
    expect(readingListMatch(paper({ doi: '10.1000/abc', openalexId: 'W1' }), keys)).toEqual({
      noteId: byDoi.id,
      notebookId: 'nb1',
      archived: false,
    })
    // Sem DOI na nota, o artigo com DOI cai na chave do OpenAlex.
    expect(readingListMatch(paper({ doi: '10.1000/novo', openalexId: 'W42' }), keys)?.noteId).toBe(byOpenAlex.id)
    expect(readingListMatch(paper({ doi: null, openalexId: 'W42' }), keys)?.noteId).toBe(byOpenAlex.id)
    expect(readingListMatch(paper({ doi: '10.1000/novo', openalexId: 'W99' }), keys)).toBeNull()
    expect(readingListMatch(paper({ doi: null, openalexId: 'W99' }), keys)).toBeNull()
  })
})

describe('texto do artigo', () => {
  it('paperNoteTitle apara, colapsa espaços e corta em 200', () => {
    expect(paperNoteTitle(paper({ title: '  A   title\nwith breaks ' }))).toBe('A title with breaks')
    expect(paperNoteTitle(paper({ title: 'x'.repeat(250) }))).toHaveLength(200)
  })

  it('paperAuthorsText: nomes completos, com et al. acima de 3', () => {
    expect(paperAuthorsText(paper())).toBe('Ana Smith, Bo Lee, Cy Chen')
    expect(paperAuthorsText(paper({ authorCount: 12 }))).toBe('Ana Smith, Bo Lee, Cy Chen et al.')
    expect(paperAuthorsText(paper({ authors: ['Solo Author'], authorCount: 1 }))).toBe('Solo Author')
    expect(paperAuthorsText(paper({ authors: [], authorCount: 0 }))).toBe('')
  })

  it('paperPdfLink: o pdf_url, o oa_url terminado em .pdf ou nenhum', () => {
    expect(paperPdfLink({ pdfUrl: 'https://x.org/a.pdf', oaUrl: 'https://x.org/landing' })).toBe('https://x.org/a.pdf')
    expect(paperPdfLink({ pdfUrl: null, oaUrl: 'https://x.org/paper.PDF' })).toBe('https://x.org/paper.PDF')
    expect(paperPdfLink({ pdfUrl: null, oaUrl: 'https://x.org/paper.pdf?download=1' })).toBe('https://x.org/paper.pdf?download=1')
    expect(paperPdfLink({ pdfUrl: null, oaUrl: 'https://x.org/landing' })).toBeNull()
    expect(paperPdfLink({ pdfUrl: null, oaUrl: null })).toBeNull()
  })
})

describe('paperNoteContent', () => {
  it('com DOI e abstract: link do DOI, linha de dados, Source, Abstract, a sugestão e My notes vazio', () => {
    expect(paperNoteContent(paper(), 'Core of the GNN notes.', '2026-11-20', 'Papers')).toBe(
      [
        '[https://doi.org/10.1000/abc](https://doi.org/10.1000/abc)',
        'Ana Smith, Bo Lee, Cy Chen · 2021 · review · 1,234 citations · Open access',
        'Source: https://openalex.org/W123',
        '## Abstract',
        'We survey the field.',
        '> **AI suggestion** (Papers, 20/11/2026): Core of the GNN notes.',
        '## My notes',
      ].join('\n\n')
    )
  })

  it('com PDF de acesso aberto: a linha PDF vem depois do Source e antes do Abstract', () => {
    const content = paperNoteContent(paper({ pdfUrl: 'https://repo.example.org/files/p.pdf' }), 'Why.', '2026-11-20', 'Papers')
    expect(content.split('\n\n').slice(2, 5)).toEqual([
      'Source: https://openalex.org/W123',
      'PDF: https://repo.example.org/files/p.pdf',
      '## Abstract',
    ])
  })

  it('o PDF vem do oa_url quando ele termina em .pdf; página sem PDF direto não grava a linha', () => {
    expect(
      paperNoteContent(paper({ pdfUrl: null, oaUrl: 'https://repo.example.org/p.pdf?dl=1' }), '', '2026-11-20', 'Papers')
    ).toContain('\n\nPDF: https://repo.example.org/p.pdf?dl=1\n\n')
    expect(
      paperNoteContent(paper({ pdfUrl: null, oaUrl: 'https://repo.example.org/landing' }), '', '2026-11-20', 'Papers')
    ).not.toContain('PDF:')
    expect(paperNoteContent(paper(), '', '2026-11-20', 'Papers')).not.toContain('PDF:')
  })

  it('parênteses e espaços da URL do PDF saem codificados', () => {
    const content = paperNoteContent(paper({ pdfUrl: 'https://x.org/a (1).pdf' }), '', '2026-11-20', 'Papers')
    expect(content).toContain('PDF: https://x.org/a%20%281%29.pdf')
  })

  it('abstract cortado (termina em …) vira "Abstract (excerpt)"; inteiro fica "Abstract"', () => {
    const cut = paperNoteContent(paper({ abstract: 'We survey the…' }), '', '2026-11-20', 'Papers')
    expect(cut).toContain('## Abstract (excerpt)\n\nWe survey the…')
    const whole = paperNoteContent(paper({ abstract: 'We survey the field.' }), '', '2026-11-20', 'Papers')
    expect(whole).toContain('## Abstract\n\nWe survey the field.')
    expect(whole).not.toContain('(excerpt)')
  })

  it('termina com "## My notes" vazio, depois da sugestão da IA e também sem ela', () => {
    const withReason = paperNoteContent(paper(), 'Because.', '2026-11-20', 'Papers')
    expect(withReason.endsWith('\n\n## My notes')).toBe(true)
    expect(withReason.indexOf('AI suggestion')).toBeLessThan(withReason.indexOf('## My notes'))
    expect(paperNoteContent(paper(), '', '2026-11-20', 'Papers').endsWith('\n\n## My notes')).toBe(true)
  })

  it('sem DOI usa a URL; sem abstract não há a seção; o Radar assina como Radar', () => {
    const item = paper({
      doi: null,
      id: 'openalex:W123',
      url: 'https://example.org/landing',
      abstract: null,
      authorCount: 7,
      year: null,
      isOa: false,
      citations: 1,
    })
    const content = paperNoteContent(item, 'New this week.', '2026-11-20', 'Radar')
    expect(content).toBe(
      [
        '[https://example.org/landing](https://example.org/landing)',
        'Ana Smith, Bo Lee, Cy Chen et al. · n.d. · review · 1 citation · Closed access',
        'Source: https://openalex.org/W123',
        '> **AI suggestion** (Radar, 20/11/2026): New this week.',
        '## My notes',
      ].join('\n\n')
    )
    expect(content).not.toContain('## Abstract')
  })

  it('DOI com parênteses não quebra o destino do link', () => {
    const item = paper({ doi: '10.1016/s0140-6736(20)30183-5' })
    expect(paperNoteContent(item, '', '2026-11-20', 'Papers')).toContain(
      '[https://doi.org/10.1016/s0140-6736(20)30183-5](https://doi.org/10.1016/s0140-6736%2820%2930183-5)'
    )
  })

  it('sem motivo não há a linha de sugestão; o motivo vai numa linha só', () => {
    expect(paperNoteContent(paper(), '   ', '2026-11-20', 'Papers')).not.toContain('AI suggestion')
    expect(paperNoteContent(paper(), 'one\n two   words', '2026-11-20', 'Papers')).toContain(': one two words')
  })

  it('não usa a marca de atenção do usuário', () => {
    expect(paperNoteContent(paper(), 'Because.', '2026-11-20', 'Papers')).not.toContain('data-mark')
  })

  it('a linha Source é lida de volta pela chave de dedupe', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const n = note({ content: paperNoteContent(paper({ doi: null, id: 'openalex:W123' }), 'Because.', '2026-11-20', 'Papers') })
    expect(readingListKeys([n], [type], []).has('openalex:W123')).toBe(true)
  })

  it('os caracteres de markdown da URL do PDF saem com barra (o editor os leria como formatação)', () => {
    const content = paperNoteContent(
      paper({ pdfUrl: 'https://x.org/_final_/a.pdf?t=~a~&x=[1]&k=*z*&c=`q`' }),
      '',
      '2026-11-20',
      'Papers'
    )
    expect(content).toContain('PDF: https://x.org/\\_final\\_/a.pdf?t=\\~a\\~&x=\\[1\\]&k=\\*z\\*&c=\\`q\\`\n')
    expect(paperPdfFromContent(content)).toBe('https://x.org/_final_/a.pdf?t=~a~&x=[1]&k=*z*&c=`q`')
  })

  it('a linha Source é lida de volta mesmo com a URL em autolink, link ou com barras', () => {
    const type = noteType({ id: TYPE_ID, name: 'Paper' })
    const keysOf = (content: string) => readingListKeys([note({ content })], [type], [])
    expect(keysOf('Source: <https://openalex.org/W7>').has('openalex:W7')).toBe(true)
    expect(keysOf('Source: [https://openalex.org/W8](https://openalex.org/W8)').has('openalex:W8')).toBe(true)
    expect(keysOf('Source: https://openalex\\.org/W9').has('openalex:W9')).toBe(true)
    expect(keysOf('A line.\n\nSource: nothing here\n\nSource: https://openalex.org/W10').has('openalex:W10')).toBe(true)
    expect(keysOf('Source: https://example.org/W11').size).toBe(0)
  })

  it('a linha PDF é lida de volta da nota', () => {
    const content = paperNoteContent(paper({ pdfUrl: 'https://repo.example.org/files/p.pdf' }), 'Because.', '2026-11-20', 'Papers')
    expect(paperPdfFromContent(content)).toBe('https://repo.example.org/files/p.pdf')
    expect(paperPdfFromContent(paperNoteContent(paper(), 'Because.', '2026-11-20', 'Papers'))).toBeNull()
  })
})

describe('paperPdfFromContent', () => {
  it('lê a URL da linha PDF em texto, autolink ou link, e com escapes do editor', () => {
    expect(paperPdfFromContent('Source: x\n\nPDF: https://x.org/a.pdf\n\n## Abstract')).toBe('https://x.org/a.pdf')
    expect(paperPdfFromContent('PDF: <https://x.org/a.pdf>')).toBe('https://x.org/a.pdf')
    expect(paperPdfFromContent('PDF: [https://x.org/a.pdf](https://x.org/a.pdf)')).toBe('https://x.org/a.pdf')
    expect(paperPdfFromContent('  PDF:   https://x.org/a.pdf?dl=1&x=2  ')).toBe('https://x.org/a.pdf?dl=1&x=2')
    expect(paperPdfFromContent('PDF: https://x.org/a\\*b.pdf')).toBe('https://x.org/a*b.pdf')
    expect(paperPdfFromContent('pdf: HTTPS://X.ORG/A.PDF')).toBe('HTTPS://X.ORG/A.PDF')
  })

  // O texto abaixo é o que o editor grava (conferido na ida e volta real, em
  // `paperNoteRoundTrip.test.ts`): `_`, `~` e `[`/`]` saem com barra; `*` (itálico
  // lido e regravado), `&` e os `%28`/`%29` do app ficam como estão.
  it('lê a URL como o editor a grava, com o `_` escapado depois de uma barra ou de um `?`', () => {
    expect(paperPdfFromContent('PDF: https://x.org/dir/\\_private/a.pdf')).toBe('https://x.org/dir/_private/a.pdf')
    expect(paperPdfFromContent('PDF: https://x.org/a.pdf?\\_ga=1&\\_gl=2')).toBe('https://x.org/a.pdf?_ga=1&_gl=2')
    expect(paperPdfFromContent('PDF: https://x.org/a\\_.pdf')).toBe('https://x.org/a_.pdf')
    expect(paperPdfFromContent('PDF: https://x.org/a_b_c.pdf')).toBe('https://x.org/a_b_c.pdf')
  })

  it('lê a URL com `~`, `*`, `&`, parênteses codificados e colchetes escapados', () => {
    expect(paperPdfFromContent('PDF: https://x.org/\\~user/a_b.pdf')).toBe('https://x.org/~user/a_b.pdf')
    expect(paperPdfFromContent('PDF: https://x.org/a.pdf?file=\\_x&y=*z*&t=\\~a\\~b\\~')).toBe(
      'https://x.org/a.pdf?file=_x&y=*z*&t=~a~b~'
    )
    expect(paperPdfFromContent('PDF: https://x.org/a\\*b\\*c.pdf')).toBe('https://x.org/a*b*c.pdf')
    expect(paperPdfFromContent('PDF: https://x.org/a.pdf?u=a%28b%29&v=1&w=2')).toBe('https://x.org/a.pdf?u=a%28b%29&v=1&w=2')
    expect(paperPdfFromContent('PDF: https://x.org/a.pdf?x=\\[1\\]&y=2')).toBe('https://x.org/a.pdf?x=[1]&y=2')
  })

  it('lê o autolink e o link que o editor regrava com o escape, inclusive o escape duplicado', () => {
    expect(paperPdfFromContent('PDF: <https://x.org/a.pdf?file=\\_x&y=\\*z\\*>')).toBe('https://x.org/a.pdf?file=_x&y=*z*')
    expect(paperPdfFromContent('PDF: [https://x.org/a.pdf?file=\\_x&y=*z*](https://x.org/a.pdf?file=_x&y=*z*)')).toBe(
      'https://x.org/a.pdf?file=_x&y=*z*'
    )
    expect(
      paperPdfFromContent('PDF: [https://x.org/dir/\\\\\\_private/a.pdf](https://x.org/dir/%5C_private/a.pdf)')
    ).toBe('https://x.org/dir/_private/a.pdf')
  })

  it('sem a linha, com PDF no meio de um texto ou sem URL web, é null', () => {
    expect(paperPdfFromContent('')).toBeNull()
    expect(paperPdfFromContent('Source: https://openalex.org/W1')).toBeNull()
    expect(paperPdfFromContent('See the PDF: https://x.org/a.pdf for details')).toBeNull()
    expect(paperPdfFromContent('PDF: not available')).toBeNull()
    expect(paperPdfFromContent('PDF: ftp://x.org/a.pdf')).toBeNull()
  })

  it('a linha seguinte não entra: o PDF vazio não pega a URL do Source', () => {
    expect(paperPdfFromContent('PDF:\nSource: https://openalex.org/W1')).toBeNull()
  })
})

describe('isPaperType e paperNoteAuthors', () => {
  it('isPaperType: o tipo não embutido chamado Paper, sem caixa nem acento', () => {
    expect(isPaperType(noteType({ name: 'Paper' }))).toBe(true)
    expect(isPaperType(noteType({ name: ' paper: ' }))).toBe(true)
    expect(isPaperType(noteType({ name: 'Paper', builtin: true }))).toBe(false)
    expect(isPaperType(noteType({ name: 'Papers' }))).toBe(false)
  })

  it('paperNoteAuthors: o texto da propriedade Authors; sem ela ou vazia, vazio', () => {
    const authors = def({ name: 'authors', type: 'text' })
    const wrongType = def({ name: 'Authors', type: 'number' })
    expect(paperNoteAuthors({ properties: { [authors.id]: ' Ana Smith, Bo Lee ' } }, [authors])).toBe('Ana Smith, Bo Lee')
    expect(paperNoteAuthors({ properties: {} }, [authors])).toBe('')
    expect(paperNoteAuthors({ properties: { [authors.id]: 3 } }, [authors])).toBe('')
    expect(paperNoteAuthors({ properties: { [wrongType.id]: 'x' } }, [wrongType])).toBe('')
    expect(paperNoteAuthors({ properties: { [authors.id]: 'Ana' } }, [])).toBe('')
  })
})

describe('paperProperties', () => {
  const ids: PaperSaveIds = { status: 'st', toRead: 'opt_toread', year: 'yr', authors: 'au', doi: 'doi' }

  it('Status To read, Year, Authors e DOI', () => {
    expect(paperProperties(ids, { year: 2021, authors: 'Ana Smith', doi: '10.1000/abc' })).toEqual({
      st: 'opt_toread',
      yr: 2021,
      au: 'Ana Smith',
      doi: '10.1000/abc',
    })
  })

  it('Year só com ano, DOI só com DOI e Authors só com texto', () => {
    expect(paperProperties(ids, { year: null, authors: '', doi: null })).toEqual({ st: 'opt_toread' })
  })

  it('as chaves de ids nulos ficam de fora', () => {
    const partial: PaperSaveIds = { status: null, toRead: null, year: null, authors: 'au', doi: null }
    expect(paperProperties(partial, { year: 2021, authors: 'Ana', doi: '10.1/x' })).toEqual({ au: 'Ana' })
  })
})
