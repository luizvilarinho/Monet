import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { loadOrder, saveOrder } from '../../lib/noteOrder'
import type { AiModel, AiResponse } from '../../types'
import { AiCard } from './AiCard'
import styles from './AiPanel.module.css'
import { ModelSelector } from './ModelSelector'

const MIN_WIDTH = 300
const MAX_WIDTH = 720
const WIDE_WIDTH_KEY = 'monet:side-note-width'

export type RightTab = 'ai' | 'chat' | 'open'

// Coluna com a nota lateral (aba Open): largura própria, que pode passar de
// MAX_WIDTH para caber uma nota ao lado da principal.
function wideMaxWidth() {
  return Math.max(MAX_WIDTH, Math.round(window.innerWidth * 0.6))
}

function clampWide(px: number) {
  return Math.min(wideMaxWidth(), Math.max(MIN_WIDTH, px))
}

// Largura mínima da nota principal com a nota lateral aberta: a coluna larga
// cede antes de apertar a nota em que se escreve.
const MAIN_MIN_WIDTH = 480

function aiOrderKey(noteId: string | null) {
  return `monet:ai-order:${noteId ?? ''}`
}

interface SortableAiCardProps {
  response: AiResponse
  execIndex: number
  forceOpen?: boolean
  globalExpand?: boolean | null
  onDelete?: (id: string) => void
  hasApiKey?: boolean
  onOpenInChat?: (response: AiResponse) => void
}

function SortableAiCard({ response, execIndex, forceOpen, globalExpand, onDelete, hasApiKey, onOpenInChat }: SortableAiCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: response.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.sortableCard} data-exec-index={execIndex}>
      <div
        className={styles.cardDragHandle}
        {...attributes}
        {...listeners}
        aria-label="drag to reorder"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="4" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="11" cy="4" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="11" cy="12" r="1.2" />
        </svg>
      </div>
      <AiCard
        response={response}
        execIndex={execIndex}
        forceOpen={forceOpen}
        globalExpand={globalExpand}
        onDelete={onDelete}
        hasApiKey={hasApiKey}
        onOpenInChat={onOpenInChat}
      />
    </div>
  )
}

export interface AiPanelProps {
  open: boolean
  noteId: string | null
  responses: AiResponse[]
  hasApiKey: boolean
  apiKeyChecked: boolean
  modelsLoading: boolean
  modelsError: string | null
  models: AiModel[]
  modelId: string | null
  onModelChange: (id: string) => void
  onOpenSettings: () => void
  navigateToCard?: { index: number; ts: number } | null
  onDeleteResponse?: (id: string) => void
  onOpenInChat?: (response: AiResponse) => void
  activeTab: RightTab
  onTabChange: (tab: RightTab) => void
  // Sempre renderizado (escondido via CSS fora da aba Chat): desmontar o chat
  // cancelaria um stream ativo.
  chatPanel: ReactNode
  // Conteúdo da aba Open (notas abertas hoje ou a nota lateral).
  openPanel: ReactNode
  // Há nota lateral aberta: na aba Open a coluna usa a largura larga; nas
  // outras abas, a aba Open ganha um ponto (a nota continua lá).
  sideNoteOpen: boolean
}

