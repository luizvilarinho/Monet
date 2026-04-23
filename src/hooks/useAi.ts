import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { AiResponse } from '../types'
import { storage } from '../storage'
import {
  cancelOpenRouterStream,
  onOpenRouterChunk,
  onOpenRouterDone,
  onOpenRouterError,
  startOpenRouterStream,
} from '../lib/openrouter'

export interface StartRequestInput {
  noteId: string
  model: string
  command: string
  query: string
  systemPrompt: string
  userMessage: string
}

type ResponsesByNote = Record<string, AiResponse[]>

interface StreamMeta {
  noteId: string
}

export function useAi(activeNoteId: string | null) {
  const [byNote, setByNote] = useState<ResponsesByNote>({})
  const streamsRef = useRef<Map<string, StreamMeta>>(new Map())
  const byNoteRef = useRef<ResponsesByNote>({})
  byNoteRef.current = byNote

  const updateResponse = useCallback(
    (requestId: string, updater: (r: AiResponse) => AiResponse) => {
      const meta = streamsRef.current.get(requestId)
      if (!meta) return
      setByNote((prev) => {
        const list = prev[meta.noteId]
        if (!list) return prev
        const idx = list.findIndex((r) => r.id === requestId)
        if (idx < 0) return prev
        const next = list.slice()
        next[idx] = updater(next[idx])
        return { ...prev, [meta.noteId]: next }
      })
    },
    []
  )

  const finalizeResponse = useCallback(
    (
      requestId: string,
      finalStatus: 'completed' | 'interrupted' | 'error',
      patch?: Partial<AiResponse>
    ) => {
      const meta = streamsRef.current.get(requestId)
      if (!meta) return
      streamsRef.current.delete(requestId)
      setByNote((prev) => {
        const list = prev[meta.noteId]
        if (!list) return prev
        const idx = list.findIndex((r) => r.id === requestId)
        if (idx < 0) return prev
        const current = list[idx]
        const updated: AiResponse = {
          ...current,
          ...patch,
          status: finalStatus,
        }
        const next = list.slice()
        next[idx] = updated
        storage.saveResponse(updated).catch((err) => {
          console.error('failed to persist ai response', err)
        })
        return { ...prev, [meta.noteId]: next }
      })
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    const unlisteners: Array<() => void> = []
    ;(async () => {
      const chunk = await onOpenRouterChunk(({ requestId, text }) => {
        updateResponse(requestId, (r) => ({ ...r, response: r.response + text }))
      })
      const done = await onOpenRouterDone(({ requestId }) => {
        finalizeResponse(requestId, 'completed')
      })
      const err = await onOpenRouterError(({ requestId, message }) => {
        const meta = streamsRef.current.get(requestId)
        if (!meta) return
        const current = (byNoteRef.current[meta.noteId] ?? []).find(
          (r) => r.id === requestId
        )
        const hasPartial = !!current && current.response.length > 0
        finalizeResponse(requestId, hasPartial ? 'interrupted' : 'error', {
          response: hasPartial ? current!.response : message,
        })
      })
      if (cancelled) {
        chunk()
        done()
        err()
        return
      }
      unlisteners.push(chunk, done, err)
    })().catch((e) => console.error('failed to subscribe to openrouter events', e))
    return () => {
      cancelled = true
      unlisteners.forEach((u) => u())
    }
  }, [updateResponse, finalizeResponse])

  useEffect(() => {
    if (!activeNoteId) return
    if (byNoteRef.current[activeNoteId]) return
    storage
      .getResponses(activeNoteId)
      .then((list) => {
        setByNote((prev) => {
          if (prev[activeNoteId]) return prev
          return { ...prev, [activeNoteId]: list }
        })
      })
      .catch((err) => console.error('failed to load ai responses', err))
  }, [activeNoteId])

  const responses = activeNoteId ? byNote[activeNoteId] ?? [] : []

  const start = useCallback(
    async ({
      noteId,
      model,
      command,
      query,
      systemPrompt,
      userMessage,
    }: StartRequestInput) => {
      const id = nanoid()
      const response: AiResponse = {
        id,
        noteId,
        command,
        query,
        model,
        response: '',
        status: 'streaming',
        createdAt: Date.now(),
      }
      streamsRef.current.set(id, { noteId })
      setByNote((prev) => ({
        ...prev,
        [noteId]: [response, ...(prev[noteId] ?? [])],
      }))
      try {
        await startOpenRouterStream({
          requestId: id,
          model,
          systemPrompt,
          userMessage,
        })
      } catch (err) {
        streamsRef.current.delete(id)
        const message =
          err instanceof Error ? err.message : String(err ?? 'erro desconhecido')
        const finalResponse: AiResponse = {
          ...response,
          status: 'error',
          response: message,
        }
        setByNote((prev) => {
          const list = prev[noteId] ?? []
          const idx = list.findIndex((r) => r.id === id)
          if (idx < 0) return prev
          const next = list.slice()
          next[idx] = finalResponse
          return { ...prev, [noteId]: next }
        })
        storage.saveResponse(finalResponse).catch((e) => {
          console.error('failed to persist error response', e)
        })
      }
      return id
    },
    []
  )

  const cancelForNote = useCallback((noteId: string) => {
    const toCancel: string[] = []
    for (const [rid, meta] of streamsRef.current.entries()) {
      if (meta.noteId === noteId) toCancel.push(rid)
    }
    for (const rid of toCancel) {
      const meta = streamsRef.current.get(rid)
      if (!meta) continue
      streamsRef.current.delete(rid)
      cancelOpenRouterStream(rid).catch((e) =>
        console.error('failed to cancel stream', e)
      )
      setByNote((prev) => {
        const list = prev[noteId] ?? []
        const idx = list.findIndex((r) => r.id === rid)
        if (idx < 0) return prev
        const current = list[idx]
        const hasPartial = current.response.length > 0
        if (!hasPartial) {
          const next = list.slice()
          next.splice(idx, 1)
          return { ...prev, [noteId]: next }
        }
        const updated: AiResponse = { ...current, status: 'interrupted' }
        const next = list.slice()
        next[idx] = updated
        storage.saveResponse(updated).catch((err) =>
          console.error('failed to persist interrupted response', err)
        )
        return { ...prev, [noteId]: next }
      })
    }
  }, [])

  const previousNoteRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = previousNoteRef.current
    if (prev && prev !== activeNoteId) {
      cancelForNote(prev)
    }
    previousNoteRef.current = activeNoteId
  }, [activeNoteId, cancelForNote])

  const addErrorCard = useCallback(
    (noteId: string, command: string, query: string, message: string) => {
      const response: AiResponse = {
        id: nanoid(),
        noteId,
        command,
        query,
        model: '',
        response: message,
        status: 'error',
        createdAt: Date.now(),
      }
      setByNote((prev) => ({
        ...prev,
        [noteId]: [response, ...(prev[noteId] ?? [])],
      }))
      storage.saveResponse(response).catch((err) =>
        console.error('failed to persist error card', err)
      )
    },
    []
  )

  const hasActiveStream = responses.some((r) => r.status === 'streaming')

  return { responses, start, addErrorCard, hasActiveStream }
}
