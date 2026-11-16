import { useCallback, useEffect, useState } from 'react'
import { loadOpenEntries, recordOpenEntry, saveOpenEntries, type OpenEntry, type OpenEntryKind } from '../lib/openNotes'

interface DayList {
  day: string
  entries: OpenEntry[]
  // Lista de antes do Clear all, para o Undo. Sai na próxima abertura (o
  // `record` monta a lista sem ela) e não vai para o localStorage.
  cleared?: OpenEntry[]
}

// Lista das notas e tasks abertas hoje: registra `noteId` sempre que ele muda
// (e de novo na virada do dia, com a mesma nota aberta). `record` registra
// outro item (a nota da lateral, uma task aberta).
export function useOpenNotes(noteId: string | null, today: string) {
  const [list, setList] = useState<DayList>(() => ({ day: today, entries: loadOpenEntries(today) }))

  const record = useCallback(
    (kind: OpenEntryKind, id: string) => {
      setList((prev) => {
        const base = prev.day === today ? prev.entries : []
        if (prev.day === today && base[0]?.kind === kind && base[0].id === id) return prev
        return { day: today, entries: recordOpenEntry(base, kind, id, Date.now()) }
      })
    },
    [today]
  )

  useEffect(() => {
    if (noteId) record('note', noteId)
  }, [noteId, record])

  useEffect(() => {
    saveOpenEntries(list.day, list.entries)
  }, [list])

  const remove = useCallback((kind: OpenEntryKind, id: string) => {
    setList((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.kind !== kind || e.id !== id) }))
  }, [])

  // Esvazia o registro do dia (nada é apagado), menos `keep`, o item aberto no
  // clique; o que for aberto depois volta a entrar.
  const clear = useCallback(
    (keep: Pick<OpenEntry, 'kind' | 'id'> | null) =>
      setList((prev) => {
        const entries = prev.day === today ? prev.entries : []
        return {
          day: today,
          entries: entries.filter((e) => e.kind === keep?.kind && e.id === keep.id),
          cleared: entries,
        }
      }),
    [today]
  )

  const undoClear = useCallback(
    () => setList((prev) => (prev.day === today && prev.cleared ? { day: today, entries: prev.cleared } : prev)),
    [today]
  )

  const isToday = list.day === today
  return {
    entries: isToday ? list.entries : [],
    record,
    remove,
    clear,
    canUndoClear: isToday && (list.cleared?.length ?? 0) > 0,
    undoClear,
  }
}
