import logoUrl from '../../assets/logo_monet_vector.svg'
import styles from './Toolbar.module.css'

export type ActiveMode = 'caderno' | 'chat'

export interface ToolbarProps {
  activeMode: ActiveMode
  onSetMode: (mode: ActiveMode) => void
  search: string
  onSearchChange: (value: string) => void
  onExport: () => void
  hasNote: boolean
  exportSuccess?: boolean
  previewOpen: boolean
  onTogglePreview: () => void
  aiOpen: boolean
  onToggleAi: () => void
  focusMode?: boolean
  onToggleFocus?: () => void
}

export function Toolbar({
  activeMode,
  onSetMode,
  search,
  onSearchChange,
  onExport,
  hasNote,
  exportSuccess,
  previewOpen,
  onTogglePreview,
  aiOpen,
  onToggleAi,
  focusMode = false,
  onToggleFocus,
}: ToolbarProps) {
  return (
    <header className={styles.toolbar}>
      <img src={logoUrl} alt="monet" className={styles.brand} onClick={() => onSetMode('caderno')} />

      {activeMode === 'caderno' && (
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
              placeholder="buscar anotações..."
            />
          </div>
          <div className={styles.noteActions}>
            <button
              type="button"
              onClick={onExport}
              disabled={!hasNote}
              className={exportSuccess ? styles.exportSuccess : styles.actionBtn}
              title="Exportar nota como .md"
            >
              {exportSuccess ? 'salvo!' : 'export .md'}
            </button>
            <button
              type="button"
              onClick={onToggleFocus}
              aria-pressed={focusMode}
              className={styles.actionBtn}
              title="Foco (Ctrl+Space)"
            >
              foco
            </button>
            <button
              type="button"
              onClick={onTogglePreview}
              aria-pressed={previewOpen}
              className={styles.actionBtn}
              title="Preview (Ctrl+\)"
            >
              preview
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

      <nav className={styles.modes} aria-label="modos do app">
        <button
          type="button"
          className={activeMode === 'caderno' ? styles.modeButtonActive : styles.modeButton}
          onClick={() => onSetMode('caderno')}
          aria-pressed={activeMode === 'caderno'}
        >
          Caderno
        </button>

        <button
          type="button"
          className={activeMode === 'chat' ? styles.modeButtonActive : styles.modeButton}
          onClick={() => onSetMode('chat')}
          aria-pressed={activeMode === 'chat'}
        >
          Chat
        </button>
      </nav>
    </header>
  )
}
