import type { CommandContext, CommandDef } from '../types'

export const COMMANDS: CommandDef[] = [
  { name: '/pesquisa', description: 'Busca rápida, resposta objetiva', example: '/pesquisa Delta Sharing', takesQuery: true },
  { name: '/quem', description: 'Perfil profissional de uma pessoa', example: '/quem Adriana Silva, Banco Inter', takesQuery: true },
  { name: '/definir', description: 'Definição técnica concisa', example: '/definir RAG', takesQuery: true },
  { name: '/resumir', description: 'Resume a nota atual em bullets', example: '/resumir', takesQuery: false },
  { name: '/flashcard', description: 'Gera até 3 flashcards P:/R:', example: '/flashcard', takesQuery: false },
  { name: '/opiniao', description: 'Resposta opinativa e direta', example: '/opiniao usar RAG vs fine-tuning', takesQuery: true },
  { name: '/deepsearch', description: 'Pesquisa aprofundada e estruturada', example: '/deepsearch attention mechanism', takesQuery: true },
  { name: '/tabela', description: 'Resposta formatada como tabela markdown', example: '/tabela REST vs GraphQL', takesQuery: true },
  { name: '/conectar', description: 'Identifica conexões entre conceitos na nota', example: '/conectar', takesQuery: false },
]

export function findCommand(name: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.name === name)
}

export async function executeCommand(
  _ctx: CommandContext,
  _onChunk: (text: string) => void
): Promise<void> {
  throw new Error('executeCommand not implemented')
}
