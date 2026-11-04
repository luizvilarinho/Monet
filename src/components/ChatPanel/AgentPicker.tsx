import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import {
  agentSuggestions,
  CHAT_AGENTS,
  findChatAgent,
  GENERAL_AGENT_ID,
  type ChatAgentDef,
} from '../../lib/agents/chat'
import styles from './AgentPicker.module.css'

// Seletor do agente da conversa (composer do chat principal, do Assistant e do
// chat das Anotações). O menu abre para cima.
export function AgentPicker({
  agentId,
  onSelect,
  compact = false,
}: {
  agentId: string
  onSelect: (id: string) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const current = findChatAgent(agentId)
  const CurrentIcon = current.icon

  useEffect(() => {
    if (!open) return
    // Ao abrir, o foco vai para o agente atual.
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Setas ↑/↓ (circulares), Home e End entre os itens do menu.
  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLElement)
    let next: number
    if (e.key === 'ArrowDown') next = (at + 1) % items.length
    else if (e.key === 'ArrowUp') next = at <= 0 ? items.length - 1 : at - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    items[next].focus()
  }

  const triggerClass = [
    styles.trigger,
    compact ? styles.compact : '',
    current.id !== GENERAL_AGENT_ID ? styles.triggerAgent : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        onClick={() => setOpen((v) => !v)}
        title="Agent for this conversation"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CurrentIcon size={14} />
        <span>{current.label}</span>
        <CaretDown size={10} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="Agents" ref={menuRef} onKeyDown={onMenuKeyDown}>
          {CHAT_AGENTS.map((agent) => {
            const Icon = agent.icon
            const checked = agent.id === current.id
            return (
              <button
                key={agent.id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                className={checked ? styles.itemChecked : styles.item}
                tabIndex={checked ? 0 : -1}
                onClick={() => {
                  onSelect(agent.id)
                  setOpen(false)
                }}
              >
                <span className={styles.itemIcon}>
                  <Icon size={16} />
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemLabel}>{agent.label}</span>
                  <span className={styles.itemDescription}>{agent.description}</span>
                </span>
                <span className={styles.itemCommand}>{agent.command}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Autocomplete do atalho "/agente" no início do rascunho. Completar só escreve
// o comando: o agente muda no envio.
export function useAgentShortcut(draft: string, setDraft: (v: string) => void, enabled: boolean) {
  // Rascunho em que a lista foi fechada com Escape; volta ao mudar o texto.
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null)
  const suggestions = enabled && dismissedDraft !== draft ? agentSuggestions(draft) : []
  const listKey = suggestions.map((a) => a.id).join(',')
  // Destaque válido só para a lista em que foi movido.
  const [hl, setHl] = useState({ key: '', index: 0 })
  const highlighted = hl.key === listKey ? hl.index : 0

  function pick(agent: ChatAgentDef) {
    setDraft(`${agent.command} `)
  }

  // true = tratou a tecla (o composer não segue).
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (suggestions.length === 0) return false
    const n = suggestions.length
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHl({ key: listKey, index: (highlighted + step + n) % n })
      return true
    }
    if ((e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) || e.key === 'Tab') {
      e.preventDefault()
      pick(suggestions[highlighted])
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDismissedDraft(draft)
      return true
    }
    return false
  }

  return { suggestions, highlighted, onKeyDown, pick }
}

// Lista do autocomplete, acima do campo de texto.
export function AgentSuggestions({
  items,
  highlighted,
  onPick,
}: {
  items: ChatAgentDef[]
  highlighted: number
  onPick: (agent: ChatAgentDef) => void
}) {
  if (items.length === 0) return null
  return (
    <div className={styles.suggestions} role="listbox" aria-label="Agents">
      {items.map((agent, i) => {
        const Icon = agent.icon
        return (
          <button
            key={agent.id}
            type="button"
            role="option"
            aria-selected={i === highlighted}
            className={i === highlighted ? styles.suggestionActive : styles.suggestion}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(agent)}
          >
            <Icon size={14} />
            <span className={styles.itemCommand}>{agent.command}</span>
            <span className={styles.itemDescription}>{agent.description}</span>
          </button>
        )
      })}
    </div>
  )
}
