import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PartialTranslation, Translation, TranslateInput } from '../../lib/translate'
import { readGeometry, writeGeometry } from '../../lib/translateWindow'

// O motor da tradução é simulado: cada chamada fica à espera, e o teste decide
// quando chega um pedaço, o resultado ou o erro. O resto de `translate` é o real.
interface Call {
  input: TranslateInput & { onPartial?: (partial: PartialTranslation) => void; signal: AbortSignal }
  resolve: (translation: Translation) => void
  reject: (error: unknown) => void
}
const rt = vi.hoisted(() => ({ calls: [] as unknown[] }))
const calls = () => rt.calls as Call[]

vi.mock('../../lib/translate', async (importActual) => {
  const actual = await importActual<typeof import('../../lib/translate')>()
  return {
    ...actual,
    requestTranslation: vi.fn(
      (input: Call['input']) =>
        new Promise<Translation>((resolve, reject) => {
          rt.calls.push({ input, resolve, reject })
        }),
    ),
  }
})

// Quantas vezes a janela foi posicionada contra a seleção (cada pedaço de texto
// não pode contar).
vi.mock('../Reader/toolbarPlacement', async (importActual) => {
  const actual = await importActual<typeof import('../Reader/toolbarPlacement')>()
  return { ...actual, placeFloatingPanel: vi.fn(actual.placeFloatingPanel) }
})

vi.mock('@phosphor-icons/react', () => ({
  ArrowCounterClockwise: () => null,
  BookmarkSimple: () => null,
  GearSix: () => null,
  NotePencil: () => null,
  Sparkle: () => null,
  SpeakerHigh: () => null,
  X: () => null,
}))

import { TranslateError } from '../../lib/translate'
import { placeFloatingPanel } from '../Reader/toolbarPlacement'
import { TranslatePopover, type TranslatePopoverProps } from './TranslatePopover'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PASSAGE_KEY = 'monet:translate-window:passage'

// Textos inventados.
const PASSAGE =
  "La porte du grenier était entrebâillée et il n'y avait pas de lumière, alors elle monta en tâtonnant jusqu'au dernier palier, où une vieille malle pleine de lettres attendait sous la poussière depuis des années."
const PASSAGE_RESULT: Translation = {
  kind: 'passage',
  translation: 'A porta do sótão estava entreaberta e não havia luz.',
  grammar: ['Uma nota de gramática.'],
}
const WORD_RESULT: Translation = {
  kind: 'word',
  term: 'entrebâillée',
  baseForm: 'entrebâiller',
  partOfSpeech: 'participe passé',
  gender: 'féminin',
  sense: 'entreaberta',
  note: null,
}
const ANCHOR = { x: 200, y: 300, w: 80, h: 20 }

let host: HTMLDivElement
let root: Root
const rootRef = createRef<HTMLDivElement>()

function render(patch: Partial<TranslatePopoverProps> = {}) {
  act(() => {
    root.render(
      <TranslatePopover
        open
        rootRef={rootRef}
        anchor={ANCHOR}
        text={PASSAGE}
        sentence={PASSAGE}
        positionLabel="p. 12"
        sourceLanguage="fr"
        targetLanguage="pt"
        model="acme/model"
        onListen={vi.fn()}
        onAddToVocabulary={vi.fn()}
        onAddToNote={vi.fn()}
        onAskAi={vi.fn()}
        onChangeBookLanguage={vi.fn()}
        onChangeTargetLanguage={vi.fn()}
        onOpenSettings={vi.fn()}
        onClose={vi.fn()}
        {...patch}
      />,
    )
  })
}

const dialog = () => document.querySelector<HTMLDivElement>('[role="dialog"]')!
const header = () => dialog().querySelector<HTMLDivElement>('[title^="Drag to move"]')!
const body = () => dialog().querySelector<HTMLDivElement>('[aria-busy]')!
// As oito alças, na ordem do componente: n, s, e, w, ne, nw, se, sw.
const handles = () => Array.from(dialog().querySelectorAll<HTMLDivElement>(':scope > div[aria-hidden="true"]'))
const handle = (direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') =>
  handles()['n s e w ne nw se sw'.split(' ').indexOf(direction)]
const button = (label: string) =>
  Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(label))
