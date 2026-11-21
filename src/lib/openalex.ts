import { invoke } from '@tauri-apps/api/core'
import type { PaperItem } from './agentItems'

// Cliente do OpenAlex (fonte dos artigos do Radar e do Papers). Só GET simples
// no `fetch` do frontend: o CORS da API é aberto e, sem header customizado, não
// há preflight. A chave é opcional (query `api_key`; sem ela a chamada sai sem
// o parâmetro) e nenhuma requisição leva e-mail (sem `mailto`). A busca é por
// relevância (`search.title_and_abstract`); NUNCA junto de `sort=cited_by_count`,
// que perde a relevância: a reordenação por citações é feita no app
// (`rankFoundational`). As funções puras ficam no topo; as que chamam rede ou
// `invoke` ficam no fim.

type PaperFields = Omit<PaperItem, 'key'>

export const OPENALEX_WORK_TYPES = ['article', 'review', 'conference-paper', 'preprint', 'book-chapter', 'book']
export const OPENALEX_SELECT =
  'id,doi,title,type,publication_year,publication_date,cited_by_count,authorships,open_access,best_oa_location,abstract_inverted_index,relevance_score'

const WORKS_URL = 'https://api.openalex.org/works'
const AUTHORS_KEPT = 3
const ABSTRACT_MAX = 1200
const ABSTRACT_WORDS_MAX = 10000 // posições além disso são lixo; evita um array gigante

