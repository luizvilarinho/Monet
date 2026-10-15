import { TASK_COLOR_PALETTE } from '../../lib/tasks'
import styles from './ColorDots.module.css'

// Seletor de cor da paleta fixa (status e projetos). `value` null = neutra.
interface ColorDotsProps {
  value: string | null
  onChange: (color: string | null) => void
  label: string
  // Permite voltar à cor neutra (projetos; status built-in sempre tem padrão).
  allowNone?: boolean
}

export function ColorDots({ value, onChange, label, allowNone = false }: ColorDotsProps) {
  return (
    <span className={styles.dots} role="radiogroup" aria-label={label}>
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          className={`${styles.dot} ${styles.none} ${value === null ? styles.active : ''}`}
          onClick={() => onChange(null)}
          title="No color"
        />
      )}
      {TASK_COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          className={`${styles.dot} ${value === color ? styles.active : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </span>
  )
}
