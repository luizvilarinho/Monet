import { Broadcast } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { storage } from '../../storage'
import { dmy, type AgentItemsPayload, type AgentSearchInfo, type WebItem } from '../agentItems'
import { dateKeyFromMs } from '../calendar'
import { buildFocusMap, focusEligibleNotes } from '../focusMap'
import { loadKbSourceFilenames } from '../librarian'
import { resolveBoard } from '../noteBoard'
import { summarizeTags } from '../noteTags'
import { mergePapers, openAlexErrorText, searchWorks } from '../openalex'
import { collectPlans } from '../planNotes'
import { ragGate } from '../rag'
import {
  chooseRadarWindow,
  cleanQueries,
  FOLLOW_UP_NOTE,
  isFollowUp,
  keptWindow,
  keyPapers,
  messageSubject,
  paperCandidatesBlock,
  parseQueryPlan,
  RADAR_DEFAULT_MESSAGE,
  radarQueryBuckets,
  recordedDate,
  repeatSearchNotes,
  requestedWindow,
  resolveResultUrl,
  SEARCH_NOT_DONE_NOTE,
  searchedQueries,
  uniqueQueries,
  webCandidates,
  webCandidatesBlock,
} from '../radar'
import { findRadarProfile } from '../radarProfile'
import { hashUrlToFilename, webSearch, type SearchResult } from '../search'
import { loadPlanData } from './agentData'
import type { AgentContext, AgentContextInput, ChatAgentDef } from './chat'
import { explicitScopeIn, resolveAgentScope, scopeKey, scopeLabel } from './scope'

// Agente Radar (chat): o que há de novo, desde a última consulta, nos assuntos
// que o usuário estuda e acompanha. O app faz o trabalho de busca dentro do
// buildContext (consultas geradas por um modelo a partir do mapa de foco, Tavily
// com filtro de data e OpenAlex), filtra e numera os candidatos; o modelo só
// escolhe entre eles pelo marcador [W n]/[P n] e o app desenha título, link,
// fonte e data (agentItems.ts). Tetos por execução: 6 buscas Tavily, 3 OpenAlex
// e 8 itens na resposta. A busca leva só assuntos e termos, nunca o texto das
// notas; o mapa de foco vai só ao modelo que gera as consultas e ao do chat.

const ITEMS_MAX = 8
const WEB_CANDIDATES_MAX = 20
const PAPER_CANDIDATES_MAX = 10
const SINCE_CANDIDATES_MAX = 12
const WEB_RESULTS_PER_QUERY = 5
const PAPERS_PER_QUERY = 10
const INSTRUCTION_MAX = 300
const SINCE_NOTE_MAX = 4000

function clip(s: string, max: number): string {
  return s.trim().slice(0, max)
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ')
}

function fulfilled<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}

function rejected(results: PromiseSettledResult<unknown>[]): PromiseRejectedResult[] {
  return results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
}

// O contexto de um seguimento: sem busca nova, só o que a consulta anterior da
// conversa fez (escopo, janela e consultas), para o modelo responder pela conversa.
function followUpContext(search: AgentSearchInfo): string {
  return [
    'Radar context',
    `Scope: ${search.scopeLabel}`,
    ...(search.since ? [`Window: since ${dmy(search.since)} (${search.windowNote ?? 'earlier search'})`] : []),
    ...(search.queries.length > 0 ? [`Queries searched: ${search.queries.join('; ')}`] : []),
    FOLLOW_UP_NOTE,
  ].join('\n')
}

// Escopo sem notas e assunto na mensagem: o mapa de foco não tem o que tocar, então o
// modelo escolhe pelo assunto que o usuário nomeou (nunca "Nothing new" com candidato
// sobre ele).
function noNotesSubjectNote(subject: string): string {
  return `This scope has no notes yet: the search used only the subject in the user's message ("${subject}"), so the focus map has nothing to touch. Choose by that subject, not by the focus map: pick the candidates about "${subject}" and say why they matter. Do not answer "Nothing new" while a candidate is about that subject.`
}

