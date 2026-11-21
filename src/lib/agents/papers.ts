import { Article } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { dmy, type AgentSearchInfo } from '../agentItems'
import { buildFocusMap, focusEligibleNotes } from '../focusMap'
import { summarizeTags } from '../noteTags'
import { mergePapers, openAlexErrorText, rankFoundational, searchWorks, yearsAgoKey } from '../openalex'
import { readingListKeys, readingListMatch } from '../papers'
import { collectPlans } from '../planNotes'
import { ragGate } from '../rag'
import {
  FOLLOW_UP_NOTE,
  isFollowUp,
  keyPapers,
  messageSubject,
  paperCandidatesBlock,
  PAPERS_DEFAULT_MESSAGE,
  papersQueries,
  parseQueryPlan,
  repeatSearchNotes,
  SEARCH_NOT_DONE_NOTE,
  searchedQueries,
  uniqueQueries,
} from '../radar'
import { findRadarProfile } from '../radarProfile'
import { loadPlanData } from './agentData'
import type { AgentContext, AgentContextInput, ChatAgentDef } from './chat'
import { explicitScopeIn, resolveAgentScope, scopeKey, scopeLabel } from './scope'

// Agente Papers (chat): os artigos essenciais e os recentes sobre o que o usuário
// estuda, para a fila de leitura. Mesmo esqueleto do Radar: o app faz o trabalho
// dentro do buildContext (consultas geradas por um modelo a partir do mapa de
// foco e duas passadas no OpenAlex por consulta, a dos fundamentais e a dos
// recentes), tira o que já está na fila de leitura e numera os candidatos; o
// modelo só escolhe entre eles pelo marcador [P n] e o app desenha título,
// autores, ano, DOI e citações (agentItems.ts). Tetos por execução: 4 buscas no
// OpenAlex e 6 artigos na resposta. A busca leva só assuntos e termos, nunca o
// texto das notas. Escopo: caderno, tag ou tudo (sem board).

const ITEMS_MAX = 6
const FOUNDATIONAL_PER_PAGE = 40 // por relevância; o app reordena por citações
const RECENT_PER_PAGE = 20
const KEPT_PER_QUERY = 8
const CANDIDATES_PER_SECTION = 10
const RECENT_YEARS = 3
const INSTRUCTION_MAX = 300

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
// conversa fez (escopo e consultas), para o modelo responder pela conversa.
function followUpContext(search: AgentSearchInfo): string {
  return [
    'Papers context',
    `Scope: ${search.scopeLabel}`,
    ...(search.queries.length > 0 ? [`Queries searched: ${search.queries.join('; ')}`] : []),
    FOLLOW_UP_NOTE,
  ].join('\n')
}

// Escopo sem notas e assunto na mensagem: o mapa de foco não tem a que ligar, então o
// modelo escolhe pelo assunto que o usuário nomeou.
function noNotesSubjectNote(subject: string): string {
  return `This scope has no notes yet: the search used only the subject in the user's message ("${subject}"), so the focus map has nothing to connect to. Choose by that subject, not by the focus map: pick the candidates about "${subject}" and say why they matter. Do not say that nothing fits while a candidate is about that subject.`
}

