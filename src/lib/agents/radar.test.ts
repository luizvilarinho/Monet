import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note, Notebook } from '../../types'
import type { AgentRun } from '../agentItems'
import type { PlanData } from './agentData'

// O pipeline do Radar com tudo de fora simulado (comando Rust, Tavily, OpenAlex,
// storage e KB): nenhum teste faz requisição.
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  webSearch: vi.fn(),
  searchWorks: vi.fn(),
  loadPlanData: vi.fn(),
  loadKbSourceFilenames: vi.fn(),
  getRadarLastRun: vi.fn(),
  setRadarLastRun: vi.fn(),
}))

vi.mock('@phosphor-icons/react', () => ({ Broadcast: () => null }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('../../storage', () => ({
  storage: { getRadarLastRun: mocks.getRadarLastRun, setRadarLastRun: mocks.setRadarLastRun },
}))
vi.mock('../search', () => ({
  webSearch: mocks.webSearch,
  hashUrlToFilename: async (url: string) => `h:${url}`,
}))
vi.mock('../openalex', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../openalex')>()),
  searchWorks: mocks.searchWorks,
}))
vi.mock('../librarian', () => ({ loadKbSourceFilenames: mocks.loadKbSourceFilenames }))
vi.mock('./agentData', () => ({ loadPlanData: mocks.loadPlanData }))

import { FOLLOW_UP_NOTE, REPEAT_SEARCH_NOTE, WHOLE_SCOPE_NOTE } from '../radar'
import { buildRadarContext, radarAgent, sinceSearch } from './radar'

const TODAY = '2026-11-20'

function notebook(id: string, name: string): Notebook {
  return { id, name, createdAt: 0, updatedAt: 0 }
}

const RUST = notebook('nb1', 'Rust Lab')
const OTHER = notebook('nb2', 'Physics')

function note(id: string, notebookId: string, title: string): Note {
  return { id, notebookId, title, content: '', tags: [], createdAt: 0, updatedAt: new Date(2026, 10, 10, 12).getTime() }
}

function planData(over: Partial<PlanData> = {}): PlanData {
  return {
    notes: [note('n1', 'nb1', 'Async runtimes'), note('n2', 'nb2', 'Optics')],
    defs: [],
    types: [],
    notebooks: [RUST, OTHER],
    disabledNotebookIds: new Set(),
    books: [],
    ...over,
  }
}

function input(over: Partial<Parameters<typeof buildRadarContext>[0]> = {}) {
  return {
    todayKey: TODAY,
    notebookId: 'nb1',
    folderName: null,
    userMessages: ["What's new?"],
    signal: new AbortController().signal,
    ...over,
  }
}

const WEB = (n: number, date = '2026-11-18') => ({
  title: `Post ${n}`,
  url: `https://example.com/post-${n}`,
  content: `content ${n}`,
  publishedDate: date,
})

const PAPER = (n: number) => ({
  kind: 'paper' as const,
  section: 'radar' as const,
  id: `doi:10.1000/p${n}`,
  openalexId: `W${n}`,
  title: `Paper ${n}`,
  authors: ['Ana Smith'],
  authorCount: 1,
  year: 2026,
  date: '2026-11-01',
  doi: `10.1000/p${n}`,
  url: `https://doi.org/10.1000/p${n}`,
  citations: 3,
  type: 'article',
  isOa: true,
  pdfUrl: null,
  oaUrl: null,
  abstract: 'About it.',
})

let plan: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  plan = ['news: tokio runtime', 'release: rust compiler', 'paper: structured concurrency']
  mocks.invoke.mockImplementation(async (cmd: string) => (cmd === 'radar_plan_queries' ? plan : undefined))
  mocks.loadPlanData.mockResolvedValue(planData())
  mocks.loadKbSourceFilenames.mockResolvedValue(new Set())
  mocks.getRadarLastRun.mockResolvedValue(null)
  mocks.setRadarLastRun.mockResolvedValue(undefined)
  mocks.webSearch.mockImplementation(async (q: string) => [WEB(q === 'tokio runtime' ? 1 : 2)])
  mocks.searchWorks.mockResolvedValue([PAPER(1)])
})

describe('radarAgent', () => {
  it('roda o pipeline do app: sem RAG, web nem deep research, e exige a chave do Tavily', () => {
    expect(radarAgent.command).toBe('/radar')
    expect(radarAgent.context).toEqual({ rag: false, web: false, deepResearch: false })
    expect(radarAgent.webPipeline).toEqual({ needsTavily: true, status: 'Searching news, releases and papers…' })
    expect(radarAgent.forceTrackersTool).toBe(false)
  })
})

