import type { Editor } from '@tiptap/core'
import { Fragment, NodeRange, type Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state'
import {
  CaretRight,
  CheckSquare,
  Code,
  CodeBlock,
  ColumnsPlusLeft,
  ColumnsPlusRight,
  Link,
  ListBullets,
  ListNumbers,
  Quotes,
  RowsPlusBottom,
  RowsPlusTop,
  type Icon,
} from '@phosphor-icons/react'
import { DEFAULT_HIGHLIGHT_ID, highlightById } from '../../lib/highlight'
import { createTable } from '@tiptap/extension-table'
import { MERMAID_LANGUAGE } from './MermaidCodeBlock'
import { ITEM_TYPES } from './blockUnit'

export type FormatId =
  | 'h1' | 'h2' | 'h3'
  | 'bold' | 'italic' | 'strike'
  | 'ul' | 'ol' | 'todo' | 'toggle'
  | 'blockquote' | 'code' | 'codeBlock' | 'link'
  | 'colBefore' | 'colAfter' | 'delCol'
  | 'rowBefore' | 'rowAfter' | 'delRow'
  | 'delTable'
  | 'highlight'

// Botão da régua: ícone Phosphor ou texto (H1, B, I e as ações de apagar).
export type ButtonDef = { id: FormatId; title: string; icon?: Icon; label?: string; cls?: string }

// Só o que age sobre a seleção: inserir bloco (tabela, imagem, divisória)
// fica no menu Insert do botão direito, porque substituiria o texto.
export const FORMATTING_GROUPS: ButtonDef[][] = [
  [
    { id: 'h1', label: 'H1', title: 'Heading 1 (Ctrl+Alt+1)' },
    { id: 'h2', label: 'H2', title: 'Heading 2 (Ctrl+Alt+2)' },
    { id: 'h3', label: 'H3', title: 'Heading 3 (Ctrl+Alt+3)' },
  ],
  [
    { id: 'bold', label: 'B', title: 'Bold (Ctrl+B)', cls: 'bold' },
    { id: 'italic', label: 'I', title: 'Italic (Ctrl+I)', cls: 'italic' },
    { id: 'strike', label: 'S', title: 'Strikethrough (Ctrl+Shift+S)', cls: 'strike' },
  ],
  [
    { id: 'ul', icon: ListBullets, title: 'Bulleted list (Ctrl+Shift+8)' },
    { id: 'ol', icon: ListNumbers, title: 'Numbered list (Ctrl+Shift+7)' },
    { id: 'todo', icon: CheckSquare, title: 'Checklist (Ctrl+Shift+9)' },
    { id: 'toggle', icon: CaretRight, title: 'Toggle: the first block becomes the title' },
  ],
  [
    { id: 'blockquote', icon: Quotes, title: 'Quote (Ctrl+Shift+B)' },
    { id: 'code', icon: Code, title: 'Inline code (Ctrl+E)' },
    { id: 'codeBlock', icon: CodeBlock, title: 'Code block (Ctrl+Alt+C)' },
    { id: 'link', icon: Link, title: 'Link (Ctrl+Shift+K)' },
  ],
]

export const TABLE_GROUPS: ButtonDef[][] = [
  [
    { id: 'colBefore', icon: ColumnsPlusLeft, title: 'Add column to the left' },
    { id: 'colAfter', icon: ColumnsPlusRight, title: 'Add column to the right' },
    { id: 'delCol', label: 'Delete column', title: 'Delete the current column' },
  ],
  [
    { id: 'rowBefore', icon: RowsPlusTop, title: 'Add row above' },
    { id: 'rowAfter', icon: RowsPlusBottom, title: 'Add row below' },
    { id: 'delRow', label: 'Delete row', title: 'Delete the current row' },
  ],
  [
    { id: 'delTable', label: 'Delete table', title: 'Delete the entire table' },
  ],
]

export function isActive(editor: Editor, id: FormatId): boolean {
  switch (id) {
    case 'h1': return editor.isActive('heading', { level: 1 })
    case 'h2': return editor.isActive('heading', { level: 2 })
    case 'h3': return editor.isActive('heading', { level: 3 })
    case 'bold': return editor.isActive('bold')
    case 'italic': return editor.isActive('italic')
    case 'strike': return editor.isActive('strike')
    case 'ul': return editor.isActive('bulletList')
    case 'ol': return editor.isActive('orderedList')
    case 'todo': return editor.isActive('taskList')
    case 'blockquote': return editor.isActive('blockquote')
    case 'code': return editor.isActive('code')
    case 'codeBlock': return editor.isActive('codeBlock')
    case 'toggle': return editor.isActive('toggleBlock')
    case 'link': return editor.isActive('link')
    case 'colBefore':
    case 'colAfter':
    case 'delCol':
    case 'rowBefore':
    case 'rowAfter':
    case 'delRow':
    case 'delTable':
      return false
    case 'highlight': return editor.isActive('highlight')
  }
}

// Com a seleção num toggle, o botão Toggle desfaz esse toggle (runAction).
export function buttonTitle(editor: Editor, id: FormatId, title: string): string {
  return id === 'toggle' && isActive(editor, 'toggle') ? 'Unwrap toggle: the title becomes a paragraph' : title
}

export function isSafeLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// O Link não passa por aqui: a régua abre a popover do link (LinkPopover).
export function runAction(editor: Editor, id: FormatId) {
  const chain = editor.chain().focus()
  switch (id) {
    case 'h1': chain.toggleHeading({ level: 1 }).run(); return
    case 'h2': chain.toggleHeading({ level: 2 }).run(); return
    case 'h3': chain.toggleHeading({ level: 3 }).run(); return
    case 'bold': chain.toggleBold().run(); return
    case 'italic': chain.toggleItalic().run(); return
    case 'strike': chain.toggleStrike().run(); return
    case 'ul': chain.toggleBulletList().run(); return
    case 'ol': chain.toggleOrderedList().run(); return
    case 'todo': chain.toggleTaskList().run(); return
    case 'toggle':
      if (editor.isActive('toggleBlock')) unwrapToggle(editor)
      else wrapSelectionInToggle(editor)
      return
    case 'blockquote': chain.toggleBlockquote().run(); return
    case 'code': chain.toggleCode().run(); return
    case 'codeBlock': chain.toggleCodeBlock().run(); return
    case 'colBefore': chain.addColumnBefore().run(); return
    case 'colAfter': chain.addColumnAfter().run(); return
    case 'delCol': chain.deleteColumn().run(); return
    case 'rowBefore': chain.addRowBefore().run(); return
    case 'rowAfter': chain.addRowAfter().run(); return
    case 'delRow': chain.deleteRow().run(); return
    case 'delTable': chain.deleteTable().run(); return
    case 'highlight': toggleHighlight(editor); return
  }
}

// Marcas que não cabem no título (texto puro) e seriam perdidas: link, marca
// de atenção e termo do Related content.
const MARKS_KEPT_IN_BODY = new Set(['link', 'noteMark', 'relatedTerm'])

// Título tirado do 1º bloco: só de parágrafo ou heading com texto, e a quebra
// de linha (Shift+Enter) vira espaço. Outro bloco (código, lista, imagem), nó
// inline (task, lembrete, data) ou uma das marcas acima: null, e o bloco fica
// no corpo. Negrito e itálico se perdem no título.
function toggleTitleFrom(block: PMNode | undefined): string | null {
  if (!block || (block.type.name !== 'paragraph' && block.type.name !== 'heading')) return null
  let plain = true
  block.forEach((child) => {
    if (child.isText ? child.marks.some((m) => MARKS_KEPT_IN_BODY.has(m.type.name)) : child.type.name !== 'hardBreak') {
      plain = false
    }
  })
  if (!plain) return null
  return block.textBetween(0, block.content.size, '', ' ').replace(/\s+/g, ' ').trim()
}

// Embrulha os blocos da seleção num toggle: o 1º bloco vira o título (ver
// toggleTitleFrom; quando não vira, o título fica vazio) e o resto, o corpo,
// com a formatação. Seleção dentro de item de lista sobe até onde o toggle
// cabe (a lista inteira).
export function wrapSelectionInToggle(editor: Editor): boolean {
  const { state, view } = editor
  const { toggleBlock, paragraph } = state.schema.nodes
  if (!toggleBlock || !paragraph) return false
  const { $from, $to } = state.selection
  let range = $from.blockRange($to)
  while (range && !range.parent.canReplaceWith(range.startIndex, range.endIndex, toggleBlock)) {
    range = range.depth > 0 ? new NodeRange($from, $to, range.depth - 1) : null
  }
  if (!range) return false
  const blocks: PMNode[] = []
  for (let i = range.startIndex; i < range.endIndex; i++) blocks.push(range.parent.child(i))
  const title = toggleTitleFrom(blocks[0])
  const body = title === null ? blocks : blocks.slice(1)
  let node: PMNode
  try {
    node = toggleBlock.createChecked({ title: title ?? '', collapsed: false }, body.length ? body : [paragraph.create()])
  } catch (err) {
    console.warn('toggle: blocks do not fit', err)
    return false
  }
  const tr = state.tr.replaceWith(range.start, range.end, node)
  tr.setSelection(TextSelection.near(tr.doc.resolve(range.start + 1)))
  view.dispatch(tr.scrollIntoView())
  editor.commands.focus()
  return true
}

// Desfaz o toggle do cursor: o título volta a ser um parágrafo acima do corpo.
function unwrapToggle(editor: Editor): boolean {
  const { state, view } = editor
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name !== 'toggleBlock') continue
    const title = String(node.attrs.title ?? '').trim()
    const blocks: PMNode[] = []
    if (title) blocks.push(state.schema.nodes.paragraph.create(null, state.schema.text(title)))
    node.forEach((child) => blocks.push(child))
    const pos = $from.before(d)
    const tr = state.tr.replaceWith(pos, pos + node.nodeSize, blocks)
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))))
    view.dispatch(tr.scrollIntoView())
    editor.commands.focus()
    return true
  }
  return false
}

