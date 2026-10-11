import { cleanNoteContentForAi, noteDate } from '../../lib/noteFileText'
import type { Note } from '../../types'

// ─── Builder do bloco de contexto das Anotações ─────────────────────────────
// Função pura (sem I/O), espelho de readerContext.ts: monta o bloco EFEMERO
// anexado a cada envio do chat das Anotações (nota aberta + seleção). Os
// orçamentos garantem que o bloco nunca estoura tokens.

const NOTE_TEXT_BUDGET = 8000
const SELECTION_BUDGET = 2000

export interface NotesContextInput {
  notebookName: string
  note: Note | null
  // '' = sem seleção
  selectionText: string
  resolveNoteTitle: (noteId: string) => string | undefined
}

function truncateWithMarker(s: string, budget: number): string {
  if (s.length <= budget) return s
  return s.slice(0, budget) + ' [truncated]'
}

export function buildNotesContext(input: NotesContextInput): string {
  const lines: string[] = []
  lines.push(
    '[Notes context — automatically attached; reflects the note open in the editor at the moment this message was sent. Not visible to the user.]'
  )
  lines.push(`Notebook: "${input.notebookName}"`)

  if (input.note) {
    lines.push(`Current note: "${input.note.title.trim() || 'Untitled'}"`)
    const date = noteDate(input.note)
    if (date) lines.push(`Date: ${date}`)
    const content = cleanNoteContentForAi(input.note.content, input.resolveNoteTitle)
    lines.push(
      `Current note content: ${content ? truncateWithMarker(content, NOTE_TEXT_BUDGET) : '(empty)'}`
    )
  } else {
    lines.push('No note is open.')
  }

  const selection = input.selectionText.trim()
  if (selection) {
    lines.push('')
    lines.push(
      `Selected text in the note: "${truncateWithMarker(selection, SELECTION_BUDGET)}"`
    )
  }

  // Instrução do bloco inserível: vale em todo envio do modo `notes`,
  // independente do system prompt (personalizável) da pasta do caderno.
  lines.push('')
  lines.push(
    'If your reply contains content meant to go into the note (e.g. a list, a summary, a rewritten passage), put only that content, in Markdown, inside a fenced block with the language "note" (```note … ```), keeping explanations outside it. Use a longer fence (````note) if the content has code blocks. Only use it when there is something worth inserting.'
  )

  return lines.join('\n')
}
