import { describe, expect, it } from 'vitest'
import { placeFloatingPanel, placeSelectionToolbar } from './toolbarPlacement'

// Área visível de 0 a 600 (alto) por 0 a 800 (largo); toolbar de 200 × 40.
const bounds = { left: 0, top: 0, right: 800, bottom: 600 }
const size = { width: 200, height: 40 }

describe('placeSelectionToolbar', () => {
  it('fica acima da seleção quando cabe', () => {
    const r = placeSelectionToolbar({ x: 100, y: 300, w: 50, h: 20 }, size, bounds)
    expect(r).toEqual({ left: 100, top: 252 })
  })

  it('vai para baixo da seleção quando não cabe acima', () => {
    const r = placeSelectionToolbar({ x: 100, y: 20, w: 50, h: 20 }, size, bounds)
    expect(r.top).toBe(48)
  })

  it('seleção começa acima do topo e termina na borda de baixo: fica dentro da área', () => {
    // Seleção longa com a página rolada: começa em -400 e termina em 595.
    const r = placeSelectionToolbar({ x: 100, y: -400, w: 50, h: 995 }, size, bounds)
    expect(r.top).toBe(600 - 40 - 8)
  })

  it('respeita o topo visível de uma área rolada (coordenadas do container)', () => {
    // Área visível de 1000 a 1600 dentro do container que rolou.
    const scrolled = { left: 0, top: 1000, right: 800, bottom: 1600 }
    const r = placeSelectionToolbar({ x: 100, y: 900, w: 50, h: 800 }, size, scrolled)
    expect(r.top).toBe(1600 - 40 - 8)
  })

  it('área menor que a toolbar: prefere o topo visível', () => {
    const tiny = { left: 0, top: 0, right: 800, bottom: 30 }
    const r = placeSelectionToolbar({ x: 100, y: 5, w: 50, h: 10 }, size, tiny)
    expect(r.top).toBe(8)
  })

  it('prende a toolbar às laterais', () => {
    expect(placeSelectionToolbar({ x: 700, y: 300, w: 50, h: 20 }, size, bounds).left).toBe(592)
    expect(placeSelectionToolbar({ x: -50, y: 300, w: 50, h: 20 }, size, bounds).left).toBe(8)
  })
})

// Janela de 1280 × 800; popover de 340 × 276 (palavra).
const viewport = { width: 1280, height: 800 }
const panel = { width: 340, height: 276 }

describe('placeFloatingPanel', () => {
  it('abre abaixo da seleção, a 8 px', () => {
    const r = placeFloatingPanel({ x: 300, y: 200, w: 80, h: 20 }, panel, viewport)
    expect(r).toEqual({ left: 300, top: 228, maxHeight: 800 - 8 - 228 })
  })

  it('abre acima quando não cabe abaixo (seleção no fim da página)', () => {
    const r = placeFloatingPanel({ x: 300, y: 600, w: 80, h: 20 }, panel, viewport)
    expect(r.top).toBe(600 - 8 - 276)
    expect(r.maxHeight).toBe(600 - 8 - 8)
  })

  it('prende o painel à borda direita, a 8 px', () => {
    expect(placeFloatingPanel({ x: 1200, y: 200, w: 60, h: 20 }, panel, viewport).left).toBe(1280 - 340 - 8)
    expect(placeFloatingPanel({ x: -40, y: 200, w: 60, h: 20 }, panel, viewport).left).toBe(8)
  })

  it('janela baixa: vai para o lado com mais espaço, com a altura máxima reduzida', () => {
    const low = { width: 1280, height: 300 }
    const below = placeFloatingPanel({ x: 300, y: 80, w: 80, h: 20 }, panel, low)
    expect(below.top).toBe(108)
    expect(below.maxHeight).toBe(300 - 8 - 108)
    const above = placeFloatingPanel({ x: 300, y: 220, w: 80, h: 20 }, panel, low)
    expect(above.top).toBe(8)
    expect(above.maxHeight).toBe(220 - 8 - 8)
  })
})
