import { COMMANDS, findCommand } from '../../lib/commands'

export type CommandLineStatus =
  | 'idle'
  | 'draft'
  | 'valid'
  | 'invalid'
  | 'incomplete'
  | 'executed'

export interface ParsedCommandLine {
  raw: string
  trimmed: string
  commandName: string
  query: string
  isIsolated: boolean
  definition: ReturnType<typeof findCommand>
}

const COMMAND_NAMES = COMMANDS.map((command) => command.name)

export function getToggleTitle(command: string): string {
  const map: Record<string, string> = {
    '/resumir': 'Resumo gerado pela IA',
    '/tabela': 'Tabela gerada pela IA',
    '/definir': 'Definição gerada pela IA',
    '/opiniao': 'Opinião gerada pela IA',
    '/pesquisa': 'Pesquisa gerada pela IA',
    '/quem': 'Perfil gerado pela IA',
    '/aprofundar': 'Aprofundamento gerado pela IA',
    '/explicar': 'Explicação gerada pela IA',
    '/guia': 'Guia de estudos gerado pela IA',
    '/mapa-mental': 'Mapa mental gerado pela IA',
    '/perguntar': 'Resposta gerada pela IA',
  }
  return map[command] ?? 'Resposta gerada pela IA'
}

export function isPotentialCommandLine(line: string): boolean {
  return /^\s*\//.test(line)
}

export function parseCommandLine(line: string): ParsedCommandLine | null {
  if (!isPotentialCommandLine(line)) return null
  const trimmed = line.trim()
  const match = trimmed.match(/^(\/[^\s]+)(?:\s+(.*))?$/)
  if (!match) {
    return {
      raw: line,
      trimmed,
      commandName: trimmed,
      query: '',
      isIsolated: true,
      definition: undefined,
    }
  }
  const commandName = match[1].toLowerCase()
  const query = (match[2] ?? '').trim()
  return {
    raw: line,
    trimmed,
    commandName,
    query,
    isIsolated: true,
    definition: findCommand(commandName),
  }
}

export function getCommandLineStatus(line: string): CommandLineStatus {
  const parsed = parseCommandLine(line)
  if (!parsed) return 'idle'
  if (!parsed.definition) return 'invalid'
  if (parsed.definition.takesQuery && parsed.query.length === 0) return 'incomplete'
  return 'valid'
}

export function getCommandSuggestions(input: string): string[] {
  const normalized = input.trim().toLowerCase()
  if (!normalized.startsWith('/')) return []
  if (normalized === '/') return COMMAND_NAMES
  return COMMAND_NAMES.filter((name) => name.toLowerCase().startsWith(normalized))
}
