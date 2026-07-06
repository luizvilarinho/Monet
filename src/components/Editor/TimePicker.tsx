import { useEffect, useRef, useState } from 'react'
import styles from './TimePicker.module.css'

interface TimePickerProps {
  position: { top: number; left: number }
  onConfirm: (time: string) => void
  onCancel: () => void
}

function defaultTime(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// Mini seletor de horário do gatilho "@" nas notas diárias do Calendar.
// Enter confirma, Esc/clique fora cancela (o chamador insere "@" literal).
export function TimePicker({ position, onConfirm, onCancel }: TimePickerProps) {
  const [time, setTime] = useState(defaultTime)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = document.querySelector('[data-time-picker]')
      if (el && !el.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onCancel])

  function confirm() {
    if (/^\d{2}:\d{2}$/.test(time)) {
      onConfirm(time)
    } else {
      onCancel()
    }
  }

  return (
    <div
      data-time-picker
      className={styles.popup}
      style={{ top: position.top, left: position.left }}
    >
      <span className={styles.label}>Reminder</span>
      <input
        ref={inputRef}
        className={styles.input}
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            confirm()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        aria-label="reminder time"
      />
      <button type="button" className={styles.confirm} onMouseDown={(e) => { e.preventDefault(); confirm() }}>
        Set
      </button>
    </div>
  )
}