describe('buildRadarContext', () => {
  it('monta janela, mapa de foco, linhas das buscas e os candidatos numerados', async () => {
    const out = await buildRadarContext(input())
    expect(out.text.startsWith('Radar context\nWindow: since 21/10/2026 (first check of this scope: last 30 days)\n')).toBe(true)
    expect(out.text).toContain('Scope: notebook "Rust Lab" (from the chat folder)')
    expect(out.text).toContain('Web search: 2 queries (1 news, 1 releases)')
    expect(out.text).toContain('Papers search (OpenAlex): 1 queries')
    expect(out.text).toContain('Candidates — web (published since 21/10/2026; older and undated results were removed by the app):')
    expect(out.text).toContain('[W1] News · "Post 1" · example.com · 18/11/2026')
    expect(out.text).toContain('[W2] Releases · "Post 2" · example.com · 18/11/2026')
    expect(out.text).toContain('Candidates — papers (published since 21/10/2026):')
    expect(out.text).toContain('[P1] "Paper 1" · Smith · 2026 · article · 3 citations · open access')
    expect(out.items?.items.map((i) => i.key)).toEqual(['W1', 'W2', 'P1'])
    expect(out.items).toMatchObject({ max: 8, scopeNotebookId: 'nb1' })
  })

  it('manda ao modelo de consultas o mapa de foco e a janela, e às buscas só os termos', async () => {
    await buildRadarContext(input({ userMessages: ['  only   rust please '] }))
    const call = mocks.invoke.mock.calls.find((c) => c[0] === 'radar_plan_queries')
    expect(call?.[1]).toMatchObject({
      kind: 'radar',
      instruction: 'only rust please',
      since: '2026-10-21',
      currentDate: TODAY,
    })
    expect(call?.[1].focus).toContain('Scope: notebook "Rust Lab"')
    expect(mocks.webSearch).toHaveBeenCalledWith('tokio runtime', 5, false, expect.any(AbortSignal), {
      topic: 'news',
      startDate: '2026-10-21',
      filterByDate: true,
    })
    expect(mocks.webSearch).toHaveBeenCalledWith('rust compiler', 5, false, expect.any(AbortSignal), {
      topic: 'general',
      startDate: '2026-10-21',
      filterByDate: true,
    })
    expect(mocks.searchWorks).toHaveBeenCalledWith(
      { query: 'structured concurrency', fromDate: '2026-10-21', perPage: 10, section: 'radar' },
      expect.any(AbortSignal)
    )
  })

  it('usa a data da última consulta do escopo', async () => {
    mocks.getRadarLastRun.mockResolvedValue('2026-11-12')
    const out = await buildRadarContext(input())
    expect(mocks.getRadarLastRun).toHaveBeenCalledWith('notebook:nb1')
    expect(out.text).toContain('Window: since 12/11/2026 (last check: 12/11/2026)')
    expect(mocks.webSearch.mock.calls[0][4]).toMatchObject({ startDate: '2026-11-12' })
  })

  it('respeita os tetos: 3 + 3 buscas no Tavily e 3 no OpenAlex', async () => {
    plan = [
      ...Array.from({ length: 5 }, (_, i) => `news: news topic ${i}`),
      ...Array.from({ length: 5 }, (_, i) => `release: release topic ${i}`),
      ...Array.from({ length: 5 }, (_, i) => `paper: paper topic ${i}`),
    ]
    await buildRadarContext(input())
    expect(mocks.webSearch).toHaveBeenCalledTimes(6)
    expect(mocks.searchWorks).toHaveBeenCalledTimes(3)
  })

  it('sem consulta do modelo, busca pelos assuntos do mapa de foco (sem releases)', async () => {
    plan = []
    await buildRadarContext(input())
    const queries = mocks.webSearch.mock.calls.map((c) => c[0])
    expect(queries).toContain('Rust Lab')
    expect(mocks.webSearch.mock.calls.every((c) => c[4].topic === 'news')).toBe(true)
    expect(mocks.searchWorks.mock.calls.map((c) => c[0].query)).toContain('Rust Lab')
  })

  it('consulta que copia o mapa de foco não sai do app', async () => {
    plan = ['news: Scope notebook Rust Lab from the chat folder', 'news: tokio runtime']
    await buildRadarContext(input())
    expect(mocks.webSearch.mock.calls.map((c) => c[0])).toEqual(['tokio runtime'])
  })

  it('só entra o resultado com data na janela, e o que já está na KB sai', async () => {
    mocks.webSearch.mockResolvedValue([WEB(1), WEB(2, '2026-09-01'), { ...WEB(3), publishedDate: undefined }, WEB(4)])
    mocks.loadKbSourceFilenames.mockResolvedValue(new Set(['h:https://example.com/post-4']))
    const out = await buildRadarContext(input())
    expect(out.items?.items.filter((i) => i.kind === 'web').map((i) => i.title)).toEqual(['Post 1'])
  })

  it('a data só avança com o onDone, e só quando alguma busca deu certo', async () => {
    const out = await buildRadarContext(input())
    expect(mocks.setRadarLastRun).not.toHaveBeenCalled()
    await out.onDone?.()
    expect(mocks.setRadarLastRun).toHaveBeenCalledWith('notebook:nb1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('busca sem resultado ainda conta como consulta concluída', async () => {
    mocks.webSearch.mockResolvedValue([])
    mocks.searchWorks.mockResolvedValue([])
    const out = await buildRadarContext(input())
    expect(out.items?.items).toEqual([])
    expect(out.text).toContain('(none)')
    expect(out.onDone).toBeDefined()
  })

  it('todas as buscas falham: sem onDone, e o texto diz o motivo', async () => {
    mocks.webSearch.mockRejectedValue(new Error('Tavily error 500'))
    mocks.searchWorks.mockRejectedValue(new Error('boom'))
    const out = await buildRadarContext(input())
    expect(out.onDone).toBeUndefined()
    expect(out.text).toContain('Web search: 2 queries (1 news, 1 releases), 2 failed')
    expect(out.text).toContain('Papers search (OpenAlex): 1 queries, 1 failed: OpenAlex search failed.')
  })

  it('sem plano e sem reserva útil, a busca não roda, a data não avança e o contexto diz o motivo', async () => {
    plan = []
    // Escopo "tudo", sem perfil, tags nem caderno editado nos últimos 30 dias: nenhum assunto.
    const old = { ...note('n1', 'nb1', 'Old note'), updatedAt: new Date(2025, 0, 1, 12).getTime() }
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [old] }))
    const out = await buildRadarContext(input({ notebookId: null, userMessages: ['x'] }))
    expect(out.text).toBe('Radar context\nScope: all notebooks\nSearch not done: could not plan the searches. Try again.')
    expect(mocks.webSearch).not.toHaveBeenCalled()
    expect(mocks.searchWorks).not.toHaveBeenCalled()
    expect(out.items).toBeUndefined()
    expect(out.onDone).toBeUndefined()
  })

  it('o planejador falhou no escopo "tudo": nome de caderno nunca vira consulta (só o Follow e as tags)', async () => {
    mocks.invoke.mockRejectedValue(new Error('openrouter down'))
    const tagged = { ...note('n1', 'nb1', 'Async runtimes'), tags: ['tokio'] }
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [tagged, note('n2', 'nb2', 'Optics')] }))
    await buildRadarContext(input({ notebookId: null }))
    const queries = [...mocks.webSearch.mock.calls.map((c) => c[0]), ...mocks.searchWorks.mock.calls.map((c) => c[0].query)]
    expect(queries.length).toBeGreaterThan(0)
    expect(new Set(queries)).toEqual(new Set(['tokio']))
  })

  it('o planejador falhou no escopo de caderno: o nome entra só com 2+ palavras, e o Follow do perfil nunca', async () => {
    mocks.invoke.mockRejectedValue(new Error('openrouter down'))
    const profile = { ...note('p1', 'nb2', 'Radar profile'), tags: ['radar profile'], content: 'Follow: WebAssembly' }
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n1', 'nb1', 'Async runtimes'), profile] }))
    await buildRadarContext(input())
    expect(mocks.webSearch.mock.calls.map((c) => c[0])).toEqual(['Rust Lab'])
    // Caderno de uma palavra só não é assunto, e sem o Follow não sobra consulta: a busca não roda.
    mocks.webSearch.mockClear()
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics'), profile] }))
    const out = await buildRadarContext(input({ notebookId: 'nb2' }))
    expect(mocks.webSearch).not.toHaveBeenCalled()
    expect(out.text).toContain('Search not done: could not plan the searches. Try again.')
  })

  it('o planejador falhou no escopo "tudo": o Follow do perfil vira consulta de reserva', async () => {
    mocks.invoke.mockRejectedValue(new Error('openrouter down'))
    const profile = { ...note('p1', 'nb2', 'Radar profile'), tags: ['radar profile'], content: 'Follow: WebAssembly' }
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n1', 'nb1', 'Async runtimes'), profile] }))
    await buildRadarContext(input({ notebookId: null }))
    expect(mocks.webSearch.mock.calls.map((c) => c[0])).toEqual(['WebAssembly'])
  })

  it('consulta de reserva busca e mostra os itens, mas não avança a data', async () => {
    mocks.invoke.mockRejectedValue(new Error('openrouter down'))
    const out = await buildRadarContext(input())
    expect(mocks.webSearch).toHaveBeenCalled()
    expect(out.items?.items.length).toBeGreaterThan(0)
    expect(out.items?.search?.queries).toEqual(['Rust Lab'])
    expect(out.onDone).toBeUndefined()
    expect(mocks.setRadarLastRun).not.toHaveBeenCalled()
  })

  it('consulta do plano do modelo avança a data para hoje, sem nunca recuar a registrada', async () => {
    const out = await buildRadarContext(input())
    await out.onDone?.()
    expect(mocks.setRadarLastRun).toHaveBeenLastCalledWith('notebook:nb1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    mocks.setRadarLastRun.mockClear()
    mocks.getRadarLastRun.mockResolvedValue('2999-01-01')
    const future = await buildRadarContext(input())
    await future.onDone?.()
    expect(mocks.setRadarLastRun).toHaveBeenCalledWith('notebook:nb1', '2999-01-01')
  })

  it('o Stop cancela: o AbortError sobe e nada é gravado', async () => {
    const controller = new AbortController()
    mocks.webSearch.mockImplementation(async () => {
      controller.abort()
      return [WEB(1)]
    })
    await expect(buildRadarContext(input({ signal: controller.signal }))).rejects.toThrow()
    expect(mocks.setRadarLastRun).not.toHaveBeenCalled()
  })

  it('o Stop durante o planejador de consultas (que não cancela): o resultado é descartado e nenhuma busca começa', async () => {
    const controller = new AbortController()
    mocks.invoke.mockImplementation(async () => {
      controller.abort() // o Stop chega enquanto o comando ainda roda; ele devolve o plano mesmo assim
      return plan
    })
    await expect(buildRadarContext(input({ signal: controller.signal }))).rejects.toThrow()
    expect(mocks.webSearch).not.toHaveBeenCalled()
    expect(mocks.searchWorks).not.toHaveBeenCalled()
    expect(mocks.setRadarLastRun).not.toHaveBeenCalled()
  })

  it('o Stop antes do planejador: o comando nem é chamado', async () => {
    const controller = new AbortController()
    controller.abort()
    const onSearchStart = vi.fn()
    await expect(buildRadarContext(input({ signal: controller.signal, onSearchStart }))).rejects.toThrow()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(onSearchStart).not.toHaveBeenCalled()
  })

  it('avisa que vai buscar logo antes do planejador de consultas, uma vez', async () => {
    const order: string[] = []
    mocks.invoke.mockImplementation(async (cmd: string) => {
      order.push(cmd)
      return plan
    })
    await buildRadarContext(input({ onSearchStart: () => order.push('start') }))
    expect(order).toEqual(['start', 'radar_plan_queries'])
  })

  it('só avisa que vai buscar quando o pipeline mesmo roda (não no aviso de IA desligada nem no escopo vazio)', async () => {
    const onSearchStart = vi.fn()
    mocks.loadPlanData.mockResolvedValue(planData({ disabledNotebookIds: new Set(['nb1']) }))
    await buildRadarContext(input({ onSearchStart }))
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics')] }))
    await buildRadarContext(input({ onSearchStart }))
    expect(onSearchStart).not.toHaveBeenCalled()
  })

  it('artigo com data de publicação futura não é novidade; sem data ou de hoje entra', async () => {
    mocks.searchWorks.mockResolvedValue([
      { ...PAPER(1), date: '2026-12-15' },
      { ...PAPER(2), date: TODAY },
      { ...PAPER(3), date: null },
      PAPER(4),
    ])
    const out = await buildRadarContext(input())
    expect(out.items?.items.filter((i) => i.kind === 'paper').map((i) => i.title)).toEqual(['Paper 2', 'Paper 3', 'Paper 4'])
  })

  it('caderno com a IA desligada: só o aviso, sem busca nem onDone', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ disabledNotebookIds: new Set(['nb1']) }))
    const out = await buildRadarContext(input())
    expect(out.text).toBe(
      'Radar context\nScope: notebook "Rust Lab"\nAI is turned off for this notebook in Settings, so the Radar does not read it. Say so in one line and ask the user to pick another notebook or turn AI on.'
    )
    expect(out.items).toBeUndefined()
    expect(out.onDone).toBeUndefined()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.webSearch).not.toHaveBeenCalled()
  })

  it('escopo sem notas: só o aviso, sem busca nem onDone', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics')] }))
    const out = await buildRadarContext(input())
    expect(out.text).toContain('This scope has no notes yet')
    expect(out.items).toBeUndefined()
    expect(out.onDone).toBeUndefined()
    expect(mocks.webSearch).not.toHaveBeenCalled()
  })

  it('avisa quando o escopo muda entre uma mensagem e outra', async () => {
    const out = await buildRadarContext(input({ userMessages: ['notebook "Physics"', "What's new?"] }))
    expect(out.text).toContain('Scope changed: notebook "Rust Lab" → notebook "Physics".')
    expect(out.text).toContain('Scope: notebook "Physics" (from your message)')
    expect(mocks.getRadarLastRun).toHaveBeenCalledWith('notebook:nb2')
  })

  it('escopo "tudo" pela mensagem usa a chave all', async () => {
    await buildRadarContext(input({ userMessages: ['everything'] }))
    expect(mocks.getRadarLastRun).toHaveBeenCalledWith('all')
  })
})

