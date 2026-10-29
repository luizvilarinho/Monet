import { useCallback } from 'react'
import { dateKeyFromMs } from '../../lib/calendar'
import {
  compareTasks,
  endOfWeekKey,
  isDone,
  isDropped,
  openStatuses,
  startOfWeekKey,
  statusColor,
} from '../../lib/tasks'
import type { Task } from '../../types'
import { BoardView, type BoardViewProps } from './BoardView'
import type { BoardColumn } from './BoardColumns'
import { useTasksEnv } from './TasksEnv'

// Visão Kanban: uma coluna por status aberto (registro de status, na ordem)
// + Done (concluídas nesta semana, esmaecidas). Arrastar um card entre colunas
// muda o status; coluna acima do limite WIP só ganha aviso.
type KanbanBoardProps = Omit<BoardViewProps, 'ariaLabel' | 'columnsFor' | 'onDrop' | 'showProject' | 'compactStatus'>

export function KanbanBoard(props: KanbanBoardProps) {
  const { statuses } = useTasksEnv()
  const { todayKey, onUpdateTasks } = props

  const columnsFor = useCallback(
    (projectTasks: Task[]): BoardColumn<Task>[] => {
      const weekStart = startOfWeekKey(todayKey)
      const weekEnd = endOfWeekKey(todayKey)
      const known = new Set(statuses.map((s) => s.id))
      const open = openStatuses(statuses).map((s) => ({
        id: s.id,
        name: s.name,
        color: statusColor(s.id, statuses),
        wipLimit: s.wipLimit,
      }))
      // Status fora do registro (excluído em outra janela): coluna aberta com o id.
      const orphans = [
        ...new Set(
          projectTasks
            .filter((t) => !isDone(t) && !isDropped(t) && !known.has(t.status))
            .map((t) => t.status)
        ),
      ].map((id) => ({ id, name: id, color: statusColor(id, statuses), wipLimit: null }))

      const columns: BoardColumn<Task>[] = [...open, ...orphans].map((s) => {
        const list = projectTasks.filter((t) => t.status === s.id).sort(compareTasks)
        return {
          key: s.id,
          title: s.name,
          color: s.color,
          count: list.length,
          wipLimit: s.wipLimit,
          items: list,
        }
      })
      const done = projectTasks
        .filter((t) => {
          if (!isDone(t) || t.completedAt === null) return false
          const day = dateKeyFromMs(t.completedAt)
          return day >= weekStart && day <= weekEnd
        })
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      columns.push({
        key: 'done',
        title: 'Done this week',
        color: statusColor('done', statuses),
        count: done.length,
        faded: true,
        clearable: true,
        items: done,
      })
      return columns
    },
    [statuses, todayKey]
  )

  const onDrop = useCallback(
    (id: string, status: string, tasksById: Map<string, Task>) => {
      const task = tasksById.get(id)
      if (!task || task.status === status) return
      onUpdateTasks([{ id, patch: { status } }])
    },
    [onUpdateTasks]
  )

  return (
    <BoardView
      {...props}
      ariaLabel="kanban board"
      columnsFor={columnsFor}
      onDrop={onDrop}
      compactStatus
    />
  )
}
