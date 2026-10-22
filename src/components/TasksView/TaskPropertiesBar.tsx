// Barra de metadados da task cuja nota-corpo está aberta no editor.
//
// Novo metadado de task — lugares a tocar:
//   1. `Task` em src/types/index.ts (e `TaskPatch` em src/lib/tasks.ts, se editável);
//   2. coluna em TASKS_EXTRA_COLUMNS + `TaskRow`/`rowToTask`/`saveTask` em src/storage/tauri.ts;
//   3. uma entrada em `TASK_PROPERTY_ROWS` em `TaskFields.tsx` (controle 'status', 'toggle', 'date',
//      'repeat', 'project' ou 'todos';
//      um tipo de controle novo pede um caso em `renderControl`).
// Status vem do registro `task_statuses` (prop `statuses`); `doingSince` e `plannedDay`
// são derivados (applyTaskPatch / Plan today) e não têm controle aqui.
// Cada linha de `TASK_PROPERTY_ROWS` tem uma ou duas propriedades (label à esquerda,
// controle à direita); com duas, elas dividem a largura em duas colunas.
// Metadados personalizados (`task.metadata`, definições em `metadataDefs`) são uma
// lista dinâmica abaixo: uma linha por definição anexada, com controle conforme o
// tipo, e "+ Add property" para anexar ou criar definições.
import { useRef, useState } from 'react'
import { ArrowSquareOut, ListChecks, Trash } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import { MAX_METADATA_NAME } from '../../hooks/useMetadataDefs'
import { defaultMetadataValue, METADATA_TYPE_LABEL, METADATA_TYPES } from '../../lib/metadata'
import {
  deleteTasksMessage,
  type ProjectChoice,
  type TaskPatch,
  type TodosInfo,
} from '../../lib/tasks'
import type { MetadataDef, MetadataType, Notebook, Task, TaskStatusDef } from '../../types'
import { TaskFields } from './TaskFields'
import styles from './TaskPropertiesBar.module.css'

interface TaskPropertiesBarProps {
  task: Task
  notebooks: Notebook[]
  // Registro de status (opções do controle Status).
  statuses: TaskStatusDef[]
  // Notas TODOS (opções do campo TODOS).
  todosOptions: TodosInfo[]
  onOpenTodos: (noteId: string) => void
  // Cria a TODOS no caderno e devolve o id (a task é vinculada a ela).
  onCreateTodos: (notebookId: string, title: string) => Promise<string>
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

export function TaskPropertiesBar({
  task,
  notebooks,
  statuses,
  todosOptions,
  onOpenTodos,
  onCreateTodos,
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
      <TaskFields
        layout="bar"
        task={task}
        notebooks={notebooks}
        statuses={statuses}
        todosOptions={todosOptions}
        onOpenTodos={onOpenTodos}
        onCreateTodos={onCreateTodos}
        onUpdate={onUpdate}
        onMove={onMove}
        metadataDefs={metadataDefs}
        onManageMetadata={onManageMetadata}
      />
      <AddPropertyControl
        defs={metadataDefs.filter((d) => !(d.id in task.metadata))}
        onAttach={(def) => onUpdate({ metadata: { ...task.metadata, [def.id]: defaultMetadataValue(def.type) } })}
        onCreate={onCreateMetadataDef}
        onManage={onManageMetadata}
      />
      {modal}
    </div>
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
