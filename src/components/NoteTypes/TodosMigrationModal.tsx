import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { MigrationRow } from '../../lib/todosMigration'
import styles from './TodosMigrationModal.module.css'

// Dry-run da migração group → TODOS: abrir não grava nada. Cada linha vira uma
// nota TODOS no caderno (marcadas por padrão, inclusive as só com concluídas);
// "Migrate" grava só as marcadas; as desmarcadas não voltam a ser oferecidas.
// "Later" fecha nesta sessão.
interface TodosMigrationModalProps {
  rows: MigrationRow[]
  status: 'idle' | 'running' | 'done' | 'error'
  // Resumo (done) ou erro (error).
  message: string | null
  onMigrate: (rows: MigrationRow[], skipped: MigrationRow[]) => void
  onClose: () => void
}

export function TodosMigrationModal({ rows, status, message, onMigrate, onClose }: TodosMigrationModalProps) {
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set())
  const selected = rows.filter((r) => !unchecked.has(r.key))
  const skipped = rows.filter((r) => unchecked.has(r.key))
  const taskCount = selected.reduce((n, r) => n + r.taskIds.length, 0)
  const running = status === 'running'

  function toggle(key: string) {
    setUnchecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) onClose()
      }}
    >
      <div className={styles.card} role="dialog" aria-modal="true" aria-label="Migrate groups to TODOS">
        <p className={styles.title}>Migrate groups to TODOS</p>
        <p className={styles.text}>
          Each task group becomes a TODOS note in its notebook, with the tasks as a checklist. Nothing is saved
          until you click Migrate. The old group stays stored; tasks without a group keep no TODOS. Unchecked groups
          are not offered again.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Create</th>
                <th>Notebook</th>
                <th>TODOS</th>
                <th>Open</th>
                <th>Done</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={unchecked.has(r.key) ? styles.rowOff : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!unchecked.has(r.key)}
                      disabled={running || status === 'done'}
                      onChange={() => toggle(r.key)}
                      aria-label={`create TODOS ${r.title}`}
                    />
                  </td>
                  <td className={styles.cellText} title={r.notebookName}>
                    {r.notebookName}
                  </td>
                  <td className={styles.cellText} title={r.spellings.join(' / ')}>
                    {r.title}
                    {r.spellings.length > 1 && <span className={styles.muted}> ({r.spellings.join(' / ')})</span>}
                    {r.onlyClosed && <span className={styles.muted}> · only done</span>}
                    {r.noteExists && <span className={styles.muted}> · already created</span>}
                  </td>
                  <td className={styles.cellNum}>{r.open}</td>
                  <td className={styles.cellNum}>{r.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {message && <p className={status === 'error' ? styles.error : styles.text}>{message}</p>}
        <div className={styles.actions}>
          <span className={styles.totals}>
            {selected.length} TODOS · {taskCount} task{taskCount === 1 ? '' : 's'}
          </span>
          {status === 'done' ? (
            <button type="button" className={styles.btnPrimary} onClick={onClose} autoFocus>
              Close
            </button>
          ) : (
            <>
              <button type="button" className={styles.btnCancel} onClick={onClose} disabled={running}>
                Later
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => onMigrate(selected, skipped)}
                disabled={running}
              >
                {running ? 'Migrating…' : 'Migrate'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
