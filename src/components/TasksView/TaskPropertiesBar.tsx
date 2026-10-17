// Barra de metadados da task cuja nota-corpo está aberta no editor.
//
// Novo metadado de task — lugares a tocar:
//   1. `Task` em src/types/index.ts (e `TaskPatch` em src/lib/tasks.ts, se editável);
//   2. coluna em TASKS_EXTRA_COLUMNS + `TaskRow`/`rowToTask`/`saveTask` em src/storage/tauri.ts;
//   3. uma entrada em `TASK_PROPERTY_ROWS` abaixo (controle 'status', 'toggle', 'date', 'text',
//      'repeat' ou 'project';
//      um tipo de controle novo pede um caso em `renderControl`).
// Status vem do registro `task_statuses` (prop `statuses`); `doingSince` e `plannedDay`
// são derivados (applyTaskPatch / Plan today) e não têm controle aqui.
// Cada linha de `TASK_PROPERTY_ROWS` tem uma ou duas propriedades (label à esquerda,
// controle à direita); com duas, elas dividem a largura em duas colunas.
// Metadados personalizados (`task.metadata`, definições em `metadataDefs`) são uma
// lista dinâmica abaixo: uma linha por definição anexada, com controle conforme o
// tipo, e "+ Add property" para anexar ou criar definições.
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowSquareOut, CalendarBlank, Flag, ListChecks, PencilSimple, Trash, X } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import { MAX_METADATA_NAME } from '../../hooks/useMetadataDefs'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  defaultMetadataValue,
  METADATA_TYPE_LABEL,
  METADATA_TYPES,
  parseNumberInput,
} from '../../lib/metadata'
import {
  deleteTasksMessage,
  planDate,
  scheduledAfterDeadline,
  statusColor,
  WEEKDAY_SHORT,
  type ProjectChoice,
  type TaskPatch,
} from '../../lib/tasks'
import type {
  MetadataDef,
  MetadataType,
  MetadataValue,
  Notebook,
  Task,
  TaskRecurrence,
  TaskStatusDef,
} from '../../types'
import { ProjectPicker } from './ProjectPicker'
import styles from './TaskPropertiesBar.module.css'

interface TaskPropertiesBarProps {
  task: Task
  notebooks: Notebook[]
  // Registro de status (opções do controle Status).
  statuses: TaskStatusDef[]
  // Groups já usados no projeto da task (autocomplete do campo Group).
  groupSuggestions: string[]
  sourceNoteExists: boolean
  onUpdate: (patch: TaskPatch) => void
  onMove: (project: ProjectChoice) => void
  onOpenSourceNote: () => void
  onDelete: () => void
  // Definições globais de metadados (as anexadas viram linhas; as demais, opções).
  metadataDefs: MetadataDef[]
  onCreateMetadataDef: (name: string, type: MetadataType) => Promise<MetadataDef>
  // Abre "Manage properties"; com `focusId`, focado nessa definição.
  onManageMetadata: (focusId?: string) => void
}

type TaskPropertyControl =
  // Status: uma pill clicável por status do registro, todas visíveis.
  | { kind: 'status' }
  | {
      // Uma única pill liga/desliga.
      kind: 'toggle'
      text: string
      color: string
      get: (t: Task) => boolean
      set: (value: boolean) => TaskPatch
    }
  | {
      kind: 'date'
      get: (t: Task) => string | null
      set: (value: string | null) => TaskPatch
      // Nota na mesma linha do campo (ex.: "Postponed 2×"); `short` aparece quando a
      // coluna é estreita, com o texto completo no title.
      hint?: (t: Task) => DateNote | null
      // Aviso em amarelo, idem (ex.: "After deadline").
      warning?: (t: Task) => DateNote | null
    }
  | {
      // Texto livre com sugestões (as do projeto); grava no blur/Enter.
      kind: 'text'
      get: (t: Task) => string | null
      set: (value: string | null) => TaskPatch
      placeholder: string
    }
  // Recorrência: None | Daily | Weekly (dias da semana) | Monthly.
  | { kind: 'repeat' }
  // Projeto = caderno: mudar move a task e a nota-corpo (onMove), não é patch.
  | { kind: 'project' }

interface DateNote {
  text: string
  short: string
}

interface TaskProperty {
  id: string
  label: string
  control: TaskPropertyControl
}

