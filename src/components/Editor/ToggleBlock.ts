import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { DOMSerializer } from '@tiptap/pm/model'
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
        serialize(state: unknown, node: unknown) {
          const s = state as { write: (text: string) => void; closeBlock: (node: unknown) => void }
          const n = node as { attrs: { title: string; collapsed: boolean }; content: any; type: { schema: any } }
          const title = (n.attrs.title ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
          const collapsed = n.attrs.collapsed ? 'true' : 'false'
          const serializer = DOMSerializer.fromSchema(n.type.schema)
          const div = document.createElement('div')
          div.appendChild(serializer.serializeFragment(n.content))
          s.write(`<div data-type="toggle-block" data-title="${title}" data-collapsed="${collapsed}">${div.innerHTML}</div>`)
          s.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
