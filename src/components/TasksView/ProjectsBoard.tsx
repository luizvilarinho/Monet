import { useCallback } from 'react'
import { compareTasks, isOpen } from '../../lib/tasks'
import type { Notebook, Task } from '../../types'
import { BoardView, type BoardViewProps } from './BoardView'
import type { BoardColumn } from './BoardColumns'
import { ProjectColorButton } from './ProjectColorButton'
import { useTasksEnv } from './TasksEnv'

// Visão Projects: uma coluna por projeto (caderno, inclusive Inbox) com as
// tasks abertas, em subseções por group ("No group" ao final). Projeto sem
// tasks abertas não aparece. Arrastar para outra coluna move a task e a
// nota-corpo para o projeto.
type ProjectsBoardProps = Omit<
  BoardViewProps,
  'ariaLabel' | 'columnsFor' | 'onDrop' | 'showProject' | 'showDoing'
>

const NO_GROUP = 'No group'

// Subseções por group: alfabético, sem group por último (com rótulo só se
// houver algum group nomeado).
function sectionsByGroup(tasks: Task[]): Array<{ label: string | null; tasks: Task[] }> {
  const byGroup = new Map<string | null, Task[]>()
  for (const t of tasks) {
    const list = byGroup.get(t.group) ?? []
    list.push(t)
    byGroup.set(t.group, list)
  }
  const named = [...byGroup.keys()]
    .filter((g): g is string => g !== null)
    .sort((a, b) => a.localeCompare(b))
  const sections: Array<{ label: string | null; tasks: Task[] }> = named.map((g) => ({
    label: g,
    tasks: byGroup.get(g)!.sort(compareTasks),
  }))
  const none = byGroup.get(null)
  if (none) sections.push({ label: named.length > 0 ? NO_GROUP : null, tasks: none.sort(compareTasks) })
  return sections
}

export function ProjectsBoard(props: ProjectsBoardProps) {
  const { onMoveTaskToProject, onSetProjectColor } = useTasksEnv()
  const { notebooks } = props

  const columnsFor = useCallback(
    (projectTasks: Task[]): BoardColumn[] => {
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
          const sections = sectionsByGroup(list)
          return {
            key: nb.id,
            title: nb.name || 'unnamed',
            color: nb.color ?? null,
            count: list.length,
            tasks: sections.flatMap((s) => s.tasks),
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
    [notebooks, onSetProjectColor]
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
