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

const NEW_OPTION = '__new_option__'

// Select de opções. Com `onCreateOption`, o último item "New option…" troca o
// select por um campo: Enter ou blur com texto cria a opção e já a aplica;
// Esc ou campo vazio voltam ao select. Erro (nome repetido) fica no campo.
function SelectControl({
  def,
  value,
  onChange,
  onCreateOption,
}: {
  def: MetadataDef
  value: MetadataValue
  onChange: (value: MetadataValue) => void
  onCreateOption?: (name: string) => Promise<string>
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const busyRef = useRef(false)
  // Opção apagada (ou de outra janela) aparece como vazio.
  const options = def.options ?? []
  const current = options.find((o) => o.id === value)

  function close() {
    setCreating(false)
    setDraft('')
    setError(null)
  }

  async function commit() {
    if (cancelRef.current || !draft.trim() || !onCreateOption) {
      cancelRef.current = false
      close()
      return
    }
    if (busyRef.current) return
    busyRef.current = true
    try {
      const id = await onCreateOption(draft)
      close()
      onChange(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      busyRef.current = false
    }
  }

  if (creating) {
    return (
      <span className={styles.selectControl}>
        <input
          autoFocus
          className={styles.textInput}
          value={draft}
          placeholder="New option…"
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit()
            if (e.key === 'Escape') {
              e.stopPropagation()
              cancelRef.current = true
              e.currentTarget.blur()
            }
          }}
          aria-label={`New ${def.name} option`}
          aria-invalid={error ? true : undefined}
        />
        {error && (
          <span className={`${styles.note} ${styles.warning}`} role="alert">
            {error}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className={styles.selectControl}>
      {current?.color && <span className={styles.optionDot} style={{ background: current.color }} aria-hidden />}
      <select
        className={styles.select}
        value={current?.id ?? ''}
        onChange={(e) => {
          if (e.target.value === NEW_OPTION) setCreating(true)
          else onChange(e.target.value || null)
        }}
        aria-label={def.name}
      >
        <option value="">Empty</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
        {onCreateOption && <option value={NEW_OPTION}>New option…</option>}
      </select>
    </span>
  )
}

// Controle conforme o tipo de dado da definição (metadado de task ou
// propriedade de tipo de nota). `onCreateOption`: "New option…" no select.
export function MetadataValueControl({
  def,
  value,
  onChange,
  onCreateOption,
}: {
  def: MetadataDef
  value: MetadataValue
  onChange: (value: MetadataValue) => void
  onCreateOption?: (name: string) => Promise<string>
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
    case 'select':
      return <SelectControl def={def} value={value} onChange={onChange} onCreateOption={onCreateOption} />
  }
}
