import { CALENDAR_NOTEBOOK_ID } from '../../lib/calendar'
import type { ProjectChoice } from '../../lib/tasks'
import type { Notebook } from '../../types'
import styles from './ProjectPicker.module.css'

interface ProjectPickerProps {
  notebooks: Notebook[]
  value: ProjectChoice
  onChange: (value: ProjectChoice) => void
}

const NEW_NOTEBOOK = '__new__'

// Seletor de projeto (= caderno). Controlado: "+ New notebook…" troca o select
// por um input de nome; quem usa decide quando confirmar (Enter/botão) e
// quando cancelar (Esc). O Calendar nunca é projeto.
export function ProjectPicker({ notebooks, value, onChange }: ProjectPickerProps) {
  if ('newName' in value) {
    return (
      <input
        autoFocus
        className={styles.control}
        value={value.newName}
        onChange={(e) => onChange({ newName: e.target.value })}
        placeholder="New notebook name"
        aria-label="new notebook name"
      />
    )
  }
  return (
    <select
      className={styles.control}
      value={value.notebookId}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === NEW_NOTEBOOK ? { newName: '' } : { notebookId: v })
      }}
      aria-label="project"
    >
      {notebooks
        .filter((nb) => nb.id !== CALENDAR_NOTEBOOK_ID)
        .map((nb) => (
          <option key={nb.id} value={nb.id}>
            {nb.name || 'unnamed'}
          </option>
        ))}
      <option value={NEW_NOTEBOOK}>+ New notebook…</option>
    </select>
  )
}
