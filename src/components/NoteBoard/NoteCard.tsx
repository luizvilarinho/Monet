import { ArrowSquareOut, CheckSquare, Square } from '@phosphor-icons/react'
import { formatMetadataValue, hasMetadataValue } from '../../lib/metadata'
import type { MetadataDef, Note, NoteType } from '../../types'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import styles from './NoteCard.module.css'

// Card de nota do board por tipo: tipo (+ caderno quando o board mostra todos),
// título, até 3 campos com valor e as tags. Clique/Enter abre a nota num modal
// sobre o board; o botão leva ao caderno.
interface NoteCardProps {
  note: Note
  type: NoteType
  fields: MetadataDef[]
  showTags: boolean
  // Só com o filtro "All notebooks".
  notebookName?: string
  onOpen: () => void
  onOpenInNotebook: () => void
}

export function NoteCard({ note, type, fields, showTags, notebookName, onOpen, onOpenInNotebook }: NoteCardProps) {
  const values = fields.flatMap((def) => {
    const value = note.properties?.[def.id]
    return value === undefined || !hasMetadataValue(value) ? [] : [{ def, value }]
  })

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className={styles.top}>
        <span className={styles.type} style={{ color: type.color ?? undefined }}>
          <TypeIcon name={type.icon} size={12} />
        </span>
        {notebookName !== undefined && (
          <span className={styles.notebook} title={notebookName}>
            {notebookName}
          </span>
        )}
        <button
          type="button"
          className={styles.open}
          aria-label="Open in notebook"
          title="Open in notebook"
          onClick={(e) => {
            e.stopPropagation()
            onOpenInNotebook()
          }}
        >
          <ArrowSquareOut size={13} aria-hidden />
        </button>
      </div>
      <span className={styles.title}>{note.title.trim() || 'Untitled'}</span>
      {values.length > 0 && (
        <div className={styles.fields}>
          {values.map(({ def, value }) => {
            if (def.type === 'select') {
              const option = def.options?.find((o) => o.id === value)
              if (!option) return null
              return (
                <span key={def.id} className={styles.field} title={def.name}>
                  <span
                    className={styles.dot}
                    style={{ background: option.color ?? 'var(--text-muted)' }}
                    aria-hidden
                  />
                  <span className={styles.ellipsis}>{option.name}</span>
                </span>
              )
            }
            if (def.type === 'checkbox') {
              return (
                <span key={def.id} className={styles.field}>
                  {value === true ? <CheckSquare size={12} aria-hidden /> : <Square size={12} aria-hidden />}
                  <span className={styles.ellipsis}>{def.name}</span>
                </span>
              )
            }
            return (
              <span key={def.id} className={styles.field}>
                <span className={styles.fieldName}>{def.name}</span>
                <span className={styles.ellipsis}>{formatMetadataValue(def, value)}</span>
              </span>
            )
          })}
        </div>
      )}
      {showTags && note.tags.length > 0 && (
        <div className={styles.tags}>
          {note.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}
