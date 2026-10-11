import { useCallback, useEffect, useRef, useState } from 'react'
import type { Document, DocumentStatus } from '../types'
import {
  documentsAddWatchedFolder,
  documentsDelete,
  documentsDeleteWatchedFolder,
  documentsListGlobal,
  documentsReindex,
  documentsScanWatchedFolder,
  documentsUploadGlobal,
  getNotebookVisibleDocumentIds,
  NOTEBOOK_VISIBILITY_CHANGED_EVENT,
  NOTES_INDEX_CHANGED_EVENT,
  onDocumentStatus,
  setNotebookDocumentVisibility,
} from '../lib/documents'

// ─── useKnowledgeBase ─────────────────────────────────────────────────────────
// Manages the global knowledge base of documents.

export function useKnowledgeBase() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await documentsListGlobal()
      setDocuments(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Remover ou desligar a pasta de notas de um caderno não emite
  // documents://status; o sync de notas avisa por este evento.
  useEffect(() => {
    const onChanged = () => void refresh()
    window.addEventListener(NOTES_INDEX_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(NOTES_INDEX_CHANGED_EVENT, onChanged)
  }, [refresh])

  // Listen to global document status events (no notebookId filter)
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false
    onDocumentStatus(({ documentId, status, errorMessage }) => {
      setDocuments((prev) => {
        const idx = prev.findIndex((d) => d.id === documentId)
        if (idx === -1) {
          if (status === 'available' || status === 'indexing') {
            void refresh()
          }
          return prev
        }
        // If a folder transitions to available, refresh the full list so child
        // counts and newly added/removed files are reflected in the UI
        const doc = prev[idx]
        if (doc.docType === 'folder' && status === 'available') {
          void refresh()
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
      const id = await documentsUploadGlobal(sourcePath)
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

  const remove = useCallback(async (documentId: string) => {
    await documentsDelete(documentId)
    setDocuments((prev) => prev.filter((d) => d.id !== documentId))
  }, [])

  const addFolder = useCallback(
    async (folderPath: string) => {
      const id = await documentsAddWatchedFolder(folderPath)
      await refresh()
      return id
    },
    [refresh],
  )

  const rescanFolder = useCallback(async (folderId: string) => {
    await documentsScanWatchedFolder(folderId)
  }, [])

  const removeFolder = useCallback(
    async (folderId: string) => {
      await documentsDeleteWatchedFolder(folderId)
      await refresh()
    },
    [refresh],
  )

  return { documents, loading, error, refresh, upload, reindex, remove, addFolder, rescanFolder, removeFolder }
}

// ─── useNotebookVisibility ────────────────────────────────────────────────────
// Manages which documents are visible (enabled) in a given notebook.

export function useNotebookVisibility(notebookId: string | null) {
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const notebookIdRef = useRef<string | null>(notebookId)

  useEffect(() => {
    notebookIdRef.current = notebookId
  }, [notebookId])

  useEffect(() => {
    if (!notebookId) {
      setVisibleIds([])
      return
    }
    let cancelled = false
    const load = () => {
      getNotebookVisibleDocumentIds(notebookId)
        .then((ids) => {
          if (!cancelled) setVisibleIds(ids)
        })
        .catch((e) => console.error('getNotebookVisibleDocumentIds failed', e))
    }
    load()
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ notebookId: string }>).detail?.notebookId === notebookId) load()
    }
    window.addEventListener(NOTEBOOK_VISIBILITY_CHANGED_EVENT, onChanged)
    return () => {
      cancelled = true
      window.removeEventListener(NOTEBOOK_VISIBILITY_CHANGED_EVENT, onChanged)
    }
  }, [notebookId])

  const toggle = useCallback(
    async (documentId: string, visible: boolean) => {
      const nbId = notebookIdRef.current
      if (!nbId) return
      await setNotebookDocumentVisibility(nbId, documentId, visible)
      setVisibleIds((prev) =>
        visible
          ? prev.includes(documentId) ? prev : [...prev, documentId]
          : prev.filter((id) => id !== documentId),
      )
    },
    [],
  )

  const isVisible = useCallback(
    (documentId: string) => visibleIds.includes(documentId),
    [visibleIds],
  )

  return { visibleIds, toggle, isVisible }
}
