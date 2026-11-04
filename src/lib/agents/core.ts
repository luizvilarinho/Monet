import type { CommandDef, TaskStatusDef } from '../../types'

// Como a nota aberta entra na mensagem.
// full        = nota inteira, com os blocos de IA embutidos citados (legado)
// userText    = só o texto do usuário; os blocos de IA da nota vão numa seção à parte, marcados como "já complementado"
// termSnippet = trecho do texto do usuário em volta do termo (ou o começo da nota)
// none        = a nota não entra (o /docs responde só pelas fontes; /week-review e /today leem a nota pela agenda)
export type NoteMode = 'full' | 'userText' | 'termSnippet' | 'none'

// vector = busca de hoje (embedText + documentsSearchByIds), opcional, sem erro
// hybrid = ragRetrieve do chat (reescrita + híbrida + rerank); sem fontes é erro (só o /docs)
export type RagPolicy = { pipeline: 'vector'; topK: number } | { pipeline: 'hybrid' }

// none      = sem web
// required  = sem chave Tavily vira card de erro; busca quando há query
// withQuery = só o /expand: busca se houver query e chave; sem chave, segue e avisa numa linha
export type WebPolicy = 'none' | 'required' | 'withQuery'

export interface AgendaWindow {
  from: string
  to: string
  done: { from: string; to: string } | null
  header: string
  // Dias cujos itens de cada plano (feitos e abertos) entram no resumo do plano
  // ("Items dated …"); ausente = só o resumo de hoje.
  planDays?: { from: string; to: string }
}
export type AgendaPolicy = (args: { calendarKey: string; todayKey: string; statuses: TaskStatusDef[] }) => AgendaWindow

export interface ContextPolicy {
  note: NoteMode
  noteMeta: boolean            // "Notebook: X" + tipo e propriedades da nota (se tiver tipo)
  rag: RagPolicy | null
  web: WebPolicy
  agenda: AgendaPolicy | null  // só agentes calendarOnly
  datedNotes: boolean          // bloco "Notes dated on this day" numa nota do Calendar
  previousDefinition: boolean  // glossário (/define)
  minUserTextChars?: number    // abaixo disso, aviso sem chamar o modelo (/critique)
}

export interface AgentDef {
  command: CommandDef          // name, description, example, takesQuery, optionalQuery, calendarOnly
  label: string                // rótulo do bloco (D15)
  complementRules: boolean     // true só nos legados: entram as regras gerais de "complementar a nota"
  behavior: string             // papel + formato de saída; '' = só a descrição do comando (legado)
  context: ContextPolicy
}

function core(language: string): string {
  return `You are a specialized assistant inside Monet, a note-taking app. Your role and output format are defined below or by the command description.

Always respond in the user's language: ${language}. Use concise Markdown with no greetings, farewells, or filler phrases.
Do not invent facts, names, numbers, dates, or references.
The user message starts with today's date (the user's local date) and, in a Calendar note, the date of that note. Resolve "today", "tomorrow", "yesterday", "this week", "next week" and other relative dates from today's date, never from the Calendar note's date. Weeks start on Monday. Use the Calendar note's date only when the user refers to the day of that note.`
}

const COMPLEMENT_RULES = `

General goal:
- Complement the current note without literally repeating what is already written.
- Treat the note as the main context.
- Prioritize useful information not explicitly present in the note: concrete examples, practical implications, connections between concepts, exceptions, risks, counterpoints, and relevant context.

General rules:
- Do not rewrite, summarize, or paraphrase sections of the note, unless the command itself asks for synthesis.
- Do not rephrase existing content in other words.
- If you need to reference something already in the note, do so briefly and only to connect new information.
- If the command depends on web search, use only the provided results.
- If search results are insufficient, respond exactly: "I could not find enough information in the available results."
- If there is no relevant complement beyond what is already explicit in the note, respond exactly: "No relevant complement beyond what is already in the note."`

export function buildAgentSystemPrompt(agent: AgentDef, language: string): string {
  return core(language) + (agent.complementRules ? COMPLEMENT_RULES : '') + (agent.behavior ? `\n\n${agent.behavior}` : '')
}
