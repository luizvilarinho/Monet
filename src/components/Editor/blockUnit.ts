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

// Itens de lista (simples e de checklist).
export const ITEM_TYPES = new Set(['taskItem', 'listItem'])

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

export function isCommandLine(node: ProseMirrorNode | null | undefined): boolean {
  return node?.type.name === 'paragraph' && isPotentialCommandLine(node.textContent)
}

// Intervalo da unidade de movimento/delete. A linha de um /comando e o
// embedBlock da resposta logo abaixo são um par indivisível — partindo de
// qualquer um dos dois.
export function blockRange(doc: ProseMirrorNode, unit: BlockUnit): { from: number; to: number } {
  let from = unit.pos
  let to = unit.pos + unit.node.nodeSize
  if (isCommandLine(unit.node)) {
    const next = doc.nodeAt(to)
    if (next?.type.name === 'embedBlock') to += next.nodeSize
  } else if (unit.node.type.name === 'embedBlock') {
    const prev = doc.resolve(from).nodeBefore
    if (prev && isCommandLine(prev)) from -= prev.nodeSize
  }
  return { from, to }
}
