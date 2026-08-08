import type { BookHighlight } from '../../types'

// ─── Builder do bloco de contexto de leitura ────────────────────────────────
// Função pura (sem I/O): monta o bloco EFEMERO anexado a cada envio do chat
// do leitor. Orçamentos garantem que o bloco nunca estoura tokens; seções
// vazias (sem grifos) são omitidas.

const PAGE_TEXT_BUDGET = 6000
const MAX_HIGHLIGHTS = 10
const ITEM_TEXT_BUDGET = 300

export interface ReaderContextInput {
  bookTitle: string
  bookAuthor: string | null
  pageNum: number
  totalPages: number
  // null/'' = sem text layer (PDF escaneado)
  pageText: string | null
  // Como vêm do estado do Reader (todas as páginas, ordem indefinida)
  highlights: BookHighlight[]
  // Rótulo da posição atual, montado por cada formato. Ausente = PDF
  // ("page N of M"). O leitor de EPUB passa capítulo/% + location.
  positionLabel?: string
  // Rótulo de posição de cada grifo. Ausente = PDF ("p. N"); o EPUB passa o
  // percentual da location do grifo.
  highlightLabel?: (h: BookHighlight) => string
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function truncateWithMarker(s: string, budget: number): string {
  if (s.length <= budget) return s
  return s.slice(0, budget) + ' [truncated]'
}

function formatDate(ms: number): string {
  try {
    return new Date(ms).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

export function buildReaderContext(input: ReaderContextInput): string {
  const lines: string[] = []
  lines.push(
    "[Reading context — automatically attached; reflects the user's reading session at the moment this message was sent. Not visible to the user.]"
  )
  lines.push(
    `Book: "${input.bookTitle}"${input.bookAuthor ? ` by ${input.bookAuthor}` : ''}`
  )
  lines.push(
    `Position: ${input.positionLabel ?? `page ${input.pageNum} of ${input.totalPages}`}`
  )
  lines.push('')

  const pageText = normalizeWhitespace(input.pageText ?? '')
  if (pageText) {
    lines.push(`Current page text: ${truncateWithMarker(pageText, PAGE_TEXT_BUDGET)}`)
  } else {
    lines.push(
      'Current page text: unavailable (this page has no extractable text — likely a scanned PDF).'
    )
  }

  if (input.highlights.length > 0) {
    const ordered = [...input.highlights].sort((a, b) => b.createdAt - a.createdAt)
    const shown = ordered.slice(0, MAX_HIGHLIGHTS)
    lines.push('')
    lines.push(
      `Highlights (most recent first, ${shown.length} of ${input.highlights.length}):`
    )
    for (const h of shown) {
      const text = truncateWithMarker(normalizeWhitespace(h.text), ITEM_TEXT_BUDGET)
      const label = input.highlightLabel ? input.highlightLabel(h) : `p. ${h.page}`
      lines.push(`- [${label}, ${formatDate(h.createdAt)}] "${text}"`)
    }
  }

  return lines.join('\n')
}
