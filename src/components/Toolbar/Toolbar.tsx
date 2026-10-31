import { useEffect, useState } from 'react'
import { CircleNotch } from '@phosphor-icons/react'
import logoUrl from '../../assets/logo_monet_vector.svg'
import { formatElapsed } from '../../lib/mincer'
import styles from './Toolbar.module.css'

export type ActiveMode = 'notebook' | 'chat' | 'library' | 'mincer'

export interface ToolbarProps {
  activeMode: ActiveMode
  onSetMode: (mode: ActiveMode) => void
  search: string
  onSearchChange: (value: string) => void
  onExport: () => void
  hasNote: boolean
  exportSuccess?: boolean
  aiOpen: boolean
  onToggleAi: () => void
  focusMode?: boolean
  onToggleFocus?: () => void
  previewMode?: boolean
  onTogglePreview?: () => void
  mincerBusy?: boolean
  // Gravação em curso no Mincer (início em ms), ou null.
  mincerRecordingStartedAt?: number | null
  mincerUnseen?: boolean
}

// O relógio re-renderiza só este pedaço, não a Toolbar nem o App.
function RecordingClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return <span className={styles.modeClock}>{formatElapsed(now - startedAt)}</span>
}

export function Toolbar({
  activeMode,
  onSetMode,
  search,
  onSearchChange,
  onExport,
  hasNote,
  exportSuccess,
  aiOpen,
  onToggleAi,
  focusMode = false,
  onToggleFocus,
  previewMode = false,
  onTogglePreview,
  mincerBusy = false,
  mincerRecordingStartedAt = null,
  mincerUnseen = false,
}: ToolbarProps) {
  const mincerRecording = mincerRecordingStartedAt !== null
  const mincerTitle = mincerRecording
    ? 'Mincer is recording'
    : mincerBusy
      ? 'Mincer is working'
      : mincerUnseen
        ? 'Mincer has new results'
        : undefined
  return (
    <header className={styles.toolbar}>
      <img src={logoUrl} alt="Monet" className={styles.brand} onClick={() => onSetMode('notebook')} />

      {activeMode === 'notebook' && (
        <div className={styles.noteBar}>
          <div className={styles.searchWrap}>
            <svg
              className={styles.searchIcon}
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={styles.search}
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="search notes..."
            />
          </div>
          <div className={styles.noteActions}>
            <button
              type="button"
              onClick={onExport}
              disabled={!hasNote}
              className={exportSuccess ? styles.exportSuccess : styles.actionBtn}
              title="Export note as .md"
            >
              {exportSuccess ? 'saved!' : 'export .md'}
            </button>
            <button
              type="button"
              onClick={onTogglePreview}
              disabled={!hasNote}
              aria-pressed={previewMode}
              className={styles.actionBtn}
              title="Preview (hide slash commands)"
            >
              preview
            </button>
            <button
              type="button"
              onClick={onToggleFocus}
              aria-pressed={focusMode}
              className={styles.actionBtn}
              title="Focus (Ctrl+Space)"
            >
              focus
            </button>
            <button
              type="button"
              onClick={onToggleAi}
              aria-pressed={aiOpen}
              className={styles.actionBtn}
            >
              IA
            </button>
          </div>
        </div>
      )}

      <nav className={styles.modes} aria-label="app modes">
        <button
          type="button"
          className={activeMode === 'notebook' ? styles.modeButtonActive : styles.modeButton}
          onClick={() => onSetMode('notebook')}
          aria-pressed={activeMode === 'notebook'}
        >
          Notebook
        </button>

        <button
          type="button"
          className={activeMode === 'chat' ? styles.modeButtonActive : styles.modeButton}
          onClick={() => onSetMode('chat')}
          aria-pressed={activeMode === 'chat'}
        >
          Chat
        </button>

        <button
          type="button"
          className={activeMode === 'library' ? styles.modeButtonActive : styles.modeButton}
          onClick={() => onSetMode('library')}
          aria-pressed={activeMode === 'library'}
        >
          Library
        </button>

        <button
          type="button"
          className={activeMode === 'mincer' ? styles.modeButtonActive : styles.modeButton}
          onClick={() => onSetMode('mincer')}
          aria-pressed={activeMode === 'mincer'}
          title={mincerTitle}
          aria-label={mincerTitle}
        >
          Mincer
          {mincerRecording ? (
            <span className={styles.modeRecording} aria-hidden="true">
              <span className={styles.modeRecordDot} />
              <RecordingClock startedAt={mincerRecordingStartedAt} />
            </span>
          ) : (
            mincerBusy && <CircleNotch size={12} className={styles.modeSpinner} aria-hidden="true" />
          )}
          {mincerUnseen && !mincerRecording && <span className={styles.modeNewDot} aria-hidden="true" />}
        </button>
      </nav>
    </header>
  )
}
