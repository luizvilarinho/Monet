import { ChatCircle, type Icon } from '@phosphor-icons/react'
import type { AgentItemsPayload, AgentRun } from '../agentItems'
import { PAPERS_DEFAULT_MESSAGE, RADAR_DEFAULT_MESSAGE } from '../radar'
import { coachAgent } from './coach'
import { papersAgent } from './papers'
import { planWeekAgent } from './planWeek'
import { plannerAgent } from './planner'
import { radarAgent } from './radar'
import { tutorAgent } from './tutor'

// Agente de chat: um papel por conversa (D9). O prompt substitui o
// CHAT_SYSTEM_PROMPT; o contexto é remontado pelo app a cada mensagem e vai
// no system message efêmero; as tools forçadas valem só no turno.
export interface ChatAgentDef {
  id: string // gravado em ChatConversation.agentId
  command: string // atalho no composer, ex. '/plan-week'
  label: string // rótulo do seletor
  description: string // linha da lista e do autocomplete
  icon: Icon // Phosphor
  prompt: ((language: string) => string) | null // null = CHAT_SYSTEM_PROMPT (General)
  buildContext: ((input: AgentContextInput) => Promise<AgentContext>) | null
  forceTasksTool: boolean // liga query_tasks no turno sem mudar o toggle
  forceNotesTool: boolean // liga get_note/search_marks no turno sem mudar o toggle
  forceTrackersTool: boolean // liga query_trackers no turno sem mudar o toggle
  // Política de contexto: true = segue o toggle/pasta do usuário; false =
  // desligado no turno (o toggle não muda). A nota aberta das Anotações vai sempre.
  context: { rag: boolean; web: boolean; deepResearch: boolean }
  // Presente = o app roda as buscas dentro do buildContext (o modelo não recebe
  // a tool web_search; `context.web` fica false). needsTavily: o composer e o
  // send() exigem a chave do Tavily. status: o texto que o composer mostra
  // enquanto o app monta o contexto.
  webPipeline?: { needsTavily: boolean; status: string }
}

// Entrada do montador de contexto do agente (remontado a cada mensagem).
export interface AgentContextInput {
  todayKey: string
  // Caderno da pasta da conversa (vínculo da pasta de chat); null = nenhum.
  notebookId: string | null
  // Nome da pasta da conversa (fallback "Notebook - X"); null = sem pasta.
  folderName: string | null
  // Mensagens do usuário na conversa, da mais nova (a deste turno) para a mais antiga.
  userMessages: string[]
  signal: AbortSignal // o Stop cancela as buscas do pipeline
  // A última consulta concluída deste agente na conversa (Radar e Papers), se a
  // última resposta com consulta for dele: a base do seguimento sem nova busca.
  // Ausente ou null = a primeira consulta, ou a anterior falhou ou foi parada.
  previousRun?: AgentRun | null
  // Todas as consultas concluídas deste agente na conversa, da mais recente à mais
  // antiga: a janela do Radar que não encolhe procura entre elas a do escopo e do dia.
  previousRuns?: AgentRun[]
  // Agente com pipeline de busca: chamado logo antes da 1ª chamada que busca (o
  // planejador de consultas), para o composer mostrar o status só quando o app vai
  // mesmo buscar (não no seguimento, no caderno sem IA nem no escopo vazio).
  onSearchStart?: () => void
}

// Saída do montador de contexto.
export interface AgentContext {
  text: string
  // Caderno do RAG do turno (só com `context.rag`): string = o RAG e a tool
  // search_knowledge_base buscam nesse caderno; null = sem RAG; ausente = o da
  // pasta da conversa, como no General.
  ragNotebookId?: string | null
  // Itens que o app montou (Radar/Papers); gravados na mensagem do assistant.
  items?: AgentItemsPayload
  // Gancho de fim de turno: só roda quando a resposta termina com texto
  // (nunca em erro, Stop ou resposta vazia).
  onDone?: () => Promise<void>
}

export const GENERAL_AGENT_ID = 'general'

