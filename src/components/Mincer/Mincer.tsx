import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { Note, Notebook } from '../../types'
import type { MincerJobState } from '../../hooks/useMincerJob'
import { useConfirm } from '../../hooks/useConfirm'
import type { SettingsSection } from '../Settings/SettingsModal'
import { MINCER_SELECTED_ID_KEY, mincerList, mincerMarkSeen, type MincerItemSummary } from '../../lib/mincer'
import { MincerHistory } from './MincerHistory'
import { MincerItemView } from './MincerItemView'
import { MincerNew, queueDroppedFiles } from './MincerNew'
import styles from './Mincer.module.css'

export interface MincerProps {
  job: MincerJobState
  missingApiKey: boolean
  onOpenSettings: (section: SettingsSection) => void
  notebooks: Notebook[]
  notes: Note[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (notebookId: string, title: string, content: string) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  onNavigateToNote: (notebookId: string, noteId: string) => void
  onOpenChat: () => void
}

function loadSelectedId(): string | null {
  try {
    return localStorage.getItem(MINCER_SELECTED_ID_KEY)
  } catch {
    return null
  }
}

export function Mincer({ job, missingApiKey, onOpenSettings, ...outputs }: MincerProps) {
  const [items, setItems] = useState<MincerItemSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  // Com gravação em curso, abre na tela New (aba Record), onde ficam Stop e Discard.
  const [selectedId, setSelectedIdState] = useState<string | null>(() =>
    job.recording ? null : loadSelectedId()
  )
  const { confirm, modal } = useConfirm()
  // Remonta a tela New (a linha "Recording" do histórico volta à aba Record).
  const [newScreenKey, setNewScreenKey] = useState(0)

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id)
    try {
      if (id) localStorage.setItem(MINCER_SELECTED_ID_KEY, id)
      else localStorage.removeItem(MINCER_SELECTED_ID_KEY)
    } catch {
      // sem storage: a seleção vale só nesta sessão
    }
  }, [])

  // Só as colunas leves: a transcrição é lida só para o item aberto.
  const reload = useCallback(async () => {
    try {
      setItems(await mincerList())
    } catch {
      // fallback browser / banco indisponível: lista vazia
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, job.revision])

  useEffect(() => {
    if (loaded && selectedId && !items.some((i) => i.id === selectedId)) setSelectedId(null)
  }, [loaded, items, selectedId, setSelectedId])

  // Abrir o item tira a marca de "novo" (também quando termina com ele aberto).
  const selectedUnseen = items.some((i) => i.id === selectedId && i.unseen)
  const { refreshUnseen } = job
  useEffect(() => {
    if (!selectedId || !selectedUnseen) return
    mincerMarkSeen(selectedId)
      .then(() => {
        refreshUnseen()
        return reload()
      })
      .catch(() => {})
  }, [selectedId, selectedUnseen, refreshUnseen, reload])

  // Com um item aberto, a tela New não está montada: arquivos soltos abrem ela,
  // já selecionados (a própria New trata o drop quando está aberta).
  const itemOpen = selectedId !== null
  const { recording } = job
  useEffect(() => {
    if (!itemOpen) return
    const pending = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type !== 'drop' || e.payload.paths.length === 0) return
      queueDroppedFiles(e.payload.paths, recording)
      setSelectedId(null)
    })
    return () => {
      pending.then((unlisten) => unlisten()).catch(() => {})
    }
  }, [itemOpen, recording, setSelectedId])

  // Posição de cada item na fila (1 = o próximo), na ordem em que entraram.
  const queuePositions = useMemo(() => {
    const queued = items.filter((i) => i.status === 'queued').sort((a, b) => a.queuedAt - b.queuedAt)
    return new Map(queued.map((i, index) => [i.id, index + 1]))
  }, [items])

  const handleStarted = useCallback(
    async (id: string) => {
      await reload()
      setSelectedId(id)
    },
    [reload, setSelectedId]
  )

  return (
    <section className={styles.mincer} aria-label="Mincer">
      <MincerHistory
        items={items}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => setSelectedId(null)}
        recordingStartedAt={job.recordingStartedAt}
        onOpenRecording={() => {
          setSelectedId(null)
          setNewScreenKey((k) => k + 1)
        }}
      />
      <div className={styles.main}>
        {selectedId && items.some((i) => i.id === selectedId) ? (
          <MincerItemView
            key={selectedId}
            itemId={selectedId}
            job={job}
            confirm={confirm}
            queuePosition={queuePositions.get(selectedId) ?? null}
            onChanged={() => void reload()}
            onDeleted={() => {
              setSelectedId(null)
              void reload()
            }}
            {...outputs}
          />
        ) : (
          <MincerNew
            key={newScreenKey}
            job={job}
            confirm={confirm}
            showIntro={loaded && items.length === 0}
            missingApiKey={missingApiKey}
            onStarted={handleStarted}
            onQueued={() => void reload()}
            onOpenSettings={onOpenSettings}
          />
        )}
      </div>
      {modal}
    </section>
  )
}
