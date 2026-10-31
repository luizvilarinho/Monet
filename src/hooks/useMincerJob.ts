import { useCallback, useEffect, useRef, useState } from 'react'
import type { UnlistenFn } from '@tauri-apps/api/event'
import {
  mincerActiveJob,
  mincerList,
  mincerRecordStatus,
  onMincerDone,
  onMincerError,
  onMincerProgress,
  onMincerRecord,
  type MincerProgress,
} from '../lib/mincer'

// Estado global do job do Mincer, montado no App: o job roda no Rust e
// continua quando a tela do Mincer é desmontada. O progresso fica fora
// (useMincerProgress) para não re-renderizar o App a cada evento.
export interface MincerJobState {
  activeItemId: string | null
  recording: boolean
  recordingStartedAt: number | null
  // Itens terminados e ainda não abertos (ponto no botão Mincer).
  unseenCount: number
  refreshUnseen: () => void
  // Incrementa a cada evento relevante; as telas recarregam a lista/o item.
  revision: number
}

export function useMincerJob(): MincerJobState {
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [unseenCount, setUnseenCount] = useState(0)
  const [revision, setRevision] = useState(0)
  // Os listeners são registrados uma vez; o ref espelha o item ativo.
  const activeRef = useRef<string | null>(null)

  const refreshUnseen = useCallback(() => {
    mincerList()
      .then((items) => setUnseenCount(items.filter((i) => i.unseen).length))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const syncRecording = () =>
      mincerRecordStatus()
        .then((s) => {
          setRecording(s.active)
          setRecordingStartedAt(s.active ? s.startedAt : null)
        })
        .catch(() => {})
    mincerActiveJob()
      .then((id) => {
        activeRef.current = id
        setActiveItemId(id)
      })
      .catch(() => {})
    void syncRecording()
    refreshUnseen()

    const bump = () => setRevision((r) => r + 1)
    const finish = (itemId: string) => {
      // Cancelar um item enfileirado emite error com outro id enquanto outro roda.
      if (itemId === activeRef.current) {
        activeRef.current = null
        setActiveItemId(null)
      }
      bump()
      refreshUnseen()
    }

    const pending: Promise<UnlistenFn>[] = [
      onMincerProgress((p) => {
        if (p.itemId !== activeRef.current) {
          activeRef.current = p.itemId
          setActiveItemId(p.itemId)
          bump()
        }
      }),
      onMincerDone((p) => finish(p.itemId)),
      onMincerError((p) => finish(p.itemId)),
      onMincerRecord(() => {
        void syncRecording()
        bump()
      }),
    ]
    return () => {
      for (const promise of pending) {
        promise.then((unlisten) => unlisten()).catch(() => {})
      }
    }
  }, [refreshUnseen])

  return { activeItemId, recording, recordingStartedAt, unseenCount, refreshUnseen, revision }
}

// Último progresso do item, assinado só pela tela do item.
export function useMincerProgress(itemId: string): MincerProgress | null {
  const [progress, setProgress] = useState<MincerProgress | null>(null)

  useEffect(() => {
    setProgress(null)
    const clear = (p: { itemId: string }) => {
      if (p.itemId === itemId) setProgress(null)
    }
    const pending: Promise<UnlistenFn>[] = [
      onMincerProgress((p) => {
        if (p.itemId === itemId) setProgress(p)
      }),
      onMincerDone(clear),
      onMincerError(clear),
    ]
    return () => {
      for (const promise of pending) {
        promise.then((unlisten) => unlisten()).catch(() => {})
      }
    }
  }, [itemId])

  return progress
}
