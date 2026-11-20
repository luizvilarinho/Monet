import { useLayoutEffect, useState, type RefObject } from 'react'

// Popover aberto no cursor (portal no body, `position: fixed`): abre em `top`
// (logo abaixo da linha) e, com `lineTop` (topo da linha), vira para cima
// quando não cabe embaixo. Nunca passa da borda direita.
export interface PopoverAnchor {
  top: number
  left: number
  lineTop?: number
}

const GAP = 4
const MARGIN = 8

// Âncora a partir do coordsAtPos do ProseMirror.
export function anchorFromCoords(coords: { top: number; bottom: number; left: number }): PopoverAnchor {
  return { top: coords.bottom + GAP, left: coords.left, lineTop: coords.top }
}

// Mede o popover a cada render (o conteúdo muda de altura ao filtrar) e só
// atualiza a posição quando ela muda.
export function useAnchoredPosition(ref: RefObject<HTMLElement | null>, anchor: PopoverAnchor): { top: number; left: number } {
  const [pos, setPos] = useState({ top: anchor.top, left: anchor.left })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const h = el.offsetHeight
    const w = el.offsetWidth
    const fitsBelow = anchor.top + h <= window.innerHeight - MARGIN
    const top =
      !fitsBelow && anchor.lineTop !== undefined && anchor.lineTop - GAP - h >= MARGIN
        ? anchor.lineTop - GAP - h
        : anchor.top
    const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - w - MARGIN))
    setPos((p) => (p.top === top && p.left === left ? p : { top, left }))
  })
  return pos
}
