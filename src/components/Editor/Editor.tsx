import styles from './Editor.module.css'

export interface EditorProps {
  value: string
  onChange: (value: string) => void
  onCommand?: (cmd: string, query: string) => void
}

export function Editor({ value, onChange }: EditorProps) {
  return (
    <div className={styles.editor}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Anote a impressão do momento..."
        spellCheck={false}
      />
    </div>
  )
}
