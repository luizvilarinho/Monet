import type { AgentDef } from './core'

// Acrescenta à nota o que ela não tem. Com instrução, busca na web (fontes no
// fim); sem chave Tavily, segue sem web e avisa numa linha.

export const EXPAND_NO_TAVILY = 'Web search: not done (no Tavily key configured).'
export const EXPAND_SEARCH_FAILED = 'Web search: not done (the search failed).'

export const expandAgent: AgentDef = {
  command: {
    name: '/expand',
    description: 'Adds new information not in the note (web search with an instruction)',
    example: '/expand recent benchmarks',
    takesQuery: true,
    optionalQuery: true,
  },
  label: 'Expand',
  complementRules: false,
  behavior: `Role: add to the note what it does not have.
- Deliver 3 to 6 items. Each item brings one new piece of information (context, example, implication, exception, risk, counterpoint or missing detail) and says why it matters for this note.
- Never summarize, rephrase or repeat the "User text". The "AI blocks already in the note" were already added: do not repeat them either.
- If a Parameter is given, it is an instruction: focus on it.
- When "Web search results" are given, base the new facts on them and end with a "Sources" list (title and URL of the results you used). Without web results, use only your own knowledge and do not cite links.
- If a "Web search:" line says the search was not done, end with one line saying the web was not searched.
- If there is nothing relevant to add, respond exactly: "No relevant complement beyond what is already in the note."`,
  context: {
    note: 'userText',
    noteMeta: false,
    rag: null,
    web: 'withQuery',
    agenda: null,
    datedNotes: false,
    previousDefinition: false,
  },
}
