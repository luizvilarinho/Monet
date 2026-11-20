import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { buildBaseExtensions } from './extensions'
import { buttonTitle, canTurnInto, insertBlock, runAction, turnBlockInto, wrapSelectionInToggle } from './formattingActions'
import { duplicateBlockUnit } from './blockDrag'
import { commandLineHint, getCommandSuggestions, isPotentialCommandLine } from './commandParser'

let editor: Editor

beforeEach(() => {
  editor = new Editor({ extensions: buildBaseExtensions('') })
})

afterEach(() => {
  editor.destroy()
})

function save(): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
}

// Grava, reabre e grava de novo: o doc e o markdown não mudam.
function expectStable(): void {
  const doc = editor.getJSON()
  const saved = save()
  editor.commands.setContent(saved)
  expect(editor.getJSON()).toEqual(doc)
  expect(save()).toBe(saved)
}

// Seleção do início do bloco `a` ao fim do bloco `b` (índices de topo).
function selectBlocks(a: number, b: number): void {
  const { doc } = editor.state
  let from = 0
  for (let i = 0; i < a; i++) from += doc.child(i).nodeSize
  let to = 0
  for (let i = 0; i <= b; i++) to += doc.child(i).nodeSize
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.between(doc.resolve(from + 1), doc.resolve(to - 1)))
  )
}

// Blocos de topo, sem o parágrafo vazio que o editor mantém no fim.
function top(): JSONContent[] {
  const blocks = editor.getJSON().content ?? []
  const last = blocks[blocks.length - 1]
  return last?.type === 'paragraph' && !last.content ? blocks.slice(0, -1) : blocks
}

