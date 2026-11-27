// Geometria da janela de tradução (o popover de Translate): ler, validar, gravar
// e apagar a posição e o tamanho que o usuário escolheu (uma geometria por
// variante, em localStorage), limitar à janela do app, aplicar o delta de um
// gesto de mover ou redimensionar e estimar a altura de uma passagem. Só regra
// pura: o gesto e o DOM ficam no TranslatePopover.

export type WindowVariant = 'passage' | 'word'

export interface WindowGeometry {
  left: number
  top: number
  width: number
  height: number
}

export interface WindowViewport {
  width: number
  height: number
}

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const MIN_WIDTH_PX = 300
export const MIN_HEIGHT_PX = 220
export const MAX_WIDTH_PX = 640
// Sem geometria gravada a janela cresce com o conteúdo até aqui; com ela, o
// limite passa a ser o da janela do app.
export const DEFAULT_MAX_HEIGHT_PX = 460
// A distância mínima das bordas da janela do app (o `EDGE_PX` de toolbarPlacement).
export const WINDOW_MARGIN_PX = 8

const STORAGE_KEYS: Record<WindowVariant, string> = {
  passage: 'monet:translate-window:passage',
  word: 'monet:translate-window:word',
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// null = nada gravado, ou gravado de um jeito que não vale (JSON quebrado, campo
// que não é número, tamanho zero ou negativo).
export function readGeometry(variant: WindowVariant): WindowGeometry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[variant])
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const { left, top, width, height } = parsed as Record<string, unknown>
    if (!isNumber(left) || !isNumber(top) || !isNumber(width) || !isNumber(height)) return null
    if (width <= 0 || height <= 0) return null
    return { left, top, width, height }
  } catch {
    return null
  }
}

export function writeGeometry(variant: WindowVariant, geometry: WindowGeometry): void {
  const rounded: WindowGeometry = {
    left: Math.round(geometry.left),
    top: Math.round(geometry.top),
    width: Math.round(geometry.width),
    height: Math.round(geometry.height),
  }
  try {
    localStorage.setItem(STORAGE_KEYS[variant], JSON.stringify(rounded))
  } catch {
    // Sem armazenamento (janela privada, cota): vale só até fechar a janela.
  }
}

// Volta ao padrão: sem chave, a janela abre ancorada na seleção.
export function clearGeometry(variant: WindowVariant): void {
  try {
    localStorage.removeItem(STORAGE_KEYS[variant])
  } catch {
    // Sem armazenamento: não há o que apagar.
  }
}

// Distância mínima do ponteiro em relação ao `pointerdown`, em qualquer direção,
// para o gesto de mover ou redimensionar começar. Abaixo dela é um clique com
// tremor da mão: nada se move, nada é redimensionado e nada é gravado.
export const DRAG_THRESHOLD_PX = 4

export function exceedsDragThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Largura e altura que a janela pode ter na janela do app. Numa janela do app
// menor que o mínimo, o máximo vale mais que o mínimo.
function sizeLimits(viewport: WindowViewport) {
  const maxWidth = Math.max(0, Math.min(MAX_WIDTH_PX, viewport.width - 2 * WINDOW_MARGIN_PX))
  const maxHeight = Math.max(0, viewport.height - 2 * WINDOW_MARGIN_PX)
  return {
    maxWidth,
    maxHeight,
    minWidth: Math.min(MIN_WIDTH_PX, maxWidth),
    minHeight: Math.min(MIN_HEIGHT_PX, maxHeight),
  }
}

// Limita o tamanho ao que cabe na janela do app e empurra a janela para dentro,
// a `WINDOW_MARGIN_PX` das bordas. Não grava nada: a geometria gravada continua a
// que o usuário escolheu, e volta ao lugar quando a janela do app volta a caber.
export function clampToViewport(geometry: WindowGeometry, viewport: WindowViewport): WindowGeometry {
  const limits = sizeLimits(viewport)
  const width = clamp(geometry.width, limits.minWidth, limits.maxWidth)
  const height = clamp(geometry.height, limits.minHeight, limits.maxHeight)
  return {
    left: clamp(geometry.left, WINDOW_MARGIN_PX, Math.max(WINDOW_MARGIN_PX, viewport.width - WINDOW_MARGIN_PX - width)),
    top: clamp(geometry.top, WINDOW_MARGIN_PX, Math.max(WINDOW_MARGIN_PX, viewport.height - WINDOW_MARGIN_PX - height)),
    width,
    height,
  }
}