describe('buildRadarContext: dados da consulta e escopo sem notas', () => {
  it('o payload guarda o rótulo do escopo, o since, a nota da janela e as consultas que rodaram', async () => {
    const out = await buildRadarContext(input())
    expect(out.items?.search).toEqual({
      scopeKey: 'notebook:nb1',
      scopeLabel: 'notebook "Rust Lab"',
      since: '2026-10-21',
      windowNote: 'first check of this scope: last 30 days',
      queries: ['tokio runtime', 'rust compiler', 'structured concurrency'],
      profile: false,
      hasProfileNote: false,
    })
  })

  it('o texto das consultas entra no contexto do modelo', async () => {
    const out = await buildRadarContext(input())
    expect(out.text).toContain('Queries searched: tokio runtime; rust compiler; structured concurrency')
  })

  it('só as consultas cuja busca deu certo entram; se nenhuma deu, não há payload nem data', async () => {
    mocks.webSearch.mockImplementation(async (q: string) => {
      if (q === 'rust compiler') throw new Error('Tavily error 500')
      return [WEB(1)]
    })
    const partial = await buildRadarContext(input())
    expect(partial.items?.search?.queries).toEqual(['tokio runtime', 'structured concurrency'])
    expect(partial.onDone).toBeDefined()

    mocks.webSearch.mockRejectedValue(new Error('Tavily error 500'))
    mocks.searchWorks.mockRejectedValue(new Error('boom'))
    const none = await buildRadarContext(input())
    expect(none.items).toBeUndefined()
    expect(none.onDone).toBeUndefined()
    expect(none.text).not.toContain('Queries searched')
  })

  it('o perfil do Radar é marcado no payload só quando alguma linha dele entrou', async () => {
    const profile = (content: string) => ({ ...note('p1', 'nb2', 'Radar profile'), tags: ['radar profile'], content })
    const withProfile = (content: string) =>
      mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n1', 'nb1', 'Async runtimes'), profile(content)] }))
    // Caderno: só o Follow não entra, então não é "radar profile"; com Sources ou Ignore, é.
    withProfile('Follow: WebAssembly')
    expect((await buildRadarContext(input())).items?.search?.profile).toBe(false)
    withProfile('Follow: WebAssembly\nIgnore: crypto')
    expect((await buildRadarContext(input())).items?.search?.profile).toBe(true)
    withProfile('Follow: WebAssembly\nSources: lwn.net')
    expect((await buildRadarContext(input())).items?.search?.profile).toBe(true)
    // "Tudo": o perfil inteiro vale.
    withProfile('Follow: WebAssembly')
    expect((await buildRadarContext(input({ notebookId: null }))).items?.search?.profile).toBe(true)
  })

  it('"First check of this scope" só aparece sem consulta anterior do escopo (a proposta de perfil depende dele)', async () => {
    const first = await buildRadarContext(input())
    expect(first.text).toContain('First check of this scope: yes')
    mocks.getRadarLastRun.mockResolvedValue('2026-11-12')
    const later = await buildRadarContext(input())
    expect(later.text).not.toContain('First check')
  })

  it('escopo sem notas e mensagem com assunto: busca pelo assunto em vez de recusar', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics')] }))
    plan = ['news: graph neural networks', 'paper: graph neural networks']
    const out = await buildRadarContext(input({ userMessages: ["What's new in graph neural networks?"] }))
    const call = mocks.invoke.mock.calls.find((c) => c[0] === 'radar_plan_queries')
    expect(call?.[1].instruction).toBe("What's new in graph neural networks?")
    expect(out.text).not.toContain('This scope has no notes yet, so')
    expect(out.text).toContain('This scope has no notes yet: the search used only the subject in the user\'s message ("graph neural networks")')
    expect(mocks.webSearch.mock.calls.map((c) => c[0])).toEqual(['graph neural networks'])
    expect(out.items?.search?.queries).toEqual(['graph neural networks'])
    expect(out.onDone).toBeDefined()
  })

  it('escopo sem notas e planejador fora do ar: o assunto da mensagem é a reserva (e não avança a data)', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [] }))
    mocks.invoke.mockRejectedValue(new Error('openrouter down'))
    const out = await buildRadarContext(input({ notebookId: null, userMessages: ['novidades sobre redes neurais'] }))
    expect(mocks.webSearch.mock.calls.map((c) => c[0])).toEqual(['redes neurais'])
    expect(out.onDone).toBeUndefined()
  })

  it('o assunto tirado da mensagem passa pelo cleanQueries (palavras demais não saem do app)', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [] }))
    plan = []
    const long = 'tokio runtime scheduler internals benchmarks results comparisons latency throughput fairness preemption cooperative budgeting'
    const out = await buildRadarContext(input({ notebookId: null, userMessages: [`what is new about ${long}`] }))
    expect(mocks.webSearch).not.toHaveBeenCalled()
    expect(out.text).toContain('Search not done: could not plan the searches. Try again.')
  })

  it('escopo sem notas e só o pedido padrão: continua recusando, sem busca', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics')] }))
    const out = await buildRadarContext(input({ userMessages: ["What's new?"] }))
    expect(out.text).toContain('This scope has no notes yet, so')
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.webSearch).not.toHaveBeenCalled()
  })
})

