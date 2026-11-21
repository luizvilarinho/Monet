import { describe, expect, it } from 'vitest'
import {
  agentRuns,
  citedItemReason,
  dmy,
  expandItemMarkers,
  finalizeAgentItems,
  finalizeMessageItems,
  hasAgentPayload,
  ITEM_MARKER_RE,
  itemPrefix,
  markStoppedBeforeReply,
  previousAgentRun,
  radarProfileDraftAllowed,
  searchLine,
  settleMessageItems,
  type AgentItemsPayload,
  type AgentSearchInfo,
  type PaperItem,
  type WebItem,
} from './agentItems'

// Contrato do marcador [W3]/[P2]: o modelo escolhe e comenta, o app desenha
// título, link, fonte, data, autores, ano e citações a partir do payload.

function web(n: number, patch: Partial<WebItem> = {}): WebItem {
  return {
    kind: 'web',
    key: `W${n}`,
    section: 'news',
    title: `Web title ${n}`,
    url: `https://example.com/${n}`,
    source: 'example.com',
    date: '2026-11-18',
    snippet: `snippet ${n}`,
    ...patch,
  }
}

function paper(n: number, patch: Partial<PaperItem> = {}): PaperItem {
  return {
    kind: 'paper',
    key: `P${n}`,
    section: 'radar',
    id: `doi:10.1000/p${n}`,
    openalexId: `W${n}00`,
    title: `Paper title ${n}`,
    authors: ['Ana Smith', 'Bo Lee', 'Cy Chen'],
    authorCount: 3,
    year: 2024,
    date: '2024-05-01',
    doi: `10.1000/p${n}`,
    url: `https://doi.org/10.1000/p${n}`,
    citations: 12,
    type: 'article',
    isOa: true,
    pdfUrl: null,
    oaUrl: null,
    abstract: null,
    ...patch,
  }
}

function payload(items: AgentItemsPayload['items'], max = 8): AgentItemsPayload {
  return { items, max, scopeNotebookId: null }
}

describe('dmy', () => {
  it('converte ISO em dd/mm/yyyy', () => {
    expect(dmy('2026-11-18')).toBe('18/11/2026')
    expect(dmy('2026-01-05T10:00:00Z')).toBe('05/01/2026')
  })

  it('devolve o texto fora do formato como veio', () => {
    expect(dmy('n/a')).toBe('n/a')
  })
})

describe('ITEM_MARKER_RE', () => {
  const found = (text: string) => Array.from(text.matchAll(ITEM_MARKER_RE), (m) => m[0])

  it('casa W, P e o espaço opcional', () => {
    expect(found('a [W3] b [P12] c [W 4]')).toEqual(['[W3]', '[P12]', '[W 4]'])
  })

  it('não casa com o texto de um link markdown', () => {
    expect(found('[W3](https://x.com) e [W4]')).toEqual(['[W4]'])
  })

  it('não casa marcador com 4 dígitos nem letra minúscula', () => {
    expect(found('[W1234] [w3] [X3]')).toEqual([])
  })
})

