import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { LinkedNoteBlockView } from './LinkedNoteBlockView'

export interface LinkedNoteBlockAttrs {
  noteId: string
  collapsed: boolean
}

const TAG = 'linked-note'

export const LinkedNoteBlock = Node.create({
  name: 'linkedNoteBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      noteId: {
        default: '' as string,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-note-id') ?? '',
        renderHTML: (attrs) => ({ 'data-note-id': attrs.noteId as string }),
      },
      collapsed: {
        default: false,
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
    return ReactNodeViewRenderer(LinkedNoteBlockView)
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: unknown, node: unknown) {
          const n = node as {
            attrs: { noteId: string; collapsed: boolean }
          }
          const s = state as {
            write: (text: string) => void
            closeBlock: (node: unknown) => void
          }
          const noteId = n.attrs.noteId ?? ''
          const collapsed = n.attrs.collapsed ? 'true' : 'false'
          s.write(`<${TAG} data-note-id="${noteId}" data-collapsed="${collapsed}"></${TAG}>`)
          s.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
