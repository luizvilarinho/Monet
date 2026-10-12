import type { Note, Task } from '../types'
import { dateKeyFromMs, getWeekdayName, parseCalendarTitle } from './calendar'
import {
  checklistProgress,
  describeRecurrence,
  planDate,
  TASK_STATUS_LABEL,
  type ChecklistProgress,
} from './tasks'

export const COMMAND_LINE_RE = /^\/[a-zA-Z]/
export const EMBED_BLOCK_RE = /<!--monet-embed:[a-zA-Z0-9_-]+-->[\s\S]*?<!--monet-embed-end:[a-zA-Z0-9_-]+-->/g
export const MARKER_RE = /<!--monet:[a-zA-Z0-9_-]+-->/g

const MD_DATA_IMAGE_RE = /!\[[^\]]*\]\(data:[^)]*\)/g
const HTML_DATA_IMAGE_RE = /<img\b[^>]*\bsrc=["']data:[^"']*["'][^>]*>/gi
const DATA_URL_RE = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi
const LINKED_NOTE_RE = /<linked-note\b[^>]*\bdata-note-id="([^"]*)"[^>]*>\s*<\/linked-note>/g
const REMINDER_CHIP_RE = /<reminder-chip\b[^>]*\bdata-time="([^"]*)"[^>]*>\s*<\/reminder-chip>/g
// O [ ]/[x] do item pode estar defasado: o status real vive na task vinculada.
const TASK_REF_RE = /<task-ref\b[^>]*>\s*<\/task-ref>/g
// Bloco `/tasks`: só o filtro vive no conteúdo (a lista é renderizada ao vivo).
const TASKS_QUERY_RE = /<tasks-query\b[^>]*\bdata-filter="([^"]*)"[^>]*>\s*<\/tasks-query>/g
const TOGGLE_BLOCK_RE = /<div data-type="toggle-block"[^>]*\bdata-title="([^"]*)"[^>]*>([\s\S]*?)<\/div>/g
const BR_RE = /<br\s*\/?>/gi
const BLOCK_END_RE = /<\/(p|li|h[1-6]|blockquote|pre)>/gi
const TAG_RE = /<[^>]+>/g

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

