import { useCallback, useEffect, useRef, useState } from 'react'
import type { Document, DocumentStatus } from '../types'
import {
  documentsDelete,
  documentsList,
  documentsReindex,
  documentsUpload,
  onDocumentStatus,
} from '../lib/documents'

export function useDocuments(notebookId: string | null) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notebookIdRef = useRef<string | null>(notebookId)

  useEffect(() => {
    notebookIdRef.current = notebookId
  }, [notebookId])

  const refresh = useCallback(async () => {
    if (!notebookId) {
      setDocuments([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await documentsList(notebookId)
      setDocuments(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [notebookId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false
    onDocumentStatus(({ documentId, notebookId: eventNotebookId, status, errorMessage }) => {
      // Filtra eventos de outros cadernos para evitar refresh espúrio quando
      // o usuário troca de caderno enquanto outro indexa em background.
      if (notebookIdRef.current !== eventNotebookId) return
      setDocuments((prev) => {
        const idx = prev.findIndex((d) => d.id === documentId)
        if (idx === -1) {
          if (status === 'available' || status === 'indexing') {
            void refresh()
          }
          return prev
        }
        const next = prev.slice()
        next[idx] = {
          ...next[idx],
          status: status as DocumentStatus,
          errorMessage: errorMessage ?? undefined,
          updatedAt: Date.now(),
        }
        return next
      })
    })
      .then((un) => {
        if (cancelled) un()
        else unlisten = un
      })
      .catch((e) => console.error('failed to listen documents://status', e))
    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [refresh])

  const upload = useCallback(
    async (sourcePath: string) => {
      const targetNotebook = notebookIdRef.current
      if (!targetNotebook) throw new Error('Caderno não selecionado')
      const id = await documentsUpload(targetNotebook, sourcePath)
      await refresh()
      return id
    },
    [refresh],
  )

  const reindex = useCallback(
    async (documentId: string) => {
      await documentsReindex(documentId)
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (documentId: string) => {
      await documentsDelete(documentId)
      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
    },
    [],
  )

  return { documents, loading, error, refresh, upload, reindex, remove }
}