export function AiPanel({
  open,
  noteId,
  responses,
  hasApiKey,
  apiKeyChecked,
  modelsLoading,
  modelsError,
  models,
  modelId,
  onModelChange,
  onOpenSettings,
  navigateToCard,
  onDeleteResponse,
  onOpenInChat,
  activeTab,
  onTabChange,
  chatPanel,
  openPanel,
  sideNoteOpen,
}: AiPanelProps) {
  const wide = activeTab === 'open' && sideNoteOpen
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('monet:ai-width') ?? '', 10)
    return isNaN(saved) ? MIN_WIDTH : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, saved))
  })
  const [wideWidth, setWideWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(WIDE_WIDTH_KEY) ?? '', 10)
    return clampWide(isNaN(saved) ? Math.round(window.innerWidth * 0.4) : saved)
  })
  const wideRef = useRef(wide)
  wideRef.current = wide
  // Teto da coluna larga no layout atual: a soma da coluna com a nota
  // principal (o espaço que as duas dividem) menos o mínimo da principal.
  // Refeito quando a janela ou a principal mudam de largura (colunas da
  // esquerda recolhidas ou arrastadas) e quando a principal é trocada; sem
  // nota principal, sem teto. A soma não muda com a largura da coluna: sem
  // laço de medida.
  const asideRef = useRef<HTMLElement | null>(null)
  const [wideRoom, setWideRoom] = useState<number | null>(null)
  const wideRoomRef = useRef(wideRoom)
  wideRoomRef.current = wideRoom
  useLayoutEffect(() => {
    const aside = asideRef.current
    const workspace = aside?.parentElement
    if (!wide || !open || !aside || !workspace) {
      setWideRoom(null)
      return
    }
    let observedMain: HTMLElement | null = null
    const measure = () => {
      const main = workspace.querySelector<HTMLElement>(':scope > [data-note-editor]')
      if (main !== observedMain) {
        if (observedMain) resizes.unobserve(observedMain)
        if (main) resizes.observe(main)
        observedMain = main
      }
      setWideRoom(main ? aside.offsetWidth + main.offsetWidth - MAIN_MIN_WIDTH : null)
    }
    const resizes = new ResizeObserver(measure)
    const children = new MutationObserver(measure)
    resizes.observe(workspace)
    children.observe(workspace, { childList: true })
    measure()
    return () => {
      resizes.disconnect()
      children.disconnect()
    }
  }, [wide, open])
  const shownWideWidth = wideRoom === null ? wideWidth : Math.max(MIN_WIDTH, Math.min(wideWidth, wideRoom))
  const [forceOpenIndex, setForceOpenIndex] = useState<number | null>(null)
  const [expandAll, setExpandAll] = useState<boolean | null>(null)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const contentRef = useRef<HTMLDivElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Load saved order when note changes
  useEffect(() => {
    setOrderedIds(loadOrder(aiOrderKey(noteId)))
  }, [noteId])

  // Prepend any new response IDs not yet in orderedIds
  useEffect(() => {
    setOrderedIds((prev) => {
      const prevSet = new Set(prev)
      const newOnes = responses.filter((r) => !prevSet.has(r.id)).map((r) => r.id)
      return newOnes.length === 0 ? prev : [...newOnes, ...prev]
    })
  }, [responses])

  // Derive display order: known IDs in saved order, unknown (new) ones at front
  const orderedResponses = useMemo(() => {
    const idx = new Map(orderedIds.map((id, i) => [id, i]))
    return [...responses].sort((a, b) => {
      const ai = idx.get(a.id)
      const bi = idx.get(b.id)
      if (ai !== undefined && bi !== undefined) return ai - bi
      if (ai === undefined && bi === undefined) return b.createdAt - a.createdAt
      return ai === undefined ? -1 : 1
    })
  }, [responses, orderedIds])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = wide ? shownWideWidth : width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [wide, shownWideWidth, width])

  useEffect(() => {
    // null até o primeiro movimento: clique na alça sem arrastar não grava.
    let lastWidth: number | null = null
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      if (wideRef.current) {
        const room = wideRoomRef.current
        let next = clampWide(startWidth.current + delta)
        if (room !== null) next = Math.max(MIN_WIDTH, Math.min(next, room))
        lastWidth = next
        setWideWidth(next)
      } else {
        const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
        lastWidth = next
        setWidth(next)
      }
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (lastWidth !== null) {
        localStorage.setItem(wideRef.current ? WIDE_WIDTH_KEY : 'monet:ai-width', String(lastWidth))
        lastWidth = null
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    if (!navigateToCard) return
    const { index: execIndex } = navigateToCard
    const cardIndex = orderedResponses.length - 1 - execIndex
    if (cardIndex < 0 || cardIndex >= orderedResponses.length) return
    setForceOpenIndex(cardIndex)
    requestAnimationFrame(() => {
      const card = contentRef.current?.querySelector(
        `[data-exec-index="${cardIndex}"]`
      ) as HTMLElement | null
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
  }, [navigateToCard, orderedResponses.length])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedResponses.findIndex((r) => r.id === active.id)
    const newIndex = orderedResponses.findIndex((r) => r.id === over.id)
    const reordered = arrayMove(orderedResponses, oldIndex, newIndex)
    const newIds = reordered.map((r) => r.id)
    setOrderedIds(newIds)
    saveOrder(aiOrderKey(noteId), newIds)
  }

  const showMissingKeyBanner = apiKeyChecked && !hasApiKey
  const isAiTab = activeTab === 'ai'

  // O painel é sempre renderizado (escondido via CSS quando fechado) para
  // manter o chat montado.
  return (
    <aside
      ref={asideRef}
      className={open ? styles.panel : `${styles.panel} ${styles.panelHidden}`}
      style={{ width: wide ? shownWideWidth : width }}
    >
      <div className={styles.resizeHandle} onMouseDown={onMouseDown} />
      <header className={styles.header}>
        <div className={styles.tabs} role="group" aria-label="Panel tabs">
          <button
            type="button"
            className={styles.tab}
            aria-pressed={isAiTab}
            onClick={() => onTabChange('ai')}
          >
            AI
          </button>
          <button
            type="button"
            className={styles.tab}
            aria-pressed={activeTab === 'chat'}
            onClick={() => onTabChange('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            className={styles.tab}
            aria-pressed={activeTab === 'open'}
            onClick={() => onTabChange('open')}
            title={
              sideNoteOpen && !wide
                ? 'Notes opened today. A side note is open here'
                : 'Notes opened today (Alt+← goes to the last note)'
            }
          >
            Open
            {sideNoteOpen && !wide && <span className={styles.tabDot} role="img" aria-label="Side note open" />}
          </button>
        </div>
        {isAiTab && (
          <ModelSelector
            hasApiKey={hasApiKey}
            apiKeyChecked={apiKeyChecked}
            loading={modelsLoading}
            error={modelsError}
            models={models}
            selectedId={modelId}
            onSelect={onModelChange}
            onOpenSettings={onOpenSettings}
          />
        )}
      </header>
      {isAiTab && showMissingKeyBanner && (
        <div className={styles.keyBanner} role="alert">
          <span>
            Set up your OpenRouter key in Settings to enable AI features.
          </span>
          <button type="button" onClick={onOpenSettings} className={styles.keyBannerCta}>
            open Settings
          </button>
        </div>
      )}
      {isAiTab && (
        <div className={styles.content} ref={contentRef}>
          {orderedResponses.length > 0 && (
            <div className={styles.cardsToolbar}>
              <button
                className={styles.expandToggle}
                onClick={() => setExpandAll((v) => v === true ? false : true)}
                title={expandAll === true ? 'collapse all' : 'expand all'}
                type="button"
              >
                {expandAll === true ? '−' : '+'}
              </button>
            </div>
          )}
          {orderedResponses.length === 0 ? (
            <p className={styles.empty}>
              Use /commands in the editor to trigger the AI.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedResponses.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                {orderedResponses.map((r, i) => (
                  <SortableAiCard
                    key={r.id}
                    response={r}
                    execIndex={i}
                    forceOpen={forceOpenIndex === i}
                    globalExpand={expandAll}
                    onDelete={onDeleteResponse}
                    hasApiKey={hasApiKey}
                    onOpenInChat={onOpenInChat}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
      <div className={activeTab === 'chat' ? styles.chatTab : styles.chatTabHidden}>{chatPanel}</div>
      {activeTab === 'open' && openPanel}
    </aside>
  )
}
