import type { Note } from '../types'
import { languageName } from './language'
import { tagKey } from './noteTags'
import { nameKey } from './plan'
import { isTaskBodyNote } from './tasks'

// Perfil de língua: a nota (global, uma só) com o nível do usuário em cada língua e
// como ele quer as explicações. É o que o professor de língua do chat do leitor lê.
// Identificada pela tag `language profile` (chip visível, sobrevive a renomear a
// nota ou trocar o tipo); o título é só a reserva de quem cria à mão. No padrão do
// `radarProfile.ts`: campos "Rótulo: valor".

export const LANGUAGE_PROFILE_TAG = 'language profile'
// Por tagKey, que tira o acento: "perfil de língua" vira "perfil de lingua".
const PROFILE_KEYS = ['language profile', 'perfil de lingua']

export function isLanguageProfileNote(note: Note): boolean {
  return note.tags.some((t) => PROFILE_KEYS.includes(tagKey(t))) || PROFILE_KEYS.includes(nameKey(note.title))
}

// Perfil global: nota ativa com a tag (ou o título), fora das notas-corpo de task e
// dos cadernos com a IA desligada; com várias, a mais recente.
export function findLanguageProfile(notes: Note[], disabledNotebookIds: ReadonlySet<string>): Note | null {
  let best: Note | null = null
  for (const n of notes) {
    if (n.archivedAt || isTaskBodyNote(n) || (n.notebookId && disabledNotebookIds.has(n.notebookId))) continue
    if (!isLanguageProfileNote(n)) continue
    if (!best || n.updatedAt > best.updatedAt) best = n
  }
  return best
}

// "French: B1", "- French: B1", "**French**: B1" e "**French:** B1": o rótulo e o
// valor de uma linha. null = não é uma linha "Rótulo: valor" (ou está sem valor).
function parseField(line: string): { label: string; value: string } | null {
  let text = line.trim().replace(/^[-*]\s+/, '')
  const bold = text.startsWith('**')
  if (bold) text = text.slice(2)
  const m = text.match(/^([^:*]{1,40}?)\s*(\*\*)?\s*:\s*(.*)$/)
  if (!m) return null
  const value = (bold && !m[2] ? m[3].replace(/^\*\*\s*/, '') : m[3]).trim()
  return value ? { label: m[1].trim(), value } : null
}

// Rótulo comparável: sem caixa, sem acento e com o apóstrofo reto ("Don’t" = "Don't").
function labelKey(label: string): string {
  return nameKey(label.replace(/[‘’]/g, "'"))
}

const CEFR_RE = /\b(A1|A2|B1|B2|C1|C2)\b/i
const LEVEL_FALLBACK_CHARS = 40

// O nível do usuário na língua `language` (código): a linha cujo rótulo é o nome da
// língua em inglês ("French") ou o código ("fr", "FR"). O nível é o primeiro token
// CEFR do valor ("B1, rusty" dá "B1"); sem token, as primeiras letras do valor.
// null sem a linha (ou com a linha de outra língua).
export function readProfileLevel(content: string, language: string): string | null {
  if (!language) return null
  const wanted = new Set([labelKey(languageName(language)), labelKey(language)])
  for (const line of content.split('\n')) {
    const field = parseField(line)
    if (!field || !wanted.has(labelKey(field.label))) continue
    const cefr = field.value.match(CEFR_RE)
    return cefr ? cefr[1].toUpperCase() : field.value.slice(0, LEVEL_FALLBACK_CHARS).trim()
  }
  return null
}

// O valor da primeira linha cujo rótulo é um de `labels` ("Explain", "Don't"). null
// sem a linha.
export function readProfileLine(content: string, labels: string[]): string | null {
  const wanted = new Set(labels.map(labelKey))
  for (const line of content.split('\n')) {
    const field = parseField(line)
    if (field && wanted.has(labelKey(field.label))) return field.value.replace(/\s+/g, ' ')
  }
  return null
}

// O conteúdo inicial da nota, com os nomes das línguas em inglês. Uma linha por
// parágrafo (o editor junta linhas seguidas num parágrafo só). Sem língua de
// estudo (`studyLanguage` null: nenhum livro de outra língua), sem a linha do nível.
export function buildLanguageProfileTemplate(native: string, studyLanguage: string | null): string {
  const nativeName = languageName(native)
  return [
    `Native language: ${nativeName}`,
    ...(studyLanguage ? [`${languageName(studyLanguage)}: B1`] : []),
    `Explain: grammar in ${nativeName}, short, with one example from the page.`,
    "Don't: translate whole pages for me. Don't rewrite what I write; point at what to fix.",
  ].join('\n\n')
}
