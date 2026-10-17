import { useCallback } from 'react'
import { compareTasks, isOpen, isOverdue, planDate } from '../../lib/tasks'
import type { Task } from '../../types'
import { BoardView, type BoardViewProps } from './BoardView'
import type { BoardColumn } from './BoardColumns'

// Visão My Day (Plan today): "My Day" = tasks planejadas para hoje; "Suggested"
// = atrasadas, vencendo/planejadas para hoje e as planejadas em dias
// anteriores e não concluídas (rollover). Sugerir não muta nada: arrastar para
// Today grava `plannedDay`, sem tocar em Do date/Deadline. A lista esvazia sozinha
// na virada do dia, porque compara `plannedDay` com a chave de hoje.
type TodayBoardProps = Omit<
  BoardViewProps,
  'ariaLabel' | 'columnsFor' | 'onDrop' | 'showProject' | 'compactStatus'
>

const TODAY = 'today'
const SUGGESTED = 'suggested'

export function TodayBoard(props: TodayBoardProps) {
  const { todayKey, onUpdateTasks } = props

  const columnsFor = useCallback(
    (projectTasks: Task[]): BoardColumn[] => {
      const open = projectTasks.filter(isOpen)
      const planned = open.filter((t) => t.plannedDay === todayKey).sort(compareTasks)
      const suggested = open
        .filter(
          (t) =>
            t.plannedDay !== todayKey &&
            (isOverdue(t, todayKey) ||
              t.dueDate === todayKey ||
              planDate(t) === todayKey ||
              (t.plannedDay !== null && t.plannedDay < todayKey))
        )
        .sort(compareTasks)
      return [
        { key: TODAY, title: 'My Day', count: planned.length, tasks: planned },
        { key: SUGGESTED, title: 'Suggested', count: suggested.length, tasks: suggested },
      ]
    },
    [todayKey]
  )

  const onDrop = useCallback(
    (id: string, key: string, tasksById: Map<string, Task>) => {
      const task = tasksById.get(id)
      if (!task) return
      const plannedDay = key === TODAY ? todayKey : null
      if (task.plannedDay === plannedDay) return
      onUpdateTasks([{ id, patch: { plannedDay } }])
    },
    [todayKey, onUpdateTasks]
  )

  return <BoardView {...props} ariaLabel="today board" columnsFor={columnsFor} onDrop={onDrop} />
}
