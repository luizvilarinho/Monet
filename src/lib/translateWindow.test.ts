import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MAX_HEIGHT_PX,
  DRAG_THRESHOLD_PX,
  MAX_WIDTH_PX,
  MIN_HEIGHT_PX,
  MIN_WIDTH_PX,
  WINDOW_MARGIN_PX,
  applyMove,
  applyResize,
  clampToViewport,
  clearGeometry,
  estimatePassageHeight,
  exceedsDragThreshold,
  passageLines,
  readGeometry,
  reflowHeight,
  skeletonLineCount,
  writeGeometry,
  type WindowGeometry,
} from './translateWindow'

const PASSAGE_KEY = 'monet:translate-window:passage'
const WORD_KEY = 'monet:translate-window:word'
// Janela do app de 1200 × 800.
const VIEWPORT = { width: 1200, height: 800 }
const GEOMETRY: WindowGeometry = { left: 100, top: 120, width: 440, height: 360 }

beforeEach(() => {
  localStorage.clear()
})

describe('the saved geometry, one per variant', () => {
  it('keeps the two variants apart, under their own keys', () => {
    writeGeometry('passage', GEOMETRY)
    expect(localStorage.getItem(PASSAGE_KEY)).not.toBeNull()
    expect(localStorage.getItem(WORD_KEY)).toBeNull()
    expect(readGeometry('passage')).toEqual(GEOMETRY)
    expect(readGeometry('word')).toBeNull()
    writeGeometry('word', { left: 30, top: 40, width: 340, height: 240 })
    expect(readGeometry('word')).toEqual({ left: 30, top: 40, width: 340, height: 240 })
    expect(readGeometry('passage')).toEqual(GEOMETRY)
  })

  it('saves whole pixels', () => {
    writeGeometry('word', { left: 10.4, top: 20.6, width: 340.5, height: 239.49 })
    expect(readGeometry('word')).toEqual({ left: 10, top: 21, width: 341, height: 239 })
  })

  it('clearing one variant leaves the other', () => {
    writeGeometry('passage', GEOMETRY)
    writeGeometry('word', GEOMETRY)
    clearGeometry('passage')
    expect(readGeometry('passage')).toBeNull()
    expect(readGeometry('word')).toEqual(GEOMETRY)
  })

  it('a value that does not hold reads as nothing saved', () => {
    const key = PASSAGE_KEY
    for (const raw of [
      '{not json',
      'null',
      '[]',
      '"text"',
      '{"left":1,"top":2,"width":300}',
      '{"left":"1","top":2,"width":300,"height":200}',
      '{"left":1,"top":2,"width":0,"height":200}',
      '{"left":1,"top":2,"width":300,"height":-5}',
      '{"left":null,"top":2,"width":300,"height":200}',
    ]) {
      localStorage.setItem(key, raw)
      expect(readGeometry('passage')).toBeNull()
    }
  })

  it('works without storage: nothing saved, nothing thrown', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const removeItem = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readGeometry('word')).toBeNull()
    expect(() => writeGeometry('word', GEOMETRY)).not.toThrow()
    expect(() => clearGeometry('word')).not.toThrow()
    getItem.mockRestore()
    setItem.mockRestore()
    removeItem.mockRestore()
  })
})

describe('the drag threshold, before a gesture counts', () => {
  it('is 4 px', () => {
    expect(DRAG_THRESHOLD_PX).toBe(4)
  })

  it('a hand tremor below it does not start the gesture, in any direction', () => {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, -2],
      [-3, 0],
      [0, 3],
      [2, 2],
      [-2, 2],
      [3, 2],
    ]) {
      expect(exceedsDragThreshold(dx, dy)).toBe(false)
    }
  })

  it('4 px or more, in any direction, starts it', () => {
    for (const [dx, dy] of [
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
      [5, 0],
      [3, 3],
      [-3, -3],
      [40, -25],
    ]) {
      expect(exceedsDragThreshold(dx, dy)).toBe(true)
    }
  })
})

