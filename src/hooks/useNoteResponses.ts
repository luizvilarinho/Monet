import { useEffect, useState } from 'react'
import type { AiResponse } from '../types'
import { storage } from '../storage'

const NO_RESPONSES: AiResponse[] = []

// Respostas da IA salvas de uma nota que não é a ativa (nota lateral da aba
// Open), só para os blocos de resposta embutidos aparecerem nela.
export function useNoteResponses(noteId: string | null): AiResponse[] {
  const [loaded, setLoaded] = useState<{ noteId: string; responses: AiResponse[] } | null>(null)

  useEffect(() => {
    if (!noteId) return
    let cancelled = false
    storage
      .getResponses(noteId)
      .then((responses) => {
        if (!cancelled) setLoaded({ noteId, responses })
      })
      .catch((err) => console.warn('[Monet] failed to load note responses', err))
    return () => {
      cancelled = true
    }
  }, [noteId])

  return loaded && loaded.noteId === noteId ? loaded.responses : NO_RESPONSES
}
