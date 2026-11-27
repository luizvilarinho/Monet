import { describe, expect, it } from 'vitest'
import type { TtsModel } from './speech'
import {
  CHARS_PER_HOUR,
  CHARS_PER_PAGE,
  estimateCost,
  formatUsd,
  isPerCharacter,
  listenMinutes,
  modelOptionLabel,
  publishedPriceLabel,
  hasPublishedPrice,
  resolveVoice,
  sumUsageCost,
  voiceFor,
  voiceMatchesLanguage,
  voicesByLanguage,
} from './ttsCost'

// Preços de exemplo no formato do catálogo (por caractere e por token).
function model(over: Partial<TtsModel> & Pick<TtsModel, 'id' | 'promptPrice' | 'completionPrice'>): TtsModel {
  return { name: over.id, voices: [], ...over }
}
const perChar = model({
  id: 'elevenlabs/eleven-v4-turbo',
  name: 'ElevenLabs: Eleven v4 Turbo',
  promptPrice: 0.00004,
  completionPrice: 0,
  voices: ['george', 'sarah'],
})
const perToken = model({
  id: 'google/gemini-3.8-flash-tts',
  name: 'Google: Gemini 3.8 Flash TTS',
  promptPrice: 0.0000005,
  completionPrice: 0.000009,
  voices: ['Zephyr', 'Puck', 'Kore'],
})
// Só no segundo catálogo: preço zerado porque ninguém o publicou.
const noPrice = model({ id: 'acme/voice-9', name: 'Acme: Voice 9', promptPrice: 0, completionPrice: 0 })
// Variante `:free` do OpenRouter: zerado de verdade.
const free = model({ id: 'acme/voice-9:free', name: 'Acme: Voice 9 (free)', promptPrice: 0, completionPrice: 0 })
// Por segundo: o preço fica no `completion` e o `prompt` em zero.
const perSecond = model({ id: 'acme/voice-7', name: 'Acme: Voice 7', promptPrice: 0, completionPrice: 0.0025 })

describe('estimateCost', () => {
  it('per character: a page of 2,400 characters costs $0.096', () => {
    expect(isPerCharacter(perChar)).toBe(true)
    expect(estimateCost(perChar, CHARS_PER_PAGE)).toBeCloseTo(0.096, 6)
  })

  it('per token: about $0.0326 a page and $0.82 an hour', () => {
    expect(isPerCharacter(perToken)).toBe(false)
    expect(estimateCost(perToken, CHARS_PER_PAGE)).toBeCloseTo(0.0327, 3)
    expect(estimateCost(perToken, CHARS_PER_HOUR)).toBeCloseTo(0.8175, 3)
  })

  it('both prices at zero give null', () => {
    expect(estimateCost(noPrice, 1000)).toBeNull()
  })

  it('per second: characters × 0.06 s × the price, not 25 audio tokens a second', () => {
    expect(isPerCharacter(perSecond)).toBe(false)
    // 2,400 characters são 144 s de fala, a $0.0025 o segundo: $0.36.
    expect(estimateCost(perSecond, CHARS_PER_PAGE)).toBeCloseTo(0.36, 6)
  })

  it('a :free model costs nothing, while an unpriced one has no estimate', () => {
    expect(estimateCost(free, CHARS_PER_PAGE)).toBe(0)
    expect(hasPublishedPrice(free)).toBe(true)
    expect(hasPublishedPrice(noPrice)).toBe(false)
  })

  it('zero characters cost nothing', () => {
    expect(estimateCost(perChar, 0)).toBe(0)
    expect(estimateCost(perToken, 0)).toBe(0)
  })
})

describe('formatUsd', () => {
  it('two decimals from a cent, three below it, a floor under a tenth of a cent', () => {
    expect(formatUsd(0.096)).toBe('$0.10')
    expect(formatUsd(0.8175)).toBe('$0.82')
    expect(formatUsd(12.4)).toBe('$12.40')
    expect(formatUsd(0.0136)).toBe('$0.01')
    expect(formatUsd(0.0042)).toBe('$0.004')
    expect(formatUsd(0.0004)).toBe('<$0.001')
    expect(formatUsd(0)).toBe('$0.00')
  })
})

describe('labels', () => {
  it('published price per character and per token', () => {
    expect(publishedPriceLabel(perChar)).toBe('$40.00 / 1M characters')
    expect(publishedPriceLabel(perToken)).toBe('$0.50 / 1M text tokens · $9.00 / 1M audio tokens')
    expect(publishedPriceLabel(noPrice)).toBe('Price not published')
    expect(publishedPriceLabel(perSecond)).toBe('$0.0025 / second')
    expect(publishedPriceLabel(free)).toBe('Free')
  })

  it('option label: the page estimate only when the price is per character', () => {
    expect(modelOptionLabel(perChar)).toBe('ElevenLabs: Eleven v4 Turbo — $40.00 / 1M characters · ~$0.10/page')
    expect(modelOptionLabel(perToken)).toBe(
      'Google: Gemini 3.8 Flash TTS — $0.50 / 1M text tokens · $9.00 / 1M audio tokens',
    )
    expect(modelOptionLabel(noPrice)).toBe('Acme: Voice 9 — Price not published')
    expect(modelOptionLabel(perSecond)).toBe('Acme: Voice 7 — $0.0025 / second')
    expect(modelOptionLabel(free)).toBe('Acme: Voice 9 (free) — Free')
  })

  it('listen minutes round to the nearest minute, at least one', () => {
    expect(listenMinutes(6000)).toBe(6)
    expect(listenMinutes(5400)).toBe(5)
    expect(listenMinutes(100)).toBe(1)
  })
})

