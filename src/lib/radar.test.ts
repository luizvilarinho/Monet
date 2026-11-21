import { describe, expect, it } from 'vitest'
import type { AgentRun, PaperItem, WebItem } from './agentItems'
import {
  chooseRadarWindow,
  cleanQueries,
  asksOnlyRepeatOrWindow,
  formatDatedResults,
  hasEarlierSearch,
  isFollowUp,
  isSinceTitleQuery,
  keptWindow,
  keyPapers,
  lastSinceDay,
  messageSubject,
  normalizeUrl,
  PAPERS_DEFAULT_MESSAGE,
  papersQueries,
  paperCandidatesBlock,
  parseDateInText,
  parseQueryPlan,
  RADAR_DEFAULT_MESSAGE,
  radarQueryBuckets,
  radarWindow,
  recordedDate,
  repeatSearchNotes,
  REPEAT_SEARCH_NOTE,
  requestedWindow,
  resolveResultUrl,
  searchedQueries,
  sinceCutoff,
  sinceTitleQuery,
  toDateKeyLoose,
  uniqueQueries,
  webCandidates,
  webCandidatesBlock,
  WHOLE_SCOPE_NOTE,
} from './radar'
import { ragGate } from './rag'
import type { SearchResult } from './search'

const TODAY = '2026-11-20'

function result(n: number, patch: Partial<SearchResult> = {}): SearchResult {
  return {
    title: `Title ${n}`,
    url: `https://www.example.com/post-${n}`,
    content: `content ${n}`,
    publishedDate: '2026-11-18',
    ...patch,
  }
}

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

function paperFields(n: number, patch: Partial<Omit<PaperItem, 'key'>> = {}): Omit<PaperItem, 'key'> {
  return {
    kind: 'paper',
    section: 'radar',
    id: `doi:10.1000/p${n}`,
    openalexId: `W${n}00`,
    title: `Paper title ${n}`,
    authors: ['Ana Smith', 'Bo Lee', 'Cy Chen'],
    authorCount: 3,
    year: 2025,
    date: '2025-05-01',
    doi: `10.1000/p${n}`,
    url: `https://doi.org/10.1000/p${n}`,
    citations: 12,
    type: 'article',
    isOa: true,
    pdfUrl: null,
    oaUrl: null,
    abstract: 'An abstract.',
    ...patch,
  }
}

describe('radarWindow', () => {
  it('primeira vez: os últimos 30 dias', () => {
    expect(radarWindow(null, TODAY)).toEqual({ since: '2026-10-21', note: 'first check of this scope: last 30 days' })
  })

  it('consulta recente: desde a última consulta', () => {
    expect(radarWindow('2026-11-10', TODAY)).toEqual({ since: '2026-11-10', note: 'last check: 10/11/2026' })
    expect(radarWindow(TODAY, TODAY).since).toBe(TODAY)
  })

  it('corta em 90 dias', () => {
    expect(radarWindow('2026-01-01', TODAY)).toEqual({
      since: '2026-08-22',
      note: 'last check: 01/01/2026; capped at 90 days',
    })
    expect(radarWindow('2026-08-22', TODAY).note).toBe('last check: 22/08/2026')
  })

  it('data no futuro vale como hoje', () => {
    expect(radarWindow('2026-12-31', TODAY)).toEqual({ since: TODAY, note: 'last check: 20/11/2026' })
  })
})

describe('parseQueryPlan', () => {
  it('lê o prefixo sem caixa e descarta o que não tem prefixo conhecido', () => {
    expect(
      parseQueryPlan([
        'news: rust async runtime',
        'Release:  tokio 2.0 ',
        'PAPER: structured concurrency',
        'web: eu 2026 laws',
        'blog: something',
        'no prefix at all',
        'news:   ',
      ])
    ).toEqual([
      { kind: 'news', query: 'rust async runtime' },
      { kind: 'release', query: 'tokio 2.0' },
      { kind: 'paper', query: 'structured concurrency' },
      { kind: 'web', query: 'eu 2026 laws' },
    ])
  })
})

describe('cleanQueries', () => {
  it('tira aspas, colchetes e o # de hashtag, e colapsa espaços', () => {
    expect(cleanQueries(['  "rust"   [async]  #tokio ', 'C# 14 features', "'quoted' O'Reilly"], { max: 5 })).toEqual([
      'rust async tokio',
      'C# 14 features',
      "quoted O'Reilly",
    ])
  })

  it('descarta a vazia, a longa demais e a de palavras demais', () => {
    const tooLong = 'a'.repeat(121)
    const twelve = 'one two three four five six seven eight nine ten eleven twelve'
    expect(cleanQueries(['', '   ', '""', tooLong, `${twelve} thirteen`, twelve], { max: 5 })).toEqual([twelve])
  })

  it('descarta a repetida sem caixa', () => {
    expect(cleanQueries(['Rust async', 'rust ASYNC', 'rust  async', 'go generics'], { max: 5 })).toEqual([
      'Rust async',
      'go generics',
    ])
  })

  it('com forbidCopyFrom, barra a consulta de 6+ palavras copiada da nota; a curta passa', () => {
    const note = 'Meeting notes: the migration of the billing service to event sourcing is delayed until March.'
    expect(
      cleanQueries(
        [
          'migration of the billing service to event sourcing', // 8 palavras, inteira na nota
          'billing service event sourcing', // 4 palavras, curta
          'the billing service to event', // 5 palavras, abaixo de 6
          'billing service to event sourcing delayed', // 6 palavras mas fora de ordem na nota
        ],
        { max: 5, forbidCopyFrom: note }
      )
    ).toEqual(['billing service event sourcing', 'the billing service to event', 'billing service to event sourcing delayed'])
    expect(cleanQueries(['migration of the billing service to event sourcing'], { max: 5 })).toHaveLength(1)
  })

  it('corta em max', () => {
    expect(cleanQueries(['a1', 'b2', 'c3', 'd4'], { max: 2 })).toEqual(['a1', 'b2'])
  })
})

