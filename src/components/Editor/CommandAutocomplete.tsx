import { useEffect, useRef } from 'react'
import { COMMANDS } from '../../lib/commands'
import styles from './CommandAutocomplete.module.css'

export interface AutocompleteState {
  visible: boolean
  filter: string
  suggestions: string[]
  selectedIdx: number
  top: number
  left: number
}

interface Props {
  state: AutocompleteState
  onSelect: (cmd: string) => void
  onHover: (idx: number) => void
}

export function CommandAutocomplete({ state, onSelect, onHover }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!state.visible) return
    const list = listRef.current
    if (!list) return
    const item = list.children[state.selectedIdx] as HTMLElement | undefined
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [state.visible, state.selectedIdx])

  if (!state.visible || state.suggestions.length === 0) return null

  return (
    <div
      className={styles.popover}
      style={{ top: state.top, left: state.left }}
      onMouseDown={(e) => e.preventDefault()}
      role="listbox"
    >
      <div ref={listRef} className={styles.list}>
        {state.suggestions.map((name, idx) => {
          const def = COMMANDS.find((c) => c.name === name)
          const selected = idx === state.selectedIdx
          return (
            <div
              key={name}
              className={`${styles.item} ${selected ? styles.selected : ''}`}
              role="option"
              aria-selected={selected}
              onMouseEnter={() => onHover(idx)}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(name)
              }}
            >
              <span className={styles.name}>{name}</span>
              {def && <span className={styles.desc}>{def.description}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