export type InsertKind = 'table' | 'image' | 'divider' | 'toggle' | 'diagram' | 'tasks'

// Bloco novo do menu Insert: no lugar do parágrafo vazio do cursor ou logo
// abaixo do bloco de texto do cursor. `cursorAt` dá o ponto do cursor a partir
// do início do que entrou.
function insertBlocks(editor: Editor, nodes: PMNode[], cursorAt: (start: number) => number): void {
  const { state, view } = editor
  const { selection } = state
  const { $from } = selection
  let from = selection.to
  let to = selection.to
  if (!(selection instanceof NodeSelection) && $from.parent.isTextblock) {
    if ($from.parent.type.name === 'paragraph' && $from.parent.content.size === 0) {
      from = $from.before()
      to = $from.after()
    } else {
      from = to = $from.after()
    }
  }
  let tr = state.tr
  try {
    tr.replaceWith(from, to, nodes)
  } catch {
    // Onde o schema não aceita o bloco, ele entra depois do bloco de topo.
  }
  if (!tr.docChanged && $from.depth > 0) {
    from = to = $from.after(1)
    tr = state.tr.replaceWith(from, to, nodes)
  }
  if (!tr.docChanged) return
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(cursorAt(from), tr.doc.content.size))))
  view.dispatch(tr.scrollIntoView())
  editor.commands.focus()
}

