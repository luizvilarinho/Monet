import type { MetadataDef, MetadataValue, Note } from '../types'
import { CALENDAR_NOTEBOOK_ID } from './calendar'
import { formatMetadataValue, hasMetadataValue } from './metadata'
import { isTaskBodyNote, normalizeName } from './tasks'

// Tipos de nota: regras puras (quais notas têm tipo, troca de tipo, valores
// na lista e no RAG).

// Propriedades com "show in list" por tipo, para a lista não virar tabela.
export const MAX_LIST_PROPERTIES = 2

// Tipo embutido TODOS (entregável que agrupa tasks via `parentNoteId`).
// Semeado pelo storage; nome fixo, sempre em maiúsculas (em PT "todos" =
// "all", e o RAG o trata como stopword).
export const TODOS_TYPE_ID = 'todos'
export const TODOS_DEFAULT_TEMPLATE = '## Status\n\n## TODO\n\n- [ ] '

export function isTodosNote(note: Note | null | undefined): boolean {
  return note?.typeId === TODOS_TYPE_ID
}

// Propriedades (scope 'note') do tipo, na ordem do tipo.
export function typeDefs(defs: MetadataDef[], typeId: string | null | undefined): MetadataDef[] {
  if (!typeId) return []
  return defs
    .filter((d) => d.scope === 'note' && d.noteTypeId === typeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

// Só notas de caderno (D4): fora o Calendar e a nota-corpo de task.
// A exclusão das notas ligadas ao Reader foi REVOGADA (2026-10-22): o tipo
// passa a ser escolhido no painel de notas do Reader, antes de criar a nota.
export function canHaveType(note: Note): boolean {
  return (
    !!note.notebookId &&
    note.notebookId !== CALENDAR_NOTEBOOK_ID &&
    !isTaskBodyNote(note)
  )
}

function sameName(a: string, b: string): boolean {
  return normalizeName(a.trim()) === normalizeName(b.trim())
}

// Troca de tipo (§4.5): o valor de uma propriedade do tipo antigo vai para a
// propriedade do tipo novo com o mesmo nome e o mesmo tipo de dado (no select,
// para a opção de mesmo nome). As chaves antigas continuam no JSON, guardadas
// (voltam se o tipo voltar). `hidden` = propriedades antigas com valor sem
// correspondente. `next === props` quando nada é copiado.
export function migrateProperties(
  props: Record<string, MetadataValue>,
  fromDefs: MetadataDef[],
  toDefs: MetadataDef[]
): { next: Record<string, MetadataValue>; hidden: MetadataDef[] } {
  let next = props
  const hidden: MetadataDef[] = []
  for (const from of fromDefs) {
    const value = props[from.id]
    if (value === undefined || !hasMetadataValue(value)) continue
    const to = toDefs.find((d) => d.type === from.type && sameName(d.name, from.name))
    let copied: MetadataValue | undefined = to ? value : undefined
    if (to && from.type === 'select') {
      const option = from.options?.find((o) => o.id === value)
      copied = option ? to.options?.find((o) => sameName(o.name, option.name))?.id : undefined
    }
    if (!to || copied === undefined) {
      hidden.push(from)
      continue
    }
    if (next === props) next = { ...props }
    next[to.id] = copied
  }
  return { next, hidden }
}

// Até MAX_LIST_PROPERTIES valores com "show in list" (lista de notas).
export function listPropertyValues(
  note: Note,
  defs: MetadataDef[]
): Array<{ def: MetadataDef; text: string }> {
  const out: Array<{ def: MetadataDef; text: string }> = []
  for (const def of typeDefs(defs, note.typeId)) {
    if (!def.showInList) continue
    const value = note.properties?.[def.id]
    if (value === undefined || !hasMetadataValue(value)) continue
    const text = formatMetadataValue(def, value)
    if (text) out.push({ def, text })
    if (out.length === MAX_LIST_PROPERTIES) break
  }
  return out
}

// Propriedades do tipo atual com valor, como texto para a IA (data ISO,
// checkbox yes/no). As guardadas de outro tipo não entram.
export function propertiesForAi(
  note: Note,
  defs: MetadataDef[]
): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = []
  for (const def of typeDefs(defs, note.typeId)) {
    const value = note.properties?.[def.id]
    if (value === undefined || !hasMetadataValue(value)) continue
    const text =
      def.type === 'checkbox' ? (value === true ? 'yes' : 'no')
      : def.type === 'select' ? formatMetadataValue(def, value)
      : String(value)
    if (text) out.push({ name: def.name, value: text })
  }
  return out
}
