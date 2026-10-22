// Campos da task (propriedades e metadados custom), compartilhados pela barra
// da nota-corpo (TaskPropertiesBar) e pelo popover do card na nota TODOS.
// O layout `compact` (uma coluna) é do popover; a barra usa o layout `bar`.
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowSquareOut, Flag, PencilSimple, X } from '@phosphor-icons/react'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  planDate,
  scheduledAfterDeadline,
  statusColor,
  WEEKDAY_SHORT,
  type ProjectChoice,
  type TaskPatch,
  type TodosInfo,
} from '../../lib/tasks'
import type {
  MetadataDef,
  MetadataValue,
  Notebook,
  Task,
  TaskRecurrence,
  TaskStatusDef,
} from '../../types'
import { ProjectPicker } from './ProjectPicker'
import { DateControl, MetadataValueControl, type DateNote } from './PropertyControls'
import styles from './TaskPropertiesBar.module.css'

interface TaskFieldsProps {
  task: Task
  notebooks: Notebook[]
  // Registro de status (opções do controle Status).
  statuses: TaskStatusDef[]
  // Notas TODOS (opções do campo TODOS).
  todosOptions: TodosInfo[]
  // Ausentes no card: o campo TODOS só aparece com os dois.
  onOpenTodos?: (noteId: string) => void
  // Cria a TODOS no caderno e devolve o id (a task é vinculada a ela).
  onCreateTodos?: (notebookId: string, title: string) => Promise<string>
  onUpdate: (patch: TaskPatch) => void
  onMove: (project: ProjectChoice) => void
  // Definições globais de metadados (as anexadas viram linhas; as demais, opções).
  metadataDefs: MetadataDef[]
  // Abre "Manage properties"; com `focusId`, focado nessa definição.
  onManageMetadata: (focusId?: string) => void
  layout?: 'bar' | 'compact'
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
  // Recorrência: None | Daily | Weekly (dias da semana) | Monthly.
  | { kind: 'repeat' }
  // Projeto = caderno: mudar move a task e a nota-corpo (onMove), não é patch.
  | { kind: 'project' }
  // Nota TODOS da task (`parentNoteId`): picker, "New TODOS…" e abrir.
  | { kind: 'todos' }

interface TaskProperty {
  id: string
  label: string
  control: TaskPropertyControl
}

const TASK_PROPERTY_ROWS: TaskProperty[][] = [
  [
    { id: 'project', label: 'Project', control: { kind: 'project' } },
    { id: 'todos', label: 'TODOS', control: { kind: 'todos' } },
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

export function TaskFields({
  task,
  notebooks,
  statuses,
  todosOptions,
  onOpenTodos,
  onCreateTodos,
  onUpdate,
  onMove,
  metadataDefs,
  onManageMetadata,
  layout = 'bar',
}: TaskFieldsProps) {
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
      case 'project':
        return <ProjectControl task={task} notebooks={notebooks} onMove={onMove} />
      case 'todos':
        // No card o contexto pode não expor a criação/abertura da TODOS.
        return onOpenTodos && onCreateTodos ? (
          <TodosControl
            task={task}
            notebooks={notebooks}
            options={todosOptions}
            onChange={(parentNoteId) => onUpdate({ parentNoteId })}
            onOpen={onOpenTodos}
            onCreate={onCreateTodos}
          />
        ) : null
    }
  }

  function setMetadata(id: string, value: MetadataValue) {
    onUpdate({ metadata: { ...task.metadata, [id]: value } })
  }

  function removeMetadata(id: string) {
    const { [id]: _removed, ...rest } = task.metadata
    onUpdate({ metadata: rest })
  }

  function renderField(prop: TaskProperty) {
    return (
      <div key={prop.id} className={styles.field}>
        <span className={styles.label}>{prop.label}</span>
        <span className={styles.control}>{renderControl(prop)}</span>
      </div>
    )
  }

  const content = (
    <>
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
            <span className={styles.control}>
              <MetadataValueControl
                def={def}
                value={task.metadata[def.id] ?? null}
                onChange={(v) => setMetadata(def.id, v)}
              />
            </span>
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
    </>
  )

  return layout === 'compact' ? <div className={styles.compact}>{content}</div> : content
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

const NEW_TODOS = '__new__'

// TODOS da task: as do caderno da task primeiro, depois as demais com o
// caderno; "＋ New TODOS…" troca o select por um input (Enter cria no caderno
// da task e vincula, Esc cancela). Pai apagado por fora aparece como "No TODOS".
// TODOS arquivadas só aparecem quando já são a da task.
function TodosControl({
  task,
  notebooks,
  options,
  onChange,
  onOpen,
  onCreate,
}: {
  task: Task
  notebooks: Notebook[]
  options: TodosInfo[]
  onChange: (parentNoteId: string | null) => void
  onOpen: (noteId: string) => void
  onCreate: (notebookId: string, title: string) => Promise<string>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const current = options.find((o) => o.id === task.parentNoteId) ?? null
  const nameById = new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed']))
  const byTitle = (a: TodosInfo, b: TodosInfo) => a.title.localeCompare(b.title)
  const listed = options.filter((o) => !o.archived || o.id === task.parentNoteId)
  const own = listed.filter((o) => o.notebookId === task.notebookId).sort(byTitle)
  const others = listed.filter((o) => o.notebookId !== task.notebookId).sort(byTitle)

  async function commit() {
    const title = draft?.trim() ?? ''
    setDraft(null)
    if (!title) return
    try {
      onChange(await onCreate(task.notebookId, title))
    } catch (err) {
      console.error('failed to create TODOS', err)
    }
  }

  if (draft !== null) {
    return (
      <span className={styles.project}>
        <input
          autoFocus
          value={draft}
          placeholder="New TODOS title"
          aria-label="new TODOS title"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit()
            if (e.key === 'Escape') {
              e.stopPropagation()
              setDraft(null)
            }
          }}
        />
        <button type="button" className={styles.link} onClick={() => void commit()}>
          Create
        </button>
      </span>
    )
  }
  return (
    <span className={styles.project}>
      <select
        value={current?.id ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (v === NEW_TODOS) setDraft('')
          else onChange(v || null)
        }}
        aria-label="TODOS"
      >
        <option value="">No TODOS</option>
        {[...own, ...others].map((o) => (
          <option key={o.id} value={o.id}>
            {o.title.trim() || 'Untitled'}
            {o.notebookId !== task.notebookId ? ` · ${nameById.get(o.notebookId ?? '') ?? 'unnamed'}` : ''}
            {o.archived ? ' · archived' : ''}
          </option>
        ))}
        <option value={NEW_TODOS}>＋ New TODOS…</option>
      </select>
      {current && (
        <button
          type="button"
          className={styles.link}
          onClick={() => onOpen(current.id)}
          aria-label="Open TODOS"
          title="Open TODOS"
        >
          <ArrowSquareOut size={13} aria-hidden />
        </button>
      )}
    </span>
  )
}
