import { formatDueShort, statusColor, statusName, type TodosProgress } from '../../lib/tasks'
import type { Task, TaskStatusDef } from '../../types'
import styles from './TodosPanel.module.css'

// Faixa da nota TODOS: progresso derivado das tasks vinculadas (não do
// Markdown) e o bloco "Linked outside this checklist" (tasks da TODOS sem pill
// na nota). Inserir no checklist é sempre por clique.
interface TodosPanelProps {
  progress: TodosProgress | undefined
  // Tasks vinculadas sem pill no conteúdo da nota.
  outside: Task[]
  statuses: TaskStatusDef[]
  onOpenTask: (id: string) => void
  onInsert: (task: Task) => void
}

export function TodosPanel({ progress, outside, statuses, onOpenTask, onInsert }: TodosPanelProps) {
  const done = progress?.done ?? 0
  const total = progress?.total ?? 0
  const tone = progress?.overdue ? styles.overdue : total > 0 && done === total ? styles.complete : ''
  return (
    <div className={styles.panel}>
      <div className={`${styles.summary} ${tone}`}>
        <span className={styles.label}>TODOS</span>
        <span>
          {done}/{total}
        </span>
        {progress?.nextDeadline && <span title="Next deadline">⚑ {formatDueShort(progress.nextDeadline)}</span>}
      </div>
      {outside.length > 0 && (
        <div className={styles.outside}>
          <span className={styles.outsideTitle}>Linked outside this checklist</span>
          {outside.map((t) => (
            <div key={t.id} className={styles.item}>
              <span
                className={styles.dot}
                style={{ background: statusColor(t.status, statuses) }}
                title={statusName(t.status, statuses)}
                aria-hidden
              />
              <button type="button" className={styles.itemTitle} onClick={() => onOpenTask(t.id)} title={t.title}>
                {t.title || 'Untitled'}
              </button>
              <button type="button" className={styles.insert} onClick={() => onInsert(t)}>
                Insert into checklist
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