describe('buildRadarContext: janela da conversa e janela pedida', () => {
  const TODAY_RUN = (since = '2026-10-21', note = 'first check of this scope: last 30 days') => ({
    ranOn: TODAY,
    search: { scopeKey: 'notebook:nb1', scopeLabel: 'notebook "Rust Lab"', since, windowNote: note, queries: ['tokio runtime'], profile: false },
  })
  // A conversa tem só esta consulta: ela é a última e a única.
  const after = (run: AgentRun) => ({ previousRun: run, previousRuns: [run] })

  it('a janela da 1ª consulta da conversa não encolhe, mesmo com a data do escopo já avançada para hoje', async () => {
    mocks.getRadarLastRun.mockResolvedValue(TODAY)
    const out = await buildRadarContext(input({ userMessages: ["What's new?"], ...after(TODAY_RUN()) }))
    expect(out.text).toContain('Window: since 21/10/2026 (first check of this scope: last 30 days; same window as the earlier search in this conversation)')
    expect(mocks.webSearch.mock.calls[0][4]).toMatchObject({ startDate: '2026-10-21' })
    expect(out.items?.search).toMatchObject({ since: '2026-10-21', windowNote: 'first check of this scope: last 30 days' })
  })

  it('a janela da conversa também passa adiante (a 3ª consulta usa a mesma da 1ª)', async () => {
    mocks.getRadarLastRun.mockResolvedValue(TODAY)
    const second = await buildRadarContext(input({ userMessages: ["What's new?"], ...after(TODAY_RUN()) }))
    const third = await buildRadarContext(
      input({ userMessages: ['and again'], ...after({ ranOn: TODAY, search: second.items!.search! }) })
    )
    expect(third.items?.search?.since).toBe('2026-10-21')
  })

  it('voltar a um escopo já consultado na conversa e no dia mantém a janela dele (ML, depois #rust, depois ML)', async () => {
    mocks.getRadarLastRun.mockResolvedValue(TODAY) // a data de "notebook:nb1" já avançou para hoje
    const tagRun = {
      ranOn: TODAY,
      search: { scopeKey: 'tag:rust', scopeLabel: 'tag #rust', since: '2026-11-19', windowNote: 'last check: 19/11/2026', queries: ['rust'], profile: false },
    }
    const out = await buildRadarContext(
      input({ userMessages: ["What's new?", 'and #rust?', "What's new?"], previousRun: tagRun, previousRuns: [tagRun, TODAY_RUN()] })
    )
    expect(out.text).toContain('Window: since 21/10/2026 (first check of this scope: last 30 days; same window as the earlier search in this conversation)')
    expect(mocks.webSearch.mock.calls[0][4]).toMatchObject({ startDate: '2026-10-21' })
    expect(out.items?.search).toMatchObject({ scopeKey: 'notebook:nb1', since: '2026-10-21' })
  })

  it('a janela pedida em mensagem anterior não aparece como pedida na mensagem de agora', async () => {
    mocks.getRadarLastRun.mockResolvedValue(TODAY)
    const asked = TODAY_RUN('2026-11-01', 'asked in your message')
    const out = await buildRadarContext(input({ userMessages: ["What's new?"], ...after(asked) }))
    expect(out.text).toContain('Window: since 01/11/2026 (asked in an earlier message; same window as the earlier search in this conversation)')
    expect(out.items?.search).toMatchObject({ since: '2026-11-01', windowNote: 'asked in an earlier message' })
  })

  it('em outro escopo ou em outro dia, a janela volta a ser desde a última consulta do escopo', async () => {
    mocks.getRadarLastRun.mockResolvedValue('2026-11-19')
    const otherScope = await buildRadarContext(
      input({ userMessages: ['notebook "Physics"'], ...after(TODAY_RUN()) })
    )
    expect(otherScope.text).toContain('Window: since 19/11/2026 (last check: 19/11/2026)')
    const nextDay = await buildRadarContext(
      input({ userMessages: ['what changed?'], ...after({ ...TODAY_RUN(), ranOn: '2026-11-19' }) })
    )
    expect(nextDay.text).toContain('Window: since 19/11/2026 (last check: 19/11/2026)')
  })

  it('data na mensagem substitui a janela, com o teto de 90 dias', async () => {
    mocks.getRadarLastRun.mockResolvedValue('2026-11-12')
    const out = await buildRadarContext(input({ userMessages: ['what is new since 01/11'] }))
    expect(out.text).toContain('Window: since 01/11/2026 (asked in your message)')
    expect(mocks.webSearch.mock.calls[0][4]).toMatchObject({ startDate: '2026-11-01' })
    expect(mocks.searchWorks.mock.calls[0][0]).toMatchObject({ fromDate: '2026-11-01' })
    expect(out.items?.search).toMatchObject({ since: '2026-11-01', windowNote: 'asked in your message' })

    const capped = await buildRadarContext(input({ userMessages: ['last 365 days'] }))
    expect(capped.text).toContain('Window: since 22/08/2026 (asked in your message: last 365 days; capped at 90 days)')
  })

  it('a janela pedida vale sobre a da conversa, e a data registrada só avança (hoje)', async () => {
    mocks.getRadarLastRun.mockResolvedValue('2026-11-15')
    const out = await buildRadarContext(
      input({ userMessages: ['since 2026-11-01'], ...after(TODAY_RUN('2026-11-10', 'last check: 10/11/2026')) })
    )
    expect(out.items?.search?.since).toBe('2026-11-01')
    await out.onDone?.()
    const [, saved] = mocks.setRadarLastRun.mock.calls[0]
    expect(saved >= '2026-11-15').toBe(true)
  })
})

