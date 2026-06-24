import { useCallback, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Notebook } from '../types'
import { storage } from '../storage'

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    storage
      .getNotebooks()
      .then((list) => setNotebooks(list))
      .catch((err) => console.error('failed to load notebooks', err))
      .finally(() => setLoaded(true))
  }, [])

  const save = useCallback(async (nb: Notebook) => {
    setNotebooks((prev) => {
      const i = prev.findIndex((n) => n.id === nb.id)
      if (i >= 0) {
        const next = prev.slice()
        next[i] = nb
        return next
      }
      return [nb, ...prev]
    })
    try {
      await storage.saveNotebook(nb)
      setSaveError(null)
    } catch (err) {
      console.error('failed to save notebook', err)
      setSaveError('Failed to save notebook. Your changes may be lost.')
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setNotebooks((prev) => prev.filter((n) => n.id !== id))
    try {
      await storage.deleteNotebook(id)
      setSaveError(null)
    } catch (err) {
      console.error('failed to delete notebook', err)
      setSaveError('Failed to delete notebook.')
    }
  }, [])

  const create = useCallback(
    async (name: string) => {
      const now = Date.now()
      const nb: Notebook = {
        id: nanoid(),
        name: name.trim() || 'unnamed',
        createdAt: now,
        updatedAt: now,
      }
      await save(nb)
      return nb
    },
    [save]
  )

  return { notebooks, loaded, save, remove, create, saveError }
}
