import { arrayMove } from '@dnd-kit/sortable'

// Generic localStorage helpers
export function loadOrder(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveOrder(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch (err) {
    console.warn('failed to save order', key, err)
  }
}

// Shorthands for notes
const NOTE_KEY = 'monet:note-order'
export const loadNoteOrder = () => loadOrder(NOTE_KEY)
export const saveNoteOrder = (ids: string[]) => saveOrder(NOTE_KEY, ids)

// Replaces visible slots in globalOrder with newVisibleOrder, preserving non-visible positions
export function mergeOrder(globalOrder: string[], newVisibleOrder: string[]): string[] {
  const visibleSet = new Set(newVisibleOrder)
  const result: string[] = []
  let vi = 0
  for (const id of globalOrder) {
    result.push(visibleSet.has(id) ? newVisibleOrder[vi++] : id)
  }
  while (vi < newVisibleOrder.length) result.push(newVisibleOrder[vi++])
  return result
}

export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items
  const idx = new Map(order.map((id, i) => [id, i]))
  return [...items].sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity))
}

// Ordem de exibição da lista de notas, global (localStorage). 'manual' é a
// ordem arrastada acima; 'alpha' só reordena a exibição. Com o agrupamento por
// tipo ligado, a ordem vale dentro de cada grupo.
export type NoteSort = 'manual' | 'alpha'

export const NOTE_SORT_OPTIONS: Array<{ id: NoteSort; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'alpha', label: 'Alphabetical (A–Z)' },
]

const NOTE_SORT_KEY = 'monet:note-sort'

// 'type' (a antiga ordem "By type", hoje o agrupamento) é lido como 'alpha': a
// mesma ordem de antes, e o agrupamento já nasce ligado.
export function parseNoteSort(saved: string | null): NoteSort {
  if (saved === 'type') return 'alpha'
  return NOTE_SORT_OPTIONS.find((o) => o.id === saved)?.id ?? 'manual'
}

export function loadNoteSort(): NoteSort {
  try {
    return parseNoteSort(localStorage.getItem(NOTE_SORT_KEY))
  } catch {
    return 'manual'
  }
}

export function saveNoteSort(sort: NoteSort): void {
  try {
    localStorage.setItem(NOTE_SORT_KEY, sort)
  } catch {
    /* ignorar */
  }
}

// Título como aparece na lista; sem caixa nem acento.
function compareTitles(a: { title: string }, b: { title: string }): number {
  return (a.title.trim() || 'untitled').localeCompare(b.title.trim() || 'untitled', undefined, {
    sensitivity: 'base',
  })
}

// Aplica `sort` sobre a lista já em ordem manual (o sort é estável: empate
// mantém a ordem manual).
export function sortNotes<T extends { title: string }>(notes: T[], sort: NoteSort): T[] {
  if (sort === 'manual') return notes
  return [...notes].sort(compareTitles)
}

// Agrupamento da lista por tipo, global (localStorage). Ligado por padrão:
// só '0' desliga; ausente ou inválido = ligado.
const GROUP_BY_TYPE_KEY = 'monet:note-group-by-type'

export function parseGroupByType(saved: string | null): boolean {
  return saved !== '0'
}

export function loadGroupByType(): boolean {
  try {
    return parseGroupByType(localStorage.getItem(GROUP_BY_TYPE_KEY))
  } catch {
    return true
  }
}

export function saveGroupByType(on: boolean): void {
  try {
    localStorage.setItem(GROUP_BY_TYPE_KEY, on ? '1' : '0')
  } catch {
    /* ignorar */
  }
}

// Chave do grupo das notas sem tipo (ou de tipo apagado).
export const NO_TYPE_GROUP = '__no_type__'
// Escopo do estado aberto/fechado em "All notes" (sem caderno).
export const ALL_NOTES_SCOPE = 'all-notes'

export interface NoteGroup<T> {
  // Id do tipo, ou NO_TYPE_GROUP.
  key: string
  typeId: string | null
  notes: T[]
}

// Agrupa as notas por tipo, mantendo a ordem recebida dentro de cada grupo: um
// grupo por tipo presente, na ordem de `typeOrder` (ids na ordem do usuário), e
// por último as notas sem tipo ou de tipo que não existe mais. Sem nenhuma nota
// de tipo existente devolve null: a lista fica plana.
export function groupNotesByType<T extends { typeId?: string | null }>(
  notes: T[],
  typeOrder: string[]
): Array<NoteGroup<T>> | null {
  const known = new Set(typeOrder)
  const byType = new Map<string, T[]>()
  const untyped: T[] = []
  for (const n of notes) {
    if (n.typeId && known.has(n.typeId)) {
      const list = byType.get(n.typeId)
      if (list) list.push(n)
      else byType.set(n.typeId, [n])
    } else {
      untyped.push(n)
    }
  }
  if (byType.size === 0) return null
  const groups: Array<NoteGroup<T>> = []
  for (const id of typeOrder) {
    const list = byType.get(id)
    if (list) groups.push({ key: id, typeId: id, notes: list })
  }
  if (untyped.length > 0) groups.push({ key: NO_TYPE_GROUP, typeId: null, notes: untyped })
  return groups
}

