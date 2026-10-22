import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { isPotentialCommandLine } from './commandParser'

// Unidade de bloco do ponto: item de lista/checklist; tabela inteira; filho
// direto do toggle (ou o toggle, sobre o cabeçalho); senão o bloco de topo.
// Nó atômico (embed, /tasks, nota linkada, imagem) cai como o próprio nó.
// A cadeia vem dos ancestrais de `pos`: o `inside` é o elemento sob o ponto
// (padding de `ul`/toggle) e só vale para nó atômico ou cabeçalho do toggle.
export interface BlockUnit {
  pos: number
  node: ProseMirrorNode
}

// Itens de lista (simples e de checklist) e os contêineres que os agrupam.
export const ITEM_TYPES = new Set(['taskItem', 'listItem'])
export const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

export function resolveBlockUnit(
  doc: ProseMirrorNode,
  pos: number,
  inside: number,
  onToggleHeader: boolean
): BlockUnit | null {
  const chain: BlockUnit[] = []
  const insideNode = inside >= 0 ? doc.nodeAt(inside) : null
  if (insideNode && (insideNode.isAtom || (insideNode.type.name === 'toggleBlock' && onToggleHeader))) {
    const $inside = doc.resolve(inside)
    for (let d = 1; d <= $inside.depth; d++) chain.push({ pos: $inside.before(d), node: $inside.node(d) })
    chain.push({ pos: inside, node: insideNode })
  } else {
    const $pos = doc.resolve(pos)
    if ($pos.depth >= 1) {
      for (let d = 1; d <= $pos.depth; d++) chain.push({ pos: $pos.before(d), node: $pos.node(d) })
    } else if ($pos.nodeAfter) chain.push({ pos, node: $pos.nodeAfter })
    else if ($pos.nodeBefore) chain.push({ pos: pos - $pos.nodeBefore.nodeSize, node: $pos.nodeBefore })
  }
  if (chain.length === 0) return null
  const table = chain.find((u) => u.node.type.name === 'table')
  if (table) return table
  for (let i = chain.length - 1; i >= 0; i--) {
    if (ITEM_TYPES.has(chain[i].node.type.name)) return chain[i]
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].node.type.name === 'toggleBlock') return chain[i + 1] ?? chain[i]
  }
  return chain[0]
}

// Resolve a unidade a partir do início de um bloco (posição antes do nó), e
// não de um ponto solto: em `pos` a cadeia de ancestrais de um item seria a
// LISTA, não o item — por isso o item resolve a partir de `pos + 1`.
export function resolveBlockUnitAt(doc: ProseMirrorNode, pos: number): BlockUnit | null {
  const nodeAfter = doc.resolve(pos).nodeAfter
  if (nodeAfter && ITEM_TYPES.has(nodeAfter.type.name)) {
    return resolveBlockUnit(doc, pos + 1, -1, false)
  }
  return resolveBlockUnit(doc, pos, -1, false)
}

// Intervalo da unidade de movimento/delete. A linha de um /comando é o
// parágrafo + o embedBlock da resposta: os dois andam e apagam juntos.
export function blockRange(doc: ProseMirrorNode, unit: BlockUnit): { from: number; to: number } {
  let to = unit.pos + unit.node.nodeSize
  if (unit.node.type.name === 'paragraph' && isPotentialCommandLine(unit.node.textContent)) {
    const next = doc.nodeAt(to)
    if (next?.type.name === 'embedBlock') to += next.nodeSize
  }
  return { from: unit.pos, to }
}

// A lista (bulletList/orderedList/taskList) que contém o item em `itemPos`.
export function findListRange(
  doc: ProseMirrorNode,
  itemPos: number
): { listPos: number; listEnd: number } | null {
  const $pos = doc.resolve(itemPos)
  for (let d = $pos.depth; d >= 1; d--) {
    const node = $pos.node(d)
    if (LIST_TYPES.has(node.type.name)) {
      const listPos = $pos.before(d)
      return { listPos, listEnd: listPos + node.nodeSize }
    }
  }
  return null
}
