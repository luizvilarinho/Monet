import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetadataDef, Note, Notebook, NoteType } from '../../types'
import type { PlanData } from './agentData'

// O pipeline do Papers com tudo de fora simulado (comando Rust, OpenAlex e
// storage): nenhum teste faz requisição.
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  searchWorks: vi.fn(),
  loadPlanData: vi.fn(),
}))

vi.mock('@phosphor-icons/react', () => ({ Article: () => null }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('../openalex', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../openalex')>()),
  searchWorks: mocks.searchWorks,
}))
vi.mock('./agentData', () => ({ loadPlanData: mocks.loadPlanData }))

import { OpenAlexError } from '../openalex'
import { FOLLOW_UP_NOTE, REPEAT_SEARCH_NOTE, WHOLE_SCOPE_NOTE } from '../radar'
import { buildPapersContext, papersAgent } from './papers'

const TODAY = '2026-11-20'
const PAPER_TYPE = 'nt_paper'

function notebook(id: string, name: string): Notebook {
  return { id, name, createdAt: 0, updatedAt: 0 }
}

const RUST = notebook('nb1', 'Rust Lab')
const OTHER = notebook('nb2', 'Physics')

function note(id: string, notebookId: string, title: string, patch: Partial<Note> = {}): Note {
  return {
    id,
    notebookId,
    title,
    content: '',
    tags: [],
    createdAt: 0,
    updatedAt: new Date(2026, 10, 10, 12).getTime(),
    ...patch,
  }
}

function planData(over: Partial<PlanData> = {}): PlanData {
  return {
    notes: [note('n1', 'nb1', 'Graph neural networks'), note('n2', 'nb2', 'Optics')],
    defs: [],
    types: [],
    notebooks: [RUST, OTHER],
    disabledNotebookIds: new Set(),
    books: [],
    ...over,
  }
}

function input(over: Partial<Parameters<typeof buildPapersContext>[0]> = {}) {
  return {
    todayKey: TODAY,
    notebookId: 'nb1',
    folderName: null,
    userMessages: ['Find essential papers'],
    signal: new AbortController().signal,
    ...over,
  }
}

function paper(n: number, citations = 10, section: 'foundational' | 'recent' = 'foundational') {
  return {
    kind: 'paper' as const,
    section,
    id: `doi:10.1000/p${n}`,
    openalexId: `W${n}`,
    title: `Paper ${n}`,
    authors: ['Ana Smith'],
    authorCount: 1,
    year: 2024,
    date: '2024-01-01',
    doi: `10.1000/p${n}`,
    url: `https://doi.org/10.1000/p${n}`,
    citations,
    type: 'article',
    isOa: true,
    pdfUrl: null,
    oaUrl: null,
    abstract: `About paper ${n}.`,
  }
}

type SearchCall = { query: string; fromDate?: string; perPage: number; section: string }

// Resultados por consulta e por passada.
let foundational: Record<string, ReturnType<typeof paper>[]> = {}
let recent: Record<string, ReturnType<typeof paper>[]> = {}
let plan: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  plan = ['paper: graph neural networks', 'paper: message passing']
  foundational = {
    'graph neural networks': [paper(1, 5), paper(2, 900), paper(3, 50)],
    'message passing': [paper(4, 70), paper(2, 900)],
  }
  recent = {
    'graph neural networks': [paper(10, 1, 'recent'), paper(3, 50, 'recent')],
    'message passing': [paper(11, 0, 'recent')],
  }
  mocks.invoke.mockImplementation(async (cmd: string) => (cmd === 'radar_plan_queries' ? plan : undefined))
  mocks.loadPlanData.mockResolvedValue(planData())
  mocks.searchWorks.mockImplementation(async (o: SearchCall) =>
    o.section === 'foundational' ? (foundational[o.query] ?? []) : (recent[o.query] ?? [])
  )
})

