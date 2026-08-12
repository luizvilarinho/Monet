import { Editor, Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// Plugin key com estado de controle do modo preview.
export const previewPluginKey = new PluginKey<boolean>('monetPreviewMode')

// Verifica se um parágrafo é uma linha de slash command (começa com "/").
// Espelha a lógica de isPotentialCommandLine usada pelo CommandExtension.
function isCommandParagraph(text: string): boolean {
  return /^\s*\//.test(text.trim())
}

function buildPreviewDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = []
  state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name !== 'paragraph') return false
    const text = node.textContent
    if (!text || !isCommandParagraph(text)) return false
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: 'monetCmdHidden',
      })
    )
    return false
  })
  return DecorationSet.create(state.doc, decorations)
}

/**
 * Extensão que oculta visualmente os parágrafos de slash command quando o
 * modo preview está ativo. Quando inativa, nenhuma decoração é aplicada e o
 * editor exibe tudo normalmente.
 *
 * O estado ativo/inativo é controlado via meta de transação:
 *   tr.setMeta(previewPluginKey, true|false)
 */
export const PreviewMode = Extension.create({
  name: 'monetPreviewMode',

  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key: previewPluginKey,
        state: {
          init() {
            return false
          },
          apply(tr, value) {
            const meta = tr.getMeta(previewPluginKey)
            if (meta !== undefined) return meta
            return value
          },
        },
        props: {
          decorations(state) {
            const active = previewPluginKey.getState(state)
            if (!active) return null
            return buildPreviewDecorations(state)
          },
        },
      }),
    ]
  },
})

/**
 * Liga/desliga o modo preview no editor.
 */
export function setPreviewMode(editor: Editor, active: boolean): void {
  const tr = editor.view.state.tr.setMeta(previewPluginKey, active)
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
}
