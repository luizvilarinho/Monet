import type { ReactNode } from 'react'
import { ArrowsLeftRight, X } from '@phosphor-icons/react'
import styles from './OpenNotes.module.css'

interface SideNotePanelProps {
  onClose: () => void
  onSwap: () => void
  // O editor da nota lateral.
  children: ReactNode
}

// Nota lateral da aba Open: a segunda nota aberta, editável ao lado da
// principal. `data-side-note` marca o editor que não é o principal (atalhos
// sem foco em nenhum editor ficam com o principal).
export function SideNotePanel({ onClose, onSwap, children }: SideNotePanelProps) {
  return (
    <div className={styles.panel} data-side-note>
      <div className={styles.sideHeader}>
        <button
          type="button"
          className={styles.textButton}
          onClick={onSwap}
          title="This note goes to the main area and the main note comes here"
        >
          <ArrowsLeftRight size={14} />
          Swap with main
        </button>
        <button
          type="button"
          className={styles.textButton}
          onClick={onClose}
          title="Close the side note and show today's open notes"
        >
          <X size={14} />
          Close
        </button>
      </div>
      <div className={styles.sideEditor}>{children}</div>
    </div>
  )
}
