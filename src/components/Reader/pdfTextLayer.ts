// Camada de texto do pdf.js: caret por ponto, spans da página, texto juntado
// com o mapa de offsets e Range por offsets. Compartilhado pela busca, pelo
// controlador de seleção e pelo Translate do leitor de PDF.

export interface CaretPoint {
  node: Node
  offset: number
}

export function getCaretFromPoint(x: number, y: number): CaretPoint | null {
  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => {
      offsetNode: Node
      offset: number
    } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (typeof docAny.caretPositionFromPoint === 'function') {
    const pos = docAny.caretPositionFromPoint(x, y)
    if (pos) return { node: pos.offsetNode, offset: pos.offset }
  } else if (typeof docAny.caretRangeFromPoint === 'function') {
    const range = docAny.caretRangeFromPoint(x, y)
    if (range) return { node: range.startContainer, offset: range.startOffset }
  }
  return null
}

// ─── Busca textual no ebook ─────────────────────────────────────────────
// Reconstrói o texto de uma página a partir dos <span> renderizados pela
// TextLayer do pdfjs, na mesma ordem em que são renderizados (1 span por
// item de texto). Junta com um único espaço entre spans — MESMA
// convenção usada por getPageText (`.map(item => item.str).join(' ')`),
// para que a busca no DOM ao vivo encontre os mesmos termos que a
// indexação em background encontrou no texto extraído.
export function getPageSpans(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('span')).filter(
    (s) => (s.textContent ?? '').length > 0,
  )
}

export interface SpanRange {
  span: HTMLElement
  start: number
  end: number
}

export function buildJoinedPageText(spans: HTMLElement[]): {
  text: string
  spanRanges: SpanRange[]
} {
  let text = ''
  const spanRanges: SpanRange[] = []
  spans.forEach((span, i) => {
    const content = span.textContent ?? ''
    const start = text.length
    text += content
    spanRanges.push({ span, start, end: text.length })
    if (i < spans.length - 1) text += ' '
  })
  return { text, spanRanges }
}

export function buildRangeFromOffsets(
  spanRanges: SpanRange[],
  start: number,
  end: number,
): Range | null {
  let startInfo: { span: HTMLElement; offset: number } | null = null
  let endInfo: { span: HTMLElement; offset: number } | null = null
  for (const sr of spanRanges) {
    if (!startInfo && start < sr.end) {
      startInfo = { span: sr.span, offset: start - sr.start }
    }
    if (!endInfo && end <= sr.end) {
      endInfo = { span: sr.span, offset: end - sr.start }
      break
    }
  }
  if (!startInfo || !endInfo) return null
  const startTextNode = startInfo.span.firstChild
  const endTextNode = endInfo.span.firstChild
  if (!startTextNode || !endTextNode) return null
  try {
    const range = document.createRange()
    range.setStart(startTextNode, Math.max(0, startInfo.offset))
    range.setEnd(endTextNode, Math.max(0, endInfo.offset))
    return range
  } catch {
    return null
  }
}

// Localiza todas as ocorrências (case-insensitive) de `query` no texto
// reconstruído da text layer e devolve um Range por ocorrência,
// construído a partir dos spans que a ocorrência atravessa. Uma
// ocorrência pode cruzar mais de um span (frase); nesse caso o Range
// vai do offset inicial no primeiro span ao offset final no último.
export function findAllOccurrenceRanges(container: HTMLElement, query: string): Range[] {
  if (!query) return []
  const spans = getPageSpans(container)
  if (spans.length === 0) return []
  const { text, spanRanges } = buildJoinedPageText(spans)
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const ranges: Range[] = []
  let searchFrom = 0
  let idx = lower.indexOf(q, searchFrom)
  while (idx !== -1) {
    const range = buildRangeFromOffsets(spanRanges, idx, idx + q.length)
    if (range) ranges.push(range)
    searchFrom = idx + q.length
    idx = lower.indexOf(q, searchFrom)
  }
  return ranges
}

// Posição de um trecho no texto juntado da página (o de buildJoinedPageText).
// A camada de texto do pdf.js é determinística para o mesmo documento, então os
// offsets sobrevivem a uma nova renderização da página.
export interface PdfTextAnchor {
  page: number
  start: number
  end: number
}

// Offset de um ponto (nó + offset do Range) no texto juntado: o span que
// contém o nó, mais o offset dentro dele. Nó de elemento conta como início
// (offset 0) ou fim (offset > 0) do span.
function pointToJoinedOffset(spanRanges: SpanRange[], node: Node, offset: number): number | null {
  for (const sr of spanRanges) {
    if (!sr.span.contains(node)) continue
    const length = sr.end - sr.start
    if (node.nodeType === Node.TEXT_NODE) return sr.start + Math.min(Math.max(0, offset), length)
    return sr.start + (offset > 0 ? length : 0)
  }
  return null
}

// Inverso do buildRangeFromOffsets: null quando uma das pontas está fora dos
// spans da página (seleção que vazou da camada de texto).
export function rangeToJoinedOffsets(
  spanRanges: SpanRange[],
  range: Range,
): { start: number; end: number } | null {
  const start = pointToJoinedOffset(spanRanges, range.startContainer, range.startOffset)
  const end = pointToJoinedOffset(spanRanges, range.endContainer, range.endOffset)
  if (start === null || end === null || end < start) return null
  return { start, end }
}