describe('clampToViewport', () => {
  it('leaves a geometry that fits as it is', () => {
    expect(clampToViewport(GEOMETRY, VIEWPORT)).toEqual(GEOMETRY)
  })

  it('pushes a window that is out of the app window back inside, 8 px from the edges', () => {
    expect(clampToViewport({ ...GEOMETRY, left: 1100, top: 700 }, VIEWPORT)).toEqual({
      left: 1200 - WINDOW_MARGIN_PX - 440,
      top: 800 - WINDOW_MARGIN_PX - 360,
      width: 440,
      height: 360,
    })
    expect(clampToViewport({ ...GEOMETRY, left: -50, top: -30 }, VIEWPORT)).toMatchObject({ left: 8, top: 8 })
  })

  it('limits the size to the app window and to 640 px of width, then pushes inside', () => {
    expect(clampToViewport({ left: 0, top: 0, width: 900, height: 2000 }, VIEWPORT)).toEqual({
      left: 8,
      top: 8,
      width: MAX_WIDTH_PX,
      height: 800 - 2 * WINDOW_MARGIN_PX,
    })
    // Numa janela de 500 de largura, o máximo é 500 − 16.
    expect(clampToViewport({ left: 0, top: 0, width: 600, height: 300 }, { width: 500, height: 800 })).toMatchObject({
      left: 8,
      width: 484,
    })
  })

  it('raises a size below the minimum', () => {
    expect(clampToViewport({ left: 50, top: 50, width: 100, height: 80 }, VIEWPORT)).toMatchObject({
      width: MIN_WIDTH_PX,
      height: MIN_HEIGHT_PX,
    })
  })

  it('in an app window smaller than the minimum, the maximum wins', () => {
    expect(clampToViewport(GEOMETRY, { width: 280, height: 200 })).toEqual({
      left: 8,
      top: 8,
      width: 264,
      height: 184,
    })
  })

  it('does not touch what is saved: it returns a new value and the input is the same', () => {
    const saved = { ...GEOMETRY, left: 1100 }
    clampToViewport(saved, VIEWPORT)
    expect(saved.left).toBe(1100)
  })
})

describe('applyMove', () => {
  it('follows the pointer', () => {
    expect(applyMove(GEOMETRY, 30, -20, VIEWPORT)).toEqual({ ...GEOMETRY, left: 130, top: 100 })
  })

  it('stops at the edges of the app window', () => {
    expect(applyMove(GEOMETRY, -500, -500, VIEWPORT)).toMatchObject({ left: 8, top: 8 })
    expect(applyMove(GEOMETRY, 5000, 5000, VIEWPORT)).toMatchObject({
      left: 1200 - 8 - 440,
      top: 800 - 8 - 360,
    })
  })
})

describe('applyResize', () => {
  it('east and south move only their edge', () => {
    expect(applyResize(GEOMETRY, 'e', 60, 99, VIEWPORT)).toEqual({ ...GEOMETRY, width: 500 })
    expect(applyResize(GEOMETRY, 's', 99, 40, VIEWPORT)).toEqual({ ...GEOMETRY, height: 400 })
  })

  it('west and north move the edge and keep the opposite one still', () => {
    expect(applyResize(GEOMETRY, 'w', -40, 99, VIEWPORT)).toEqual({ ...GEOMETRY, left: 60, width: 480 })
    expect(applyResize(GEOMETRY, 'n', 99, -30, VIEWPORT)).toEqual({ ...GEOMETRY, top: 90, height: 390 })
  })

  it('a corner moves its two edges', () => {
    expect(applyResize(GEOMETRY, 'se', 20, 30, VIEWPORT)).toEqual({ ...GEOMETRY, width: 460, height: 390 })
    expect(applyResize(GEOMETRY, 'nw', -20, -30, VIEWPORT)).toEqual({
      left: 80,
      top: 90,
      width: 460,
      height: 390,
    })
    expect(applyResize(GEOMETRY, 'ne', 20, -30, VIEWPORT)).toEqual({ ...GEOMETRY, top: 90, width: 460, height: 390 })
    expect(applyResize(GEOMETRY, 'sw', -20, 30, VIEWPORT)).toEqual({ ...GEOMETRY, left: 80, width: 460, height: 390 })
  })

  it('never goes below 300 × 220 and keeps the opposite edge where it was', () => {
    expect(applyResize(GEOMETRY, 'e', -1000, 0, VIEWPORT)).toEqual({ ...GEOMETRY, width: MIN_WIDTH_PX })
    expect(applyResize(GEOMETRY, 'w', 1000, 0, VIEWPORT)).toEqual({
      ...GEOMETRY,
      left: 100 + 440 - MIN_WIDTH_PX,
      width: MIN_WIDTH_PX,
    })
    expect(applyResize(GEOMETRY, 's', 0, -1000, VIEWPORT)).toEqual({ ...GEOMETRY, height: MIN_HEIGHT_PX })
    expect(applyResize(GEOMETRY, 'n', 0, 1000, VIEWPORT)).toEqual({
      ...GEOMETRY,
      top: 120 + 360 - MIN_HEIGHT_PX,
      height: MIN_HEIGHT_PX,
    })
  })

  it('never goes above 640 px of width', () => {
    expect(applyResize(GEOMETRY, 'e', 1000, 0, VIEWPORT)).toEqual({ ...GEOMETRY, width: MAX_WIDTH_PX })
    const placed = { ...GEOMETRY, left: 300 }
    expect(applyResize(placed, 'w', -1000, 0, VIEWPORT)).toEqual({
      ...placed,
      left: 300 + 440 - MAX_WIDTH_PX,
      width: MAX_WIDTH_PX,
    })
  })

  it('the moving edge stops 8 px from the edge of the app window', () => {
    const nearRight = { left: 700, top: 120, width: 400, height: 300 }
    expect(applyResize(nearRight, 'e', 1000, 0, VIEWPORT)).toMatchObject({ width: 1200 - 8 - 700 })
    expect(applyResize(GEOMETRY, 'w', -1000, 0, VIEWPORT)).toMatchObject({ left: 8 })
    expect(applyResize(GEOMETRY, 's', 0, 5000, VIEWPORT)).toMatchObject({ height: 800 - 8 - 120 })
    expect(applyResize(GEOMETRY, 'n', 0, -5000, VIEWPORT)).toMatchObject({ top: 8 })
  })

  it('the height can grow up to the app window height, past the default 460', () => {
    const tall = applyResize({ left: 50, top: 8, width: 440, height: 300 }, 's', 0, 1000, VIEWPORT)
    expect(tall.height).toBe(800 - 2 * WINDOW_MARGIN_PX)
    expect(tall.height).toBeGreaterThan(DEFAULT_MAX_HEIGHT_PX)
  })

  it('no movement, no change', () => {
    for (const direction of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const) {
      expect(applyResize(GEOMETRY, direction, 0, 0, VIEWPORT)).toEqual(GEOMETRY)
    }
  })
})

