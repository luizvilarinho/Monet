// Posição da toolbar de seleção dos leitores (PDF e EPUB): acima da seleção,
// ou abaixo dela quando não cabe em cima, e sempre dentro da área visível.
// Tudo no mesmo sistema de coordenadas do container da toolbar.

export interface PlacementAnchor {
  x: number
  y: number
  w: number
  h: number
}

export interface PlacementBounds {
  left: number
  top: number
  right: number
  bottom: number
}

const EDGE_PX = 8
const GAP_PX = 8

export function placeSelectionToolbar(
  anchor: PlacementAnchor,
  size: { width: number; height: number },
  bounds: PlacementBounds,
): { left: number; top: number } {
  const maxLeft = bounds.right - size.width - EDGE_PX
  const left = Math.max(bounds.left + EDGE_PX, Math.min(anchor.x, maxLeft))
  const minTop = bounds.top + EDGE_PX
  const above = anchor.y - size.height - GAP_PX
  if (above >= minTop) return { left, top: above }
  // Abaixo da seleção, mas preso à borda de baixo: a seleção pode começar
  // acima do topo visível e terminar colada (ou além) da borda de baixo.
  const maxTop = bounds.bottom - size.height - EDGE_PX
  const top = Math.max(minTop, Math.min(anchor.y + anchor.h + GAP_PX, maxTop))
  return { left, top }
}
