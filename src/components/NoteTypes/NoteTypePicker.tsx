import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CaretDown, Check, Plus } from '@phosphor-icons/react'
import type { NoteType } from '../../types'
import { TypeIcon } from './TypeIcon'
import styles from './NoteTypePicker.module.css'

// Controle do tipo da nota. Com tipo, é o rótulo da barra de propriedades
// (ícone + nome + ▾ na cor do tipo); sem tipo, o "+ type" discreto da linha de
// data/tags. O menu lista os tipos (o atual marcado) e, com tipo, "Remove
// type" e "Edit type"; sempre "Manage types…" e, na nota de caderno,
// "Archive"/"Unarchive". Fecha com Esc ou clique fora.
interface NoteTypePickerProps {
  types: NoteType[]
  // Tipo atual (id órfão, de tipo apagado em outra janela, chega como null).
  type: NoteType | null
  onChange: (typeId: string | null) => void
  // Modal geral (opcional: sem ele, o item "Manage types…" não aparece).
  onManage?: () => void
  // Modal focado no tipo atual (só com tipo).
  onEditType?: () => void
  archived?: boolean
  onSetArchived?: (archived: boolean) => void
}

export function NoteTypePicker({
  types,
  type,
  onChange,
  onManage,
  onEditType,
  archived = false,
  onSetArchived,
}: NoteTypePickerProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    // Captura: o Esc não chega ao editor nem a outros atalhos.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
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

  return (
    <span ref={wrapRef} className={styles.wrap}>
      <button
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
        <div className={styles.menu} role="menu">
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
          {onManage && (
            <button type="button" role="menuitem" className={styles.item} onClick={() => run(onManage)}>
              <span className={styles.itemName}>Manage types…</span>
            </button>
          )}
          {onSetArchived && (
            <>
              <div className={styles.sep} role="separator" />
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => run(() => onSetArchived(!archived))}
              >
                <span className={styles.itemName}>{archived ? 'Unarchive' : 'Archive'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </span>
  )
}
