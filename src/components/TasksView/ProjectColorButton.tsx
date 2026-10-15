import { useState } from 'react'
import { ColorDots } from './ColorDots'
import styles from './ProjectColorButton.module.css'

// Cor do projeto no cabeçalho da coluna: a bolinha abre a paleta fixa.
interface ProjectColorButtonProps {
  color: string | null
  projectName: string
  onChange: (color: string | null) => void
}

export function ProjectColorButton({ color, projectName, onChange }: ProjectColorButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={styles.wrap}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        type="button"
        className={`${styles.swatch} ${color ? '' : styles.swatchNone}`}
        style={color ? { background: color } : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label={`color of ${projectName}`}
        aria-expanded={open}
        title="Project color"
      />
      {open && (
        <span className={styles.popover}>
          <ColorDots
            value={color}
            onChange={(c) => {
              onChange(c)
              setOpen(false)
            }}
            label={`${projectName} color`}
            allowNone
          />
        </span>
      )}
    </span>
  )
}
