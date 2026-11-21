import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A chave vem de um comando do Tauri e a rede é um fetch simulado: nenhum teste
// faz requisição.
const invokeMock = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import {
  abstractFromIndex,
  budgetResetTime,
  buildWorksUrl,
  mergePapers,
  normalizeDoi,
  OPENALEX_SELECT,
  OpenAlexError,
  openAlexErrorText,
  paperKey,
  parseWorks,
  rankFoundational,
  searchWorks,
  toOpenAlexQuery,
  yearsAgoKey,
} from './openalex'

const SELECT = OPENALEX_SELECT
const TYPES = 'article|review|conference-paper|preprint|book-chapter|book'

describe('toOpenAlexQuery', () => {
  it('tira aspas e parênteses, deixa em minúsculas e colapsa espaços', () => {
    expect(toOpenAlexQuery('  Graph  "Neural" (Networks) ')).toBe('graph neural networks')
  })

  it('AND, OR e NOT do modelo não viram operador', () => {
    expect(toOpenAlexQuery('rust AND async OR tokio NOT go')).toBe('rust and async or tokio not go')
  })
})

describe('buildWorksUrl', () => {
  it('sem data e sem chave', () => {
    expect(buildWorksUrl({ query: 'Graph Neural Networks', perPage: 30 })).toBe(
      `https://api.openalex.org/works?search.title_and_abstract=graph%20neural%20networks&filter=type:${TYPES}&per-page=30&select=${SELECT}`
    )
  })

  it('com data', () => {
    expect(buildWorksUrl({ query: 'rust', fromDate: '2023-11-20', perPage: 10 })).toBe(
      `https://api.openalex.org/works?search.title_and_abstract=rust&filter=type:${TYPES},from_publication_date:2023-11-20&per-page=10&select=${SELECT}`
    )
  })

  it('com chave, no fim e codificada', () => {
    expect(buildWorksUrl({ query: 'rust', perPage: 5, apiKey: 'k/ey 1' })).toBe(
      `https://api.openalex.org/works?search.title_and_abstract=rust&filter=type:${TYPES}&per-page=5&select=${SELECT}&api_key=k%2Fey%201`
    )
  })

  it('chave vazia ou nula não leva o parâmetro', () => {
    expect(buildWorksUrl({ query: 'rust', perPage: 5, apiKey: '' })).not.toContain('api_key')
    expect(buildWorksUrl({ query: 'rust', perPage: 5, apiKey: null })).not.toContain('api_key')
  })

  it('nunca leva sort, e-mail nem mailto', () => {
    const url = buildWorksUrl({ query: 'rust', fromDate: '2024-01-01', perPage: 5, apiKey: 'k' })
    expect(url).not.toContain('sort=')
    expect(url).not.toContain('mailto')
  })

  it('a consulta é codificada e vem em minúsculas (sem operador)', () => {
    expect(buildWorksUrl({ query: 'C++ & "Go" (AND)', perPage: 5 })).toContain('search.title_and_abstract=c%2B%2B%20%26%20go%20and')
  })
})

describe('normalizeDoi', () => {
  it('URL do doi.org, dx.doi.org e prefixo doi:', () => {
    expect(normalizeDoi('https://doi.org/10.1234/ABC.5')).toBe('10.1234/abc.5')
    expect(normalizeDoi('http://dx.doi.org/10.1234/abc')).toBe('10.1234/abc')
    expect(normalizeDoi('doi: 10.1234/abc')).toBe('10.1234/abc')
    expect(normalizeDoi('  10.1234/Abc  ')).toBe('10.1234/abc')
  })

  it('texto que não é DOI devolve null', () => {
    expect(normalizeDoi('https://example.com/10.1234/abc')).toBeNull()
    expect(normalizeDoi('11.1234/abc')).toBeNull()
    expect(normalizeDoi('')).toBeNull()
    expect(normalizeDoi(null)).toBeNull()
    expect(normalizeDoi(undefined)).toBeNull()
  })
})

