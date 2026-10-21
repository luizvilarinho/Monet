import { cleanNoteContentForAi, noteDate } from '../../lib/noteFileText'
import { isOpen, taskLineForAi, type ChecklistProgress } from '../../lib/tasks'
import type { AiResponse, Note, Task, TaskStatusDef } from '../../types'

// ─── Builder do bloco de contexto das Anotações ─────────────────────────────
// Função pura (sem I/O), espelho de readerContext.ts: monta o bloco EFEMERO
// anexado a cada envio do chat das Anotações (nota aberta + seleção). Os
// orçamentos garantem que o bloco nunca estoura tokens.

const NOTE_TEXT_BUDGET = 8000
const SELECTION_BUDGET = 2000
const PROJECT_TASKS_LIMIT = 100

export interface NotesContextInput {
  notebookName: string
  note: Note | null
  // '' = sem seleção
  selectionText: string
  resolveNoteTitle: (noteId: string) => string | undefined
  // Conteúdo das notas linkadas (expandidas 1 nível no contexto).
  resolveLinkedNoteContent: (noteId: string) => string | undefined
  // Respostas da IA embutidas na nota (e nas linkadas).
  resolveEmbed: (commandId: string) => AiResponse | undefined
  // dataUrl → texto do OCR das imagens da nota (resolvido antes do envio).
  resolveImageText?: (dataUrl: string) => string | undefined
  // Tasks do caderno (abertas + concluídas na semana), já filtradas pela
  // visibilidade de IA do caderno.
  projectTasks?: Task[]
  todayKey: string
  // Progresso do checklist da nota-corpo de cada task.
  checklist: Map<string, ChecklistProgress>
  // Registro de status (nome dos status custom nas linhas das tasks).
  statuses: TaskStatusDef[]
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
    const content = cleanNoteContentForAi(input.note.content, {
      resolveNoteTitle: input.resolveNoteTitle,
      resolveEmbed: input.resolveEmbed,
      resolveLinkedNoteContent: input.resolveLinkedNoteContent,
      resolveImageText: input.resolveImageText,
    })
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

  const projectTasks = input.projectTasks ?? []
  if (projectTasks.length > 0) {
    lines.push('')
    const open = projectTasks.filter(isOpen).length
    lines.push(
      `Tasks of this notebook (${open} open, ${projectTasks.length - open} done this week; today is ${input.todayKey}; "do" = planned date, "deadline" = delivery date):`
    )
    for (const t of projectTasks.slice(0, PROJECT_TASKS_LIMIT)) {
      lines.push(
        taskLineForAi(
          t,
          input.todayKey,
          null,
          input.checklist.get(t.id) ?? null,
          input.statuses,
          t.parentNoteId ? input.resolveNoteTitle(t.parentNoteId) ?? null : null
        )
      )
    }
    if (projectTasks.length > PROJECT_TASKS_LIMIT) lines.push('- [truncated]')
  }

  // Instrução do bloco inserível: vale em todo envio do modo `notes`,
  // independente do system prompt (personalizável) da pasta do caderno.
  lines.push('')
  lines.push(
    'If your reply contains content meant to go into the note (e.g. a list, a summary, a rewritten passage), put only that content, in Markdown, inside a fenced block with the language "note" (```note … ```), keeping explanations outside it. Use a longer fence (````note) if the content has code blocks. Only use it when there is something worth inserting.'
  )

  return lines.join('\n')
}
