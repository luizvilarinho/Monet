import { useEffect, useRef, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection, type EditorState } from '@tiptap/pm/state'
import { isPotentialCommandLine } from './commandParser'
import styles from './Editor.module.css'

// "+" flutuante à esquerda do bloco sob o mouse: clique insere uma linha
// abaixo, Shift+clique acima. Um elemento só, reposicionado no mousemove (sem
// widget por bloco, como o ⋮⋮ do checklist).

interface BlockGutterProps {
  editor: TiptapEditor | null
  scrollEl: HTMLDivElement | null
  disabled: boolean
}

interface BlockUnit {
  pos: number
  node: ProseMirrorNode
}

interface GutterState {
  unit: BlockUnit
  top: number
  left: number
}

const GUTTER_HEIGHT = 20
// Lugar do ⋮⋮ (left: -22px); bloco que já tem ⋮⋮ empurra o "+" para a esquerda.
const GUTTER_OFFSET = 22
const BESIDE_HANDLE_OFFSET = 40
// Mouse além disso acima/abaixo do bloco (ex.: o respiro no fim da nota) esconde.
const VERTICAL_SLACK = 16
const ITEM_TYPES = new Set(['taskItem', 'listItem'])

// Unidade de bloco do ponto: item de lista/checklist; tabela inteira; filho
// direto do toggle (ou o toggle, sobre o cabeçalho); senão o bloco de topo.
// Nó atômico (embed, /tasks, nota linkada, imagem) cai como o próprio nó.
// A cadeia vem dos ancestrais de `pos`: o `inside` é o elemento sob o ponto
// (padding de `ul`/toggle) e só vale para nó atômico ou cabeçalho do toggle.
function resolveBlockUnit(state: EditorState, pos: number, inside: number, onToggleHeader: boolean): BlockUnit | null {
  const { doc } = state
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

// Topo do "+" centralizado na 1ª linha do bloco (blocos sem texto: no topo).
function firstLineTop(editor: TiptapEditor, unit: BlockUnit, rect: DOMRect): number {
  const { node, pos } = unit
  const textStart =
    node.isTextblock ? pos + 1
    : node.type.name !== 'toggleBlock' && node.firstChild?.isTextblock ? pos + 2
    : null
  if (textStart === null) return rect.top + 2
  const coords = editor.view.coordsAtPos(textStart)
  return (coords.top + coords.bottom) / 2 - GUTTER_HEIGHT / 2
}

function computeGutter(
  editor: TiptapEditor,
  scrollEl: HTMLDivElement,
  clientX: number,
  clientY: number,
): GutterState | null {
  const { view } = editor
  // Nó atômico (imagem, embed) na borda esquerda do conteúdo vale como está;
  // senão resolve no meio da mesma altura, onde o elemento é o bloco mais
  // interno (na borda cai no padding de lista/toggle).
  const domRect = view.dom.getBoundingClientRect()
  const contentLeft = domRect.left + parseFloat(getComputedStyle(view.dom).paddingLeft)
  const edge = view.posAtCoords({ left: Math.max(clientX, contentLeft + 2), top: clientY })
  const edgeNode = edge && edge.inside >= 0 ? view.state.doc.nodeAt(edge.inside) : null
  const coords = edgeNode?.isAtom
    ? edge
    : view.posAtCoords({ left: Math.max(clientX, (domRect.left + domRect.right) / 2), top: clientY })
  if (!coords) return null
  // Toggle: acima do conteúdo (ou recolhido) é o cabeçalho.
  let onToggleHeader = false
  if (coords.inside >= 0 && view.state.doc.nodeAt(coords.inside)?.type.name === 'toggleBlock') {
    const toggleDom = view.nodeDOM(coords.inside)
    const content = toggleDom instanceof HTMLElement ? toggleDom.querySelector('[data-node-view-content]') : null
    const r = content?.getBoundingClientRect()
    onToggleHeader = !r || r.height === 0 || clientY < r.top
  }
  const unit = resolveBlockUnit(view.state, coords.pos, coords.inside, onToggleHeader)
  if (!unit) return null
  const { doc } = view.state
  // Parágrafo vazio final: o Enter já cobre.
  if (
    unit.pos + unit.node.nodeSize === doc.content.size &&
    unit.node.type.name === 'paragraph' &&
    unit.node.content.size === 0
  ) {
    return null
  }
  const dom = view.nodeDOM(unit.pos)
  if (!(dom instanceof HTMLElement)) return null
  const rect = dom.getBoundingClientRect()
  if (clientY < rect.top - VERTICAL_SLACK || clientY > rect.bottom + VERTICAL_SLACK) return null
  const type = unit.node.type.name
  // Item de lista: alinha pela lista, para não cobrir o marcador do item.
  const anchorLeft =
    type === 'listItem' && dom.parentElement ? dom.parentElement.getBoundingClientRect().left : rect.left
  const besideHandle = type === 'taskItem' || dom.classList.contains('monetCmdExecuted')
  const hostRect = scrollEl.getBoundingClientRect()
  const left = anchorLeft - hostRect.left - (besideHandle ? BESIDE_HANDLE_OFFSET : GUTTER_OFFSET)
  // O `.body` corta o que passa da borda esquerda: sem ⋮⋮ encosta em 0; ao
  // lado do ⋮⋮ não cabe sem cobri-lo, então some.
  if (left < 0 && besideHandle) return null
  return {
    unit,
    top: firstLineTop(editor, unit, rect) - hostRect.top + scrollEl.scrollTop,
    left: Math.max(0, left),
  }
}

function sameGutter(a: GutterState | null, b: GutterState | null): boolean {
  if (!a || !b) return a === b
  return a.unit.pos === b.unit.pos && a.unit.node === b.unit.node && a.top === b.top && a.left === b.left
}

// Insere irmão vazio abaixo/acima da unidade e põe o cursor nele. Linha de
// /comando + resposta é uma unidade só: o par nunca é separado.
function insertAround(editor: TiptapEditor, unit: BlockUnit, where: 'above' | 'below') {
  const { state, view } = editor
  const { doc, schema } = state
  const { pos, node } = unit
  if (doc.nodeAt(pos) !== node) return
  let at = where === 'below' ? pos + node.nodeSize : pos
  if (where === 'below' && node.type.name === 'paragraph') {
    const next = doc.nodeAt(at)
    if (next?.type.name === 'embedBlock') at += next.nodeSize
  }
  if (where === 'above' && node.type.name === 'embedBlock') {
    const prev = doc.resolve(pos).nodeBefore
    if (prev?.type.name === 'paragraph' && isPotentialCommandLine(prev.textContent)) at = pos - prev.nodeSize
  }
  const paragraph = schema.nodes.paragraph.create()
  const type = node.type.name
  // Item de checklist novo é item comum, nunca task (só "Add to Tasks" cria).
  const inserted =
    type === 'taskItem' ? schema.nodes.taskItem.create({ checked: false }, paragraph)
    : type === 'listItem' ? schema.nodes.listItem.create(null, paragraph)
    : paragraph
  const tr = state.tr.insert(at, inserted)
  tr.setSelection(TextSelection.create(tr.doc, at + (inserted === paragraph ? 1 : 2)))
  view.dispatch(tr.scrollIntoView())
  view.focus()
}

export function BlockGutter({ editor, scrollEl, disabled }: BlockGutterProps) {
  const [gutter, setGutter] = useState<GutterState | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!editor || !scrollEl) return
    let frame = 0
    let lastEvent: MouseEvent | null = null
    const hide = () => setGutter(null)
    const update = () => {
      frame = 0
      const e = lastEvent
      if (!e) return
      const target = e.target instanceof Element ? e.target : null
      // Sobre o próprio "+": mantém a unidade.
      if (target && buttonRef.current?.contains(target)) return
      if (disabled || !editor.isEditable || target?.closest('td, th')) {
        hide()
        return
      }
      const next = computeGutter(editor, scrollEl, e.clientX, e.clientY)
      setGutter((prev) => (sameGutter(prev, next) ? prev : next))
    }
    const onMove = (e: MouseEvent) => {
      lastEvent = e
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onLeave = () => {
      lastEvent = null
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      hide()
    }
    // Doc mudou (digitação, troca de nota, o próprio "+"): posição defasada.
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) hide()
    }
    scrollEl.addEventListener('mousemove', onMove)
    scrollEl.addEventListener('mouseleave', onLeave)
    editor.on('transaction', onTransaction)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      scrollEl.removeEventListener('mousemove', onMove)
      scrollEl.removeEventListener('mouseleave', onLeave)
      editor.off('transaction', onTransaction)
      hide()
    }
  }, [editor, scrollEl, disabled])

  if (!editor || !gutter) return null

  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.blockGutter}
      style={{ top: gutter.top, left: gutter.left }}
      title="Add line below (Shift: above)"
      aria-label="Add line"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => insertAround(editor, gutter.unit, e.shiftKey ? 'above' : 'below')}
    >
      <Plus size={14} />
    </button>
  )
}