describe('abstractFromIndex', () => {
  it('remonta pelas posições, na ordem do texto', () => {
    expect(abstractFromIndex({ world: [1], Hello: [0], again: [2, 4], and: [3] })).toBe('Hello world again and again')
  })

  it('índice vazio ou ausente devolve null', () => {
    expect(abstractFromIndex({})).toBeNull()
    expect(abstractFromIndex(null)).toBeNull()
    expect(abstractFromIndex(undefined)).toBeNull()
  })

  it('corta em max com "…", dentro do limite', () => {
    const text = abstractFromIndex({ aaaa: [0], bbbb: [1], cccc: [2] }, 10)!
    expect(text).toBe('aaaa bbbb…')
    expect(text.length).toBeLessThanOrEqual(10)
  })

  it('ignora posição inválida', () => {
    expect(abstractFromIndex({ ok: [0], bad: [-1, 1.5, 99999999] })).toBe('ok')
  })
})

describe('paperKey', () => {
  it('DOI quando há, senão o id do OpenAlex', () => {
    expect(paperKey('10.1234/abc', 'W1')).toBe('doi:10.1234/abc')
    expect(paperKey(null, 'W1')).toBe('openalex:W1')
  })
})

const SAMPLE = {
  results: [
    {
      id: 'https://openalex.org/W111',
      doi: 'https://doi.org/10.1234/ABC',
      title: 'Graph  Neural Networks: A Review',
      type: 'review',
      publication_year: 2025,
      publication_date: '2025-03-04',
      cited_by_count: 1234,
      authorships: [
        { author: { display_name: 'Ana Smith' } },
        { author: { display_name: 'Bo Lee' } },
        { author: { display_name: 'Cy Chen' } },
        { author: { display_name: 'Di Park' } },
      ],
      open_access: { is_oa: true, oa_url: 'https://arxiv.org/pdf/1' },
      best_oa_location: { landing_page_url: 'https://arxiv.org/abs/1', pdf_url: 'https://arxiv.org/pdf/1' },
      abstract_inverted_index: { Graph: [0], networks: [1], rock: [2] },
    },
    {
      id: 'https://openalex.org/W222',
      doi: null,
      title: 'A preprint without DOI',
      type: 'preprint',
      publication_year: 2026,
      publication_date: '2026-01-02',
      cited_by_count: 0,
      authorships: [],
      open_access: { is_oa: false, oa_url: null },
      best_oa_location: { landing_page_url: 'https://arxiv.org/abs/2', pdf_url: null },
      abstract_inverted_index: null,
    },
    {
      id: 'https://openalex.org/W333',
      title: 'Nothing else known',
      type: 'article',
      publication_year: null,
      best_oa_location: null,
    },
    { id: 'https://openalex.org/W444', title: 'A dataset', type: 'dataset' },
    { id: 'https://openalex.org/W555', title: null, type: 'article' },
    { title: 'No id', type: 'article' },
    {
      id: 'https://openalex.org/W666',
      title: 'Odd authors',
      type: 'article',
      authorships: [
        { author: { display_name: null }, raw_author_name: 'Raw Name' },
        { author: {} },
        { author: { display_name: 'Eve Zed' } },
      ],
    },
  ],
}

