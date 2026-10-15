import { useEffect, useRef } from 'react'
import { addDaysKey } from '../../lib/tasks'
import type { useTaskKeyboard } from './useTaskKeyboard'
import styles from './TaskBatchBar.module.css'

type TaskKeyboard = ReturnType<typeof useTaskKeyboard>

// Barra de lote (2+ tasks selecionadas) no rodapé da visão e o popover de
// data do atalho `d` / "Pick date…". Toda ação grava o Do date.
export function TaskBatchBar({ kb, todayKey }: { kb: TaskKeyboard; todayKey: string }) {
  const count = kb.selectedIds.size
  return (
    <>
      {count >= 2 && (
        <div className={styles.bar} role="toolbar" aria-label="selected tasks">
          <span className={styles.count}>{count} selected</span>
          <button type="button" className={styles.action} onClick={() => kb.schedule(todayKey)}>
            Today
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => kb.schedule(addDaysKey(todayKey, 1))}
          >
            Tomorrow
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => kb.schedule(kb.nextMonday)}
            title="Next Monday"
          >
            Next week
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={(e) => kb.openDatePicker(e.currentTarget)}
          >
            Pick date…
          </button>
          <button type="button" className={styles.action} onClick={kb.markDone}>
            Done
          </button>
          <button type="button" className={styles.action} onClick={kb.deleteSelected}>
            Delete
          </button>
          <button type="button" className={styles.clear} onClick={kb.clearSelection}>
            Clear
          </button>
        </div>
      )}
      {kb.confirmModal}
      {kb.datePickerAt && (
        <TaskDatePopover
          at={kb.datePickerAt}
          onPick={(key) => {
            kb.closeDatePicker()
            kb.schedule(key)
          }}
          onClose={kb.closeDatePicker}
        />
      )}
    </>
  )
}

function TaskDatePopover({
  at,
  onPick,
  onClose,
}: {
  at: { top: number; left: number }
  onPick: (key: string) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const input = inputRef.current
    input?.focus()
    try {
      input?.showPicker()
    } catch {
      /* sem ativação do usuário: o campo continua editável */
    }
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div ref={rootRef} className={styles.popover} style={{ top: at.top, left: at.left }}>
      <input
        ref={inputRef}
        type="date"
        className={styles.dateInput}
        aria-label="do date"
        onChange={(e) => {
          // Digitando o ano, o campo passa por datas como 0002-10-12.
          if (e.target.value >= '1900') onPick(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      />
    </div>
  )
}
