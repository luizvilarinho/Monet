import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ReminderChipView } from './ReminderChipView'

export interface ReminderChipAttrs {
  id: string
  time: string
}

const TAG = 'reminder-chip'

// Chip inline de lembrete ("⏰ HH:MM"). O estado "disparado" NÃO é atributo do
// node: vive na tabela reminder_state e chega à view via RemindersContext —
// assim o disparo nunca reescreve o conteúdo da nota.
export const ReminderChip = Node.create({
  name: 'reminderChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: '' as string,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-id') ?? '',
        renderHTML: (attrs) => ({ 'data-id': attrs.id as string }),
      },
      time: {
        default: '' as string,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-time') ?? '',
        renderHTML: (attrs) => ({ 'data-time': attrs.time as string }),
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
    return ReactNodeViewRenderer(ReminderChipView)
  },

  addStorage() {
    return {
      markdown: {
        // Node inline: write sem closeBlock (o parágrafo dono fecha o bloco).
        serialize(state: unknown, node: unknown) {
          const n = node as { attrs: { id: string; time: string } }
          const s = state as { write: (text: string) => void }
          const id = n.attrs.id ?? ''
          const time = n.attrs.time ?? ''
          s.write(`<${TAG} data-id="${id}" data-time="${time}"></${TAG}>`)
        },
        parse: {},
      },
    }
  },
})
