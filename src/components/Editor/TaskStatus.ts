import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { TaskStatus as TaskStatusValue } from '../../types'

interface TaskStatusState {
  statuses: Map<string, TaskStatusValue>
  decorations: DecorationSet
}

// O React alimenta o Map id → status com `tr.setMeta(taskStatusPluginKey, map)`.
// Transação só de meta não altera o doc, então não dispara autosave.
export const taskStatusPluginKey = new PluginKey<TaskStatusState>('monetTaskStatus')

export interface TaskStatusStorage {
  onToggleLinked: null | ((taskId: string, checked: boolean) => void)
}

// Id do primeiro taskRef no primeiro parágrafo do taskItem.
export function firstTaskRefId(taskItem: ProseMirrorNode): string | null {
  const para = taskItem.firstChild
  if (!para) return null
  let id: string | null = null
  para.forEach((child) => {
    if (id === null && child.type.name === 'taskRef') id = (child.attrs.id as string) || null
  })
  return id
}

function buildDecorations(
  doc: ProseMirrorNode,
  statuses: Map<string, TaskStatusValue>
): DecorationSet {
  if (statuses.size === 0) return DecorationSet.empty
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'taskItem') return true
    const id = firstTaskRefId(node)
    const status = id ? statuses.get(id) : undefined
    if (id && status) {
      decos.push(
        Decoration.node(
          pos,
          pos + node.nodeSize,
          { 'data-task-status': status },
          { taskStatus: status, taskId: id }
        )
      )
    }
    return true
  })
  return DecorationSet.create(doc, decos)
}

export interface EligibleTaskItem {
  pos: number
  title: string
  checked: boolean
}

// Itens de checklist da seleção que podem virar task: o PRIMEIRO parágrafo do
// item precisa intersectar a seleção (nodesBetween também visita ancestrais;
// sem esse filtro, selecionar uma subtarefa promoveria o pai) e o item não
// pode já estar vinculado a uma task existente.
export function findEligibleTaskItems(state: EditorState): EligibleTaskItem[] {
  const statuses = taskStatusPluginKey.getState(state)?.statuses ?? new Map()
  const { from, to } = state.selection
  const items: EligibleTaskItem[] = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== 'taskItem') return true
    const para = node.firstChild
    if (!para) return true
    const paraStart = pos + 1
    const paraEnd = paraStart + para.nodeSize
    if (!(paraStart < to && paraEnd > from)) return true
    const refId = firstTaskRefId(node)
    if (refId && statuses.has(refId)) return true
    const title = para.textContent.replace(/\s+/g, ' ').trim()
    if (!title) return true
    items.push({ pos, title, checked: Boolean(node.attrs.checked) })
    return true
  })
  return items
}

export const TaskStatus = Extension.create<Record<string, never>, TaskStatusStorage>({
  name: 'taskStatus',

  addStorage() {
    return { onToggleLinked: null }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<TaskStatusState>({
        key: taskStatusPluginKey,
        state: {
          init: () => ({ statuses: new Map(), decorations: DecorationSet.empty }),
          apply(tr, prev) {
            const meta = tr.getMeta(taskStatusPluginKey) as
              | Map<string, TaskStatusValue>
              | undefined
            if (meta) return { statuses: meta, decorations: buildDecorations(tr.doc, meta) }
            if (tr.docChanged) {
              return { statuses: prev.statuses, decorations: buildDecorations(tr.doc, prev.statuses) }
            }
            return prev
          },
        },
        props: {
          decorations(state) {
            return taskStatusPluginKey.getState(state)?.decorations
          },
        },
      }),
    ]
  },
})
