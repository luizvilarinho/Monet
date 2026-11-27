// Marcas sobre o texto da página sem tocar no DOM: a CSS Custom Highlight API
// (F0.1 passou no PDF e no EPUB). A faixa cinza do trecho em leitura é a marca
// `listen`; a `vocab` é o sublinhado pontilhado das palavras e frases guardadas.
// Cada janela tem o seu registro `CSS.highlights`: o EPUB vive num iframe.
export type PageMarkKind = 'listen' | 'vocab'

const MARK_NAMES: Record<PageMarkKind, string> = {
  listen: 'monet-listen',
  vocab: 'monet-vocab',
}

const STYLE_ID = 'monet-page-marks'

// Cinza neutro, sem matiz. Os valores são literais: os tokens do App.css não
// existem dentro do iframe do EPUB.
export const PAGE_MARK_STYLE = `
::highlight(monet-listen) { background-color: rgba(128, 128, 128, 0.22); }
::highlight(monet-vocab) {
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: rgba(96, 96, 96, 0.95);
  text-decoration-thickness: 0.11em;
  text-underline-offset: 0.22em;
}
`

interface HighlightRegistry {
  set(name: string, highlight: unknown): void
  delete(name: string): void
}

type MarkWindow = Window & {
  CSS?: { highlights?: HighlightRegistry }
  Highlight?: new (...ranges: Range[]) => unknown
}

// Injeta o <style> uma vez por documento (o principal e cada iframe do EPUB).
export function ensurePageMarkStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID) || !doc.head) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = PAGE_MARK_STYLE
  doc.head.appendChild(style)
}

// Os ranges por janela dona do documento. Separado de `setPageMarks` porque o
// happy-dom não tem CSS.highlights, mas o agrupamento se testa.
export function groupRangesByWindow(ranges: Range[]): Map<Window, Range[]> {
  const groups = new Map<Window, Range[]>()
  for (const range of ranges) {
    const win = range.startContainer.ownerDocument?.defaultView
    if (!win) continue
    const list = groups.get(win)
    if (list) list.push(range)
    else groups.set(win, [range])
  }
  return groups
}

// Janelas onde cada marca está registrada agora.
const applied: Record<PageMarkKind, Set<Window>> = { listen: new Set(), vocab: new Set() }

function clearIn(win: Window, kind: PageMarkKind): void {
  try {
    ;(win as MarkWindow).CSS?.highlights?.delete(MARK_NAMES[kind])
  } catch {
    // Janela de um iframe que já saiu: não há mais o que limpar.
  }
}

// Substitui a marca `kind` pelos ranges dados; as janelas que deixaram de aparecer
// (o capítulo trocou) são limpas. Sem suporte na janela, a marca não aparece.
export function setPageMarks(kind: PageMarkKind, ranges: Range[]): void {
  const groups = groupRangesByWindow(ranges)
  for (const win of applied[kind]) {
    if (!groups.has(win)) clearIn(win, kind)
  }
  applied[kind] = new Set()
  for (const [win, list] of groups) {
    const markWindow = win as MarkWindow
    const registry = markWindow.CSS?.highlights
    const Highlight = markWindow.Highlight
    if (!registry || !Highlight) continue
    try {
      ensurePageMarkStyles(win.document)
      registry.set(MARK_NAMES[kind], new Highlight(...list))
      applied[kind].add(win)
    } catch {
      // Janela em descarte: a marca fica de fora.
    }
  }
}

export function clearPageMarks(kind: PageMarkKind): void {
  for (const win of applied[kind]) clearIn(win, kind)
  applied[kind] = new Set()
}

// ─── Texto de um documento (EPUB) e posição das marcas ───────────────────

// Um nó de texto e onde ele começa no texto juntado.
export interface TextNodeSpan {
  node: Text
  start: number
  end: number
}

// Elementos cujo texto não é do livro, e os que quebram o texto em blocos: duas
// palavras de blocos diferentes não podem formar uma expressão.
const SKIPPED_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'math'])
const BLOCK_SELECTOR =
  'p, li, blockquote, div, h1, h2, h3, h4, h5, h6, td, th, pre, section, article, aside, figcaption, dd, dt'

// O texto de um documento exibido (o EPUB: o capítulo inteiro está no DOM), com a
// tabela de onde cada nó de texto cai. Entre blocos e em cada <br> entra uma
// quebra de linha, que não pertence a nó nenhum.
export function buildJoinedNodeText(root: Node): { text: string; nodes: TextNodeSpan[] } {
  const nodes: TextNodeSpan[] = []
  let text = ''
  let lastBlock: Element | null = null
  let breakPending = false

  const walk = (parent: Node) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === 3) {
        const content = child.textContent ?? ''
        if (!content) continue
        const block = child.parentElement?.closest(BLOCK_SELECTOR) ?? null
        if (nodes.length > 0 && (breakPending || block !== lastBlock)) text += '\n'
        breakPending = false
        lastBlock = block
        nodes.push({ node: child as Text, start: text.length, end: text.length + content.length })
        text += content
      } else if (child.nodeType === 1) {
        const tag = (child as Element).localName.toLowerCase()
        if (SKIPPED_TAGS.has(tag)) continue
        if (tag === 'br') breakPending = true
        else walk(child)
      }
    }
  }
  walk(root)
  return { text, nodes }
}

// O primeiro nó cujo fim passa de `offset` (ou o alcança, com `inclusive`): o nó
// que contém o início (ou o fim) de um trecho.
function locateNode(nodes: TextNodeSpan[], offset: number, inclusive: boolean): TextNodeSpan | null {
  let low = 0
  let high = nodes.length
  while (low < high) {
    const mid = (low + high) >> 1
    const reaches = inclusive ? nodes[mid].end >= offset : nodes[mid].end > offset
    if (reaches) high = mid
    else low = mid + 1
  }
  return nodes[low] ?? null
}

// O Range de [start, end) no texto juntado de `buildJoinedNodeText`. null quando uma
// das pontas cai fora dos nós.
export function rangeFromNodeOffsets(
  doc: Document,
  nodes: TextNodeSpan[],
  start: number,
  end: number,
): Range | null {
  const first = locateNode(nodes, start, false)
  const last = locateNode(nodes, end, true)
  if (!first || !last || start < first.start || end <= last.start) return null
  try {
    const range = doc.createRange()
    range.setStart(first.node, start - first.start)
    range.setEnd(last.node, end - last.start)
    return range
  } catch {
    return null
  }
}

// Uma marca `vocab` na página: o Range e os itens do vocabulário que ela mostra.
export interface MarkEntry {
  range: Range
  itemIds: string[]
}

interface RectLike {
  left: number
  right: number
  top: number
  bottom: number
}

// A marca sob o ponto (coordenadas do documento que contém os ranges), pelos
// retângulos de cada trecho. Vale a primeira da lista: quem monta a lista põe as
// palavras antes das frases.
export function markEntryAtPoint<T extends { range: { getClientRects(): ArrayLike<RectLike> } }>(
  entries: T[],
  x: number,
  y: number,
): T | null {
  for (const entry of entries) {
    const rects = entry.range.getClientRects()
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return entry
    }
  }
  return null
}
