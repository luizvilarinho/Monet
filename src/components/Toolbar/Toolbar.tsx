import logoUrl from '../../assets/logo_monet_vector.svg'
import styles from './Toolbar.module.css'

export interface ToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  onExport: () => void
  hasNote: boolean
  exportSuccess?: boolean
  previewOpen: boolean
  onTogglePreview: () => void
  aiOpen: boolean
  onToggleAi: () => void
  notebookWidth?: number
  sidebarWidth?: number
  focusMode?: boolean
  onToggleFocus?: () => void
}

export function Toolbar({
  search,
  onSearchChange,
  onExport,
  hasNote,
  exportSuccess,
  previewOpen,
  onTogglePreview,
  aiOpen,
  onToggleAi,
  notebookWidth = 180,
  sidebarWidth = 220,
  focusMode = false,
  onToggleFocus,
}: ToolbarProps) {
  return (
    <header className={styles.toolbar}>
      <div
        className={styles.brandSection}
        style={{ width: focusMode ? 0 : notebookWidth + sidebarWidth }}
      >
        <img src={logoUrl} alt="monet" className={styles.brand} />
      </div>
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
      <div className={styles.actions}>
        <button
          onClick={onExport}
          disabled={!hasNote}
          className={exportSuccess ? styles.exportSuccess : undefined}
          title="Exportar nota como .md"
        >
          {exportSuccess ? 'salvo!' : 'export .md'}
        </button>
        <button onClick={onToggleFocus} aria-pressed={focusMode} title="Foco (Ctrl+Space)">foco</button>
        <button onClick={onTogglePreview} aria-pressed={previewOpen} title="Preview (Ctrl+\)">preview</button>
        <button onClick={onToggleAi} aria-pressed={aiOpen}>IA</button>
      </div>
    </header>
  )
}
