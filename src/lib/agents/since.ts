import { dmy } from '../agentItems'
import { formatDatedResults, lastSinceDay, sinceCutoff, sinceTitleQuery } from '../radar'
import type { AgentDef } from './core'
import type { sinceSearch } from './radar'

// O que mudou sobre o assunto da nota desde que ela foi escrita. O app busca na
// web pelos termos da nota, com corte de data (a data da nota, ou a da
// instrução); sem chave Tavily é card de erro, e sem consulta válida a busca não
// roda (sem reserva pelo texto da nota).

export const SINCE_TOO_SHORT = 'The note has no text to compare yet. Write what you know about the subject, then run /since.'
export const SINCE_NO_QUERIES = 'Web search: not done (no searchable subject was found in the note).'
export const SINCE_SEARCH_FAILED = 'Web search: not done (the search failed).'
// A busca rodou e nada saiu na janela: o modelo precisa saber que buscou.
export const sinceNoResults = (cutoff: string) => `Web search: done, no results published since ${dmy(cutoff)}.`

export interface SinceContext {
  titleQuery: string | null // a `query` do bloco, com a data de corte e a origem (null = a instrução do usuário)
  extraContext: string[] // linhas do contexto: "Since: …" e o recado da busca, se não houve resultado
  searchContext: string | undefined // os resultados datados, quando há
}

// O contexto web do /since: o corte de data (a instrução, o último /since da nota,
// o `date`, o dia do Calendar ou a criação), a busca com ele e o que o modelo lê
// dela. `search` é a busca (o `sinceSearch` do agente Radar), injetada para este
// módulo ficar puro. Corte no futuro é `{ error }`. `onSearch` avisa que a busca vai
// começar (o status do comando).
export async function prepareSinceContext(
  o: {
    instruction: string
    note: { date?: string | null; createdAt: number }
    noteId: string
    calendarKey: string | null
    responses: Parameters<typeof lastSinceDay>[1]
    userText: string
    todayKey: string
    onSearch: () => void
  },
  search: typeof sinceSearch
): Promise<SinceContext | { error: string }> {
  const cut = sinceCutoff({
    instruction: o.instruction,
    note: o.note,
    calendarKey: o.calendarKey,
    lastSince: lastSinceDay(o.noteId, o.responses),
    todayKey: o.todayKey,
  })
  if ('error' in cut) return { error: cut.error }
  const out: SinceContext = {
    titleQuery: sinceTitleQuery(cut, o.instruction),
    extraContext: [`Since: ${dmy(cut.cutoff)} (${cut.source})`],
    searchContext: undefined,
  }
  o.onSearch()
  try {
    const r = await search({ userText: o.userText, instruction: o.instruction, cutoff: cut.cutoff, todayKey: o.todayKey })
    if (r.queries === 0) out.extraContext.push(SINCE_NO_QUERIES)
    else if (r.failed === r.queries) out.extraContext.push(SINCE_SEARCH_FAILED)
    else {
      out.searchContext = formatDatedResults(r.items, cut.cutoff) || undefined
      if (!out.searchContext) out.extraContext.push(sinceNoResults(cut.cutoff))
    }
  } catch (err) {
    console.warn('since search failed:', err)
    out.extraContext.push(SINCE_SEARCH_FAILED)
  }
  return out
}

export const sinceAgent: AgentDef = {
  command: {
    name: '/since',
    description: 'What changed since you wrote this note (web search from its date)',
    example: '/since 01/03/2026',
    takesQuery: true,
    optionalQuery: true,
  },
  label: 'Since',
  complementRules: false,
  behavior: `Role: tell what changed in the subject of the note since the cutoff date.
- The "Since:" line gives the cutoff date and where it came from. The "Web search results" were published after it (the date of a page can be its last update).
- Deliver up to 6 items, newest first, one per line: "- **dd/mm/yyyy** — <what changed, in one sentence> ([<source title>](<url>))". Use only the web results, one result per item; never invent a date, a source or a link.
- Only items about what the note says. Skip results that repeat what the note already has and old pages that were only updated.
- Say the note is outdated only when a result explicitly contradicts a statement in the note. Then end with a "**Possibly outdated**" line: the statement, briefly, and the source that contradicts it. Otherwise never say the note is outdated.
- The "AI blocks already in the note" were already added: do not repeat them.
- If no result is relevant, respond only: "Nothing relevant published since <dd/mm/yyyy>." (in the user's language).
- If a "Web search:" line says the search was not done, respond only with that line's reason (in the user's language).`,
  context: {
    note: 'userText',
    noteMeta: true,
    rag: null,
    web: 'since',
    agenda: null,
    datedNotes: false,
    previousDefinition: false,
    minUserTextChars: 40,
    tooShortMessage: SINCE_TOO_SHORT,
  },
}
