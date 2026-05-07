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

const CMD_MARKER_RE = /\s*<!--monet:([a-zA-Z0-9_-]+)-->$/

export function extractCommandId(lineText: string): string | null {
  return lineText.match(CMD_MARKER_RE)?.[1] ?? null
}

export function stripCommandMarker(lineText: string): string {
  return lineText.replace(CMD_MARKER_RE, '')
}

// ── Embedded AI-response blocks ──────────────────────────

export const EMBED_START_RE = /<!--monet-embed:([a-zA-Z0-9_-]+)-->/g
export const EMBED_END_RE = /<!--monet-embed-end:([a-zA-Z0-9_-]+)-->/g

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

export function hasEmbeddedBlock(content: string, commandId: string): boolean {
  const start = `<!--monet-embed:${commandId}-->`
  const end = `<!--monet-embed-end:${commandId}-->`
  return content.includes(start) && content.includes(end)
}

export function insertEmbeddedBlock(
  content: string,
  commandId: string,
  title: string,
  body: string
): string {
  // Find the line that contains the command marker
  const lines = content.split('\n')
  let insertIndex = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`<!--monet:${commandId}-->`)) {
      insertIndex = i + 1
      break
    }
  }
  const block = `<!--monet-embed:${commandId}-->\n> **${title}**\n> \n${body
    .split('\n')
    .map((l) => '> ' + l)
    .join('\n')}\n<!--monet-embed-end:${commandId}-->`
  lines.splice(insertIndex, 0, block)
  return lines.join('\n')
}

export function removeEmbeddedBlock(content: string, commandId: string): string {
  const startMarker = `<!--monet-embed:${commandId}-->`
  const endMarker = `<!--monet-embed-end:${commandId}-->`
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) return content
  const endIdx = content.indexOf(endMarker, startIdx)
  if (endIdx === -1) return content
  const before = content.slice(0, startIdx)
  const after = content.slice(endIdx + endMarker.length)
  // remove one trailing newline if present to keep doc clean
  return (before + after).replace(/\n\n$/, '\n')
}

export function getEmbeddedCommandIds(content: string): Set<string> {
  const ids = new Set<string>()
  let m: RegExpExecArray | null
  EMBED_START_RE.lastIndex = 0
  while ((m = EMBED_START_RE.exec(content)) !== null) {
    ids.add(m[1])
  }
  return ids
}

export function isPotentialCommandLine(line: string): boolean {
  return /^\s*\//.test(line)
}

export function parseCommandLine(line: string): ParsedCommandLine | null {
  const clean = stripCommandMarker(line)
  if (!isPotentialCommandLine(clean)) return null
  const trimmed = clean.trim()
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