// A consulta vai em minúsculas e sem aspas nem parênteses: um "AND/OR/NOT" que
// o modelo escreva não vira operador do OpenAlex (os operadores são em
// maiúsculas).
export function toOpenAlexQuery(q: string): string {
  return q.replace(/["()]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Monta à mão, nesta ordem: a busca, o filtro de tipos (o `|` é OU dentro do
// filtro e a vírgula separa filtros), o tamanho da página, os campos e a chave.
export function buildWorksUrl(o: { query: string; fromDate?: string; perPage: number; apiKey?: string | null }): string {
  const filter = `type:${OPENALEX_WORK_TYPES.join('|')}${o.fromDate ? `,from_publication_date:${o.fromDate}` : ''}`
  const key = o.apiKey ? `&api_key=${encodeURIComponent(o.apiKey)}` : ''
  return (
    `${WORKS_URL}?search.title_and_abstract=${encodeURIComponent(toOpenAlexQuery(o.query))}` +
    `&filter=${filter}&per-page=${o.perPage}&select=${OPENALEX_SELECT}${key}`
  )
}

// '10.xxxx/...' em minúsculas; a URL do doi.org e o prefixo "doi:" saem.
// Texto que não começa com "10." não é DOI.
export function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null
  const doi = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '')
  return doi.startsWith('10.') ? doi : null
}

// O OpenAlex entrega o abstract como { palavra: [posições] }: remonta pelas
// posições. Corta em `max` com "…". Índice vazio ou ausente = null.
export function abstractFromIndex(
  index: Record<string, number[]> | null | undefined,
  max = ABSTRACT_MAX
): string | null {
  if (!index || typeof index !== 'object') return null
  const words: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue
    for (const p of positions) {
      if (Number.isInteger(p) && p >= 0 && p < ABSTRACT_WORDS_MAX) words[p] = word
    }
  }
  const text = words.filter((w) => w !== undefined).join(' ').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

// Identidade do artigo: o DOI quando há; senão o id do OpenAlex.
export function paperKey(doi: string | null, openalexId: string): string {
  return doi ? `doi:${doi}` : `openalex:${openalexId}`
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function authorName(authorship: unknown): string | null {
  const a = obj(authorship)
  return str(obj(a?.author)?.display_name) ?? str(a?.raw_author_name)
}

// A resposta de /works em itens (sem a `key`, que o app dá na ordem final). Fica
// de fora a obra sem título ou sem id e a de tipo fora de OPENALEX_WORK_TYPES
// (o filtro da URL já pede só esses tipos: barreira dupla).
export function parseWorks(json: unknown, section: PaperItem['section']): PaperFields[] {
  const results = obj(json)?.results
  if (!Array.isArray(results)) return []
  return results.flatMap((raw): PaperFields[] => {
    const work = obj(raw)
    if (!work) return []
    const id = str(work.id)
    const title = str(work.title)
    const type = str(work.type)
    if (!id || !title || !type || !OPENALEX_WORK_TYPES.includes(type)) return []
    const openalexId = id.split('/').pop() ?? ''
    if (!openalexId) return []

    const authorships = Array.isArray(work.authorships) ? work.authorships : []
    const doi = normalizeDoi(str(work.doi))
    const best = obj(work.best_oa_location)
    const access = obj(work.open_access)
    return [
      {
        kind: 'paper',
        section,
        id: paperKey(doi, openalexId),
        openalexId,
        title: title.replace(/\s+/g, ' '),
        authors: authorships.map(authorName).filter((n): n is string => n !== null).slice(0, AUTHORS_KEPT),
        authorCount: authorships.length,
        year: typeof work.publication_year === 'number' ? work.publication_year : null,
        date: str(work.publication_date),
        doi,
        url: doi ? `https://doi.org/${doi}` : (str(best?.landing_page_url) ?? id),
        citations: typeof work.cited_by_count === 'number' ? work.cited_by_count : 0,
        type,
        isOa: access?.is_oa === true,
        pdfUrl: str(best?.pdf_url),
        oaUrl: str(access?.oa_url),
        abstract: abstractFromIndex(obj(work.abstract_inverted_index) as Record<string, number[]> | null),
      },
    ]
  })
}

export type OpenAlexErrorReason = 'budget' | 'rate' | 'network' | 'http'

export class OpenAlexError extends Error {
  reason: OpenAlexErrorReason
  status?: number

  constructor(reason: OpenAlexErrorReason, status?: number) {
    super(`OpenAlex ${reason}${status ? ` (HTTP ${status})` : ''}`)
    this.name = 'OpenAlexError'
    this.reason = reason
    this.status = status
  }
}

// A hora, no relógio de quem usa, em que o orçamento gratuito renova (meia-noite
// UTC): 'HH:MM' a partir do deslocamento do fuso em minutos a leste de UTC (-180
// em São Paulo → '21:00'; 330 na Índia → '05:30').
export function budgetResetTime(utcOffsetMinutes: number): string {
  const minutes = (((utcOffsetMinutes % 1440) + 1440) % 1440)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function openAlexErrorText(e: unknown): string {
  if (!(e instanceof OpenAlexError)) return 'OpenAlex search failed.'
  switch (e.reason) {
    case 'budget':
      return `OpenAlex daily free budget is used up (it resets at ${budgetResetTime(-new Date().getTimezoneOffset())} your time). Add a free OpenAlex key in Settings > Web Search to raise it.`
    case 'rate':
      return 'OpenAlex is limiting requests right now. Try again in a minute.'
    case 'network':
      return 'Could not reach OpenAlex (offline?).'
    default:
      return `OpenAlex returned an error${e.status ? ` (HTTP ${e.status})` : ''}.`
  }
}

// Os `keep` mais citados; no empate, fica a ordem original (a da relevância).
export function rankFoundational<T extends { citations: number }>(items: T[], keep: number): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => b.item.citations - a.item.citations || a.i - b.i)
    .slice(0, keep)
    .map(({ item }) => item)
}

// Junta os grupos na ordem dada, sem repetir por `id` (a primeira ganha) e sem
// os `exclude` (ids já conhecidos), até `max`.
export function mergePapers(groups: PaperFields[][], exclude: Set<string>, max: number): PaperFields[] {
  const seen = new Set(exclude)
  const out: PaperFields[] = []
  for (const item of groups.flat()) {
    if (out.length >= max) break
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

// '2026-11-20', 3 → '2023-11-20' (29/02 vira 28/02 em ano não bissexto).
export function yearsAgoKey(todayKey: string, years: number): string {
  const [y, m, d] = todayKey.split('-').map(Number)
  const year = y - years
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const day = m === 2 && d === 29 && !leap ? 28 : d
  return `${String(year).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ─── Rede e chave (não usadas nos testes de funções puras) ──────────────────

export async function getOpenAlexKey(): Promise<string | null> {
  try {
    const k = await invoke<string | null>('get_openalex_key')
    return k && k.length > 0 ? k : null
  } catch {
    return null
  }
}

export async function saveOpenAlexKey(key: string): Promise<void> {
  await invoke('save_openalex_key', { key })
}

export async function clearOpenAlexKey(): Promise<void> {
  await invoke('clear_openalex_key')
}

export async function hasOpenAlexKey(): Promise<boolean> {
  try {
    return await invoke<boolean>('has_openalex_key')
  } catch {
    return false
  }
}

// Uma busca por relevância. Erros viram OpenAlexError (rede, limite, orçamento
// diário, HTTP); o cancelamento (AbortError) é repassado como veio.
export async function searchWorks(
  o: { query: string; fromDate?: string; perPage: number; section: PaperItem['section'] },
  signal: AbortSignal
): Promise<PaperFields[]> {
  const apiKey = await getOpenAlexKey()
  signal.throwIfAborted()
  let res: Response
  try {
    res = await fetch(buildWorksUrl({ query: o.query, fromDate: o.fromDate, perPage: o.perPage, apiKey }), { signal })
  } catch (err) {
    if (signal.aborted || (err as { name?: string } | null)?.name === 'AbortError') throw err
    if (err instanceof TypeError) throw new OpenAlexError('network')
    throw err
  }
  if (res.status === 429) {
    const body = await res.text().catch(() => '')
    throw new OpenAlexError(body.includes('budget') ? 'budget' : 'rate', 429)
  }
  if (!res.ok) throw new OpenAlexError('http', res.status)
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new OpenAlexError('http', res.status)
  }
  return parseWorks(json, o.section)
}
