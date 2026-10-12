import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { TasksQueryBlockView } from './TasksQueryBlockView'

const TAG = 'tasks-query'

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface TasksQueryBlockStorage {
  // Texto legível da lista viva para um filtro (cópia para o clipboard).
  // Preenchido pela node view, que tem acesso às tasks (TasksContext).
  resolveText: ((filter: string) => string) | null
}

// Bloco `/tasks`: lista viva de tasks. Só o filtro vai para `note.content`
// (`<tasks-query data-filter="this week #PORTO"></tasks-query>`); a lista é
// renderizada a partir das tasks a cada exibição.
export const TasksQueryBlock = Node.create<object, TasksQueryBlockStorage>({
  name: 'tasksQueryBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      filter: {
        default: 'this week' as string,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-filter') ?? 'this week',
        renderHTML: (attrs) => ({ 'data-filter': attrs.filter as string }),
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
    return ReactNodeViewRenderer(TasksQueryBlockView)
  },

  addStorage() {
    return {
      resolveText: null,
      markdown: {
        serialize(state: unknown, node: unknown) {
          const n = node as { attrs: { filter: string } }
          const s = state as {
            write: (text: string) => void
            closeBlock: (node: unknown) => void
          }
          s.write(`<${TAG} data-filter="${escapeAttr(n.attrs.filter ?? '')}"></${TAG}>`)
          s.closeBlock(node)
        },
        parse: {},
      },
    } as TasksQueryBlockStorage
  },
})
