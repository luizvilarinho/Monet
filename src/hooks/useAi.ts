import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiResponse, AiSource } from '../types'
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
  commandId: string
  systemPrompt: string
  userMessage: string
  sources?: AiSource[]
}

export interface PrepareRequestInput {
  noteId: string
  command: string
  query: string
  commandId: string
  statusText: string
}

export interface UseAiOptions {
  // Uma resposta da nota aberta virou erro (preparo, envio ou stream).
  onError?: (response: AiResponse) => void
}

type ResponsesByNote = Record<string, AiResponse[]>

interface StreamMeta {
  noteId: string
}

export function useAi(activeNoteId: string | null, options: UseAiOptions = {}) {
  const [byNote, setByNote] = useState<ResponsesByNote>({})
  const streamsRef = useRef<Map<string, StreamMeta>>(new Map())
  const byNoteRef = useRef<ResponsesByNote>({})
  byNoteRef.current = byNote
  // Cards parados com o Stop durante o preparo: o start e o erro que chegarem
  // depois (o preparo continua no App) não fazem nada.
  const stoppedRef = useRef<Set<string>>(new Set())
  const activeNoteIdRef = useRef(activeNoteId)
  activeNoteIdRef.current = activeNoteId
  const onErrorRef = useRef(options.onError)
  onErrorRef.current = options.onError

  const notifyError = useCallback((response: AiResponse) => {
    if (response.noteId === activeNoteIdRef.current) onErrorRef.current?.(response)
  }, [])

  // Troca a resposta `id` (em qualquer nota) pelo resultado do updater.
  const replaceResponse = useCallback(
    (id: string, updater: (r: AiResponse) => AiResponse | null) => {
      setByNote((prev) => {
        for (const [noteId, list] of Object.entries(prev)) {
          const idx = list.findIndex((r) => r.id === id)
          if (idx < 0) continue
          const updated = updater(list[idx])
          if (!updated) return prev
          const next = list.slice()
          next[idx] = updated
          return { ...prev, [noteId]: next }
        }
        return prev
      })
    },
    []
  )

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
        if (current && !hasPartial) notifyError({ ...current, status: 'error', response: message })
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
  }, [updateResponse, finalizeResponse, notifyError])

  useEffect(() => {
    if (!activeNoteId) return
    if (byNoteRef.current[activeNoteId]) return
    storage
      .getResponses(activeNoteId)
      .then((list) => {
        setByNote((prev) => {
          // Um card criado antes da leitura terminar (Enter logo ao abrir a
          // nota) fica, junto com as respostas gravadas.
          const local = prev[activeNoteId]
          if (!local) return { ...prev, [activeNoteId]: list }
          const ids = new Set(local.map((r) => r.id))
          return { ...prev, [activeNoteId]: [...local, ...list.filter((r) => !ids.has(r.id))] }
        })
      })
      .catch((err) => console.error('failed to load ai responses', err))
  }, [activeNoteId])

  const responses = activeNoteId ? byNote[activeNoteId] ?? [] : []

  // Card no Enter, antes do preparo do contexto (agenda, web, RAG): o usuário
  // vê o pedido e a etapa enquanto o App monta a mensagem.
  const prepare = useCallback(
    ({ noteId, command, query, commandId, statusText }: PrepareRequestInput) => {
      const response: AiResponse = {
        id: commandId,
        noteId,
        command,
        query,
        model: '',
        response: '',
        status: 'preparing',
        statusText,
        createdAt: Date.now(),
        commandId,
      }
      setByNote((prev) => ({
        ...prev,
        [noteId]: [response, ...(prev[noteId] ?? []).filter((r) => r.id !== commandId)],
      }))
    },
    []
  )

  const setPrepareStatus = useCallback(
    (commandId: string, statusText: string) => {
      replaceResponse(commandId, (r) => (r.status === 'preparing' ? { ...r, statusText } : null))
    },
    [replaceResponse]
  )

  const start = useCallback(
    async ({
      noteId,
      model,
      command,
      query,
      commandId,
      systemPrompt,
      userMessage,
      sources,
    }: StartRequestInput) => {
      const id = commandId
      if (stoppedRef.current.has(id)) return id
      const prepared = (byNoteRef.current[noteId] ?? []).find((r) => r.id === id)
      const response: AiResponse = {
        id,
        noteId,
        command,
        query,
        model,
        response: '',
        status: 'streaming',
        createdAt: prepared?.createdAt ?? Date.now(),
        commandId,
        sources: sources && sources.length > 0 ? sources : undefined,
      }
      streamsRef.current.set(id, { noteId })
      // O card do preparo vira o do streaming, no mesmo lugar.
      setByNote((prev) => {
        const list = prev[noteId] ?? []
        const idx = list.findIndex((r) => r.id === id)
        if (idx < 0) return { ...prev, [noteId]: [response, ...list] }
        const next = list.slice()
        next[idx] = response
        return { ...prev, [noteId]: next }
      })
      try {
        // Rastreio dos prompts enviados ao modelo ao acionar slash commands.
        // Útil para depuração e auditoria do que está sendo enviado.
        if (import.meta.env.DEV) console.log('[Monet AI] Slash command dispatch', {
          command,
          query,
          model,
          systemPrompt,
          userMessage,
        })
        await startOpenRouterStream({
          requestId: id,
          model,
          systemPrompt,
          userMessage,
        })
      } catch (err) {
        // Parado com o Stop durante o envio: o card já está como interrompido.
        if (!streamsRef.current.has(id)) return id
        streamsRef.current.delete(id)
        const message =
          err instanceof Error ? err.message : String(err ?? 'unknown error')
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
        notifyError(finalResponse)
      }
      return id
    },
    [notifyError]
  )

  // Stop do card: no preparo, o envio não acontece; no streaming, cancela e
  // fica o texto parcial. Os dois viram `interrupted` e são gravados.
  const stopResponse = useCallback((id: string) => {
    const streaming = streamsRef.current.has(id)
    if (streaming) {
      streamsRef.current.delete(id)
      cancelOpenRouterStream(id).catch((e) => console.error('failed to cancel stream', e))
    } else {
      stoppedRef.current.add(id)
    }
    replaceResponse(id, (r) => {
      if (r.status !== 'preparing' && r.status !== 'streaming') return null
      const updated: AiResponse = { ...r, status: 'interrupted', statusText: undefined }
      storage.saveResponse(updated).catch((err) =>
        console.error('failed to persist interrupted response', err)
      )
      return updated
    })
  }, [replaceResponse])

  // Erro antes do stream: o card do preparo vira o card de erro (no mesmo
  // lugar e com o id que a linha do editor conhece).
  const addErrorCard = useCallback(
    (noteId: string, command: string, query: string, message: string, commandId: string) => {
      if (stoppedRef.current.has(commandId)) return
      const response: AiResponse = {
        id: commandId,
        noteId,
        command,
        query,
        model: '',
        response: message,
        status: 'error',
        createdAt: Date.now(),
        commandId,
      }
      setByNote((prev) => {
        const list = prev[noteId] ?? []
        const idx = list.findIndex((r) => r.id === response.id)
        if (idx < 0) return { ...prev, [noteId]: [response, ...list] }
        const next = list.slice()
        next[idx] = { ...response, createdAt: list[idx].createdAt }
        return { ...prev, [noteId]: next }
      })
      storage.saveResponse(response).catch((err) =>
        console.error('failed to persist error card', err)
      )
      notifyError(response)
    },
    [notifyError]
  )

  const removeResponse = useCallback((responseId: string) => {
    if (streamsRef.current.has(responseId)) {
      streamsRef.current.delete(responseId)
      cancelOpenRouterStream(responseId).catch((e) => console.error('failed to cancel stream', e))
    }
    stoppedRef.current.add(responseId)
    setByNote((prev) => {
      const next: ResponsesByNote = {}
      for (const [noteId, list] of Object.entries(prev)) {
        const filtered = list.filter((r) => r.id !== responseId)
        if (filtered.length !== list.length) {
          storage.deleteResponse(responseId).catch((err) =>
            console.error('failed to delete ai response', err)
          )
        }
        next[noteId] = filtered
      }
      return next
    })
  }, [])

  return {
    responses,
    prepare,
    setPrepareStatus,
    start,
    stopResponse,
    addErrorCard,
    removeResponse,
  }
}