const generalAgent: ChatAgentDef = {
  id: GENERAL_AGENT_ID,
  command: '/general',
  label: 'General',
  description: 'Default chat: questions, study and research',
  icon: ChatCircle,
  prompt: null,
  buildContext: null,
  forceTasksTool: false,
  forceNotesTool: false,
  forceTrackersTool: false,
  context: { rag: true, web: true, deepResearch: true },
}

// Ordem do seletor e do autocomplete.
export const CHAT_AGENTS: ChatAgentDef[] = [generalAgent, planWeekAgent, plannerAgent, coachAgent, tutorAgent, radarAgent, papersAgent]

// Id ausente, desconhecido ou de agente removido = General.
export function findChatAgent(id: string | null | undefined): ChatAgentDef {
  return (typeof id === 'string' && CHAT_AGENTS.find((a) => a.id === id)) || generalAgent
}

const SHORTCUT_RE = /^\s*(\/[a-z][a-z0-9-]*)(?:\s+([\s\S]*))?$/i

// "/plan-week resto" no início da mensagem. null = não é atalho (texto normal).
export function parseAgentShortcut(text: string): { agent: ChatAgentDef; rest: string } | null {
  const m = text.match(SHORTCUT_RE)
  if (!m) return null
  const command = m[1].toLowerCase()
  const agent = CHAT_AGENTS.find((a) => a.command === command)
  return agent ? { agent, rest: (m[2] ?? '').trim() } : null
}

// Sugestões enquanto o rascunho é só "/prefixo". Comando já completo = sem
// lista (o Enter aplica o atalho).
export function agentSuggestions(draft: string): ChatAgentDef[] {
  if (!/^\/[a-z0-9-]*$/i.test(draft)) return []
  const prefix = draft.toLowerCase()
  if (CHAT_AGENTS.some((a) => a.command === prefix)) return []
  return CHAT_AGENTS.filter((a) => a.command.startsWith(prefix))
}

// Composer do chat com o agente ativo: placeholder, estado vazio e, nos
// agentes que não pedem pergunta (o app monta o contexto), a mensagem enviada
// quando o rascunho está vazio (ou é só o atalho, como "/coach").
export interface ChatAgentComposerHint {
  placeholder: string
  empty: string
  defaultMessage?: string
}

const COMPOSER_HINTS: Record<string, ChatAgentComposerHint> = {
  'plan-week': {
    placeholder: 'Plan week: press Enter to plan your week from your tasks',
    empty: 'Plan week reads your tasks and drafts your work week. Press Enter to start, or say what matters most this week.',
    defaultMessage: 'Plan my week',
  },
  planner: {
    placeholder: 'Planner: what do you want to plan, and until when?',
    empty: 'Planner drafts or redoes the plan for a goal with a deadline. Say what you want to plan and until when.',
  },
  coach: {
    placeholder: 'Coach: press Enter to check your plans',
    empty: 'Coach checks whether your plans are on schedule. Press Enter to start, or ask about one plan.',
    defaultMessage: 'Check my plans',
  },
  tutor: {
    placeholder: 'Tutor: which topic should we review?',
    empty: 'Tutor reviews your study of a topic and suggests next steps. Say which topic.',
  },
  radar: {
    placeholder: "Radar: press Enter to see what's new, or name a notebook, tag or board",
    empty:
      "Radar searches the news, releases and papers about what you study and shows only what is new since your last check. To look further back, say 'since 01/11'. Press Enter to start, or name a notebook, a #tag, a board or everything.",
    defaultMessage: RADAR_DEFAULT_MESSAGE,
  },
  papers: {
    placeholder: 'Papers: press Enter for essential papers, or name a topic, notebook or tag',
    empty:
      'Papers finds the foundational and recent papers on what you study and adds the ones you choose to your reading list. It searches OpenAlex, where conference papers may be missing. Press Enter to start, or name a notebook, a #tag or everything.',
    defaultMessage: PAPERS_DEFAULT_MESSAGE,
  },
}

// null = General (o composer usa os textos da superfície).
export function chatAgentComposerHint(id: string | null | undefined): ChatAgentComposerHint | null {
  return COMPOSER_HINTS[findChatAgent(id).id] ?? null
}
