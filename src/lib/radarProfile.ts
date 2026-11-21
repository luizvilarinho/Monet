import type { Note } from '../types'
import { tagKey } from './noteTags'
import { nameKey } from './plan'
import { isTaskBodyNote } from './tasks'

// Perfil do Radar: a nota (global, uma só) com o que seguir, as fontes
// preferidas e o que ignorar. É identificada pela tag `radar profile` (chip
// visível, sobrevive a renomear a nota ou trocar o tipo); o título é só a
// reserva de quem cria à mão. No padrão do `studyProfile.ts`.

export const RADAR_PROFILE_TAG = 'radar profile'
const PROFILE_KEYS = ['radar profile', 'perfil do radar', 'perfil de radar'] // por tagKey

export function isRadarProfileNote(note: Note): boolean {
  return note.tags.some((t) => PROFILE_KEYS.includes(tagKey(t))) || PROFILE_KEYS.includes(nameKey(note.title))
}

// Perfil global: nota ativa com a tag (ou o título), fora das notas-corpo de
// task e dos cadernos com a IA desligada; com várias, a mais recente.
export function findRadarProfile(notes: Note[], disabledNotebookIds: Set<string>): Note | null {
  let best: Note | null = null
  for (const n of notes) {
    if (n.archivedAt || isTaskBodyNote(n) || (n.notebookId && disabledNotebookIds.has(n.notebookId))) continue
    if (!isRadarProfileNote(n)) continue
    if (!best || n.updatedAt > best.updatedAt) best = n
  }
  return best
}

// Bloco de perfil proposto pelo Radar, pronto para "Save radar profile".
export interface RadarProfileDraft {
  title: string // o rótulo como veio ("Radar profile")
  body: string
}

// "**Radar profile**" (ou "Perfil do Radar"/"Perfil de radar"), com o ":"
// dentro ou fora do negrito, numa linha própria.
const HEADER_RE = /^\*\*\s*(radar profile|perfil do radar|perfil de radar)\s*:?\s*\*\*\s*:?\s*$/i
const FIELD_RE = /^(follow|sources|ignore|seguir|fontes|ignorar)\s*(\*\*)?\s*:\s*(.*)$/i
const FOLLOW_LABELS = ['follow', 'seguir']
const IGNORE_LABELS = ['ignore', 'ignorar']
const SOURCES_LABELS = ['sources', 'fontes']

// "Follow: a, b" com ou sem "- ", com o negrito no rótulo ("**Follow**: a" ou
// "**Follow:** a"). null = não é uma linha do perfil (ou está sem valor).
function parseField(line: string): { label: string; value: string } | null {
  let text = line.trim().replace(/^[-*]\s+/, '')
  const bold = text.startsWith('**')
  if (bold) text = text.slice(2)
  const m = text.match(FIELD_RE)
  if (!m) return null
  const value = (bold && !m[2] ? m[3].replace(/^\*\*\s*/, '') : m[3]).trim()
  return value ? { label: m[1], value } : null
}

// Os assuntos da linha Follow/Seguir do texto do perfil (separados por vírgula
// ou ponto e vírgula), sem negrito, aspas nem "#".
export function radarFollowTerms(text: string): string[] {
  const terms: string[] = []
  for (const line of text.split('\n')) {
    const field = parseField(line)
    if (!field || !FOLLOW_LABELS.includes(field.label.toLowerCase())) continue
    for (const part of field.value.split(/[,;]/)) {
      const term = part.replace(/^[\s*"“”'‘’«»#]+|[\s*"“”'‘’«»]+$/g, '').replace(/\s+/g, ' ')
      if (term) terms.push(term)
    }
  }
  return terms
}

// "Ignore: nothing yet" é o que a proposta do Radar escreve quando não há o que
// deixar de fora.
const NOTHING_TO_IGNORE_RE = /^(nothing( yet)?|none|nada( ainda)?|nenhum[a]?)\.?$/i

// O que a linha Ignore/Ignorar do texto do perfil manda deixar de fora, em uma
// linha (várias linhas Ignore se juntam com "; "). '' sem a linha ou sem nada a
// ignorar.
export function radarIgnoreText(text: string): string {
  const values: string[] = []
  for (const line of text.split('\n')) {
    const field = parseField(line)
    if (!field || !IGNORE_LABELS.includes(field.label.toLowerCase())) continue
    const value = field.value.replace(/\s+/g, ' ')
    if (!NOTHING_TO_IGNORE_RE.test(value)) values.push(value)
  }
  return values.join('; ')
}

// "Sources: any" é o que a proposta do Radar escreve quando não há fonte preferida.
const NO_PREFERRED_SOURCE_RE = /^(any|anything|none|nothing( yet)?|qualquer( uma)?|nenhum[a]?|nada( ainda)?)\.?$/i

// As fontes que a linha Sources/Fontes do texto do perfil prefere, em uma linha
// (várias linhas Sources se juntam com "; "). '' sem a linha ou sem preferência.
export function radarSourcesText(text: string): string {
  const values: string[] = []
  for (const line of text.split('\n')) {
    const field = parseField(line)
    if (!field || !SOURCES_LABELS.includes(field.label.toLowerCase())) continue
    const value = field.value.replace(/\s+/g, ' ')
    if (!NO_PREFERRED_SOURCE_RE.test(value)) values.push(value)
  }
  return values.join('; ')
}

// As linhas do perfil logo depois do cabeçalho, até a primeira linha vazia que
// vem depois de alguma linha válida. Exige a linha Follow/Seguir com texto.
export function extractRadarProfileDraft(content: string): RadarProfileDraft | null {
  const lines = content.split('\n')
  const start = lines.findIndex((l) => HEADER_RE.test(l.trim()))
  if (start < 0) return null
  const header = lines[start].trim().match(HEADER_RE)!
  const fields: Array<{ label: string; value: string }> = []
  for (const raw of lines.slice(start + 1)) {
    if (!raw.trim()) {
      if (fields.length > 0) break
      continue
    }
    const field = parseField(raw)
    if (field) fields.push(field)
  }
  if (!fields.some((f) => FOLLOW_LABELS.includes(f.label.toLowerCase()))) return null
  return { title: header[1], body: fields.map((f) => `${f.label}: ${f.value}`).join('\n') }
}
