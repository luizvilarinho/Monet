import styles from './Toolbar.module.css'

export interface ToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  onExport: () => void
  previewOpen: boolean
  onTogglePreview: () => void
  aiOpen: boolean
  onToggleAi: () => void
}

export function Toolbar({
  search,
  onSearchChange,
  onExport,
  previewOpen,
  onTogglePreview,
  aiOpen,
  onToggleAi,
}: ToolbarProps) {
  return (
    <header className={styles.toolbar}>
      <div className={styles.brandSection}>
        <span className={styles.brand}>monet</span>
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
        <button onClick={onExport}>export .md</button>
        <button onClick={onTogglePreview} aria-pressed={previewOpen}>preview</button>
        <button onClick={onToggleAi} aria-pressed={aiOpen}>IA</button>
      </div>
    </header>
  )
}
