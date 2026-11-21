import { useEffect, useRef } from 'react'
import { ArrowCounterClockwise, X } from '@phosphor-icons/react'
import { addDaysKey } from '../../lib/tasks'
import type { useTaskKeyboard } from './useTaskKeyboard'
import type { TaskActions } from './useTaskActions'
import styles from './TaskBatchBar.module.css'

type TaskKeyboard = ReturnType<typeof useTaskKeyboard>

// Barra de lote (2+ tasks selecionadas) no rodapé da visão, a barra "Undo" da
// última ação e o popover de data do atalho `d` / "Pick date…". As datas do
// lote gravam o Do date; "Drop" tem Undo, "Delete permanently…" pede confirmação.
// Depois de uma ação no lote, o Undo toma o lugar da barra de lote pelo prazo
// dele; a seleção fica (os atalhos seguem valendo para ela) e a barra de lote
// volta com o Undo, o X ou o fim do prazo.
export function TaskBatchBar({ kb, todayKey }: { kb: TaskKeyboard; todayKey: string }) {
  const count = kb.selectedIds.size
  const showBatch = count >= 2 && !kb.actions.undoMessage
  return (
    <>
      {!showBatch && <TaskUndoBar actions={kb.actions} />}
      {showBatch && (
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
          <button type="button" className={styles.action} onClick={kb.dropSelected}>
            Drop
          </button>
          <button type="button" className={`${styles.action} ${styles.danger}`} onClick={kb.deleteSelected}>
            Delete permanently…
          </button>
          <button type="button" className={styles.clear} onClick={kb.clearSelection}>
            Clear
          </button>
        </div>
      )}
      {kb.confirmModal}
      {kb.actions.modal}
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

// "Task marked done. Undo" depois de concluir, drop, snooze, arrasto e lote.
export function TaskUndoBar({ actions }: { actions: TaskActions }) {
  if (!actions.undoMessage) return null
  return (
    <div className={styles.bar} role="status">
      <span className={styles.message}>{actions.undoMessage}</span>
      {actions.undoExtraLabel && (
        <button type="button" className={styles.action} onClick={actions.runUndoExtra}>
          {actions.undoExtraLabel}
        </button>
      )}
      <button type="button" className={styles.action} onClick={actions.runUndo}>
        <ArrowCounterClockwise size={12} aria-hidden />
        Undo
      </button>
      <button type="button" className={styles.dismiss} onClick={actions.dismissUndo} aria-label="Dismiss">
        <X size={12} aria-hidden />
      </button>
    </div>
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
