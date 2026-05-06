import type { Note } from '../../types'

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

const COMMAND_LINE_RE = /^\/[a-zA-Z]/
const EMBED_BLOCK_RE = /<!--monet-embed:[a-zA-Z0-9_-]+-->[\s\S]*?<!--monet-embed-end:[a-zA-Z0-9_-]+-->/g
const MARKER_RE = /<!--monet:[a-zA-Z0-9_-]+-->/g

export function cleanContent(content: string): string {
  return content
    .replace(EMBED_BLOCK_RE, '')
    .replace(MARKER_RE, '')
    .split('\n')
    .filter((l) => !COMMAND_LINE_RE.test(l.trim()))
    .join(' ')
}

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

const TAG_WEIGHT = 0.45
const TITLE_WEIGHT = 0.25
const CONTENT_WEIGHT = 0.30
const MIN_SCORE = 0.04

export function scoreRelatedNotes(active: Note, notes: Note[], topK = 5): ScoredNote[] {
  const activeTags = new Set(active.tags)
  const activeTitle = tokenize(active.title)
  const activeContent = tokenize(cleanContent(active.content))

  if (activeTags.size === 0 && activeTitle.size === 0 && activeContent.size === 0) {
    return []
  }

  const scored: ScoredNote[] = []
  for (const note of notes) {
    if (note.id === active.id) continue

    const tagsScore = jaccard(activeTags, new Set(note.tags))
    const titleScore = jaccard(activeTitle, tokenize(note.title))
    const contentScore = jaccard(activeContent, tokenize(cleanContent(note.content)))

    const score =
      tagsScore * TAG_WEIGHT +
      titleScore * TITLE_WEIGHT +
      contentScore * CONTENT_WEIGHT
    if (score < MIN_SCORE) continue
    scored.push({ note, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
