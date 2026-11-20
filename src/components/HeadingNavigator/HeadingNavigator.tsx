import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './HeadingNavigator.module.css'
import {
  findClosestHeading,
  parseHeadings,
} from '../../lib/headingParser'

export interface HeadingNavigatorProps {
  content: string
  activeOffset: number | null
  onNavigate: (offset: number) => void
}

export function HeadingNavigator({
  content,
  activeOffset,
  onNavigate,
}: HeadingNavigatorProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelPos, setPanelPos] = useState({ right: 0, top: 0 })
  const boxRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const activeDashRef = useRef<HTMLButtonElement | null>(null)
  const activeItemRef = useRef<HTMLButtonElement | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const headings = useMemo(() => parseHeadings(content), [content])

  const activeHeading = useMemo(() => {
    if (activeOffset === null || headings.length === 0) return null
    return findClosestHeading(headings, activeOffset)
  }, [headings, activeOffset])

  useEffect(() => {
    activeDashRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeHeading])

  // Painel aberto: o item ativo fica à vista (nota longa rola dentro do painel).
  useEffect(() => {
    if (panelOpen) activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [panelOpen])

  const showPanel = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    if (!panelOpen && boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect()
      setPanelPos({
        right: window.innerWidth - rect.left + 4,
        top: rect.top,
      })
    }
    setPanelOpen(true)
  }, [panelOpen])

  const hidePanel = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setPanelOpen(false), 150)
  }, [])

  // Sem headings, nada na tela.
  if (headings.length === 0) return null

  return (
    <>
      <div
        className={styles.box}
        ref={boxRef}
        onMouseEnter={showPanel}
        onMouseLeave={hidePanel}
        onFocus={showPanel}
        onBlur={hidePanel}
        // Um ponto de Tab só: o foco abre o painel, e o Tab segue para os itens.
        tabIndex={0}
        role="navigation"
        aria-label="Headings"
      >
        {headings.map((heading) => {
          const isActive = activeHeading?.offset === heading.offset
          const levelClass =
            heading.level === 1 ? styles.dashH1
            : heading.level === 2 ? styles.dashH2
            : heading.level === 3 ? styles.dashH3
            : heading.level === 4 ? styles.dashH4
            : heading.level === 5 ? styles.dashH5
            : styles.dashH6

          return (
            <button
              key={heading.offset}
              type="button"
              ref={isActive ? activeDashRef : undefined}
              className={`${styles.dash} ${levelClass} ${isActive ? styles.dashActive : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onNavigate(heading.offset)
              }}
              tabIndex={-1}
              aria-label={heading.text}
            />
          )
        })}
      </div>
      {panelOpen && (
        <div
          className={styles.panel}
          ref={panelRef}
          onMouseEnter={showPanel}
          onMouseLeave={hidePanel}
          onFocus={showPanel}
          onBlur={hidePanel}
          style={{ right: panelPos.right, top: panelPos.top, maxHeight: `calc(100vh - ${panelPos.top}px - 16px)` }}
        >
          {headings.map((heading) => {
            const isActive = activeHeading?.offset === heading.offset
            return (
              <button
                key={heading.offset}
                type="button"
                ref={isActive ? activeItemRef : undefined}
                className={`${styles.panelItem} ${isActive ? styles.panelItemActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onNavigate(heading.offset)
                }}
              >
                <span className={styles.panelLevel}>
                  {'#'.repeat(heading.level)}
                </span>
                {heading.text}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