describe('parseWorks', () => {
  const works = parseWorks(SAMPLE, 'radar')

  it('lê todos os campos de uma obra com DOI', () => {
    expect(works[0]).toEqual({
      kind: 'paper',
      section: 'radar',
      id: 'doi:10.1234/abc',
      openalexId: 'W111',
      title: 'Graph Neural Networks: A Review',
      authors: ['Ana Smith', 'Bo Lee', 'Cy Chen'],
      authorCount: 4,
      year: 2025,
      date: '2025-03-04',
      doi: '10.1234/abc',
      url: 'https://doi.org/10.1234/abc',
      citations: 1234,
      type: 'review',
      isOa: true,
      pdfUrl: 'https://arxiv.org/pdf/1',
      oaUrl: 'https://arxiv.org/pdf/1',
      abstract: 'Graph networks rock',
    })
  })

  it('sem DOI: chave do OpenAlex, URL da landing e sem abstract', () => {
    expect(works[1]).toMatchObject({
      id: 'openalex:W222',
      openalexId: 'W222',
      doi: null,
      url: 'https://arxiv.org/abs/2',
      citations: 0,
      isOa: false,
      pdfUrl: null,
      oaUrl: null,
      abstract: null,
      authors: [],
      authorCount: 0,
    })
  })

  it('sem ano, sem DOI e sem landing: a URL é o id do OpenAlex', () => {
    expect(works[2]).toMatchObject({
      openalexId: 'W333',
      year: null,
      date: null,
      url: 'https://openalex.org/W333',
      citations: 0,
      isOa: false,
    })
  })

  it('ignora o tipo fora da lista, a obra sem título e a sem id', () => {
    expect(works.map((w) => w.openalexId)).toEqual(['W111', 'W222', 'W333', 'W666'])
  })

  it('autor sem display_name cai no raw_author_name; sem nome nenhum, sai', () => {
    expect(works[3].authors).toEqual(['Raw Name', 'Eve Zed'])
    expect(works[3].authorCount).toBe(3)
  })

  it('a seção vem do chamador', () => {
    expect(parseWorks(SAMPLE, 'foundational').every((w) => w.section === 'foundational')).toBe(true)
  })

  it('resposta fora do formato devolve vazio', () => {
    expect(parseWorks(null, 'radar')).toEqual([])
    expect(parseWorks({}, 'radar')).toEqual([])
    expect(parseWorks({ results: 'x' }, 'radar')).toEqual([])
    expect(parseWorks({ results: [null, 3, 'a'] }, 'radar')).toEqual([])
  })
})

function paper(id: string, citations: number) {
  return { ...parseWorks({ results: [SAMPLE.results[1]] }, 'radar')[0], id, citations }
}

