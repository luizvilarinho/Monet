import type { NoteType } from '../../types'
import { TypeIcon } from './TypeIcon'
import styles from './TypeEyebrow.module.css'

// Tipo da nota nas listas (Ctrl+P, Related content, Marks): ícone + nome em
// caixa alta, na cor do tipo (sem cor, a do texto discreto; sem ícone, o
// padrão do TypeIcon).
export function TypeEyebrow({ type }: { type: NoteType }) {
  return (
    <span className={styles.eyebrow} style={{ color: type.color ?? undefined }} title={type.name}>
      <TypeIcon name={type.icon} size={11} />
      <span className={styles.name}>{type.name}</span>
    </span>
  )
}
