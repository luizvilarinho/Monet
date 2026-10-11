import { createNodeFromContent, type Editor } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

// ─── Continuidade de lista na inserção vinda do chat ────────────────────────
// Se o conteúdo inserido é UMA lista e o destino é o fim de um item de lista
// do mesmo tipo (cursor) ou a última lista da nota (append), os itens entram
// na lista existente, logo após o item atual / no fim, no mesmo nível. Só
// INSERE nós `listItem`/`taskItem` numa posição entre itens: nenhum nó
// existente é alterado (exceção: um item vazio no cursor é substituído
// pelos itens). Qualquer caso fora do padrão (cursor no meio do item,
// item com sublista depois do texto, lista aninhada, tipos diferentes,
// conteúdo misto, seleção não vazia) retorna false e o chamador usa a
// inserção padrão.

const ITEM_TYPES = new Set(['listItem', 'taskItem'])
const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

// `html`: o markdown já convertido pelo parser do tiptap-markdown.
export function insertAsListContinuation(
  editor: Editor,
  html: string,
  where: 'cursor' | 'end'
): boolean {
  let parsed
  try {
    parsed = createNodeFromContent(html, editor.schema, { slice: true })
  } catch {
    return false
  }
  if (!(parsed instanceof Fragment) || parsed.childCount !== 1) return false
  const block = parsed.child(0)
  if (!LIST_TYPES.has(block.type.name) || block.childCount === 0) return false

  const { state } = editor
  let insertPos: number
  // Item vazio no cursor (Enter no fim do anterior): é substituído pelos itens.
  let replaceTo: number | null = null
  if (where === 'cursor') {
    const { selection } = state
    if (!selection.empty) return false
    const $pos = selection.$from
    const d = $pos.depth
    if (d < 3) return false
    const item = $pos.node(d - 1)
    const list = $pos.node(d - 2)
    if (!$pos.parent.isTextblock || $pos.parentOffset !== $pos.parent.content.size) return false
    if (!ITEM_TYPES.has(item.type.name) || $pos.index(d - 1) !== item.childCount - 1) return false
    if (list.type !== block.type) return false
    if (ITEM_TYPES.has($pos.node(d - 3).type.name)) return false
    if (item.childCount === 1 && item.content.size === 2) {
      insertPos = $pos.before(d - 1)
      replaceTo = $pos.after(d - 1)
    } else {
      insertPos = $pos.after(d - 1)
    }
  } else {
    const { doc } = state
    // Ignora o parágrafo vazio final (TrailingNode do StarterKit).
    let index = doc.childCount - 1
    const last = doc.lastChild
    if (last && last.type.name === 'paragraph' && last.content.size === 0) index--
    if (index < 0) return false
    const list = doc.child(index)
    if (list.type !== block.type) return false
    let listPos = 0
    for (let k = 0; k < index; k++) listPos += doc.child(k).nodeSize
    insertPos = listPos + list.nodeSize - 1
  }

  const items = block.content
  const tr =
    replaceTo === null
      ? state.tr.insert(insertPos, items)
      : state.tr.replaceWith(insertPos, replaceTo, items)
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + items.size), -1))
  editor.view.dispatch(tr.scrollIntoView())
  editor.commands.focus()
  return true
}
