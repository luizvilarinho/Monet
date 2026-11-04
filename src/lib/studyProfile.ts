import type { Note } from '../types'
import { tagKey } from './noteTags'

// Perfil do estudo (tutor): a nota do caderno com objetivo e nível. É
// identificada pela tag `study profile` (chip visível, sobrevive a renomear a
// nota ou trocar o tipo); o título é só a reserva de quem cria à mão.

export const STUDY_PROFILE_TAG = 'study profile'
const PROFILE_KEYS = ['study profile', 'perfil de estudo', 'perfil do estudo'] // por tagKey

// Título igual a um alias ou alias seguido de espaço, travessão, hífen ou ":".
function isProfileTitle(title: string): boolean {
  const key = tagKey(title)
  return PROFILE_KEYS.some((k) => key === k || (key.startsWith(k) && /^[\s—–:-]/.test(key.slice(k.length))))
}

export function isStudyProfileNote(note: Note): boolean {
  return note.tags.some((t) => PROFILE_KEYS.includes(tagKey(t))) || isProfileTitle(note.title)
}

// Perfil do caderno: nota não arquivada com a tag (ou o título); com várias,
// a mais recente.
export function findStudyProfile(notes: Note[], notebookId: string): Note | null {
  let best: Note | null = null
  for (const n of notes) {
    if (n.notebookId !== notebookId || n.archivedAt || !isStudyProfileNote(n)) continue
    if (!best || n.updatedAt > best.updatedAt) best = n
  }
  return best
}

// Bloco de perfil proposto pelo tutor, pronto para "Save study profile".
export interface ProfileDraft {
  title: string // o rótulo como veio ("Perfil de estudo")
  notebookName: string | null // o que vem depois do travessão
  body: string
}

// "**Study profile — <caderno>**" (ou "Perfil de estudo"/"Perfil do estudo"),
// com o ":" dentro ou fora do negrito.
const HEADER_RE = /^\*\*\s*(study profile|perfil de estudo|perfil do estudo)\s*(?:[—–-]\s*([^*]+?))?\s*:?\s*\*\*\s*:?\s*$/i
// Fim do bloco: cabeçalho markdown ou linha só em negrito (outra seção).
const SECTION_RE = /^(?:#|\*\*[^*]+\*\*\s*$)/
const LIST_RE = /^\s*(?:[-*+]|\d+[.)])\s/

export function extractProfileDraft(markdown: string): ProfileDraft | null {
  const lines = markdown.split('\n')
  const start = lines.findIndex((l) => HEADER_RE.test(l.trim()))
  if (start < 0) return null
  const m = lines[start].trim().match(HEADER_RE)!
  const body: string[] = []
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      if (body.length > 0) break
      continue
    }
    if (SECTION_RE.test(line.trim())) break
    body.push(line.trim())
  }
  if (body.length === 0) return null
  // O editor junta linhas simples num parágrafo (breaks: false): cada linha
  // vira parágrafo, e itens de lista seguidos continuam na mesma lista.
  const text = body
    .map((l, i) => (i === 0 ? l : `${LIST_RE.test(l) && LIST_RE.test(body[i - 1]) ? '\n' : '\n\n'}${l}`))
    .join('')
  return { title: m[1], notebookName: m[2]?.trim() || null, body: text }
}
