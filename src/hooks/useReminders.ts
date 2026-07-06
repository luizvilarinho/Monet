import { useCallback, useEffect, useRef } from 'react'
import { emit } from '@tauri-apps/api/event'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { CALENDAR_NOTEBOOK_ID, formatCalendarTitle } from '../lib/calendar'
import { storage } from '../storage'
import type { Note } from '../types'

// Scheduler de lembretes. Roda APENAS na janela main (única viva em segundo
// plano — o X esconde, nunca fecha), por isso não há disparo duplicado com a
// janela keep. Modelo de varredura: cada verificação recalcula "hoje" e relê o
// conteúdo atual da nota diária — cobre virada do dia, edição/remoção de chips
// e o throttling de timers do WebView2 (disparo atrasado ainda é entregue).
const TICK_MS = 30_000
// Vencidos há mais de 60s são notificados como "Missed reminders" (cobre
// também os perdidos com o app fechado, detectados na primeira verificação).
const MISSED_THRESHOLD_MS = 60_000

interface ReminderEntry {
  id: string
  time: string
  hours: number
  minutes: number
  text: string
}

// Extrai os chips do markdown da nota. Tolerante à ordem dos atributos;
// chip malformado (sem id ou horário inválido) é ignorado silenciosamente.
function extractReminders(content: string): ReminderEntry[] {
  const out: ReminderEntry[] = []
  for (const line of content.split('\n')) {
    const matches = line.match(/<reminder-chip\b[^>]*>/g)
    if (!matches) continue
    const text = line.replace(/<[^>]*>/g, '').trim() || 'Reminder'
    for (const m of matches) {
      const idMatch = m.match(/data-id="([^"]+)"/)
      const timeMatch = m.match(/data-time="(\d{2}):(\d{2})"/)
      if (!idMatch || !timeMatch) continue
      const hours = Number(timeMatch[1])
      const minutes = Number(timeMatch[2])
      if (hours > 23 || minutes > 59) continue
      out.push({
        id: idMatch[1],
        time: `${timeMatch[1]}:${timeMatch[2]}`,
        hours,
        minutes,
        text,
      })
    }
  }
  return out
}

export function useReminders(
  notes: Note[],
  onFired?: (noteId: string, ids: string[]) => void
) {
  const notesRef = useRef(notes)
  notesRef.current = notes
  const onFiredRef = useRef(onFired)
  onFiredRef.current = onFired
  // Ids já disparados da nota de hoje (carregados do banco uma vez por nota).
  const firedNoteIdRef = useRef<string | null>(null)
  const firedIdsRef = useRef<Set<string>>(new Set())
  const permissionWarnedRef = useRef(false)
  const checkingRef = useRef(false)

  const check = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    try {
      const now = new Date()
      const today = formatCalendarTitle(now)
      const note = notesRef.current.find(
        (n) => n.notebookId === CALENDAR_NOTEBOOK_ID && n.title === today
      )
      if (!note) return
      const reminders = extractReminders(note.content)
      if (reminders.length === 0) return

      if (firedNoteIdRef.current !== note.id) {
        const ids = await storage.getFiredReminderIds(note.id)
        firedNoteIdRef.current = note.id
        firedIdsRef.current = new Set(ids)
      }
      const fired = firedIdsRef.current

      const nowMs = now.getTime()
      const due: { entry: ReminderEntry; delayMs: number }[] = []
      for (const entry of reminders) {
        if (fired.has(entry.id)) continue
        const at = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          entry.hours,
          entry.minutes
        ).getTime()
        if (at <= nowMs) due.push({ entry, delayMs: nowMs - at })
      }
      if (due.length === 0) return

      let granted = await isPermissionGranted()
      if (!granted) {
        granted = (await requestPermission()) === 'granted'
      }
      if (!granted) {
        // Sem permissão: nada é marcado como disparado — se a permissão for
        // concedida depois, os lembretes saem como atrasados.
        if (!permissionWarnedRef.current) {
          permissionWarnedRef.current = true
          console.warn('notification permission denied — reminders stay visual only')
        }
        return
      }

      const onTime = due.filter((d) => d.delayMs <= MISSED_THRESHOLD_MS)
      const missed = due.filter((d) => d.delayMs > MISSED_THRESHOLD_MS)
      if (onTime.length > 0) {
        sendNotification({
          title: onTime.length === 1 ? 'Reminder' : 'Reminders',
          body: onTime.map((d) => `${d.entry.time} — ${d.entry.text}`).join('\n'),
        })
      }
      if (missed.length > 0) {
        sendNotification({
          title: 'Missed reminders',
          body: missed.map((d) => `${d.entry.time} — ${d.entry.text}`).join('\n'),
        })
      }

      const ids = due.map((d) => d.entry.id)
      await storage.markRemindersFired(ids, note.id)
      for (const id of ids) fired.add(id)
      onFiredRef.current?.(note.id, ids)
      // Avisa a janela keep para riscar os chips dela também.
      void emit('reminders-fired', { noteId: note.id, ids })
    } catch (err) {
      console.error('reminder check failed', err)
    } finally {
      checkingRef.current = false
    }
  }, [])

  useEffect(() => {
    void check()
    const interval = setInterval(() => {
      void check()
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [check])

  // Recomputo quando as notas mudam (chip inserido/removido/editado).
  useEffect(() => {
    void check()
  }, [notes, check])
}
