import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildBaseExtensions } from '../components/Editor/extensions'
import { cleanNoteContentForAi } from './noteFileText'

// Texto da IA, do RAG e da busca para toggles com código. O markdown passa
// pelo editor antes, para o toggle sair no formato que a nota grava.

function saved(md: string): string {
  const editor = new Editor({ extensions: buildBaseExtensions('') })
  editor.commands.setContent(md)
  const out = (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
  editor.destroy()
  return out
}

const aiText = (content: string) => cleanNoteContentForAi(content, { resolveNoteTitle: () => undefined })

const OPEN = (title = 'T') => `<div data-type="toggle-block" data-title="${title}" data-collapsed="false">`

describe('AI text of a toggle in the new format', () => {
  it('keeps code with generics, comparisons and an unpaired <div inside a toggle', () => {
    const content = saved(
      [
        OPEN(), '', 'intro', '',
        '```ts',
        'const m: Map<string, number> = new Map()',
        'if (a<b && c>d) {}',
        'const el = "<div class=x>"',
        '```', '',
        '</div>', '',
        'para one', '',
        'para two',
      ].join('\n'),
    )
    expect(aiText(content)).toBe(
      [
        'T', '', 'intro', '',
        '```ts',
        'const m: Map<string, number> = new Map()',
        'if (a<b && c>d) {}',
        'const el = "<div class=x>"',
        '```', '',
        'para one', '',
        'para two',
      ].join('\n'),
    )
  })

  it('keeps inline code with a tag inside a toggle', () => {
    const content = saved([OPEN(), '', 'use `<Component />` here and `a<b`', '', '</div>', '', 'after'].join('\n'))
    expect(aiText(content)).toBe('T\n\nuse `<Component />` here and `a<b`\n\nafter')
  })

  it('does not close the toggle at a </div> inside code', () => {
    const content = saved(
      [
        OPEN(), '', 'x<y and a < b', '',
        '```html', '</div>', '<p>z</p>', '```', '',
        'tail', '',
        '</div>', '',
        'after one', '',
        'after two',
      ].join('\n'),
    )
    const text = aiText(content)
    expect(text).toContain('```html\n</div>\n<p>z</p>\n```')
    expect(text).toContain('tail\n\nafter one\n\nafter two')
    expect(text.endsWith('after two')).toBe(true)
    expect(text.match(/<\/div>/g)).toHaveLength(1)
  })

  it('reads nested toggles and toggles in a list item or a quote', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'toggleBlock',
          attrs: { title: 'outer' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
            {
              type: 'toggleBlock',
              attrs: { title: 'inner' },
              content: [{ type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'let x: Array<number>' }] }],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'item' }] },
                { type: 'toggleBlock', attrs: { title: 'L' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'in list' }] }] },
              ],
            },
          ],
        },
        {
          type: 'blockquote',
          content: [{ type: 'toggleBlock', attrs: { title: 'Q' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'in quote' }] }] }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    }
    const editor = new Editor({ extensions: buildBaseExtensions(''), content: doc })
    const content = (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
    editor.destroy()
    const text = aiText(content)
    expect(text).not.toContain('toggle-block')
    expect(text).not.toContain('</div>')
    expect(text).toContain('outer\n\na\n\ninner\n\n```ts\nlet x: Array<number>\n```')
    expect(text).toContain('  L\n\n  in list')
    expect(text).toContain('> Q\n>\n> in quote')
    expect(text.endsWith('after')).toBe(true)
  })

  it('decodes the title', () => {
    const content = saved([OPEN('say &quot;hi&quot; &lt;now&gt; &amp; more'), '', 'body', '', '</div>'].join('\n'))
    expect(aiText(content)).toBe('say "hi" <now> & more\n\nbody')
  })
})

describe('AI text of a toggle in the old format', () => {
  it('reads the HTML glued to the opening tag as before', () => {
    const content = `${OPEN()}<p>intro</p><pre><code class="language-ts">const m: Map&lt;string, number&gt; = new Map()</code></pre></div>\n\npara one\n\npara two`
    expect(aiText(content)).toBe('T\nintro\nconst m: Map<string, number> = new Map()\n\npara one\n\npara two')
  })

  it('reads an old toggle after a new one in the same note', () => {
    const content = [OPEN('new'), '', '`a<b`', '', '</div>', '', `${OPEN('old')}<p>x &lt; y</p></div>`, '', 'after'].join('\n')
    expect(aiText(content)).toBe('new\n\n`a<b`\n\nold\nx < y\n\nafter')
  })
})
