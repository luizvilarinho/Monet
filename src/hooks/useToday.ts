import { useEffect, useState } from 'react'
import { dateKeyFromMs } from '../lib/calendar'

const TICK_MS = 60_000

// Chave `YYYY-MM-DD` (local) do dia de hoje, atualizada na virada do dia
// (tick de 60s + foco da janela).
export function useToday(): string {
  const [todayKey, setTodayKey] = useState(() => dateKeyFromMs(Date.now()))

  useEffect(() => {
    // setState com o mesmo valor não re-renderiza.
    const refresh = () => setTodayKey(dateKeyFromMs(Date.now()))
    const id = setInterval(refresh, TICK_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return todayKey
}
