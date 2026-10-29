import type { ReactNode } from 'react'
import { useCardDrag } from './useCardDrag'
import styles from './BoardColumns.module.css'

// Colunas de cards arrastáveis, comuns aos boards de Tasks (Kanban, Projects,
// TODOS, My Day) e ao board de notas por tipo. O drop (mouse manual,
// useCardDrag) devolve `(itemId, columnKey)`.
export interface BoardSection<T> {
  label: string | null
  items: T[]
  // Com `dropKey` a seção também aceita drop e mostra a contagem; vazia, vira
  // uma faixa de altura fixa (tracejada durante o arrasto).
  dropKey?: string
  // Ação ao lado do rótulo, visível no hover da seção (ex.: "New").
  action?: ReactNode
}

export interface BoardColumn<T extends { id: string }> {
  key: string
  title: string
  // Cor do marcador do título (status/projeto); ausente = neutro.
  color?: string | null
  count: number
  // Acima do limite a coluna ganha estilo de aviso (nunca bloqueia o drop).
  wipLimit?: number | null
  faded?: boolean
  // Cards da coluna; `sections` agrupa os mesmos cards em subseções.
  items: T[]
  sections?: BoardSection<T>[]
  // Mostra "Clear done" no cabeçalho (coluna de concluídas).
  clearable?: boolean
  // Controle extra no cabeçalho (ex.: cor do projeto).
  headerExtra?: ReactNode
}

interface BoardColumnsProps<T extends { id: string }> {
  columns: BoardColumn<T>[]
  onDrop: (itemId: string, columnKey: string) => void
  onClearColumn?: (column: BoardColumn<T>) => void
  renderCard: (item: T, column: BoardColumn<T>) => ReactNode
}

export function BoardColumns<T extends { id: string }>({
  columns,
  onDrop,
  onClearColumn,
  renderCard,
}: BoardColumnsProps<T>) {
  const { draggingId, overKey, onCardMouseDown } = useCardDrag(onDrop)

  function card(t: T, c: BoardColumn<T>) {
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
    <div className={`${styles.columns} ${draggingId ? styles.columnsDragging : ''}`}>
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
              {c.clearable && c.items.length > 0 && onClearColumn && (
                <button type="button" className={styles.headerAction} onClick={() => onClearColumn(c)}>
                  Clear done
                </button>
              )}
            </div>
            <div className={styles.cards}>
              {c.sections
                ? c.sections.map((s, i) => (
                    // Índice na chave: duas TODOS podem ter o mesmo título.
                    <div
                      key={`${i}-${s.label ?? ''}`}
                      data-drop-key={s.dropKey}
                      className={`${styles.section} ${
                        s.dropKey !== undefined && s.items.length === 0 ? styles.sectionEmpty : ''
                      } ${draggingId && s.dropKey !== undefined && overKey === s.dropKey ? styles.sectionOver : ''}`}
                    >
                      {s.label !== null && (
                        <div className={styles.sectionHead}>
                          <span className={styles.sectionLabel} title={s.label}>
                            {s.label}
                          </span>
                          {s.dropKey !== undefined && <span className={styles.sectionCount}>{s.items.length}</span>}
                          {s.action && <span className={styles.sectionAction}>{s.action}</span>}
                        </div>
                      )}
                      {s.items.map((t) => card(t, c))}
                    </div>
                  ))
                : c.items.map((t) => card(t, c))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