describe('voiceFor and resolveVoice', () => {
  it('keeps the saved voice while it is in the list', () => {
    expect(voiceFor(perToken, 'Puck')).toBe('Puck')
  })

  it('falls back to the first voice when the saved one left the list or is missing', () => {
    expect(voiceFor(perToken, 'Gone')).toBe('Zephyr')
    expect(voiceFor(perToken, null)).toBe('Zephyr')
  })

  it('a model without voices gives null', () => {
    expect(voiceFor(noPrice, 'Puck')).toBeNull()
  })

  it('resolveVoice uses the catalog when it has the model and the saved voice when it does not', () => {
    expect(resolveVoice([perToken], perToken.id, 'Gone')).toBe('Zephyr')
    expect(resolveVoice([], perToken.id, 'Puck')).toBe('Puck')
    expect(resolveVoice([], perToken.id, null)).toBeNull()
  })
})

// Vozes inventadas no formato dos catálogos: locale na frente, código atrás,
// prefixo com sublinhado e nome da língua entre parênteses.
const multilingual = model({
  id: 'acme/voice-1',
  promptPrice: 0.00002,
  completionPrice: 0,
  voices: ['cs-CZ-Anna:Voice-1', 'en-US-Ben:Voice-1', 'fr-FR-Claire:Voice-1', 'fr-CA-Denis:Voice-1'],
})

describe('voice by book language', () => {
  it('recognizes the language in the voice name', () => {
    expect(voiceMatchesLanguage('fr-FR-Claire:Voice-1', 'fr')).toBe(true)
    expect(voiceMatchesLanguage('aura-2-agathe-fr', 'fr')).toBe(true)
    expect(voiceMatchesLanguage('fr_marie_happy', 'fr')).toBe(true)
    expect(voiceMatchesLanguage('Charlotte (French)', 'fr')).toBe(true)
    expect(voiceMatchesLanguage('aura-2-thalia-en', 'fr')).toBe(false)
    expect(voiceMatchesLanguage('cs-CZ-Anna:Voice-1', 'fr')).toBe(false)
    // Palavra inteira: "frank" não é francês.
    expect(voiceMatchesLanguage('frank', 'fr')).toBe(false)
    expect(voiceMatchesLanguage('Zephyr', 'fr')).toBe(false)
    expect(voiceMatchesLanguage('fr-FR-Claire', '')).toBe(false)
  })

  it('without a saved voice, the first voice of the book language wins over the first of the list', () => {
    expect(voiceFor(multilingual, null, 'fr')).toBe('fr-FR-Claire:Voice-1')
    expect(voiceFor(multilingual, null, 'en')).toBe('en-US-Ben:Voice-1')
    // Sem a língua, ou sem voz dela, a primeira da lista.
    expect(voiceFor(multilingual, null)).toBe('cs-CZ-Anna:Voice-1')
    expect(voiceFor(multilingual, null, 'de')).toBe('cs-CZ-Anna:Voice-1')
    // Modelo sem sinal de língua nas vozes (o padrão): a primeira.
    expect(voiceFor(perToken, null, 'fr')).toBe('Zephyr')
  })

  it('a saved voice still wins, whatever its language', () => {
    expect(voiceFor(multilingual, 'cs-CZ-Anna:Voice-1', 'fr')).toBe('cs-CZ-Anna:Voice-1')
    expect(resolveVoice([multilingual], multilingual.id, null, 'fr')).toBe('fr-FR-Claire:Voice-1')
    expect(resolveVoice([], multilingual.id, null, 'fr')).toBeNull()
  })

  it('the picker lists the voices of the book language first, keeping the rest', () => {
    expect(voicesByLanguage(multilingual.voices, 'fr')).toEqual([
      'fr-FR-Claire:Voice-1',
      'fr-CA-Denis:Voice-1',
      'cs-CZ-Anna:Voice-1',
      'en-US-Ben:Voice-1',
    ])
    expect(voicesByLanguage(multilingual.voices, 'de')).toEqual(multilingual.voices)
  })
})

describe('sumUsageCost', () => {
  it('sums each model at its own price', () => {
    const result = sumUsageCost({ [perChar.id]: 1000, [perToken.id]: 60_000 }, [perChar, perToken])
    expect(result.cost).toBeCloseTo(0.04 + 0.8175, 3)
    expect(result.unpriced).toBe(false)
  })

  it('leaves out models without a price and says so', () => {
    const result = sumUsageCost({ [perChar.id]: 1000, [noPrice.id]: 5000, 'gone/model': 10 }, [perChar, noPrice])
    expect(result.cost).toBeCloseTo(0.04, 6)
    expect(result.unpriced).toBe(true)
  })

  it('nothing generated costs nothing', () => {
    expect(sumUsageCost({}, [perChar])).toEqual({ cost: 0, unpriced: false })
  })
})