describe('radarQueryBuckets', () => {
  it('separa por tipo, com até 3 de cada e sem a web do /since', () => {
    const plan = parseQueryPlan([
      'news: n1',
      'news: n2',
      'news: n3',
      'news: n4',
      'release: r1',
      'release: r2',
      'paper: p1',
      'paper: p2',
      'paper: p3',
      'paper: p4',
      'web: ignored',
    ])
    const b = radarQueryBuckets(plan, ['t1', 't2'])
    expect(b.news).toEqual(['n1', 'n2', 'n3'])
    expect(b.release).toEqual(['r1', 'r2'])
    expect(b.paper).toEqual(['p1', 'p2', 'p3'])
    expect(b.news.length + b.release.length).toBeLessThanOrEqual(6)
    expect(b.reserve).toBe(false)
  })

  it('plano vazio: news e paper com os 3 primeiros assuntos, sem releases, marcados como reserva', () => {
    expect(radarQueryBuckets([], ['rust', 'tokio', 'async', 'extra'])).toEqual({
      news: ['rust', 'tokio', 'async'],
      release: [],
      paper: ['rust', 'tokio', 'async'],
      reserve: true,
    })
  })

  it('sem plano e sem assuntos, tudo vazio e sem reserva', () => {
    expect(radarQueryBuckets([], [])).toEqual({ news: [], release: [], paper: [], reserve: false })
  })

  it('a reserva também limpa os assuntos', () => {
    expect(radarQueryBuckets([], ['#rust', '"tokio"'])).toEqual({
      news: ['rust', 'tokio'],
      release: [],
      paper: ['rust', 'tokio'],
      reserve: true,
    })
  })

  it('um plano sem consulta aproveitável cai na reserva', () => {
    const plan = parseQueryPlan([`news: ${'x'.repeat(130)}`])
    const b = radarQueryBuckets(plan, ['rust'])
    expect(b.news).toEqual(['rust'])
    expect(b.reserve).toBe(true)
  })

  it('barra a consulta copiada do mapa de foco', () => {
    const focus = 'Radar profile: Follow: the future of distributed consensus protocols in databases'
    const plan = parseQueryPlan(['news: the future of distributed consensus protocols', 'news: raft consensus'])
    expect(radarQueryBuckets(plan, [], focus).news).toEqual(['raft consensus'])
  })
})

describe('papersQueries', () => {
  it('até 2 consultas paper e nenhuma outra', () => {
    const plan = parseQueryPlan(['paper: p1', 'paper: p2', 'paper: p3', 'news: n1'])
    expect(papersQueries(plan, ['t1', 't2'])).toEqual(['p1', 'p2'])
  })

  it('reserva: os 2 primeiros assuntos', () => {
    expect(papersQueries([], ['graph networks', 'attention', 'extra'])).toEqual(['graph networks', 'attention'])
    expect(papersQueries(parseQueryPlan(['news: n1']), ['t1'])).toEqual(['t1'])
    expect(papersQueries([], [])).toEqual([])
  })
})

describe('toDateKeyLoose', () => {
  it('lê ISO, com ou sem hora', () => {
    expect(toDateKeyLoose('2026-11-18')).toBe('2026-11-18')
    expect(toDateKeyLoose('2026-11-18T23:30:00-03:00')).toBe('2026-11-18')
    expect(toDateKeyLoose('2026-11-18 10:00:00')).toBe('2026-11-18')
  })

  it('lê RFC 2822 e datas por extenso em UTC', () => {
    expect(toDateKeyLoose('Tue, 18 Nov 2026 10:00:00 GMT')).toBe('2026-11-18')
    expect(toDateKeyLoose('Nov 18, 2026')).toBe('2026-11-18')
  })

  it('inválido, vazio ou sem forma de data = null', () => {
    expect(toDateKeyLoose(undefined)).toBeNull()
    expect(toDateKeyLoose('')).toBeNull()
    expect(toDateKeyLoose('yesterday')).toBeNull()
    expect(toDateKeyLoose('2026-13-45')).toBeNull()
    expect(toDateKeyLoose('2026')).toBeNull()
    expect(toDateKeyLoose('5')).toBeNull()
  })
})

describe('normalizeUrl', () => {
  it('host em minúsculas sem www, sem hash, sem rastreio e sem barra final', () => {
    expect(normalizeUrl('https://WWW.Example.com/Post/?utm_source=x&id=7&ref=tw&fbclid=a&gclid=b#top')).toBe(
      'https://example.com/Post?id=7'
    )
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
    expect(normalizeUrl('https://example.com/a/b///')).toBe('https://example.com/a/b')
  })

  it('o que não é URL volta aparado', () => {
    expect(normalizeUrl('  not a url ')).toBe('not a url')
  })
})

