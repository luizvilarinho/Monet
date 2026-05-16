import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { EmbedBlockView } from './EmbedBlockView'

export interface EmbedBlockAttrs {
  commandId: string | null
  collapsed: boolean
}

const TAG = 'embed-block'

export const EmbedBlock = Node.create({
  name: 'embedBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      commandId: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-cmd'),
        renderHTML: (attrs) =>
          attrs.commandId ? { 'data-cmd': attrs.commandId as string } : {},
      },
      collapsed: {
        default: true,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-collapsed') !== 'false',
        renderHTML: (attrs) => ({
          'data-collapsed': attrs.collapsed ? 'true' : 'false',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: TAG }]
  },

  renderHTML({ HTMLAttributes }) {
    return [TAG, mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedBlockView)
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: unknown, node: unknown) {
          const n = node as {
            attrs: { commandId: string | null; collapsed: boolean }
          }
          const s = state as {
            write: (text: string) => void
            closeBlock: (node: unknown) => void
          }
          const cmd = n.attrs.commandId ?? ''
          const collapsed = n.attrs.collapsed ? 'true' : 'false'
          s.write(`<${TAG} data-cmd="${cmd}" data-collapsed="${collapsed}"></${TAG}>`)
          s.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
