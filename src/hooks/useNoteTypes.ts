import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { MetadataDef, MetadataType, NoteType, SelectOption } from '../types'
import { storage } from '../storage'
import { normalizeName } from '../lib/tasks'
import { MAX_LIST_PROPERTIES } from '../lib/noteTypes'
import { stripDefFromBoard } from '../lib/noteBoard'
import { emitTasksChanged, loadAndSyncWithRetry } from '../lib/tasksEvents'

export const MAX_TYPE_NAME = 24
export const MAX_PROPERTY_NAME = 24

export type NoteTypePatch = Partial<Pick<NoteType, 'name' | 'icon' | 'color' | 'template' | 'board'>>
export type NoteDefPatch = Partial<Pick<MetadataDef, 'name' | 'showInList' | 'options'>>

function maxOrder(list: Array<{ sortOrder: number }>): number {
  return list.reduce((m, x) => Math.max(m, x.sortOrder), 0)
}

// Nome aparado, obrigatório e único (sem caixa/acentos) entre `others`;
// lança para a UI.
function validName(
  name: string,
  max: number,
  others: Array<{ id: string; name: string }>,
  exceptId: string | null,
  clash: string
): string {
  const trimmed = name.trim().slice(0, max)
  if (!trimmed) throw new Error('Name is required.')
  const wanted = normalizeName(trimmed)
  if (others.some((o) => o.id !== exceptId && normalizeName(o.name) === wanted)) throw new Error(clash)
  return trimmed
}