const buttonLabels = () =>
  Array.from(dialog().querySelectorAll<HTMLButtonElement>(':scope > div button'))
    .map((b) => b.textContent?.trim())
    .filter(Boolean)

function pointer(target: Element, type: string, x: number, y: number) {
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 }),
    )
  })
}

function stubRect(rect: { left: number; top: number; width: number; height: number }) {
  vi.spyOn(dialog(), 'getBoundingClientRect').mockReturnValue({
    ...rect,
    x: rect.left,
    y: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  })
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

beforeEach(() => {
  localStorage.clear()
  rt.calls.length = 0
  vi.mocked(placeFloatingPanel).mockClear()
  setViewport(1200, 800)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => true)
  Element.prototype.releasePointerCapture = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

describe('the actions bar, from the first frame', () => {
  it('is there while loading, with "Add to vocabulary" waiting for the translation', () => {
    render()
    expect(buttonLabels()).toEqual(['Listen', 'Add to vocabulary', 'Add to note', 'Ask AI', 'Change'])
    const vocabulary = button('Add to vocabulary')!
    expect(vocabulary.disabled).toBe(true)
    expect(vocabulary.title).toBe('Available when the translation is complete')
    for (const label of ['Listen', 'Add to note', 'Ask AI']) expect(button(label)!.disabled).toBe(false)
  })

  it('"Save translation" of a saved item waits too, and works at the end', async () => {
    const onAddToVocabulary = vi.fn()
    render({ savedItem: true, onAddToVocabulary })
    expect(button('Save translation')!.disabled).toBe(true)
    await act(async () => calls()[0].resolve(PASSAGE_RESULT))
    const save = button('Save translation')!
    expect(save.disabled).toBe(false)
    expect(save.title).toBe('')
    act(() => save.click())
    expect(onAddToVocabulary).toHaveBeenCalledWith(PASSAGE_RESULT)
  })

  it('a word has the bar while loading too, and "Add to vocabulary" opens at the end', async () => {
    render({ text: 'entrebâillée', sentence: PASSAGE })
    expect(button('Add to vocabulary')!.disabled).toBe(true)
    await act(async () => calls()[0].resolve(WORD_RESULT))
    expect(button('Add to vocabulary')!.disabled).toBe(false)
  })
})

describe('the text arriving', () => {
  it('shows the partial text of a passage and keeps the phase loading until the end', async () => {
    render()
    expect(dialog().textContent).toContain('Translating…')
    act(() => calls()[0].input.onPartial?.({ text: 'A porta do sótão', closed: false }))
    expect(body().textContent).toBe('A porta do sótão')
    expect(dialog().textContent).toContain('Translating…')
    expect(button('Add to vocabulary')!.disabled).toBe(true)
    act(() => calls()[0].input.onPartial?.({ text: 'A porta do sótão estava entreaberta', closed: false }))
    expect(body().textContent).toBe('A porta do sótão estava entreaberta')

    await act(async () => calls()[0].resolve(PASSAGE_RESULT))
    expect(body().textContent).toContain('A porta do sótão estava entreaberta e não havia luz.')
    expect(body().textContent).toContain('Uma nota de gramática.')
    expect(dialog().textContent).not.toContain('Translating…')
    expect(button('Add to vocabulary')!.disabled).toBe(false)
  })

  it('a bar stands where the notes will be once the text is closed', () => {
    render()
    const skeletons = () => body().querySelectorAll('div').length
    act(() => calls()[0].input.onPartial?.({ text: 'A porta do sótão estava entreaberta.', closed: false }))
    const open = skeletons()
    act(() => calls()[0].input.onPartial?.({ text: 'A porta do sótão estava entreaberta.', closed: true }))
    expect(skeletons()).toBe(open + 1)
  })

  it('an error in the middle keeps the text that was read, says so, and puts "Try again" first', async () => {
    render()
    act(() => calls()[0].input.onPartial?.({ text: 'A porta do sótão', closed: false }))
    await act(async () => calls()[0].reject(new TranslateError('failed', 'network')))
    expect(body().textContent).toContain('A porta do sótão')
    expect(body().textContent).toContain('The translation stopped before the end.')
    expect(buttonLabels().slice(0, 4)).toEqual(['Try again', 'Listen', 'Add to note', 'Ask AI'])

    act(() => button('Try again')!.click())
    expect(calls()).toHaveLength(2)
    // O pedido novo começa do zero: o texto antigo sai, o aviso também.
    expect(body().textContent).not.toContain('A porta do sótão')
    expect(body().textContent).not.toContain('stopped')
    expect(dialog().textContent).toContain('Translating…')
  })

  it('an error before any text is the plain warning', async () => {
    render()
    await act(async () => calls()[0].reject(new TranslateError('failed', 'network')))
    expect(body().textContent).toBe('Couldn’t translate.')
    expect(button('Try again')).toBeDefined()
  })

  it('a new request puts the text back at the top', () => {
    render()
    body().scrollTop = 120
    render({ text: `${PASSAGE} Elle sourit.` })
    expect(body().scrollTop).toBe(0)
  })
})

describe('without a saved geometry (anchored on the selection, as always)', () => {
  it('reserves the height when it opens and does not place the window again per piece', async () => {
    render()
    const reservedHeight = dialog().style.height
    expect(reservedHeight).toMatch(/^\d+px$/)
    const placements = vi.mocked(placeFloatingPanel).mock.calls.length
    const top = dialog().style.top
    for (const text of ['A', 'A porta', 'A porta do sótão', 'A porta do sótão estava entreaberta']) {
      act(() => calls()[0].input.onPartial?.({ text, closed: false }))
    }
    expect(vi.mocked(placeFloatingPanel).mock.calls.length).toBe(placements)
    expect(dialog().style.height).toBe(reservedHeight)
    expect(dialog().style.top).toBe(top)

    // No fim, um único ajuste: a altura volta a ser a do conteúdo.
    await act(async () => calls()[0].resolve(PASSAGE_RESULT))
    expect(dialog().style.height).toBe('')
    expect(vi.mocked(placeFloatingPanel).mock.calls.length).toBe(placements)
  })

  it('a word has no reserved height', async () => {
    render({ text: 'entrebâillée' })
    expect(dialog().style.height).toBe('')
    await act(async () => calls()[0].resolve(WORD_RESULT))
    expect(dialog().style.height).toBe('')
  })

  it('opens at the default sizes: 440 for a passage, 340 for a word (by class, no inline size)', () => {
    render()
    expect(dialog().style.width).toBe('')
    render({ text: 'entrebâillée' })
    expect(dialog().style.width).toBe('')
  })
})

describe('with a saved geometry', () => {
  const SAVED = { left: 90, top: 70, width: 480, height: 400 }

  it('opens where it was left, at that size, whatever the anchor', () => {
    writeGeometry('passage', SAVED)
    render()
    expect(dialog().style.left).toBe('90px')
    expect(dialog().style.top).toBe('70px')
    expect(dialog().style.width).toBe('480px')
    expect(dialog().style.height).toBe('400px')
    // O teto de 460 do padrão não vale: a altura fixa é a gravada.
    expect(dialog().style.maxHeight).toBe('400px')
    expect(placeFloatingPanel).not.toHaveBeenCalled()
  })

  it('nothing changes size while the text arrives or at the end', async () => {
    writeGeometry('passage', SAVED)
    render()
    const style = () => [dialog().style.left, dialog().style.top, dialog().style.width, dialog().style.height]
    const before = style()
    act(() => calls()[0].input.onPartial?.({ text: 'A porta do sótão', closed: false }))
    expect(style()).toEqual(before)
    await act(async () => calls()[0].resolve(PASSAGE_RESULT))
    expect(style()).toEqual(before)
  })

  it('one geometry per variant: a word does not use the passage one, and too long uses the passage one', () => {
    writeGeometry('passage', SAVED)
    render({ text: 'entrebâillée' })
    expect(dialog().style.width).toBe('')
    const word = { left: 30, top: 40, width: 360, height: 260 }
    writeGeometry('word', word)
    render({ text: 'entrebâillée', savedItem: true })
    // O componente já está montado: a variante não mudou, a geometria foi lida ao abrir.
    expect(dialog().style.width).toBe('')
    act(() => root.unmount())
    root = createRoot(host)
    render({ text: 'entrebâillée' })
    expect(dialog().style.width).toBe('360px')
    act(() => root.unmount())
    root = createRoot(host)
    render({ text: 'x'.repeat(1600) })
    expect(dialog().style.width).toBe('480px')
  })

  it('a geometry that does not fit is limited and pushed inside, without saving again', () => {
    const outside = { left: 1100, top: 700, width: 900, height: 2000 }
    writeGeometry('passage', outside)
    const raw = localStorage.getItem(PASSAGE_KEY)
    render()
    expect(dialog().style.width).toBe('640px')
    expect(dialog().style.height).toBe('784px')
    expect(dialog().style.left).toBe(`${1200 - 8 - 640}px`)
    expect(dialog().style.top).toBe('8px')
    expect(localStorage.getItem(PASSAGE_KEY)).toBe(raw)
  })

  it('when the app window is resized with the popover open, it is limited again, and it comes back when it fits', () => {
    writeGeometry('passage', { left: 700, top: 300, width: 480, height: 400 })
    render()
    expect(dialog().style.left).toBe('700px')
    const raw = localStorage.getItem(PASSAGE_KEY)

    setViewport(800, 600)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(dialog().style.left).toBe(`${800 - 8 - 480}px`)
    expect(dialog().style.top).toBe(`${600 - 8 - 400}px`)
    expect(localStorage.getItem(PASSAGE_KEY)).toBe(raw)

    setViewport(1200, 800)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(dialog().style.left).toBe('700px')
    expect(dialog().style.top).toBe('300px')
  })

  it('a double click on the header erases the geometry of that variant only, and goes back to the default', () => {
    writeGeometry('passage', SAVED)
    writeGeometry('word', { left: 30, top: 40, width: 360, height: 260 })
    render()
    act(() => {
      header().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(localStorage.getItem(PASSAGE_KEY)).toBeNull()
    expect(readGeometry('word')).not.toBeNull()
    expect(dialog().style.width).toBe('')
    expect(placeFloatingPanel).toHaveBeenCalled()
  })

  it('a double click on the X does not reset', () => {
    writeGeometry('passage', SAVED)
    render()
    act(() => {
      dialog().querySelector('button[aria-label="Close"]')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(readGeometry('passage')).toEqual(SAVED)
  })
})

describe('moving and resizing', () => {
  const START = { left: 100, top: 120, width: 440, height: 360 }

  it('the eight handles and the header are inside the root, so the click outside ignores them', () => {
    render()
    expect(handles()).toHaveLength(8)
    for (const el of [...handles(), header()]) expect(rootRef.current!.contains(el)).toBe(true)
  })

  it('dragging the header moves the window and saves once, when the pointer is released', () => {
    render()
    stubRect(START)
    const setItem = vi.spyOn(localStorage, 'setItem')
    pointer(header(), 'pointerdown', 150, 130)
    expect(Element.prototype.setPointerCapture).toHaveBeenCalled()
    pointer(header(), 'pointermove', 190, 150)
    pointer(header(), 'pointermove', 250, 200)
    expect(dialog().style.left).toBe('200px')
    expect(dialog().style.top).toBe('190px')
    expect(dialog().style.width).toBe('440px')
    expect(dialog().style.height).toBe('360px')
    expect(setItem).not.toHaveBeenCalled()

    pointer(header(), 'pointerup', 250, 200)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(readGeometry('passage')).toEqual({ left: 200, top: 190, width: 440, height: 360 })
    expect(readGeometry('word')).toBeNull()
  })

  it('a click on the header that does not move saves nothing', () => {
    render()
    stubRect(START)
    pointer(header(), 'pointerdown', 150, 130)
    pointer(header(), 'pointerup', 150, 130)
    expect(readGeometry('passage')).toBeNull()
  })

  describe('the drag threshold (4 px)', () => {
    const geometryStyle = () => {
      const { left, top, width, height, maxHeight } = dialog().style
      return [left, top, width, height, maxHeight]
    }

    it('a click with 2 px of tremor on the header moves nothing and saves nothing', () => {
      render()
      stubRect(START)
      const before = geometryStyle()
      const setItem = vi.spyOn(localStorage, 'setItem')
      pointer(header(), 'pointerdown', 150, 130)
      pointer(header(), 'pointermove', 152, 130)
      pointer(header(), 'pointermove', 151, 131)
      pointer(header(), 'pointerup', 151, 131)
      expect(geometryStyle()).toEqual(before)
      expect(setItem).not.toHaveBeenCalled()
      expect(readGeometry('passage')).toBeNull()
    })

    it('the same on a resize handle, an edge or a corner', () => {
      render()
      stubRect(START)
      const before = geometryStyle()
      const setItem = vi.spyOn(localStorage, 'setItem')
      for (const target of [handle('e'), handle('se'), handle('n'), handle('nw')]) {
        pointer(target, 'pointerdown', 300, 300)
        pointer(target, 'pointermove', 302, 301)
        pointer(target, 'pointerup', 302, 301)
      }
      expect(geometryStyle()).toEqual(before)
      expect(setItem).not.toHaveBeenCalled()
      expect(readGeometry('passage')).toBeNull()
    })

    it('the cursor state comes with the pointerdown and goes away at the release, even with no drag', () => {
      render()
      stubRect(START)
      pointer(header(), 'pointerdown', 150, 130)
      expect(dialog().dataset.gesture).toBe('move')
      pointer(header(), 'pointerup', 150, 130)
      expect(dialog().dataset.gesture).toBeUndefined()
    })

    it('a drag of 5 px counts, with the whole delta (no jump back over the first 4 px)', () => {
      render()
      stubRect(START)
      pointer(header(), 'pointerdown', 150, 130)
      pointer(header(), 'pointermove', 155, 130)
      expect(dialog().style.left).toBe('105px')
      expect(dialog().style.top).toBe('120px')
      pointer(header(), 'pointerup', 155, 130)
      expect(readGeometry('passage')).toEqual({ left: 105, top: 120, width: 440, height: 360 })
    })

    it('a resize of 5 px counts too, with the whole delta', () => {
      render()
      stubRect(START)
      pointer(handle('se'), 'pointerdown', 540, 480)
      pointer(handle('se'), 'pointermove', 545, 480)
      pointer(handle('se'), 'pointerup', 545, 480)
      expect(readGeometry('passage')).toEqual({ left: 100, top: 120, width: 445, height: 360 })
    })

    it('once past the threshold the gesture stays valid, even back near the origin', () => {
      render()
      stubRect(START)
      pointer(header(), 'pointerdown', 150, 130)
      pointer(header(), 'pointermove', 160, 130)
      pointer(header(), 'pointermove', 151, 130)
      expect(dialog().style.left).toBe('101px')
      pointer(header(), 'pointerup', 151, 130)
      expect(readGeometry('passage')).toEqual({ left: 101, top: 120, width: 440, height: 360 })
    })

    it('a double click with a little tremor still goes back to the default and leaves no key', () => {
      writeGeometry('passage', START)
      render()
      const setItem = vi.spyOn(localStorage, 'setItem')
      for (let click = 0; click < 2; click++) {
        pointer(header(), 'pointerdown', 150, 130)
        pointer(header(), 'pointermove', 151, 132)
        pointer(header(), 'pointerup', 151, 132)
      }
      act(() => {
        header().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      })
      expect(setItem).not.toHaveBeenCalled()
      expect(localStorage.getItem(PASSAGE_KEY)).toBeNull()
      expect(dialog().style.width).toBe('')
    })
  })

  it('the X does not start a drag', () => {
    render()
    stubRect(START)
    const close = dialog().querySelector('button[aria-label="Close"]')!
    pointer(close, 'pointerdown', 150, 130)
    pointer(close, 'pointermove', 400, 400)
    pointer(close, 'pointerup', 400, 400)
    expect(readGeometry('passage')).toBeNull()
  })

  it('the window does not leave the app window when dragged', () => {
    render()
    stubRect(START)
    pointer(header(), 'pointerdown', 150, 130)
    pointer(header(), 'pointermove', -4000, -4000)
    expect(dialog().style.left).toBe('8px')
    expect(dialog().style.top).toBe('8px')
    pointer(header(), 'pointermove', 9000, 9000)
    expect(dialog().style.left).toBe(`${1200 - 8 - 440}px`)
    expect(dialog().style.top).toBe(`${800 - 8 - 360}px`)
  })

  it('a handle resizes, with the minimum, and saves on release', () => {
    render()
    stubRect(START)
    pointer(handle('se'), 'pointerdown', 540, 480)
    pointer(handle('se'), 'pointermove', 600, 540)
    expect(dialog().style.width).toBe('500px')
    expect(dialog().style.height).toBe('420px')
    expect(dialog().style.left).toBe('100px')
    pointer(handle('se'), 'pointermove', -2000, -2000)
    expect(dialog().style.width).toBe('300px')
    expect(dialog().style.height).toBe('220px')
    pointer(handle('se'), 'pointerup', -2000, -2000)
    expect(readGeometry('passage')).toEqual({ left: 100, top: 120, width: 300, height: 220 })
  })

  it('the west handle keeps the right edge still', () => {
    render()
    stubRect(START)
    pointer(handle('w'), 'pointerdown', 100, 300)
    pointer(handle('w'), 'pointermove', 60, 300)
    expect(dialog().style.left).toBe('60px')
    expect(dialog().style.width).toBe('480px')
  })

  it('the taller window is not stopped by the default 460 px', () => {
    render()
    stubRect({ left: 100, top: 8, width: 440, height: 300 })
    pointer(handle('s'), 'pointerdown', 300, 308)
    pointer(handle('s'), 'pointermove', 300, 2000)
    expect(dialog().style.height).toBe('784px')
    expect(dialog().style.maxHeight).toBe('784px')
  })

  it('a canceled gesture goes back to what it was and saves nothing', () => {
    render()
    stubRect(START)
    pointer(header(), 'pointerdown', 150, 130)
    pointer(header(), 'pointermove', 300, 300)
    pointer(header(), 'pointercancel', 300, 300)
    expect(dialog().style.left).toBe('100px')
    expect(readGeometry('passage')).toBeNull()
  })

  it('the geometry saved by the gesture is what the next one opens at', () => {
    render()
    stubRect(START)
    pointer(header(), 'pointerdown', 150, 130)
    pointer(header(), 'pointermove', 250, 230)
    pointer(header(), 'pointerup', 250, 230)
    act(() => root.unmount())
    root = createRoot(host)
    render()
    expect(dialog().style.left).toBe('200px')
    expect(dialog().style.top).toBe('220px')
    expect(dialog().style.height).toBe('360px')
  })

  it('a word saves its own geometry, apart from the passage', () => {
    render({ text: 'entrebâillée' })
    stubRect({ left: 100, top: 120, width: 340, height: 240 })
    pointer(header(), 'pointerdown', 150, 130)
    pointer(header(), 'pointermove', 170, 130)
    pointer(header(), 'pointerup', 170, 130)
    expect(readGeometry('word')).toEqual({ left: 120, top: 120, width: 340, height: 240 })
    expect(readGeometry('passage')).toBeNull()
  })

  it('the mousedown of the header and of the handles does not undo the selection of the book', () => {
    render()
    for (const target of [header(), handle('n'), handle('sw')]) {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      act(() => {
        target.dispatchEvent(event)
      })
      expect(event.defaultPrevented).toBe(true)
    }
  })

  it('the mouseup of the handles does not reach the page', () => {
    render()
    const onMouseUp = vi.fn()
    document.addEventListener('mouseup', onMouseUp)
    act(() => {
      handle('e').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    document.removeEventListener('mouseup', onMouseUp)
    expect(onMouseUp).not.toHaveBeenCalled()
  })
})
