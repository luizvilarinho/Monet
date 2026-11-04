import type { AiSource } from '../../types'
import type { RagCandidate } from '../rag'
import type { AgentDef } from './core'

// Responde só pelas fontes do caderno (documentos e outras notas), pela busca
// do chat (reescrita + híbrida + rerank), citando o tipo de cada fonte.

export const DOCS_NOT_FOUND = 'I could not find this information in the notebook documents.'

export const docsAgent: AgentDef = {
  command: {
    name: '/docs',
    description: 'Answer only from the notebook documents and notes, with citations',
    example: '/docs which companies did the person work for?',
    takesQuery: true,
  },
  label: 'Sources',
  complementRules: false,
  behavior: `Role: answer only from the notebook sources.
- Use exclusively the excerpts in "Notebook sources". Ignore the note and your general knowledge.
- Each excerpt is labeled "doc" (a document of the notebook) or "note" (another note of the notebook). End each claim with its source in parentheses, keeping the label: "(doc: <name>)" or "(note: <title>)".
- Answer directly, with no introduction.
- If the excerpts do not contain enough information to answer, respond exactly: "${DOCS_NOT_FOUND}"`,
  context: {
    note: 'none',
    noteMeta: false,
    rag: { pipeline: 'hybrid' },
    web: 'none',
    agenda: null,
    datedNotes: false,
    previousDefinition: false,
  },
}

function sourceKind(c: RagCandidate): 'note' | 'doc' {
  return c.documentId.startsWith('note:') ? 'note' : 'doc'
}

export function formatDocsContext(selected: RagCandidate[]): string {
  const blocks = selected.map((c) => `[${sourceKind(c)}: ${c.title || c.documentName}]\n${c.content}`)
  return `Notebook sources (each excerpt says whether it is a document or another note of this notebook):\n\n${blocks.join('\n\n')}\n\n---`
}

export function docsSources(selected: RagCandidate[]): AiSource[] {
  return selected.map((c) => ({
    documentId: c.documentId,
    documentName: c.title || c.documentName,
    chunkIndex: c.chunkIndex,
    snippet: c.content,
  }))
}