describe('buildRadarContext: seguimento sem nova busca', () => {
  const run = {
    ranOn: TODAY,
    search: {
      scopeKey: 'notebook:nb1',
      scopeLabel: 'notebook "Rust Lab"',
      since: '2026-11-13',
      windowNote: 'last check: 13/11/2026',
      queries: ['tokio runtime', 'rust compiler'],
      profile: false,
    },
  }

  it('"obrigado" depois de uma consulta não roda o pipeline nem avança a data (nem acende o status de busca)', async () => {
    const onSearchStart = vi.fn()
    const out = await buildRadarContext(input({ userMessages: ['thanks', "What's new?"], previousRun: run, onSearchStart }))
    expect(onSearchStart).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.webSearch).not.toHaveBeenCalled()
    expect(mocks.searchWorks).not.toHaveBeenCalled()
    expect(mocks.getRadarLastRun).not.toHaveBeenCalled()
    expect(out.items).toBeUndefined()
    expect(out.onDone).toBeUndefined()
  })

  it('o contexto diz que não há candidatos novos e repete escopo, janela e consultas da consulta anterior', async () => {
    const out = await buildRadarContext(input({ userMessages: ['continue'], previousRun: run }))
    expect(out.text).toBe(
      [
        'Radar context',
        'Scope: notebook "Rust Lab"',
        'Window: since 13/11/2026 (last check: 13/11/2026)',
        'Queries searched: tokio runtime; rust compiler',
        FOLLOW_UP_NOTE,
      ].join('\n')
    )
    expect(FOLLOW_UP_NOTE).toContain('say in one line that they can ask "again"')
  })

  it('sem consulta anterior, "obrigado" roda o pipeline como sempre', async () => {
    await buildRadarContext(input({ userMessages: ['thanks'], previousRun: null }))
    expect(mocks.webSearch).toHaveBeenCalled()
  })

  it('escopo explícito ou data na mensagem não é seguimento', async () => {
    await buildRadarContext(input({ userMessages: ['ok since 01/11'], previousRun: run }))
    expect(mocks.webSearch).toHaveBeenCalled()
    mocks.webSearch.mockClear()
    await buildRadarContext(input({ userMessages: ['notebook "Physics"'], previousRun: run }))
    expect(mocks.webSearch).toHaveBeenCalled()
  })

  it('pedir para refazer ("try again", "de novo") e a mensagem padrão rodam o pipeline, na janela da conversa', async () => {
    mocks.getRadarLastRun.mockResolvedValue(TODAY)
    for (const message of ['try again', 'again', 'de novo', 'tenta de novo', 'refresh', "What's new?"]) {
      mocks.webSearch.mockClear()
      const out = await buildRadarContext(input({ userMessages: [message], previousRun: run, previousRuns: [run] }))
      expect(mocks.webSearch, message).toHaveBeenCalled()
      expect(mocks.webSearch.mock.calls[0][4], message).toMatchObject({ startDate: '2026-11-13' })
      expect(out.items, message).toBeDefined()
    }
  })

  it('uma pergunta sobre um item já mostrado não roda o pipeline: o modelo responde pela conversa', async () => {
    const messages = ['tell me more about the second one', 'the 2nd item', 'esse artigo é aberto?', 'o 2º', 'summarize', 'por que o terceiro?']
    for (const message of messages) {
      const out = await buildRadarContext(input({ userMessages: [message, "What's new?"], previousRun: run, previousRuns: [run] }))
      expect(out.text, message).toContain(FOLLOW_UP_NOTE)
      expect(out.items, message).toBeUndefined()
      expect(out.onDone, message).toBeUndefined()
    }
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.webSearch).not.toHaveBeenCalled()
    expect(mocks.searchWorks).not.toHaveBeenCalled()
    expect(mocks.setRadarLastRun).not.toHaveBeenCalled()
  })

  it('uma pergunta nova com assunto próprio roda o pipeline, na janela da conversa', async () => {
    mocks.getRadarLastRun.mockResolvedValue(TODAY)
    const out = await buildRadarContext(
      input({ userMessages: ["what's new about transformers?"], previousRun: run, previousRuns: [run] })
    )
    expect(mocks.webSearch.mock.calls[0][4]).toMatchObject({ startDate: '2026-11-13' })
    expect(out.items).toBeDefined()
  })

  it('o aviso de IA desligada vale também no seguimento', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ disabledNotebookIds: new Set(['nb1']) }))
    const out = await buildRadarContext(input({ userMessages: ['thanks'], previousRun: run }))
    expect(out.text).toContain('AI is turned off for this notebook')
  })
})