// Arrastar o cabeçalho: a janela segue o ponteiro, sem sair da janela do app.
export function applyMove(
  start: WindowGeometry,
  dx: number,
  dy: number,
  viewport: WindowViewport,
): WindowGeometry {
  return clampToViewport({ ...start, left: start.left + dx, top: start.top + dy }, viewport)
}

// Arrastar uma alça: a borda (ou as duas bordas, no canto) acompanha o ponteiro e
// a oposta fica parada. O tamanho respeita o mínimo e o máximo, e a borda que se
// move não passa da margem da janela do app.
export function applyResize(
  start: WindowGeometry,
  direction: ResizeDirection,
  dx: number,
  dy: number,
  viewport: WindowViewport,
): WindowGeometry {
  const limits = sizeLimits(viewport)
  let left = start.left
  let top = start.top
  let right = start.left + start.width
  let bottom = start.top + start.height

  if (direction.includes('e')) {
    right = clamp(
      start.left + start.width + dx,
      left + limits.minWidth,
      Math.min(left + limits.maxWidth, viewport.width - WINDOW_MARGIN_PX),
    )
  } else if (direction.includes('w')) {
    left = clamp(start.left + dx, Math.max(WINDOW_MARGIN_PX, right - limits.maxWidth), right - limits.minWidth)
  }
  if (direction.includes('s')) {
    bottom = clamp(
      start.top + start.height + dy,
      top + limits.minHeight,
      Math.min(top + limits.maxHeight, viewport.height - WINDOW_MARGIN_PX),
    )
  } else if (direction.includes('n')) {
    top = clamp(start.top + dy, Math.max(WINDOW_MARGIN_PX, bottom - limits.maxHeight), bottom - limits.minHeight)
  }

  return { left, top, width: right - left, height: bottom - top }
}

// Estimativa da altura de uma passagem, feita na abertura com o texto de origem,
// para a janela não crescer a cada pedaço da tradução que chega. Uma linha de
// tradução tem uns 64 caracteres a 440 px e 20 px de altura (13 px × 1,55).
const PASSAGE_CHARS_PER_LINE = 64
const PASSAGE_LINE_PX = 20
// Até duas notas de gramática, que chegam depois do texto.
const PASSAGE_NOTES_PX = 110
// Cabeçalho, margens do corpo, barra de ações, linha de línguas e bordas.
const WINDOW_CHROME_PX = 128

export function passageLines(sourceLength: number): number {
  return Math.max(1, Math.ceil(sourceLength / PASSAGE_CHARS_PER_LINE))
}

export function estimatePassageHeight(sourceLength: number): number {
  const estimate = WINDOW_CHROME_PX + passageLines(sourceLength) * PASSAGE_LINE_PX + PASSAGE_NOTES_PX
  return Math.min(DEFAULT_MAX_HEIGHT_PX, estimate)
}

// Barras do esqueleto: uma por linha estimada, de 3 a 8.
export function skeletonLineCount(sourceLength: number): number {
  return clamp(passageLines(sourceLength), 3, 8)
}

// O único ajuste de altura no fim da tradução (sem geometria gravada): a altura
// passa a ser a do conteúdo e a borda do lado da seleção fica onde estava, o topo
// se a janela está abaixo da seleção, a base se está acima. `maxHeight` é o que
// cabe dali até a borda da janela do app, no máximo `DEFAULT_MAX_HEIGHT_PX`.
export function reflowHeight(
  previous: { top: number; height: number },
  contentHeight: number,
  anchor: { y: number },
  viewport: WindowViewport,
): { top: number; maxHeight: number } {
  const bottom = previous.top + previous.height
  if (bottom <= anchor.y) {
    const room = Math.max(0, bottom - WINDOW_MARGIN_PX)
    const maxHeight = Math.min(DEFAULT_MAX_HEIGHT_PX, room)
    return { top: bottom - Math.min(contentHeight, maxHeight), maxHeight }
  }
  const room = Math.max(0, viewport.height - WINDOW_MARGIN_PX - previous.top)
  return { top: previous.top, maxHeight: Math.min(DEFAULT_MAX_HEIGHT_PX, room) }
}
