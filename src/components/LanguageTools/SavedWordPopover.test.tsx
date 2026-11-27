import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VocabularyItem } from '../../types'

vi.mock('@phosphor-icons/react', () => ({
  MagnifyingGlass: () => null,
  Plus: () => null,
  SpeakerHigh: () => null,
  Translate: () => null,
  Trash: () => null,
  X: () => null,
}))

import { SavedWordPopover } from './SavedWordPopover'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// O SavedWordPopover divide a folha de estilo com a janela de tradução (`.popover`,
// `.header`, `.body`, `.context`, `.actions`), mas continua ancorado na palavra:
// nada de mover nem de redimensionar.
const ITEM = {
  id: 'item-1',
  bookId: 'book-1',
  text: 'entrebâillée',
  kind: 'word',
  sentence: "La porte du grenier était entrebâillée et il n'y avait pas de lumière.",
  sense: 'entreaberta',
  baseForm: null,
  language: 'fr',
  page: 12,
  positionLabel: 'p. 12',
  createdAt: '2026-11-20T10:00:00.000Z',
  sentAt: null,
} as unknown as VocabularyItem

let host: HTMLDivElement
let root: Root
const rootRef = createRef<HTMLDivElement>()

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => {
    root.render(
      <SavedWordPopover
        rootRef={rootRef}
        anchor={{ x: 200, y: 300, w: 80, h: 20 }}
        term="entrebâillée"
        items={[ITEM]}
        bookId="book-1"
        bookTitles={new Map()}
        onListen={vi.fn()}
        onTranslateHere={vi.fn()}
        onAddSentence={vi.fn()}
        onFind={vi.fn()}
        onRemove={vi.fn()}
        onClose={vi.fn()}
      />,
    )
  })
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('SavedWordPopover with the shared stylesheet', () => {
  it('renders the saved sentence and its actions', () => {
    const popover = rootRef.current!
    expect(popover.textContent).toContain('entreaberta')
    const labels = Array.from(popover.querySelectorAll('button')).map((b) => b.textContent?.trim())
    expect(labels).toEqual(expect.arrayContaining(['Listen', 'Translate here', 'Add this sentence', 'Find in book', 'Remove']))
  })

  it('stays anchored: placed by the selection, with no drag header and no resize handles', () => {
    const popover = rootRef.current!
    expect(popover.style.left).not.toBe('')
    expect(popover.style.top).not.toBe('')
    expect(popover.querySelector('[title^="Drag to move"]')).toBeNull()
    expect(popover.querySelectorAll(':scope > div[aria-hidden="true"]')).toHaveLength(0)
  })
})