describe('buildRadarContext: o perfil do Radar em caderno, tag ou board', () => {
  const profile = (content: string, tags = ['radar profile']) => ({ ...note('p1', 'nb2', 'Radar profile'), tags, content })
  const FULL = 'Follow: WebAssembly, Rust async\nSources: lwn.net\nIgnore: crypto'
  const planFocus = () => (mocks.invoke.mock.calls.find((c) => c[0] === 'radar_plan_queries')?.[1] as { focus: string }).focus

  it('o Follow não vai ao gerador de consultas nem ao modelo do chat; Sources e Ignore vão, com o rótulo que diz isso', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n1', 'nb1', 'Async runtimes'), profile(FULL)] }))
    const out = await buildRadarContext(input())
    for (const text of [planFocus(), out.text]) {
      expect(text).toContain('Radar profile (sources and ignore only):\nSources: lwn.net\nIgnore: crypto')
      expect(text).not.toContain('WebAssembly')
      expect(text).not.toContain('Follow:')
    }
    expect(out.items?.search?.profile).toBe(true)
  })

  it('a tag e o board também: o Follow fica de fora', async () => {
    const tagged = { ...note('n1', 'nb1', 'Async runtimes'), tags: ['tokio'] }
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [tagged, profile(FULL)] }))
    const tag = await buildRadarContext(input({ userMessages: ['what is new in #tokio'] }))
    expect(tag.text).toContain('Scope: tag #tokio')
    expect(tag.text).toContain('Radar profile (sources and ignore only):')
    expect(tag.text).not.toContain('WebAssembly')

    const type = { id: 't1', name: 'Paper', icon: null, color: null, template: null, sortOrder: 0, builtin: false, createdAt: 0, board: { columnDefId: 'd1', sectionDefId: null, cardDefIds: [], showTags: true, hideEmpty: false, filterDefId: null }, log: null }
    const status = { id: 'd1', name: 'Status', type: 'select' as const, sortOrder: 1, createdAt: 0, scope: 'note' as const, noteTypeId: 't1', options: [{ id: 'o1', name: 'Reading', color: null }], showInList: false }
    const card = { ...note('n3', 'nb1', 'Graph paper'), typeId: 't1', properties: { d1: 'o1' } }
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [card, profile(FULL)], types: [type], defs: [status] }))
    const board = await buildRadarContext(input({ userMessages: ['what is new in board "Paper"'] }))
    expect(board.text).toContain('Scope: board "Paper"')
    expect(board.text).toContain('Radar profile (sources and ignore only):')
    expect(board.text).not.toContain('WebAssembly')
  })

  it('o perfil só com Follow: o contexto diz que o perfil existe e que não se propõe outro, sem o Follow nem o "none", e sem marcar "radar profile"', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n1', 'nb1', 'Async runtimes'), profile('Follow: WebAssembly')] }))
    const out = await buildRadarContext(input())
    for (const text of [planFocus(), out.text]) {
      expect(text).toContain(
        'Radar profile: saved. Its Follow line applies only to the "all notebooks" scope, so nothing from it is used here. Do not propose a profile.'
      )
      expect(text).not.toContain('Radar profile: none.')
      expect(text).not.toContain('WebAssembly')
    }
    expect(out.items?.search?.profile).toBe(false)
    expect(out.items?.search?.hasProfileNote).toBe(true)
  })

  it('hasProfileNote: true com qualquer nota de perfil (entrando linha ou não, em caderno ou em "tudo"); sem nota, false e a linha "none"', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n1', 'nb1', 'Async runtimes'), profile(FULL)] }))
    const narrow = await buildRadarContext(input())
    expect(narrow.items?.search).toMatchObject({ profile: true, hasProfileNote: true })
    expect(narrow.text).not.toContain('Radar profile: saved.')
    const all = await buildRadarContext(input({ notebookId: null }))
    expect(all.items?.search).toMatchObject({ profile: true, hasProfileNote: true })

    mocks.loadPlanData.mockResolvedValue(planData())
    const none = await buildRadarContext(input())
    expect(none.text).toContain('Radar profile: none.')
    expect(none.items?.search).toMatchObject({ profile: false, hasProfileNote: false })
  })

  it('em "tudo" o perfil inteiro continua valendo, com o Follow', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n1', 'nb1', 'Async runtimes'), profile(FULL)] }))
    const out = await buildRadarContext(input({ notebookId: null }))
    expect(planFocus()).toContain('Radar profile:\nFollow: WebAssembly, Rust async')
    expect(out.text).toContain('Radar profile:\nFollow: WebAssembly, Rust async')
    expect(out.items?.search?.profile).toBe(true)
  })

  it('caderno sem notas é vazio mesmo com perfil: sem assunto na mensagem, recusa e não busca', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics'), profile(FULL)] }))
    const out = await buildRadarContext(input())
    expect(out.text).toContain('This scope has no notes yet, so')
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.webSearch).not.toHaveBeenCalled()
    expect(out.items).toBeUndefined()
  })

  it('caderno sem notas, com perfil e assunto na mensagem: busca pelo assunto, sem os assuntos do perfil', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics'), profile(FULL)] }))
    mocks.invoke.mockRejectedValue(new Error('openrouter down'))
    const out = await buildRadarContext(input({ userMessages: ["what's new about rust async"] }))
    // O assunto da mensagem vem primeiro, depois só o nome do caderno: nunca os assuntos do perfil.
    expect(mocks.webSearch.mock.calls.map((c) => c[0])).toEqual(['rust async', 'Rust Lab'])
    expect(out.text).not.toContain('WebAssembly')
    expect(out.text).toContain('This scope has no notes yet: the search used only the subject')
  })
})