describe('itemPrefix', () => {
  it('web: título com link, fonte e data', () => {
    expect(itemPrefix(web(1))).toBe('**[Web title 1](https://example.com/1)** (example.com, 18/11/2026):')
  })

  it('artigo: autores, ano, citações e Open access', () => {
    expect(itemPrefix(paper(1))).toBe(
      '**[Paper title 1](https://doi.org/10.1000/p1)** (Smith, Lee, Chen, 2024 · 12 citations · Open access):'
    )
  })

  it('mais de 3 autores leva "et al."', () => {
    const p = paper(1, { authors: ['Ana Smith', 'Bo Lee', 'Cy Chen'], authorCount: 9 })
    expect(itemPrefix(p)).toContain('(Smith, Lee, Chen et al., 2024 ·')
  })

  it('autor com um nome só e autor com sobrenome composto usam a última palavra', () => {
    const p = paper(1, { authors: ['Plato', 'Maria da Silva'], authorCount: 2 })
    expect(itemPrefix(p)).toContain('(Plato, Silva, 2024 ·')
  })

  it('sem ano usa "n.d."', () => {
    expect(itemPrefix(paper(1, { year: null }))).toContain('(Smith, Lee, Chen, n.d. ·')
  })

  it('sem autores, o prefixo começa pelo ano', () => {
    expect(itemPrefix(paper(1, { authors: [], authorCount: 0 }))).toContain('(2024 · 12 citations')
  })

  it('1 citação no singular e milhar com vírgula', () => {
    expect(itemPrefix(paper(1, { citations: 1 }))).toContain('1 citation ·')
    expect(itemPrefix(paper(1, { citations: 1234 }))).toContain('1,234 citations')
    expect(itemPrefix(paper(1, { citations: 0 }))).toContain('0 citations')
  })

  it('"Open access" só com isOa', () => {
    expect(itemPrefix(paper(1, { isOa: false }))).not.toContain('Open access')
  })

  it('escapa colchetes e parênteses do título com barra', () => {
    const prefix = itemPrefix(web(1, { title: 'Release [2.0] (beta)' }))
    expect(prefix).toBe('**[Release \\[2.0\\] \\(beta\\)](https://example.com/1)** (example.com, 18/11/2026):')
  })

  it('parênteses da URL (DOI) não fecham o link', () => {
    const prefix = itemPrefix(paper(1, { url: 'https://doi.org/10.1016/S0140-6736(20)30183-5' }))
    expect(prefix).toContain('(https://doi.org/10.1016/S0140-6736%2820%2930183-5)**')
  })
})

describe('expandItemMarkers', () => {
  const items = payload([web(3), paper(2)])

  it('expande W e P conhecidos, inclusive "[W 3]"', () => {
    expect(expandItemMarkers('- [W3] new thing', items)).toBe(`- ${itemPrefix(web(3))} new thing`)
    expect(expandItemMarkers('- [W 3] new thing', items)).toBe(`- ${itemPrefix(web(3))} new thing`)
    expect(expandItemMarkers('- [P2] why it matters', items)).toBe(`- ${itemPrefix(paper(2))} why it matters`)
  })

  it('apaga o marcador desconhecido sem espaço duplo e sem remover a linha', () => {
    expect(expandItemMarkers('see [W9] for more', items)).toBe('see for more')
    expect(expandItemMarkers('first line\n[W9] second', items)).toBe('first line\nsecond')
    expect(expandItemMarkers('done [W9].', items)).toBe('done.')
  })

  it('o link markdown [W3](url) fica como está', () => {
    expect(expandItemMarkers('[W3](https://x.com)', items)).toBe('[W3](https://x.com)')
  })

  it('sem marcador, o texto não muda', () => {
    expect(expandItemMarkers('plain text', items)).toBe('plain text')
  })
})