function searchCalls(): SearchCall[] {
  return mocks.searchWorks.mock.calls.map((c) => c[0] as SearchCall)
}

describe('papersAgent', () => {
  it('roda o pipeline do app sem exigir o Tavily, e não liga as tools nem o RAG', () => {
    expect(papersAgent.command).toBe('/papers')
    expect(papersAgent.label).toBe('Papers')
    expect(papersAgent.context).toEqual({ rag: false, web: false, deepResearch: false })
    expect(papersAgent.webPipeline).toEqual({ needsTavily: false, status: 'Searching OpenAlex…' })
    expect(papersAgent.forceTasksTool).toBe(false)
    expect(papersAgent.forceNotesTool).toBe(false)
    expect(papersAgent.forceTrackersTool).toBe(false)
  })

  it('a descrição no seletor diz que traz os fundamentais e os recentes, não só as novidades', () => {
    expect(papersAgent.description).toBe('Foundational and recent papers on a topic, not only new ones, for your reading list')
  })

  it('o prompt manda escolher só pelo marcador e diz o idioma de fallback', () => {
    const prompt = papersAgent.prompt?.('English') ?? ''
    expect(prompt).toContain('"- [P4] <why it matters')
    expect(prompt).toContain('(if unclear: English)')
    expect(prompt).toContain('never add a paper, title, author, year, DOI or citation count of your own')
  })
})