// Seção (grupo, ou a lista plana inteira) que contém a nota `id`.
export function findGroupOf<G extends { notes: Array<{ id: string }> }>(
  sections: G[],
  id: string | number
): G | undefined {
  return sections.find((g) => g.notes.some((n) => n.id === id))
}

// Arrasto na ordem Manual: a nota `activeId` ocupa o lugar de `overId` dentro do
// próprio grupo, e a nova ordem da lista visível sai de `mergeOrder`: as notas
// dos outros grupos (também as de grupos fechados) ficam onde estavam. Devolve
// null quando soltar não faz nada: mesma nota, nota fora da lista ou alvo de
// outro grupo (arrastar não muda o tipo da nota). Lista plana = uma seção só.
export function reorderWithinGroup(
  sections: Array<{ notes: Array<{ id: string }> }>,
  visibleIds: string[],
  activeId: string | number,
  overId: string | number
): string[] | null {
  if (activeId === overId) return null
  const group = findGroupOf(sections, activeId)
  if (!group) return null
  const oldIndex = group.notes.findIndex((n) => n.id === activeId)
  const newIndex = group.notes.findIndex((n) => n.id === overId)
  if (newIndex === -1) return null
  return mergeOrder(visibleIds, arrayMove(group.notes, oldIndex, newIndex).map((n) => n.id))
}

// O que a decisão geométrica do arrasto precisa de um retângulo medido (o
// ClientRect do dnd-kit serve).
export interface VerticalExtent {
  top: number
  bottom: number
}

// O ponto `centerY` está perto do grupo `ids`? Perto = dentro da extensão
// vertical do grupo (do topo ao fundo dos itens, medidos em `rects`) com
// `tolerance` de folga acima e abaixo; as bordas contam. `open` tira o limite de
// um lado: acima do primeiro grupo e abaixo do último não há outro grupo, e
// soltar além da ponta da lista continua levando a nota para a ponta. Sem medida
// (grupo vazio ou item sem retângulo) conta como perto: um erro de medida não
// pode impedir o arrasto dentro do grupo.
export function isNearGroup(
  ids: string[],
  rects: ReadonlyMap<string | number, VerticalExtent>,
  centerY: number,
  tolerance: number,
  open: { above?: boolean; below?: boolean } = {}
): boolean {
  if (ids.length === 0) return true
  let top = Infinity
  let bottom = -Infinity
  for (const id of ids) {
    const rect = rects.get(id)
    if (!rect) return true
    top = Math.min(top, rect.top)
    bottom = Math.max(bottom, rect.bottom)
  }
  return (open.above || centerY >= top - tolerance) && (open.below || centerY <= bottom + tolerance)
}

// Grupos fechados da lista, em localStorage: { escopo: [chaves fechadas] }. O
// escopo é o id do caderno aberto (ALL_NOTES_SCOPE em "All notes"). Grupo fora
// da lista = aberto, então grupo novo nasce aberto, e chaves de tipo ou caderno
// que não existem mais não têm efeito.
export type GroupCollapsedState = Record<string, string[]>

const GROUP_COLLAPSED_KEY = 'monet:note-groups-collapsed'

export function parseGroupCollapsed(raw: string | null): GroupCollapsedState {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const state: GroupCollapsedState = {}
    for (const [scope, keys] of Object.entries(parsed)) {
      if (Array.isArray(keys)) state[scope] = keys.filter((k): k is string => typeof k === 'string')
    }
    return state
  } catch {
    return {}
  }
}

export function isGroupCollapsed(state: GroupCollapsedState, scope: string, key: string): boolean {
  return state[scope]?.includes(key) ?? false
}

export function setGroupCollapsed(
  state: GroupCollapsedState,
  scope: string,
  key: string,
  collapsed: boolean
): GroupCollapsedState {
  const keys = (state[scope] ?? []).filter((k) => k !== key)
  if (collapsed) keys.push(key)
  const next = { ...state }
  if (keys.length > 0) next[scope] = keys
  else delete next[scope]
  return next
}

// Fecha ou abre vários grupos do escopo de uma vez ("Collapse all groups" e
// "Expand all groups"). Só mexe nas `keys` dadas: as chaves de outros grupos do
// escopo (um tipo que não está na lista agora) e de outros escopos ficam como estão.
export function setGroupsCollapsed(
  state: GroupCollapsedState,
  scope: string,
  keys: string[],
  collapsed: boolean
): GroupCollapsedState {
  return keys.reduce((acc, key) => setGroupCollapsed(acc, scope, key, collapsed), state)
}

export function loadGroupCollapsed(): GroupCollapsedState {
  try {
    return parseGroupCollapsed(localStorage.getItem(GROUP_COLLAPSED_KEY))
  } catch {
    return {}
  }
}

export function saveGroupCollapsed(state: GroupCollapsedState): void {
  try {
    localStorage.setItem(GROUP_COLLAPSED_KEY, JSON.stringify(state))
  } catch {
    /* ignorar */
  }
}
