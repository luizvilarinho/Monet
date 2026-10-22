import { TextSelection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { blockRange, isCommandLine, ITEM_TYPES, type BlockUnit } from './blockUnit'
import { setBlockMark } from './BlockHandle'

// Arrastar e apagar bloco pelo handle do gutter (⠿). O arrasto é manual
// (mousedown/mousemove/mouseup no document): o drag HTML5 não é confiável
// dentro do contenteditable.

// Abaixo disso é clique (abre o menu do bloco); acima, arrasto.
const DRAG_THRESHOLD = 4
// Faixa junto à borda do `.body` que rola a nota durante o arrasto.
const AUTOSCROLL_EDGE = 56
const AUTOSCROLL_MAX_STEP = 16

interface Range {
  from: number
  to: number
}

interface Box {
  top: number
  bottom: number
  left: number
  width: number
}

interface DropSlot {
  pos: number
  // Linha do indicador (viewport).
  y: number
  left: number
  width: number
}

// Vagas de soltar: os irmãos do bloco — no doc, na lista ou no toggle. O bloco
// não muda de contêiner. O par linha de /comando + resposta conta como um
// irmão só, para nada cair no meio dele.
function siblingGroups(doc: PMNode, unitPos: number): Range[] {
  const $pos = doc.resolve(unitPos)
  const start = $pos.start()
  const groups: Range[] = []
  $pos.parent.forEach((child, offset) => {
    const from = start + offset
    const last = groups[groups.length - 1]
    if (last && child.type.name === 'embedBlock' && isCommandLine(doc.nodeAt(last.from))) {
      last.to = from + child.nodeSize
      return
    }
    groups.push({ from, to: from + child.nodeSize })
  })
  return groups
}

function groupBox(view: EditorView, group: Range): Box | null {
  const first = view.nodeDOM(group.from)
  const lastNode = view.state.doc.resolve(group.to).nodeBefore
  const last = lastNode ? view.nodeDOM(group.to - lastNode.nodeSize) : null
  if (!(first instanceof HTMLElement)) return null
  const a = first.getBoundingClientRect()
  if (a.height === 0) return null
  const b = last instanceof HTMLElement ? last.getBoundingClientRect() : a
  return { top: a.top, bottom: Math.max(a.bottom, b.bottom), left: a.left, width: a.width }
}

// Só o Y decide: no arrasto o mouse está na margem, onde o posAtCoords
// devolve sempre "antes do bloco" (e arrastar uma linha para baixo de outra
// caía no próprio lugar). Busca binária: os irmãos estão em ordem vertical.
function dropSlot(view: EditorView, groups: Range[], clientY: number): DropSlot | null {
  const n = groups.length
  if (n === 0) return null
  const boxes = new Map<number, Box | null>()
  const boxAt = (i: number): Box | null => {
    if (!boxes.has(i)) boxes.set(i, groupBox(view, groups[i]))
    return boxes.get(i) ?? null
  }
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const box = boxAt(mid)
    if (box && clientY < (box.top + box.bottom) / 2) hi = mid
    else lo = mid + 1
  }
  const above = lo > 0 ? boxAt(lo - 1) : null
  const below = lo < n ? boxAt(lo) : null
  const ref = below ?? above
  if (!ref) return null
  const y =
    above && below ? (above.bottom + below.top) / 2
    : below ? below.top - 2
    : ref.bottom + 2
  return { pos: lo < n ? groups[lo].from : groups[n - 1].to, y, left: ref.left, width: ref.width }
}

function moveBlock(view: EditorView, unit: BlockUnit, source: Range, target: number): void {
  const { state } = view
  // O doc mudou durante o arrasto (resposta de IA chegando, eco de outra
  // janela): as posições não valem mais.
  if (state.doc.nodeAt(unit.pos) !== unit.node) return
  const { from: selFrom } = state.selection
  const content = state.doc.slice(source.from, source.to).content
  const tr = state.tr.delete(source.from, source.to)
  const at = tr.mapping.map(target)
  tr.insert(at, content)
  // Cursor que estava no bloco vai junto com ele.
  if (selFrom >= source.from && selFrom <= source.to) {
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(at + 1, tr.doc.content.size))))
  }
  view.dispatch(tr)
}

export interface HandlePressOptions {
  // Contêiner que rola a nota (`.body`): autoscroll perto das bordas.
  scrollEl: HTMLElement
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
}