describe('buildPapersContext', () => {
  it('pede as consultas ao modelo só com o mapa de foco e a instrução, sem janela', async () => {
    await buildPapersContext(input())
    const call = mocks.invoke.mock.calls.find((c) => c[0] === 'radar_plan_queries')
    expect(call?.[1]).toMatchObject({ kind: 'papers', instruction: 'Find essential papers', since: '', currentDate: TODAY })
    expect((call?.[1] as { focus: string }).focus).toContain('Scope: notebook "Rust Lab"')
  })

  it('no máximo 4 buscas no OpenAlex: duas passadas por consulta, com no máximo 2 consultas', async () => {
    plan = ['paper: a b', 'paper: c d', 'paper: e f', 'paper: g h']
    await buildPapersContext(input())
    const calls = searchCalls()
    expect(calls).toHaveLength(4)
    expect(calls.filter((c) => c.section === 'foundational')).toEqual([
      { query: 'a b', perPage: 40, section: 'foundational' },
      { query: 'c d', perPage: 40, section: 'foundational' },
    ])
    expect(calls.filter((c) => c.section === 'recent')).toEqual([
      { query: 'a b', fromDate: '2023-11-20', perPage: 20, section: 'recent' },
      { query: 'c d', fromDate: '2023-11-20', perPage: 20, section: 'recent' },
    ])
  })

  it('o sinal do Stop vai a todas as buscas', async () => {
    const controller = new AbortController()
    await buildPapersContext(input({ signal: controller.signal }))
    for (const call of mocks.searchWorks.mock.calls) expect(call[1]).toBe(controller.signal)
  })

  it('fundamentais reordenados por citações, recentes por relevância, sem repetir e numerados em sequência', async () => {
    const ctx = await buildPapersContext(input())
    const items = ctx.items?.items ?? []
    // Fundamentais: p2 (900), p3 (50), p1 (5) da 1ª consulta; depois p4 (a 2ª repete p2).
    // Recentes: p10 (a repetida p3 já é fundamental) e p11.
    expect(items.map((i) => [i.key, i.kind === 'paper' ? i.openalexId : '', i.kind === 'paper' ? i.section : ''])).toEqual([
      ['P1', 'W2', 'foundational'],
      ['P2', 'W3', 'foundational'],
      ['P3', 'W1', 'foundational'],
      ['P4', 'W4', 'foundational'],
      ['P5', 'W10', 'recent'],
      ['P6', 'W11', 'recent'],
    ])
    expect(ctx.items?.max).toBe(6)
    expect(ctx.items?.scopeNotebookId).toBe('nb1')
    expect(ctx.onDone).toBeUndefined()
  })

  it('o texto traz o contexto, as duas listas de candidatos e a linha da fila', async () => {
    const { text } = await buildPapersContext(input())
    expect(text.startsWith('Papers context\nScope: notebook "Rust Lab"')).toBe(true)
    expect(text).toContain('Papers search (OpenAlex): 2 queries\n')
    expect(text).toContain('Already in the reading list (left out): 0 papers')
    expect(text).toContain('Candidates — foundational (most cited among the relevant results):\n[P1] "Paper 2"')
    expect(text).toContain('Candidates — recent (published since 20/11/2023, by relevance):\n[P5] "Paper 10"')
    expect(text).toContain('Abstract: About paper 2.')
  })

  it('o que já está na fila de leitura não vira candidato (por DOI e por OpenAlex), e as vagas vão a artigos novos', async () => {
    const type: NoteType = {
      id: PAPER_TYPE,
      name: 'Paper',
      icon: 'file-text',
      color: null,
      template: null,
      sortOrder: 1,
      builtin: false,
      createdAt: 0,
      board: null,
      log: null,
    }
    const doiDef: MetadataDef = {
      id: 'md_doi',
      name: 'DOI',
      type: 'text',
      sortOrder: 1,
      createdAt: 0,
      scope: 'note',
      noteTypeId: PAPER_TYPE,
      options: null,
      showInList: false,
    }
    mocks.loadPlanData.mockResolvedValue(
      planData({
        types: [type],
        defs: [doiDef],
        notes: [
          note('n1', 'nb1', 'Graph neural networks'),
          // p2 por DOI (a mais citada); p3 por OpenAlex (arquivada conta).
          note('q1', 'nb1', 'Paper 2', { typeId: PAPER_TYPE, properties: { md_doi: '10.1000/p2' } }),
          note('q2', 'nb1', 'Paper 3', { typeId: PAPER_TYPE, archivedAt: 5, content: 'Source: https://openalex.org/W3' }),
        ],
      })
    )
    const ctx = await buildPapersContext(input())
    const ids = (ctx.items?.items ?? []).map((i) => (i.kind === 'paper' ? i.openalexId : ''))
    expect(ids).toEqual(['W1', 'W4', 'W10', 'W11'])
    expect(ctx.text).toContain('Already in the reading list (left out): 2 papers')
    // Só a lista de candidatos: os títulos das notas Paper aparecem no mapa de foco.
    expect(ctx.text).not.toMatch(/\[P\d+\] "Paper [23]"/)
  })

  it('uma busca que falha entra na linha de busca, e as demais seguem', async () => {
    mocks.searchWorks.mockImplementation(async (o: SearchCall) => {
      if (o.section === 'recent') throw new OpenAlexError('rate', 429)
      return foundational[o.query] ?? []
    })
    const ctx = await buildPapersContext(input())
    expect(ctx.text).toContain(
      'Papers search (OpenAlex): 2 queries, 2 of 4 searches failed: OpenAlex is limiting requests right now. Try again in a minute.'
    )
    expect((ctx.items?.items ?? []).every((i) => i.kind === 'paper' && i.section === 'foundational')).toBe(true)
  })

  it('orçamento diário esgotado em tudo: a linha diz o motivo e não há candidatos', async () => {
    mocks.searchWorks.mockRejectedValue(new OpenAlexError('budget', 429))
    const ctx = await buildPapersContext(input())
    expect(ctx.text).toContain('4 of 4 searches failed: OpenAlex daily free budget is used up')
    // Nenhuma busca deu certo: sem payload (a consulta não conta como feita).
    expect(ctx.items).toBeUndefined()
    expect(ctx.text).not.toContain('Queries searched')
    expect(ctx.text.match(/\(none\)/g)).toHaveLength(2)
  })

  it('sem consulta aproveitável (plano vazio e sem assuntos), a busca não roda e a resposta diz o motivo', async () => {
    plan = []
    // O nome do caderno é o único assunto do mapa de foco e tem mais de 12 palavras.
    const long = notebook('nb1', 'a b c d e f g h i j k l m')
    mocks.loadPlanData.mockResolvedValue(planData({ notebooks: [long, OTHER] }))
    const ctx = await buildPapersContext(input())
    expect(mocks.searchWorks).not.toHaveBeenCalled()
    expect(ctx.text).toBe(
      'Papers context\nScope: notebook "a b c d e f g h i j k l m"\nSearch not done: could not plan the searches. Try again.'
    )
    expect(ctx.items).toBeUndefined()
  })

  it('plano vazio: a reserva são os assuntos do mapa de foco (no máximo 2 consultas)', async () => {
    plan = []
    await buildPapersContext(input())
    expect(searchCalls().length).toBeGreaterThan(0)
    expect(searchCalls().length).toBeLessThanOrEqual(4)
    expect(searchCalls()[0].query).toBe('Rust Lab')
  })

  it('consulta que copia o mapa de foco não sai do app', async () => {
    const title = 'Graph neural networks for molecular property prediction in drug discovery'
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n1', 'nb1', title)] }))
    plan = [`paper: ${title.toLowerCase()}`, 'paper: message passing']
    await buildPapersContext(input())
    const queries = new Set(searchCalls().map((c) => c.query))
    expect(queries).toEqual(new Set(['message passing']))
  })

  it('IA desligada no caderno: só o aviso, sem buscas', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ disabledNotebookIds: new Set(['nb1']) }))
    const ctx = await buildPapersContext(input())
    expect(ctx.text).toContain('Papers context\nScope: notebook "Rust Lab"\nAI is turned off for this notebook in Settings, so Papers does not read it.')
    expect(mocks.searchWorks).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('escopo sem notas: só o aviso, sem buscas', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [] }))
    const ctx = await buildPapersContext(input())
    expect(ctx.text).toContain('This scope has no notes yet')
    expect(ctx.text).not.toContain('a board')
    expect(mocks.searchWorks).not.toHaveBeenCalled()
  })

  it('o escopo vem da mensagem (caderno) e a troca de escopo é avisada', async () => {
    const ctx = await buildPapersContext(input({ userMessages: ['papers on the Physics notebook', 'Find essential papers'] }))
    expect(ctx.text).toContain('Scope: notebook "Physics"')
    expect(ctx.text).toContain('Scope changed: notebook "Rust Lab" → notebook "Physics".')
    expect(ctx.items?.scopeNotebookId).toBe('nb2')
  })

  it('o Stop durante a montagem do contexto interrompe o pipeline', async () => {
    const controller = new AbortController()
    mocks.invoke.mockImplementation(async () => {
      controller.abort()
      return plan
    })
    await expect(buildPapersContext(input({ signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.searchWorks).not.toHaveBeenCalled()
  })
})

describe('buildPapersContext: dados da consulta', () => {
  it('o payload guarda o rótulo do escopo e as consultas que rodaram, sem janela', async () => {
    const ctx = await buildPapersContext(input())
    expect(ctx.items?.search).toEqual({
      scopeKey: 'notebook:nb1',
      scopeLabel: 'notebook "Rust Lab"',
      since: null,
      windowNote: null,
      queries: ['graph neural networks', 'message passing'],
      profile: false,
    })
  })

  it('o texto das consultas entra no contexto do modelo', async () => {
    const { text } = await buildPapersContext(input())
    expect(text).toContain('Queries searched: graph neural networks; message passing')
  })

  it('a consulta com alguma das duas passadas bem-sucedida conta; a que falhou nas duas não', async () => {
    mocks.searchWorks.mockImplementation(async (o: SearchCall) => {
      if (o.query === 'message passing') throw new OpenAlexError('rate', 429)
      return foundational[o.query] ?? []
    })
    const ctx = await buildPapersContext(input())
    expect(ctx.items?.search?.queries).toEqual(['graph neural networks'])
  })
})

describe('buildPapersContext: o perfil do Radar só entra pela linha Ignore', () => {
  const profile = (content: string) => ({
    ...note('p1', 'nb2', 'Radar profile'),
    tags: ['radar profile'],
    content,
  })
  const withProfile = (content: string) =>
    planData({ notes: [note('n1', 'nb1', 'Graph neural networks'), profile(content)] })

  it('o Follow e as Sources não vão ao modelo de consultas nem ao contexto; o Ignore vai', async () => {
    mocks.loadPlanData.mockResolvedValue(withProfile('Follow: LLM evaluation\nSources: lwn.net\nIgnore: crypto'))
    const ctx = await buildPapersContext(input())
    const call = mocks.invoke.mock.calls.find((c) => c[0] === 'radar_plan_queries')
    const focus = (call?.[1] as { focus: string }).focus
    expect(focus).toContain('Radar profile (ignore only): crypto')
    expect(focus).not.toContain('LLM evaluation')
    expect(focus).not.toContain('lwn.net')
    expect(ctx.text).not.toContain('LLM evaluation')
    expect(ctx.items?.search?.profile).toBe(true)
  })

  it('o Follow do perfil não vira consulta de reserva', async () => {
    mocks.loadPlanData.mockResolvedValue(withProfile('Follow: LLM evaluation'))
    plan = []
    await buildPapersContext(input())
    const queries = new Set(searchCalls().map((c) => c.query))
    expect(queries).toEqual(new Set(['Rust Lab']))
  })

  it('sem linha Ignore, o perfil não aparece e o payload diz que não foi usado', async () => {
    mocks.loadPlanData.mockResolvedValue(withProfile('Follow: LLM evaluation'))
    const ctx = await buildPapersContext(input())
    const call = mocks.invoke.mock.calls.find((c) => c[0] === 'radar_plan_queries')
    expect((call?.[1] as { focus: string }).focus).not.toContain('Radar profile')
    expect(ctx.items?.search?.profile).toBe(false)
  })

  it('o Papers não propõe perfil: sem nota de perfil o contexto não diz "none" nem o prompt tem regra de proposta', async () => {
    const ctx = await buildPapersContext(input())
    expect(ctx.text).not.toContain('Radar profile')
    expect(ctx.items?.search?.hasProfileNote).toBeUndefined()
    const prompt = papersAgent.prompt?.('English') ?? ''
    expect(prompt).not.toContain('Save radar profile')
    expect(prompt).not.toContain('Radar profile: none')
    expect(prompt).not.toContain('First check of this scope')
  })

  it('caderno sem notas com perfil: o perfil não ancora a busca (continua recusando)', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [profile('Follow: LLM evaluation')] }))
    const ctx = await buildPapersContext(input())
    expect(ctx.text).toContain('This scope has no notes yet, so')
    expect(mocks.searchWorks).not.toHaveBeenCalled()
  })
})

