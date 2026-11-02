import type { Note } from '../../types'
import { noteNormText, type NoteNormText } from '../../lib/noteSearch'

const STOPWORDS_PT = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
  'para', 'pra', 'por', 'com', 'sem', 'que', 'como', 'mais', 'mas', 'ou', 'se',
  'um', 'uma', 'uns', 'umas', 'ao', 'aos', 'isso', 'isto', 'essa', 'esse',
  'esta', 'este', 'eu', 'ele', 'ela', 'eles', 'elas', 'voce', 'voces',
  'foi', 'ser', 'ter', 'sao', 'tem', 'tinha', 'estava', 'ja', 'so', 'tambem',
  'entao', 'sobre', 'entre', 'ate', 'pelo', 'pela', 'pelos', 'pelas', 'meu',
  'minha', 'seu', 'sua', 'nosso', 'nossa', 'aqui', 'ali', 'la', 'onde', 'quando',
  'the', 'and', 'for', 'with', 'this', 'that', 'are', 'was', 'has', 'have',
])

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>()
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  for (const raw of normalized.split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue
    if (STOPWORDS_PT.has(raw)) continue
    tokens.add(raw)
  }
  return tokens
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersect = 0
  for (const t of a) if (b.has(t)) intersect++
  const union = a.size + b.size - intersect
  return union === 0 ? 0 : intersect / union
}

export interface ScoredNote {
  note: Note
  score: number
}

// Palavras raras na base pesam mais (idf) e a nota menor conta como contida
// na maior (nota curta não perde para nota longa). Valores calibrados com as
// 203 notas de produção (2026-11-02): rever quando a base crescer.
const TAG_WEIGHT = 0.12
// idf(t) = ln(1 + N/df) − IDF_BASE, nunca negativo: palavra em mais de ~1/3,5
// das notas pesa 0.
const IDF_BASE = 1.5
const TITLE_BOOST = 1.5
// Peso mínimo do denominador da contenção (≈ 4 palavras raras): nota minúscula
// não fica "contida" por uma palavra só.
const CONTAIN_FLOOR = 20
const MIN_SHARED = 2
const MIN_SCORE = 0.18

export function extractLinkedNoteIds(content: string): string[] {
  const ids: string[] = []
  const re = /data-note-id="([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    ids.push(match[1])
  }
  return ids
}

interface NoteTokens {
  title: Set<string>
  all: Set<string>
}

// Tokens do título e do título + texto limpo (sem base64, HTML nem sintaxe),
// do cache da busca do Ctrl+P.
const tokensCache = new WeakMap<NoteNormText, NoteTokens>()

function tokensOf(note: Note): NoteTokens {
  const norm = noteNormText(note)
  let tokens = tokensCache.get(norm)
  if (!tokens) {
    const title = tokenize(norm.normTitle)
    tokens = { title, all: new Set([...title, ...tokenize(norm.normText)]) }
    tokensCache.set(norm, tokens)
  }
  return tokens
}

export function scoreRelatedNotes(
  active: Note,
  notes: Note[],
  opts?: { exclude?: Set<string>; topK?: number }
): ScoredNote[] {
  const activeTags = new Set(active.tags)
  const activeTokens = tokensOf(active)
  const activeLinkedIds = new Set(extractLinkedNoteIds(active.content))

  if (activeTags.size === 0 && activeTokens.all.size === 0 && activeLinkedIds.size === 0) {
    return []
  }

  const df = new Map<string, number>()
  for (const note of notes) {
    for (const t of tokensOf(note).all) df.set(t, (df.get(t) ?? 0) + 1)
  }
  const n = notes.length
  const idf = (t: string) => Math.max(0, Math.log(1 + n / (df.get(t) ?? 1)) - IDF_BASE)
  const weight = (tokens: NoteTokens) => {
    let w = 0
    for (const t of tokens.all) w += idf(t) * (tokens.title.has(t) ? TITLE_BOOST : 1)
    return w
  }
  const squares = (tokens: NoteTokens) => {
    let sq = 0
    for (const t of tokens.all) sq += idf(t) ** 2
    return sq
  }
  const activeWeight = weight(activeTokens)
  const activeSquares = squares(activeTokens)

  const scored: ScoredNote[] = []
  for (const note of notes) {
    // Nota sem caderno (Reader) não abre pela lista, como no Ctrl+P.
    if (note.id === active.id || !note.notebookId || opts?.exclude?.has(note.id)) continue

    const noteLinkedIds = new Set(extractLinkedNoteIds(note.content))
    const isLinked = activeLinkedIds.has(note.id) || noteLinkedIds.has(active.id)

    if (isLinked) {
      scored.push({ note, score: 1.0 })
      continue
    }

    const tokens = tokensOf(note)
    let shared = 0
    let sharedSquares = 0
    let sharedCount = 0
    for (const t of activeTokens.all) {
      if (!tokens.all.has(t)) continue
      const w = idf(t)
      shared += w * (activeTokens.title.has(t) || tokens.title.has(t) ? TITLE_BOOST : 1)
      sharedSquares += w ** 2
      sharedCount++
    }
    const contain =
      sharedCount < MIN_SHARED ? 0 : shared / Math.max(Math.min(activeWeight, weight(tokens)), CONTAIN_FLOOR)
    const noteSquares = squares(tokens)
    const cos = activeSquares && noteSquares ? sharedSquares / Math.sqrt(activeSquares * noteSquares) : 0
    const tagsScore = jaccard(activeTags, new Set(note.tags))

    const score = TAG_WEIGHT * tagsScore + (1 - TAG_WEIGHT) * (0.7 * Math.min(1, contain) + 0.3 * cos)
    if (score < MIN_SCORE) continue
    scored.push({ note, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, opts?.topK ?? 5)
}