describe('the height estimate of a passage', () => {
  it('counts about 64 characters per line', () => {
    expect(passageLines(0)).toBe(1)
    expect(passageLines(64)).toBe(1)
    expect(passageLines(65)).toBe(2)
    expect(passageLines(640)).toBe(10)
  })

  it('grows with the text, up to 460', () => {
    const short = estimatePassageHeight(10)
    expect(short).toBeGreaterThanOrEqual(MIN_HEIGHT_PX)
    const medium = estimatePassageHeight(400)
    expect(medium).toBeGreaterThan(short)
    expect(medium).toBeLessThan(DEFAULT_MAX_HEIGHT_PX)
    expect(estimatePassageHeight(800)).toBeGreaterThan(medium)
    expect(estimatePassageHeight(1500)).toBe(DEFAULT_MAX_HEIGHT_PX)
    expect(estimatePassageHeight(100000)).toBe(DEFAULT_MAX_HEIGHT_PX)
  })

  it('the skeleton has one bar per estimated line, from 3 to 8', () => {
    expect(skeletonLineCount(20)).toBe(3)
    expect(skeletonLineCount(400)).toBe(7)
    expect(skeletonLineCount(5000)).toBe(8)
  })
})

describe('reflowHeight, the single adjustment at the end of the translation', () => {
  it('a window below the selection keeps its top and gives up the bottom', () => {
    const result = reflowHeight({ top: 130, height: 360 }, 250, { y: 100 }, VIEWPORT)
    expect(result).toEqual({ top: 130, maxHeight: DEFAULT_MAX_HEIGHT_PX })
  })

  it('a window above the selection keeps its bottom and gives up the top', () => {
    // A base está em 510 (a seleção começa em 600).
    const result = reflowHeight({ top: 150, height: 360 }, 250, { y: 600 }, VIEWPORT)
    expect(result).toEqual({ top: 510 - 250, maxHeight: DEFAULT_MAX_HEIGHT_PX })
  })

  it('a window above that grows keeps its bottom and does not pass the top edge', () => {
    const result = reflowHeight({ top: 200, height: 180 }, 460, { y: 400 }, VIEWPORT)
    // A base está em 380: sobram 380 − 8 de cima, e o conteúdo de 460 rola por dentro.
    expect(result.maxHeight).toBe(380 - WINDOW_MARGIN_PX)
    expect(result.top).toBe(WINDOW_MARGIN_PX)
  })

  it('a window below that grows is limited by the bottom edge of the app window', () => {
    const result = reflowHeight({ top: 600, height: 150 }, 460, { y: 400 }, VIEWPORT)
    expect(result.top).toBe(600)
    expect(result.maxHeight).toBe(800 - WINDOW_MARGIN_PX - 600)
  })

  it('never returns a negative room', () => {
    expect(reflowHeight({ top: 900, height: 100 }, 300, { y: 400 }, VIEWPORT).maxHeight).toBe(0)
  })
})
