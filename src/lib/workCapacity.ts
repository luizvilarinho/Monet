// Capacidade de trabalho (Settings › Agenda): horas por dia de trabalho e dias
// de trabalho. Usada pelo agente plan-week do chat. Fica em localStorage; a
// presença de um valor válido é a marca de "configurado pelo usuário".

export const WORK_CAPACITY_KEY = 'monet:work-capacity'
export const DEFAULT_WORK_HOURS_PER_DAY = 6
// Dias da semana como em Date.getDay(): 0 = domingo … 6 = sábado.
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5]
export const MAX_WORK_HOURS_PER_DAY = 24

export interface WorkCapacity {
  hoursPerDay: number
  // Ordenado, sem repetição, valores 0..6.
  workDays: number[]
  // false = padrão (chave ausente ou inválida).
  configured: boolean
}

export function isValidWorkHours(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n <= MAX_WORK_HOURS_PER_DAY
}

export function isValidWorkDays(days: number[]): boolean {
  return days.length >= 1 && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
}

function normalizeDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b)
}

// Valor gravado; qualquer falha (ausente, JSON inválido, horas fora da faixa,
// nenhum dia) cai no padrão.
export function loadWorkCapacity(): WorkCapacity {
  try {
    const raw = localStorage.getItem(WORK_CAPACITY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const hours = parsed?.hoursPerDay
      const days = parsed?.workDays
      if (typeof hours === 'number' && isValidWorkHours(hours) && Array.isArray(days) && isValidWorkDays(days)) {
        return { hoursPerDay: hours, workDays: normalizeDays(days), configured: true }
      }
    }
  } catch {
    // cai no padrão
  }
  return { hoursPerDay: DEFAULT_WORK_HOURS_PER_DAY, workDays: [...DEFAULT_WORK_DAYS], configured: false }
}

// Só grava valores válidos (a UI valida antes).
export function saveWorkCapacity(hoursPerDay: number, workDays: number[]): void {
  if (!isValidWorkHours(hoursPerDay) || !isValidWorkDays(workDays)) {
    throw new Error('Invalid work capacity')
  }
  localStorage.setItem(WORK_CAPACITY_KEY, JSON.stringify({ hoursPerDay, workDays: normalizeDays(workDays) }))
}