describe('webCandidates', () => {
  const base = { since: '2026-11-10', todayKey: TODAY, max: 20 }

  it('fica só o que tem data entre o corte e hoje (inclusivos)', () => {
    const items = webCandidates(
      [
        {
          section: 'news',
          results: [
            result(1, { publishedDate: '2026-11-10' }),
            result(2, { publishedDate: '2026-11-09' }),
            result(3, { publishedDate: undefined }),
            result(4, { publishedDate: 'sometime' }),
            result(5, { publishedDate: '2026-11-20T08:00:00Z' }),
            result(6, { publishedDate: '2026-11-21' }),
          ],
        },
      ],
      base
    )
    expect(items.map((i) => i.url)).toEqual(['https://www.example.com/post-5', 'https://www.example.com/post-1'])
  })

  it('tira a URL repetida entre as seções (o primeiro grupo ganha)', () => {
    const dup = result(1, { url: 'https://example.com/post-1?utm_source=feed', title: 'in releases' })
    const items = webCandidates(
      [
        { section: 'news', results: [result(1, { title: 'in news' })] },
        { section: 'releases', results: [dup, result(2)] },
      ],
      base
    )
    expect(items.map((i) => [i.section, i.title])).toEqual([
      ['news', 'in news'],
      ['releases', 'Title 2'],
    ])
  })

  it('tira o que já está na KB, pelo hash da URL', () => {
    const items = webCandidates([{ section: 'news', results: [result(1), result(2)] }], {
      ...base,
      excludeHashes: new Set(['hash-of-https://www.example.com/post-1']),
      hashOf: (url) => `hash-of-${url}`,
    })
    expect(items.map((i) => i.title)).toEqual(['Title 2'])
  })

  it('ordena cada seção pela data, intercala News e Releases, corta em max e dá as chaves', () => {
    const items = webCandidates(
      [
        {
          section: 'news',
          results: [result(1, { publishedDate: '2026-11-12' }), result(2, { publishedDate: '2026-11-19' }), result(3, { publishedDate: '2026-11-15' })],
        },
        { section: 'releases', results: [result(4, { publishedDate: '2026-11-14' }), result(5, { publishedDate: '2026-11-18' })] },
      ],
      base
    )
    expect(items.map((i) => `${i.key}:${i.title}`)).toEqual([
      'W1:Title 2', // news mais nova
      'W2:Title 5', // release mais nova
      'W3:Title 3',
      'W4:Title 4',
      'W5:Title 1',
    ])
    expect(webCandidates([{ section: 'news', results: [result(1), result(2), result(3)] }], { ...base, max: 2 })).toHaveLength(2)
  })

  it('monta fonte, data e trecho cortado em 300 caracteres', () => {
    const [item] = webCandidates([{ section: 'releases', results: [result(1, { content: `${'word '.repeat(100)}` })] }], base)
    expect(item).toMatchObject({ kind: 'web', key: 'W1', section: 'releases', source: 'example.com', date: '2026-11-18' })
    expect(item.snippet.length).toBeLessThanOrEqual(300)
    expect(item.snippet.endsWith('…')).toBe(true)
  })

  it('sem resultados, lista vazia', () => {
    expect(webCandidates([], base)).toEqual([])
  })

  it('link de redirecionamento do Google vira a página de destino, com a fonte do destino', () => {
    const redirect = result(1, {
      title: 'Nemotron post',
      url: 'https://www.google.com/url?sa=t&rct=j&q=&esrc=s&source=web&url=https%3A%2F%2Fwww.example.org%2Fposts%2Fnemotron%3Fid%3D7&ved=abc',
    })
    const [item] = webCandidates([{ section: 'news', results: [redirect] }], base)
    expect(item).toMatchObject({ url: 'https://www.example.org/posts/nemotron?id=7', source: 'example.org', title: 'Nemotron post' })
  })

  it('o destino repetido de um redirecionamento e de um link direto conta uma vez; o hash é o do destino', () => {
    const redirect = result(1, { url: 'https://google.com/url?q=https://example.com/post-1&sa=U' })
    const items = webCandidates([{ section: 'news', results: [result(1), redirect] }], {
      ...base,
      excludeHashes: new Set(['hash-of-https://example.com/post-2']),
      hashOf: (url) => `hash-of-${url}`,
    })
    expect(items).toHaveLength(1)
    const killed = webCandidates([{ section: 'news', results: [result(2, { url: 'https://www.google.com.br/url?url=https://example.com/post-2' })] }], {
      ...base,
      excludeHashes: new Set(['hash-of-https://example.com/post-2']),
      hashOf: (url) => `hash-of-${url}`,
    })
    expect(killed).toEqual([])
  })

  it('redirecionamento sem destino legível sai da lista', () => {
    const results = [
      result(1, { url: 'https://www.google.com/url?sa=t&q=&esrc=s' }),
      result(2, { url: 'https://www.google.com/url?url=not-a-url' }),
      result(3, { url: 'https://www.google.com/url?url=javascript%3Aalert(1)' }),
      result(4, { url: 'https://www.google.com/url?url=https%3A%2F%2Fwww.google.com%2Furl%3Furl%3Dhttps%3A%2F%2Fa.com' }),
      result(5),
    ]
    expect(webCandidates([{ section: 'news', results }], base).map((i) => i.title)).toEqual(['Title 5'])
  })
})

describe('resolveResultUrl', () => {
  it('usa o parâmetro url, e q quando não há url', () => {
    expect(resolveResultUrl('https://www.google.com/url?url=https%3A%2F%2Fa.com%2Fx&q=https%3A%2F%2Fb.com')).toBe('https://a.com/x')
    expect(resolveResultUrl('https://www.google.com/url?q=https%3A%2F%2Fb.com%2Fy&sa=U')).toBe('https://b.com/y')
    expect(resolveResultUrl('https://www.google.co.uk/url?url=&q=https://b.com/y')).toBe('https://b.com/y')
    expect(resolveResultUrl('  https://google.de/url?q=http://c.de/z  ')).toBe('http://c.de/z')
  })

  it('sem destino legível, null', () => {
    expect(resolveResultUrl('https://www.google.com/url')).toBeNull()
    expect(resolveResultUrl('https://www.google.com/url?q=')).toBeNull()
    expect(resolveResultUrl('https://www.google.com/url?q=ftp%3A%2F%2Fa.com')).toBeNull()
    expect(resolveResultUrl('')).toBeNull()
  })

  it('outras URLs, inclusive outras páginas do Google, voltam como vieram', () => {
    expect(resolveResultUrl(' https://example.com/a?url=https://b.com ')).toBe('https://example.com/a?url=https://b.com')
    expect(resolveResultUrl('https://www.google.com/search?q=rust')).toBe('https://www.google.com/search?q=rust')
    expect(resolveResultUrl('https://notgoogle.com/url?q=https://b.com')).toBe('https://notgoogle.com/url?q=https://b.com')
    expect(resolveResultUrl('not a url')).toBe('not a url')
  })
})

