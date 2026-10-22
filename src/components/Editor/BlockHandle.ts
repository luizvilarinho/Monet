import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'

// Marca visual do bloco que o handle do gutter (⠿, BlockGutter) está
// operando: esmaecido durante o arrasto, realçado com o menu do bloco aberto.
// É decoration, e não classe posta à mão no DOM, porque o ProseMirror relê e
// redesenha o nó quando um atributo dele muda por fora.
//
// O handle em si não vive aqui: é um só, no gutter, seguindo o mouse — sem
// widget por linha, nada roda a cada tecla. Fora de buildBaseExtensions de
// propósito: a janela Keep não tem gutter.
export type BlockMarkKind = 'drag' | 'menu'

export interface BlockMark {
  from: number
  to: number
  kind: BlockMarkKind
}

const blockMarkKey = new PluginKey<BlockMark | null>('monetBlockMark')

const MARK_CLASS: Record<BlockMarkKind, string> = {
  drag: 'monetBlockDragSource',
  menu: 'monetBlockMenuTarget',
}

// Transação só de meta: não altera o doc nem entra no histórico.
export function setBlockMark(view: EditorView, mark: BlockMark | null): void {
  view.dispatch(view.state.tr.setMeta(blockMarkKey, mark))
}

export const BlockHandle = Extension.create({
  name: 'monetBlockHandle',

  addProseMirrorPlugins() {
    return [
      new Plugin<BlockMark | null>({
        key: blockMarkKey,
        state: {
          init: () => null,
          apply(tr, prev) {
            const meta = tr.getMeta(blockMarkKey) as BlockMark | null | undefined
            if (meta !== undefined) return meta
            if (!prev || !tr.docChanged) return prev
            const from = tr.mapping.map(prev.from, 1)
            const to = tr.mapping.map(prev.to, -1)
            return from < to ? { ...prev, from, to } : null
          },
        },
        props: {
          decorations(state) {
            const mark = blockMarkKey.getState(state)
            if (!mark) return null
            const decorations: Decoration[] = []
            // A marca cobre nós inteiros (o bloco, ou o par /comando + resposta).
            state.doc.nodesBetween(mark.from, mark.to, (node, pos) => {
              if (pos < mark.from || pos + node.nodeSize > mark.to) return true
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: MARK_CLASS[mark.kind] }))
              return false
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