describe('buildRadarContext: busca repetida na conversa', () => {
  const run = {
    ranOn: TODAY,
    search: {
      scopeKey: 'notebook:nb1',
      scopeLabel: 'notebook "Rust Lab"',
      since: '2026-11-13',
      windowNote: 'last check: 13/11/2026',
      queries: ['tokio runtime'],
      profile: false,
    },
  }

  it('"again" e "since 01/11" numa conversa com consulta: o contexto diz que as respostas anteriores continuam válidas e que vale o escopo inteiro', async () => {
    for (const message of ['again', 'since 01/11']) {
      const out = await buildRadarContext(input({ userMessages: [message, "What's new?"], previousRun: run, previousRuns: [run] }))
      expect(out.text, message).toContain(REPEAT_SEARCH_NOTE)
      expect(out.text, message).toContain(WHOLE_SCOPE_NOTE)
      // Antes do mapa de foco e dos candidatos.
      expect(out.text.indexOf(REPEAT_SEARCH_NOTE), message).toBeLessThan(out.text.indexOf('Scope: notebook "Rust Lab"'))
      expect(out.text.indexOf(WHOLE_SCOPE_NOTE), message).toBeLessThan(out.text.indexOf('Candidates — web'))
    }
  })

  it('a pergunta com assunto próprio é busca nova, mas não vale para "o escopo inteiro"', async () => {
    const out = await buildRadarContext(
      input({ userMessages: ["what's new about tokio?", "What's new?"], previousRun: run, previousRuns: [run] })
    )
    expect(out.text).toContain(REPEAT_SEARCH_NOTE)
    expect(out.text).not.toContain(WHOLE_SCOPE_NOTE)
  })

  it('a consulta anterior pode ser só de uma conversa com outro agente no meio (previousRun nulo, previousRuns com a consulta)', async () => {
    const out = await buildRadarContext(input({ userMessages: ['again'], previousRun: null, previousRuns: [run] }))
    expect(out.text).toContain(REPEAT_SEARCH_NOTE)
  })

  it('a 1ª consulta da conversa não ganha as linhas', async () => {
    const out = await buildRadarContext(input({ userMessages: ['again'], previousRun: null, previousRuns: [] }))
    expect(out.text).not.toContain(REPEAT_SEARCH_NOTE)
    expect(out.text).not.toContain(WHOLE_SCOPE_NOTE)
    const first = await buildRadarContext(input())
    expect(first.text).not.toContain(REPEAT_SEARCH_NOTE)
  })

  it('o seguimento (sem busca nova) não ganha as linhas: o contexto dele é o do seguimento', async () => {
    const out = await buildRadarContext(input({ userMessages: ['thanks', "What's new?"], previousRun: run, previousRuns: [run] }))
    expect(out.text).toContain(FOLLOW_UP_NOTE)
    expect(out.text).not.toContain(REPEAT_SEARCH_NOTE)
  })
})

describe('buildRadarContext: escopo sem notas e assunto na mensagem', () => {
  it('o contexto manda escolher pelo assunto nomeado, sem exigir ligação com o mapa de foco, e nunca "Nothing new"', async () => {
    mocks.loadPlanData.mockResolvedValue(planData({ notes: [note('n2', 'nb2', 'Optics')] }))
    plan = ['news: rust async']
    const out = await buildRadarContext(input({ userMessages: ["what's new about rust async"] }))
    expect(out.text).toContain(
      'This scope has no notes yet: the search used only the subject in the user\'s message ("rust async"), so the focus map has nothing to touch. Choose by that subject, not by the focus map: pick the candidates about "rust async" and say why they matter. Do not answer "Nothing new" while a candidate is about that subject.'
    )
  })
})

describe('buildRadarContext: link de redirecionamento do Google', () => {
  it('vira a página de destino (URL e fonte) e o hash da KB é o do destino; sem destino, o candidato sai', async () => {
    mocks.webSearch.mockResolvedValue([
      { title: 'Via Google', url: 'https://www.google.com/url?sa=t&q=&url=https%3A%2F%2Fwww.example.org%2Fa', content: 'c', publishedDate: '2026-11-18' },
      { title: 'Broken redirect', url: 'https://www.google.com/url?sa=t&q=', content: 'c', publishedDate: '2026-11-18' },
      { title: 'In the KB', url: 'https://google.com/url?q=https://example.org/kb', content: 'c', publishedDate: '2026-11-18' },
    ])
    mocks.loadKbSourceFilenames.mockResolvedValue(new Set(['h:https://example.org/kb']))
    const out = await buildRadarContext(input())
    const web = out.items?.items.filter((i) => i.kind === 'web') ?? []
    expect(web.map((i) => [i.title, i.url, i.kind === 'web' ? i.source : ''])).toEqual([['Via Google', 'https://www.example.org/a', 'example.org']])
    expect(out.text).toContain('"Via Google" · example.org · 18/11/2026')
    expect(out.text).not.toContain('google.com')
  })
})

