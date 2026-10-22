import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import type { BlockUnit } from './blockUnit'
import { blockRange, findListRange, resolveBlockUnitAt, ITEM_TYPES, LIST_TYPES } from './blockUnit'
import { computeDropTarget, computeListDropTarget } from './CommandExtension'
import { previewPluginKey } from './PreviewMode'

export interface BlockHandleOptions {
  // Espelha o /comando: apagar a linha também tira a resposta do painel de IA.
  onRemoveResponse?: (id: string) => void
}

const HANDLE_CLASS = 'monetBlockHandle'
const ARMED_CLASS = 'is-armed'
const FLOAT_CLASS = 'is-float'
// Mesmo limiar do handle de /comando: abaixo disso é clique, acima é arrasto.
const DRAG_THRESHOLD = 4

interface HandleTarget {
  pos: number
  node: PMNode
  // true: o widget cabe dentro do bloco (textblock); false: fica antes do nó
  // (bloco sem conteúdo, como `hr`, tabela ou toggle).
  inside: boolean
}

interface WidgetSpec {
  blockHandle?: boolean
  inside?: boolean
}

interface BlockHandlePluginState {
  set: DecorationSet
  nextKey: number
}

const blockHandlePluginKey = new PluginKey<BlockHandlePluginState>('monetBlockHandle')

// Desarma o handle armado quando o clique cai fora dele.
const disarmListeners = new WeakMap<HTMLElement, () => void>()

// Blocos de topo que recebem handle. A lista não recebe: cada item recebe o
// seu (e listas aninhadas dentro de um item também).
function collectTargets(doc: PMNode): HandleTarget[] {
  const targets: HandleTarget[] = []
  doc.forEach((node, offset) => {
    if (LIST_TYPES.has(node.type.name)) {
      collectListItems(node, offset, targets)
      return
    }
    targets.push({ pos: offset, node, inside: node.isTextblock })
  })
  return targets
}

// Itens de lista e checklist (e as listas aninhadas dentro deles) têm handle
// individual: o widget vai dentro do `li`, como o handle de task antigo.
function collectListItems(list: PMNode, listPos: number, out: HandleTarget[]): void {
  list.forEach((item, itemOffset) => {
    if (!ITEM_TYPES.has(item.type.name)) return
    const itemPos = listPos + 1 + itemOffset
    out.push({ pos: itemPos, node: item, inside: true })
    item.forEach((child, childOffset) => {
      if (LIST_TYPES.has(child.type.name)) collectListItems(child, itemPos + 1 + childOffset, out)
    })
  })
}

// A unidade do bloco que o handle representa, resolvida no momento do clique:
// `getPos()` devolve a posição viva do widget (o DOM não é recriado a cada
// tecla, então a posição é a única coisa que muda).
function unitAt(view: EditorView, getPos: () => number | undefined): BlockUnit | null {
  let widgetPos: number | undefined
  try {
    widgetPos = getPos()
  } catch {
    return null
  }
  if (typeof widgetPos !== 'number') return null
  const doc = view.state.doc
  // Widget dentro do bloco (textblock): o bloco começa uma posição antes.
  // Widget antes do nó (bloco sem conteúdo): o bloco começa na própria posição.
  const blockPos = doc.resolve(widgetPos).depth === 0 ? widgetPos : widgetPos - 1
  return resolveBlockUnitAt(doc, blockPos)
}

function liveRange(view: EditorView, getPos: () => number | undefined): { from: number; to: number } | null {
  const unit = unitAt(view, getPos)
  if (!unit) return null
  return blockRange(view.state.doc, unit)
}

// Id da resposta de IA ligada à linha de /comando (o embedBlock seguinte).
function commandIdFor(doc: PMNode, unit: BlockUnit): string | null {
  if (unit.node.type.name !== 'paragraph') return null
  const next = doc.nodeAt(unit.pos + unit.node.nodeSize)
  if (next?.type.name !== 'embedBlock') return null
  const id = next.attrs.commandId
  return typeof id === 'string' && id ? id : null
}