// Registro de tipos de nota e das propriedades deles (defs scope 'note'), no
// padrão do useMetadataDefs/useTaskStatuses: SQLite compartilhado entre janelas,
// recarrega em `tasks-changed` de outra janela e avisa a cada mutação.
// `onRemoved`: depois de excluir tipo ou propriedade (o banco limpou as notas;
// a memória precisa reler).
export function useNoteTypes(opts?: { onRemoved?: () => void }) {
  const [types, setTypes] = useState<NoteType[]>([])
  const [defs, setDefs] = useState<MetadataDef[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const typesRef = useRef(types)
  typesRef.current = types
  const defsRef = useRef(defs)
  defsRef.current = defs
  const onRemovedRef = useRef(opts?.onRemoved)
  onRemovedRef.current = opts?.onRemoved

  const reload = useCallback(async (): Promise<boolean> => {
    try {
      const [typeList, defList] = await Promise.all([storage.getNoteTypes(), storage.getMetadataDefs()])
      setTypes(typeList)
      setDefs(defList.filter((d) => d.scope === 'note'))
      setLoadFailed(false)
      return true
    } catch (err) {
      console.error('failed to load note types', err)
      setLoadFailed(true)
      return false
    }
  }, [])

  // A 1ª leitura cria a tabela e semeia o TODOS (escrita): se falhar, tenta de
  // novo com espera, senão a sessão inteira fica sem tipos.
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
      setSaveError('Failed to save note type.')
      return false
    }
  }, [])

  const createType = useCallback(
    async (name: string): Promise<NoteType> => {
      const type: NoteType = {
        id: `nt_${nanoid(8)}`,
        name: validName(name, MAX_TYPE_NAME, typesRef.current, null, 'A type with this name already exists.'),
        icon: null,
        color: null,
        template: null,
        sortOrder: maxOrder(typesRef.current) + 1,
        builtin: false,
        createdAt: Date.now(),
        board: null,
      }
      setTypes((list) => [...list, type])
      await persist(() => storage.saveNoteType(type), 'create note type')
      return type
    },
    [persist]
  )

  // Built-in não é renomeado.
  const updateType = useCallback(
    async (id: string, patch: NoteTypePatch) => {
      const current = typesRef.current.find((t) => t.id === id)
      if (!current) return
      const next = { ...current, ...patch }
      if (patch.name !== undefined) {
        next.name = current.builtin
          ? current.name
          : validName(patch.name, MAX_TYPE_NAME, typesRef.current, id, 'A type with this name already exists.')
      }
      setTypes((list) => list.map((t) => (t.id === id ? next : t)))
      await persist(() => storage.saveNoteType(next), 'save note type')
    },
    [persist]
  )

  // As notas perdem o tipo e os valores das propriedades dele (banco:
  // deleteNoteType; memória: `onRemoved`).
  const removeType = useCallback(
    async (id: string) => {
      const current = typesRef.current.find((t) => t.id === id)
      if (!current || current.builtin) return
      if (!(await persist(() => storage.deleteNoteType(id), 'delete note type'))) return
      setTypes((list) => list.filter((t) => t.id !== id))
      setDefs((list) => list.filter((d) => d.noteTypeId !== id))
      onRemovedRef.current?.()
    },
    [persist]
  )

  // Grava só as linhas cujo sort_order mudou, uma execução por linha (sem
  // BEGIN/COMMIT: pool sqlx); falha parcial só deixa a ordem misturada.
  const reorderTypes = useCallback(
    async (ids: string[]) => {
      const before = new Map(typesRef.current.map((t) => [t.id, t.sortOrder]))
      const next = ids
        .map((id) => typesRef.current.find((t) => t.id === id))
        .filter((t): t is NoteType => !!t)
        .map((t, i) => ({ ...t, sortOrder: i }))
      if (next.length !== typesRef.current.length) return
      setTypes(next)
      await persist(async () => {
        for (const t of next) if (before.get(t.id) !== t.sortOrder) await storage.saveNoteType(t)
      }, 'reorder note types')
    },
    [persist]
  )

  const createDef = useCallback(
    async (typeId: string, name: string, type: MetadataType): Promise<MetadataDef> => {
      const siblings = defsRef.current.filter((d) => d.noteTypeId === typeId)
      const def: MetadataDef = {
        id: `md_${nanoid(8)}`,
        name: validName(name, MAX_PROPERTY_NAME, siblings, null, 'This type already has a property with this name.'),
        type,
        sortOrder: maxOrder(siblings) + 1,
        createdAt: Date.now(),
        scope: 'note',
        noteTypeId: typeId,
        options: type === 'select' ? [] : null,
        showInList: false,
      }
      setDefs((list) => [...list, def])
      await persist(() => storage.saveMetadataDef(def), 'create property')
      return def
    },
    [persist]
  )

  // O tipo de dado não muda depois de criado. Nome único dentro do tipo; no
  // máximo MAX_LIST_PROPERTIES com "show in list" por tipo.
  const updateDef = useCallback(
    async (id: string, patch: NoteDefPatch) => {
      const current = defsRef.current.find((d) => d.id === id)
      if (!current) return
      const siblings = defsRef.current.filter((d) => d.noteTypeId === current.noteTypeId)
      const next = { ...current, ...patch }
      if (patch.name !== undefined) {
        next.name = validName(
          patch.name,
          MAX_PROPERTY_NAME,
          siblings,
          id,
          'This type already has a property with this name.'
        )
      }
      if (
        patch.showInList &&
        !current.showInList &&
        siblings.filter((d) => d.showInList).length >= MAX_LIST_PROPERTIES
      ) {
        throw new Error(`At most ${MAX_LIST_PROPERTIES} properties can be shown in the list.`)
      }
      setDefs((list) => list.map((d) => (d.id === id ? next : d)))
      await persist(() => storage.saveMetadataDef(next), 'save property')
    },
    [persist]
  )

  // Os valores somem das notas (banco: deleteMetadataDef; memória: `onRemoved`).
  // O board do tipo dono perde a referência (sendo a coluna, o board some).
  const removeDef = useCallback(
    async (id: string) => {
      const ownerId = defsRef.current.find((d) => d.id === id)?.noteTypeId
      if (!(await persist(() => storage.deleteMetadataDef(id), 'delete property'))) return
      setDefs((list) => list.filter((d) => d.id !== id))
      onRemovedRef.current?.()
      const owner = typesRef.current.find((t) => t.id === ownerId)
      if (!owner?.board) return
      const board = stripDefFromBoard(owner.board, id)
      if (board === owner.board) return
      const next = { ...owner, board }
      setTypes((list) => list.map((t) => (t.id === next.id ? next : t)))
      await persist(() => storage.saveNoteType(next), 'save note type')
    },
    [persist]
  )

  const reorderDefs = useCallback(
    async (typeId: string, ids: string[]) => {
      const siblings = defsRef.current.filter((d) => d.noteTypeId === typeId)
      const before = new Map(siblings.map((d) => [d.id, d.sortOrder]))
      const ordered = ids
        .map((id) => siblings.find((d) => d.id === id))
        .filter((d): d is MetadataDef => !!d)
        .map((d, i) => ({ ...d, sortOrder: i }))
      if (ordered.length !== siblings.length) return
      const byId = new Map(ordered.map((d) => [d.id, d]))
      setDefs((list) => list.map((d) => byId.get(d.id) ?? d))
      await persist(async () => {
        for (const d of ordered) if (before.get(d.id) !== d.sortOrder) await storage.saveMetadataDef(d)
      }, 'reorder properties')
    },
    [persist]
  )

  return {
    types,
    defs,
    saveError: saveError ?? (loadFailed ? 'Failed to load note types.' : null),
    createType,
    updateType,
    removeType,
    reorderTypes,
    createDef,
    updateDef,
    removeDef,
    reorderDefs,
  }
}

export type NoteTypesRegistry = ReturnType<typeof useNoteTypes>

export function newSelectOption(name: string, color: string | null): SelectOption {
  return { id: `opt_${nanoid(6)}`, name: name.trim(), color }
}
