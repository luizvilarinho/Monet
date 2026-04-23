import { useCallback, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Note } from '../types'
import { storage } from '../storage'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    storage
      .getNotes()
      .then((list) => setNotes(list))
      .catch((err) => console.error('failed to load notes', err))
      .finally(() => setLoaded(true))
  }, [])

  const save = useCallback(async (note: Note) => {
    setNotes((prev) => {
      const i = prev.findIndex((n) => n.id === note.id)
      if (i >= 0) {
        const next = prev.slice()
        next[i] = note
        return next
      }
      return [note, ...prev]
    })
    try {
      await storage.saveNote(note)
    } catch (err) {
      console.error('failed to save note', err)
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      await storage.deleteNote(id)
    } catch (err) {
      console.error('failed to delete note', err)
    }
  }, [])

  const create = useCallback(
    async (notebookId: string | null) => {
      const now = Date.now()
      const note: Note = {
        id: nanoid(),
        notebookId,
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

  return { notes, loaded, save, remove, create }
}
