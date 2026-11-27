// Estimativa de custo do áudio. Os preços vêm do catálogo do OpenRouter; aqui só
// estão as premissas de conversão. O resultado é sempre uma estimativa.
import { baseLanguage, languageName } from './language'
import type { TtsModel } from './speech'

export const CHARS_PER_PAGE = 2400
// 1.000 caracteres dão cerca de 1 minuto de fala.
export const CHARS_PER_HOUR = 60_000
export const SECONDS_PER_CHAR = 0.06
export const AUDIO_TOKENS_PER_SECOND = 25
export const CHARS_PER_TEXT_TOKEN = 4

type Priced = Pick<TtsModel, 'id' | 'promptPrice' | 'completionPrice'>

// Por caractere: o catálogo põe o preço no `prompt` e deixa o `completion` em zero
// (ElevenLabs, MAI). Por token: o `completion` é o token de áudio (Gemini).
export function isPerCharacter(model: Priced): boolean {
  return model.completionPrice === 0 && model.promptPrice > 0
}

// Por segundo: o preço fica no `completion` e o `prompt` em zero (Seed Audio).
export function isPerSecond(model: Priced): boolean {
  return model.promptPrice === 0 && model.completionPrice > 0
}

// Os dois preços zerados: grátis quando o id é uma variante `:free` do OpenRouter;
// nos demais (só no segundo catálogo) o preço é desconhecido.
export function isFree(model: Priced): boolean {
  return model.promptPrice === 0 && model.completionPrice === 0 && model.id.endsWith(':free')
}

export function hasPublishedPrice(model: Priced): boolean {
  return model.promptPrice > 0 || model.completionPrice > 0 || isFree(model)
}

// Dólares para `chars` caracteres, ou null sem preço publicado.
export function estimateCost(model: Priced, chars: number): number | null {
  if (!hasPublishedPrice(model)) return null
  if (isFree(model)) return 0
  if (isPerCharacter(model)) return chars * model.promptPrice
  if (isPerSecond(model)) return chars * SECONDS_PER_CHAR * model.completionPrice
  const textTokens = chars / CHARS_PER_TEXT_TOKEN
  const audioTokens = chars * SECONDS_PER_CHAR * AUDIO_TOKENS_PER_SECOND
  return textTokens * model.promptPrice + audioTokens * model.completionPrice
}

export function formatUsd(value: number): string {
  if (value >= 0.01) return `$${value.toFixed(2)}`
  if (value >= 0.001) return `$${value.toFixed(3)}`
  if (value > 0) return '<$0.001'
  return '$0.00'
}

function perMillion(price: number): string {
  return `$${(price * 1_000_000).toFixed(2)}`
}

export function publishedPriceLabel(model: Priced): string {
  if (isFree(model)) return 'Free'
  if (!hasPublishedPrice(model)) return 'Price not published'
  if (isPerCharacter(model)) return `${perMillion(model.promptPrice)} / 1M characters`
  if (isPerSecond(model)) return `$${Number(model.completionPrice.toPrecision(3))} / second`
  return `${perMillion(model.promptPrice)} / 1M text tokens · ${perMillion(model.completionPrice)} / 1M audio tokens`
}

// "<nome> — <preço publicado> · ~$0.10/page". A estimativa por página só aparece
// quando o preço é por caractere; por token e por segundo ela depende do ritmo
// da fala.
export function modelOptionLabel(model: TtsModel): string {
  const base = `${model.name} — ${publishedPriceLabel(model)}`
  if (!isPerCharacter(model)) return base
  const page = estimateCost(model, CHARS_PER_PAGE)
  return page === null ? base : `${base} · ~${formatUsd(page)}/page`
}

// Minutos de fala de `chars` caracteres, no mínimo 1.
export function listenMinutes(chars: number): number {
  return Math.max(1, Math.round((chars / CHARS_PER_HOUR) * 60))
}

// O nome da voz traz a língua: "fr-FR-Denise", "aura-2-agathe-fr", "fr_marie" ou
// "Charlotte (French)". Compara palavras inteiras do nome com o código e com o
// nome inglês da língua.
export function voiceMatchesLanguage(voice: string, language: string): boolean {
  const code = baseLanguage(language)
  if (!code) return false
  const name = languageName(code).toLowerCase()
  return voice
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .some((token) => token === code || token === name)
}

// As vozes da língua do livro primeiro, na ordem do catálogo; o resto depois.
export function voicesByLanguage(voices: string[], language: string): string[] {
  const own = voices.filter((voice) => voiceMatchesLanguage(voice, language))
  return own.length === 0 ? voices : [...own, ...voices.filter((voice) => !own.includes(voice))]
}

// A voz lembrada, se ainda está na lista do modelo; senão a primeira que traz a
// língua do livro (a voz de outra língua leria o livro com a pronúncia dela);
// senão a primeira. Lista vazia dá null (o modelo usa a voz padrão dele).
export function voiceFor(model: TtsModel, saved: string | null, language = ''): string | null {
  if (saved && model.voices.includes(saved)) return saved
  return voicesByLanguage(model.voices, language)[0] ?? null
}

// Com o catálogo carregado, vale `voiceFor`; sem ele (sem rede), a voz lembrada
// como está.
export function resolveVoice(
  models: TtsModel[],
  modelId: string,
  saved: string | null,
  language = '',
): string | null {
  const model = models.find((m) => m.id === modelId)
  return model ? voiceFor(model, saved, language) : saved
}

export interface UsageCost {
  cost: number
  // Havia caracteres gerados num modelo sem preço publicado (ou fora do catálogo):
  // ficam fora da soma.
  unpriced: boolean
}

// Soma por modelo (modelo → caracteres gerados), cada um pelo próprio preço.
export function sumUsageCost(byModel: Record<string, number>, models: TtsModel[]): UsageCost {
  let cost = 0
  let unpriced = false
  for (const [modelId, chars] of Object.entries(byModel)) {
    const model = models.find((m) => m.id === modelId)
    const estimate = model ? estimateCost(model, chars) : null
    if (estimate === null) unpriced = true
    else cost += estimate
  }
  return { cost, unpriced }
}