const TASK_PROPERTY_ROWS: TaskProperty[][] = [
  [
    { id: 'project', label: 'Project', control: { kind: 'project' } },
    {
      id: 'group',
      label: 'Group',
      control: {
        kind: 'text',
        get: (t) => t.group,
        set: (value) => ({ group: value }),
        placeholder: 'Add a group…',
      },
    },
  ],
  [
    {
      id: 'status',
      label: 'Status',
      control: { kind: 'status' },
    },
  ],
  [
    {
      id: 'scheduledDate',
      label: 'Do date',
      control: {
        kind: 'date',
        get: (t) => t.scheduledDate,
        set: (value) => ({ scheduledDate: value }),
        warning: (t) => (scheduledAfterDeadline(t) ? { text: 'After deadline', short: '⚠' } : null),
      },
    },
    {
      id: 'dueDate',
      label: 'Deadline',
      control: {
        kind: 'date',
        get: (t) => t.dueDate,
        set: (value) => ({ dueDate: value }),
        hint: (t) =>
          t.rescheduleCount > 0
            ? { text: `Postponed ${t.rescheduleCount}×`, short: `↻${t.rescheduleCount}×` }
            : null,
      },
    },
  ],
  [
    {
      id: 'important',
      label: 'Important',
      control: {
        kind: 'toggle',
        text: 'Important',
        color: 'var(--accent-task)',
        get: (t) => t.important,
        set: (value) => ({ important: value }),
      },
    },
    { id: 'recurrence', label: 'Repeat', control: { kind: 'repeat' } },
  ],
]

