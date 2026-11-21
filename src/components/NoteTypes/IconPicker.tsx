import { useState } from 'react'
import { TYPE_ICON_GROUPS, TypeIcon } from './TypeIcon'
import styles from '../TasksView/StatusManagerModal.module.css'
import own from './NoteTypesModal.module.css'

// Seletor de ícone: busca + grade agrupada com rolagem própria. Usado no modal
// de tipos de nota e no de trackers.
export function IconPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (name: string) => void
  label: string
}) {
  const [iconQuery, setIconQuery] = useState('')

  // Busca de ícone: pelo nome (espaço vale como "-") ou pelo nome do grupo.
  const query = iconQuery.trim().toLowerCase()
  const iconGroups = TYPE_ICON_GROUPS.map((g) => ({
    label: g.label,
    names: Object.keys(g.icons).filter(
      (name) => !query || g.label.toLowerCase().includes(query) || name.includes(query.replace(/\s+/g, '-'))
    ),
  })).filter((g) => g.names.length > 0)

  return (
    <div className={own.iconPicker}>
      <input
        className={styles.nameInput}
        value={iconQuery}
        onChange={(e) => setIconQuery(e.target.value)}
        placeholder="Search icons"
        aria-label="search icons"
      />
      <div className={own.icons} role="radiogroup" aria-label={label}>
        {iconGroups.map((g) => (
          <div key={g.label} className={own.iconGroup}>
            <span className={own.iconGroupLabel}>{g.label}</span>
            {g.names.map((name) => {
              const active = value === name
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={name}
                  title={name}
                  className={`${own.iconButton} ${active ? own.iconActive : ''}`}
                  onClick={() => onChange(name)}
                >
                  <TypeIcon name={name} size={14} />
                </button>
              )
            })}
          </div>
        ))}
        {iconGroups.length === 0 && <p className={own.empty}>No icons match.</p>}
      </div>
    </div>
  )
}
