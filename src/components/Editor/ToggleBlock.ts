import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ToggleBlockView } from './ToggleBlockView'

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
    return [{ tag: 'toggle-block' }]
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
        serialize(state: { write: (s: string) => void; renderContent: (n: unknown) => void; closeBlock: (n: unknown) => void }, node: { attrs: { title: string } }) {
          const title = node.attrs.title || 'Toggle'
          state.write(`**${title}**\n`)
          state.renderContent(node)
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
