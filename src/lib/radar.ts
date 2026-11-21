import { citationsText, dmy, paperAuthors, type AgentRun, type PaperItem, type WebItem } from './agentItems'
import { dateKeyFromMs } from './calendar'
import { bookKey } from './planNotes'
import type { SearchResult } from './search'
import { addDaysKey, normalizeName } from './tasks'

// Lógica pura do Radar e do /since: a janela de datas, o plano de consultas
// (leitura e limpeza), os candidatos web (filtro por data, repetidos e KB) e os
// blocos de candidatos que o modelo lê, mais o corte de data do /since. Sem
// `storage`, sem `@tauri-apps` e sem `fetch`: quem chama faz as buscas.

const FIRST_RUN_DAYS = 30
const MAX_WINDOW_DAYS = 90
const QUERY_MAX_CHARS = 120
const QUERY_MAX_WORDS = 12
const COPY_MIN_WORDS = 6 // consulta com tantas palavras (ou mais) dentro do texto da nota é cópia
const BUCKET_MAX = 3 // por tipo; news + release ≤ 6 (Tavily) e paper ≤ 3 (OpenAlex)
const PAPERS_QUERIES_MAX = 2
const SNIPPET_MAX = 300
const PAPER_ABSTRACT_MAX = 500

function clip(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one
}

// ─── Janela de datas ────────────────────────────────────────────────────────

// Desde quando buscar: sem consulta anterior, os últimos 30 dias; com ela, a
// data da última consulta (no máximo 90 dias atrás; no futuro vale como hoje).
export function radarWindow(lastRun: string | null, todayKey: string): { since: string; note: string } {
  if (!lastRun) {
    return { since: addDaysKey(todayKey, -FIRST_RUN_DAYS), note: `first check of this scope: last ${FIRST_RUN_DAYS} days` }
  }
  const last = lastRun > todayKey ? todayKey : lastRun
  const floor = addDaysKey(todayKey, -MAX_WINDOW_DAYS)
  const capped = last < floor
  return {
    since: capped ? floor : last,
    note: `last check: ${dmy(last)}${capped ? `; capped at ${MAX_WINDOW_DAYS} days` : ''}`,
  }
}

// Início da janela dentro do limite: no máximo 90 dias atrás e não depois de hoje.
function clampSince(since: string, todayKey: string): { since: string; capped: boolean } {
  const floor = addDaysKey(todayKey, -MAX_WINDOW_DAYS)
  if (since < floor) return { since: floor, capped: true }
  return { since: since > todayKey ? todayKey : since, capped: false }
}

const CAPPED_NOTE = `capped at ${MAX_WINDOW_DAYS} days`
const ASKED_NOTE = 'asked in your message'
const ASKED_EARLIER_NOTE = 'asked in an earlier message'
const DAYS_RE = /(?:^|[^\p{L}\p{N}])(?:last|past|últimos?|ultimos?)\s+(\d{1,4})\s+(?:days?|dias?)(?![\p{L}\p{N}])/iu
// "since 01/11" (sem o ano): o ano só se infere depois de "since", "from" ou "desde".
const DAY_MONTH_RE = /(?:^|[^\p{L}\p{N}])(?:since|from|desde|a partir de)\s+(\d{1,2})\/(\d{1,2})(?![\d/])/iu

// "dd/mm" sem ano: a data mais recente que não passa de hoje (neste ano, ou no
// ano anterior quando ainda não chegou).
function dayMonthDate(text: string, todayKey: string): string | null {
  const m = text.match(DAY_MONTH_RE)
  if (!m) return null
  const year = Number(todayKey.slice(0, 4))
  const thisYear = validIsoKey(year, Number(m[2]), Number(m[1]))
  if (!thisYear) return null
  return thisYear > todayKey ? validIsoKey(year - 1, Number(m[2]), Number(m[1])) : thisYear
}

