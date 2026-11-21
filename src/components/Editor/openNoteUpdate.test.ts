import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildBaseExtensions } from './extensions'

// Base da guarda do `onUpdate` (Editor.tsx e KeepPanel.tsx só chamam o onChange
// quando o markdown muda): abrir uma nota que termina em bloco que não é
// parágrafo faz o TrailingNode acrescentar um parágrafo vazio e o Tiptap emitir
// `update`, mas o markdown gravado continua igual ao da nota. Uma edição de
// verdade muda o markdown.

const editors: Editor[] = []

afterEach(() => {
  while (editors.length) editors.pop()!.destroy()
})

function markdownOf(editor: Editor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
}

function open(content: string): Editor {
  const editor = new Editor({ extensions: buildBaseExtensions(''), content })
  editors.push(editor)
  return editor
}

// Forma gravada da nota: o que o app guarda depois de abrir e salvar.
function stored(md: string): string {
  return markdownOf(open(md))
}

function watchUpdates(editor: Editor): string[] {
  const seen: string[] = []
  editor.on('update', ({ editor: ed }) => seen.push(markdownOf(ed)))
  return seen
}

// Transação só de meta, como as da montagem do Editor (syncExecuted etc.).
function metaOnly(editor: Editor): void {
  editor.view.dispatch(editor.state.tr.setMeta('open', true))
}

const NOTES: Array<[string, string]> = [
  ['embed block (AI response)', '/planner\n\n<embed-block data-cmd="c1" data-collapsed="false"></embed-block>'],
  ['bullet list', 'intro\n\n- a\n- b'],
  ['task list', 'intro\n\n- [ ] a\n- [x] b'],
  ['heading', 'intro\n\n## Title'],
  ['table', 'intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |'],
  ['code block', 'intro\n\n```js\nconst a = 1\n```'],
  ['toggle', 'intro\n\n<div data-type="toggle-block" data-title="T" data-collapsed="false">\n\nbody\n\n</div>'],
  ['quote', 'intro\n\n> quoted'],
]

describe('opening a note does not change its markdown', () => {
  for (const [name, md] of NOTES) {
    it(`${name}: the trailing paragraph is added and the markdown stays the same`, () => {
      const saved = stored(md)
      const editor = open(saved)
      const seen = watchUpdates(editor)
      expect(editor.state.doc.lastChild?.type.name).not.toBe('paragraph')

      metaOnly(editor)

      expect(editor.state.doc.lastChild?.type.name).toBe('paragraph')
      expect(seen.length).toBeGreaterThan(0)
      for (const emitted of seen) expect(emitted).toBe(saved)
    })

    it(`${name}: the first key after opening changes the markdown`, () => {
      const saved = stored(md)
      const editor = open(saved)
      const seen = watchUpdates(editor)
      metaOnly(editor)

      const end = editor.state.doc.content.size - 1
      editor.view.dispatch(editor.state.tr.insertText('x', end))

      expect(seen[seen.length - 1]).not.toBe(saved)
    })

    it(`${name}: clearing the note changes the markdown`, () => {
      const saved = stored(md)
      const editor = open(saved)
      const seen = watchUpdates(editor)
      metaOnly(editor)

      editor.commands.clearContent(true)

      expect(seen[seen.length - 1]).toBe('')
      expect(seen[seen.length - 1]).not.toBe(saved)
    })
  }

  it('a note that ends in a paragraph emits no update on open', () => {
    const saved = stored('intro\n\nclosing paragraph')
    const editor = open(saved)
    const seen = watchUpdates(editor)

    metaOnly(editor)

    expect(seen).toEqual([])
  })
})
