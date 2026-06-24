import { useCallback, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Subject } from '../types'
import { storage } from '../storage'

export function useSubjects(notebookId: string | null) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!notebookId) {
      setSubjects([])
      return
    }
    storage
      .getSubjects(notebookId)
      .then((list) => setSubjects(list))
      .catch((err) => console.error('failed to load subjects', err))
  }, [notebookId])

  const save = useCallback(async (subject: Subject) => {
    setSubjects((prev) => {
      const i = prev.findIndex((s) => s.id === subject.id)
      if (i >= 0) {
        const next = prev.slice()
        next[i] = subject
        return next
      }
      return [...prev, subject]
    })
    try {
      await storage.saveSubject(subject)
      setSaveError(null)
    } catch (err) {
      console.error('failed to save subject', err)
      setSaveError('Failed to save subject. Your changes may be lost.')
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id))
    try {
      await storage.deleteSubject(id)
      setSaveError(null)
    } catch (err) {
      console.error('failed to delete subject', err)
      setSaveError('Failed to delete subject.')
    }
  }, [])

  const create = useCallback(
    async (name: string) => {
      if (!notebookId) return null
      const now = Date.now()
      const maxOrder = subjects.reduce((max, s) => Math.max(max, s.sortOrder), -1)
      const subject: Subject = {
        id: nanoid(),
        notebookId,
        name: name.trim() || 'unnamed',
        sortOrder: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      }
      await save(subject)
      return subject
    },
    [notebookId, subjects, save]
  )

  const reorder = useCallback(
    async (newIds: string[]) => {
      const now = Date.now()
      const updated = newIds.reduce<Subject[]>((acc, id, index) => {
        const existing = subjects.find((s) => s.id === id)
        if (existing) acc.push({ ...existing, sortOrder: index, updatedAt: now })
        return acc
      }, [])
      setSubjects(updated)
      try {
        await Promise.all(updated.map((s) => storage.saveSubject(s)))
        setSaveError(null)
      } catch (err) {
        console.error('failed to reorder subjects', err)
        setSaveError('Failed to save subject order. Your changes may be lost.')
      }
    },
    [subjects]
  )

  return { subjects, save, remove, create, reorder, saveError }
}