// A janela que a mensagem pede: uma data ("since 01/11/2026", "since 01/11",
// "2026-11-01") ou "last N days" (também "últimos N dias"). Vale no lugar da
// janela do escopo, com o teto de 90 dias; data de hoje em diante vira hoje.
// null = a mensagem não pede janela.
export function requestedWindow(text: string, todayKey: string): { since: string; note: string } | null {
  const daysMatch = text.match(DAYS_RE)
  const days = daysMatch ? Number(daysMatch[1]) : 0
  const label = days > 0 ? `${ASKED_NOTE}: last ${days} days` : ASKED_NOTE
  const requested = days > 0 ? addDaysKey(todayKey, -days) : (parseDateInText(text) ?? dayMonthDate(text, todayKey))
  if (!requested) return null
  const { since, capped } = clampSince(requested, todayKey)
  return { since, note: capped ? `${label}; ${CAPPED_NOTE}` : label }
}

// A janela de uma consulta anterior desta conversa, quando ela vale de novo: a
// mais recente do mesmo escopo e do mesmo dia (a data do escopo já avançou para
// hoje no fim daquela consulta, e a janela não encolhe dentro da conversa; no dia
// seguinte a janela volta a ser "desde a última consulta"). `runs` vêm da mais
// recente à mais antiga e podem ser de outros escopos: voltar a um escopo já
// consultado ("ML", depois "#rust", depois "ML" de novo) acha a consulta dele.
// Sem janela ou sem a consulta, null.
export function keptWindow(
  runs: AgentRun[] | null | undefined,
  scopeKey: string,
  todayKey: string
): { since: string; note: string } | null {
  for (const run of runs ?? []) {
    const s = run.search
    if (s.scopeKey === scopeKey && s.since && s.windowNote && run.ranOn === todayKey) {
      return { since: s.since, note: s.windowNote }
    }
  }
  return null
}

// A janela desta consulta: a que a mensagem pede; senão a da consulta anterior
// da conversa (`kept`); senão desde a última consulta do escopo (`radarWindow`).
// A janela mantida que o usuário pediu antes não diz que foi pedida nesta mensagem.
export function chooseRadarWindow(o: {
  lastRun: string | null
  todayKey: string
  request: { since: string; note: string } | null
  kept: { since: string; note: string } | null
}): { since: string; note: string; kept: boolean } {
  if (o.request) return { ...o.request, kept: false }
  if (o.kept) {
    const { since, capped } = clampSince(o.kept.since, o.todayKey)
    const keptNote = o.kept.note.startsWith(ASKED_NOTE) ? o.kept.note.replace(ASKED_NOTE, ASKED_EARLIER_NOTE) : o.kept.note
    const note = capped && !keptNote.includes(CAPPED_NOTE) ? `${keptNote}; ${CAPPED_NOTE}` : keptNote
    return { since, note, kept: true }
  }
  return { ...radarWindow(o.lastRun, o.todayKey), kept: false }
}

// A data que a consulta grava ao terminar: hoje, sem nunca ficar antes da já
// registrada (uma janela pedida para trás não recua a data do escopo).
export function recordedDate(registered: string | null, todayKey: string): string {
  return registered && registered > todayKey ? registered : todayKey
}

// ─── Seguimento e assunto da mensagem ───────────────────────────────────────

// Os recados que o contexto dá ao modelo quando não há candidatos novos.
export const FOLLOW_UP_NOTE =
  'Follow-up: the app did not search again for this message, so there are no new candidates and no markers to use. Answer from this conversation: the items already shown above are the only ones. Do not list or invent items. If the user seems to want new results, say in one line that they can ask "again" (or name a notebook, a tag or a date).'
export const SEARCH_NOT_DONE_NOTE = 'Search not done: could not plan the searches. Try again.'

// A mensagem padrão do Radar e a do Papers: o que o Enter com o rascunho vazio envia.
export const RADAR_DEFAULT_MESSAGE = "What's new?"
export const PAPERS_DEFAULT_MESSAGE = 'Find essential papers'

// Pedido de refazer a consulta ("again", "try again", "check again", "refresh",
// "de novo", "novamente", "atualiza"), com a mensagem já normalizada (`bookKey`).
const REDO_RE = /(?:^| )(?:again|refresh|de novo|novamente|atualiza|atualize|atualizar)(?: |$)/

