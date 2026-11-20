import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { buildBaseExtensions } from './extensions'

// Round-trip markdown → editor → markdown com o mesmo conjunto de extensões do
// Editor e da keep. O editor fica desmontado (sem elemento), então os node
// views não são criados.

let editor: Editor

beforeEach(() => {
  editor = new Editor({ extensions: buildBaseExtensions('') })
})

afterEach(() => {
  editor.destroy()
})

function load(md: string): JSONContent {
  editor.commands.setContent(md)
  return editor.getJSON()
}

function save(): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
}

// Abre, grava, reabre e grava de novo: o doc e o markdown não podem mudar.
function expectStable(md: string): { doc: JSONContent; saved: string } {
  const doc = load(md)
  const saved = save()
  expect(load(saved)).toEqual(doc)
  expect(save()).toBe(saved)
  return { doc, saved }
}

function findAll(node: JSONContent, type: string): JSONContent[] {
  const own = node.type === type ? [node] : []
  return own.concat(...(node.content ?? []).map((child) => findAll(child, type)))
}

function textOf(node: JSONContent): string {
  return node.text ?? (node.content ?? []).map(textOf).join('')
}

function toggles(doc: JSONContent): JSONContent[] {
  return findAll(doc, 'toggleBlock')
}

function lastBlock(doc: JSONContent): JSONContent {
  const blocks = doc.content ?? []
  return blocks[blocks.length - 1]
}

const OPEN = (title = 'T') => `<div data-type="toggle-block" data-title="${title}" data-collapsed="false">`

const CODE = 'const a = 1\n\nconst b = 2\n# not a title *x*'
const MERMAID = 'flowchart TD\n  A --> B\n\n  B --> C'