function pickImage(onPick: (dataUrl: string) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onPick(reader.result as string)
    reader.onerror = () => console.error('failed to read image', reader.error)
    reader.readAsDataURL(file)
  }
  input.click()
}

export function insertBlock(editor: Editor, kind: InsertKind): void {
  const { schema } = editor.state
  const { paragraph, horizontalRule, image, toggleBlock, codeBlock, tasksQueryBlock } = schema.nodes
  switch (kind) {
    case 'table':
      // Cursor na 1ª célula do cabeçalho (tabela > linha > célula > parágrafo).
      insertBlocks(editor, [createTable(schema, 3, 3, true), paragraph.create()], (s) => s + 4)
      return
    case 'divider':
      if (horizontalRule) insertBlocks(editor, [horizontalRule.create(), paragraph.create()], (s) => s + 2)
      return
    case 'image':
      if (image) {
        pickImage((src) => insertBlocks(editor, [image.create({ src }), paragraph.create()], (s) => s + 2))
      }
      return
    case 'toggle':
      if (toggleBlock) {
        insertBlocks(editor, [toggleBlock.create({ title: '', collapsed: false }, paragraph.create())], (s) => s + 2)
      }
      return
    case 'diagram':
      // Bloco Mermaid vazio com o cursor dentro, como o /diagram.
      if (codeBlock) {
        insertBlocks(editor, [codeBlock.create({ language: MERMAID_LANGUAGE }), paragraph.create()], (s) => s + 1)
      }
      return
    case 'tasks':
      if (tasksQueryBlock) {
        insertBlocks(editor, [tasksQueryBlock.create({ filter: 'this week' }), paragraph.create()], (s) => s + 2)
      }
      return
  }
}

export type TurnIntoKind = 'paragraph' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'todo' | 'blockquote' | 'toggle'

// Blocos que o "Turn into" do menu do bloco converte: texto, título, item de
// lista e citação com um parágrafo ou heading só. Átomos, tabela, código,
// toggle e citação com mais blocos ficam de fora (a conversão perderia
// estrutura ou juntaria tudo).
const TURNABLE = new Set(['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote'])

