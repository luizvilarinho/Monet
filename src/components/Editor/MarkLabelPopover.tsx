import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from '@phosphor-icons/react'
import { markLabelKey, normalizeMarkLabel } from '../../lib/noteMarks'
import styles from './MarkLabelPopover.module.css'

interface MarkLabelPopoverProps {
  // Canto superior esquerdo (fixed), abaixo do botão que abriu.
  position: { top: number; left: number }
  // Rótulos já usados, os mais usados primeiro.
  labels: string[]
  // Rótulo atual da marca (null = sem rótulo); undefined = marca nova.
  current?: string | null
  onPick: (label: string | null) => void
  // `escape`: o foco volta para quem abriu; `outside`: o clique já foi para
  // outro lugar.
  onClose: (reason: 'escape' | 'outside') => void
}

const MAX_SUGGESTIONS = 8
const WIDTH = 220

type Option = { kind: 'none' } | { kind: 'label'; label: string } | { kind: 'create'; label: string }

// Rótulo da marca: digitar filtra os já usados (sem caixa nem acento) e Enter
// escolhe o destacado — ou cria o digitado. Por portal no body (acima do
// modal da task) e fora do BubbleMenu: o foco no input tira o foco do editor,
// e a barra que abriu a popover some sem levá-la junto.
export function MarkLabelPopover({ position, labels, current, onPick, onClose }: MarkLabelPopoverProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const options = useMemo<Option[]>(() => {
    const typed = normalizeMarkLabel(query)
    const key = typed ? markLabelKey(typed) : ''
    const matches = labels.filter((l) => !key || markLabelKey(l).includes(key)).slice(0, MAX_SUGGESTIONS)
    const exact = typed !== null && labels.some((l) => markLabelKey(l) === key)
    // Os já usados primeiro: Enter completa ("revi" → "Revisar"); o rótulo novo
    // com o texto digitado fica no fim da lista.
    const list: Option[] = matches.map((label) => ({ kind: 'label', label }))
    if (typed && !exact) list.push({ kind: 'create', label: typed })
    if (!typed && current !== undefined) list.unshift({ kind: 'none' })
    return list
  }, [query, labels, current])

  useEffect(() => {
    setActive(0)
  }, [query])

  // Clique fora fecha. Registro adiado: a popover abre no mousedown do botão.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      onCloseRef.current('outside')
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler, true), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler, true)
    }
  }, [])

  function choose(option: Option | undefined) {
    if (!option) {
      const typed = normalizeMarkLabel(query)
      if (typed) onPick(typed)
      return
    }
    onPick(option.kind === 'none' ? null : option.label)
  }

  const left = Math.max(8, Math.min(position.left, window.innerWidth - WIDTH - 8))
  const currentKey = current ? markLabelKey(current) : null

  return createPortal(
    <div
      ref={rootRef}
      className={styles.popover}
      style={{ top: position.top, left, width: WIDTH }}
      role="dialog"
      aria-label="Mark label"
    >
      <input
        className={styles.input}
        autoFocus
        value={query}
        placeholder="Label (e.g. Research)"
        maxLength={40}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, options.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(options[active])
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose('escape')
          }
        }}
      />
      {options.length > 0 && (
        <ul className={styles.list} role="listbox">
          {options.map((option, i) => {
            const isCurrent =
              option.kind === 'none'
                ? current === null
                : option.kind === 'label' && currentKey !== null && markLabelKey(option.label) === currentKey
            return (
              <li
                key={option.kind === 'none' ? '\u0000none' : `${option.kind}:${option.label}`}
                role="option"
                aria-selected={i === active}
                className={`${styles.option} ${i === active ? styles.optionActive : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(option)
                }}
              >
                <span className={styles.check}>{isCurrent && <Check size={12} aria-hidden />}</span>
                {option.kind === 'none' ? (
                  <span className={styles.none}>No label</span>
                ) : option.kind === 'create' ? (
                  <span>
                    New label <span className={styles.label}>{option.label}</span>
                  </span>
                ) : (
                  <span className={styles.label}>{option.label}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>,
    document.body
  )
}