// Variante de cleanContent (scoreNotes.ts) que preserva as quebras de linha,
// porque o chunking do backend divide por parágrafos ("\n\n"). Remove base64 e
// converte as tags customizadas do editor em texto legível para a IA.
export function cleanNoteContentForAi(
  content: string,
  resolveNoteTitle: (noteId: string) => string | undefined,
): string {
  return content
    .replace(EMBED_BLOCK_RE, '')
    .replace(MARKER_RE, '')
    .replace(MD_DATA_IMAGE_RE, '[image]')
    .replace(HTML_DATA_IMAGE_RE, '[image]')
    .replace(DATA_URL_RE, '[image]')
    .replace(LINKED_NOTE_RE, (_, id: string) => `[Linked note: ${resolveNoteTitle(id)?.trim() || 'untitled'}]`)
    .replace(REMINDER_CHIP_RE, (_, time: string) => `⏰ ${time}`)
    .replace(TASK_REF_RE, '[task]')
    .replace(TASKS_QUERY_RE, (_, filter: string) => `[Tasks block: ${decodeEntities(filter)}]`)
    .replace(TOGGLE_BLOCK_RE, (_, title: string, inner: string) => {
      const text = inner.replace(BR_RE, '\n').replace(BLOCK_END_RE, '\n').replace(TAG_RE, '')
      return `${decodeEntities(title)}\n${decodeEntities(text).trim()}`
    })
    .replace(BR_RE, '\n')
    .split('\n')
    .filter((l) => !COMMAND_LINE_RE.test(l.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function noteDate(note: Note): string | null {
  if (note.date) {
    const [y, m, d] = note.date.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    if (!Number.isNaN(date.getTime())) return `${note.date} (${getWeekdayName(date)})`
  }
  const parsed = parseCalendarTitle(note.title)
  if (!parsed) return null
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d} (${getWeekdayName(parsed)})`
}

// Metadados de uma task para a IA, um por linha (Project, Status, Do date,
// Deadline primeiro).
function taskMetadataLines(
  task: Task,
  projectName: string,
  resolveNoteTitle: (noteId: string) => string | undefined,
  checklist: ChecklistProgress | null,
): string[] {
  const lines = [
    `Project: ${projectName}`,
    `Status: ${TASK_STATUS_LABEL[task.status]}`,
    `Do date: ${task.scheduledDate ?? 'none'}`,
    `Deadline: ${task.dueDate ?? 'none'}`,
    `Created: ${dateKeyFromMs(task.createdAt)}`,
  ]
  if (task.group) lines.splice(1, 0, `Group: ${task.group}`)
  if (task.important) lines.push('Important: yes')
  if (task.recurrence) lines.push(`Repeats: ${describeRecurrence(task.recurrence)}`)
  if (task.rescheduleCount > 0) lines.push(`Postponed: ${task.rescheduleCount}x`)
  if (checklist) lines.push(`Checklist: ${checklist.done}/${checklist.total} done`)
  if (task.status === 'done' && task.completedAt !== null) {
    lines.push(`Completed: ${dateKeyFromMs(task.completedAt)}`)
  }
  const source = task.sourceNoteId ? resolveNoteTitle(task.sourceNoteId)?.trim() : undefined
  if (source) lines.push(`Source note: ${source}`)
  return lines
}

// Texto do arquivo .md espelhado no RAG. Retorna '' para nota sem título e
// sem corpo (o backend remove o documento nesse caso). Nota-corpo de task
// recebe os metadados da task logo abaixo do título.
export function buildNoteFileText(
  note: Note,
  resolveNoteTitle: (noteId: string) => string | undefined,
  taskContext?: { task: Task; projectName: string },
): string {
  const title = note.title.trim()
  const body = cleanNoteContentForAi(note.content, resolveNoteTitle)
  if (!title && !body && !taskContext) return ''
  const header = [`# ${title || 'Untitled'}`]
  if (taskContext) {
    header.push(
      ...taskMetadataLines(
        taskContext.task,
        taskContext.projectName,
        resolveNoteTitle,
        checklistProgress(note.content),
      ),
    )
  }
  const date = noteDate(note)
  if (date) header.push(`Date: ${date}`)
  if (note.tags.length > 0) header.push(`Tags: ${note.tags.join(', ')}`)
  return body ? `${header.join('\n')}\n\n${body}` : header.join('\n')
}

const SUMMARY_STATUS_ORDER: Task['status'][] = ['doing', 'todo', 'done', 'dropped']

// Documento-resumo das tasks de um caderno-projeto, agrupado por status, para
// perguntas de agregação ("o que está pendente no projeto X?").
export function buildTasksSummaryText(
  projectName: string,
  tasks: Task[],
  resolveNoteTitle: (noteId: string) => string | undefined,
  // Progresso do checklist da nota-corpo da task.
  checklistOf: (task: Task) => ChecklistProgress | null,
): string {
  const sections = [`# Tasks — ${projectName}\nAll tasks of the project "${projectName}", grouped by status.`]
  for (const status of SUMMARY_STATUS_ORDER) {
    const group = tasks
      .filter((t) => t.status === status)
      .sort(
        (a, b) =>
          (planDate(a) ?? '9999').localeCompare(planDate(b) ?? '9999') || a.sortOrder - b.sortOrder,
      )
    if (group.length === 0) continue
    sections.push(`## ${TASK_STATUS_LABEL[status]} (${group.length})`)
    for (const t of group) {
      const lines = [`### ${t.title.trim() || 'Untitled'}`, ...taskMetadataLines(t, projectName, resolveNoteTitle, checklistOf(t))]
      sections.push(lines.join('\n'))
    }
  }
  return sections.join('\n\n')
}