describe('blocos de candidatos', () => {
  it('web: uma entrada por item, com a seção, a fonte e a data', () => {
    expect(webCandidatesBlock([web(1), web(2, { section: 'releases', snippet: '' })])).toBe(
      '[W1] News · "Web title 1" · example.com · 18/11/2026\n     snippet 1\n' +
        '[W2] Releases · "Web title 2" · example.com · 18/11/2026'
    )
    expect(webCandidatesBlock([])).toBe('(none)')
  })

  it('artigos: autores como no prefixo, ano, tipo, citações e acesso', () => {
    const items = keyPapers([
      paperFields(1),
      paperFields(2, { authorCount: 9, year: null, citations: 1, isOa: false, abstract: null }),
      paperFields(3, { authors: [], authorCount: 0, abstract: `${'long '.repeat(200)}` }),
    ])
    expect(items.map((i) => i.key)).toEqual(['P1', 'P2', 'P3'])
    const block = paperCandidatesBlock(items).split('\n')
    expect(block[0]).toBe('[P1] "Paper title 1" · Smith, Lee, Chen · 2025 · article · 12 citations · open access')
    expect(block[1]).toBe('     Abstract: An abstract.')
    expect(block[2]).toBe('[P2] "Paper title 2" · Smith, Lee, Chen et al. · n.d. · article · 1 citation · closed')
    expect(block[3]).toBe('     Abstract: (none)')
    expect(block[4]).toBe('[P3] "Paper title 3" · 2025 · article · 12 citations · open access')
    expect(block[5].length).toBeLessThanOrEqual('     Abstract: '.length + 500)
    expect(paperCandidatesBlock([])).toBe('(none)')
  })
})

describe('parseDateInText', () => {
  it('lê dd/mm/yyyy, d/m/yyyy e yyyy-mm-dd', () => {
    expect(parseDateInText('/since 01/03/2026')).toBe('2026-03-01')
    expect(parseDateInText('since 5/3/2026 please')).toBe('2026-03-05')
    expect(parseDateInText('from 2026-03-05.')).toBe('2026-03-05')
  })

  it('pega a primeira data válida', () => {
    expect(parseDateInText('31/02/2026 then 10/03/2026 and 2026-01-01')).toBe('2026-03-10')
  })

  it('sem data (ou só com número solto) = null', () => {
    expect(parseDateInText('what changed')).toBeNull()
    expect(parseDateInText('version 12/2026')).toBeNull()
    expect(parseDateInText('')).toBeNull()
  })
})

describe('sinceCutoff', () => {
  const created = new Date(2026, 5, 10, 12).getTime() // 10/06/2026 local
  const note = { date: '2026-04-01', createdAt: created }

  it('a data da instrução vence', () => {
    expect(sinceCutoff({ instruction: 'since 01/03/2026', note, calendarKey: '2026-02-02', todayKey: TODAY })).toEqual({
      cutoff: '2026-03-01',
      source: 'instruction',
    })
  })

  it('depois, o date da nota', () => {
    expect(sinceCutoff({ instruction: '', note, calendarKey: '2026-02-02', todayKey: TODAY })).toEqual({
      cutoff: '2026-04-01',
      source: 'note date',
    })
    // date inválida cai para a próxima fonte
    expect(sinceCutoff({ instruction: '', note: { ...note, date: '2026-99-01' }, calendarKey: '2026-02-02', todayKey: TODAY })).toEqual({
      cutoff: '2026-02-02',
      source: 'calendar day',
    })
  })

  it('depois, o dia da nota do Calendar e, por fim, a criação', () => {
    expect(sinceCutoff({ instruction: '', note: { date: null, createdAt: created }, calendarKey: '2026-02-02', todayKey: TODAY })).toEqual({
      cutoff: '2026-02-02',
      source: 'calendar day',
    })
    expect(sinceCutoff({ instruction: '', note: { createdAt: created }, calendarKey: null, todayKey: TODAY })).toEqual({
      cutoff: '2026-06-10',
      source: 'created',
    })
  })

  it('corte no futuro é erro; igual a hoje vale', () => {
    expect(sinceCutoff({ instruction: 'since 2026-12-01', note, calendarKey: null, todayKey: TODAY })).toEqual({
      error: 'The cutoff date is in the future.',
    })
    expect(sinceCutoff({ instruction: `since ${TODAY}`, note, calendarKey: null, todayKey: TODAY })).toEqual({
      cutoff: TODAY,
      source: 'instruction',
    })
  })

  it('o dia do último /since da nota vem depois da instrução e antes do date, do Calendar e da criação', () => {
    const o = { note, calendarKey: '2026-02-02', lastSince: '2026-09-15', todayKey: TODAY }
    expect(sinceCutoff({ instruction: '', ...o })).toEqual({ cutoff: '2026-09-15', source: 'last /since' })
    expect(sinceCutoff({ instruction: 'since 01/03/2026', ...o })).toEqual({ cutoff: '2026-03-01', source: 'instruction' })
    expect(sinceCutoff({ instruction: '', note: { createdAt: created }, calendarKey: null, lastSince: '2026-09-15', todayKey: TODAY })).toEqual({
      cutoff: '2026-09-15',
      source: 'last /since',
    })
  })

  it('sem último /since (ausente, null ou inválido) a ordem de antes vale', () => {
    expect(sinceCutoff({ instruction: '', note, calendarKey: null, lastSince: null, todayKey: TODAY })).toEqual({
      cutoff: '2026-04-01',
      source: 'note date',
    })
    expect(sinceCutoff({ instruction: '', note, calendarKey: null, lastSince: 'ontem', todayKey: TODAY })).toEqual({
      cutoff: '2026-04-01',
      source: 'note date',
    })
  })

  it('último /since no futuro é erro; igual a hoje vale', () => {
    expect(sinceCutoff({ instruction: '', note, calendarKey: null, lastSince: '2026-12-01', todayKey: TODAY })).toEqual({
      error: 'The cutoff date is in the future.',
    })
    expect(sinceCutoff({ instruction: '', note, calendarKey: null, lastSince: TODAY, todayKey: TODAY })).toEqual({
      cutoff: TODAY,
      source: 'last /since',
    })
  })
})

