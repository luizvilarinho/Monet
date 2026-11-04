import { ChatCircle, type Icon } from '@phosphor-icons/react'
import { coachAgent } from './coach'
import { planWeekAgent } from './planWeek'
import { plannerAgent } from './planner'
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
  // Política de contexto: true = segue o toggle/pasta do usuário; false =
  // desligado no turno (o toggle não muda). A nota aberta das Anotações vai sempre.
  context: { rag: boolean; web: boolean; deepResearch: boolean }
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
}

// Saída do montador de contexto.
export interface AgentContext {
  text: string
  // Caderno do RAG do turno (só com `context.rag`): string = o RAG e a tool
  // search_knowledge_base buscam nesse caderno; null = sem RAG; ausente = o da
  // pasta da conversa, como no General.
  ragNotebookId?: string | null
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
  context: { rag: true, web: true, deepResearch: true },
}

// Ordem do seletor e do autocomplete.
export const CHAT_AGENTS: ChatAgentDef[] = [generalAgent, planWeekAgent, plannerAgent, coachAgent, tutorAgent]

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
