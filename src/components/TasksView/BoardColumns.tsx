import type { ReactNode } from 'react'
import type { Task } from '../../types'
import { useCardDrag } from './useCardDrag'
import styles from './BoardColumns.module.css'

// Colunas de cards arrastáveis, comuns a Kanban (status), Projects e Groups.
// O drop (mouse manual, useCardDrag) devolve `(taskId, columnKey)`.
export interface BoardColumn {
  key: string
  title: string
  // Cor do marcador do título (status/projeto); ausente = neutro.
  color?: string | null
  count: number
  // Acima do limite a coluna ganha estilo de aviso (nunca bloqueia o drop).
  wipLimit?: number | null
  faded?: boolean
  // Cards da coluna; `sections` agrupa os mesmos cards em subseções.
  tasks: Task[]
  sections?: Array<{ label: string | null; tasks: Task[] }>
  // Mostra "Clear done" no cabeçalho (coluna de concluídas).
  clearable?: boolean
  // Controle extra no cabeçalho (ex.: cor do projeto).
  headerExtra?: ReactNode
}

interface BoardColumnsProps {
  columns: BoardColumn[]
  onDrop: (taskId: string, columnKey: string) => void
  onClearColumn?: (column: BoardColumn) => void
  renderCard: (task: Task, column: BoardColumn) => ReactNode
}

export function BoardColumns({ columns, onDrop, onClearColumn, renderCard }: BoardColumnsProps) {
  const { draggingId, overKey, onCardMouseDown } = useCardDrag(onDrop)

  function card(t: Task, c: BoardColumn) {
    return (
      <div
        key={t.id}
        className={`${styles.card} ${t.id === draggingId ? styles.cardDragging : ''} ${
          c.faded ? styles.cardFaded : ''
        }`}
        onMouseDown={(e) => onCardMouseDown(e, t.id)}
      >
        {renderCard(t, c)}
      </div>
    )
  }

  return (
    <div className={styles.columns}>
      {columns.map((c) => {
        const overLimit = c.wipLimit != null && c.count > c.wipLimit
        return (
          <div
            key={c.key}
            data-drop-key={c.key}
            className={`${styles.column} ${overLimit ? styles.columnWip : ''} ${
              draggingId && overKey === c.key ? styles.columnOver : ''
            }`}
          >
            <div className={styles.columnHeader}>
              {c.color && <span className={styles.colorDot} style={{ background: c.color }} aria-hidden />}
              <span className={styles.columnLabel} title={c.title}>
                {c.title}
              </span>
              <span className={styles.columnCount}>
                {c.wipLimit != null ? `${c.count}/${c.wipLimit}` : c.count}
              </span>
              {c.headerExtra}
              {c.clearable && c.tasks.length > 0 && onClearColumn && (
                <button type="button" className={styles.headerAction} onClick={() => onClearColumn(c)}>
                  Clear done
                </button>
              )}
            </div>
            <div className={styles.cards}>
              {c.sections
                ? c.sections.map((s) => (
                    <div key={s.label ?? ''} className={styles.section}>
                      {s.label !== null && (
                        <span className={styles.sectionLabel} title={s.label}>
                          {s.label}
                        </span>
                      )}
                      {s.tasks.map((t) => card(t, c))}
                    </div>
                  ))
                : c.tasks.map((t) => card(t, c))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