describe('lastSinceDay', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 15).getTime()
  const since = (patch: Partial<Parameters<typeof lastSinceDay>[1][number]> = {}) => ({
    noteId: 'n1',
    command: '/since',
    status: 'completed',
    response: '- **10/10/2026** — something',
    createdAt: at(2026, 10, 10),
    ...patch,
  })

  it('o dia da resposta /since concluída mais recente da nota', () => {
    expect(lastSinceDay('n1', [since(), since({ createdAt: at(2026, 11, 2) }), since({ createdAt: at(2026, 9, 1) })])).toBe('2026-11-02')
  })

  it('sem /since concluído da nota, null', () => {
    expect(lastSinceDay('n1', [])).toBeNull()
    expect(lastSinceDay('n1', [since({ noteId: 'n2' })])).toBeNull()
    expect(lastSinceDay('n1', [since({ command: '/critique' })])).toBeNull()
  })

  it('bloco que falhou, parou, está em andamento ou sem texto não conta', () => {
    for (const status of ['error', 'interrupted', 'streaming', 'preparing']) {
      expect(lastSinceDay('n1', [since({ status })])).toBeNull()
    }
    expect(lastSinceDay('n1', [since({ response: '  ' })])).toBeNull()
    // o concluído anterior vale quando o mais novo falhou
    expect(lastSinceDay('n1', [since({ createdAt: at(2026, 11, 2), status: 'error' }), since()])).toBe('2026-10-10')
  })
})

describe('sinceTitleQuery e isSinceTitleQuery', () => {
  it('sem instrução, a data de corte e a origem', () => {
    expect(sinceTitleQuery({ cutoff: '2026-03-01', source: 'created' }, '')).toBe('01/03/2026 (note created)')
    expect(sinceTitleQuery({ cutoff: '2026-04-01', source: 'note date' }, '  ')).toBe('01/04/2026 (note date)')
    expect(sinceTitleQuery({ cutoff: '2026-02-02', source: 'calendar day' }, '')).toBe('02/02/2026 (calendar day)')
    expect(sinceTitleQuery({ cutoff: '2026-09-15', source: 'last /since' }, '')).toBe('15/09/2026 (last /since)')
  })

  it('com instrução (data ou outro texto) o título fica com o que o usuário escreveu: null', () => {
    expect(sinceTitleQuery({ cutoff: '2026-03-01', source: 'instruction' }, 'since 01/03/2026')).toBeNull()
    expect(sinceTitleQuery({ cutoff: '2026-06-10', source: 'created' }, 'only benchmarks')).toBeNull()
  })

  it('isSinceTitleQuery reconhece só a query que o app grava', () => {
    expect(isSinceTitleQuery('01/03/2026 (note created)')).toBe(true)
    expect(isSinceTitleQuery(' 15/09/2026 (last /since) ')).toBe(true)
    expect(isSinceTitleQuery('01/03/2026')).toBe(false)
    expect(isSinceTitleQuery('since 01/03/2026 (note created)')).toBe(false)
    expect(isSinceTitleQuery('01/03/2026 (from a friend)')).toBe(false)
    expect(isSinceTitleQuery('')).toBe(false)
  })
})

describe('formatDatedResults', () => {
  it('lista vazia = texto vazio', () => {
    expect(formatDatedResults([], '2026-03-01')).toBe('')
  })

  it('cabeçalho com o corte e uma entrada por resultado', () => {
    expect(formatDatedResults([web(1), web(2, { snippet: '' })], '2026-03-01')).toBe(
      'Web search results (published since 01/03/2026; the date of a page can be its last update):\n\n' +
        '1. **Web title 1** · example.com · 18/11/2026\n   https://example.com/1\n   snippet 1\n\n' +
        '2. **Web title 2** · example.com · 18/11/2026\n   https://example.com/2'
    )
  })
})

// ─── Janela pedida na mensagem, janela da conversa e seguimento ─────────────

describe('requestedWindow', () => {
  it('uma data na mensagem vira o início da janela (dd/mm/yyyy, d/m/yyyy e yyyy-mm-dd)', () => {
    expect(requestedWindow('since 01/11/2026', TODAY)).toEqual({ since: '2026-11-01', note: 'asked in your message' })
    expect(requestedWindow('desde 5/11/2026 por favor', TODAY)?.since).toBe('2026-11-05')
    expect(requestedWindow('from 2026-10-25', TODAY)?.since).toBe('2026-10-25')
  })

  it('"since 01/11" sem o ano usa o ano de hoje, ou o anterior quando a data ainda não chegou', () => {
    expect(requestedWindow('since 01/11', TODAY)?.since).toBe('2026-11-01')
    expect(requestedWindow('desde 25/12', '2027-01-10')?.since).toBe('2026-12-25')
    expect(requestedWindow('desde 25/12', TODAY)?.note).toBe('asked in your message; capped at 90 days')
    expect(requestedWindow('what is new since 20/11', TODAY)?.since).toBe(TODAY)
  })

  it('sem o since/from/desde, "dd/mm" solto não conta (3/4 pode ser uma fração)', () => {
    expect(requestedWindow('step 3/4 of the plan', TODAY)).toBeNull()
    expect(requestedWindow('since 31/02', TODAY)).toBeNull()
  })

  it('"last N days" e "últimos N dias"', () => {
    expect(requestedWindow('last 7 days', TODAY)).toEqual({ since: '2026-11-13', note: 'asked in your message: last 7 days' })
    expect(requestedWindow("what's new in the past 10 days?", TODAY)?.since).toBe('2026-11-10')
    expect(requestedWindow('últimos 15 dias', TODAY)?.since).toBe('2026-11-05')
    expect(requestedWindow('last 0 days', TODAY)).toBeNull()
    expect(requestedWindow('last days of summer', TODAY)).toBeNull()
  })

  it('teto de 90 dias, dito na nota', () => {
    expect(requestedWindow('last 365 days', TODAY)).toEqual({
      since: '2026-08-22',
      note: 'asked in your message: last 365 days; capped at 90 days',
    })
    expect(requestedWindow('since 2025-01-01', TODAY)).toEqual({
      since: '2026-08-22',
      note: 'asked in your message; capped at 90 days',
    })
    expect(requestedWindow('since 22/08/2026', TODAY)?.note).toBe('asked in your message')
  })

  it('data no futuro vale como hoje; sem data nem "last N days", null', () => {
    expect(requestedWindow('since 2027-01-01', TODAY)?.since).toBe(TODAY)
    expect(requestedWindow("What's new?", TODAY)).toBeNull()
    expect(requestedWindow('', TODAY)).toBeNull()
  })
})

