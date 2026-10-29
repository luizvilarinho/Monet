import { useCallback } from 'react'
import { byTodosId, compareTasks, isOpen, type TodosInfo } from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { BoardView, type BoardViewProps } from './BoardView'
import type { BoardColumn, BoardSection } from './BoardColumns'
import { ProjectColorButton } from './ProjectColorButton'
import { useTasksEnv } from './TasksEnv'

// Visão Projects: uma coluna por projeto (caderno, inclusive Inbox) com as
// tasks abertas, em subseções por TODOS ("No TODOS" ao final). Projeto sem
// tasks abertas não aparece. Arrastar para outra coluna move a task e a
// nota-corpo para o projeto.
type ProjectsBoardProps = Omit<
  BoardViewProps,
  'ariaLabel' | 'columnsFor' | 'onDrop' | 'showProject' | 'compactStatus'
>

// Subseções por TODOS: alfabético, sem TODOS por último (com rótulo só se
// houver alguma TODOS).
function sectionsByTodos(
  tasks: Task[],
  todosById: Map<string, TodosInfo>
): BoardSection<Task>[] {
  const groups = byTodosId(tasks, todosById)
  const named = [...groups.entries()]
    .filter(([id]) => id !== null)
    .map(([id, list]) => ({ label: todosById.get(id!)?.title.trim() || 'Untitled', items: list.sort(compareTasks) }))
  const none = groups.get(null)
  if (!none) return named
  return [...named, { label: named.length > 0 ? 'No TODOS' : null, items: none.sort(compareTasks) }]
}

export function ProjectsBoard(props: ProjectsBoardProps) {
  const { onMoveTaskToProject, onSetProjectColor, todosById } = useTasksEnv()
  const { notebooks } = props

  const columnsFor = useCallback(
    (projectTasks: Task[]): BoardColumn<Task>[] => {
      const open = projectTasks.filter(isOpen)
      const byNotebook = new Map<string, Task[]>()
      for (const t of open) {
        const list = byNotebook.get(t.notebookId) ?? []
        list.push(t)
        byNotebook.set(t.notebookId, list)
      }
      const known = new Set(notebooks.map((nb) => nb.id))
      const projects: Array<Pick<Notebook, 'id' | 'name' | 'color'>> = [
        ...notebooks,
        ...[...byNotebook.keys()]
          .filter((id) => !known.has(id))
          .map((id) => ({ id, name: 'unnamed', color: null })),
      ]
      return projects
        .filter((nb) => byNotebook.has(nb.id))
        .map((nb) => {
          const list = byNotebook.get(nb.id)!
          const sections = sectionsByTodos(list, todosById)
          return {
            key: nb.id,
            title: nb.name || 'unnamed',
            color: nb.color ?? null,
            count: list.length,
            items: sections.flatMap((s) => s.items),
            sections,
            headerExtra: (
              <ProjectColorButton
                color={nb.color ?? null}
                projectName={nb.name || 'unnamed'}
                onChange={(color) => onSetProjectColor(nb.id, color)}
              />
            ),
          }
        })
    },
    [notebooks, onSetProjectColor, todosById]
  )

  const onDrop = useCallback(
    (id: string, notebookId: string, tasksById: Map<string, Task>) => {
      const task = tasksById.get(id)
      if (!task || task.notebookId === notebookId) return
      onMoveTaskToProject(id, notebookId)
    },
    [onMoveTaskToProject]
  )

  return (
    <BoardView
      {...props}
      ariaLabel="projects board"
      columnsFor={columnsFor}
      onDrop={onDrop}
      showProject={false}
    />
  )
}
