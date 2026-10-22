import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { HighlighterCircle } from '@phosphor-icons/react'
import type { Editor } from '@tiptap/core'
import { HIGHLIGHT_COLORS, highlightByHex } from '../../lib/highlight'
import { toggleHighlight } from './formattingActions'
import styles from './HighlightPicker.module.css'

interface HighlightPickerProps {
  editor: Editor
  /** Classe CSS do botão (vem da barra flutuante ou do menu de contexto). */
  className?: string
  /** Classe CSS do botão quando há destaque ativo na seleção. */
  activeClassName?: string
  title?: string
  /** Chamado antes de aplicar a cor — no menu de contexto, cria a linha nova. */
  prepare?: (editor: Editor) => void
  /** Chamado depois de aplicar a cor — o menu de contexto fecha depois disso. */
  onPick?: () => void
}

// Botão de destaque (R1) + popover com as amostras de cor.
//
// A popover é renderizada por portal no `document.body` e posicionada em
// `fixed`: assim ela não fica presa dentro da barra flutuante (que o
// Floating UI move com `transform`) e continua clicável por cima do menu de
// contexto.
//
// O `mousedown` dos botões faz `preventDefault()` para não perder a seleção
// (o mesmo cuidado dos outros botões do editor) — por isso a cor é aplicada
// no `mousedown` e não no `click`.
export function HighlightPicker({
  editor,
  className,
  activeClassName,
  title = 'Highlight',
  prepare,
  onPick,
}: HighlightPickerProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const attrs = editor.getAttributes('highlight')
  const activeColor = editor.isActive('highlight') ? highlightByHex(attrs.color) : null

  function togglePopover() {
    if (open) {
      setOpen(false)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 5 * 20 + 4 * 6 + 12 // 5 amostras + folgas + padding
    setPos({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    })
    setOpen(true)
  }

  // Clique fora fecha a popover. O registro é adiado: a popover abre no
  // mousedown do botão e, registrado na hora, o próprio clique de abertura
  // contaria como "clique fora".
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [open])

  // Esc fecha a popover (sem interferir no atalho de desfazer do editor).
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open])

  function pick(colorId: string) {
    prepare?.(editor)
    toggleHighlight(editor, colorId)
    setOpen(false)
    onPick?.()
  }

  return (
    <>
      <button
        ref={buttonRef}
        className={[className ?? '', activeColor ? (activeClassName ?? '') : ''].join(' ').trim()}
        title={activeColor ? `${title} (${activeColor.name})` : title}
        aria-label={activeColor ? `${title} (${activeColor.name})` : title}
        aria-expanded={open}
        onMouseDown={(e) => {
          e.preventDefault()
          togglePopover()
        }}
        type="button"
      >
        <HighlighterCircle size={15} aria-hidden="true" />
        {activeColor && (
          <span
            className={styles.dot}
            style={{ '--hl': activeColor.hex } as CSSProperties}
            aria-hidden="true"
          />
        )}
      </button>
      {open &&
        pos &&
        createPortal(
          <div ref={popoverRef} className={styles.popover} style={{ top: pos.top, left: pos.left }}>
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id}
                className={[styles.swatch, activeColor?.id === color.id ? styles.current : ''].join(' ')}
                // A amostra mostra a tinta como ela fica no texto (App.css).
                style={{ '--hl': color.hex } as CSSProperties}
                title={color.name}
                aria-label={color.name}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(color.id)
                }}
                type="button"
              />
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