// Referência a um item já mostrado, com a mensagem normalizada (`normalizeName`:
// minúsculas, sem acento), em inglês e português:
// - ordinal com "one" ou "item" ("the second one", "the last one", "the 2nd item",
//   "o segundo item");
// - ordinal depois do artigo, sozinho no fim da mensagem ("tell me about the last",
//   "o último");
// - ordinal (menos "last") com o tipo do item, desde que não venha um assunto depois
//   ("the second paper", "what does the 3rd article say", "o segundo artigo"); "the
//   first paper on transformers" e "the last release" são buscas;
// - número do item ("item 2", "number 2", "#3", "o 2º");
// - demonstrativo com o tipo do item ("that paper", "this article", "esse artigo",
//   "aquela notícia", "este link").
const ORDINAL_NUMBERED =
  '(?:first|second|third|fourth|fifth|sixth|seventh|eighth|\\d{1,2}(?:st|nd|rd|th)|primeir[oa]s?|segund[oa]s?|terceir[oa]s?|quart[oa]s?|quint[oa]s?|sext[oa]s?|setim[oa]s?|oitav[oa]s?)'
const ORDINAL = `(?:${ORDINAL_NUMBERED}|last|ultim[oa]s?)`
const ITEM_NOUN =
  '(?:items?|itens|papers?|articles?|links?|results?|stor(?:y|ies)|posts?|releases?|artigos?|noticias?|resultados?|lancamentos?|materias?)'
const ARTICLE = '(?:the|o|a|os|as)'
const DEMONSTRATIVE =
  '(?:this|that|these|those|esse|essa|esses|essas|este|esta|estes|estas|aquele|aquela|aqueles|aquelas|desse|dessa|deste|desta|nesse|nessa|neste|nesta|daquele|daquela|naquele|naquela)'
const WORD_END = '(?![\\p{L}\\p{N}])'
// Depois do tipo do item, estas palavras abrem o assunto de uma busca nova ("the first paper on …").
const TOPIC_WORD =
  '(?:on|about|of|in|for|from|regarding|to|that|which|who|where|when|with|sobre|de|do|da|dos|das|em|no|na|nos|nas|para|por|com|que|quando|onde)'
const ITEM_REFERENCE_RES = [
  new RegExp(`(?:^|\\s)(?:${ARTICLE}\\s+)?${ORDINAL}\\s+(?:ones?|items?|itens)${WORD_END}`, 'u'),
  new RegExp(`(?:^|\\s)${ARTICLE}\\s+${ORDINAL}\\s*[?.!]*\\s*$`, 'u'),
  new RegExp(`(?:^|\\s)${ARTICLE}\\s+${ORDINAL_NUMBERED}\\s+${ITEM_NOUN}${WORD_END}(?!\\s+${TOPIC_WORD}${WORD_END})`, 'u'),
  new RegExp(`(?:^|\\s)(?:items?|itens|number|numero|n[º°])\\s*#?\\s*\\d{1,2}${WORD_END}`, 'u'),
  new RegExp(`(?:^|\\s)#\\d{1,2}${WORD_END}`, 'u'),
  new RegExp(`(?:^|\\s)(?:o|a|os|as)\\s+\\d{1,2}\\s*[ºª°]`, 'u'),
  new RegExp(`(?:^|\\s)${DEMONSTRATIVE}\\s+${ITEM_NOUN}${WORD_END}`, 'u'),
]

// A mensagem começa pedindo para trabalhar a resposta anterior ("tell me more",
// "summarize", "explain", "translate", "compare", "why", "fale mais", "mais sobre",
// "resuma", "explique", "traduza", "por que"), com a mensagem normalizada.
const WORK_ON_ANSWER_RE = new RegExp(
  `^(?:(?:please|can you|could you|por favor|pode|poderia)\\s+)*(?:me\\s+)?(?:tell me more|more about|summari[sz]e|explain|translate|compare|why|fale mais|mais sobre|resuma|resume|explique|traduza|por que|porque)${WORD_END}`,
  'u'
)

function refersToShownItem(text: string): boolean {
  return ITEM_REFERENCE_RES.some((re) => re.test(text))
}