describe('toggle block markdown round-trip', () => {
  it('(a) keeps a code block with a blank line inside a toggle', () => {
    const md = [OPEN(), '', 'intro', '', '```js', CODE, '```', '', '</div>', '', 'after'].join('\n')
    const { doc, saved } = expectStable(md)
    const [toggle] = toggles(doc)
    const [code] = findAll(toggle, 'codeBlock')
    expect(code.attrs?.language).toBe('js')
    expect(textOf(code)).toBe(CODE)
    expect(findAll(doc, 'heading')).toHaveLength(0)
    expect(saved).toContain('```js\n' + CODE + '\n```')
    expect(lastBlock(doc).type).toBe('paragraph')
    expect(textOf(lastBlock(doc))).toBe('after')
  })

  it('(b) keeps a Mermaid block with a blank line inside a toggle', () => {
    const md = [OPEN('M'), '', '```mermaid', MERMAID, '```', '', '</div>'].join('\n')
    const { doc } = expectStable(md)
    const [code] = findAll(toggles(doc)[0], 'codeBlock')
    expect(code.attrs?.language).toBe('mermaid')
    expect(textOf(code)).toBe(MERMAID)
  })

  it('(c) keeps an empty paragraph between paragraphs inside a toggle', () => {
    const md = [OPEN(), '', 'first', '', '<br>', '', 'second', '', '</div>'].join('\n')
    const { doc } = expectStable(md)
    const children = toggles(doc)[0].content ?? []
    expect(children.map((c) => c.type)).toEqual(['paragraph', 'paragraph', 'paragraph'])
    expect(children.map(textOf)).toEqual(['first', '', 'second'])
  })

  it('(d) keeps attention marks inside and outside a toggle, and the highlight color', () => {
    const md = [
      '<mark data-mark="">plain</mark> and <span data-bg="#A5D6A7">green</span>',
      '',
      OPEN(),
      '',
      '<mark data-mark="todo">marked</mark> text',
      '',
      '</div>',
    ].join('\n')
    const { doc, saved } = expectStable(md)
    const marksOf = (node: JSONContent) =>
      findAll(node, 'text').flatMap((t) => (t.marks ?? []).map((m) => ({ text: t.text, ...m })))
    const outside = marksOf(doc.content![0])
    expect(outside).toContainEqual({ text: 'plain', type: 'noteMark', attrs: { label: null } })
    expect(outside).toContainEqual({ text: 'green', type: 'highlight', attrs: { color: '#A5D6A7' } })
    expect(marksOf(toggles(doc)[0])).toContainEqual({ text: 'marked', type: 'noteMark', attrs: { label: 'todo' } })
    expect(saved).toContain('<mark data-mark="todo">marked</mark>')
    expect(saved).toContain('<span data-bg="#A5D6A7">green</span>')
  })

  it('(e) keeps a nested toggle with a code block with a blank line', () => {
    const md = [
      OPEN('outer'), '', 'outer text', '',
      OPEN('inner'), '', '```', 'x', '', 'y', '```', '', '</div>', '',
      'outer tail', '', '</div>', '', 'after',
    ].join('\n')
    const { doc } = expectStable(md)
    const [outer, inner] = toggles(doc)
    expect(outer.attrs?.title).toBe('outer')
    expect(inner.attrs?.title).toBe('inner')
    expect(outer.content?.map((c) => c.type)).toEqual(['paragraph', 'toggleBlock', 'paragraph'])
    expect(textOf(findAll(inner, 'codeBlock')[0])).toBe('x\n\ny')
    expect(textOf(outer.content![2])).toBe('outer tail')
    expect(textOf(lastBlock(doc))).toBe('after')
  })

  it('(f) keeps a task list inside a toggle', () => {
    const md = [OPEN(), '', '- [ ] todo', '- [x] done', '', '</div>'].join('\n')
    const { doc } = expectStable(md)
    const items = findAll(toggles(doc)[0], 'taskItem')
    expect(items.map(textOf)).toEqual(['todo', 'done'])
    expect(items.map((i) => i.attrs?.checked)).toEqual([false, true])
  })

  it('(g) escapes the title and reads it back unchanged', () => {
    const title = 'say "hi" <now> & more'
    editor.commands.setContent({
      type: 'doc',
      content: [{ type: 'toggleBlock', attrs: { title }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'body' }] }] }],
    })
    const md = save()
    expect(md.split('\n')[0]).toBe(OPEN('say &quot;hi&quot; &lt;now&gt; &amp; more'))
    const { doc } = expectStable(md)
    expect(toggles(doc)[0].attrs?.title).toBe(title)
  })

  describe('(h) old format (HTML glued to the opening tag)', () => {
    it('opens a code block with a blank line whole and saves it in the new format', () => {
      const md = `${OPEN()}<p>intro</p><pre><code class="language-js">const a = 1\n\nconst b = 2\n# not a title *x*</code></pre></div>\n\nafter`
      const doc = load(md)
      const [toggle] = toggles(doc)
      expect(toggle.content?.map((c) => c.type)).toEqual(['paragraph', 'codeBlock'])
      expect(textOf(toggle.content![1])).toBe(CODE)
      expect(findAll(doc, 'heading')).toHaveLength(0)
      expect(textOf(lastBlock(doc))).toBe('after')
      const saved = save()
      expect(saved.startsWith(OPEN() + '\n\nintro\n\n```js\n' + CODE + '\n```\n\n</div>')).toBe(true)
      expect(load(saved)).toEqual(doc)
      expect(save()).toBe(saved)
    })

    it('opens a Mermaid block with a blank line whole', () => {
      const md = `${OPEN('M')}<pre><code class="language-mermaid">flowchart TD\n  A --&gt; B\n\n  B --&gt; C</code></pre></div>\n\nafter`
      const doc = load(md)
      const [code] = findAll(toggles(doc)[0], 'codeBlock')
      expect(code.attrs?.language).toBe('mermaid')
      expect(textOf(code)).toBe(MERMAID)
      const saved = save()
      expect(saved).toContain('```mermaid\n' + MERMAID + '\n```')
      expect(load(saved)).toEqual(doc)
    })

    it('opens a nested toggle with a blank line in the child code', () => {
      const md = `${OPEN('o')}<p>a</p>${OPEN('i')}<pre><code>x\n\ny</code></pre></div><p>b</p></div>\n\nafter`
      const doc = load(md)
      const [outer, inner] = toggles(doc)
      expect(outer.content?.map((c) => c.type)).toEqual(['paragraph', 'toggleBlock', 'paragraph'])
      expect(textOf(findAll(inner, 'codeBlock')[0])).toBe('x\n\ny')
      expect(textOf(outer.content![2])).toBe('b')
      expect(textOf(lastBlock(doc))).toBe('after')
      const saved = save()
      expect(load(saved)).toEqual(doc)
      expect(save()).toBe(saved)
    })

    it('opens a toggle without a blank line as before', () => {
      const md = `${OPEN()}<p>a</p><p>b</p></div>\n\nafter`
      const doc = load(md)
      expect(toggles(doc)[0].content?.map(textOf)).toEqual(['a', 'b'])
      expect(textOf(lastBlock(doc))).toBe('after')
      expectStable(save())
    })
  })

  it('(i) opens a note already damaged by the old bug without further loss', () => {
    const md = `${OPEN()}<p>intro</p><pre><code class="language-js">const a = 1\n</code></pre></div>\n\nconst b = 2\n\n# not a title *x*\n\nafter`
    const doc = load(md)
    const text = editor.getText()
    for (const part of ['intro', 'const a = 1', 'const b = 2', 'not a title', 'after']) {
      expect(text).toContain(part)
    }
    const saved = save()
    expect(load(saved)).toEqual(doc)
    expect(save()).toBe(saved)
  })

  it('(j) keeps code and Mermaid blocks with a blank line outside a toggle', () => {
    const md = ['```js', CODE, '```', '', '```mermaid', MERMAID, '```', '', 'after'].join('\n')
    const { doc, saved } = expectStable(md)
    const codes = findAll(doc, 'codeBlock')
    expect(codes.map((c) => c.attrs?.language)).toEqual(['js', 'mermaid'])
    expect(codes.map(textOf)).toEqual([CODE, MERMAID])
    expect(saved).toBe(md)
  })
})
