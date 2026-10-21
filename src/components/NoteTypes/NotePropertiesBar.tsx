import type { ReactNode } from 'react'
import { FileText } from '@phosphor-icons/react'
import type { MetadataDef, MetadataValue, NoteType } from '../../types'
import { MetadataValueControl } from '../TasksView/PropertyControls'
import styles from '../TasksView/TaskPropertiesBar.module.css'

// Barra de propriedades da nota com tipo (topSlot do Editor): aparece sempre
// que a nota tem tipo, com o controle do tipo no cabeçalho e todas as
// propriedades do tipo, vazias ou não. Sem "+ Add property" avulso: a
// propriedade se cria no tipo ("Edit type", no menu do tipo).
interface NotePropertiesBarProps {
  type: NoteType
  // Controle do tipo (NoteTypePicker): rótulo + menu de troca/edição.
  typeControl: ReactNode
  // Propriedades do tipo, na ordem do tipo.
  defs: MetadataDef[]
  properties: Record<string, MetadataValue>
  onChange: (defId: string, value: MetadataValue) => void
  // Acrescenta o template ao fim da nota (nunca sobrescreve).
  onInsertTemplate: () => void
}

export function NotePropertiesBar({
  type,
  typeControl,
  defs,
  properties,
  onChange,
  onInsertTemplate,
}: NotePropertiesBarProps) {
  const color = type.color ?? 'var(--accent)'
  return (
    <div className={styles.bar} style={{ borderLeftColor: color }}>
      <div className={styles.header}>
        {typeControl}
        <span className={styles.spacer} />
        {type.template && (
          <button type="button" className={styles.link} onClick={onInsertTemplate}>
            <FileText size={13} aria-hidden />
            Insert template
          </button>
        )}
      </div>
      {defs.map((def) => (
        <div key={def.id} className={`${styles.field} ${styles.metaField}`}>
          <span className={styles.label} title={def.name}>
            {def.name}
          </span>
          <span className={styles.control}>
            <MetadataValueControl
              def={def}
              value={properties[def.id] ?? null}
              onChange={(v) => onChange(def.id, v)}
            />
          </span>
        </div>
      ))}
    </div>
  )
}