// Segue um mousedown no handle: clique (sem passar do limiar) chama onClick;
// arrasto move o bloco para a vaga sob o mouse. Esc cancela.
export function trackHandlePress(
  view: EditorView,
  unit: BlockUnit,
  down: MouseEvent,
  options: HandlePressOptions
): void {
  const source = blockRange(view.state.doc, unit)
  const groups = siblingGroups(view.state.doc, unit.pos)
  const { scrollEl } = options
  let dragging = false
  let lastY = down.clientY
  let slot: DropSlot | null = null
  let indicator: HTMLDivElement | null = null
  let scrollFrame = 0

  const update = () => {
    slot = dropSlot(view, groups, lastY)
    // Vaga colada ao próprio bloco: soltar ali não muda nada.
    if (!slot || slot.pos === source.from || slot.pos === source.to) {
      slot = null
      if (indicator) indicator.style.display = 'none'
      return
    }
    if (!indicator) {
      indicator = document.createElement('div')
      indicator.className = 'monetCmdDropIndicator'
      document.body.appendChild(indicator)
    }
    indicator.style.display = 'block'
    indicator.style.top = `${slot.y - 1}px`
    indicator.style.left = `${slot.left}px`
    indicator.style.width = `${slot.width}px`
  }

  const autoscroll = () => {
    scrollFrame = 0
    const rect = scrollEl.getBoundingClientRect()
    const overTop = rect.top + AUTOSCROLL_EDGE - lastY
    const overBottom = lastY - (rect.bottom - AUTOSCROLL_EDGE)
    const depth = overTop > 0 ? -overTop : overBottom > 0 ? overBottom : 0
    if (depth === 0) return
    const step = Math.sign(depth) * Math.ceil(Math.min(1, Math.abs(depth) / AUTOSCROLL_EDGE) * AUTOSCROLL_MAX_STEP)
    const before = scrollEl.scrollTop
    scrollEl.scrollTop += step
    if (scrollEl.scrollTop === before) return
    update()
    scrollFrame = requestAnimationFrame(autoscroll)
  }

  const finish = (drop: boolean) => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.removeEventListener('keydown', onKey, true)
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
    indicator?.remove()
    if (!dragging) return
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (!view.isDestroyed) {
      setBlockMark(view, null)
      if (drop && slot) moveBlock(view, unit, source, slot.pos)
    }
    options.onDragEnd()
  }

  const onMove = (e: MouseEvent) => {
    lastY = e.clientY
    if (!dragging) {
      if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < DRAG_THRESHOLD) return
      dragging = true
      options.onDragStart()
      setBlockMark(view, { ...source, kind: 'drag' })
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
    update()
    if (!scrollFrame) scrollFrame = requestAnimationFrame(autoscroll)
  }

  const onUp = () => {
    const wasDrag = dragging
    finish(true)
    if (!wasDrag) options.onClick()
  }

  // Em captura: o Esc que cancela o arraste chega já tratado (defaultPrevented)
  // a quem escuta no document, como o modal da task.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (dragging) e.preventDefault()
    finish(false)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.addEventListener('keydown', onKey, true)
}

// Apaga a unidade (sem confirmação: o Ctrl+Z desfaz). O par /comando +
// resposta sai junto e a resposta sai também do painel de IA.
export function deleteBlockUnit(
  view: EditorView,
  unit: BlockUnit,
  onRemoveResponse?: (commandId: string) => void
): void {
  const { doc } = view.state
  if (doc.nodeAt(unit.pos) !== unit.node) return
  let { from, to } = blockRange(doc, unit)
  // Único item da lista: sai a lista inteira — senão o schema recriaria um
  // item vazio no lugar.
  const $from = doc.resolve(from)
  if (ITEM_TYPES.has(unit.node.type.name) && $from.parent.childCount === 1) {
    from = $from.before()
    to = $from.after()
  }
  const commandIds: string[] = []
  doc.nodesBetween(from, to, (node) => {
    const id = node.type.name === 'embedBlock' ? node.attrs.commandId : null
    if (typeof id === 'string' && id) commandIds.push(id)
    return !node.isAtom
  })
  const tr = view.state.tr.delete(from, to)
  // Seleção válida no lugar do bloco e foco de volta: sem isso o Ctrl+Z não
  // tem onde agir.
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(from, tr.doc.content.size))))
  view.dispatch(tr)
  view.focus()
  commandIds.forEach((id) => onRemoveResponse?.(id))
}
