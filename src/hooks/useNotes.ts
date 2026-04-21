import { useCallback, useEffect, useState } from 'react'
import type { Note } from '../types'
import { storage } from '../storage'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setNotes(await storage.getNotes())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh().catch(console.error)
  }, [refresh])

  const save = useCallback(async (note: Note) => {
    await storage.saveNote(note)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await storage.deleteNote(id)
    await refresh()
  }, [refresh])

  return { notes, loading, refresh, save, remove }
}
