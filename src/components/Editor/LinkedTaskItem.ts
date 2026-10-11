import TaskItem from '@tiptap/extension-task-item'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { TaskStatus as TaskStatusValue } from '../../types'
import type { TaskStatusStorage } from './TaskStatus'

interface TaskDecorationSpec {
  taskStatus?: TaskStatusValue
  taskId?: string
}

function taskSpecOf(decorations: readonly { spec: unknown }[]): TaskDecorationSpec | null {
  for (const d of decorations) {
    const spec = d.spec as TaskDecorationSpec | undefined
    if (spec?.taskStatus) return spec
  }
  return null
}

// TaskItem cujo checkbox reflete o status da task vinculada (decoration do
// plugin TaskStatus) em vez do atributo `checked` da nota. Cópia enxuta da
// NodeView original (@tiptap/extension-list 3.23.4), com a MESMA estrutura de
// DOM: o CSS do Editor e o drag handle dos checklists dependem dela.
export const LinkedTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor, decorations }) => {
      const listItem = document.createElement('li')
      const checkboxWrapper = document.createElement('label')
      const checkboxStyler = document.createElement('span')
      const checkbox = document.createElement('input')
      const content = document.createElement('div')

      let linkedTaskId: string | null = null

      const render = (current: ProseMirrorNode, decos: readonly { spec: unknown }[]) => {
        const spec = taskSpecOf(decos)
        linkedTaskId = spec?.taskId ?? null
        const checked = spec?.taskStatus
          ? spec.taskStatus === 'done'
          : Boolean(current.attrs.checked)
        checkbox.checked = checked
        listItem.dataset.checked = String(checked)
        checkbox.ariaLabel = `Task item checkbox for ${current.textContent || 'empty task item'}`
      }

      checkboxWrapper.contentEditable = 'false'
      checkbox.type = 'checkbox'
      checkbox.addEventListener('mousedown', (event) => event.preventDefault())
      checkbox.addEventListener('change', () => {
        if (!editor.isEditable) {
          checkbox.checked = !checkbox.checked
          return
        }
        const checked = checkbox.checked
        // Item vinculado: grava também na tabela. A tabela nunca escreve na nota.
        if (linkedTaskId) {
          const storage = (editor.storage as unknown as { taskStatus?: TaskStatusStorage })
            .taskStatus
          storage?.onToggleLinked?.(linkedTaskId, checked)
        }
        if (typeof getPos === 'function') {
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .command(({ tr }) => {
              const position = getPos()
              if (typeof position !== 'number') return false
              const currentNode = tr.doc.nodeAt(position)
              tr.setNodeMarkup(position, undefined, { ...currentNode?.attrs, checked })
              return true
            })
            .run()
        }
      })

      checkboxWrapper.append(checkbox, checkboxStyler)
      listItem.append(checkboxWrapper, content)

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      render(node, decorations)

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode, updatedDecorations) => {
          if (updatedNode.type !== this.type) return false
          render(updatedNode, updatedDecorations)
          return true
        },
      }
    }
  },
})
