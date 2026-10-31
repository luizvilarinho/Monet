import { useCallback, useEffect, useState } from 'react'
import type { Note, Notebook } from '../../types'
import type { MincerJobState } from '../../hooks/useMincerJob'
import { useConfirm } from '../../hooks/useConfirm'
import type { SettingsSection } from '../Settings/SettingsModal'
import { MINCER_SELECTED_ID_KEY, mincerList, mincerMarkSeen, type MincerItemSummary } from '../../lib/mincer'
import { MincerHistory } from './MincerHistory'
import { MincerItemView } from './MincerItemView'
import { MincerNew } from './MincerNew'
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
      />
      <div className={styles.main}>
        {selectedId && items.some((i) => i.id === selectedId) ? (
          <MincerItemView
            key={selectedId}
            itemId={selectedId}
            job={job}
            confirm={confirm}
            onChanged={() => void reload()}
            onDeleted={() => {
              setSelectedId(null)
              void reload()
            }}
            {...outputs}
          />
        ) : (
          <MincerNew
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
