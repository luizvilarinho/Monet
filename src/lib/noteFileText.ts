import type { Note } from '../types'
import { getWeekdayName, parseCalendarTitle } from './calendar'

export const COMMAND_LINE_RE = /^\/[a-zA-Z]/
export const EMBED_BLOCK_RE = /<!--monet-embed:[a-zA-Z0-9_-]+-->[\s\S]*?<!--monet-embed-end:[a-zA-Z0-9_-]+-->/g
export const MARKER_RE = /<!--monet:[a-zA-Z0-9_-]+-->/g

const MD_DATA_IMAGE_RE = /!\[[^\]]*\]\(data:[^)]*\)/g
const HTML_DATA_IMAGE_RE = /<img\b[^>]*\bsrc=["']data:[^"']*["'][^>]*>/gi
const DATA_URL_RE = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi
const LINKED_NOTE_RE = /<linked-note\b[^>]*\bdata-note-id="([^"]*)"[^>]*>\s*<\/linked-note>/g
const REMINDER_CHIP_RE = /<reminder-chip\b[^>]*\bdata-time="([^"]*)"[^>]*>\s*<\/reminder-chip>/g
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

// Texto do arquivo .md espelhado no RAG. Retorna '' para nota sem título e
// sem corpo (o backend remove o documento nesse caso).
export function buildNoteFileText(
  note: Note,
  resolveNoteTitle: (noteId: string) => string | undefined,
): string {
  const title = note.title.trim()
  const body = cleanNoteContentForAi(note.content, resolveNoteTitle)
  if (!title && !body) return ''
  const header = [`# ${title || 'Untitled'}`]
  const date = noteDate(note)
  if (date) header.push(`Date: ${date}`)
  if (note.tags.length > 0) header.push(`Tags: ${note.tags.join(', ')}`)
  return body ? `${header.join('\n')}\n\n${body}` : header.join('\n')
}