describe('finalizeAgentItems', () => {
  it('expande os marcadores e devolve só os itens citados, na ordem da 1ª citação', () => {
    const all = payload([web(1), web(2), web(3)])
    const out = finalizeAgentItems('- [W3] third\n- [W1] first\n- [W3] again', all)
    expect(out.payload.items.map((i) => i.key)).toEqual(['W3', 'W1'])
    expect(out.content).toBe(
      [`- ${itemPrefix(web(3))} third`, `- ${itemPrefix(web(1))} first`, `- ${itemPrefix(web(3))} again`].join('\n')
    )
  })

  it('tira o snippet dos itens web e mantém os campos do artigo', () => {
    const out = finalizeAgentItems('- [W1] a\n- [P1] b', payload([web(1), paper(1, { abstract: 'abs' })]))
    const [w, p] = out.payload.items
    expect(w.kind === 'web' && w.snippet).toBe('')
    expect(p.kind === 'paper' && p.abstract).toBe('abs')
  })

  it('guarda max e scopeNotebookId do payload', () => {
    const out = finalizeAgentItems('- [W1] a', { items: [web(1)], max: 8, scopeNotebookId: 'nb1' })
    expect(out.payload.max).toBe(8)
    expect(out.payload.scopeNotebookId).toBe('nb1')
  })

  it('remove a linha de lista cujo 1º marcador é desconhecido', () => {
    const out = finalizeAgentItems('Intro\n- [W9] invented\n- [W1] real', payload([web(1)]))
    expect(out.content).toBe(`Intro\n- ${itemPrefix(web(1))} real`)
    expect(out.payload.items.map((i) => i.key)).toEqual(['W1'])
  })

  it('remove a linha de item além do teto max de itens distintos', () => {
    const out = finalizeAgentItems('- [W1] a\n- [W2] b\n- [W3] c\n- [W1] repeated', payload([web(1), web(2), web(3)], 2))
    expect(out.payload.items.map((i) => i.key)).toEqual(['W1', 'W2'])
    expect(out.content.split('\n')).toHaveLength(3)
    expect(out.content).not.toContain('Web title 3')
    expect(out.content).toContain('repeated')
  })

  it('fora de linha de lista, o desconhecido é apagado e a linha fica', () => {
    const out = finalizeAgentItems('Most important is [W1] and [W9] too.', payload([web(1)]))
    expect(out.content).toBe(`Most important is ${itemPrefix(web(1))} and too.`)
  })

  it('o marcador além do teto numa linha comum é apagado', () => {
    const out = finalizeAgentItems('See [W1] and [W2].', payload([web(1), web(2)], 1))
    expect(out.content).toBe(`See ${itemPrefix(web(1))} and.`)
    expect(out.payload.items.map((i) => i.key)).toEqual(['W1'])
  })

  it('linha de lista sem marcador fica como está', () => {
    const out = finalizeAgentItems('- plain bullet', payload([web(1)]))
    expect(out.content).toBe('- plain bullet')
    expect(out.payload.items).toEqual([])
  })

  it('aceita "*" como marcador de lista', () => {
    const out = finalizeAgentItems('* [W9] invented\n* [W1] real', payload([web(1)]))
    expect(out.content).toBe(`* ${itemPrefix(web(1))} real`)
  })

  it('o cabeçalho da seção que ficou sem nenhuma linha sai junto', () => {
    const content = ['**News**', '- [W1] a', '', '**New papers**', '- [P8] over the cap', '- [P9] unknown'].join('\n')
    const out = finalizeAgentItems(content, payload([web(1), paper(8)], 1))
    expect(out.content).toBe(['**News**', `- ${itemPrefix(web(1))} a`, ''].join('\n'))
    expect(out.payload.items.map((i) => i.key)).toEqual(['W1'])
  })

  it('o cabeçalho fica quando ao menos uma linha da seção fica', () => {
    const content = '**News**\n- [W9] unknown\n- [W1] real\n\n**Releases**\n- [W2] kept too'
    const out = finalizeAgentItems(content, payload([web(1), web(2)]))
    expect(out.content).toBe(`**News**\n- ${itemPrefix(web(1))} real\n\n**Releases**\n- ${itemPrefix(web(2))} kept too`)
  })

  it('o cabeçalho de uma seção que ainda tem texto (o bloco do perfil, por exemplo) não sai', () => {
    const content = 'Nothing new since 13/11/2026.\n\n**Radar profile**\nFollow: rust, tokio\n- [W9] unknown\n  continued text'
    const out = finalizeAgentItems(content, payload([web(1)]))
    expect(out.content).toBe('Nothing new since 13/11/2026.\n\n**Radar profile**\nFollow: rust, tokio\n  continued text')
  })

  it('reconhece o cabeçalho com "#" e com ":" no fim', () => {
    const out = finalizeAgentItems('## News\n- [W9] x\nReleases:\n- [W9] y\n- [W1] z', payload([web(1)]))
    expect(out.content).toBe(`Releases:\n- ${itemPrefix(web(1))} z`)
  })

  it('resposta sem linhas de lista não perde nenhum cabeçalho', () => {
    const out = finalizeAgentItems('**News**\nSomething happened.', payload([web(1)]))
    expect(out.content).toBe('**News**\nSomething happened.')
  })
})