function paragraph(text: string): JSONContent {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

// Posição do item de lista cujo parágrafo tem `text`.
function itemPos(text: string): number {
  let pos = -1
  editor.state.doc.descendants((node, p) => {
    if ((node.type.name === 'listItem' || node.type.name === 'taskItem') && node.firstChild?.textContent === text) pos = p
  })
  return pos
}

// Texto do 1º parágrafo de cada item da lista.
function itemTexts(list: JSONContent): Array<string | undefined> {
  return list.content?.map((item) => item.content?.[0]?.content?.[0]?.text) ?? []
}

describe('toggle that wraps the selection', () => {
  it('turns the first block into the title and keeps the rest with its formatting', () => {
    editor.commands.setContent('Plan **A**\n\nStep *one*\n\n- item\n\nafter')
    selectBlocks(0, 2)
    expect(wrapSelectionInToggle(editor)).toBe(true)
    const [toggle, after] = top()
    expect(toggle.type).toBe('toggleBlock')
    expect(toggle.attrs).toMatchObject({ title: 'Plan A', collapsed: false })
    expect(toggle.content?.map((n) => n.type)).toEqual(['paragraph', 'bulletList'])
    expect(toggle.content?.[0].content?.[1]).toMatchObject({ text: 'one', marks: [{ type: 'italic' }] })
    expect(after).toMatchObject({ type: 'paragraph', content: [{ text: 'after' }] })
    expectStable()
  })

  it('a single line becomes the title over an empty body', () => {
    editor.commands.setContent('<p>Only line</p>')
    selectBlocks(0, 0)
    // O doc da transação do wrap: sem a node view montada (editor fora da
    // tela), o cursor no corpo vazio faz o PM reler o DOM e desfazer o toggle.
    const spy = vi.spyOn(editor.view, 'dispatch')
    wrapSelectionInToggle(editor)
    const [toggle] = (spy.mock.calls[0][0].doc.toJSON() as JSONContent).content ?? []
    spy.mockRestore()
    expect(toggle.attrs?.title).toBe('Only line')
    expect(toggle.content).toEqual([{ type: 'paragraph' }])
  })

  it('inside a list item it wraps the whole list (no title from a list)', () => {
    editor.commands.setContent('- one\n- two')
    editor.commands.setTextSelection(3)
    wrapSelectionInToggle(editor)
    const [toggle] = top()
    expect(toggle.type).toBe('toggleBlock')
    expect(toggle.attrs?.title).toBe('')
    expect(toggle.content?.[0].type).toBe('bulletList')
    expectStable()
  })

  it('a code block with a blank line goes to the body and the note reopens whole', () => {
    editor.commands.setContent('```js\nconst a = 1\n\nconst b = 2\n```\n\nafter text')
    selectBlocks(0, 0)
    wrapSelectionInToggle(editor)
    const [toggle, after] = top()
    expect(toggle.attrs?.title).toBe('')
    expect(toggle.content?.[0]).toMatchObject({ type: 'codeBlock', content: [{ text: 'const a = 1\n\nconst b = 2' }] })
    expect(after).toMatchObject({ type: 'paragraph', content: [{ text: 'after text' }] })
    expectStable()
  })

  it('a link, a mark or a task in the first block keeps it in the body', () => {
    const firsts: JSONContent[] = [
      { type: 'paragraph', content: [{ type: 'text', text: 'docs', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'this', marks: [{ type: 'noteMark', attrs: { label: 'todo' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Do ' }, { type: 'taskRef', attrs: { id: 't1' } }] },
    ]
    for (const first of firsts) {
      editor.commands.setContent({ type: 'doc', content: [first, paragraph('body')] })
      selectBlocks(0, 1)
      wrapSelectionInToggle(editor)
      const [toggle] = top()
      expect(toggle.attrs?.title).toBe('')
      expect(toggle.content).toMatchObject([first, paragraph('body')])
      expectStable()
    }
  })

  it('line breaks in the first block become spaces in the title', () => {
    editor.commands.setContent('<p>line1<br><br>line2</p><p>body</p><p>after</p>')
    selectBlocks(0, 1)
    wrapSelectionInToggle(editor)
    const [toggle] = top()
    expect(toggle.attrs?.title).toBe('line1 line2')
    expect(toggle.content).toEqual([paragraph('body')])
  })

  it('a title with line breaks stays on the tag line and reopens the same', () => {
    const title = 'const a = 1\n\nconst b = "2"\r'
    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'toggleBlock', attrs: { title, collapsed: false }, content: [paragraph('body')] },
        paragraph('after'),
      ],
    })
    expect(save().split('\n')[0]).toBe(
      '<div data-type="toggle-block" data-title="const a = 1&#10;&#10;const b = &quot;2&quot;&#13;" data-collapsed="false">'
    )
    expectStable()
    expect(top().map((n) => n.type)).toEqual(['toggleBlock', 'paragraph'])
    expect(top()[0].attrs?.title).toBe(title)
  })

  it('the Toggle button inside a toggle unwraps it, title first', () => {
    editor.commands.setContent('<p>Title</p><p>Body</p>')
    selectBlocks(0, 1)
    expect(buttonTitle(editor, 'toggle', 'Toggle')).toBe('Toggle')
    wrapSelectionInToggle(editor)
    expect(buttonTitle(editor, 'toggle', 'Toggle')).toMatch(/^Unwrap toggle/)
    runAction(editor, 'toggle')
    expect(top().map((n) => [n.type, n.content?.[0]?.text])).toEqual([
      ['paragraph', 'Title'],
      ['paragraph', 'Body'],
    ])
  })
})

describe('Insert menu blocks', () => {
  it('a divider replaces the empty line of the cursor', () => {
    editor.commands.setContent('<p>text</p><p></p>')
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    insertBlock(editor, 'divider')
    // O parágrafo vazio depois da divisória é o do cursor (top() o omite).
    expect(top().map((n) => n.type)).toEqual(['paragraph', 'horizontalRule'])
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('a table goes below the line of the cursor, with the cursor in it', () => {
    editor.commands.setContent('<p>text</p>')
    editor.commands.setTextSelection(2)
    insertBlock(editor, 'table')
    expect(top().map((n) => n.type)).toEqual(['paragraph', 'table'])
    expect(editor.isActive('table')).toBe(true)
  })
})

describe('Turn into', () => {
  it('a paragraph becomes a heading and a list item becomes text', () => {
    editor.commands.setContent('Hello\n\n- item')
    turnBlockInto(editor, 0, editor.state.doc.child(0), 'h2')
    expect(top()[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } })
    const listPos = editor.state.doc.child(0).nodeSize
    const itemPos = listPos + 1
    turnBlockInto(editor, itemPos, editor.state.doc.nodeAt(itemPos)!, 'paragraph')
    expect(top().map((n) => n.type)).toEqual(['heading', 'paragraph'])
  })

  it('an item with subitems: only the item changes, the subitems follow it (one undo)', () => {
    editor.commands.setContent('- before\n- parent\n  - child one\n  - child two\n- sibling')
    editor.view.dispatch(closeHistory(editor.state.tr))
    const start = editor.getJSON()
    const pos = itemPos('parent')
    turnBlockInto(editor, pos, editor.state.doc.nodeAt(pos)!, 'h1')
    const [before, heading, rest] = top()
    expect(itemTexts(before)).toEqual(['before'])
    expect(heading).toMatchObject({ type: 'heading', attrs: { level: 1 }, content: [{ text: 'parent' }] })
    expect(rest.type).toBe('bulletList')
    expect(itemTexts(rest)).toEqual(['child one', 'child two', 'sibling'])
    const turned = editor.getJSON()
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(start)
    editor.commands.redo()
    expect(editor.getJSON()).toEqual(turned)
    expectStable()
  })

  it('a checklist item with subitems becomes a numbered item, subitems kept', () => {
    editor.commands.setContent('- [ ] parent\n  - [ ] child\n- [ ] sibling')
    const pos = itemPos('parent')
    turnBlockInto(editor, pos, editor.state.doc.nodeAt(pos)!, 'ol')
    const [numbered, rest] = top()
    expect(numbered.type).toBe('orderedList')
    expect(itemTexts(numbered)).toEqual(['parent'])
    expect(rest.type).toBe('taskList')
    expect(itemTexts(rest)).toEqual(['child', 'sibling'])
  })

  it('a quote with more than one block does not offer Turn into', () => {
    editor.commands.setContent('> one\n>\n> two\n\nbetween\n\n> single')
    expect(canTurnInto(editor.state.doc.child(0))).toBe(false)
    expect(canTurnInto(editor.state.doc.child(2))).toBe(true)
  })
})

describe('Duplicate', () => {
  it('the copy of a toggle leaves the AI blocks out (no shared commandId)', () => {
    const embed = (commandId: string): JSONContent => ({ type: 'embedBlock', attrs: { commandId, collapsed: true } })
    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'toggleBlock', attrs: { title: 'Pair', collapsed: false }, content: [paragraph('/summarize'), embed('c1')] },
        { type: 'toggleBlock', attrs: { title: 'Only AI', collapsed: false }, content: [embed('c2')] },
      ],
    })
    // O doc da transação: o cursor no corpo vazio da 2ª cópia faria o PM
    // reler o DOM sem a node view montada (ver o wrap de uma linha só).
    const spy = vi.spyOn(editor.view, 'dispatch')
    duplicateBlockUnit(editor.view, { pos: 0, node: editor.state.doc.child(0) })
    const { doc: afterFirst } = editor.state
    duplicateBlockUnit(editor.view, { pos: afterFirst.child(0).nodeSize + afterFirst.child(1).nodeSize, node: afterFirst.child(2) })
    const blocks = (spy.mock.calls[spy.mock.calls.length - 1][0].doc.toJSON() as JSONContent).content ?? []
    spy.mockRestore()
    const toggles = blocks.filter((n) => n.type === 'toggleBlock')
    expect(toggles.map((n) => [n.attrs?.title, n.content?.map((c) => c.attrs?.commandId ?? c.content?.[0]?.text ?? '')])).toEqual([
      ['Pair', ['/summarize', 'c1']],
      ['Pair', ['/summarize']],
      ['Only AI', ['c2']],
      ['Only AI', ['']],
    ])
  })
})

describe('command line detection', () => {
  it('paths and fractions are plain text, "/name" is a command line', () => {
    expect(isPotentialCommandLine('/usr/bin')).toBe(false)
    expect(isPotentialCommandLine('1/2')).toBe(false)
    expect(isPotentialCommandLine('/notes.md')).toBe(false)
    expect(isPotentialCommandLine('/')).toBe(true)
    expect(isPotentialCommandLine('/define term')).toBe(true)
    expect(isPotentialCommandLine('/nope')).toBe(true)
  })

  it('hints say why the line does not run', () => {
    expect(commandLineHint('/nope', 'invalid')).toBe('Unknown command · type / to see the list')
    expect(commandLineHint('/define', 'incomplete')).toMatch(/^\/define needs a query · e\.g\. /)
  })

  it('suggestions come grouped (Understand before Blocks)', () => {
    const all = getCommandSuggestions('/')
    expect(all.indexOf('/define')).toBeLessThan(all.indexOf('/tasks'))
  })
})
