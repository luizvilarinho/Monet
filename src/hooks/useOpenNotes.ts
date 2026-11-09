import { useCallback, useEffect, useState } from 'react'
import { loadOpenNotes, recordOpenNote, saveOpenNotes, type OpenNoteEntry } from '../lib/openNotes'

interface DayList {
  day: string
  entries: OpenNoteEntry[]
}

// Lista das notas abertas hoje: registra `noteId` sempre que ele muda (e de
// novo na virada do dia, com a mesma nota aberta). `record` registra outra
// nota (a da lateral).
export function useOpenNotes(noteId: string | null, today: string) {
  const [list, setList] = useState<DayList>(() => ({ day: today, entries: loadOpenNotes(today) }))

  const record = useCallback(
    (id: string) => {
      setList((prev) => {
        const base = prev.day === today ? prev.entries : []
        if (prev.day === today && base[0]?.noteId === id) return prev
        return { day: today, entries: recordOpenNote(base, id, Date.now()) }
      })
    },
    [today]
  )

  useEffect(() => {
    if (noteId) record(noteId)
  }, [noteId, record])

  useEffect(() => {
    saveOpenNotes(list.day, list.entries)
  }, [list])

  const remove = useCallback((id: string) => {
    setList((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.noteId !== id) }))
  }, [])

  return { entries: list.day === today ? list.entries : [], record, remove }
}