// Seguimento: a mensagem, numa conversa que já tem uma consulta deste agente, que
// não pede busca nova. Não roda o pipeline: o modelo responde pela conversa.
// Sem escopo explícito nem data ou janela, e sem ser a mensagem padrão do agente
// nem pedido de refazer a consulta ("try again", "de novo": o `ragGate` as lê como
// "continue", mas rodam o pipeline), é seguimento quando:
// - o `ragGate` do app diz `skip` ou `reuse` (agradecimento, "continue"); ou
// - ela se refere a um item já mostrado ("the second one", "item 2", "#3", "that
//   paper", "o 2º", "esse artigo"); ou
// - ela começa pedindo para trabalhar a resposta anterior ("tell me more",
//   "summarize", "explain", "translate", "compare", "why", "fale mais", "resuma").
// Nos demais casos, inclusive a pergunta nova com assunto próprio ("what's new
// about transformers?"), a busca roda.
export function isFollowUp(o: {
  gate: 'skip' | 'reuse' | 'search'
  message: string
  explicitScope: boolean
  previous: AgentRun | null | undefined
  todayKey: string
  defaultMessage: string
}): boolean {
  if (!o.previous || o.explicitScope || requestedWindow(o.message, o.todayKey) !== null) return false
  const key = bookKey(o.message)
  if (key === bookKey(o.defaultMessage) || REDO_RE.test(key)) return false
  if (o.gate !== 'search') return true
  const text = normalizeName(o.message).trim()
  return refersToShownItem(text) || WORK_ON_ANSWER_RE.test(text)
}

// Palavras que não dizem o assunto (pedido, escopo, janela), em inglês e português.
const FILLER_WORDS = new Set(
  `what s new news latest recent recently anything any there is are was a an the in on of about for to me my show tell give
  find search look check please since from last past day days week weeks month months year years update updates release
  releases paper papers article articles essential foundational key main important top best reading list notebook
  notebooks tag board everything all notes radar topic subject happened happening going up with and or i should know read
  want need get o os as que ha ja de do da dos das em no na nos nas sobre para por um uma novidade novidades novo nova
  novos novas ultimo ultimos ultima ultimas dia dias semana semanas mes meses desde artigo artigos essencial essenciais
  principal principais importante importantes melhor melhores caderno cadernos tudo todos todas meu meus minha minhas
  mostre mostra procure busque acontece aconteceu tem algo alguma quais qual como devo deveria conhecer ler quero preciso
  ver again retry redo repeat refresh try novamente atualiza atualize atualizar tenta tente`.split(/\s+/)
)

// O assunto que a mensagem traz (para o escopo sem notas): as palavras que sobram
// sem o pedido, o escopo, a janela e os números. null = a mensagem só pede ("What's
// new?", "Find essential papers") ou o que sobra tem menos de 3 letras.
export function messageSubject(message: string): string | null {
  const kept = message
    .split(/\s+/)
    .filter((word) => {
      const parts = bookKey(word).split(' ').filter(Boolean)
      return parts.length > 0 && !parts.every((p) => FILLER_WORDS.has(p) || /^\d+$/.test(p))
    })
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}#+]+$/gu, ''))
    .filter(Boolean)
  const subject = kept.join(' ')
  return bookKey(subject).replace(/ /g, '').length >= 3 ? subject : null
}

// ─── Busca repetida na conversa ─────────────────────────────────────────────

// A conversa já tem uma consulta concluída do agente (a última ou alguma anterior):
// as respostas dela estão no histórico e foram montadas por uma busca do app.
export function hasEarlierSearch(o: { previousRun?: AgentRun | null; previousRuns?: AgentRun[] }): boolean {
  return !!o.previousRun || (o.previousRuns?.length ?? 0) > 0
}

// A mensagem só pede para buscar de novo ou só muda a janela ("again", "since 01/11",
// "last 30 days", a mensagem padrão): não traz assunto próprio.
export function asksOnlyRepeatOrWindow(message: string): boolean {
  return messageSubject(message) === null
}