describe('finalizeMessageItems e settleMessageItems', () => {
  const NO_RESPONSE = 'no response'
  const all = (): AgentItemsPayload => ({
    ...payload(Array.from({ length: 20 }, (_, i) => web(i + 1))),
    search: { scopeKey: 'all', scopeLabel: 'all notebooks', since: null, windowNote: null, queries: ['q'], profile: false },
  })

  it('o fim real do turno: marcadores viram link e o payload fica só com os citados, sem o trecho', () => {
    const m = { id: 'a1', content: '- [W3] third\n- [W99] ghost', agentItems: all() }
    const out = finalizeMessageItems(m, NO_RESPONSE)
    expect(out.id).toBe('a1')
    expect(out.content).toBe(`- ${itemPrefix(web(3))} third`)
    expect(out.agentItems?.items.map((i) => i.key)).toEqual(['W3'])
    expect(out.agentItems?.items[0]).toMatchObject({ snippet: '' })
    expect(out.agentItems?.search?.scopeKey).toBe('all')
  })

  it('sem texto depois da finalização, a resposta vira o texto de "sem resposta"', () => {
    expect(finalizeMessageItems({ content: '- [W99] ghost', agentItems: all() }, NO_RESPONSE).content).toBe(NO_RESPONSE)
  })

  it('mensagem sem itens não muda (o mesmo objeto)', () => {
    const m = { content: 'plain [W3]' }
    expect(finalizeMessageItems(m, NO_RESPONSE)).toBe(m)
    expect(settleMessageItems(m)).toBe(m)
  })

  it('resposta parada, com erro ou cortada, com texto: os marcadores viram link e só os citados ficam gravados', () => {
    const out = settleMessageItems({ content: 'Found:\n- [W3] third and', agentItems: all() })
    expect(out.content).toBe(`Found:\n- ${itemPrefix(web(3))} third and`)
    expect(out.content).not.toContain('[W3]')
    expect(out.agentItems?.items.map((i) => i.key)).toEqual(['W3'])
    expect(JSON.stringify(out.agentItems).length).toBeLessThan(JSON.stringify(all()).length / 5)
  })

  it('sem texto (o balão vira erro ou some), o payload inteiro sai da mensagem', () => {
    expect(settleMessageItems({ content: '', agentItems: all() }).agentItems).toBeUndefined()
    expect(settleMessageItems({ content: '  \n', agentItems: all() }).agentItems).toBeUndefined()
  })

  it('texto parcial que some inteiro na finalização também não deixa payload', () => {
    const out = settleMessageItems({ content: '- [W99] ghost', agentItems: all() })
    expect(out.content).toBe('')
    expect(out.agentItems).toBeUndefined()
  })
})

describe('citedItemReason', () => {
  it('devolve o texto do modelo depois do prefixo do item', () => {
    const items = payload([paper(1), paper(2)])
    const { content } = finalizeAgentItems('- [P2] Core survey for your plan\n- [P1] Seminal method', items)
    expect(citedItemReason(content, paper(1))).toBe('Seminal method')
    expect(citedItemReason(content, paper(2))).toBe('Core survey for your plan')
  })

  it('devolve vazio quando o item não está no texto', () => {
    expect(citedItemReason('- nothing here', paper(1))).toBe('')
  })

  it('usa a 1ª linha em que o item aparece', () => {
    const items = payload([paper(1)])
    const { content } = finalizeAgentItems('- [P1] first reason\n- [P1] second reason', items)
    expect(citedItemReason(content, paper(1))).toBe('first reason')
  })
})

describe('finalizeAgentItems e os dados da consulta', () => {
  it('o payload podado continua com os dados da consulta (escopo, janela e consultas)', () => {
    const search: AgentSearchInfo = {
      scopeKey: 'notebook:nb1',
      scopeLabel: 'notebook "ML"',
      since: '2026-11-13',
      windowNote: 'last check: 13/11/2026',
      queries: ['graph neural networks', 'message passing'],
      profile: false,
    }
    const out = finalizeAgentItems('- [W1] ok', { ...payload([web(1), web(2)]), search })
    expect(out.payload.items.map((i) => i.key)).toEqual(['W1'])
    expect(out.payload.search).toEqual(search)
  })
})

