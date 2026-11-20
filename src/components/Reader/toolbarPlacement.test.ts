import { describe, expect, it } from 'vitest'
import { placeSelectionToolbar } from './toolbarPlacement'

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
