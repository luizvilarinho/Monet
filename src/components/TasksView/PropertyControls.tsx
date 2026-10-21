// Controles de valor de propriedade, compartilhados pela barra da task
// (TaskPropertiesBar) e pela barra de propriedades do tipo de nota
// (NotePropertiesBar). Estilos de TaskPropertiesBar.module.css.
import { useEffect, useRef, useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import { parseNumberInput } from '../../lib/metadata'
import type { MetadataDef, MetadataValue } from '../../types'
import styles from './TaskPropertiesBar.module.css'

// Nota na linha de uma data (ex.: "Postponed 2×"); `short` aparece quando a
// coluna é estreita, com o texto completo no title.
export interface DateNote {
  text: string
  short: string
}

export function DateControl({
  label,
  value,
  hint,
  warning,
  onChange,
}: {
  label: string
  value: string | null
  hint: DateNote | null
  warning: DateNote | null
  onChange: (value: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <span className={styles.dateControl}>
      <span className={styles.dateWrapper} onClick={() => inputRef.current?.showPicker()}>
        <CalendarBlank size={14} className={styles.dateIcon} aria-hidden />
        <input
          ref={inputRef}
          type="date"
          className={styles.dateInput}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          onClick={(e) => e.stopPropagation()}
          aria-label={label}
        />
      </span>
      {value && (
        <button type="button" className={styles.link} onClick={() => onChange(null)}>
          Clear
        </button>
      )}
      {hint && <Note note={hint} className={styles.hint} />}
      {warning && <Note note={warning} className={styles.warning} />}
    </span>
  )
}

function Note({ note, className }: { note: DateNote; className: string }) {
  return (
    <span className={`${styles.note} ${className}`} title={note.text} role="note" aria-label={note.text}>
      <span className={styles.noteFull}>{note.text}</span>
      <span className={styles.noteShort}>{note.short}</span>
    </span>
  )
}

function TextControl({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string | null
  placeholder: string
  onChange: (value: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? '')
  // Esc descarta o rascunho (o blur que segue não grava).
  const cancelRef = useRef(false)
  useEffect(() => setDraft(value ?? ''), [value])

  function commit() {
    if (cancelRef.current) {
      cancelRef.current = false
      setDraft(value ?? '')
      return
    }
    const next = draft.trim() || null
    if (next !== value) onChange(next)
  }

  return (
    <input
      className={styles.textInput}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelRef.current = true
          e.currentTarget.blur()
        }
      }}
      aria-label={label}
    />
  )
}

// Número: rascunho livre; o commit (blur/Enter) aceita vírgula decimal e
// inválido ou vazio grava null (o campo volta vazio).
function NumberControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const cancelRef = useRef(false)
  useEffect(() => setDraft(value === null ? '' : String(value)), [value])

  function commit() {
    if (cancelRef.current) {
      cancelRef.current = false
      setDraft(value === null ? '' : String(value))
      return
    }
    const next = parseNumberInput(draft)
    setDraft(next === null ? '' : String(next))
    if (next !== value) onChange(next)
  }

  return (
    <input
      className={styles.textInput}
      inputMode="decimal"
      value={draft}
      placeholder="Empty"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelRef.current = true
          e.currentTarget.blur()
        }
      }}
      aria-label={label}
    />
  )
}

// Controle conforme o tipo de dado da definição (metadado de task ou
// propriedade de tipo de nota).
export function MetadataValueControl({
  def,
  value,
  onChange,
}: {
  def: MetadataDef
  value: MetadataValue
  onChange: (value: MetadataValue) => void
}) {
  switch (def.type) {
    case 'text':
      return (
        <TextControl
          label={def.name}
          value={typeof value === 'string' ? value : null}
          placeholder="Empty"
          onChange={onChange}
        />
      )
    case 'number':
      return (
        <NumberControl
          label={def.name}
          value={typeof value === 'number' ? value : null}
          onChange={onChange}
        />
      )
    case 'date':
      return (
        <DateControl
          label={def.name}
          value={typeof value === 'string' ? value : null}
          hint={null}
          warning={null}
          onChange={onChange}
        />
      )
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={def.name}
        />
      )
    case 'select': {
      // Opção apagada (ou de outra janela) aparece como vazio.
      const options = def.options ?? []
      const current = options.find((o) => o.id === value)
      return (
        <span className={styles.selectControl}>
          {current?.color && (
            <span className={styles.optionDot} style={{ background: current.color }} aria-hidden />
          )}
          <select
            className={styles.select}
            value={current?.id ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            aria-label={def.name}
          >
            <option value="">Empty</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </span>
      )
    }
  }
}
