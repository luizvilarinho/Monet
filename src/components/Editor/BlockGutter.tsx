import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CheckSquare,
  Copy,
  DotsSixVertical,
  ListBullets,
  ListNumbers,
  Plus,
  Quotes,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextT,
  Trash,
  type IconProps,
} from '@phosphor-icons/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { isPotentialCommandLine } from './commandParser'
import { blockRange, isCommandLine, resolveBlockUnit } from './blockUnit'
import type { BlockUnit } from './blockUnit'
import { setBlockMark } from './BlockHandle'
import { deleteBlockUnit, duplicateBlockUnit, trackHandlePress } from './blockDrag'
import { canTurnInto, turnBlockInto, type TurnIntoKind } from './formattingActions'
import { useAnchoredPosition, type PopoverAnchor } from './anchoredPosition'
import styles from './Editor.module.css'

// Gutter flutuante à esquerda do bloco sob o mouse: "+" insere uma linha
// abaixo (Shift: acima) e o handle (⠿) arrasta o bloco ou, no clique, abre o
// menu do bloco (Turn into, Duplicate, Delete). Um par de botões só,
// reposicionado no mousemove — sem widget por bloco, nada roda enquanto se
// digita. Some sob a régua e durante a seleção com o mouse.

interface BlockGutterProps {
  editor: TiptapEditor | null
  scrollEl: HTMLDivElement | null
  disabled: boolean
  // Handle (⠿) ao lado do "+". Sem ele (painel de notas do Reader) só o "+".
  blockHandles: boolean
}

interface GutterState {
  unit: BlockUnit
  top: number
  left: number
}

interface MenuState {
  unit: BlockUnit
  anchor: PopoverAnchor
}

const TURN_INTO: Array<{ kind: TurnIntoKind; label: string; icon: ComponentType<IconProps> }> = [
  { kind: 'paragraph', label: 'Text', icon: TextT },
  { kind: 'h1', label: 'Heading 1', icon: TextHOne },
  { kind: 'h2', label: 'Heading 2', icon: TextHTwo },
  { kind: 'h3', label: 'Heading 3', icon: TextHThree },
  { kind: 'ul', label: 'Bulleted list', icon: ListBullets },
  { kind: 'ol', label: 'Numbered list', icon: ListNumbers },
  { kind: 'todo', label: 'Checklist', icon: CheckSquare },
  { kind: 'blockquote', label: 'Quote', icon: Quotes },
  { kind: 'toggle', label: 'Toggle', icon: CaretRight },
]

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

// Menu do bloco: foco no 1º item, ↑↓ entre os itens, Delete por último.
// "Turn into" abre a lista de tipos logo abaixo dele.
function BlockMenu({
  editor,
  menu,
  menuRef,
  onClose,
}: {
  editor: TiptapEditor
  menu: MenuState
  menuRef: RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  const [turnOpen, setTurnOpen] = useState(false)
  const pos = useAnchoredPosition(menuRef, menu.anchor)
  const { unit } = menu
  const turnable = canTurnInto(unit.node) && !isCommandLine(unit.node)
  // O par /comando + resposta não duplica: as duas cópias seriam da mesma
  // resposta (o mesmo commandId).
  const duplicable = !isCommandLine(unit.node) && unit.node.type.name !== 'embedBlock'

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [menuRef])

  useEffect(() => {
    if (!turnOpen) return
    menuRef.current?.querySelector<HTMLButtonElement>('[data-turn-into]')?.focus({ preventScroll: true })
  }, [turnOpen, menuRef])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    items[(at + step + items.length) % items.length].focus({ preventScroll: true })
  }

  const turnInto = (kind: TurnIntoKind) => {
    onClose()
    turnBlockInto(editor, unit.pos, unit.node, kind)
  }

  const duplicate = () => {
    onClose()
    duplicateBlockUnit(editor.view, unit)
  }

  const remove = () => {
    onClose()
    deleteBlockUnit(editor.view, unit)
  }

  return createPortal(
    <div
      ref={menuRef}
      className={styles.blockMenu}
      role="menu"
      aria-label="Block options"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
    >
      {turnable && (
        <>
          <button
            type="button"
            role="menuitem"
            className={styles.blockMenuItem}
            aria-expanded={turnOpen}
            onClick={() => setTurnOpen((v) => !v)}
          >
            <ArrowsClockwise size={15} aria-hidden />
            <span className={styles.blockMenuLabel}>Turn into</span>
            {turnOpen ? <CaretDown size={12} aria-hidden /> : <CaretRight size={12} aria-hidden />}
          </button>
          {turnOpen &&
            TURN_INTO.map(({ kind, label, icon: IconCmp }, i) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                data-turn-into={i === 0 ? '' : undefined}
                className={`${styles.blockMenuItem} ${styles.blockMenuSub}`}
                onClick={() => turnInto(kind)}
              >
                <IconCmp size={15} aria-hidden />
                <span className={styles.blockMenuLabel}>{label}</span>
              </button>
            ))}
        </>
      )}
      {duplicable && (
        <button type="button" role="menuitem" className={styles.blockMenuItem} onClick={duplicate}>
          <Copy size={15} aria-hidden />
          <span className={styles.blockMenuLabel}>Duplicate</span>
        </button>
      )}
      {(turnable || duplicable) && <div className={styles.blockMenuSep} role="separator" />}
      <button
        type="button"
        role="menuitem"
        className={`${styles.blockMenuItem} ${styles.blockMenuDanger}`}
        onClick={remove}
        title="Delete the block (Ctrl+Z brings it back)"
      >
        <Trash size={15} aria-hidden />
        <span className={styles.blockMenuLabel}>Delete</span>
      </button>
    </div>,
    document.body
  )
}

export function BlockGutter({ editor, scrollEl, disabled, blockHandles }: BlockGutterProps) {
  const [gutter, setGutter] = useState<GutterState | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [dragging, setDragging] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
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
      // Sobre a régua ou o menu da marca, ou com seleção pelo mouse em curso:
      // o gutter não aparece embaixo deles.
      if (
        disabled ||
        !editor.isEditable ||
        target?.closest('td, th, [data-editor-bubble]') ||
        e.buttons !== 0
      ) {
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

  // Menu aberto: Esc, clique fora, rolagem ou doc mudando fecham.
  useEffect(() => {
    if (!menu || !editor || !scrollEl) return
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
    // Abaixo do handle; perto da borda de baixo, vira para cima.
    setMenu({ unit, anchor: { top: anchor.bottom + 4, left: anchor.left, lineTop: anchor.top } })
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
      {menu && <BlockMenu key={menu.unit.pos} editor={editor} menu={menu} menuRef={menuRef} onClose={closeMenu} />}
    </>
  )
}
