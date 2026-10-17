import type { MetadataDef, MetadataType, MetadataValue, Task } from '../types'
import { formatDueShort } from './tasks'

// Metadados personalizados: funções puras de valor e exibição.

export const METADATA_TYPE_LABEL: Record<MetadataType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  checkbox: 'Checkbox',
}

export const METADATA_TYPES: MetadataType[] = ['text', 'number', 'date', 'checkbox']

// Valor ao anexar a propriedade a uma task.
export function defaultMetadataValue(type: MetadataType): MetadataValue {
  return type === 'checkbox' ? false : null
}

// Aceita vírgula decimal; vazio ou inválido vira null.
export function parseNumberInput(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// Checkbox `false` conta como valor.
export function hasMetadataValue(v: MetadataValue): boolean {
  return v !== null && v !== ''
}

export function formatMetadataValue(def: MetadataDef, v: MetadataValue): string {
  if (def.type === 'checkbox') return v === true ? '✓' : '–'
  if (def.type === 'number' && typeof v === 'number') return v.toLocaleString('en-US')
  if (def.type === 'date' && typeof v === 'string') return formatDueShort(v)
  return String(v ?? '')
}

// Metadados com valor, na ordem das definições; ids sem definição são ignorados.
export function visibleMetadata(
  task: Task,
  defs: MetadataDef[]
): Array<{ def: MetadataDef; value: MetadataValue }> {
  const out: Array<{ def: MetadataDef; value: MetadataValue }> = []
  for (const def of defs) {
    if (!(def.id in task.metadata)) continue
    const value = task.metadata[def.id]
    if (hasMetadataValue(value)) out.push({ def, value })
  }
  return out
}

export function metadataUsageCount(tasks: Task[], defId: string): number {
  return tasks.reduce((n, t) => (defId in t.metadata ? n + 1 : n), 0)
}