function run(over: Partial<AgentRun['search']> = {}, ranOn: string | null = TODAY): AgentRun {
  return {
    ranOn,
    search: {
      scopeKey: 'notebook:nb1',
      scopeLabel: 'notebook "ML"',
      since: '2026-10-21',
      windowNote: 'first check of this scope: last 30 days',
      queries: ['graph neural networks'],
      profile: false,
      ...over,
    },
  }
}

describe('keptWindow e chooseRadarWindow', () => {
  it('a janela da consulta anterior vale no mesmo escopo e no mesmo dia', () => {
    expect(keptWindow([run()], 'notebook:nb1', TODAY)).toEqual({
      since: '2026-10-21',
      note: 'first check of this scope: last 30 days',
    })
  })

  it('não vale em outro escopo, em outro dia, sem janela (Papers) ou sem consulta', () => {
    expect(keptWindow([run()], 'tag:rust', TODAY)).toBeNull()
    expect(keptWindow([run({}, '2026-11-19')], 'notebook:nb1', TODAY)).toBeNull()
    expect(keptWindow([run({}, null)], 'notebook:nb1', TODAY)).toBeNull()
    expect(keptWindow([run({ since: null, windowNote: null })], 'notebook:nb1', TODAY)).toBeNull()
    expect(keptWindow([], 'notebook:nb1', TODAY)).toBeNull()
    expect(keptWindow(null, 'notebook:nb1', TODAY)).toBeNull()
    expect(keptWindow(undefined, 'notebook:nb1', TODAY)).toBeNull()
  })

  it('voltar a um escopo já consultado na conversa acha a consulta dele, não só a última', () => {
    // "ML" (1ª consulta), depois "#rust", depois "What's new?" no "ML" de novo, no mesmo dia.
    const rust = run({ scopeKey: 'tag:rust', since: TODAY, windowNote: 'last check: 20/11/2026' })
    const ml = run()
    const runs = [rust, ml] // da mais recente à mais antiga
    expect(keptWindow(runs, 'notebook:nb1', TODAY)).toEqual({
      since: '2026-10-21',
      note: 'first check of this scope: last 30 days',
    })
    expect(keptWindow(runs, 'tag:rust', TODAY)?.since).toBe(TODAY)
    expect(keptWindow(runs, 'all', TODAY)).toBeNull()
  })

  it('com várias consultas do mesmo escopo e do mesmo dia, vale a mais recente; consulta de outro dia não conta', () => {
    const older = run({ since: '2026-10-21' })
    const newer = run({ since: '2026-11-01', windowNote: 'asked in your message' })
    expect(keptWindow([newer, older], 'notebook:nb1', TODAY)?.since).toBe('2026-11-01')
    const yesterday = run({ since: '2026-11-10', windowNote: 'last check: 10/11/2026' }, '2026-11-19')
    expect(keptWindow([yesterday, older], 'notebook:nb1', TODAY)?.since).toBe('2026-10-21')
  })

  it('a janela não encolhe: depois da 1ª consulta a data do escopo é hoje, e a conversa segue com a 1ª janela', () => {
    const kept = keptWindow([run()], 'notebook:nb1', TODAY)
    const win = chooseRadarWindow({ lastRun: TODAY, todayKey: TODAY, request: null, kept })
    expect(win).toEqual({ since: '2026-10-21', note: 'first check of this scope: last 30 days', kept: true })
    // Sem a janela da conversa, a data avançada encolheria a janela para hoje.
    expect(chooseRadarWindow({ lastRun: TODAY, todayKey: TODAY, request: null, kept: null }).since).toBe(TODAY)
  })

  it('a janela pedida na mensagem vale sobre a da conversa e sobre a data do escopo', () => {
    const request = requestedWindow('since 01/11', TODAY)
    const kept = keptWindow([run()], 'notebook:nb1', TODAY)
    expect(chooseRadarWindow({ lastRun: '2026-11-10', todayKey: TODAY, request, kept })).toEqual({
      since: '2026-11-01',
      note: 'asked in your message',
      kept: false,
    })
  })

  it('a janela mantida que o usuário pediu antes não diz que foi pedida nesta mensagem', () => {
    const asked = run({ since: '2026-11-01', windowNote: 'asked in your message' })
    const kept = keptWindow([asked], 'notebook:nb1', TODAY)
    const win = chooseRadarWindow({ lastRun: TODAY, todayKey: TODAY, request: null, kept })
    expect(win).toEqual({ since: '2026-11-01', note: 'asked in an earlier message', kept: true })
    // A 3ª consulta herda a nota já reescrita, sem voltar ao rótulo antigo.
    const third = run({ since: win.since, windowNote: win.note })
    expect(chooseRadarWindow({ lastRun: TODAY, todayKey: TODAY, request: null, kept: keptWindow([third], 'notebook:nb1', TODAY) }).note).toBe(
      'asked in an earlier message'
    )
    const days = run({ since: '2026-11-13', windowNote: 'asked in your message: last 7 days' })
    expect(chooseRadarWindow({ lastRun: TODAY, todayKey: TODAY, request: null, kept: keptWindow([days], 'notebook:nb1', TODAY) }).note).toBe(
      'asked in an earlier message: last 7 days'
    )
    // Janela pedida de novo na mensagem: o rótulo é o de agora.
    expect(chooseRadarWindow({ lastRun: TODAY, todayKey: TODAY, request: requestedWindow('last 7 days', TODAY), kept }).note).toBe(
      'asked in your message: last 7 days'
    )
  })

  it('sem pedido nem janela da conversa, é desde a última consulta (radarWindow)', () => {
    expect(chooseRadarWindow({ lastRun: '2026-11-10', todayKey: TODAY, request: null, kept: null })).toEqual({
      since: '2026-11-10',
      note: 'last check: 10/11/2026',
      kept: false,
    })
  })

  it('a janela da conversa também respeita o teto de 90 dias', () => {
    const kept = { since: '2026-05-01', note: 'last check: 01/05/2026' }
    expect(chooseRadarWindow({ lastRun: TODAY, todayKey: TODAY, request: null, kept })).toEqual({
      since: '2026-08-22',
      note: 'last check: 01/05/2026; capped at 90 days',
      kept: true,
    })
  })
})

