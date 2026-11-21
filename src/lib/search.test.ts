import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A chave do Tavily vem de um comando do Tauri; a rede é um fetch simulado:
// nenhum teste faz requisição.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => 'tvly-test-key') }))

import { webSearch } from './search'

let sent: { url: string; body: string } | null = null
let results: unknown[] = []

beforeEach(() => {
  sent = null
  results = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      sent = { url, body: String(init.body) }
      return { ok: true, status: 200, json: async () => ({ results }) }
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('webSearch: body', () => {
  it('sem opts, o body é o de sempre', async () => {
    await webSearch('rust async')
    expect(sent?.url).toBe('https://api.tavily.com/search')
    expect(sent?.body).toBe('{"query":"rust async","max_results":5,"include_raw_content":false}')

    await webSearch('rust async', 3, true, new AbortController().signal)
    expect(sent?.body).toBe('{"query":"rust async","max_results":3,"include_raw_content":true}')
  })

  it('com opts completos: topic, start_date, filtro por data e published_date', async () => {
    await webSearch('rust async', 5, false, undefined, { topic: 'news', startDate: '2026-11-01', filterByDate: true })
    expect(JSON.parse(sent!.body)).toEqual({
      query: 'rust async',
      max_results: 5,
      include_raw_content: false,
      topic: 'news',
      start_date: '2026-11-01',
      filter_by_published_date: true,
      include_published_date: true,
    })
  })

  it('só os campos definidos entram, e include_published_date sempre que há opts', async () => {
    await webSearch('q', 5, false, undefined, { topic: 'general' })
    expect(JSON.parse(sent!.body)).toEqual({
      query: 'q',
      max_results: 5,
      include_raw_content: false,
      topic: 'general',
      include_published_date: true,
    })

    await webSearch('q', 5, false, undefined, { startDate: '2026-11-01', filterByDate: false })
    expect(JSON.parse(sent!.body)).toEqual({
      query: 'q',
      max_results: 5,
      include_raw_content: false,
      start_date: '2026-11-01',
      include_published_date: true,
    })

    await webSearch('q', 5, false, undefined, {})
    expect(JSON.parse(sent!.body)).toEqual({
      query: 'q',
      max_results: 5,
      include_raw_content: false,
      include_published_date: true,
    })
  })
})

describe('webSearch: resposta', () => {
  it('lê o published_date como publishedDate', async () => {
    results = [
      { title: 'A', url: 'https://a.com', content: 'a', published_date: '2026-11-18' },
      { title: 'B', url: 'https://b.com', content: 'b', published_date: '' },
      { title: 'C', url: 'https://c.com', content: 'c', published_date: null },
      { title: 'D', url: 'https://d.com', content: 'd' },
    ]
    const found = await webSearch('q')
    expect(found.map((r) => r.publishedDate)).toEqual(['2026-11-18', undefined, undefined, undefined])
    expect(found.map((r) => r.title)).toEqual(['A', 'B', 'C', 'D'])
  })
})