export function canTurnInto(node: PMNode): boolean {
  if (node.type.name === 'blockquote') {
    const only = node.childCount === 1 ? node.firstChild : null
    return only?.type.name === 'paragraph' || only?.type.name === 'heading'
  }
  return TURNABLE.has(node.type.name)
}

// Item com subitens (ou outro bloco depois do parágrafo): o conteúdo dele
// sai da lista no lugar do item, que se parte em volta, e os subitens ficam
// logo depois do parágrafo. A lista dos subitens recebe o resto da lista
// quando é do mesmo tipo (senão o markdown juntaria as duas ao reabrir). Um
// passo só: o desfazer junta este com a conversão. Volta a posição do
// parágrafo, ou null se o conteúdo não cabe ali.
function liftItemContent(tr: Transaction, pos: number, item: PMNode): number | null {
  const $item = tr.doc.resolve(pos)
  const list = $item.parent
  const listPos = $item.before()
  const offset = pos - $item.start()
  const before = list.content.cut(0, offset)
  const after = list.content.cut(offset + item.nodeSize)
  const nodes: PMNode[] = []
  item.forEach((child) => nodes.push(child))
  const last = nodes[nodes.length - 1]
  if (after.childCount && last.type === list.type) nodes[nodes.length - 1] = last.copy(last.content.append(after))
  else if (after.childCount) nodes.push(list.copy(after))
  if (before.childCount) nodes.unshift(list.copy(before))
  const $list = tr.doc.resolve(listPos)
  if (!$list.parent.canReplace($list.index(), $list.index() + 1, Fragment.from(nodes))) return null
  tr.replaceWith(listPos, listPos + list.nodeSize, nodes)
  return listPos + (before.childCount ? nodes[0].nodeSize : 0)
}

// Converte o bloco em `pos`: seleciona o texto dele, limpa os nós (sai da
// lista/citação) e aplica o tipo novo. Num item com subitens, só o parágrafo
// do item muda (ver liftItemContent). O cursor fica no fim do bloco.
export function turnBlockInto(editor: Editor, pos: number, node: PMNode, kind: TurnIntoKind): void {
  const { state } = editor
  if (state.doc.nodeAt(pos) !== node || !canTurnInto(node)) return
  const tr = state.tr
  let from = pos
  let block = node
  if (ITEM_TYPES.has(node.type.name) && node.childCount > 1 && node.firstChild) {
    const at = liftItemContent(tr, pos, node)
    if (at === null) return
    from = at
    block = node.firstChild
  }
  const sel = TextSelection.between(tr.doc.resolve(from + 1), tr.doc.resolve(from + block.nodeSize - 1))
  editor.view.dispatch(tr.setSelection(sel))
  const chain = editor.chain().focus().clearNodes()
  switch (kind) {
    case 'paragraph': chain.run(); break
    case 'h1': chain.setHeading({ level: 1 }).run(); break
    case 'h2': chain.setHeading({ level: 2 }).run(); break
    case 'h3': chain.setHeading({ level: 3 }).run(); break
    case 'ul': chain.toggleBulletList().run(); break
    case 'ol': chain.toggleOrderedList().run(); break
    case 'todo': chain.toggleTaskList().run(); break
    case 'blockquote': chain.toggleBlockquote().run(); break
    case 'toggle':
      chain.run()
      wrapSelectionInToggle(editor)
      return
  }
  editor.commands.setTextSelection(editor.state.selection.to)
}

/**
 * Aplica ou remove o destaque com cor (R1).
 *
 * - Sem destaque na seleção → aplica com a cor escolhida.
 * - Com a MESMA cor → remove o destaque.
 * - Com outra cor → troca a cor (o setMark substitui o mark do mesmo tipo,
 *   então o destaque não empilha).
 */
export function toggleHighlight(editor: Editor, colorId?: string) {
  const color = highlightById(colorId ?? DEFAULT_HIGHLIGHT_ID) ?? highlightById(DEFAULT_HIGHLIGHT_ID)
  if (!color) return
  const chain = editor.chain().focus()
  const attrs = editor.getAttributes('highlight')
  const current = typeof attrs.color === 'string' ? attrs.color.trim().toUpperCase() : null
  if (editor.isActive('highlight') && current === color.hex.toUpperCase()) {
    chain.unsetMark('highlight').run()
    return
  }
  chain.setMark('highlight', { color: color.hex }).run()
}