describe('recordedDate', () => {
  it('grava hoje e nunca uma data anterior à já registrada', () => {
    expect(recordedDate(null, TODAY)).toBe(TODAY)
    expect(recordedDate('2026-11-01', TODAY)).toBe(TODAY)
    expect(recordedDate(TODAY, TODAY)).toBe(TODAY)
    expect(recordedDate('2026-12-31', TODAY)).toBe('2026-12-31')
  })
})

describe('isFollowUp', () => {
  const base = {
    message: 'thanks',
    gate: 'skip' as const,
    explicitScope: false,
    previous: run(),
    todayKey: TODAY,
    defaultMessage: RADAR_DEFAULT_MESSAGE,
  }

  it('agradecimento ou "continue" numa conversa com consulta anterior é seguimento', () => {
    expect(isFollowUp(base)).toBe(true)
    expect(isFollowUp({ ...base, message: 'continue', gate: 'reuse' })).toBe(true)
    expect(isFollowUp({ ...base, message: 'mais', gate: 'reuse' })).toBe(true)
  })

  it('pedido de refazer a consulta nunca é seguimento, mesmo com o gate lendo como "continue"', () => {
    const redo = [
      'again',
      'try again',
      'check again',
      'refresh',
      'de novo',
      'tenta de novo',
      'Tente de novo!',
      'novamente',
      'atualiza',
      'Atualiza, por favor',
    ]
    for (const message of redo) {
      expect(isFollowUp({ ...base, message, gate: 'reuse' }), message).toBe(false)
      expect(isFollowUp({ ...base, message, gate: 'skip' }), message).toBe(false)
    }
  })

  it('a mensagem padrão do agente nunca é seguimento (a do Radar e a do Papers)', () => {
    expect(isFollowUp({ ...base, message: RADAR_DEFAULT_MESSAGE, gate: 'reuse' })).toBe(false)
    expect(isFollowUp({ ...base, message: "what's new", gate: 'skip' })).toBe(false)
    const papers = { ...base, defaultMessage: PAPERS_DEFAULT_MESSAGE }
    expect(isFollowUp({ ...papers, message: PAPERS_DEFAULT_MESSAGE, gate: 'reuse' })).toBe(false)
    expect(isFollowUp({ ...papers, message: 'find essential papers', gate: 'skip' })).toBe(false)
  })

  it('as mensagens padrão não são lidas pelo ragGate como agradecimento nem "continue"', () => {
    expect(ragGate(RADAR_DEFAULT_MESSAGE)).toBe('search')
    expect(ragGate(PAPERS_DEFAULT_MESSAGE)).toBe('search')
  })

  // O gate real do app: a maioria destas frases o `ragGate` lê como "search".
  const follow = (message: string, over: Partial<Parameters<typeof isFollowUp>[0]> = {}) =>
    isFollowUp({ ...base, ...over, message, gate: ragGate(message) })

  it('pergunta sobre um item já mostrado é seguimento, em inglês e em português', () => {
    const refs = [
      'tell me about the second one',
      'the second one',
      'the last one',
      'what is the 2nd item about?',
      'is the third one open access?',
      'tell me about the last',
      'what does the 3rd paper say',
      'is the second paper open access?',
      'item 2',
      'number 2',
      'how does #3 work?',
      'that paper',
      'what does this article say about scaling laws?',
      'open that link',
      'o segundo',
      'o 2º',
      'o último',
      'o que diz o segundo artigo?',
      'o segundo artigo fala de quê?',
      'esse artigo é aberto?',
      'aquela notícia é confiável?',
      'o que diz este link?',
    ]
    for (const message of refs) expect(follow(message), message).toBe(true)
  })

  it('mensagem que começa pedindo para trabalhar a resposta anterior é seguimento', () => {
    const starts = [
      'tell me more',
      'more about it',
      'Summarize it in two lines',
      'explain why it matters',
      'translate to Portuguese',
      'compare them',
      'why?',
      'why is that relevant to my notes?',
      'please explain',
      'can you summarize this?',
      'fale mais',
      'mais sobre isso',
      'resuma',
      'resume em duas linhas',
      'explique melhor',
      'traduza para o inglês',
      'compare os dois',
      'por que isso importa?',
      'por quê?',
    ]
    for (const message of starts) expect(follow(message), message).toBe(true)
  })

  it('pergunta nova com assunto próprio roda o pipeline, mesmo parecida com uma referência', () => {
    const searches = [
      "what's new about transformers?",
      'any news on rust async?',
      'what happened with the first paper on transformers',
      'the first paper that introduced attention',
      'when was the last release',
      'show me the last article',
      'o primeiro artigo sobre llm',
      'the last week of news about rust',
      'what is new in the 2nd half of 2025?',
      'what happened to item pricing at the store?',
      'rust 2024 edition news',
      'find papers on graph neural networks',
      'o que há de novo no último trimestre?',
      'novidades sobre redes neurais',
      'quais artigos novos sobre llm?',
    ]
    for (const message of searches) expect(follow(message), message).toBe(false)
  })

  it('a referência a um item não vale com escopo explícito, data/janela, mensagem padrão ou pedido de refazer', () => {
    expect(follow('the second one in notebook "Physics"', { explicitScope: true })).toBe(false)
    expect(follow('the second one since 01/11')).toBe(false)
    expect(follow('tell me more about the last 7 days')).toBe(false)
    expect(follow('tell me more again')).toBe(false)
    expect(follow('summarize, de novo')).toBe(false)
    expect(follow("What's new?")).toBe(false)
    expect(follow('item 2', { previous: null })).toBe(false)
    expect(follow('explain', { previous: undefined })).toBe(false)
  })

  it('sem consulta anterior, com escopo explícito ou com data/janela, não é seguimento', () => {
    expect(isFollowUp({ ...base, previous: null })).toBe(false)
    expect(isFollowUp({ ...base, previous: undefined })).toBe(false)
    expect(isFollowUp({ ...base, explicitScope: true })).toBe(false)
    expect(isFollowUp({ ...base, message: 'continue since 01/11' })).toBe(false)
    expect(isFollowUp({ ...base, message: 'ok last 7 days' })).toBe(false)
  })
})

