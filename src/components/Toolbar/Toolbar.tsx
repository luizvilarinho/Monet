import styles from './Toolbar.module.css'

export interface ToolbarProps {
  title: string
  onTitleChange: (title: string) => void
  onExport: () => void
  previewOpen: boolean
  onTogglePreview: () => void
  aiOpen: boolean
  onToggleAi: () => void
}

export function Toolbar({
  title,
  onTitleChange,
  onExport,
  previewOpen,
  onTogglePreview,
  aiOpen,
  onToggleAi,
}: ToolbarProps) {
  return (
    <header className={styles.toolbar}>
      <span className={styles.brand}>monet</span>
      <input
        className={styles.title}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="título da nota"
      />
      <button onClick={onExport}>export .md</button>
      <button onClick={onTogglePreview} aria-pressed={previewOpen}>preview</button>
      <button onClick={onToggleAi} aria-pressed={aiOpen}>ai</button>
    </header>
  )
}
