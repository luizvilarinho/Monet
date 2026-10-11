import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { TASK_REF_TAG } from '../../lib/tasks'
import { TaskRefView } from './TaskRefView'

// Pill inline que vincula um item de checklist a uma task da tabela `tasks`.
// Só o id fica na nota: prazo e status vivem na tabela e chegam à view via
// TasksContext — mudar a task nunca reescreve o conteúdo da nota.
export const TaskRef = Node.create({
  name: 'taskRef',
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
    }
  },

  parseHTML() {
    return [{ tag: TASK_REF_TAG }]
  },

  renderHTML({ HTMLAttributes }) {
    return [TASK_REF_TAG, mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskRefView)
  },

  addStorage() {
    return {
      markdown: {
        // Node inline: write sem closeBlock (o parágrafo dono fecha o bloco).
        serialize(state: unknown, node: unknown) {
          const n = node as { attrs: { id: string } }
          const s = state as { write: (text: string) => void }
          s.write(`<${TASK_REF_TAG} data-id="${n.attrs.id ?? ''}"></${TASK_REF_TAG}>`)
        },
        parse: {},
      },
    }
  },
})