describe('messageSubject', () => {
  it('o pedido padrão e as perguntas sem assunto não trazem assunto', () => {
    const none = ["What's new?", 'Find essential papers', 'novidades', 'o que há de novo?', 'papers on the notebook', '', "what's up", 'since 01/11 last 7 days']
    for (const m of none) expect(messageSubject(m)).toBeNull()
  })

  it('tira o pedido, a janela e os números e fica com o assunto', () => {
    expect(messageSubject("What's new in graph neural networks?")).toBe('graph neural networks')
    expect(messageSubject('transformers attention')).toBe('transformers attention')
    expect(messageSubject('novidades sobre redes neurais desde 01/11')).toBe('redes neurais')
    expect(messageSubject('Find essential papers on C# generics')).toBe('C# generics')
  })

  it('pedir de novo não é assunto ("again", "try again", "de novo", "novamente", "atualiza")', () => {
    const redo = ['again', 'try again', 'check again', 'refresh', 'de novo', 'tenta de novo', 'novamente', 'atualiza', 'since 01/11 again']
    for (const m of redo) expect(messageSubject(m), m).toBeNull()
    expect(messageSubject('rust async again')).toBe('rust async')
  })

  it('o assunto passa pelo cleanQueries como qualquer consulta', () => {
    const long = messageSubject(
      'what is new about tokio runtime scheduler internals benchmarks results comparisons latency throughput fairness preemption cooperative budgeting'
    )
    expect(long).not.toBeNull()
    expect(cleanQueries([long!], { max: 3 })).toEqual([])
    expect(cleanQueries([messageSubject('news on "Rust async"')!], { max: 3 })).toEqual(['Rust async'])
  })
})

describe('busca repetida na conversa', () => {
  it('hasEarlierSearch: a última consulta ou alguma anterior do agente', () => {
    expect(hasEarlierSearch({})).toBe(false)
    expect(hasEarlierSearch({ previousRun: null, previousRuns: [] })).toBe(false)
    expect(hasEarlierSearch({ previousRun: run() })).toBe(true)
    // Radar, depois Papers, depois Radar: a última consulta registrada é a do Papers (null), mas há uma do Radar.
    expect(hasEarlierSearch({ previousRun: null, previousRuns: [run()] })).toBe(true)
  })

  it('asksOnlyRepeatOrWindow: só pede de novo ou só muda a janela', () => {
    const only = ['again', 'try again', 'de novo', 'since 01/11', 'last 30 days', 'since 01/11 again', 'últimos 7 dias', RADAR_DEFAULT_MESSAGE, PAPERS_DEFAULT_MESSAGE]
    for (const m of only) expect(asksOnlyRepeatOrWindow(m), m).toBe(true)
  })

  it('asksOnlyRepeatOrWindow: com assunto próprio não vale para o escopo inteiro', () => {
    const own = ["what's new about reranking models?", 'rust async since 01/11', 'again about tokio', 'novidades sobre redes neurais']
    for (const m of own) expect(asksOnlyRepeatOrWindow(m), m).toBe(false)
  })

  it('sem consulta anterior, o contexto não ganha linha', () => {
    expect(repeatSearchNotes({ message: 'again' })).toEqual([])
    expect(repeatSearchNotes({ previousRun: null, previousRuns: [], message: 'since 01/11' })).toEqual([])
  })

  it('com consulta anterior, diz que as respostas anteriores continuam válidas e que a lista é nova', () => {
    const [note] = repeatSearchNotes({ previousRun: run(), previousRuns: [run()], message: "what's new about reranking models?" })
    expect(note).toBe(REPEAT_SEARCH_NOTE)
    expect(REPEAT_SEARCH_NOTE).toBe(
      'This is a new search. The earlier answers in this conversation came from earlier searches the app made, and they are still valid. Answer with a new list built from the candidates below.'
    )
    expect(repeatSearchNotes({ previousRuns: [run()], message: 'what about rust async?' })).toEqual([REPEAT_SEARCH_NOTE])
  })

  it('só pedir de novo ou mudar a janela ganha a linha do escopo inteiro', () => {
    for (const message of ['again', 'since 01/11', 'last 30 days']) {
      expect(repeatSearchNotes({ previousRun: run(), message }), message).toEqual([REPEAT_SEARCH_NOTE, WHOLE_SCOPE_NOTE])
    }
    expect(WHOLE_SCOPE_NOTE).toBe(
      "The user's message only asks to search again or sets the window, so this search covers the whole scope in the Scope line, not the subject of an earlier question."
    )
  })
})

describe('uniqueQueries e searchedQueries', () => {
  it('sem repetidas (sem caixa), na ordem de chegada', () => {
    expect(uniqueQueries(['Rust async', 'go', 'rust ASYNC', 'go'])).toEqual(['Rust async', 'go'])
  })

  it('só as consultas com alguma busca bem-sucedida, em uma ou mais passadas', () => {
    const ok = { status: 'fulfilled', value: [] } as PromiseSettledResult<unknown>
    const bad = { status: 'rejected', reason: new Error('x') } as PromiseSettledResult<unknown>
    expect(searchedQueries(['a', 'b', 'c'], [ok, bad, bad])).toEqual(['a'])
    expect(searchedQueries(['a', 'b', 'c'], [ok, bad, bad], [bad, ok, bad])).toEqual(['a', 'b'])
    expect(searchedQueries(['a'], [bad])).toEqual([])
    expect(searchedQueries([], [])).toEqual([])
  })
})