export async function buildPapersContext(input: AgentContextInput): Promise<AgentContext> {
  const { todayKey, signal } = input
  const message = input.userMessages[0] ?? ''
  const data = await loadPlanData()

  // Escopo: o caderno da pasta, o que a mensagem cita (caderno ou tag) ou tudo.
  const tags = summarizeTags(focusEligibleNotes(data.notes, data.disabledNotebookIds)).map((t) => t.tag)
  const scopeContext = { notebooks: data.notebooks, tags, boardTypes: [] }
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
        'Papers context',
        `Scope: ${label}`,
        'AI is turned off for this notebook in Settings, so Papers does not read it. Say so in one line and ask the user to pick another notebook or turn AI on.',
      ].join('\n'),
    }
  }

  // Seguimento ("obrigado", "continue") numa conversa que já tem uma consulta do
  // Papers: sem pipeline. O modelo responde pela conversa.
  const followUp = isFollowUp({
    gate: ragGate(message),
    message,
    explicitScope: explicitScopeIn(message, scopeContext) !== null,
    previous: input.previousRun,
    todayKey,
    defaultMessage: PAPERS_DEFAULT_MESSAGE,
  })
  if (followUp && input.previousRun) return { text: followUpContext(input.previousRun.search) }

  // O perfil do Radar é global: o Papers usa dele só a linha Ignore, para a busca
  // seguir o escopo e não os assuntos que o perfil manda seguir.
  const focus = buildFocusMap({
    scope,
    notes: data.notes,
    notebooks: data.notebooks,
    defs: data.defs,
    books: data.books,
    disabledNotebookIds: data.disabledNotebookIds,
    radarProfile: findRadarProfile(data.notes, data.disabledNotebookIds),
    profileUse: 'ignore',
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
        'Papers context',
        `Scope: ${label}`,
        'This scope has no notes yet, so there is no material to anchor the search. Say so in one line and suggest adding notes or choosing another scope (a notebook, a tag or everything).',
      ].join('\n'),
    }
  }

  // Consultas: um modelo lê o mapa de foco e devolve os temas centrais; cada
  // consulta passa por cleanQueries antes de sair do app. A reserva (planejador
  // falhou) usa os assuntos do mapa de foco e, no escopo vazio, o da mensagem. O
  // comando não tem cancelamento: depois do Stop o resultado é descartado e nenhuma
  // busca começa.
  signal.throwIfAborted()
  input.onSearchStart?.()
  const raw = await invoke<string[]>('radar_plan_queries', {
    kind: 'papers',
    focus: focus.text,
    instruction: clip(oneLine(message), INSTRUCTION_MAX),
    since: '',
    currentDate: todayKey,
  }).catch(() => [] as string[])
  signal.throwIfAborted()
  const queries = papersQueries(parseQueryPlan(raw), subject ? [subject, ...focus.terms] : focus.terms, focus.text)

  const header = [
    'Papers context',
    ...(scopeChange ? [scopeChange] : []),
    ...repeatSearchNotes({ previousRun: input.previousRun, previousRuns: input.previousRuns, message }),
    focus.text,
    ...(subject ? [noNotesSubjectNote(subject)] : []),
  ]
  if (queries.length === 0) {
    return { text: ['Papers context', ...(scopeChange ? [scopeChange] : []), `Scope: ${label}`, SEARCH_NOT_DONE_NOTE].join('\n') }
  }

  // Fila de leitura: o que já está nela não volta como candidato. Fica de fora
  // antes de ordenar, para as vagas irem a artigos novos.
  const readingList = readingListKeys(data.notes, data.types, data.defs)
  const excluded = new Set(readingList.keys())
  const fresh = <T extends { doi: string | null; openalexId: string }>(list: T[]): T[] =>
    list.filter((p) => readingListMatch(p, readingList) === null)

  // Duas passadas por consulta, em paralelo (até 4 chamadas ao OpenAlex): os
  // fundamentais (busca por relevância, reordenada por citações aqui) e os
  // recentes (últimos 3 anos, por relevância). O Stop cancela todas.
  const recentFrom = yearsAgoKey(todayKey, RECENT_YEARS)
  const [foundationalRes, recentRes] = await Promise.all([
    Promise.allSettled(
      queries.map((q) => searchWorks({ query: q, perPage: FOUNDATIONAL_PER_PAGE, section: 'foundational' }, signal))
    ),
    Promise.allSettled(
      queries.map((q) => searchWorks({ query: q, fromDate: recentFrom, perPage: RECENT_PER_PAGE, section: 'recent' }, signal))
    ),
  ])
  signal.throwIfAborted()

  const queuedLeftOut = new Set(
    [...fulfilled(foundationalRes), ...fulfilled(recentRes)]
      .flat()
      .filter((p) => readingListMatch(p, readingList) !== null)
      .map((p) => p.id)
  ).size

  const foundational = mergePapers(
    fulfilled(foundationalRes).map((r) => rankFoundational(fresh(r), KEPT_PER_QUERY)),
    excluded,
    CANDIDATES_PER_SECTION
  )
  const recent = mergePapers(
    fulfilled(recentRes).map((r) => fresh(r).slice(0, KEPT_PER_QUERY)),
    new Set([...excluded, ...foundational.map((p) => p.id)]),
    CANDIDATES_PER_SECTION
  )
  const papers = keyPapers([...foundational, ...recent])
  const foundationalItems = papers.slice(0, foundational.length)
  const recentItems = papers.slice(foundational.length)

  const searches = queries.length * 2
  const failures = rejected(foundationalRes).concat(rejected(recentRes))
  const searchLine = `Papers search (OpenAlex): ${queries.length} queries${failures.length > 0 ? `, ${failures.length} of ${searches} searches failed: ${openAlexErrorText(failures[0].reason)}` : ''}`

  // As consultas que rodaram (alguma das duas passadas deu certo): vão ao modelo e ao payload.
  const searched = uniqueQueries(searchedQueries(queries, foundationalRes, recentRes))

  const text = [
    ...header,
    searchLine,
    ...(searched.length > 0 ? [`Queries searched: ${searched.join('; ')}`] : []),
    `Already in the reading list (left out): ${queuedLeftOut} papers`,
    'Candidates — foundational (most cited among the relevant results):',
    paperCandidatesBlock(foundationalItems),
    `Candidates — recent (published since ${dmy(recentFrom)}, by relevance):`,
    paperCandidatesBlock(recentItems),
  ].join('\n')

  // Nenhuma busca deu certo: nada a mostrar nem a registrar (o texto diz a falha).
  if (searched.length === 0) return { text }

  return {
    text,
    items: {
      items: papers,
      max: ITEMS_MAX,
      scopeNotebookId: focus.scopeNotebookId,
      search: {
        scopeKey: scopeKey(scope),
        scopeLabel: label,
        since: null,
        windowNote: null,
        queries: searched,
        profile: focus.profileUsed,
      },
    },
  }
}

