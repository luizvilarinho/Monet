// Editor completo da nota-corpo dentro do modal da task aberto a partir de uma
// nota (R4). É um segundo Editor isolado do principal: sem `onEditorReady` (o
// App continua apontando para o editor de trás) e sem slash commands (o
// `onCommand` do App grava na nota de trás). Task sem nota-corpo abre só com as
// propriedades e o "Add body note" explícito — abrir nunca cria a nota.
import { useMemo } from 'react'
import { unlinkResponseFromChat } from '../../hooks/useChat'
import { useAi } from '../../hooks/useAi'
import type { ProjectChoice, TaskPatch, TodosInfo } from '../../lib/tasks'
import type {
  MetadataDef,
  MetadataType,
  Note,
  Notebook,
  Task,
  TaskStatus,
  TaskStatusDef,
} from '../../types'
import { Editor } from '../Editor/Editor'
import { TasksProvider, type TasksContextValue } from '../Editor/TasksContext'
import { TaskPropertiesBar } from './TaskPropertiesBar'
import styles from './TaskModalEditor.module.css'

interface TaskModalEditorProps {
  task: Task
  // Nota-corpo da task; ausente = task sem nota-corpo (nada é criado ao abrir).
  note?: Note
  notebookName?: string
  subjectName?: string
  previewMode: boolean
  onNoteChange: (patch: Partial<Note>) => void
  // "Add body note": cria a nota-corpo e a vincula à task (só no clique).
  onAddBodyNote: () => Promise<void>
  onUpdate: (patch: TaskPatch) => void
  onMove: (project: ProjectChoice) => void
  onCreateTasks: (
    inputs: Array<{ title: string; checked: boolean }>,
    opts: { dueDate: string | null; project: ProjectChoice }
  ) => Promise<Task[]>
  onToggleLinkedTask: (taskId: string, checked: boolean) => void
  taskStatuses: Map<string, TaskStatus>
  notebooks: Notebook[]
  statuses: TaskStatusDef[]
  todosOptions: TodosInfo[]
  metadataDefs: MetadataDef[]
  onCreateMetadataDef: (name: string, type: MetadataType) => Promise<MetadataDef>
  onManageMetadata: (focusId?: string) => void
  sourceNoteExists: boolean
  onOpenSourceNote: () => void
  onOpenTodos: (noteId: string) => void
  onCreateTodos: (notebookId: string, title: string) => Promise<string>
  onDelete: () => void
  suggestedTaskNotebookId: string
  // Rótulos de marca e tags já usados (régua/menu da marca e "+ tag").
  markLabels?: string[]
  tagSuggestions?: string[]
  // Provider do corpo do modal: sem `onOpenTask`/`onOpenTaskModal` (o card
  // dentro do corpo não navega atrás do modal).
  tasksContext: TasksContextValue
}

export function TaskModalEditor({
  task,
  note,
  notebookName,
  subjectName,
  previewMode,
  onNoteChange,
  onAddBodyNote,
  onUpdate,
  onMove,
  onCreateTasks,
  onToggleLinkedTask,
  taskStatuses,
  notebooks,
  statuses,
  todosOptions,
  metadataDefs,
  onCreateMetadataDef,
  onManageMetadata,
  sourceNoteExists,
  onOpenSourceNote,
  onOpenTodos,
  onCreateTodos,
  onDelete,
  suggestedTaskNotebookId,
  markLabels,
  tagSuggestions,
  tasksContext,
}: TaskModalEditorProps) {
  const { responses, removeResponse } = useAi(note?.id ?? null)

  // Mesma regra do App: comandos executados no corpo (sem os que deram erro)
  // não voltam ao autocomplete.
  const executedCommandTexts = useMemo(() => {
    const set = new Set<string>()
    for (const r of responses) {
      if (r.status === 'error') continue
      const text = r.query.trim() ? `${r.command} ${r.query.trim()}` : r.command
      set.add(text)
    }
    return set
  }, [responses])

  const propertiesBar = (
    <TaskPropertiesBar
      task={task}
      notebooks={notebooks}
      statuses={statuses}
      todosOptions={todosOptions}
      onOpenTodos={onOpenTodos}
      onCreateTodos={onCreateTodos}
      sourceNoteExists={sourceNoteExists}
      onUpdate={onUpdate}
      onMove={onMove}
      onOpenSourceNote={onOpenSourceNote}
      onDelete={onDelete}
      metadataDefs={metadataDefs}
      onCreateMetadataDef={onCreateMetadataDef}
      onManageMetadata={onManageMetadata}
    />
  )

  if (!note) {
    return (
      <div className={styles.noBody}>
        {propertiesBar}
        <p className={styles.noBodyText}>This task has no body note.</p>
        <button type="button" className={styles.noBodyButton} onClick={() => void onAddBodyNote()}>
          Add body note
        </button>
      </div>
    )
  }

  return (
    <TasksProvider value={tasksContext}>
      <Editor
        key={note.id}
        notebookName={notebookName}
        subjectName={subjectName}
        title={note.title}
        onTitleChange={(title) => {
          onNoteChange({ title })
          // Título único: a nota-corpo dá o título da task (regra da nota-corpo).
          if (title.trim()) onUpdate({ title: title.trim() })
        }}
        tags={note.tags}
        onTagsChange={(tags) => onNoteChange({ tags })}
        date={note.date}
        value={note.content}
        onChange={(content) => onNoteChange({ content })}
        previewMode={previewMode}
        disableSlashCommands
        responses={responses}
        executedCommandTexts={executedCommandTexts}
        onRemoveResponse={(id) => {
          removeResponse(id)
          unlinkResponseFromChat(id)
        }}
        taskStatuses={taskStatuses}
        taskNotebooks={notebooks}
        suggestedTaskNotebookId={suggestedTaskNotebookId}
        markLabels={markLabels}
        tagSuggestions={tagSuggestions}
        onCreateTasks={onCreateTasks}
        onToggleLinkedTask={onToggleLinkedTask}
        topSlot={propertiesBar}
      />
    </TasksProvider>
  )
}
