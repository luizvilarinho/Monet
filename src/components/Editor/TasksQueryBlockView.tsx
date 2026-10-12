import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useMemo, useState } from 'react'
import { ListChecks } from '@phosphor-icons/react'
import {
  filterTasksForBlock,
  parseTasksFilter,
  renderTasksBlockText,
} from '../../lib/tasks'
import { TaskLine } from '../TasksView/TaskLine'
import { useTasksContext } from './TasksContext'
import type { TasksQueryBlockStorage } from './TasksQueryBlock'
import styles from './TasksQueryBlockView.module.css'

export function TasksQueryBlockView({ node, editor, updateAttributes }: NodeViewProps) {
  const filterText = node.attrs.filter as string
  const { tasksById, todayKey, notebooks = [], onOpenTask, onToggleTask, checklist } = useTasksContext()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(filterText)

  const allTasks = useMemo(() => [...tasksById.values()], [tasksById])
  const filter = useMemo(() => parseTasksFilter(filterText, notebooks), [filterText, notebooks])
  const list = useMemo(
    () => filterTasksForBlock(allTasks, filter, todayKey),
    [allTasks, filter, todayKey]
  )
  const nameById = useMemo(() => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])), [notebooks])

  // Cópia (clipboard): o bloco sai como a lista legível, não como o filtro.
  useEffect(() => {
    const storage = (editor.storage as unknown as Record<string, TasksQueryBlockStorage>)
      .tasksQueryBlock
    if (!storage) return
    storage.resolveText = (text) =>
      renderTasksBlockText(
        text,
        filterTasksForBlock(allTasks, parseTasksFilter(text, notebooks), todayKey)
      )
  }, [editor, allTasks, notebooks, todayKey])

  function commit() {
    const next = draft.trim() || 'this week'
    setEditing(false)
    if (next !== filterText) updateAttributes({ filter: next })
  }

  return (
    <NodeViewWrapper className={styles.block}>
      <div contentEditable={false}>
        <div className={styles.header}>
          <ListChecks size={13} aria-hidden />
          {editing ? (
            <input
              className={styles.filterInput}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit()
                }
                if (e.key === 'Escape') {
                  setDraft(filterText)
                  setEditing(false)
                }
              }}
              aria-label="tasks filter"
              title="this week, today, overdue, all, #Project"
            />
          ) : (
            <button
              type="button"
              className={styles.filter}
              onClick={() => {
                setDraft(filterText)
                setEditing(true)
              }}
              title="Edit filter (this week, today, overdue, all, #Project)"
            >
              Tasks · {filterText}
            </button>
          )}
          <span className={styles.count}>{list.length}</span>
        </div>
        {filter.unknownProject && (
          <span className={styles.warning}>Unknown project #{filter.unknownProject}</span>
        )}
        {list.length === 0 && !filter.unknownProject ? (
          <span className={styles.empty}>No tasks</span>
        ) : (
          list.map((t) => (
            <TaskLine
              key={t.id}
              task={t}
              todayKey={todayKey}
              projectName={filter.notebookId === null ? nameById.get(t.notebookId) : undefined}
              checklist={checklist?.get(t.id)}
              onSelect={() => onOpenTask?.(t.id)}
              onToggle={(done) => onToggleTask?.(t.id, done)}
            />
          ))
        )}
      </div>
    </NodeViewWrapper>
  )
}