describe('previousAgentRun', () => {
  const search = (scopeKey: string): AgentSearchInfo => ({
    scopeKey,
    scopeLabel: scopeKey,
    since: '2026-11-13',
    windowNote: 'last check: 13/11/2026',
    queries: ['q'],
    profile: false,
  })
  const NOON = new Date(2026, 10, 18, 12).toISOString()
  const answer = (agentId: string | undefined, scopeKey: string | null, over: Record<string, unknown> = {}) => ({
    role: 'assistant' as const,
    agentId,
    agentItems: scopeKey ? { ...payload([]), search: search(scopeKey) } : undefined,
    timestamp: NOON,
    ...over,
  })
  const question = { role: 'user' as const, timestamp: NOON }

  it('a última resposta do mesmo agente com consulta registrada, com o dia local em que rodou', () => {
    const run = previousAgentRun([question, answer('radar', 'all'), question], 'radar')
    expect(run?.search.scopeKey).toBe('all')
    expect(run?.ranOn).toBe('2026-11-18')
  })

  it('pula o seguimento sem payload e acha a consulta que veio antes', () => {
    const run = previousAgentRun([answer('radar', 'tag:x'), question, answer('radar', null), question], 'radar')
    expect(run?.search.scopeKey).toBe('tag:x')
  })

  it('fica com a mais recente quando há mais de uma', () => {
    const run = previousAgentRun([answer('radar', 'tag:x'), answer('radar', 'all')], 'radar')
    expect(run?.search.scopeKey).toBe('all')
  })

  it('a resposta que falhou ou foi parada não conta: vale a anterior concluída', () => {
    const msgs = [answer('radar', 'tag:x'), answer('radar', 'all', { failed: 'retry' })]
    expect(previousAgentRun(msgs, 'radar')?.search.scopeKey).toBe('tag:x')
    expect(previousAgentRun([answer('radar', 'all', { interrupted: 'stopped' })], 'radar')).toBeNull()
  })

  it('só vale para o mesmo agente: um Papers depois do Radar começa do zero', () => {
    expect(previousAgentRun([answer('radar', 'all'), answer('papers', 'all')], 'radar')).toBeNull()
    expect(previousAgentRun([answer('radar', 'all')], 'papers')).toBeNull()
  })

  it('mensagem gravada sem os dados da consulta (versão antiga) não conta', () => {
    expect(previousAgentRun([{ ...answer('radar', null), agentItems: payload([web(1)]) }], 'radar')).toBeNull()
    expect(previousAgentRun([], 'radar')).toBeNull()
  })

  it('timestamp inválido: a consulta vale, sem o dia', () => {
    expect(previousAgentRun([answer('radar', 'all', { timestamp: 'not a date' })], 'radar')?.ranOn).toBeNull()
  })
})

describe('agentRuns', () => {
  const search = (scopeKey: string): AgentSearchInfo => ({
    scopeKey,
    scopeLabel: scopeKey,
    since: '2026-11-13',
    windowNote: 'last check: 13/11/2026',
    queries: ['q'],
    profile: false,
  })
  const NOON = new Date(2026, 10, 18, 12).toISOString()
  const answer = (agentId: string | undefined, scopeKey: string | null, over: Record<string, unknown> = {}) => ({
    role: 'assistant' as const,
    agentId,
    agentItems: scopeKey ? { ...payload([]), search: search(scopeKey) } : undefined,
    timestamp: NOON,
    ...over,
  })
  const question = { role: 'user' as const, timestamp: NOON }

  it('todas as consultas concluídas do agente, da mais recente à mais antiga e com o dia em que rodaram', () => {
    const runs = agentRuns(
      [question, answer('radar', 'notebook:ml'), question, answer('radar', 'tag:rust'), question, answer('radar', 'notebook:ml')],
      'radar'
    )
    expect(runs.map((r) => r.search.scopeKey)).toEqual(['notebook:ml', 'tag:rust', 'notebook:ml'])
    expect(runs.every((r) => r.ranOn === '2026-11-18')).toBe(true)
  })

  it('pula o seguimento sem payload, a resposta que falhou ou foi parada e as de outro agente', () => {
    const runs = agentRuns(
      [
        answer('radar', 'all'),
        answer('radar', null),
        answer('radar', 'tag:x', { failed: 'retry' }),
        answer('radar', 'tag:y', { interrupted: 'stopped' }),
        answer('papers', 'tag:z'),
        answer(undefined, 'tag:w'),
      ],
      'radar'
    )
    expect(runs.map((r) => r.search.scopeKey)).toEqual(['all'])
    expect(agentRuns([], 'radar')).toEqual([])
  })
})

