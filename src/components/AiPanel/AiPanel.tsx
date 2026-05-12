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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadOrder, saveOrder } from '../../lib/noteOrder'
import type { AiModel, AiResponse } from '../../types'
import { AiCard } from './AiCard'
import styles from './AiPanel.module.css'
import { ModelSelector } from './ModelSelector'

const MIN_WIDTH = 300
const MAX_WIDTH = 720

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
        aria-label="arrastar para reordenar"
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
}: AiPanelProps) {
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('monet:ai-width') ?? '', 10)
    return isNaN(saved) ? MIN_WIDTH : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, saved))
  })
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
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    let lastWidth = MIN_WIDTH
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      lastWidth = next
      setWidth(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('monet:ai-width', String(lastWidth))
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

  if (!open) return null

  const showMissingKeyBanner = apiKeyChecked && !hasApiKey

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.resizeHandle} onMouseDown={onMouseDown} />
      <header className={styles.header}>
        <span className={styles.title}>IA</span>
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
      </header>
      {showMissingKeyBanner && (
        <div className={styles.keyBanner} role="alert">
          <span>
            É necessário cadastrar a chave do OpenRouter em Settings para usar a IA.
          </span>
          <button type="button" onClick={onOpenSettings} className={styles.keyBannerCta}>
            abrir Settings
          </button>
        </div>
      )}
      <div className={styles.content} ref={contentRef}>
        {orderedResponses.length > 0 && (
          <div className={styles.cardsToolbar}>
            <button
              className={styles.expandToggle}
              onClick={() => setExpandAll((v) => v === true ? false : true)}
              title={expandAll === true ? 'fechar todas' : 'abrir todas'}
              type="button"
            >
              {expandAll === true ? '−' : '+'}
            </button>
          </div>
        )}
        {orderedResponses.length === 0 ? (
          <p className={styles.empty}>
            Use /comandos no editor para acionar a IA.
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
    </aside>
  )
}
