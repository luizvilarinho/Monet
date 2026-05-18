import styles from './EmptyEditor.module.css'

export interface EmptyEditorProps {
  onCreate?: () => void
  hasNotebook: boolean
}

export function EmptyEditor({ onCreate, hasNotebook }: EmptyEditorProps) {
  return (
    <div className={styles.empty}>
      <svg
        className={styles.icon}
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {hasNotebook ? (
          // Documento / página
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
            <line x1="12" y1="14" x2="12.01" y2="14" />
            <line x1="8" y1="14" x2="8.01" y2="14" />
            <line x1="8" y1="18" x2="8.01" y2="18" />
          </>
        ) : (
          // Notebooks / folders
          <>
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" />
            <path d="M2 8h20" opacity="0.5" />
          </>
        )}
      </svg>
      <h2 className={styles.heading}>
        {hasNotebook ? 'No note selected' : 'Select a notebook to get started'}
      </h2>
      <p className={styles.hint}>
        {hasNotebook
          ? 'Choose a note from the sidebar or create a new one.'
          : 'Choose a notebook from the sidebar or create a new one.'}
      </p>
      {hasNotebook && (
        <button className={styles.createBtn} onClick={onCreate} type="button">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New note
        </button>
      )}
    </div>
  )
}
