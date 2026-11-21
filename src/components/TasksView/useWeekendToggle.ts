import { useEffect, useState } from 'react'
import { isWeekendOff, loadWorkCapacity } from '../../lib/workCapacity'

// Fim de semana das visões em grade (Week e Month): a escolha do usuário fica
// na mesma chave nas duas visões.
const HIDE_WEEKEND_KEY = 'monet:tasks-week-hide-weekend'

// Chave de drop do trilho do fim de semana oculto.
export const WEEKEND_RAIL_KEY = 'weekend'

// Fim de semana oculto: a escolha do usuário; sem escolha, os dias de
// trabalho do Settings › Agenda (sábado e domingo fora = oculto).
function initialHideWeekend(): boolean {
  try {
    const stored = localStorage.getItem(HIDE_WEEKEND_KEY)
    if (stored === '1' || stored === '0') return stored === '1'
  } catch {
    /* cai nos dias de trabalho */
  }
  return isWeekendOff(loadWorkCapacity().workDays)
}

export function useWeekendToggle() {
  const [hideWeekend, setHideWeekendState] = useState(initialHideWeekend)
  // Fim de semana exibido temporariamente (drag segurado sobre o trilho).
  const [peek, setPeek] = useState(false)

  function setHideWeekend(hide: boolean) {
    setHideWeekendState(hide)
    setPeek(false)
    try {
      localStorage.setItem(HIDE_WEEKEND_KEY, hide ? '1' : '0')
    } catch {
      /* ignorar */
    }
  }

  return { hideWeekend, setHideWeekend, weekendHidden: hideWeekend && !peek, setPeek }
}

// Segurar um card ~400ms sobre o trilho (WEEKEND_RAIL_KEY) expande o fim de
// semana; ao soltar, volta ao estado do botão. Vai depois do `useCardDrag`
// (é dele que vêm `draggingId` e `overKey`).
export function useWeekendPeek(
  draggingId: string | null,
  overKey: string | null,
  setPeek: (peek: boolean) => void
) {
  useEffect(() => {
    if (!draggingId || overKey !== WEEKEND_RAIL_KEY) return
    const timer = setTimeout(() => setPeek(true), 400)
    return () => clearTimeout(timer)
  }, [draggingId, overKey, setPeek])

  useEffect(() => {
    if (!draggingId) setPeek(false)
  }, [draggingId, setPeek])
}