function deleteUnit(view: EditorView, unit: BlockUnit, options: BlockHandleOptions): void {
  const doc = view.state.doc
  const range = blockRange(doc, unit)
  const commandId = commandIdFor(doc, unit)
  const tr = view.state.tr.delete(range.from, range.to)
  // Sem seleção válida o cursor fica fora do editor e o Ctrl+Z não desfaz.
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(range.from, tr.doc.content.size - 1))))
  view.dispatch(tr)
  view.focus()
  if (commandId) options.onRemoveResponse?.(commandId)
}

function disarmHandle(handle: HTMLElement): void {
  const disarm = disarmListeners.get(handle)
  if (disarm) {
    disarm()
    return
  }
  handle.classList.remove(ARMED_CLASS)
}

// Estado "armado" no DOM (classe CSS): o glifo vira lixeira no mesmo lugar.
function armHandle(handle: HTMLElement): void {
  handle.classList.add(ARMED_CLASS)
  const onDocMouseDown = (event: MouseEvent) => {
    document.removeEventListener('mousedown', onDocMouseDown, true)
    disarmListeners.delete(handle)
    if (event.target instanceof Node && handle.contains(event.target)) return
    handle.classList.remove(ARMED_CLASS)
  }
  const disarm = () => {
    document.removeEventListener('mousedown', onDocMouseDown, true)
    disarmListeners.delete(handle)
    handle.classList.remove(ARMED_CLASS)
  }
  disarmListeners.set(handle, disarm)
  document.addEventListener('mousedown', onDocMouseDown, true)
}

// Onde o bloco cai: bloco de topo ancora antes/depois de outro bloco de topo;
// item de lista só pode cair dentro da própria lista.
function dropTargetFor(
  view: EditorView,
  unit: BlockUnit,
  clientX: number,
  clientY: number
): number | null {
  if (ITEM_TYPES.has(unit.node.type.name)) {
    const list = findListRange(view.state.doc, unit.pos)
    if (!list) return null
    return computeListDropTarget(view, clientX, clientY, list.listPos, list.listEnd)
  }
  return computeDropTarget(view, clientX, clientY)
}

function makeHandle(
  view: EditorView,
  getPos: () => number | undefined,
  options: BlockHandleOptions,
  inside: boolean
): HTMLElement {
  const handle = document.createElement('span')
  handle.className = inside ? HANDLE_CLASS : `${HANDLE_CLASS} ${FLOAT_CLASS}`
  handle.contentEditable = 'false'
  handle.setAttribute('aria-label', 'drag to reorder')
  handle.title = 'drag to reorder'
  handle.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    startBlockDrag(view, getPos, handle, options, event)
  })
  return handle
}

