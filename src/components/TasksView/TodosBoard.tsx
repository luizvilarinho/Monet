import { useCallback, useMemo } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { byTodosId, compareTasks, isOpen } from '../../lib/tasks'
import type { Task } from '../../types'
import { BoardView, type BoardViewProps } from './BoardView'
import type { BoardColumn } from './BoardColumns'
import { useTasksEnv } from './TasksEnv'
import styles from './BoardColumns.module.css'

// Visão TODOS: uma coluna por nota TODOS (sem fundir títulos iguais de
// cadernos diferentes; o cabeçalho mostra o caderno) com as tasks abertas dos
// projetos filtrados, "No TODOS" ao final. Arrastar para outra coluna muda a
// TODOS da task.
type TodosBoardProps = Omit<
  BoardViewProps,
  'ariaLabel' | 'columnsFor' | 'onDrop' | 'showProject' | 'compactStatus'
>

const NO_TODOS_KEY = '__none__'

export function TodosBoard(props: TodosBoardProps) {
  const { onUpdateTasks, notebooks } = props
  const { todosById, onOpenNote } = useTasksEnv()
  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )

  const columnsFor = useCallback(
    (projectTasks: Task[]): BoardColumn<Task>[] =>
      [...byTodosId(projectTasks.filter(isOpen), todosById)].map(([id, list]) => {
        const info = id ? todosById.get(id) : undefined
        const sorted = list.sort(compareTasks)
        return {
          key: id ?? NO_TODOS_KEY,
          title: id === null ? 'No TODOS' : info?.title.trim() || 'Untitled',
          count: sorted.length,
          items: sorted,
          headerExtra: info ? (
            <>
              {info.notebookId && (
                <span className={styles.columnMeta} title={notebookNameById.get(info.notebookId)}>
                  {notebookNameById.get(info.notebookId) ?? 'unnamed'}
                </span>
              )}
              <button
                type="button"
                className={styles.headerOpen}
                onClick={() => onOpenNote(info.id)}
                aria-label="Open TODOS"
                title="Open TODOS"
              >
                <ArrowSquareOut size={12} aria-hidden />
              </button>
            </>
          ) : undefined,
        }
      }),
    [todosById, notebookNameById, onOpenNote]
  )

  const onDrop = useCallback(
    (id: string, key: string, tasksById: Map<string, Task>) => {
      const task = tasksById.get(id)
      const parentNoteId = key === NO_TODOS_KEY ? null : key
      if (!task || task.parentNoteId === parentNoteId) return
      onUpdateTasks([{ id, patch: { parentNoteId } }])
    },
    [onUpdateTasks]
  )

  return <BoardView {...props} ariaLabel="tasks by TODOS board" columnsFor={columnsFor} onDrop={onDrop} />
}