export async function buildRadarContext(input: AgentContextInput): Promise<AgentContext> {
  const { todayKey, signal } = input
  const message = input.userMessages[0] ?? ''
  const data = await loadPlanData()

  // Escopo: o caderno da pasta, o que a mensagem cita (caderno, tag, board) ou tudo.
  const tags = summarizeTags(focusEligibleNotes(data.notes, data.disabledNotebookIds)).map((t) => t.tag)
  const boardTypes = data.types.filter((t) => resolveBoard(t, data.defs) !== null)
  const scopeContext = { notebooks: data.notebooks, tags, boardTypes }
  const scope = resolveAgentScope(input, scopeContext)
  const label = scopeLabel(scope)
  const previous =
    input.userMessages.length > 1
      ? resolveAgentScope({ ...input, userMessages: input.userMessages.slice(1) }, scopeContext)
      : null
  const scopeChange = previous && scopeKey(previous) !== scopeKey(scope) ? `Scope changed: ${scopeLabel(previous)} → ${label}.` : null

  if (scope.kind === 'notebook' && data.disabledNotebookIds.has(scope.notebook.id)) {
    return {
      text: [
        'Radar context',
        `Scope: ${label}`,
        'AI is turned off for this notebook in Settings, so the Radar does not read it. Say so in one line and ask the user to pick another notebook or turn AI on.',
      ].join('\n'),
    }
  }

  // Seguimento ("obrigado", "continue") numa conversa que já tem uma consulta do
  // Radar: sem pipeline, e a data do escopo não muda (não há onDone). O modelo
  // responde pela conversa.
  const scopeStateKey = scopeKey(scope)
  const followUp = isFollowUp({
    gate: ragGate(message),
    message,
    explicitScope: explicitScopeIn(message, scopeContext) !== null,
    previous: input.previousRun,
    todayKey,
    defaultMessage: RADAR_DEFAULT_MESSAGE,
  })
  if (followUp && input.previousRun) return { text: followUpContext(input.previousRun.search) }

  const profile = findRadarProfile(data.notes, data.disabledNotebookIds)
  const focus = buildFocusMap({
    scope,
    notes: data.notes,
    notebooks: data.notebooks,
    defs: data.defs,
    books: data.books,
    disabledNotebookIds: data.disabledNotebookIds,
    radarProfile: profile,
    todayKey,
    plans: collectPlans({
      notes: data.notes,
      defs: data.defs,
      types: data.types,
      todayKey,
      disabledNotebookIds: data.disabledNotebookIds,
    }),
  })
  // Escopo sem notas: com um assunto na mensagem, busca por ele; sem, recusa.
  const subject = focus.empty ? messageSubject(message) : null
  if (focus.empty && !subject) {
    return {
      text: [
        'Radar context',
        `Scope: ${label}`,
        'This scope has no notes yet, so there is no material to anchor the search. Say so in one line and suggest adding notes or choosing another scope (a notebook, a tag, a board or everything).',
      ].join('\n'),
    }
  }

  // Janela: a que a mensagem pede ("since 01/11", "last 7 days"); senão a da
  // consulta anterior desta conversa, do mesmo escopo e do mesmo dia (a mais
  // recente entre todas; não encolhe dentro da conversa); senão desde a última
  // consulta concluída do escopo.
  const lastRun = await storage.getRadarLastRun(scopeStateKey).catch(() => null)
  const period = chooseRadarWindow({
    lastRun,
    todayKey,
    request: requestedWindow(message, todayKey),
    kept: keptWindow(input.previousRuns, scopeStateKey, todayKey),
  })
  const { since } = period

  // Consultas: um modelo lê o mapa de foco e devolve assuntos; cada consulta
  // passa por cleanQueries antes de sair do app. A reserva (planejador falhou)
  // usa os assuntos do mapa de foco e, no escopo vazio, o da mensagem. O comando
  // não tem cancelamento: depois do Stop o resultado é descartado e nenhuma busca
  // começa.
  signal.throwIfAborted()
  input.onSearchStart?.()
  const raw = await invoke<string[]>('radar_plan_queries', {
    kind: 'radar',
    focus: focus.text,
    instruction: clip(oneLine(message), INSTRUCTION_MAX),
    since,
    currentDate: todayKey,
  }).catch(() => [] as string[])
  signal.throwIfAborted()
  const buckets = radarQueryBuckets(parseQueryPlan(raw), subject ? [subject, ...focus.terms] : focus.terms, focus.text)
  if (buckets.news.length + buckets.release.length + buckets.paper.length === 0) {
    return { text: ['Radar context', ...(scopeChange ? [scopeChange] : []), `Scope: ${label}`, SEARCH_NOT_DONE_NOTE].join('\n') }
  }

  // Buscas em paralelo; o Stop cancela todas (o AbortError sobe para o useChat).
  const webOpts = { startDate: since, filterByDate: true }
  const [newsRes, releaseRes, paperRes] = await Promise.all([
    Promise.allSettled(
      buckets.news.map((q) => webSearch(q, WEB_RESULTS_PER_QUERY, false, signal, { topic: 'news', ...webOpts }))
    ),
    Promise.allSettled(
      buckets.release.map((q) => webSearch(q, WEB_RESULTS_PER_QUERY, false, signal, { topic: 'general', ...webOpts }))
    ),
    Promise.allSettled(
      buckets.paper.map((q) => searchWorks({ query: q, fromDate: since, perPage: PAPERS_PER_QUERY, section: 'radar' }, signal))
    ),
  ])
  signal.throwIfAborted()

  // Candidatos: web com data na janela, sem repetidos e sem o que já está na KB;
  // artigos sem repetidos.
  const groups = [
    { section: 'news' as const, results: fulfilled(newsRes).flat() },
    { section: 'releases' as const, results: fulfilled(releaseRes).flat() },
  ]
  const kb = await loadKbSourceFilenames()
  const hashes = new Map<string, string>(
    await Promise.all(
      groups
        .flatMap((g) => g.results)
        .map((r) => resolveResultUrl(r.url))
        .filter((url): url is string => !!url)
        .map(async (url) => [url, await hashUrlToFilename(url)] as const)
    )
  )
  const web = webCandidates(groups, {
    since,
    todayKey,
    max: WEB_CANDIDATES_MAX,
    excludeHashes: kb,
    hashOf: (url) => hashes.get(url) ?? '',
  })
  // Obra com data de publicação futura (número de revista do ano seguinte) não é novidade.
  const published = fulfilled(paperRes).map((list) => list.filter((p) => !p.date || p.date <= todayKey))
  const papers = keyPapers(mergePapers(published, new Set(), PAPER_CANDIDATES_MAX))

  // O que o modelo lê sobre as buscas.
  const webQueries = buckets.news.length + buckets.release.length
  const webFailed = rejected(newsRes).length + rejected(releaseRes).length
  const paperFailures = rejected(paperRes)
  const webLine =
    webQueries === 0
      ? 'Web search: not done (no searchable subject was found in the focus map).'
      : `Web search: ${webQueries} queries (${buckets.news.length} news, ${buckets.release.length} releases)${webFailed > 0 ? `, ${webFailed} failed` : ''}`
  const papersLine =
    buckets.paper.length === 0
      ? 'Papers search: no queries.'
      : `Papers search (OpenAlex): ${buckets.paper.length} queries${paperFailures.length > 0 ? `, ${paperFailures.length} failed: ${openAlexErrorText(paperFailures[0].reason)}` : ''}`

  // As consultas que rodaram (alguma busca deu certo): vão ao modelo e ao payload.
  const searched = uniqueQueries([
    ...searchedQueries(buckets.news, newsRes),
    ...searchedQueries(buckets.release, releaseRes),
    ...searchedQueries(buckets.paper, paperRes),
  ])

  const text = [
    'Radar context',
    ...(scopeChange ? [scopeChange] : []),
    `Window: since ${dmy(since)} (${period.note}${period.kept ? '; same window as the earlier search in this conversation' : ''})`,
    ...(lastRun === null ? ['First check of this scope: yes'] : []),
    ...repeatSearchNotes({ previousRun: input.previousRun, previousRuns: input.previousRuns, message }),
    focus.text,
    ...(subject ? [noNotesSubjectNote(subject)] : []),
    webLine,
    papersLine,
    ...(searched.length > 0 ? [`Queries searched: ${searched.join('; ')}`] : []),
    `Candidates — web (published since ${dmy(since)}; older and undated results were removed by the app):`,
    webCandidatesBlock(web),
    `Candidates — papers (published since ${dmy(since)}):`,
    paperCandidatesBlock(papers),
  ].join('\n')

  // Nenhuma busca deu certo: nada a mostrar nem a registrar (o texto diz a falha).
  if (searched.length === 0) return { text }

  const items: AgentItemsPayload = {
    items: [...web, ...papers],
    max: ITEMS_MAX,
    scopeNotebookId: focus.scopeNotebookId,
    search: {
      scopeKey: scopeStateKey,
      scopeLabel: label,
      since,
      windowNote: period.note,
      queries: searched,
      profile: focus.profileUsed,
      hasProfileNote: profile !== null,
    },
  }
  // A data da consulta só avança com o plano do modelo (a consulta de reserva
  // não avança) e uma busca que deu certo (mesmo sem resultado), e só quando o
  // turno termina com texto: o useChat chama o onDone.
  return {
    text,
    items,
    onDone: buckets.reserve
      ? undefined
      : async () => {
          await storage
            .setRadarLastRun(scopeStateKey, recordedDate(lastRun, dateKeyFromMs(Date.now())))
            .catch((e) => console.warn('radar last run not saved', e))
        },
  }
}

