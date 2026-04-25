import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiModel, AiResponse } from '../../types'
import { AiCard } from './AiCard'
import { ModelSelector } from './ModelSelector'
import styles from './AiPanel.module.css'

const MIN_WIDTH = 300
const MAX_WIDTH = 720

export interface AiPanelProps {
  open: boolean
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
}

export function AiPanel({
  open,
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
}: AiPanelProps) {
  const [width, setWidth] = useState(MIN_WIDTH)
  const [forceOpenIndex, setForceOpenIndex] = useState<number | null>(null)
  const [expandAll, setExpandAll] = useState<boolean | null>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const contentRef = useRef<HTMLDivElement | null>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setWidth(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
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
    const cardIndex = responses.length - 1 - execIndex
    if (cardIndex < 0 || cardIndex >= responses.length) return
    setForceOpenIndex(cardIndex)
    requestAnimationFrame(() => {
      const card = contentRef.current?.querySelector(
        `[data-exec-index="${cardIndex}"]`
      ) as HTMLElement | null
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
  }, [navigateToCard, responses.length])

  if (!open) return null

  const showMissingKeyBanner = apiKeyChecked && !hasApiKey

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.resizeHandle} onMouseDown={onMouseDown} />
      <header className={styles.header}>
        <span className={styles.title}>ia</span>
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
        {responses.length > 0 && (
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
        {responses.length === 0 ? (
          <p className={styles.empty}>
            Use /comandos no editor para acionar a IA.
          </p>
        ) : (
          responses.map((r, i) => (
            <AiCard
              key={r.id}
              response={r}
              execIndex={i}
              forceOpen={forceOpenIndex === i}
              globalExpand={expandAll}
              onDelete={onDeleteResponse}
            />
          ))
        )}
      </div>
    </aside>
  )
}
