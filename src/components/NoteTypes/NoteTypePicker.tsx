import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { CaretDown, Check, Plus } from '@phosphor-icons/react'
import type { NoteType } from '../../types'
import { TypeIcon } from './TypeIcon'
import styles from './NoteTypePicker.module.css'

// Controle do tipo da nota. Com tipo, é o rótulo da barra de propriedades
// (ícone + nome + ▾ na cor do tipo); sem tipo, o "+ type" discreto da linha de
// data/tags. O menu lista os tipos (o atual marcado) e, com tipo, "Remove
// type", "Edit type" e "Open board" (tipo com board); sempre "Manage types…".
// Arquivar fica no botão "Archive" do editor e no selo "Archived". Abre com o
// foco no tipo atual (ou no 1º item); setas, Home e End navegam. Fecha com Esc
// (o foco volta ao botão) ou clique fora.
interface NoteTypePickerProps {
  types: NoteType[]
  // Tipo atual (id órfão, de tipo apagado em outra janela, chega como null).
  type: NoteType | null
  onChange: (typeId: string | null) => void
  // Modal geral (opcional: sem ele, o item "Manage types…" não aparece).
  onManage?: () => void
  // Modal focado no tipo atual (só com tipo).
  onEditType?: () => void
  // Board do tipo atual (só quando o tipo tem board ligado).
  onOpenBoard?: () => void
}

export function NoteTypePicker({
  types,
  type,
  onChange,
  onManage,
  onEditType,
  onOpenBoard,
}: NoteTypePickerProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const first = menu?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu?.querySelector<HTMLElement>('button')
    first?.focus()
    function handleMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    // Captura: o Esc não chega ao editor nem a outros atalhos.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  function pick(typeId: string | null) {
    setOpen(false)
    if (typeId !== (type?.id ?? null)) onChange(typeId)
  }

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  function handleMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button'))
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next =
      e.key === 'ArrowDown' ? (i + 1) % items.length
      : e.key === 'ArrowUp' ? (i <= 0 ? items.length - 1 : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
      : -1
    if (next < 0) return
    e.preventDefault()
    items[next].focus()
  }

  return (
    <span ref={wrapRef} className={styles.wrap}>
      <button
        ref={triggerRef}
        type="button"
        className={type ? styles.trigger : styles.add}
        style={type?.color ? ({ '--type-color': type.color } as CSSProperties) : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Note type"
      >
        {type ? <TypeIcon name={type.icon} size={14} /> : <Plus size={12} aria-hidden />}
        <span>{type ? type.name : 'type'}</span>
        {type && <CaretDown size={10} weight="bold" aria-hidden />}
      </button>
      {open && (
        <div ref={menuRef} className={styles.menu} role="menu" onKeyDown={handleMenuKeyDown}>
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === type?.id}
              className={styles.item}
              style={t.color ? ({ '--type-color': t.color } as CSSProperties) : undefined}
              onClick={() => pick(t.id)}
            >
              <span className={styles.itemIcon}>
                <TypeIcon name={t.icon} size={13} />
              </span>
              <span className={styles.itemName}>{t.name}</span>
              {t.id === type?.id && <Check size={12} aria-hidden />}
            </button>
          ))}
          <div className={styles.sep} role="separator" />
          {type && (
            <button type="button" role="menuitem" className={styles.item} onClick={() => pick(null)}>
              <span className={styles.itemName}>Remove type</span>
            </button>
          )}
          {type && onEditType && (
            <button type="button" role="menuitem" className={styles.item} onClick={() => run(onEditType)}>
              <span className={styles.itemName}>Edit type…</span>
            </button>
          )}
          {type && onOpenBoard && (
            <button type="button" role="menuitem" className={styles.item} onClick={() => run(onOpenBoard)}>
              <span className={styles.itemName}>Open board</span>
            </button>
          )}
          {onManage && (
            <button type="button" role="menuitem" className={styles.item} onClick={() => run(onManage)}>
              <span className={styles.itemName}>Manage types…</span>
            </button>
          )}
        </div>
      )}
    </span>
  )
}