describe('searchLine', () => {
  const base: AgentSearchInfo = {
    scopeKey: 'notebook:nb1',
    scopeLabel: 'notebook "ML"',
    since: '2026-11-13',
    windowNote: 'last check: 13/11/2026',
    queries: ['graph neural networks', 'message passing'],
    profile: false,
  }

  it('escopo com a inicial maiúscula, a janela com a origem e as consultas', () => {
    expect(searchLine(base)).toBe('Notebook "ML" · since 13/11/2026 (last check) · searched: graph neural networks, message passing')
  })

  it('o Papers não tem janela: só o escopo e as consultas', () => {
    expect(searchLine({ ...base, scopeLabel: 'tag #llm', since: null, windowNote: null })).toBe(
      'Tag #llm · searched: graph neural networks, message passing'
    )
  })

  it('com o perfil em uso, acrescenta "radar profile" como texto', () => {
    expect(searchLine({ ...base, scopeLabel: 'all notebooks', profile: true })).toBe(
      'All notebooks · since 13/11/2026 (last check) · radar profile · searched: graph neural networks, message passing'
    )
  })

  it('diz de onde veio cada janela', () => {
    const line = (windowNote: string, since = '2026-10-21') => searchLine({ ...base, since, windowNote, queries: [] })
    expect(line('first check of this scope: last 30 days')).toBe('Notebook "ML" · since 21/10/2026 (first check: last 30 days)')
    expect(line('asked in your message', '2026-11-01')).toBe('Notebook "ML" · since 01/11/2026 (asked in your message)')
    expect(line('asked in your message: last 7 days', '2026-11-13')).toBe(
      'Notebook "ML" · since 13/11/2026 (asked in your message: last 7 days)'
    )
    expect(line('asked in your message: last 365 days; capped at 90 days', '2026-08-22')).toBe(
      'Notebook "ML" · since 22/08/2026 (asked in your message: last 365 days, capped at 90 days)'
    )
  })

  it('cortada pelo teto de 90 dias: mantém a data da última consulta', () => {
    const capped = { ...base, since: '2026-08-22', windowNote: 'last check: 01/05/2026; capped at 90 days', queries: [] }
    expect(searchLine(capped)).toBe('Notebook "ML" · since 22/08/2026 (last check 01/05/2026, capped at 90 days)')
  })

  it('janela sem nota e consultas vazias não deixam sobra na linha', () => {
    expect(searchLine({ ...base, windowNote: null, queries: [] })).toBe('Notebook "ML" · since 13/11/2026')
  })

  it('mensagem gravada antes do campo existir não tem linha', () => {
    expect(searchLine(undefined)).toBeNull()
  })
})

describe('hasAgentPayload', () => {
  const search: AgentSearchInfo = { scopeKey: 'all', scopeLabel: 'all notebooks', since: null, windowNote: null, queries: ['q'], profile: false }

  it('com itens, ou só com os dados da consulta (resposta sem item), a lista e a linha valem', () => {
    expect(hasAgentPayload({ agentItems: payload([web(1)]) })).toBe(true)
    expect(hasAgentPayload({ agentItems: { ...payload([]), search } })).toBe(true)
  })

  it('sem itens e sem consulta (mensagem antiga), ou sem payload, não há nada a mostrar', () => {
    expect(hasAgentPayload({ agentItems: payload([]) })).toBe(false)
    expect(hasAgentPayload({})).toBe(false)
  })

  it('resposta parada ou com erro não mostra a lista nem a linha', () => {
    expect(hasAgentPayload({ agentItems: { ...payload([web(1)]), search }, failed: 'retry' })).toBe(false)
    expect(hasAgentPayload({ agentItems: { ...payload([]), search }, interrupted: 'stopped' })).toBe(false)
  })
})

