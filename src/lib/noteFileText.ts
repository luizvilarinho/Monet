import type { AiResponse, Note, Task, TaskStatusDef } from '../types'
import { storage } from '../storage'
import { getToggleTitle } from '../components/Editor/commandParser'
import { dateKeyFromMs, getWeekdayName, parseCalendarTitle } from './calendar'
import { markTagsToAiText } from './noteMarks'
import {
  checklistProgress,
  describeRecurrence,
  isDone,
  openStatuses,
  planDate,
  statusName,
  type ChecklistProgress,
  type TodosProgress,
} from './tasks'

export const COMMAND_LINE_RE = /^\/[a-zA-Z]/
export const EMBED_BLOCK_RE = /<!--monet-embed:[a-zA-Z0-9_-]+-->[\s\S]*?<!--monet-embed-end:[a-zA-Z0-9_-]+-->/g
export const MARKER_RE = /<!--monet:[a-zA-Z0-9_-]+-->/g

const MD_DATA_IMAGE_RE = /!\[[^\]]*\]\((data:[^)]*)\)/g
const HTML_DATA_IMAGE_RE = /<img\b[^>]*\bsrc=["'](data:[^"']*)["'][^>]*>/gi
export const DATA_URL_RE = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi
const LINKED_NOTE_RE = /<linked-note\b[^>]*\bdata-note-id="([^"]*)"[^>]*>\s*<\/linked-note>/g
const EMBED_TAG_RE = /<embed-block\b[^>]*\bdata-cmd="([^"]*)"[^>]*>\s*<\/embed-block>/g
const REMINDER_CHIP_RE = /<reminder-chip\b[^>]*\bdata-time="([^"]*)"[^>]*>\s*<\/reminder-chip>/g
// O [ ]/[x] do item pode estar defasado: o status real vive na task vinculada.
const TASK_REF_RE = /<task-ref\b[^>]*>\s*<\/task-ref>/g
// Bloco `/tasks`: só o filtro vive no conteúdo (a lista é renderizada ao vivo).
const TASKS_QUERY_RE = /<tasks-query\b[^>]*\bdata-filter="([^"]*)"[^>]*>\s*<\/tasks-query>/g
const TOGGLE_START = '<div data-type="toggle-block"'
const DIV_TAG_RE = /<div\b|<\/div>/g
const EMBED_ID_RE = /<embed-block\b[^>]*\bdata-cmd="([^"]*)"/g
const LINKED_NOTE_ID_RE = /<linked-note\b[^>]*\bdata-note-id="([^"]*)"/g
const BR_RE = /<br\s*\/?>/gi
const LINKED_NOTE_BUDGET = 2000
const IMAGE_TEXT_BUDGET = 2000
// Marcador do texto de OCR, trocado só no fim: o texto pode conter "<div" e
// quebraria o parse dos toggles.
const IMAGE_SLOT_RE = /\uE000(\d+)\uE001/g
const TEXT_BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'])

export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

export interface NoteAiTextOptions {
  resolveNoteTitle: (noteId: string) => string | undefined
  // commandId → resposta salva; ausente/undefined = bloco ignorado.
  resolveEmbed?: (commandId: string) => AiResponse | undefined
  // Presente = expande as notas linkadas (1 nível); ausente = só o título (RAG).
  resolveLinkedNoteContent?: (noteId: string) => string | undefined
  // dataUrl → texto do OCR (RAG e contexto efêmero); ausente ou vazio = "[image]".
  resolveImageText?: (dataUrl: string) => string | undefined
}

// Troca cada toggle de topo pelo texto do walker. O fim do toggle é achado
// contando a profundidade de <div>, porque o taskItem gera <div> interno.
function replaceToggleBlocks(text: string, render: (el: Element) => string): string {
  let out = ''
  let pos = 0
  for (;;) {
    const start = text.indexOf(TOGGLE_START, pos)
    if (start === -1) break
    let end = text.length
    let depth = 0
    DIV_TAG_RE.lastIndex = start
    for (let m = DIV_TAG_RE.exec(text); m; m = DIV_TAG_RE.exec(text)) {
      depth += m[0] === '</div>' ? -1 : 1
      if (depth === 0) {
        end = m.index + m[0].length
        break
      }
    }
    const template = document.createElement('template')
    template.innerHTML = text.slice(start, end)
    out += text.slice(pos, start) + Array.from(template.content.children).map(render).join('\n')
    pos = end
  }
  return out + text.slice(pos)
}

