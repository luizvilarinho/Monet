import { useCallback } from 'react'
import { compareTasks, isOpen } from '../../lib/tasks'
import type { Task } from '../../types'
import { BoardView, type BoardViewProps } from './BoardView'
import type { BoardColumn } from './BoardColumns'

// Visão Groups: uma coluna por group (tasks abertas de todos os projetos
// filtrados), "No group" ao final. Arrastar para outra coluna muda o group.
type GroupsBoardProps = Omit<
  BoardViewProps,
  'ariaLabel' | 'columnsFor' | 'onDrop' | 'showProject' | 'showDoing'
>

const NO_GROUP_KEY = '__none__'

export function GroupsBoard(props: GroupsBoardProps) {
  const { onUpdateTasks } = props

  const columnsFor = useCallback((projectTasks: Task[]): BoardColumn[] => {
    const byGroup = new Map<string, Task[]>()
    for (const t of projectTasks) {
      if (!isOpen(t)) continue
      const key = t.group ?? NO_GROUP_KEY
      const list = byGroup.get(key) ?? []
      list.push(t)
      byGroup.set(key, list)
    }
    const named = [...byGroup.keys()]
      .filter((k) => k !== NO_GROUP_KEY)
      .sort((a, b) => a.localeCompare(b))
    const keys = byGroup.has(NO_GROUP_KEY) ? [...named, NO_GROUP_KEY] : named
    return keys.map((key) => {
      const list = byGroup.get(key)!.sort(compareTasks)
      return {
        key,
        title: key === NO_GROUP_KEY ? 'No group' : key,
        count: list.length,
        tasks: list,
      }
    })
  }, [])

  const onDrop = useCallback(
    (id: string, key: string, tasksById: Map<string, Task>) => {
      const task = tasksById.get(id)
      const group = key === NO_GROUP_KEY ? null : key
      if (!task || task.group === group) return
      onUpdateTasks([{ id, patch: { group } }])
    },
    [onUpdateTasks]
  )

  return <BoardView {...props} ariaLabel="groups board" columnsFor={columnsFor} onDrop={onDrop} />
}