// As linhas de contexto de uma busca que roda de novo numa conversa que já tem
// consulta do agente. Sem elas, o modelo só vê os candidatos desta consulta, conclui
// que os itens das respostas anteriores eram inventados e "corrige" o usuário.
export const REPEAT_SEARCH_NOTE =
  'This is a new search. The earlier answers in this conversation came from earlier searches the app made, and they are still valid. Answer with a new list built from the candidates below.'
export const WHOLE_SCOPE_NOTE =
  "The user's message only asks to search again or sets the window, so this search covers the whole scope in the Scope line, not the subject of an earlier question."

export function repeatSearchNotes(o: {
  previousRun?: AgentRun | null
  previousRuns?: AgentRun[]
  message: string
}): string[] {
  if (!hasEarlierSearch(o)) return []
  return asksOnlyRepeatOrWindow(o.message) ? [REPEAT_SEARCH_NOTE, WHOLE_SCOPE_NOTE] : [REPEAT_SEARCH_NOTE]
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export type QueryKind = 'news' | 'release' | 'paper' | 'web'

const PLAN_LINE_RE = /^\s*(news|release|paper|web)\s*:\s*(.*)$/i

// "news: rust async runtime" → { kind: 'news', query: 'rust async runtime' }.
// Linha sem prefixo conhecido (ou sem consulta) é descartada.
export function parseQueryPlan(lines: string[]): { kind: QueryKind; query: string }[] {
  const out: { kind: QueryKind; query: string }[] = []
  for (const line of lines) {
    const m = typeof line === 'string' ? line.match(PLAN_LINE_RE) : null
    const query = m?.[2].trim()
    if (m && query) out.push({ kind: m[1].toLowerCase() as QueryKind, query })
  }
  return out
}

// Aspas, colchetes e o "#" de hashtag saem (o "#" no meio da palavra, como em
// "C#", fica); espaços colapsam.
function stripQuery(q: string): string {
  return q
    .replace(/["“”«»[\]]/g, ' ')
    .replace(/(^|\s)['‘’]+|['‘’]+(?=\s|$)/g, ' ')
    .replace(/(^|\s)#+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// Limpa as consultas antes de qualquer busca: sem aspas, colchetes nem "#"; fora
// a vazia, a com mais de 120 caracteres ou 12 palavras, a repetida (sem caixa) e,
// com `forbidCopyFrom`, a de 6+ palavras que aparece inteira no texto dado (o
// texto de uma nota nunca vai à busca). Corta em `max`.
export function cleanQueries(qs: string[], o: { max: number; forbidCopyFrom?: string }): string[] {
  const haystack = o.forbidCopyFrom ? ` ${bookKey(o.forbidCopyFrom)} ` : ''
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of qs) {
    if (out.length >= o.max) break
    if (typeof raw !== 'string') continue
    const q = stripQuery(raw)
    if (!q || q.length > QUERY_MAX_CHARS) continue
    if (q.split(' ').length > QUERY_MAX_WORDS) continue
    const key = q.toLowerCase()
    if (seen.has(key)) continue
    if (haystack) {
      const norm = bookKey(q)
      if (norm.split(' ').length >= COPY_MIN_WORDS && haystack.includes(` ${norm} `)) continue
    }
    seen.add(key)
    out.push(q)
  }
  return out
}

function ofKind(plan: { kind: QueryKind; query: string }[], kind: QueryKind): string[] {
  return plan.filter((p) => p.kind === kind).map((p) => p.query)
}

// Consultas do Radar: até 3 de cada tipo (news e release vão ao Tavily, no
// máximo 6; paper ao OpenAlex, no máximo 3). Sem nenhuma consulta aproveitável,
// reserva: news e paper com os 3 primeiros `terms` (assuntos de reserva do mapa
// de foco), e `reserve` fica true: a consulta de reserva não avança a data do
// escopo. `forbidCopyFrom` (o mapa de foco) barra a consulta que copia um trecho
// dele.
export function radarQueryBuckets(
  plan: { kind: QueryKind; query: string }[],
  terms: string[],
  forbidCopyFrom?: string
): { news: string[]; release: string[]; paper: string[]; reserve: boolean } {
  const clean = (kind: QueryKind) => cleanQueries(ofKind(plan, kind), { max: BUCKET_MAX, forbidCopyFrom })
  const buckets = { news: clean('news'), release: clean('release'), paper: clean('paper') }
  if (buckets.news.length + buckets.release.length + buckets.paper.length > 0) return { ...buckets, reserve: false }
  const fallback = cleanQueries(terms, { max: BUCKET_MAX })
  return { news: fallback, release: [], paper: fallback, reserve: fallback.length > 0 }
}

// As consultas sem repetidas (sem caixa), na ordem de chegada.
export function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>()
  return queries.filter((q) => {
    const key = q.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// As consultas que rodaram: a que teve alguma busca bem-sucedida. `passes` tem
// uma lista de resultados por passada, na ordem das consultas (o Papers faz duas).
export function searchedQueries(queries: string[], ...passes: PromiseSettledResult<unknown>[][]): string[] {
  return queries.filter((_, i) => passes.some((pass) => pass[i]?.status === 'fulfilled'))
}

// Consultas do Papers: até 2 do tipo paper. Reserva: os 2 primeiros `terms`.
export function papersQueries(
  plan: { kind: QueryKind; query: string }[],
  terms: string[],
  forbidCopyFrom?: string
): string[] {
  const queries = cleanQueries(ofKind(plan, 'paper'), { max: PAPERS_QUERIES_MAX, forbidCopyFrom })
  return queries.length > 0 ? queries : cleanQueries(terms, { max: PAPERS_QUERIES_MAX })
}

// ─── Datas e URLs dos resultados ────────────────────────────────────────────

function validIsoKey(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// A data do `published_date` do Tavily: `YYYY-MM-DD` no início (ISO, com ou sem
// hora) ou uma data por extenso (RFC 2822 e afins) em UTC. Outro formato ou
// data inválida = null (o resultado fica sem data e sai da lista).
export function toDateKeyLoose(s: string | undefined): string | null {
  if (!s) return null
  const text = s.trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return validIsoKey(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  // Só texto com nome de mês ou de dia: "5" ou "2026" sozinhos o Date aceitaria.
  if (!/[a-z]{3}/i.test(text)) return null
  const ms = Date.parse(text)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10)
}

const TRACKING_PARAMS = ['ref', 'fbclid', 'gclid']

// Forma comparável de uma URL: host em minúsculas sem "www.", sem "#…", sem os
// parâmetros utm_*, ref, fbclid e gclid e sem a barra final.
export function normalizeUrl(url: string): string {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return url.trim()
  }
  for (const key of [...u.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.includes(key.toLowerCase())) u.searchParams.delete(key)
  }
  const host = u.host.toLowerCase().replace(/^www\./, '')
  const path = u.pathname.replace(/\/+$/, '')
  return `${u.protocol}//${host}${path}${u.search}`
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

const GOOGLE_HOST_RE = /^(?:www\.)?google\.(?:com?\.)?[a-z]{2,3}$/

function isGoogleRedirect(u: URL): boolean {
  return GOOGLE_HOST_RE.test(u.hostname.toLowerCase()) && u.pathname === '/url'
}

// A URL do resultado: o link de redirecionamento do Google (google.com/url?…) vira a
// URL de destino (parâmetro `url`, senão `q`; só http e https, e não outro redirecionamento
// do Google). Sem destino legível, null: o candidato sai. Outra URL volta aparada.
export function resolveResultUrl(raw: string): string | null {
  const url = raw.trim()
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  if (!isGoogleRedirect(u)) return url
  for (const key of ['url', 'q']) {
    const target = u.searchParams.get(key)?.trim()
    if (!target) continue
    try {
      const t = new URL(target)
      if ((t.protocol === 'http:' || t.protocol === 'https:') && !isGoogleRedirect(t)) return target
    } catch {
      // destino ilegível: tenta o próximo parâmetro
    }
  }
  return null
}

// ─── Candidatos ─────────────────────────────────────────────────────────────

// Os candidatos web do Radar: só o resultado com data entre `since` e hoje
// (inclusivos), sem URL repetida (o primeiro grupo ganha) e sem página já na KB
// (`excludeHashes` com o `hashOf` de cada URL, calculados por quem chama, sobre a
// URL de `resolveResultUrl`). Link de redirecionamento do Google vira a página de
// destino (URL e fonte); sem destino legível, o resultado sai. Cada seção por data
// (a mais nova primeiro); News e Releases intercalam, até `max`.
export function webCandidates(
  groups: { section: 'news' | 'releases'; results: SearchResult[] }[],
  o: {
    since: string
    todayKey: string
    max: number
    excludeHashes?: Set<string>
    hashOf?: (url: string) => string
  }
): WebItem[] {
  const seen = new Set<string>()
  const bySection: Record<'news' | 'releases', WebItem[]> = { news: [], releases: [] }
  for (const group of groups) {
    for (const r of group.results) {
      const date = toDateKeyLoose(r.publishedDate)
      if (!date || date < o.since || date > o.todayKey) continue
      const url = resolveResultUrl(r.url)
      if (!url) continue
      const norm = normalizeUrl(url)
      if (seen.has(norm)) continue
      if (o.excludeHashes && o.hashOf && o.excludeHashes.has(o.hashOf(url))) continue
      seen.add(norm)
      const source = hostOf(url)
      bySection[group.section].push({
        kind: 'web',
        key: '',
        section: group.section,
        title: clip(r.title, 200) || source || url,
        url,
        source,
        date,
        snippet: clip(r.content, SNIPPET_MAX),
      })
    }
  }
  for (const list of Object.values(bySection)) list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const out: WebItem[] = []
  for (let i = 0; out.length < o.max && (i < bySection.news.length || i < bySection.releases.length); i++) {
    for (const item of [bySection.news[i], bySection.releases[i]]) {
      if (item && out.length < o.max) out.push(item)
    }
  }
  return out.map((item, i) => ({ ...item, key: `W${i + 1}` }))
}

// As obras do OpenAlex com a chave P1…Pn na ordem dada.
export function keyPapers(items: Omit<PaperItem, 'key'>[]): PaperItem[] {
  return items.map((item, i) => ({ ...item, key: `P${i + 1}` }))
}

// O bloco que o modelo lê: uma entrada por candidato web.
//   [W1] News · "<título>" · <fonte> · dd/mm/yyyy
//        <trecho>
export function webCandidatesBlock(items: WebItem[]): string {
  if (items.length === 0) return '(none)'
  return items
    .map((item) => {
      const head = `[${item.key}] ${item.section === 'news' ? 'News' : 'Releases'} · "${item.title}" · ${item.source} · ${dmy(item.date)}`
      return item.snippet ? `${head}\n     ${item.snippet}` : head
    })
    .join('\n')
}

// Uma entrada por artigo candidato.
//   [P1] "<título>" · <autores> · <ano|n.d.> · <tipo> · <N> citations · open access|closed
//        Abstract: <≤ 500 caracteres, ou (none)>
export function paperCandidatesBlock(items: PaperItem[]): string {
  if (items.length === 0) return '(none)'
  return items
    .map((item) => {
      const parts = [
        `"${item.title}"`,
        paperAuthors(item),
        item.year === null ? 'n.d.' : String(item.year),
        item.type,
        citationsText(item.citations),
        item.isOa ? 'open access' : 'closed',
      ].filter(Boolean)
      return `[${item.key}] ${parts.join(' · ')}\n     Abstract: ${item.abstract ? clip(item.abstract, PAPER_ABSTRACT_MAX) : '(none)'}`
    })
    .join('\n')
}

// ─── /since ─────────────────────────────────────────────────────────────────

const DATE_IN_TEXT_RE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)|(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/g

// A primeira data válida do texto: `dd/mm/yyyy`, `d/m/yyyy` ou `yyyy-mm-dd`.
export function parseDateInText(text: string): string | null {
  for (const m of text.matchAll(DATE_IN_TEXT_RE)) {
    const key = m[1] ? validIsoKey(Number(m[1]), Number(m[2]), Number(m[3])) : validIsoKey(Number(m[6]), Number(m[5]), Number(m[4]))
    if (key) return key
  }
  return null
}

function validIsoText(s: string | null | undefined): string | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? validIsoKey(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

export type SinceSource = 'instruction' | 'note date' | 'calendar day' | 'created' | 'last /since'

// O corte do /since: uma data na instrução, senão o dia do último bloco /since da
// própria nota (`lastSince`, a data em que ele foi gerado), o `date` da nota, o
// dia da nota do Calendar e, por último, o dia da criação. Corte depois de hoje é
// erro; igual a hoje vale.
export function sinceCutoff(o: {
  instruction: string
  note: { date?: string | null; createdAt: number }
  calendarKey: string | null
  lastSince?: string | null
  todayKey: string
}): { cutoff: string; source: SinceSource } | { error: string } {
  const fromInstruction = parseDateInText(o.instruction)
  const fromLastSince = validIsoText(o.lastSince)
  const fromNote = validIsoText(o.note.date)
  const fromCalendar = validIsoText(o.calendarKey)
  const picked: { cutoff: string; source: SinceSource } = fromInstruction
    ? { cutoff: fromInstruction, source: 'instruction' }
    : fromLastSince
      ? { cutoff: fromLastSince, source: 'last /since' }
      : fromNote
        ? { cutoff: fromNote, source: 'note date' }
        : fromCalendar
          ? { cutoff: fromCalendar, source: 'calendar day' }
          : { cutoff: dateKeyFromMs(o.note.createdAt), source: 'created' }
  return picked.cutoff > o.todayKey ? { error: 'The cutoff date is in the future.' } : picked
}

// O dia do último bloco /since concluído da nota (YYYY-MM-DD, local), entre as
// respostas dadas; null = a nota ainda não tem um. Só conta a resposta da própria
// nota, concluída e com texto (um bloco que falhou ou parou não é uma consulta).
export function lastSinceDay(
  noteId: string,
  responses: { noteId: string | null; command: string; status: string; response: string; createdAt: number }[]
): string | null {
  const times = responses
    .filter((r) => r.noteId === noteId && r.command === '/since' && r.status === 'completed' && r.response.trim() !== '')
    .map((r) => r.createdAt)
  return times.length > 0 ? dateKeyFromMs(Math.max(...times)) : null
}

// O que o título do bloco /since mostra depois de "Since ·": a data de corte e de
// onde ela veio ("01/03/2026 (note created)"). É a `query` que o app grava na
// resposta quando o usuário não escreveu instrução; com instrução (uma data ou
// outro texto), o título mostra o que ele escreveu e o retorno é null.
const SINCE_ORIGIN_LABEL = {
  'last /since': 'last /since',
  'note date': 'note date',
  'calendar day': 'calendar day',
  created: 'note created',
} as const

export function sinceTitleQuery(cut: { cutoff: string; source: SinceSource }, instruction: string): string | null {
  if (instruction.trim() || cut.source === 'instruction') return null
  return `${dmy(cut.cutoff)} (${SINCE_ORIGIN_LABEL[cut.source]})`
}

const SINCE_TITLE_QUERY_RE = /^\d{2}\/\d{2}\/\d{4} \((?:last \/since|note date|calendar day|note created)\)$/

// A query é a que o `sinceTitleQuery` gravou (e não uma instrução do usuário).
export function isSinceTitleQuery(query: string): boolean {
  return SINCE_TITLE_QUERY_RE.test(query.trim())
}

// O bloco de resultados do /since (o mesmo formato dos resultados de busca do
// app, com a fonte e a data). Sem itens = ''.
export function formatDatedResults(items: WebItem[], cutoff: string): string {
  if (items.length === 0) return ''
  const lines = items.map((item, i) => {
    const head = `${i + 1}. **${item.title}** · ${item.source} · ${dmy(item.date)}\n   ${item.url}`
    return item.snippet ? `${head}\n   ${item.snippet}` : head
  })
  return `Web search results (published since ${dmy(cutoff)}; the date of a page can be its last update):\n\n${lines.join('\n\n')}`
}
