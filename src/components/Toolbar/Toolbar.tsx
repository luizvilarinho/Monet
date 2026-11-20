import { useEffect, useState } from 'react'
import { CircleNotch, MagnifyingGlass, SidebarSimple } from '@phosphor-icons/react'
import logoUrl from '../../assets/logo_monet_vector.svg'
import { formatElapsed } from '../../lib/mincer'
import styles from './Toolbar.module.css'

export type ActiveMode = 'notebook' | 'chat' | 'library' | 'mincer'

export interface ToolbarProps {
  activeMode: ActiveMode
  onSetMode: (mode: ActiveMode) => void
  search: string
  onSearchChange: (value: string) => void
  // Busca em todos os cadernos (Ctrl+P); o campo da Toolbar só filtra a lista.
  onOpenSearch: () => void
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
  // Itens interrompidos ou recuperados ainda não abertos (só o title).
  mincerAttention?: number
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
  onOpenSearch,
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
  mincerAttention = 0,
}: ToolbarProps) {
  const mincerRecording = mincerRecordingStartedAt !== null
  const mincerAttentionText =
    mincerAttention > 0
      ? `${mincerAttention} item${mincerAttention === 1 ? ' needs' : 's need'} your attention`
      : null
  const mincerTitle = mincerRecording
    ? 'Mincer is recording'
    : mincerBusy
      ? `Mincer is working${mincerAttentionText ? ` · ${mincerAttentionText}` : ''}`
      : mincerAttentionText
        ? `Mincer: ${mincerAttentionText}`
        : mincerUnseen
          ? 'Mincer has new results'
          : undefined
  return (
    <header className={styles.toolbar}>
      <img src={logoUrl} alt="Monet" className={styles.brand} onClick={() => onSetMode('notebook')} />

      {activeMode === 'notebook' && (
        <div className={styles.noteBar}>
          <div className={styles.searchWrap}>
            <MagnifyingGlass size={14} className={styles.searchIcon} aria-hidden />
            <input
              className={styles.search}
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter this list…"
              aria-label="Filter the notes in this list"
              title="Filters the notes in the current list. To search every notebook, use Search everything (Ctrl+P)."
            />
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            className={`${styles.actionBtn} ${styles.searchAllBtn}`}
            title="Search every notebook, tags and marks (Ctrl+P)"
          >
            <MagnifyingGlass size={13} aria-hidden />
            Search everything
            <kbd className={styles.kbd}>Ctrl+P</kbd>
          </button>
          <div className={styles.noteActions}>
            <button
              type="button"
              onClick={onExport}
              disabled={!hasNote}
              className={exportSuccess ? styles.exportSuccess : styles.actionBtn}
              title="Export note as .md"
            >
              {exportSuccess ? 'Saved' : 'Export .md'}
            </button>
            <button
              type="button"
              onClick={onTogglePreview}
              disabled={!hasNote}
              aria-pressed={previewMode}
              className={styles.actionBtn}
              title="Preview (hide slash commands)"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={onToggleFocus}
              aria-pressed={focusMode}
              className={styles.actionBtn}
              title="Focus (Ctrl+Space)"
            >
              Focus
            </button>
            <button
              type="button"
              onClick={onToggleAi}
              aria-pressed={aiOpen}
              className={`${styles.actionBtn} ${styles.iconLabelBtn}`}
              title="Show or hide the side panel (AI, Chat, Open)"
            >
              <SidebarSimple size={13} mirrored aria-hidden />
              Panel
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