describe('radarProfileDraftAllowed', () => {
  const search: AgentSearchInfo = { scopeKey: 'all', scopeLabel: 'all notebooks', since: null, windowNote: null, queries: ['q'], profile: false }
  const withSearch = (patch: Partial<AgentSearchInfo>) => ({ agentItems: { ...payload([]), search: { ...search, ...patch } } })

  it('o app sabia de uma nota de perfil na consulta: o botão não vale, haja ou não linha do perfil no mapa de foco', () => {
    expect(radarProfileDraftAllowed(withSearch({ hasProfileNote: true, profile: false }))).toBe(false)
    expect(radarProfileDraftAllowed(withSearch({ hasProfileNote: true, profile: true }))).toBe(false)
  })

  it('o app sabia que não havia perfil: o botão vale', () => {
    expect(radarProfileDraftAllowed(withSearch({ hasProfileNote: false }))).toBe(true)
  })

  it('mensagem gravada antes do campo (ou sem payload ou sem dados da consulta): fica como antes, o botão vale', () => {
    expect(radarProfileDraftAllowed(withSearch({}))).toBe(true)
    expect(radarProfileDraftAllowed(withSearch({ profile: true }))).toBe(true)
    expect(radarProfileDraftAllowed({ agentItems: payload([web(1)]) })).toBe(true)
    expect(radarProfileDraftAllowed({})).toBe(true)
  })

  it('o campo sobrevive à poda do fim do turno e não muda o texto da linha do app', () => {
    const base = { ...payload([web(1)]), search: { ...search, hasProfileNote: true } }
    const fin = finalizeAgentItems('- [W1] about it', base)
    expect(fin.payload.search?.hasProfileNote).toBe(true)
    expect(radarProfileDraftAllowed({ agentItems: fin.payload })).toBe(false)
    expect(searchLine(base.search)).toBe(searchLine({ ...search, hasProfileNote: undefined }))
  })
})

describe('markStoppedBeforeReply', () => {
  const user = { id: 'u1', role: 'user' as const, content: 'What is new?' }
  const empty = { id: 'a1', role: 'assistant' as const, content: '', agentId: 'radar' }

  it('o balão vazio do turno fica parado e leva o modelo, como no Stop do streaming', () => {
    const out = markStoppedBeforeReply([user, empty], 'a1', 'openai/gpt-5.4')
    expect(out[0]).toBe(user)
    expect(out[1]).toMatchObject({ id: 'a1', content: '', agentId: 'radar', interrupted: 'stopped', model: 'openai/gpt-5.4' })
  })

  it('o modelo já gravado fica, e o payload dos candidatos (se já estava lá) sai', () => {
    const withPayload = { ...empty, model: 'anthropic/claude', agentItems: payload([web(1)]) }
    const [out] = markStoppedBeforeReply([withPayload], 'a1', 'openai/gpt-5.4')
    expect(out.model).toBe('anthropic/claude')
    expect(out.agentItems).toBeUndefined()
    expect(out).toMatchObject({ interrupted: 'stopped' })
  })

  it('o balão parado não tem lista nem linha do app (a consulta não conta como anterior)', () => {
    const [out] = markStoppedBeforeReply([{ ...empty, agentItems: { ...payload([]), search: { scopeKey: 'all', scopeLabel: 'all notebooks', since: null, windowNote: null, queries: ['q'], profile: false } } }], 'a1', undefined)
    expect(hasAgentPayload(out)).toBe(false)
    expect(previousAgentRun([{ ...user, timestamp: '2026-11-20T10:00:00Z' }, { ...out, timestamp: '2026-11-20T10:00:01Z' }], 'radar')).toBeNull()
  })

  it('só mexe no balão vazio do turno: outro balão ou um com texto fica como estava', () => {
    const other = { id: 'a0', role: 'assistant' as const, content: '' }
    const withText = { id: 'a1', role: 'assistant' as const, content: 'partial' }
    const out = markStoppedBeforeReply([other, withText], 'a1', 'm')
    expect(out[0]).toBe(other)
    expect(out[1]).toBe(withText)
  })
})