function radarPrompt(language: string): string {
  return `You are Monet's Radar: you tell the user what is new, since their last check, in the subjects they study and work on. You only pick from the candidates the app found; you never add items, links, titles, dates or sources of your own.

Respond in the language of the user's latest message (if unclear: ${language}). Short Markdown, no greetings or filler.

Data:
- The "Radar context" system block is rebuilt by the app for every message: the scope, the search window ("since"), the queries the app searched, the focus map (notebooks, recent note titles, study profiles, plans, tags, books in progress, board cards and the radar profile) and the numbered candidates found by the app: web results [W1], [W2]… (news and releases, with source and date) and papers [P1], [P2]… (from OpenAlex, with authors, year and citations). Only the latest version of the block counts: ignore older versions of the block itself, not the earlier answers in the conversation, which stay valid.
- The window is "since the last check" unless the user asked for another one in the message (for example "since 01/11" or "last 7 days"); the block says which.
- The candidates were already filtered by date. The date of a web page can be its last update: skip a candidate that is not actually new (an old article, an evergreen page, a list of links, a product home page).
- Respect the radar profile: prefer its sources and never pick what it says to ignore. In a notebook, tag or board scope the block shows only the profile's Sources and Ignore lines ("Radar profile (sources and ignore only)"): pick only what fits that scope. When the profile has neither, the block says "Radar profile: saved." and nothing from the profile applies.

Follow-ups:
- When the user asks about an item already shown (for example "tell me more about the second one" or "summarize it"), answer from the conversation: the items and what you wrote are above. Do not list the candidates again and write no marker line, unless the user asks for a new check.
- When the block says "Follow-up: the app did not search again", there are no candidates: answer from the conversation, with no item line and no marker.

Repeated searches:
- When the block says "This is a new search", the earlier answers in the conversation came from earlier searches the app made, and they are still valid. Answer with a new list built from the current candidates, in the usual format.
- Never retract, correct or question items from earlier answers: do not say they were not among the candidates, do not call them wrong or invented, and do not ask the user to disregard them. Never ask for confirmation before listing: the user already asked for the search.
- When the block says the message only asks to search again or sets the window, the search covers the whole scope: do not narrow the answer to the subject of an earlier question and do not mention that subject.

Output:
- Up to 8 items in total, in these sections and in this order, leaving out empty sections: **News**, **Releases & changes**, **New papers** (section titles in the user's language).
- One line per item, exactly: "- [W3] <what is new, in one short sentence> — <the notebook, note, book, plan or card it touches>". Start the line with the candidate's marker ([W n] for web, [P n] for papers) and do not write its title, link, source or date: the app replaces the marker with them.
- Pick an item only when it touches something in the focus map, and name what it touches. Fewer good items are better than a full list: never fill the list with weak items.
- When the block says the scope has no notes yet, that rule does not apply: there is nothing in the focus map to touch. Pick the candidates about the subject the user named, say why they matter, and never answer "Nothing new" while a candidate is about that subject.
- Nothing relevant: answer only "Nothing new since <the since date as dd/mm/yyyy>." (in the user's language), with no list.
- When the block says a search was not done or failed, say so in one line at the end. When it says "Search not done", say that in one line and stop: the user can try again.
- When the block says the scope has no material or AI is off, follow the block and stop.

Radar profile:
- Propose a profile only when the block's profile line says exactly "Radar profile: none.", the block also says "First check of this scope: yes", and you have not proposed one earlier in this conversation. Then end the answer with a proposal the user can save with "Save radar profile". Keep the labels Follow:, Sources: and Ignore: exactly as written, in English and never translated (the app reads them to save the profile); the header may be in the user's language (e.g. "Perfil do radar") and so may the values:
  **Radar profile**
  Follow: <3 to 6 subjects, comma-separated, inferred from the focus map>
  Sources: <preferred sources, or "any">
  Ignore: <what to leave out, or "nothing yet">
- Any other profile line ("Radar profile:" followed by its lines, "Radar profile (sources and ignore only):" or "Radar profile: saved…") means the user already has a profile: never propose one, even on the first check of the scope, and never say they have none.
- Propose it only on the first check of the scope. When the user corrects a proposal, repeat the block with the change.

You never write to notes. The user opens, queues or saves items with the buttons under your answer.`
}

