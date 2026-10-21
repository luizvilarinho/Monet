import { useCallback, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import type { MetadataValue, Note } from '../types'
import { storage } from '../storage'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    storage
      .getNotes()
      .then((list) => setNotes(list))
      .catch((err) => {
        console.error('failed to load notes', err)
        setLoadFailed(true)
      })
      .finally(() => setLoaded(true))
  }, [])

  // Refaz a leitura do banco e retorna a lista fresca — usado pela janela
  // main para ressincronizar após edições feitas pela janela keep.
  const refresh = useCallback(async () => {
    const list = await storage.getNotes()
    setNotes(list)
    return list
  }, [])

  // Devolve false quando a gravação falha (o erro já fica em `saveError`).
  const save = useCallback(async (note: Note): Promise<boolean> => {
    setNotes((prev) => {
      const i = prev.findIndex((n) => n.id === note.id)
      if (i >= 0) {
        const next = prev.slice()
        // Tipo, propriedades e arquivamento vêm sempre da memória: o saveNote
        // não os grava e quem monta a `Note` do zero (keep, assistant, merge,
        // mover) não os conhece; só setType/setProperties/setArchived mudam
        // esses campos.
        next[i] = {
          ...note,
          typeId: prev[i].typeId,
          properties: prev[i].properties,
          archivedAt: prev[i].archivedAt,
        }
        return next
      }
      return [note, ...prev]
    })
    try {
      await storage.saveNote(note)
      setSaveError(null)
      return true
    } catch (err) {
      console.error('failed to save note', err)
      setSaveError('Failed to save note. Your changes may be lost.')
      return false
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      await storage.deleteNote(id)
      setSaveError(null)
    } catch (err) {
      console.error('failed to delete note', err)
      setSaveError('Failed to delete note.')
    }
  }, [])

  // Setters pontuais (fora do saveNote): otimista em memória; em falha, relê
  // do banco. Devolvem false quando a gravação falha.
  const persistField = useCallback(
    async (
      noteId: string,
      patch: Pick<Note, 'typeId'> | Pick<Note, 'properties'> | Pick<Note, 'archivedAt'>,
      op: () => Promise<void>,
      errorMessage: string
    ) => {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...patch } : n)))
      try {
        await op()
        setSaveError(null)
        return true
      } catch (err) {
        console.error('failed to save note field', err)
        setSaveError(errorMessage)
        void refresh().catch((e) => console.error('failed to reload notes', e))
        return false
      }
    },
    [refresh]
  )

  const setType = useCallback(
    (noteId: string, typeId: string | null) =>
      persistField(
        noteId,
        { typeId },
        () => storage.setNoteType(noteId, typeId),
        'Failed to save note type or properties.'
      ),
    [persistField]
  )

  const setProperties = useCallback(
    (noteId: string, properties: Record<string, MetadataValue>) =>
      persistField(
        noteId,
        { properties },
        () => storage.setNoteProperties(noteId, properties),
        'Failed to save note type or properties.'
      ),
    [persistField]
  )

  // Otimista: a nota arquivada sai da lista principal na hora.
  const setArchived = useCallback(
    (noteId: string, archived: boolean) => {
      const archivedAt = archived ? Date.now() : null
      return persistField(
        noteId,
        { archivedAt },
        () => storage.setNoteArchived(noteId, archivedAt),
        'Failed to archive or unarchive note.'
      )
    },
    [persistField]
  )

  const create = useCallback(
    async (notebookId: string, subjectId?: string | null) => {
      const now = Date.now()
      const note: Note = {
        id: nanoid(),
        notebookId,
        subjectId: subjectId ?? null,
        title: '',
        content: '',
        tags: [],
        createdAt: now,
        updatedAt: now,
      }
      await save(note)
      return note
    },
    [save]
  )

  return { notes, loaded, loadFailed, save, remove, create, refresh, setType, setProperties, setArchived, saveError }
}
