import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { DotsSixVertical, Plus, Trash } from '@phosphor-icons/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { isPotentialCommandLine } from './commandParser'
import { blockRange, resolveBlockUnit } from './blockUnit'
import type { BlockUnit } from './blockUnit'
import { setBlockMark } from './BlockHandle'
import { deleteBlockUnit, trackHandlePress } from './blockDrag'
import styles from './Editor.module.css'

// Gutter flutuante à esquerda do bloco sob o mouse: "+" insere uma linha
// abaixo (Shift: acima) e o handle (⠿) arrasta o bloco ou, no clique, abre o
// menu do bloco (Delete). Um par de botões só, reposicionado no mousemove —
// sem widget por bloco, nada roda enquanto se digita.

interface BlockGutterProps {
  editor: TiptapEditor | null
  scrollEl: HTMLDivElement | null
  disabled: boolean
  // Handle (⠿) ao lado do "+". Sem ele (painel de notas do Reader) só o "+".
  blockHandles: boolean
  // Apagar a linha de /comando tira a resposta também do painel de IA.
  onRemoveResponse?: (commandId: string) => void
}

interface GutterState {
  unit: BlockUnit
  top: number
  left: number
}

interface MenuState {
  unit: BlockUnit
  top: number
  left: number
}

const GUTTER_HEIGHT = 22
// Botões de 18px, 2px entre eles e 4px até o texto.
const BUTTON_SIZE = 18
const BUTTON_GAP = 2
const TEXT_GAP = 4
// Mouse além disso acima/abaixo do bloco (ex.: o respiro no fim da nota) esconde.
const VERTICAL_SLACK = 16
// Ponto de sondagem do bloco: dentro da coluna de texto, depois do recuo de
// lista/toggle. O meio do editor caía fora da coluna em janela larga (o texto
// para em --measure-note) e o "+" sumia dos parágrafos.
const PROBE_INSET = 160
const MENU_HEIGHT = 40

