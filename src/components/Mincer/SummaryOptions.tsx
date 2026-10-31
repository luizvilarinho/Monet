import { useState } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { nanoid } from 'nanoid'
import {
  MINCER_PRESETS,
  loadSavedPrompts,
  saveSavedPrompts,
  type SavedPrompt,
  type SummarySettings,
} from './presets'
import shared from './Mincer.module.css'
import styles from './SummaryOptions.module.css'

interface SummaryOptionsProps {
  value: SummarySettings
  onChange: (v: SummarySettings) => void
  disabled?: boolean
}

export function SummaryOptions({ value, onChange, disabled = false }: SummaryOptionsProps) {
  const [expanded, setExpanded] = useState(() => value.extra.trim() !== '')
  const [saved, setSaved] = useState<SavedPrompt[]>(loadSavedPrompts)
  const [selectedSavedId, setSelectedSavedId] = useState('')
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  function persist(list: SavedPrompt[]) {
    setSaved(list)
    saveSavedPrompts(list)
  }

  function handlePickSaved(id: string) {
    setSelectedSavedId(id)
    const prompt = saved.find((p) => p.id === id)
    if (prompt) onChange({ ...value, extra: prompt.text })
  }

  function handleSaveNew() {
    const trimmed = name.trim()
    if (!trimmed || !value.extra.trim()) return
    const prompt: SavedPrompt = { id: nanoid(), name: trimmed, text: value.extra }
    persist([...saved, prompt])
    setSelectedSavedId(prompt.id)
    setNaming(false)
    setName('')
  }

  function handleUpdate() {
    persist(saved.map((p) => (p.id === selectedSavedId ? { ...p, text: value.extra } : p)))
  }

  function handleDelete() {
    persist(saved.filter((p) => p.id !== selectedSavedId))
    setSelectedSavedId('')
  }

  return (
    <div className={styles.options}>
      <div className={styles.presets} role="radiogroup" aria-label="Summary preset">
        {MINCER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value.presetId === p.id}
            className={value.presetId === p.id ? styles.chipActive : styles.chip}
            onClick={() => onChange({ ...value, presetId: p.id })}
            disabled={disabled}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.disclosure}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        disabled={disabled}
      >
        {expanded ? <CaretDown size={12} aria-hidden="true" /> : <CaretRight size={12} aria-hidden="true" />}
        Additional instructions
      </button>

      {expanded && (
        <div className={styles.extra}>
          <textarea
            className={styles.textarea}
            value={value.extra}
            onChange={(e) => onChange({ ...value, extra: e.target.value })}
            placeholder="e.g. Focus on the decisions about the budget."
            rows={3}
            disabled={disabled}
          />
          <div className={styles.row}>
            <div className={styles.segmented} role="radiogroup" aria-label="How to use the instructions">
              {(['append', 'replace'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={value.mode === mode}
                  className={value.mode === mode ? styles.segmentActive : styles.segment}
                  onClick={() => onChange({ ...value, mode })}
                  disabled={disabled}
                >
                  {mode === 'append' ? 'Append' : 'Replace'}
                </button>
              ))}
            </div>
            <select
              className={styles.select}
              value={selectedSavedId}
              onChange={(e) => handlePickSaved(e.target.value)}
              aria-label="Saved instructions"
              disabled={disabled}
            >
              <option value="">— new —</option>
              {saved.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {naming ? (
            <div className={styles.row}>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNew()
                  if (e.key === 'Escape') setNaming(false)
                }}
                placeholder="Name"
                autoFocus
              />
              <button type="button" className={shared.secondary} onClick={handleSaveNew} disabled={!name.trim()}>
                Save
              </button>
              <button type="button" className={shared.ghost} onClick={() => setNaming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className={styles.row}>
              <button
                type="button"
                className={shared.secondary}
                onClick={() => setNaming(true)}
                disabled={disabled || !value.extra.trim()}
              >
                Save
              </button>
              {selectedSavedId && (
                <>
                  <button type="button" className={shared.secondary} onClick={handleUpdate} disabled={disabled}>
                    Update
                  </button>
                  <button type="button" className={shared.danger} onClick={handleDelete} disabled={disabled}>
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
