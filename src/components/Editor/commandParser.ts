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

export interface CommandExecutionDraft {
  cmd: string
  query: string
  lineStart: number
  lineEnd: number
  nextSelection: number
}

const COMMAND_NAMES = COMMANDS.map((command) => command.name)

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
  return COMMAND_NAMES.filter((name) => name.startsWith(normalized))
}

export function buildCommandExecutionDraft(
  text: string,
  selectionStart: number,
  selectionEnd: number
): CommandExecutionDraft | null {
  if (selectionStart !== selectionEnd) return null
  const lineStart = text.lastIndexOf('\n', Math.max(selectionStart - 1, 0)) + 1
  const lineEndCandidate = text.indexOf('\n', selectionStart)
  const lineEnd = lineEndCandidate === -1 ? text.length : lineEndCandidate
  if (selectionStart !== lineEnd) return null
  const line = text.slice(lineStart, lineEnd)
  const parsed = parseCommandLine(line)
  if (!parsed?.definition) return null
  if (parsed.definition.takesQuery && parsed.query.length === 0) return null
  return {
    cmd: parsed.commandName,
    query: parsed.query,
    lineStart,
    lineEnd,
    nextSelection: lineEnd + 1,
  }
}
