// Barra de metadados da task cuja nota-corpo está aberta no editor.
//
// Novo metadado de task — lugares a tocar:
//   1. `Task` em src/types/index.ts (e `TaskPatch` em src/lib/tasks.ts, se editável);
//   2. coluna em TASKS_EXTRA_COLUMNS + `TaskRow`/`rowToTask`/`saveTask` em src/storage/tauri.ts;
//   3. uma entrada em `TASK_PROPERTIES` abaixo (controle 'pills', 'toggle', 'date', 'text',
//      'repeat' ou 'project';
//      um tipo de controle novo pede um caso em `renderControl`).
// Cada propriedade ocupa uma linha (label à esquerda, controle à direita), na ordem da lista.
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowSquareOut, CalendarBlank, Flag, ListChecks, Trash } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  deleteTasksMessage,
  planDate,
  scheduledAfterDeadline,
  TASK_STATUS_LABEL,
  WEEKDAY_SHORT,
  type ProjectChoice,
  type TaskPatch,
} from '../../lib/tasks'
import type { Notebook, Task, TaskRecurrence, TaskStatus } from '../../types'
import { ProjectPicker } from './ProjectPicker'
import styles from './TaskPropertiesBar.module.css'

interface TaskPropertiesBarProps {
  task: Task
  notebooks: Notebook[]
  // Groups já usados no projeto da task (autocomplete do campo Group).
  groupSuggestions: string[]
  sourceNoteExists: boolean
  onUpdate: (patch: TaskPatch) => void
  onMove: (project: ProjectChoice) => void
  onOpenSourceNote: () => void
  onDelete: () => void
}

type TaskPropertyControl =
  | {
      // Uma pill clicável por opção, todas visíveis; `color` é um valor CSS (ex.: token).
      kind: 'pills'
      options: Array<{ value: string; label: string; color: string }>
      get: (t: Task) => string
      set: (value: string) => TaskPatch
    }
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
      // Texto extra ao lado do campo (ex.: "Postponed 2×").
      hint?: (t: Task) => string | null
      // Aviso em amarelo ao lado do campo (ex.: "After deadline").
      warning?: (t: Task) => string | null
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

interface TaskProperty {
  id: string
  label: string
  control: TaskPropertyControl
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: 'todo', label: TASK_STATUS_LABEL.todo, color: 'var(--status-todo)' },
  { value: 'doing', label: TASK_STATUS_LABEL.doing, color: 'var(--status-doing)' },
  { value: 'done', label: TASK_STATUS_LABEL.done, color: 'var(--status-done)' },
  { value: 'dropped', label: TASK_STATUS_LABEL.dropped, color: 'var(--status-dropped)' },
]

const TASK_PROPERTIES: TaskProperty[] = [
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
  {
    id: 'status',
    label: 'Status',
    control: {
      kind: 'pills',
      options: STATUS_OPTIONS,
      get: (t) => t.status,
      set: (value) => ({ status: value as TaskStatus }),
    },
  },
  {
    id: 'scheduledDate',
    label: 'Do date',
    control: {
      kind: 'date',
      get: (t) => t.scheduledDate,
      set: (value) => ({ scheduledDate: value }),
      warning: (t) => (scheduledAfterDeadline(t) ? 'After deadline' : null),
    },
  },
  {
    id: 'dueDate',
    label: 'Deadline',
    control: {
      kind: 'date',
      get: (t) => t.dueDate,
      set: (value) => ({ dueDate: value }),
      hint: (t) => (t.rescheduleCount > 0 ? `Postponed ${t.rescheduleCount}×` : null),
    },
  },
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
]

export function TaskPropertiesBar({
  task,
  notebooks,
  groupSuggestions,
  sourceNoteExists,
  onUpdate,
  onMove,
  onOpenSourceNote,
  onDelete,
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
      case 'pills':
        return (
          <PillsControl
            label={prop.label}
            options={control.options}
            value={control.get(task)}
            onChange={(value) => onUpdate(control.set(value))}
          />
        )
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
      {TASK_PROPERTIES.map(renderField)}
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
  hint: string | null
  warning: string | null
  onChange: (value: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
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
      {hint && <span className={styles.hint}>{hint}</span>}
      {warning && <span className={styles.warning}>{warning}</span>}
    </>
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