// Topo do gutter centralizado na 1ª linha do bloco (blocos sem texto: no topo).
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
  blockHandles: boolean,
): GutterState | null {
  const { view } = editor
  // Nó atômico (imagem, embed) na borda esquerda do conteúdo vale como está;
  // senão resolve dentro da coluna, na mesma altura, onde o elemento é o
  // bloco mais interno (na borda cai no padding de lista/toggle).
  const domRect = view.dom.getBoundingClientRect()
  const contentLeft = domRect.left + parseFloat(getComputedStyle(view.dom).paddingLeft)
  const edge = view.posAtCoords({ left: Math.max(clientX, contentLeft + 2), top: clientY })
  const edgeNode = edge && edge.inside >= 0 ? view.state.doc.nodeAt(edge.inside) : null
  const probeX = Math.min((domRect.left + domRect.right) / 2, contentLeft + PROBE_INSET)
  const coords = edgeNode?.isAtom ? edge : view.posAtCoords({ left: probeX, top: clientY })
  if (!coords) return null
  // Toggle: acima do conteúdo (ou recolhido) é o cabeçalho.
  let onToggleHeader = false
  if (coords.inside >= 0 && view.state.doc.nodeAt(coords.inside)?.type.name === 'toggleBlock') {
    const toggleDom = view.nodeDOM(coords.inside)
    const content = toggleDom instanceof HTMLElement ? toggleDom.querySelector('[data-node-view-content]') : null
    const r = content?.getBoundingClientRect()
    onToggleHeader = !r || r.height === 0 || clientY < r.top
  }
  const unit = resolveBlockUnit(view.state.doc, coords.pos, coords.inside, onToggleHeader)
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
  // Item de lista: alinha pela lista, para não cobrir o marcador do item.
  const anchorLeft =
    unit.node.type.name === 'listItem' && dom.parentElement ? dom.parentElement.getBoundingClientRect().left : rect.left
  const width = blockHandles ? 2 * BUTTON_SIZE + BUTTON_GAP : BUTTON_SIZE
  const hostRect = scrollEl.getBoundingClientRect()
  const left = anchorLeft - hostRect.left - width - TEXT_GAP
  // O `.body` corta o que passa da borda esquerda: o "+" sozinho encosta em 0;
  // com o handle não cabe sem cobrir o texto, então some.
  if (left < 0 && blockHandles) return null
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

export function BlockGutter({ editor, scrollEl, disabled, blockHandles, onRemoveResponse }: BlockGutterProps) {
  const [gutter, setGutter] = useState<GutterState | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [dragging, setDragging] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const deleteRef = useRef<HTMLButtonElement>(null)
  // Menu aberto ou arrasto em curso: o gutter fica parado no bloco.
  const pinnedRef = useRef(false)
  pinnedRef.current = menu !== null || dragging

  const closeMenu = useCallback(() => {
    setMenu(null)
    if (editor && !editor.isDestroyed) setBlockMark(editor.view, null)
  }, [editor])

  useEffect(() => {
    if (!editor || !scrollEl) return
    let frame = 0
    let lastEvent: MouseEvent | null = null
    const hide = () => setGutter(null)
    const update = () => {
      frame = 0
      const e = lastEvent
      if (!e || pinnedRef.current) return
      const target = e.target instanceof Element ? e.target : null
      // Sobre os próprios botões: mantém a unidade.
      if (target && wrapRef.current?.contains(target)) return
      if (disabled || !editor.isEditable || target?.closest('td, th')) {
        hide()
        return
      }
      const next = computeGutter(editor, scrollEl, e.clientX, e.clientY, blockHandles)
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
      if (!pinnedRef.current) hide()
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
  }, [editor, scrollEl, disabled, blockHandles])

  // Preview ligado ou handle desligado: o menu não sobrevive.
  useEffect(() => {
    if (menu && (disabled || !blockHandles)) closeMenu()
  }, [menu, disabled, blockHandles, closeMenu])

  // Menu aberto: foco no Delete (Enter apaga); Esc, clique fora, rolagem ou
  // doc mudando fecham.
  useEffect(() => {
    if (!menu || !editor || !scrollEl) return
    deleteRef.current?.focus({ preventScroll: true })
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || handleRef.current?.contains(target)) return
      closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeMenu()
      editor.view.focus()
    }
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) closeMenu()
    }
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onKey, true)
    scrollEl.addEventListener('scroll', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('blur', closeMenu)
    editor.on('transaction', onTransaction)
    return () => {
      document.removeEventListener('mousedown', onDocDown, true)
      document.removeEventListener('keydown', onKey, true)
      scrollEl.removeEventListener('scroll', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('blur', closeMenu)
      editor.off('transaction', onTransaction)
    }
  }, [menu, editor, scrollEl, closeMenu])

  // Desmontagem com o menu aberto (troca de nota): limpa a marca do bloco.
  useEffect(() => () => {
    if (pinnedRef.current && editor && !editor.isDestroyed) setBlockMark(editor.view, null)
  }, [editor])

  const openMenu = (unit: BlockUnit, anchor: DOMRect) => {
    if (!editor) return
    const below = anchor.bottom + 4
    setMenu({
      unit,
      top: below + MENU_HEIGHT > window.innerHeight - 8 ? anchor.top - MENU_HEIGHT - 4 : below,
      left: anchor.left,
    })
    setBlockMark(editor.view, { ...blockRange(editor.state.doc, unit), kind: 'menu' })
  }

  const onHandleMouseDown = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !editor || !gutter || !scrollEl) return
    // Sem roubar o foco/seleção do editor.
    e.preventDefault()
    const { unit } = gutter
    const anchor = e.currentTarget.getBoundingClientRect()
    const wasOpen = menu !== null
    trackHandlePress(editor.view, unit, e.nativeEvent, {
      scrollEl,
      onClick: () => (wasOpen ? closeMenu() : openMenu(unit, anchor)),
      onDragStart: () => {
        if (wasOpen) closeMenu()
        setDragging(true)
      },
      onDragEnd: () => {
        setDragging(false)
        setGutter(null)
      },
    })
  }

  const deleteBlock = () => {
    if (!editor || !menu) return
    const { unit } = menu
    closeMenu()
    deleteBlockUnit(editor.view, unit, onRemoveResponse)
  }

  if (!editor) return null

  return (
    <>
      {gutter && !dragging && (
        <div ref={wrapRef} className={styles.blockGutter} style={{ top: gutter.top, left: gutter.left }}>
          <button
            type="button"
            className={styles.gutterBtn}
            title="Add line below (Shift: above)"
            aria-label="Add line"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => insertAround(editor, gutter.unit, e.shiftKey ? 'above' : 'below')}
          >
            <Plus size={14} />
          </button>
          {blockHandles && (
            <button
              ref={handleRef}
              type="button"
              className={[styles.gutterBtn, styles.gutterHandle, menu ? styles.gutterActive : ''].join(' ')}
              title="Drag to move · Click for options"
              aria-label="Block options"
              aria-haspopup="menu"
              aria-expanded={menu !== null}
              onMouseDown={onHandleMouseDown}
            >
              <DotsSixVertical size={16} weight="bold" />
            </button>
          )}
        </div>
      )}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.blockMenu}
            role="menu"
            style={{ top: menu.top, left: menu.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              ref={deleteRef}
              type="button"
              role="menuitem"
              className={styles.blockMenuItem}
              onClick={deleteBlock}
            >
              <Trash size={15} />
              <span>Delete</span>
            </button>
          </div>,
          document.body
        )}
    </>
  )
}
