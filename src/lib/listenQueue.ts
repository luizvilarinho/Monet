// Fila de frases do player de voz: quais pedir agora. Puro, sem rede.

export type SentenceStatus = 'idle' | 'loading' | 'ready' | 'error'

// Acima disso o player pede confirmação (minutos e custo) antes de gerar.
export const LONG_LISTEN_CHARS = 5000

// Índices a pedir agora: a frase atual primeiro e depois as seguintes, até
// `current + ahead`. No máximo `maxInFlight` pedidos em `loading` ao mesmo tempo.
// Frase em `error` não se repete (quem pede de novo é o "Try again"), e com a
// atual em erro nada mais é pedido: o provedor vai recusar as outras também.
export function planPrefetch(current: number, statuses: SentenceStatus[], ahead = 2, maxInFlight = 2): number[] {
  if (current < 0 || current >= statuses.length) return []
  if (statuses[current] === 'error') return []
  let inFlight = statuses.filter((status) => status === 'loading').length
  const wanted: number[] = []
  const last = Math.min(statuses.length - 1, current + ahead)
  for (let i = current; i <= last; i++) {
    if (statuses[i] !== 'idle') continue
    if (inFlight >= maxInFlight) break
    wanted.push(i)
    inFlight++
  }
  return wanted
}
