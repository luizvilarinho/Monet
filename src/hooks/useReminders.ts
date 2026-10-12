import { useCallback, useEffect, useRef } from 'react'
import { emit } from '@tauri-apps/api/event'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs, formatCalendarTitle } from '../lib/calendar'
import { addDaysKey, isOpen } from '../lib/tasks'
import { storage } from '../storage'
import type { Note, Task } from '../types'

// Scheduler de lembretes. Roda APENAS na janela main (única viva em segundo
// plano — o X esconde, nunca fecha), por isso não há disparo duplicado com a
// janela keep. Modelo de varredura: cada verificação recalcula "hoje" e relê o
// conteúdo atual da nota diária — cobre virada do dia, edição/remoção de chips
// e o throttling de timers do WebView2 (disparo atrasado ainda é entregue).
const TICK_MS = 30_000
// Vencidos há mais de 60s são notificados como "Missed reminders" (cobre
// também os perdidos com o app fechado, detectados na primeira verificação).
const MISSED_THRESHOLD_MS = 60_000
// Lembretes de deadline (véspera e dia da entrega): a partir desta hora local.
const DEADLINE_REMINDER_HOUR = 9
// Estado de disparo dos lembretes de deadline: em reminder_state, sob este
// note_id fixo (não é uma nota real).
const DEADLINE_STATE_ID = 'task-deadlines'

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
  onFired: ((noteId: string, ids: string[]) => void) | undefined,
  tasks: Task[]
) {
  const notesRef = useRef(notes)
  notesRef.current = notes
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  // Ids de lembretes de deadline já disparados (carregados uma vez).
  const firedDeadlinesRef = useRef<Set<string> | null>(null)
  const onFiredRef = useRef(onFired)
  onFiredRef.current = onFired
  // Ids já disparados da nota de hoje (carregados do banco uma vez por nota).
  const firedNoteIdRef = useRef<string | null>(null)
  const firedIdsRef = useRef<Set<string>>(new Set())
  const permissionWarnedRef = useRef(false)
  const checkingRef = useRef(false)

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    let granted = await isPermissionGranted()
    if (!granted) {
      granted = (await requestPermission()) === 'granted'
    }
    if (!granted && !permissionWarnedRef.current) {
      permissionWarnedRef.current = true
      console.warn('notification permission denied — reminders stay visual only')
    }
    return granted
  }, [])

  // Chips <reminder-chip> da nota diária de hoje.
  const checkNoteReminders = useCallback(async (now: Date) => {
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

    // Sem permissão: nada é marcado como disparado — se a permissão for
    // concedida depois, os lembretes saem como atrasados.
    if (!(await ensurePermission())) return

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
  }, [ensurePermission])

  // Deadlines de tasks abertas: véspera ("Deadline tomorrow") e dia ("Due
  // today"), uma vez cada, a partir das 09:00.
  const checkDeadlines = useCallback(async (now: Date) => {
    if (now.getHours() < DEADLINE_REMINDER_HOUR) return
    const today = dateKeyFromMs(now.getTime())
    const tomorrow = addDaysKey(today, 1)
    const eve: Array<{ id: string; title: string }> = []
    const day: Array<{ id: string; title: string }> = []
    for (const t of tasksRef.current) {
      if (!isOpen(t)) continue
      if (t.dueDate === tomorrow) eve.push({ id: `deadline:${t.id}:${t.dueDate}:eve`, title: t.title })
      else if (t.dueDate === today) day.push({ id: `deadline:${t.id}:${t.dueDate}:day`, title: t.title })
    }
    if (eve.length === 0 && day.length === 0) return

    if (!firedDeadlinesRef.current) {
      firedDeadlinesRef.current = new Set(await storage.getFiredReminderIds(DEADLINE_STATE_ID))
    }
    const fired = firedDeadlinesRef.current
    const dueEve = eve.filter((e) => !fired.has(e.id))
    const dueDay = day.filter((e) => !fired.has(e.id))
    if (dueEve.length === 0 && dueDay.length === 0) return
    if (!(await ensurePermission())) return

    if (dueEve.length > 0) {
      sendNotification({ title: 'Deadline tomorrow', body: dueEve.map((e) => e.title).join('\n') })
    }
    if (dueDay.length > 0) {
      sendNotification({ title: 'Due today', body: dueDay.map((e) => e.title).join('\n') })
    }
    const ids = [...dueEve, ...dueDay].map((e) => e.id)
    await storage.markRemindersFired(ids, DEADLINE_STATE_ID)
    for (const id of ids) fired.add(id)
  }, [ensurePermission])

  const check = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    const now = new Date()
    try {
      await checkNoteReminders(now)
    } catch (err) {
      console.error('reminder check failed', err)
    }
    try {
      await checkDeadlines(now)
    } catch (err) {
      console.error('reminder check failed', err)
    } finally {
      checkingRef.current = false
    }
  }, [checkNoteReminders, checkDeadlines])

  useEffect(() => {
    void check()
    const interval = setInterval(() => {
      void check()
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [check])

  // Recomputo quando as notas mudam (chip inserido/removido/editado) ou as
  // tasks mudam (deadline alterado).
  useEffect(() => {
    void check()
  }, [notes, tasks, check])
}