function papersPrompt(language: string): string {
  return `You are Monet's Papers agent: you recommend the scholarly papers the user should know about the topic in scope: the foundational ones and the recent ones. You only pick from the candidates the app found in OpenAlex; you never add a paper, title, author, year, DOI or citation count of your own.

Respond in the language of the user's latest message (if unclear: ${language}). Short Markdown, no greetings or filler.

Data:
- The "Papers context" system block is rebuilt by the app for every message: the scope, the focus map (note titles, study profiles, plans, tags, books), the queries the app searched and the numbered candidates [P1], [P2]… in two groups: Foundational (the most cited among the relevant results) and Recent (last 3 years, by relevance), each with title, first authors, year, type, citations, open access and an abstract excerpt. Papers already in the user's reading list were left out by the app. Only the latest version of the block counts: ignore older versions of the block itself, not the earlier answers in the conversation, which stay valid.
- When the block has a "Radar profile (ignore only)" line, never pick a paper about what it says to ignore.

Follow-ups:
- When the user asks about a paper already shown (for example "tell me more about the second one" or "summarize it"), answer from the conversation: the papers and what you wrote are above. Do not list the candidates again and write no marker line, unless the user asks for a new search.
- When the block says "Follow-up: the app did not search again", there are no candidates: answer from the conversation, with no item line and no marker.

Repeated searches:
- When the block says "This is a new search", the earlier answers in the conversation came from earlier searches the app made, and they are still valid. A paper from an earlier answer can be missing from the candidates, for instance because the user has since added it to the reading list. Answer with a new list built from the current candidates, in the usual format.
- Never retract, correct or question papers from earlier answers: do not say they were not among the candidates, do not call them wrong or invented, and do not ask the user to disregard them. Never ask for confirmation before listing: the user already asked for the search.
- When the block says the message only asks to search again or sets the window, the search covers the whole scope: do not narrow the answer to the subject of an earlier question and do not mention that subject.

Output:
- Up to 6 papers, in **Foundational** and **Recent** (section titles in the user's language), leaving out an empty section.
- One line per paper, exactly: "- [P4] <why it matters for this scope, in one sentence, naming the note, plan or subject it connects to>". Start the line with the candidate's marker and do not write its title, authors, year, DOI or citations: the app replaces the marker with them.
- Choose by fit with the focus map first, then by citations. Skip off-topic candidates even when highly cited: a candidate that shares only a broad keyword is off-topic. Judge by the title and the abstract; with no abstract, pick only when the title clearly matches.
- When the block says the scope has no notes yet, there is nothing in the focus map to connect to: choose the candidates about the subject the user named, and never say that no candidate fits while one is about that subject.
- No candidate fits: say so in one line and suggest a narrower topic (the block lists the queries the app searched). Never fill the list.
- When the block says the search was not done or failed, say why in one line and stop. When it says "Search not done", say that in one line and stop: the user can try again.
- When the block says the scope has no material or AI is off, follow the block and stop.

You never write to notes. The user adds papers to the reading list with the buttons under your answer.`
}

export const papersAgent: ChatAgentDef = {
  id: 'papers',
  command: '/papers',
  label: 'Papers',
  description: 'Foundational and recent papers on a topic, not only new ones, for your reading list',
  icon: Article,
  prompt: papersPrompt,
  buildContext: buildPapersContext,
  forceTasksTool: false,
  forceNotesTool: false,
  forceTrackersTool: false,
  context: { rag: false, web: false, deepResearch: false },
  webPipeline: { needsTavily: false, status: 'Searching OpenAlex…' },
}
