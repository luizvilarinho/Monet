import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type MarkdownIt from 'markdown-it'
import type { MarkdownSerializerState } from 'prosemirror-markdown'
import { ToggleBlockView } from './ToggleBlockView'

type BlockRule = Parameters<MarkdownIt['block']['ruler']['before']>[2]
type StateBlock = Parameters<BlockRule>[0]

// A quebra de linha também vira entidade: a tag de abertura fica numa linha
// só. Com linha em branco no título, o html_block do markdown-it terminava no
// meio do atributo e a nota reabria vazia.
function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;')
}

// Toggle gravado no formato antigo (HTML colado na tag de abertura): lê até
// o </div> que o fecha, contando <div, mesmo atravessando linha em branco.
const LEGACY_START = /^<div data-type="toggle-block"[^>]*>(.*)$/

function toggleLegacyRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const pos = state.bMarks[startLine] + state.tShift[startLine]
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  if (!state.md.options.html) return false
  const m = LEGACY_START.exec(state.src.slice(pos, state.eMarks[startLine]))
  if (!m || m[1].trim() === '') return false // formato novo: tag sozinha
  let depth = 0
  let line = startLine
  for (; line < endLine; line++) {
    const text = state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line])
    depth += (text.match(/<div\b/gi) ?? []).length
    depth -= (text.match(/<\/div>/gi) ?? []).length
    if (depth <= 0) break
  }
  if (depth > 0) return false // sem fechamento: html_block padrão
  if (silent) return true
  const token = state.push('html_block', '', 0)
  token.map = [startLine, line + 1]
  token.content = state.getLines(startLine, line + 1, state.blkIndent, true)
  state.line = line + 1
  return true
}

// O tiptap-markdown chama o setup a cada parse com a mesma instância.
const withLegacyRule = new WeakSet<MarkdownIt>()

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-title') ?? '',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
      collapsed: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-collapsed') === 'true',
        renderHTML: (attrs) => ({ 'data-collapsed': attrs.collapsed ? 'true' : 'false' }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'toggle-block' },
      {
        tag: 'div',
        getAttrs: (el) =>
          (el as HTMLElement).getAttribute('data-type') === 'toggle-block' ? null : false,
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['toggle-block', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleBlockView)
  },

  addStorage() {
    return {
      markdown: {
        // A tag fica sozinha na linha e o conteúdo vai como markdown entre
        // linhas em branco, porque o html_block do markdown-it termina na
        // linha em branco. Com o HTML colado na tag, um código ou Mermaid com
        // linha em branco virava markdown.
        serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
          state.write(`<div data-type="toggle-block" data-title="${escapeAttr(node.attrs.title ?? '')}" data-collapsed="${node.attrs.collapsed ? 'true' : 'false'}">`)
          state.closeBlock(node)
          state.renderContent(node)
          state.write('</div>')
          state.closeBlock(node)
        },
        parse: {
          setup(markdownit: MarkdownIt) {
            if (withLegacyRule.has(markdownit)) return
            withLegacyRule.add(markdownit)
            markdownit.block.ruler.before('html_block', 'monet_toggle_legacy', toggleLegacyRule, {
              alt: ['paragraph', 'reference', 'blockquote'],
            })
          },
        },
      },
    }
  },
})