// Clique arma a lixeira; arrasto move o bloco. O limiar de 4px separa um do
// outro (mesmo do handle de /comando).
function startBlockDrag(
  view: EditorView,
  getPos: () => number | undefined,
  handle: HTMLElement,
  options: BlockHandleOptions,
  down: MouseEvent
): void {
  const unit = unitAt(view, getPos)
  if (!unit) return

  const startX = down.clientX
  const startY = down.clientY
  const wasArmed = handle.classList.contains(ARMED_CLASS)
  let isDragging = false
  let dropTarget: number | null = null
  let indicator: HTMLDivElement | null = null

  const ensureIndicator = (): HTMLDivElement => {
    if (indicator) return indicator
    const el = document.createElement('div')
    el.className = 'monetCmdDropIndicator'
    document.body.appendChild(el)
    indicator = el
    return el
  }

  const positionIndicator = (target: number) => {
    try {
      const coords = view.coordsAtPos(target)
      const editorRect = view.dom.getBoundingClientRect()
      const el = ensureIndicator()
      el.style.display = 'block'
      el.style.left = `${editorRect.left}px`
      el.style.top = `${coords.top - 1}px`
      el.style.width = `${editorRect.width}px`
    } catch {
      if (indicator) indicator.style.display = 'none'
    }
  }

  const onMouseMove = (mv: MouseEvent) => {
    if (!isDragging) {
      const dx = mv.clientX - startX
      const dy = mv.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
      isDragging = true
      disarmHandle(handle)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
    const target = dropTargetFor(view, unit, mv.clientX, mv.clientY)
    dropTarget = target
    if (target === null) {
      if (indicator) indicator.style.display = 'none'
      return
    }
    const live = liveRange(view, getPos)
    if (live && target >= live.from && target <= live.to) {
      if (indicator) indicator.style.display = 'none'
      return
    }
    positionIndicator(target)
  }

  const cleanup = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('keydown', onKeyDown, true)
    if (indicator) {
      indicator.remove()
      indicator = null
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const onMouseUp = () => {
    if (isDragging) {
      if (dropTarget !== null) {
        const live = liveRange(view, getPos)
        if (live && !(dropTarget >= live.from && dropTarget <= live.to)) {
          const sliceContent = view.state.doc.slice(live.from, live.to).content
          let tr = view.state.tr.delete(live.from, live.to)
          const mappedTarget = tr.mapping.map(dropTarget)
          tr.insert(mappedTarget, sliceContent)
          view.dispatch(tr)
        }
      }
      disarmHandle(handle)
    } else if (wasArmed) {
      handle.classList.remove(ARMED_CLASS)
      deleteUnit(view, unit, options)
    } else {
      armHandle(handle)
    }
    cleanup()
  }

  // Em captura: o Esc que cancela o arraste chega já tratado
  // (defaultPrevented) a quem escuta no document.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (isDragging) e.preventDefault()
    cleanup()
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', onKeyDown, true)
}

function makeWidget(target: HandleTarget, key: string, options: BlockHandleOptions): Decoration {
  const pos = target.inside ? target.pos + 1 : target.pos
  return Decoration.widget(
    pos,
    (view, getPos) => makeHandle(view, getPos, options, target.inside),
    {
      side: -1,
      ignoreSelection: true,
      stopEvent: () => true,
      key,
      blockHandle: true,
      inside: target.inside,
    }
  )
}

// Conjunto inicial: um widget por bloco elegível, com chave nova.
function buildSet(doc: PMNode, options: BlockHandleOptions): BlockHandlePluginState {
  let nextKey = 0
  const decorations = collectTargets(doc).map((target) => makeWidget(target, `bh-${nextKey++}`, options))
  decorations.sort((a, b) => a.from - b.from)
  return { set: DecorationSet.create(doc, decorations), nextKey }
}

// Reconstrói o conjunto de widgets: o que sobreviveu ao map continua com a
// mesma chave (mesmo DOM), o que é novo ganha chave nova e o que ficou sem
// bloco (apagado) sai.
function applySet(
  tr: Transaction,
  prev: BlockHandlePluginState,
  options: BlockHandleOptions
): BlockHandlePluginState {
  if (!tr.docChanged) return prev
  const mapped = prev.set.map(tr.mapping, tr.doc)
  const existing = new Map<number, Decoration>()
  mapped.find().forEach((deco) => {
    const spec = deco.spec as WidgetSpec
    if (spec?.blockHandle) existing.set(deco.from, deco)
  })
  const decorations: Decoration[] = []
  let nextKey = prev.nextKey
  for (const target of collectTargets(tr.doc)) {
    const pos = target.inside ? target.pos + 1 : target.pos
    const found = existing.get(pos)
    existing.delete(pos)
    const spec = found?.spec as WidgetSpec | undefined
    if (found && spec?.inside === target.inside) {
      decorations.push(found)
      continue
    }
    const key = `bh-${nextKey++}`
    decorations.push(makeWidget(target, key, options))
  }
  decorations.sort((a, b) => a.from - b.from)
  return { set: DecorationSet.create(tr.doc, decorations), nextKey }
}

export const BlockHandle = Extension.create<BlockHandleOptions>({
  name: 'monetBlockHandle',

  addOptions() {
    return {
      onRemoveResponse: () => {},
    }
  },

  addProseMirrorPlugins() {
    const ext = this
    return [
      new Plugin<BlockHandlePluginState>({
        key: blockHandlePluginKey,
        state: {
          init: (_config, state) => buildSet(state.doc, ext.options),
          apply: (tr, prev) => applySet(tr, prev, ext.options),
        },
        props: {
          decorations(state) {
            // Modo preview: sem handle (o "+" do gutter também some).
            if (previewPluginKey.getState(state)) return null
            return blockHandlePluginKey.getState(state)?.set ?? null
          },
        },
      }),
    ]
  },
})
