import CodeBlock from '@tiptap/extension-code-block'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { NodeView } from '@tiptap/pm/view'
import { MermaidBlockView } from './MermaidBlockView'

export const MERMAID_LANGUAGE = 'mermaid'

// Cerca ```mermaid inteira (o Markdown cru copiado de outro lugar).
const PASTED_FENCE_RE = /^\s*```[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```\s*$/i

// Code block do StarterKit com desenho para a linguagem `mermaid`. O bloco
// continua sendo um code block (Markdown ```mermaid, busca, cópia e colagem
// iguais). Os outros blocos de código ficam com a renderização padrão do
// ProseMirror: sem objeto de node view (null), ele desenha pelo toDOM.
export const MermaidCodeBlock = CodeBlock.extend({
  addNodeView() {
    const renderMermaid = ReactNodeViewRenderer(MermaidBlockView, {
      // Linguagem trocada: o ProseMirror recria o bloco com a view certa.
      update: ({ newNode, updateProps }) => {
        if (newNode.attrs.language !== MERMAID_LANGUAGE) return false
        updateProps()
        return true
      },
    })
    return (props) =>
      props.node.attrs.language === MERMAID_LANGUAGE
        ? renderMermaid(props)
        : (null as unknown as NodeView)
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey('mermaidPaste'),
        props: {
          // Cerca colada dentro de um bloco Mermaid (ex.: no bloco vazio do
          // `/diagram`): entra só o código. Dentro de code block o ProseMirror
          // cola o texto puro que sai daqui.
          transformPastedText: (text, _plain, view) => {
            const { parent } = view.state.selection.$from
            if (parent.type !== this.type || parent.attrs.language !== MERMAID_LANGUAGE) return text
            return PASTED_FENCE_RE.exec(text)?.[1] ?? text
          },
        },
      }),
    ]
  },
})