export function TaskPropertiesBar({
  task,
  notebooks,
  statuses,
  groupSuggestions,
  sourceNoteExists,
  onUpdate,
  onMove,
  onOpenSourceNote,
  onDelete,
  metadataDefs,
  onCreateMetadataDef,
  onManageMetadata,
}: TaskPropertiesBarProps) {
  const { confirm, modal } = useConfirm()

  async function handleDelete() {
    const ok = await confirm(deleteTasksMessage([task]), {
      title: 'Delete task',
      confirmLabel: 'Delete',
    })
    if (ok) onDelete()
  }

  function renderControl(prop: TaskProperty) {
    const { control } = prop
    switch (control.kind) {
      case 'status': {
        // Status excluído em outra janela: a pill ativa mostra o id.
        const options = statuses.map((s) => ({
          value: s.id,
          label: s.name,
          color: statusColor(s.id, statuses),
        }))
        if (!statuses.some((s) => s.id === task.status)) {
          options.push({ value: task.status, label: task.status, color: statusColor(task.status, statuses) })
        }
        return (
          <PillsControl
            label={prop.label}
            options={options}
            value={task.status}
            onChange={(value) => onUpdate({ status: value })}
          />
        )
      }
      case 'toggle':
        return (
          <button
            type="button"
            aria-pressed={control.get(task)}
            className={`${styles.pill} ${control.get(task) ? styles.pillActive : ''}`}
            style={{ '--pill-color': control.color } as CSSProperties}
            onClick={() => onUpdate(control.set(!control.get(task)))}
          >
            <Flag size={11} weight={control.get(task) ? 'fill' : 'regular'} aria-hidden /> {control.text}
          </button>
        )
      case 'repeat':
        return (
          <RepeatControl
            value={task.recurrence}
            defaultDay={new Date(`${planDate(task) ?? dateKeyFromMs(Date.now())}T00:00:00`).getDay()}
            onChange={(recurrence) => onUpdate({ recurrence })}
          />
        )
      case 'date':
        return (
          <DateControl
            label={prop.label}
            value={control.get(task)}
            hint={control.hint?.(task) ?? null}
            warning={control.warning?.(task) ?? null}
            onChange={(value) => onUpdate(control.set(value))}
          />
        )
      case 'text':
        return (
          <TextControl
            label={prop.label}
            value={control.get(task)}
            placeholder={control.placeholder}
            suggestions={groupSuggestions}
            onChange={(value) => onUpdate(control.set(value))}
          />
        )
      case 'project':
        return <ProjectControl task={task} notebooks={notebooks} onMove={onMove} />
    }
  }

  function setMetadata(id: string, value: MetadataValue) {
    onUpdate({ metadata: { ...task.metadata, [id]: value } })
  }

  function removeMetadata(id: string) {
    const { [id]: _removed, ...rest } = task.metadata
    onUpdate({ metadata: rest })
  }

  function renderMetadataControl(def: MetadataDef) {
    const value = task.metadata[def.id] ?? null
    switch (def.type) {
      case 'text':
        return (
          <TextControl
            label={def.name}
            value={typeof value === 'string' ? value : null}
            placeholder="Empty"
            suggestions={[]}
            onChange={(v) => setMetadata(def.id, v)}
          />
        )
      case 'number':
        return (
          <NumberControl
            label={def.name}
            value={typeof value === 'number' ? value : null}
            onChange={(v) => setMetadata(def.id, v)}
          />
        )
      case 'date':
        return (
          <DateControl
            label={def.name}
            value={typeof value === 'string' ? value : null}
            hint={null}
            warning={null}
            onChange={(v) => setMetadata(def.id, v)}
          />
        )
      case 'checkbox':
        return (
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={value === true}
            onChange={(e) => setMetadata(def.id, e.target.checked)}
            aria-label={def.name}
          />
        )
    }
  }

  function renderField(prop: TaskProperty) {
    return (
      <div key={prop.id} className={styles.field}>
        <span className={styles.label}>{prop.label}</span>
        <span className={styles.control}>{renderControl(prop)}</span>
      </div>
    )
  }

  return (
    <div className={styles.bar}>
      <div className={styles.header}>
        <span className={styles.badge}>
          <ListChecks size={14} aria-hidden />
          Task
        </span>
        <span className={styles.spacer} />
        {sourceNoteExists && (
          <button type="button" className={styles.link} onClick={onOpenSourceNote}>
            <ArrowSquareOut size={13} aria-hidden />
            Open source note
          </button>
        )}
        <button
          type="button"
          className={styles.delete}
          onClick={() => void handleDelete()}
          aria-label="delete task"
          title="Delete task"
        >
          <Trash size={14} aria-hidden />
        </button>
      </div>
      {TASK_PROPERTY_ROWS.map((row) => (
        <div key={row[0].id} className={styles.row}>
          {row.map(renderField)}
        </div>
      ))}
      {metadataDefs
        .filter((d) => d.id in task.metadata)
        .map((def) => (
          <div key={def.id} className={`${styles.field} ${styles.metaField}`}>
            <span className={styles.label} title={def.name}>
              {def.name}
            </span>
            <span className={styles.control}>{renderMetadataControl(def)}</span>
            <button
              type="button"
              className={styles.metaAction}
              onClick={() => onManageMetadata(def.id)}
              aria-label="Edit property"
              title="Edit property"
            >
              <PencilSimple size={12} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.metaAction} ${styles.metaRemove}`}
              onClick={() => removeMetadata(def.id)}
              aria-label="Remove property"
              title="Remove property"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        ))}
      <AddPropertyControl
        defs={metadataDefs.filter((d) => !(d.id in task.metadata))}
        onAttach={(def) => setMetadata(def.id, defaultMetadataValue(def.type))}
        onCreate={onCreateMetadataDef}
        onManage={onManageMetadata}
      />
      {modal}
    </div>
  )
}

// Radiogroup: setas/Home/End movem a seleção (e o foco) entre as pills.
function PillsControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: string; label: string; color: string }>
  value: string
  onChange: (value: string) => void
}) {
  const groupRef = useRef<HTMLSpanElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLSpanElement>) {
    const current = options.findIndex((o) => o.value === value)
    let next: number
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (current - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else return
    e.preventDefault()
    onChange(options[next].value)
    groupRef.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }

  return (
    <span ref={groupRef} role="radiogroup" aria-label={label} className={styles.pills} onKeyDown={handleKeyDown}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={`${styles.pill} ${active ? styles.pillActive : ''}`}
            style={{ '--pill-color': o.color } as CSSProperties}
            onClick={() => {
              if (!active) onChange(o.value)
            }}
          >
            {o.label}
          </button>
        )
      })}
    </span>
  )
}

type RepeatFreq = TaskRecurrence['freq'] | 'none'

const REPEAT_LABEL: Record<RepeatFreq, string> = {
  none: 'None',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

// Select da frequência; em Weekly, um toggle por dia da semana (≥ 1 ligado).
function RepeatControl({
  value,
  defaultDay,
  onChange,
}: {
  value: TaskRecurrence | null
  defaultDay: number
  onChange: (value: TaskRecurrence | null) => void
}) {
  const freq: RepeatFreq = value?.freq ?? 'none'

  function handleFreq(next: RepeatFreq) {
    if (next === 'none') onChange(null)
    else if (next === 'weekly') onChange({ freq: 'weekly', days: [defaultDay] })
    else onChange({ freq: next })
  }

  function toggleDay(day: number) {
    if (value?.freq !== 'weekly') return
    const days = value.days.includes(day)
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort((a, b) => a - b)
    if (days.length > 0) onChange({ freq: 'weekly', days })
  }

  return (
    <>
      <select
        className={styles.select}
        value={freq}
        onChange={(e) => handleFreq(e.target.value as RepeatFreq)}
        aria-label="Repeat"
      >
        {(Object.keys(REPEAT_LABEL) as RepeatFreq[]).map((f) => (
          <option key={f} value={f}>
            {REPEAT_LABEL[f]}
          </option>
        ))}
      </select>
      {value?.freq === 'weekly' &&
        WEEKDAY_SHORT.map((name, day) => {
          const on = value.days.includes(day)
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              aria-label={name}
              title={name}
              className={`${styles.pill} ${styles.dayPill} ${on ? styles.pillActive : ''}`}
              style={{ '--pill-color': 'var(--accent-task)' } as CSSProperties}
              onClick={() => toggleDay(day)}
            >
              {name[0]}
            </button>
          )
        })}
    </>
  )
}

function DateControl({
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
  suggestions,
  onChange,
}: {
  label: string
  value: string | null
  placeholder: string
  suggestions: string[]
  onChange: (value: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? '')
  const listId = useId()
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
    <>
      <input
        className={styles.textInput}
        value={draft}
        placeholder={placeholder}
        list={listId}
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
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
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

// "+ Add property": popover com as definições ainda não anexadas, criação de
// uma nova (nome + tipo) e atalho para "Manage properties…".
function AddPropertyControl({
  defs,
  onAttach,
  onCreate,
  onManage,
}: {
  defs: MetadataDef[]
  onAttach: (def: MetadataDef) => void
  onCreate: (name: string, type: MetadataType) => Promise<MetadataDef>
  onManage: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<MetadataType>('text')
  const [error, setError] = useState<string | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  function close() {
    setOpen(false)
    setName('')
    setType('text')
    setError(null)
  }

  async function handleCreate() {
    try {
      const def = await onCreate(name, type)
      onAttach(def)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className={styles.field}>
      <span
        ref={wrapRef}
        className={styles.addWrap}
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) close()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            close()
          }
        }}
      >
        <button
          type="button"
          className={styles.link}
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
        >
          + Add property
        </button>
        {open && (
          <div className={styles.addMenu} role="dialog" aria-label="Add property">
            {defs.map((d) => (
              <button
                key={d.id}
                type="button"
                className={styles.addItem}
                onClick={() => {
                  onAttach(d)
                  close()
                }}
              >
                <span className={styles.addItemName}>{d.name}</span>
                <span className={styles.addItemType}>{METADATA_TYPE_LABEL[d.type]}</span>
              </button>
            ))}
            <p className={styles.addTitle}>New property</p>
            <div className={styles.addCreate}>
              <input
                className={styles.addInput}
                value={name}
                maxLength={MAX_METADATA_NAME}
                placeholder="Name"
                aria-label="new property name"
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate()
                }}
              />
              <select
                className={styles.select}
                value={type}
                onChange={(e) => setType(e.target.value as MetadataType)}
                aria-label="new property type"
              >
                {METADATA_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {METADATA_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <button type="button" className={styles.link} onClick={() => void handleCreate()}>
                Create
              </button>
            </div>
            {error && <span className={styles.warning}>{error}</span>}
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                onManage()
                close()
              }}
            >
              Manage properties…
            </button>
          </div>
        )}
      </span>
    </div>
  )
}

function ProjectControl({
  task,
  notebooks,
  onMove,
}: {
  task: Task
  notebooks: Notebook[]
  onMove: (project: ProjectChoice) => void
}) {
  // Nome de caderno novo sendo digitado no seletor de projeto (Enter cria e move).
  const [draft, setDraft] = useState<{ newName: string } | null>(null)

  function handleChange(value: ProjectChoice) {
    if ('newName' in value) {
      setDraft(value)
      return
    }
    setDraft(null)
    if (value.notebookId !== task.notebookId) onMove(value)
  }

  function commitDraft() {
    if (!draft) return
    if (draft.newName.trim()) onMove(draft)
    setDraft(null)
  }

  return (
    <span
      className={styles.project}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitDraft()
        if (e.key === 'Escape') setDraft(null)
      }}
    >
      <ProjectPicker
        notebooks={notebooks}
        value={draft ?? { notebookId: task.notebookId }}
        onChange={handleChange}
      />
      {draft && (
        <button type="button" className={styles.link} onClick={commitDraft}>
          Move
        </button>
      )}
    </span>
  )
}