// Variante de cleanContent (scoreNotes.ts) que preserva as quebras de linha,
// porque o chunking do backend divide por parágrafos ("\n\n"). Remove base64 e
// converte os blocos customizados do editor em texto legível para a IA:
// respostas da IA embutidas, conteúdo dos toggles, notas linkadas e marcas
// (`==texto== [mark: Rótulo]`, também dentro dos toggles).
export function cleanNoteContentForAi(content: string, opts: NoteAiTextOptions): string {
  const { resolveNoteTitle, resolveEmbed, resolveLinkedNoteContent, resolveImageText } = opts

  const imageTexts: string[] = []
  const imageText = (dataUrl: string | null): string => {
    const text = dataUrl ? resolveImageText?.(dataUrl)?.replace(/\s+/g, ' ').trim() : undefined
    if (!text) return '[image]'
    imageTexts.push(`[image: ${text.slice(0, IMAGE_TEXT_BUDGET)}]`)
    return `\uE000${imageTexts.length - 1}\uE001`
  }

  const embedResponseText = (commandId: string): string => {
    const r = resolveEmbed?.(commandId)
    if (!r || r.status === 'error' || !r.response.trim()) return ''
    return `${getToggleTitle(r.command)}\n${r.response.trim()}`
  }

  const linkedNoteText = (noteId: string): string => {
    const title = resolveNoteTitle(noteId)?.trim() || 'untitled'
    if (!resolveLinkedNoteContent) return `[Linked note: ${title}]`
    const linked = resolveLinkedNoteContent(noteId)
    if (linked === undefined) return ''
    // Sem resolveLinkedNoteContent na recursão: 1 nível só, o que evita ciclos.
    let body = cleanNoteContentForAi(linked, { resolveNoteTitle, resolveEmbed })
    if (body.length > LINKED_NOTE_BUDGET) body = `${body.slice(0, LINKED_NOTE_BUDGET)} [truncated]`
    return body ? `[Linked note: ${title}]\n${body}\n[/Linked note]` : `[Linked note: ${title}]`
  }

  const nodeToAiText = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const tag = el.tagName
    const children = () => Array.from(el.childNodes).map(nodeToAiText).join('')
    if (tag === 'TOGGLE-BLOCK' || (tag === 'DIV' && el.getAttribute('data-type') === 'toggle-block')) {
      return `${el.getAttribute('data-title') ?? ''}\n${children()}\n`
    }
    if (TEXT_BLOCK_TAGS.has(tag)) return `${children()}\n`
    if (tag === 'BR') return '\n'
    if (tag === 'LI') {
      const prefix =
        el.getAttribute('data-type') === 'taskItem'
          ? el.getAttribute('data-checked') === 'true' ? '- [x] ' : '- [ ] '
          : '- '
      return `${prefix}${children().trim()}\n`
    }
    if (tag === 'LABEL') return ''
    if (tag === 'EMBED-BLOCK') return `${embedResponseText(el.getAttribute('data-cmd') ?? '')}\n`
    if (tag === 'LINKED-NOTE') return `${linkedNoteText(el.getAttribute('data-note-id') ?? '')}\n`
    if (tag === 'TASK-REF') return '[task]'
    if (tag === 'REMINDER-CHIP') return `⏰ ${el.getAttribute('data-time') ?? ''}`
    if (tag === 'TASKS-QUERY') return `[Tasks block: ${el.getAttribute('data-filter') ?? ''}]\n`
    if (tag === 'IMG') return imageText(el.getAttribute('src'))
    return children()
  }

  const toggleText = (el: Element) => nodeToAiText(el).replace(/\n{2,}/g, '\n').trim()

  return replaceToggleBlocks(
    markTagsToAiText(content)
      .replace(EMBED_BLOCK_RE, '')
      .replace(MARKER_RE, '')
      .replace(MD_DATA_IMAGE_RE, (_, url: string) => imageText(url))
      .replace(HTML_DATA_IMAGE_RE, (_, url: string) => imageText(url))
      .replace(DATA_URL_RE, (url) => imageText(url)),
    toggleText,
  )
    .replace(REMINDER_CHIP_RE, (_, time: string) => `⏰ ${time}`)
    .replace(TASK_REF_RE, '[task]')
    .replace(TASKS_QUERY_RE, (_, filter: string) => `[Tasks block: ${decodeEntities(filter)}]`)
    // Blocos de topo por último, para o texto inserido não ser reprocessado.
    .replace(EMBED_TAG_RE, (_, id: string) => embedResponseText(id))
    .replace(LINKED_NOTE_RE, (_, id: string) => linkedNoteText(id))
    .replace(BR_RE, '\n')
    .split('\n')
    .filter((l) => !COMMAND_LINE_RE.test(l.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(IMAGE_SLOT_RE, (_, i: string) => imageTexts[Number(i)])
}

function collectIds(content: string, re: RegExp): string[] {
  return Array.from(content.matchAll(re), (m) => m[1]).filter(Boolean)
}

// Ids das notas linkadas citadas no conteúdo (o título delas vem do índice).
export function collectLinkedNoteIds(content: string): string[] {
  return collectIds(content, LINKED_NOTE_ID_RE)
}

// Busca no storage as respostas da IA embutidas nos conteúdos (e nas notas
// linkadas, 1 nível, quando o resolver vem). Em erro, a IA segue sem elas.
export async function loadEmbedResponses(
  contents: string[],
  resolveLinkedNoteContent?: (noteId: string) => string | undefined,
): Promise<Map<string, AiResponse>> {
  const all = [...contents]
  if (resolveLinkedNoteContent) {
    for (const c of contents) {
      for (const id of collectIds(c, LINKED_NOTE_ID_RE)) {
        const linked = resolveLinkedNoteContent(id)
        if (linked !== undefined) all.push(linked)
      }
    }
  }
  const ids = [...new Set(all.flatMap((c) => collectIds(c, EMBED_ID_RE)))]
  if (ids.length === 0) return new Map()
  try {
    const responses = await storage.getResponsesByIds(ids)
    return new Map(responses.map((r) => [r.id, r]))
  } catch (err) {
    console.warn('[Monet AI] Failed to load embedded responses', err)
    return new Map()
  }
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
  statuses: TaskStatusDef[],
  todosArchived: boolean,
): string[] {
  const lines = [
    `Project: ${projectName}`,
    `Status: ${statusName(task.status, statuses)}`,
    `Do date: ${task.scheduledDate ?? 'none'}`,
    `Deadline: ${task.dueDate ?? 'none'}`,
    `Created: ${dateKeyFromMs(task.createdAt)}`,
  ]
  const todos = task.parentNoteId ? resolveNoteTitle(task.parentNoteId) : undefined
  if (todos !== undefined) {
    const archived = todosArchived ? ' (archived)' : ''
    lines.splice(1, 0, `TODOS (deliverable note): ${todos.trim() || 'Untitled'}${archived}`)
  }
  if (task.important) lines.push('Important: yes')
  if (task.recurrence) lines.push(`Repeats: ${describeRecurrence(task.recurrence)}`)
  if (task.rescheduleCount > 0) lines.push(`Postponed: ${task.rescheduleCount}x`)
  if (checklist) lines.push(`Checklist: ${checklist.done}/${checklist.total} done`)
  if (isDone(task) && task.completedAt !== null) {
    lines.push(`Completed: ${dateKeyFromMs(task.completedAt)}`)
  }
  const source = task.sourceNoteId ? resolveNoteTitle(task.sourceNoteId)?.trim() : undefined
  if (source) lines.push(`Source note: ${source}`)
  return lines
}

// Texto do arquivo .md espelhado no RAG. Retorna '' para nota sem título e
// sem corpo (o backend remove o documento nesse caso). Nota-corpo de task
// recebe os metadados da task logo abaixo do título; nota com tipo, o tipo e
// as propriedades com valor entre `Date:` e `Tags:` (a TODOS, também o
// progresso das tasks dela) e, por último, `Archived:` na nota arquivada.
// Notas linkadas entram só com o título: elas já são indexadas sozinhas.
export function buildNoteFileText(
  note: Note,
  resolveNoteTitle: (noteId: string) => string | undefined,
  taskContext?: { task: Task; projectName: string; statuses: TaskStatusDef[]; todosArchived: boolean },
  resolveEmbed?: (commandId: string) => AiResponse | undefined,
  resolveImageText?: (dataUrl: string) => string | undefined,
  typeContext?: { typeName: string; properties: Array<{ name: string; value: string }> },
  todosProgress?: TodosProgress,
): string {
  const title = note.title.trim()
  const body = cleanNoteContentForAi(note.content, { resolveNoteTitle, resolveEmbed, resolveImageText })
  if (!title && !body && !taskContext) return ''
  const header = [`# ${title || 'Untitled'}`]
  if (taskContext) {
    header.push(
      ...taskMetadataLines(
        taskContext.task,
        taskContext.projectName,
        resolveNoteTitle,
        checklistProgress(note.content),
        taskContext.statuses,
        taskContext.todosArchived,
      ),
    )
  }
  const date = noteDate(note)
  if (date) header.push(`Date: ${date}`)
  if (typeContext) {
    header.push(`Type: ${typeContext.typeName}`)
    for (const p of typeContext.properties) header.push(`${p.name}: ${p.value}`)
  }
  if (todosProgress) {
    const next = todosProgress.nextDeadline ? ` · next deadline ${todosProgress.nextDeadline}` : ''
    header.push(`Tasks: ${todosProgress.done}/${todosProgress.total} done${next}`)
  }
  if (note.tags.length > 0) header.push(`Tags: ${note.tags.join(', ')}`)
  if (note.archivedAt) header.push(`Archived: ${dateKeyFromMs(note.archivedAt)}`)
  return body ? `${header.join('\n')}\n\n${body}` : header.join('\n')
}

// Documento-resumo das tasks de um caderno-projeto, agrupado por status, para
// perguntas de agregação ("o que está pendente no projeto X?").
export function buildTasksSummaryText(
  projectName: string,
  tasks: Task[],
  resolveNoteTitle: (noteId: string) => string | undefined,
  // Progresso do checklist da nota-corpo da task.
  checklistOf: (task: Task) => ChecklistProgress | null,
  statuses: TaskStatusDef[],
  // TODOS arquivada: `(archived)` na linha da TODOS.
  isNoteArchived: (noteId: string) => boolean,
): string {
  const sections = [`# Tasks — ${projectName}\nAll tasks of the project "${projectName}", grouped by status.`]
  // Abertos na ordem do registro (doing antes de todo), depois done/dropped;
  // status fora do registro entra como aberto, com o id como nome.
  const known = new Set(statuses.map((s) => s.id))
  const orphans = [...new Set(tasks.map((t) => t.status))].filter((id) => !known.has(id))
  const open = openStatuses(statuses).map((s) => s.id)
  const order = ['doing', ...open.filter((id) => id !== 'doing'), ...orphans, 'done', 'dropped']
  for (const status of order) {
    const group = tasks
      .filter((t) => t.status === status)
      .sort(
        (a, b) =>
          (planDate(a) ?? '9999').localeCompare(planDate(b) ?? '9999') || a.sortOrder - b.sortOrder,
      )
    if (group.length === 0) continue
    sections.push(`## ${statusName(status, statuses)} (${group.length})`)
    for (const t of group) {
      const lines = [
        `### ${t.title.trim() || 'Untitled'}`,
        ...taskMetadataLines(
          t,
          projectName,
          resolveNoteTitle,
          checklistOf(t),
          statuses,
          !!t.parentNoteId && isNoteArchived(t.parentNoteId),
        ),
      ]
      sections.push(lines.join('\n'))
    }
  }
  return sections.join('\n\n')
}
