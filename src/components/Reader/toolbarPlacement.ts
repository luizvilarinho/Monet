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

// Painel flutuante (popover de Translate): `position: fixed`, então tudo em
// coordenadas da janela. Abre abaixo do anchor; sem espaço, acima; sem espaço
// em nenhum dos dois, do lado que tem mais, com `maxHeight` reduzido (o painel
// rola por dentro). Sempre a `margin` das bordas da janela.
export function placeFloatingPanel(
  anchor: PlacementAnchor,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = EDGE_PX,
): { left: number; top: number; maxHeight: number } {
  const left = Math.max(margin, Math.min(anchor.x, viewport.width - size.width - margin))
  const below = anchor.y + anchor.h + GAP_PX
  const spaceBelow = viewport.height - margin - below
  const spaceAbove = anchor.y - GAP_PX - margin
  if (size.height <= spaceBelow) return { left, top: below, maxHeight: spaceBelow }
  if (size.height <= spaceAbove) return { left, top: anchor.y - GAP_PX - size.height, maxHeight: spaceAbove }
  if (spaceBelow >= spaceAbove) return { left, top: below, maxHeight: Math.max(0, spaceBelow) }
  return { left, top: margin, maxHeight: Math.max(0, spaceAbove) }
}
