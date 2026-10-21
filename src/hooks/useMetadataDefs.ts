import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { MetadataDef, MetadataType } from '../types'
import { storage } from '../storage'
import { normalizeName } from '../lib/tasks'
import { emitTasksChanged, loadAndSyncWithRetry } from '../lib/tasksEvents'

export const MAX_METADATA_NAME = 24

// Definições de metadados custom de task (scope 'task'; SQLite, compartilhadas
// entre janelas). As propriedades de tipo de nota ficam no useNoteTypes (D2).
export function useMetadataDefs(opts?: { onRemoved?: (id: string) => void }) {
  const [defs, setDefs] = useState<MetadataDef[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const defsRef = useRef(defs)
  defsRef.current = defs
  const onRemovedRef = useRef(opts?.onRemoved)
  onRemovedRef.current = opts?.onRemoved

  const reload = useCallback(async () => {
    try {
      setDefs((await storage.getMetadataDefs()).filter((d) => d.scope === 'task'))
      setLoadFailed(false)
      return true
    } catch (err) {
      console.error('failed to load metadata defs', err)
      setLoadFailed(true)
      return false
    }
  }, [])

  useEffect(() => {
    return loadAndSyncWithRetry(reload)
  }, [reload])

  const persist = useCallback(async (op: () => Promise<void>, what: string): Promise<boolean> => {
    try {
      await op()
      setSaveError(null)
      emitTasksChanged()
      return true
    } catch (err) {
      console.error(`failed to ${what}`, err)
      setSaveError('Failed to save property.')
      return false
    }
  }, [])

  // Nome aparado, obrigatório e único (sem caixa/acentos); lança para a UI.
  const validName = (name: string, exceptId: string | null): string => {
    const trimmed = name.trim().slice(0, MAX_METADATA_NAME)
    if (!trimmed) throw new Error('Name is required.')
    const wanted = normalizeName(trimmed)
    if (defsRef.current.some((d) => d.id !== exceptId && normalizeName(d.name) === wanted)) {
      throw new Error('A property with this name already exists.')
    }
    return trimmed
  }

  const create = useCallback(
    async (name: string, type: MetadataType): Promise<MetadataDef> => {
      const def: MetadataDef = {
        id: `md_${nanoid(8)}`,
        name: validName(name, null),
        type,
        sortOrder: defsRef.current.reduce((m, d) => Math.max(m, d.sortOrder), 0) + 1,
        createdAt: Date.now(),
        scope: 'task',
        noteTypeId: null,
        options: null,
        showInList: false,
      }
      setDefs((list) => [...list, def])
      await persist(() => storage.saveMetadataDef(def), 'create property')
      return def
    },
    [persist]
  )

  // O tipo não muda depois de criado; só o nome.
  const rename = useCallback(
    async (id: string, name: string) => {
      const current = defsRef.current.find((d) => d.id === id)
      if (!current) return
      const next = { ...current, name: validName(name, id) }
      setDefs((list) => list.map((d) => (d.id === id ? next : d)))
      await persist(() => storage.saveMetadataDef(next), 'rename property')
    },
    [persist]
  )

  // Valores somem das tasks (banco: deleteMetadataDef; memória: `onRemoved`).
  const remove = useCallback(
    async (id: string) => {
      if (!(await persist(() => storage.deleteMetadataDef(id), 'delete property'))) return
      setDefs((list) => list.filter((d) => d.id !== id))
      onRemovedRef.current?.(id)
    },
    [persist]
  )

  return {
    defs,
    saveError: saveError ?? (loadFailed ? 'Failed to load task properties.' : null),
    reload,
    create,
    rename,
    remove,
  }
}