describe('rankFoundational', () => {
  it('ordena por citações e fica com keep', () => {
    const items = [paper('a', 5), paper('b', 50), paper('c', 20)]
    expect(rankFoundational(items, 2).map((p) => p.id)).toEqual(['b', 'c'])
  })

  it('no empate mantém a ordem original (a da relevância)', () => {
    const items = [paper('a', 7), paper('b', 7), paper('c', 7), paper('d', 9)]
    expect(rankFoundational(items, 4).map((p) => p.id)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('não altera a lista de entrada', () => {
    const items = [paper('a', 1), paper('b', 2)]
    rankFoundational(items, 2)
    expect(items.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('mergePapers', () => {
  it('concatena na ordem dos grupos e tira as repetidas (a primeira ganha)', () => {
    const merged = mergePapers([[paper('a', 1), paper('b', 2)], [paper('b', 99), paper('c', 3)]], new Set(), 10)
    expect(merged.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(merged[1].citations).toBe(2)
  })

  it('tira as do exclude', () => {
    const merged = mergePapers([[paper('a', 1), paper('b', 2)], [paper('c', 3)]], new Set(['b']), 10)
    expect(merged.map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('corta no teto, contando só as que ficam', () => {
    const merged = mergePapers([[paper('a', 1), paper('b', 2), paper('c', 3), paper('d', 4)]], new Set(['a']), 2)
    expect(merged.map((p) => p.id)).toEqual(['b', 'c'])
  })

  it('não altera o exclude de entrada', () => {
    const exclude = new Set(['x'])
    mergePapers([[paper('a', 1)]], exclude, 5)
    expect([...exclude]).toEqual(['x'])
  })
})

describe('yearsAgoKey', () => {
  it('volta N anos', () => {
    expect(yearsAgoKey('2026-11-20', 3)).toBe('2023-11-20')
    expect(yearsAgoKey('2026-01-05', 1)).toBe('2025-01-05')
  })

  it('29/02 vira 28/02 quando o ano de destino não é bissexto', () => {
    expect(yearsAgoKey('2028-02-29', 1)).toBe('2027-02-28')
    expect(yearsAgoKey('2028-02-29', 4)).toBe('2024-02-29')
  })
})

describe('budgetResetTime', () => {
  it('a meia-noite UTC no relógio do fuso, em HH:MM', () => {
    expect(budgetResetTime(0)).toBe('00:00')
    expect(budgetResetTime(-180)).toBe('21:00') // São Paulo
    expect(budgetResetTime(60)).toBe('01:00') // Europa central
    expect(budgetResetTime(330)).toBe('05:30') // Índia
    expect(budgetResetTime(-570)).toBe('14:30')
    expect(budgetResetTime(840)).toBe('14:00') // UTC+14
  })
})

describe('openAlexErrorText', () => {
  it('o orçamento esgotado diz a hora local da renovação (meia-noite UTC), não "midnight UTC"', () => {
    const text = openAlexErrorText(new OpenAlexError('budget', 429))
    const local = budgetResetTime(-new Date().getTimezoneOffset())
    expect(text).toBe(
      `OpenAlex daily free budget is used up (it resets at ${local} your time). Add a free OpenAlex key in Settings > Web Search to raise it.`
    )
    expect(text).not.toContain('UTC')
  })

  it('uma mensagem por motivo', () => {
    expect(openAlexErrorText(new OpenAlexError('rate', 429))).toBe('OpenAlex is limiting requests right now. Try again in a minute.')
    expect(openAlexErrorText(new OpenAlexError('network'))).toBe('Could not reach OpenAlex (offline?).')
    expect(openAlexErrorText(new OpenAlexError('http', 503))).toBe('OpenAlex returned an error (HTTP 503).')
  })

  it('erro de outra origem tem uma mensagem fixa, sem vazar o texto original', () => {
    expect(openAlexErrorText(new Error('https://api.openalex.org/works?api_key=secret'))).toBe('OpenAlex search failed.')
  })
})

describe('searchWorks', () => {
  let calls: Array<{ url: string; init: RequestInit | undefined }> = []
  let respond: () => unknown

  beforeEach(() => {
    calls = []
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(null)
    respond = () => ({ ok: true, status: 200, json: async () => SAMPLE })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init })
        return respond()
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const options = { query: 'graph neural networks', perPage: 20, section: 'radar' as const }

  it('GET simples sem header e sem a chave: lê a obra da resposta', async () => {
    const signal = new AbortController().signal
    const found = await searchWorks(options, signal)
    expect(found.map((w) => w.openalexId)).toEqual(['W111', 'W222', 'W333', 'W666'])
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(buildWorksUrl({ query: options.query, perPage: 20 }))
    expect(calls[0].init).toEqual({ signal })
    expect(invokeMock).toHaveBeenCalledWith('get_openalex_key')
  })

  it('com chave, ela vai na query', async () => {
    invokeMock.mockResolvedValue('my-key')
    await searchWorks({ ...options, fromDate: '2024-01-01' }, new AbortController().signal)
    expect(calls[0].url).toBe(buildWorksUrl({ query: options.query, perPage: 20, fromDate: '2024-01-01', apiKey: 'my-key' }))
  })

  it('falha ao ler a chave sai sem a chave', async () => {
    invokeMock.mockRejectedValue(new Error('no command'))
    await searchWorks(options, new AbortController().signal)
    expect(calls[0].url).not.toContain('api_key')
  })

  it('429 com orçamento diário vira budget; outro 429 vira rate', async () => {
    respond = () => ({ ok: false, status: 429, text: async () => '{"reason":"daily_budget"}' })
    await expect(searchWorks(options, new AbortController().signal)).rejects.toMatchObject({ reason: 'budget', status: 429 })
    respond = () => ({ ok: false, status: 429, text: async () => '{"reason":"rate_limit"}' })
    await expect(searchWorks(options, new AbortController().signal)).rejects.toMatchObject({ reason: 'rate' })
  })

  it('outro erro HTTP vira http com o status', async () => {
    respond = () => ({ ok: false, status: 503 })
    await expect(searchWorks(options, new AbortController().signal)).rejects.toMatchObject({ reason: 'http', status: 503 })
  })

  it('TypeError do fetch vira network', async () => {
    respond = () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(searchWorks(options, new AbortController().signal)).rejects.toMatchObject({ reason: 'network' })
  })

  it('o cancelamento é repassado como veio', async () => {
    const abort = new AbortController()
    respond = () => {
      abort.abort()
      throw new DOMException('aborted', 'AbortError')
    }
    await expect(searchWorks(options, abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('JSON inválido vira http', async () => {
    respond = () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json')
      },
    })
    await expect(searchWorks(options, new AbortController().signal)).rejects.toBeInstanceOf(OpenAlexError)
  })
})
