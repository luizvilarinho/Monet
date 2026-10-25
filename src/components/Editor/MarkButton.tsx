import { useRef, useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import type { Editor } from '@tiptap/core'
import { applyNoteMark, toggleNoteMark } from './NoteMark'
import { MarkLabelPopover } from './MarkLabelPopover'
import styles from './FormattingToolbar.module.css'

interface MarkButtonProps {
  editor: Editor
  // A seleção já está marcada (estado ativo).
  active: boolean
  // Rótulos já usados, os mais usados primeiro.
  labels: string[]
}

// "Mark" da régua de seleção: o clique marca (ou desmarca) o trecho; a seta
// abre os rótulos e marca já com o escolhido. O mousedown faz
// preventDefault para não perder a seleção, como os outros botões da barra.
export function MarkButton({ editor, active, labels }: MarkButtonProps) {
  const [popover, setPopover] = useState<{ top: number; left: number; range: { from: number; to: number } } | null>(null)
  const caretRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        className={`${styles.btn} ${styles.mark} ${active ? styles.markActive : ''}`}
        title={active ? 'Remove mark (Ctrl+Shift+M)' : 'Mark for later (Ctrl+Shift+M)'}
        onMouseDown={(e) => {
          e.preventDefault()
          toggleNoteMark(editor)
        }}
        type="button"
      >
        Mark
      </button>
      <button
        ref={caretRef}
        className={`${styles.btn} ${styles.markCaret}`}
        title="Mark with a label"
        aria-label="Mark with a label"
        aria-expanded={popover !== null}
        onMouseDown={(e) => {
          e.preventDefault()
          if (popover) {
            setPopover(null)
            return
          }
          const rect = caretRef.current?.getBoundingClientRect()
          if (!rect) return
          const { from, to } = editor.state.selection
          setPopover({ top: rect.bottom + 6, left: rect.left - 40, range: { from, to } })
        }}
        type="button"
      >
        <CaretDown size={10} weight="bold" aria-hidden />
      </button>
      {popover && (
        <MarkLabelPopover
          position={popover}
          labels={labels}
          onPick={(label) => {
            const { range } = popover
            setPopover(null)
            applyNoteMark(editor, label, range)
          }}
          onClose={(reason) => {
            setPopover(null)
            if (reason === 'escape') editor.commands.focus()
          }}
        />
      )}
    </>
  )
}