export const radarAgent: ChatAgentDef = {
  id: 'radar',
  command: '/radar',
  label: 'Radar',
  description: "What's new in the subjects you study, since your last check",
  icon: Broadcast,
  prompt: radarPrompt,
  buildContext: buildRadarContext,
  forceTasksTool: false,
  forceNotesTool: false,
  forceTrackersTool: false,
  context: { rag: false, web: false, deepResearch: false },
  webPipeline: { needsTavily: true, status: 'Searching news, releases and papers…' },
}

// /since: a busca web do slash. O modelo lê a nota só para achar o assunto e
// devolve consultas; cada uma passa por cleanQueries, que barra a que copia 6+
// palavras da nota. Sem consulta válida a busca não roda (não há reserva pelo
// texto da nota, para nenhum trecho dela ir à busca). `queries`/`failed` contam
// as consultas feitas e as que falharam.
export async function sinceSearch(o: {
  userText: string
  instruction: string
  cutoff: string
  todayKey: string
}): Promise<{ items: WebItem[]; queries: number; failed: number }> {
  const raw = await invoke<string[]>('radar_plan_queries', {
    kind: 'since',
    focus: clip(o.userText, SINCE_NOTE_MAX),
    instruction: clip(oneLine(o.instruction), INSTRUCTION_MAX),
    since: o.cutoff,
    currentDate: o.todayKey,
  }).catch(() => [] as string[])
  const queries = cleanQueries(
    parseQueryPlan(raw)
      .filter((p) => p.kind === 'web')
      .map((p) => p.query),
    { max: 3, forbidCopyFrom: o.userText }
  )
  if (queries.length === 0) return { items: [], queries: 0, failed: 0 }

  const settled = await Promise.allSettled(
    queries.map((q) =>
      webSearch(q, WEB_RESULTS_PER_QUERY, false, undefined, { topic: 'general', startDate: o.cutoff, filterByDate: true })
    )
  )
  const results: SearchResult[] = fulfilled(settled).flat()
  return {
    items: webCandidates([{ section: 'news', results }], {
      since: o.cutoff,
      todayKey: o.todayKey,
      max: SINCE_CANDIDATES_MAX,
    }),
    queries: queries.length,
    failed: rejected(settled).length,
  }
}
