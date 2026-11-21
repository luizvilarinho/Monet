import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { COMMANDS } from '../../lib/commands'
import { findAgent } from '../../lib/agents'
import { commandGroup } from './commandParser'
import { useAnchoredPosition } from './anchoredPosition'
import styles from './CommandAutocomplete.module.css'

export interface AutocompleteState {
  visible: boolean
  filter: string
  suggestions: string[]
  selectedIdx: number
  top: number
  left: number
  // Topo da linha do cursor: a lista vira para cima quando não cabe embaixo.
  lineTop?: number
}

interface Props {
  state: AutocompleteState
  onSelect: (cmd: string) => void
  onHover: (idx: number) => void
}

// Lista do "/" agrupada (Understand, Review…), com o exemplo do comando
// destacado e o selo "web" nos que buscam na web.
export function CommandAutocomplete({ state, onSelect, onHover }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const pos = useAnchoredPosition(ref, state)

  useEffect(() => {
    if (!state.visible) return
    const item = listRef.current?.querySelector(`[data-idx="${state.selectedIdx}"]`)
    if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' })
  }, [state.visible, state.selectedIdx])

  if (!state.visible || state.suggestions.length === 0) return null

  let lastGroup = ''
  return createPortal(
    <div
      ref={ref}
      className={styles.popover}
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
      role="listbox"
    >
      <div ref={listRef} className={styles.list}>
        {state.suggestions.map((name, idx) => {
          const def = COMMANDS.find((c) => c.name === name)
          const selected = idx === state.selectedIdx
          const group = commandGroup(name)
          const header = group !== lastGroup ? group : null
          lastGroup = group
          // `required` e `since` não rodam sem a chave do Tavily; `withQuery` usa
          // a web quando há query e chave.
          const webPolicy = findAgent(name)?.context.web ?? 'none'
          const web = webPolicy !== 'none'
          return (
            <div key={name} role="presentation">
              {header && <div className={styles.group} role="presentation">{header}</div>}
              <div
                data-idx={idx}
                className={`${styles.item} ${selected ? styles.selected : ''}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => onHover(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(name)
                }}
              >
                <span className={styles.head}>
                  <span className={styles.name}>{name}</span>
                  {web && (
                    <span
                      className={styles.badge}
                      title={
                        webPolicy === 'required'
                          ? 'Searches the web (needs a Tavily key)'
                          : webPolicy === 'since'
                            ? "Searches the web from the note's date (needs a Tavily key)"
                            : 'Uses the web when you add a query and have a Tavily key'
                      }
                    >
                      web
                    </span>
                  )}
                </span>
                {def && <span className={styles.desc}>{def.description}</span>}
                {selected && def?.takesQuery && def.example && (
                  <span className={styles.example}>e.g. {def.example}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}
