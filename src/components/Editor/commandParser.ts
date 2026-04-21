import { COMMANDS } from '../../lib/commands'

export interface ParsedCommand {
  cmd: string
  query: string
  line: string
}

export function parseCommandLine(line: string): ParsedCommand | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('/')) return null
  const [cmd, ...rest] = trimmed.split(' ')
  if (!COMMANDS.some((c) => c.name === cmd)) return null
  return { cmd, query: rest.join(' ').trim(), line: trimmed }
}
