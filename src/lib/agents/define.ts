import type { AiResponse } from '../../types'
import { dateKeyFromMs } from '../calendar'
import type { AgentDef } from './core'

// Glossarista: definição curta do termo no sentido da nota, consistente com a
// definição anterior do mesmo termo (memória em `ai_responses`).

export const defineAgent: AgentDef = {
  command: {
    name: '/define',
    description: 'Short definition of a term, consistent with earlier ones',
    example: '/define RAG',
    takesQuery: true,
  },
  label: 'Glossary',
  complementRules: false,
  behavior: `Role: glossarist. Make one technical term understandable in a few lines, in the sense it has in the user's note.
- The Parameter is the term. Use the "Notebook" name and the "Note excerpt" only to choose the right sense. Do not explain the note's topic and do not complement the note.
- Output: at most about 60 words. One sentence with the definition. Optionally one more line: "In the note:" connecting the term to the excerpt, or one short example. No headings and no tables.
- Two terms (e.g. "A and B"): one short definition for each, then one line with the difference.
- A request for an explanation (e.g. "the levels of X with examples"): still short. The concept in one sentence, then each item in one line.
- If a "Previous definition" is given, stay consistent with it (refine it only if it is wrong) and end with one line saying where it was also defined, with the note title and date given. Skip that line when it says "this same note".
- If the sense is ambiguous, assume the one that fits the note and state the assumption in a few words.`,
  context: {
    note: 'termSnippet',
    noteMeta: true,
    rag: null,
    web: 'none',
    agenda: null,
    datedNotes: false,
    previousDefinition: true,
  },
}

// Nome atual e o antigo em PT: as definições antigas também contam.
export const DEFINE_COMMANDS = ['/define', '/definir']

const SNIPPET_RADIUS = 300
const SNIPPET_HEAD = 600
const PREVIOUS_MAX_CHARS = 800

function normalizeTerm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// 1ª resposta (as linhas chegam da mais nova para a mais antiga) com o mesmo
// termo normalizado e texto não vazio. Igualdade exata: sem plural nem trecho.
export function findPreviousDefinition(term: string, rows: AiResponse[]): AiResponse | undefined {
  const key = normalizeTerm(term)
  if (!key) return undefined
  return rows.find((r) => normalizeTerm(r.query) === key && r.response.trim() !== '')
}

// Trecho em volta da 1ª ocorrência do termo; sem ocorrência, o começo da nota.
export function termSnippet(text: string, term: string): string {
  const needle = term.trim().toLowerCase()
  const at = needle ? text.toLowerCase().indexOf(needle) : -1
  if (at === -1) return text.slice(0, SNIPPET_HEAD)
  const start = Math.max(0, at - SNIPPET_RADIUS)
  const end = Math.min(text.length, at + needle.length + SNIPPET_RADIUS)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

// `where`: 'this same note', 'note "<título>"' ou 'a deleted note'.
export function formatPreviousDefinition(r: AiResponse, where: string): string {
  const body = r.response.trim()
  const text = body.length > PREVIOUS_MAX_CHARS ? `${body.slice(0, PREVIOUS_MAX_CHARS)} [truncated]` : body
  return `Previous definition of "${r.query.trim()}" (in ${where}, ${dateKeyFromMs(r.createdAt)}):\n${text}`
}
