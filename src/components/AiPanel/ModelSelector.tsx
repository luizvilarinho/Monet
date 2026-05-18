import { useEffect, useMemo, useRef, useState } from 'react'
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
  const wrapperRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (apiKeyChecked && !hasApiKey) {
    return (
      <div className={styles.selectorWarn} role="status">
        <span className={styles.warnDot} aria-hidden="true" />
        <span className={styles.warnText}>Sem chave de API</span>
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
      ? 'loading models...'
      : models.length === 0
        ? 'no model available'
        : 'select model'

  return (
    <div className={styles.selectorWrap} ref={wrapperRef}>
      <button
        type="button"
        className={styles.selectorButton}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="select model"
        disabled={!loading && models.length === 0 && !error}
      >
        <span className={styles.selectorLabel}>{buttonLabel}</span>
        <svg
          className={styles.caret}
          viewBox="0 0 24 24"
          width="10"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.popover} role="listbox">
          <input
            className={styles.search}
            placeholder="search model..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="search model"
          />
          <div className={styles.modelList}>
            {loading && (
              <div className={styles.popoverInfo}>loading models...</div>
            )}
            {error && !loading && (
              <div className={styles.popoverError}>{error}</div>
            )}
            {!loading && !error && filtered.length === 0 && models.length === 0 && (
              <div className={styles.popoverInfo}>
                no models available at the moment.
              </div>
            )}
            {!loading && !error && filtered.length === 0 && models.length > 0 && (
              <div className={styles.popoverInfo}>
                no model matches the filter.
              </div>
            )}
            {!loading &&
              filtered.map((m) => {
                const active = m.id === selectedId
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={
                      active ? styles.modelItemActive : styles.modelItem
                    }
                    onClick={() => {
                      onSelect(m.id)
                      setOpen(false)
                      setQuery('')
                    }}
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
