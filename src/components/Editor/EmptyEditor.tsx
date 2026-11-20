import { useRef, useState } from 'react'
import { FileText, Notebook, Plus } from '@phosphor-icons/react'
import styles from './EmptyEditor.module.css'

export interface EmptyEditorProps {
  onCreate?: () => void
  hasNotebook: boolean
  // Há cadernos do usuário (fora Calendar e Quick Notes). Sem nenhum, o
  // vazio oferece "New notebook"; com algum, aponta a lista e o Ctrl+P.
  hasNotebooks?: boolean
  onCreateNotebook?: (name: string) => void
}

// Nome do caderno novo, no lugar (sem window.prompt): Enter ou sair do campo
// cria; vazio ou Esc cancela.
function NotebookNameInput({ onCommit, onCancel }: { onCommit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const doneRef = useRef(false)
  function finish(commit: boolean) {
    if (doneRef.current) return
    doneRef.current = true
    const name = value.trim()
    if (commit && name) onCommit(name)
    else onCancel()
  }
  return (
    <input
      autoFocus
      className={styles.nameInput}
      value={value}
      placeholder="Notebook name"
      aria-label="Notebook name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
    />
  )
}

export function EmptyEditor({ onCreate, hasNotebook, hasNotebooks = true, onCreateNotebook }: EmptyEditorProps) {
  const [naming, setNaming] = useState(false)
  const firstNotebook = !hasNotebook && !hasNotebooks

  return (
    <div className={styles.empty}>
      {hasNotebook ? (
        <FileText className={styles.icon} size={64} weight="light" aria-hidden />
      ) : (
        <Notebook className={styles.icon} size={64} weight="light" aria-hidden />
      )}
      <h2 className={styles.heading}>
        {hasNotebook ? 'No note selected' : firstNotebook ? 'Create your first notebook' : 'No notebook selected'}
      </h2>
      <p className={styles.hint}>
        {hasNotebook
          ? 'Choose a note from the sidebar or create a new one.'
          : firstNotebook
            ? 'Notebooks group your notes by subject or project.'
            : 'Pick a notebook or press Ctrl+P'}
      </p>
      {hasNotebook && (
        <button className={styles.createBtn} onClick={onCreate} type="button">
          <Plus size={16} aria-hidden />
          New note
        </button>
      )}
      {firstNotebook && onCreateNotebook && (
        naming ? (
          <NotebookNameInput
            onCommit={(name) => {
              setNaming(false)
              onCreateNotebook(name)
            }}
            onCancel={() => setNaming(false)}
          />
        ) : (
          <button className={styles.createBtn} onClick={() => setNaming(true)} type="button">
            <Plus size={16} aria-hidden />
            New notebook
          </button>
        )
      )}
    </div>
  )
}