describe('buildPapersContext: escopo sem notas e seguimento', () => {
  it('escopo sem notas e mensagem com assunto: busca pelo assunto em vez de recusar', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics')] }))
    plan = ['paper: transformers attention']
    const ctx = await buildPapersContext(input({ userMessages: ['transformers attention'] }))
    const call = mocks.invoke.mock.calls.find((c) => c[0] === 'radar_plan_queries')
    expect(call?.[1]).toMatchObject({ kind: 'papers', instruction: 'transformers attention' })
    expect(ctx.text).not.toContain('This scope has no notes yet, so')
    expect(ctx.text).toContain('This scope has no notes yet: the search used only the subject in the user\'s message ("transformers attention")')
    expect(new Set(searchCalls().map((c) => c.query))).toEqual(new Set(['transformers attention']))
    expect(ctx.items?.search?.queries).toEqual(['transformers attention'])
  })

  it('escopo sem notas e planejador fora do ar: o assunto da mensagem é a reserva, limpo pelo cleanQueries', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [] }))
    mocks.invoke.mockRejectedValue(new Error('openrouter down'))
    await buildPapersContext(input({ notebookId: null, userMessages: ['papers on "graph neural networks"'] }))
    expect(new Set(searchCalls().map((c) => c.query))).toEqual(new Set(['graph neural networks']))
  })

  it('escopo sem notas e só o pedido padrão: continua recusando', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [] }))
    const ctx = await buildPapersContext(input())
    expect(ctx.text).toContain('This scope has no notes yet, so')
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  const run = {
    ranOn: TODAY,
    search: {
      scopeKey: 'notebook:nb1',
      scopeLabel: 'notebook "Rust Lab"',
      since: null,
      windowNote: null,
      queries: ['graph neural networks', 'message passing'],
      profile: false,
    },
  }

  it('"obrigado" depois de uma consulta não roda o pipeline: o contexto diz que não há candidatos novos', async () => {
    const onSearchStart = vi.fn()
    const ctx = await buildPapersContext(
      input({ userMessages: ['thanks', 'Find essential papers'], previousRun: run, onSearchStart })
    )
    expect(onSearchStart).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.searchWorks).not.toHaveBeenCalled()
    expect(ctx.items).toBeUndefined()
    expect(ctx.text).toBe(
      [
        'Papers context',
        'Scope: notebook "Rust Lab"',
        'Queries searched: graph neural networks; message passing',
        FOLLOW_UP_NOTE,
      ].join('\n')
    )
  })

  it('pergunta sobre um artigo já mostrado também não roda o pipeline', async () => {
    for (const message of ['tell me more about the second paper', 'that paper', 'o 2º', 'resuma']) {
      const ctx = await buildPapersContext(input({ userMessages: [message, 'Find essential papers'], previousRun: run }))
      expect(ctx.text, message).toContain(FOLLOW_UP_NOTE)
    }
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.searchWorks).not.toHaveBeenCalled()
  })

  it('pergunta nova com assunto próprio, escopo explícito ou sem consulta anterior: o pipeline roda', async () => {
    await buildPapersContext(input({ userMessages: ['papers on graph transformers'], previousRun: run }))
    expect(mocks.searchWorks).toHaveBeenCalled()
    mocks.searchWorks.mockClear()
    await buildPapersContext(input({ userMessages: ['notebook "Physics"'], previousRun: run }))
    expect(mocks.searchWorks).toHaveBeenCalled()
    mocks.searchWorks.mockClear()
    await buildPapersContext(input({ userMessages: ['thanks'], previousRun: null }))
    expect(mocks.searchWorks).toHaveBeenCalled()
  })

  it('pedir para refazer ("try again", "de novo") e a mensagem padrão rodam o pipeline', async () => {
    for (const message of ['try again', 'again', 'de novo', 'tenta de novo', 'refresh', 'Find essential papers']) {
      mocks.searchWorks.mockClear()
      const ctx = await buildPapersContext(input({ userMessages: [message], previousRun: run }))
      expect(mocks.searchWorks, message).toHaveBeenCalled()
      expect(ctx.items, message).toBeDefined()
    }
  })

  it('busca repetida na conversa: o contexto diz que as respostas anteriores continuam válidas e que a lista é nova', async () => {
    const ctx = await buildPapersContext(input({ userMessages: ['again', 'Find essential papers'], previousRun: run, previousRuns: [run] }))
    expect(ctx.text).toContain(REPEAT_SEARCH_NOTE)
    // "again" não traz assunto: vale para o escopo inteiro.
    expect(ctx.text).toContain(WHOLE_SCOPE_NOTE)
    // As linhas vêm antes do mapa de foco e dos candidatos.
    expect(ctx.text.indexOf(REPEAT_SEARCH_NOTE)).toBeLessThan(ctx.text.indexOf('Scope: notebook "Rust Lab"'))
    expect(ctx.text.indexOf(REPEAT_SEARCH_NOTE)).toBeLessThan(ctx.text.indexOf('Candidates — foundational'))
  })

  it('busca repetida com assunto próprio: só a linha da busca nova, sem a do escopo inteiro', async () => {
    const ctx = await buildPapersContext(input({ userMessages: ['papers on graph transformers', 'Find essential papers'], previousRun: run, previousRuns: [run] }))
    expect(ctx.text).toContain(REPEAT_SEARCH_NOTE)
    expect(ctx.text).not.toContain(WHOLE_SCOPE_NOTE)
  })

  it('a 1ª consulta da conversa não ganha as linhas de busca repetida', async () => {
    const ctx = await buildPapersContext(input({ userMessages: ['again'], previousRun: null, previousRuns: [] }))
    expect(ctx.text).not.toContain(REPEAT_SEARCH_NOTE)
    expect(ctx.text).not.toContain(WHOLE_SCOPE_NOTE)
  })

  it('o prompt proíbe retratar as respostas anteriores e pedir confirmação, e só ignora versões antigas do bloco', () => {
    const prompt = papersAgent.prompt?.('English') ?? ''
    expect(prompt).toContain('When the block says "This is a new search", the earlier answers in the conversation came from earlier searches the app made, and they are still valid.')
    expect(prompt).toContain('Never retract, correct or question papers from earlier answers')
    expect(prompt).toContain('do not ask the user to disregard them')
    expect(prompt).toContain('Never ask for confirmation before listing')
    expect(prompt).toContain('the search covers the whole scope: do not narrow the answer to the subject of an earlier question')
    expect(prompt).toContain('ignore older versions of the block itself, not the earlier answers in the conversation, which stay valid')
    expect(prompt).not.toContain('Ignore older versions of the block.')
  })

  it('escopo sem notas: o contexto e o prompt mandam escolher pelo assunto que o usuário nomeou, sem exigir ligação com o mapa de foco', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics')] }))
    plan = ['paper: transformers attention']
    const ctx = await buildPapersContext(input({ userMessages: ['transformers attention'] }))
    expect(ctx.text).toContain(
      'This scope has no notes yet: the search used only the subject in the user\'s message ("transformers attention"), so the focus map has nothing to connect to. Choose by that subject, not by the focus map: pick the candidates about "transformers attention" and say why they matter. Do not say that nothing fits while a candidate is about that subject.'
    )
    const prompt = papersAgent.prompt?.('English') ?? ''
    expect(prompt).toContain('When the block says the scope has no notes yet, there is nothing in the focus map to connect to: choose the candidates about the subject the user named')
    expect(prompt).toContain('never say that no candidate fits while one is about that subject')
  })

  it('avisa que vai buscar antes do planejador; o Stop durante ele descarta o resultado e nenhuma busca começa', async () => {
    const order: string[] = []
    mocks.invoke.mockImplementation(async (cmd: string) => {
      order.push(cmd)
      return plan
    })
    await buildPapersContext(input({ onSearchStart: () => order.push('start') }))
    expect(order).toEqual(['start', 'radar_plan_queries'])

    mocks.searchWorks.mockClear()
    const controller = new AbortController()
    mocks.invoke.mockImplementation(async () => {
      controller.abort()
      return plan
    })
    await expect(buildPapersContext(input({ signal: controller.signal }))).rejects.toThrow()
    expect(mocks.searchWorks).not.toHaveBeenCalled()
  })

  it('o prompt manda responder pela conversa, respeitar o Ignore e dizer "Search not done"', () => {
    const prompt = papersAgent.prompt?.('English') ?? ''
    expect(prompt).toContain('When the user asks about a paper already shown')
    expect(prompt).toContain('"Follow-up: the app did not search again"')
    expect(prompt).toContain('"Radar profile (ignore only)"')
    expect(prompt).toContain('"Search not done"')
  })
})
