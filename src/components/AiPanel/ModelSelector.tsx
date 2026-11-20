import { CaretDown } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { AiModel } from '../../types'
import styles from './AiPanel.module.css'

export interface ModelSelectorProps {
  hasApiKey: boolean
  apiKeyChecked: boolean
  loading: boolean
  error: string | null
  models: AiModel[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenSettings: () => void
}

export function ModelSelector({
  hasApiKey,
  apiKeyChecked,
  loading,
  error,
  models,
  selectedId,
  onSelect,
  onOpenSettings,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Item destacado pelas setas (índice na lista filtrada).
  const [highlighted, setHighlighted] = useState(0)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(
    () => models.find((m) => m.id === selectedId) ?? null,
    [models, selectedId]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    )
  }, [query, models])

  // Ao abrir, o destaque começa no modelo atual; ao filtrar, no primeiro.
  useEffect(() => {
    if (!open) return
    const at = filtered.findIndex((m) => m.id === selectedId)
    setHighlighted(query.trim() || at < 0 ? 0 : at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query])

  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, highlighted])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function close() {
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  function pick(id: string) {
    onSelect(id)
    close()
  }

  // Esc fecha; ↑/↓ movem o destaque (circular) e Enter escolhe.
  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    if (loading || filtered.length === 0) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlighted((i) => (i + step + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const m = filtered[highlighted]
      if (m) pick(m.id)
    }
  }

  if (apiKeyChecked && !hasApiKey) {
    return (
      <div className={styles.selectorWarn} role="status">
        <span className={styles.warnDot} aria-hidden="true" />
        <span className={styles.warnText}>No API key</span>
        <button
          type="button"
          className={styles.warnCta}
          onClick={onOpenSettings}
        >
          Settings
        </button>
      </div>
    )
  }

  const buttonLabel = selected
    ? selected.name
    : loading
      ? 'Loading models…'
      : models.length === 0
        ? 'No model available'
        : 'Select model'

  return (
    <div className={styles.selectorWrap} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.selectorButton}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select model"
        disabled={!loading && models.length === 0 && !error}
      >
        <span className={styles.selectorLabel}>{buttonLabel}</span>
        <CaretDown size={10} className={styles.caret} aria-hidden />
      </button>
      {open && (
        <div className={styles.popover}>
          <input
            className={styles.search}
            placeholder="Search models…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            autoFocus
            aria-label="Search models"
            aria-controls="model-selector-list"
            aria-activedescendant={
              filtered[highlighted] ? `model-option-${highlighted}` : undefined
            }
          />
          <div className={styles.modelList} role="listbox" id="model-selector-list" ref={listRef}>
            {loading && (
              <div className={styles.popoverInfo}>Loading models…</div>
            )}
            {error && !loading && (
              <div className={styles.popoverError}>{error}</div>
            )}
            {!loading && !error && filtered.length === 0 && models.length === 0 && (
              <div className={styles.popoverInfo}>
                No models available at the moment.
              </div>
            )}
            {!loading && !error && filtered.length === 0 && models.length > 0 && (
              <div className={styles.popoverInfo}>
                No model matches the filter.
              </div>
            )}
            {!loading &&
              filtered.map((m, i) => {
                const active = m.id === selectedId
                const className = active
                  ? styles.modelItemActive
                  : i === highlighted
                    ? `${styles.modelItem} ${styles.modelItemHighlighted}`
                    : styles.modelItem
                return (
                  <button
                    key={m.id}
                    id={`model-option-${i}`}
                    data-index={i}
                    type="button"
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    className={className}
                    data-highlighted={i === highlighted || undefined}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => pick(m.id)}
                  >
                    <span className={styles.modelName}>{m.name}</span>
                    <span className={styles.modelId}>{m.id}</span>
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