describe('radarAgent: prompt', () => {
  const prompt = radarAgent.prompt?.('English') ?? ''

  it('proíbe retratar as respostas anteriores e pedir confirmação, e só ignora versões antigas do bloco', () => {
    expect(prompt).toContain('When the block says "This is a new search", the earlier answers in the conversation came from earlier searches the app made, and they are still valid.')
    expect(prompt).toContain('Never retract, correct or question items from earlier answers')
    expect(prompt).toContain('do not say they were not among the candidates')
    expect(prompt).toContain('do not ask the user to disregard them')
    expect(prompt).toContain('Never ask for confirmation before listing')
    expect(prompt).toContain('the search covers the whole scope: do not narrow the answer to the subject of an earlier question')
    expect(prompt).toContain('ignore older versions of the block itself, not the earlier answers in the conversation, which stay valid')
    expect(prompt).not.toContain('Ignore older versions of it.')
  })

  it('no escopo sem notas a regra do mapa de foco não vale: escolhe pelo assunto nomeado e nunca responde "Nothing new" havendo candidato sobre ele', () => {
    expect(prompt).toContain('When the block says the scope has no notes yet, that rule does not apply: there is nothing in the focus map to touch.')
    expect(prompt).toContain('never answer "Nothing new" while a candidate is about that subject')
  })

  it('pede para responder pela conversa quando perguntam de um item já mostrado e no seguimento', () => {
    expect(prompt).toContain('When the user asks about an item already shown')
    expect(prompt).toContain('answer from the conversation')
    expect(prompt).toContain('"Follow-up: the app did not search again"')
  })

  it('a seção de artigos do Radar chama-se "New papers", para não se confundir com o agente Papers', () => {
    expect(prompt).toContain('**News**, **Releases & changes**, **New papers**')
    expect(prompt).not.toContain('**Papers**')
  })

  it('só propõe o perfil na 1ª consulta do escopo e com a linha exata "Radar profile: none.", com os rótulos sem tradução', () => {
    expect(prompt).toContain(
      'Propose a profile only when the block\'s profile line says exactly "Radar profile: none.", the block also says "First check of this scope: yes", and you have not proposed one earlier in this conversation.'
    )
    expect(prompt).toContain('Propose it only on the first check of the scope')
    expect(prompt).toContain('Keep the labels Follow:, Sources: and Ignore: exactly as written, in English and never translated')
  })

  it('qualquer outra linha de perfil (inclusive "saved") quer dizer que o perfil existe: nunca propõe', () => {
    expect(prompt).toContain(
      'Any other profile line ("Radar profile:" followed by its lines, "Radar profile (sources and ignore only):" or "Radar profile: saved…") means the user already has a profile: never propose one, even on the first check of the scope, and never say they have none.'
    )
    expect(prompt).toContain('When the profile has neither, the block says "Radar profile: saved." and nothing from the profile applies.')
    expect(prompt).not.toContain('When the block says "Radar profile: none." and "First check of this scope: yes"')
  })

  it('no escopo estreito o bloco só mostra Sources e Ignore do perfil, e o prompt diz isso', () => {
    expect(prompt).toContain('In a notebook, tag or board scope the block shows only the profile\'s Sources and Ignore lines ("Radar profile (sources and ignore only)"): pick only what fits that scope')
    expect(prompt).toContain('prefer its sources and never pick what it says to ignore')
    expect(prompt).not.toContain("the profile's Follow list counts only for what matches the scope")
  })
})

describe('sinceSearch', () => {
  const base = {
    userText: 'Notes about the tokio runtime and its scheduler internals, written in March.',
    instruction: ' focus   on scheduler ',
    cutoff: '2026-03-01',
    todayKey: TODAY,
  }

  it('gera as consultas pelo modelo, busca com o corte e devolve os itens datados', async () => {
    plan = ['web: tokio scheduler', 'web: tokio runtime changes', 'news: ignored kind']
    mocks.webSearch.mockResolvedValue([WEB(1, '2026-06-01'), WEB(2, '2026-01-01')])
    const out = await sinceSearch(base)
    const call = mocks.invoke.mock.calls.find((c) => c[0] === 'radar_plan_queries')
    expect(call?.[1]).toEqual({
      kind: 'since',
      focus: base.userText,
      instruction: 'focus on scheduler',
      since: '2026-03-01',
      currentDate: TODAY,
    })
    expect(mocks.webSearch).toHaveBeenCalledTimes(2)
    expect(mocks.webSearch).toHaveBeenCalledWith('tokio scheduler', 5, false, undefined, {
      topic: 'general',
      startDate: '2026-03-01',
      filterByDate: true,
    })
    expect(out.queries).toBe(2)
    expect(out.failed).toBe(0)
    expect(out.items.map((i) => i.key)).toEqual(['W1'])
    expect(out.items[0]).toMatchObject({ title: 'Post 1', date: '2026-06-01' })
  })

  it('sem consulta válida a busca não roda (sem reserva pelo texto da nota)', async () => {
    plan = []
    expect(await sinceSearch(base)).toEqual({ items: [], queries: 0, failed: 0 })
    plan = ['news: wrong kind only']
    expect(await sinceSearch(base)).toEqual({ items: [], queries: 0, failed: 0 })
    expect(mocks.webSearch).not.toHaveBeenCalled()
  })

  it('a consulta que copia 6+ palavras da nota não sai', async () => {
    plan = ['web: notes about the tokio runtime and its', 'web: tokio scheduler']
    await sinceSearch(base)
    expect(mocks.webSearch.mock.calls.map((c) => c[0])).toEqual(['tokio scheduler'])
  })

  it('conta as buscas que falharam', async () => {
    plan = ['web: one', 'web: two']
    mocks.webSearch.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([WEB(1, '2026-06-01')])
    const out = await sinceSearch(base)
    expect(out).toMatchObject({ queries: 2, failed: 1 })
    expect(out.items).toHaveLength(1)
  })

  it('falha do comando de consultas = nenhuma consulta', async () => {
    mocks.invoke.mockRejectedValue(new Error('no key'))
    expect(await sinceSearch(base)).toEqual({ items: [], queries: 0, failed: 0 })
  })
})
