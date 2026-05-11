import type { CommandDef } from '../types'

export const COMMANDS: CommandDef[] = [
  { name: '/pesquisa', description: 'Busca rápida, resposta objetiva', example: '/pesquisa Delta Sharing', takesQuery: true, usesSearch: true },
  { name: '/quem', description: 'Perfil profissional de uma pessoa', example: '/quem Adriana Silva, Banco Inter', takesQuery: true, usesSearch: true },
  { name: '/definir', description: 'Definição técnica concisa', example: '/definir RAG', takesQuery: true },
  { name: '/resumir', description: 'Resume a nota atual', example: '/resumir', takesQuery: false },
  { name: '/opiniao', description: 'Resposta opinativa e direta', example: '/opiniao usar RAG vs fine-tuning', takesQuery: true },
  { name: '/tabela', description: 'Resposta formatada como tabela markdown', example: '/tabela REST vs GraphQL', takesQuery: true },
  { name: '/aprofundar', description: 'Adicione apenas informações novas e úteis que não estejam explícitas na nota, sem resumir, reformular ou parafrasear o texto existente', example: '/aprofundar', takesQuery: true },
  { name: '/explicar', description: 'Explica um conceito de forma simples, como se fosse para um iniciante (técnica Feynman)', example: '/explicar entrelaçamento quântico', takesQuery: true, usesSearch: true },
  { name: '/guia', description: 'Cria um roteiro de estudos com tópicos e sequência lógica para dominar o assunto', example: '/guia cálculo diferencial', takesQuery: true, usesSearch: true },
  { name: '/mapa-mental', description: 'Gera um mapa mental hierárquico da nota atual em markdown', example: '/mapa-mental', takesQuery: false },
  { name: '/perguntar', description: 'Faz uma pergunta livre ao modelo', example: '/perguntar qual a diferença entre HTTP/1.1 e HTTP/2?', takesQuery: true, usesSearch: true },
  { name: '/documentos', description: 'Responde usando apenas os documentos do caderno', example: '/documentos quais empresas a pessoa trabalhou?', takesQuery: true },
]

export function findCommand(name: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.name.toLowerCase() === name.toLowerCase())
}
