import { describe, expect, it, vi } from 'vitest'
import type { WebItem } from '../agentItems'
import { prepareSinceContext, SINCE_NO_QUERIES, SINCE_SEARCH_FAILED, sinceNoResults } from './since'

// O contexto web do /since com a busca simulada: nenhum teste faz requisição.

const TODAY = '2026-11-20'
const CREATED = new Date(2026, 2, 1, 12).getTime() // 01/03/2026

function item(n: number, date = '2026-06-01'): WebItem {
  return {
    kind: 'web',
    key: `W${n}`,
    section: 'news',
    title: `Post ${n}`,
    url: `https://example.com/${n}`,
    source: 'example.com',
    date,
    snippet: `snippet ${n}`,
  }
}

type Search = Parameters<typeof prepareSinceContext>[1]
const found = (items: WebItem[], queries = 2, failed = 0) => vi.fn<Search>(async () => ({ items, queries, failed }))

function opts(over: Partial<Parameters<typeof prepareSinceContext>[0]> = {}) {
  return {
    instruction: '',
    note: { createdAt: CREATED },
    noteId: 'n1',
    calendarKey: null,
    responses: [],
    userText: 'Notes about the tokio runtime.',
    todayKey: TODAY,
    onSearch: vi.fn(),
    ...over,
  }
}

const BLOCK = (createdAt: number, over: Record<string, unknown> = {}) => ({
  noteId: 'n1',
  command: '/since',
  status: 'completed',
  response: '- **01/06/2026** — something',
  createdAt,
  ...over,
})

describe('prepareSinceContext', () => {
  it('sem instrução: o corte é o dia da criação, o título mostra a data e a origem e os resultados vão ao contexto', async () => {
    const search = found([item(1), item(2)])
    const o = opts()
    const out = await prepareSinceContext(o, search)
    if ('error' in out) throw new Error(out.error)
    expect(out.titleQuery).toBe('01/03/2026 (note created)')
    expect(out.extraContext).toEqual(['Since: 01/03/2026 (created)'])
    expect(out.searchContext).toContain('Web search results (published since 01/03/2026')
    expect(out.searchContext).toContain('**Post 1** · example.com · 01/06/2026')
    expect(search).toHaveBeenCalledWith({ userText: o.userText, instruction: '', cutoff: '2026-03-01', todayKey: TODAY })
    expect(o.onSearch).toHaveBeenCalledTimes(1)
  })

  it('uma data na instrução vale sobre tudo, e o título mostra o que o usuário escreveu (sem rótulo de origem)', async () => {
    const out = await prepareSinceContext(
      opts({ instruction: '15/05/2026', note: { date: '2026-02-01', createdAt: CREATED } }),
      found([item(1)])
    )
    if ('error' in out) throw new Error(out.error)
    expect(out.titleQuery).toBeNull()
    expect(out.extraContext).toEqual(['Since: 15/05/2026 (instruction)'])
  })

  it('o último bloco /since da própria nota é o corte (a data em que ele foi gerado)', async () => {
    const lastRun = new Date(2026, 9, 5, 9).getTime() // 05/10/2026
    const out = await prepareSinceContext(
      opts({
        responses: [
          BLOCK(new Date(2026, 6, 1, 9).getTime()),
          BLOCK(lastRun),
          BLOCK(new Date(2026, 10, 1, 9).getTime(), { noteId: 'other' }),
          BLOCK(new Date(2026, 10, 2, 9).getTime(), { status: 'failed' }),
        ],
      }),
      found([item(1)])
    )
    if ('error' in out) throw new Error(out.error)
    expect(out.extraContext[0]).toBe('Since: 05/10/2026 (last /since)')
    expect(out.titleQuery).toBe('05/10/2026 (last /since)')
  })

  it('o date da nota e o dia do Calendar vêm antes da criação', async () => {
    const withDate = await prepareSinceContext(opts({ note: { date: '2026-04-10', createdAt: CREATED } }), found([]))
    if ('error' in withDate) throw new Error(withDate.error)
    expect(withDate.extraContext[0]).toBe('Since: 10/04/2026 (note date)')
    const calendar = await prepareSinceContext(opts({ calendarKey: '2026-05-02' }), found([]))
    if ('error' in calendar) throw new Error(calendar.error)
    expect(calendar.extraContext[0]).toBe('Since: 02/05/2026 (calendar day)')
  })

  it('corte no futuro é erro e a busca nem começa', async () => {
    const search = found([item(1)])
    const o = opts({ instruction: '25/12/2026' })
    expect(await prepareSinceContext(o, search)).toEqual({ error: 'The cutoff date is in the future.' })
    expect(search).not.toHaveBeenCalled()
    expect(o.onSearch).not.toHaveBeenCalled()
  })

  it('a busca rodou e não achou nada na janela: o contexto diz que buscou e não achou', async () => {
    const out = await prepareSinceContext(opts(), found([]))
    if ('error' in out) throw new Error(out.error)
    expect(out.searchContext).toBeUndefined()
    expect(out.extraContext).toEqual(['Since: 01/03/2026 (created)', 'Web search: done, no results published since 01/03/2026.'])
    expect(sinceNoResults('2026-03-01')).toBe('Web search: done, no results published since 01/03/2026.')
  })

  it('sem consulta válida a busca não rodou, e o contexto diz o motivo', async () => {
    const out = await prepareSinceContext(opts(), found([], 0, 0))
    if ('error' in out) throw new Error(out.error)
    expect(out.searchContext).toBeUndefined()
    expect(out.extraContext).toEqual(['Since: 01/03/2026 (created)', SINCE_NO_QUERIES])
  })

  it('todas as buscas falharam, ou a busca lançou: o contexto diz que falhou', async () => {
    const allFailed = await prepareSinceContext(opts(), found([], 2, 2))
    if ('error' in allFailed) throw new Error(allFailed.error)
    expect(allFailed.extraContext).toEqual(['Since: 01/03/2026 (created)', SINCE_SEARCH_FAILED])

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const thrown = await prepareSinceContext(opts(), vi.fn<Search>().mockRejectedValue(new Error('boom')))
    warn.mockRestore()
    if ('error' in thrown) throw new Error(thrown.error)
    expect(thrown.searchContext).toBeUndefined()
    expect(thrown.extraContext).toEqual(['Since: 01/03/2026 (created)', SINCE_SEARCH_FAILED])
  })

  it('uma busca falhou e a outra deu certo: os resultados entram', async () => {
    const out = await prepareSinceContext(opts(), found([item(1)], 2, 1))
    if ('error' in out) throw new Error(out.error)
    expect(out.searchContext).toContain('**Post 1**')
    expect(out.extraContext).toEqual(['Since: 01/03/2026 (created)'])
  })
})
