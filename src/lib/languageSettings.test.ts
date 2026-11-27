import { beforeEach, describe, expect, it } from 'vitest'
import { TTS_VOICES_KEY, getTtsVoice, setTtsChoice, setTtsVoice } from './languageSettings'

const MODEL = 'acme/voice-1'

beforeEach(() => {
  localStorage.clear()
})

describe('the remembered voice, per model and per language', () => {
  it('keeps a voice for each language of the same model', () => {
    setTtsVoice(MODEL, 'fr-FR-Claire', 'fr')
    setTtsVoice(MODEL, 'en-US-Ben', 'en')
    expect(getTtsVoice(MODEL, 'fr')).toBe('fr-FR-Claire')
    expect(getTtsVoice(MODEL, 'en')).toBe('en-US-Ben')
    // Língua sem escolha e sem voz de "qualquer língua": nada lembrado.
    expect(getTtsVoice(MODEL, 'de')).toBeNull()
    expect(getTtsVoice(MODEL)).toBeNull()
  })

  it('reads the old format, one voice per model, for any language', () => {
    localStorage.setItem(TTS_VOICES_KEY, JSON.stringify({ [MODEL]: 'en-US-Ben' }))
    expect(getTtsVoice(MODEL, 'fr')).toBe('en-US-Ben')
    expect(getTtsVoice(MODEL)).toBe('en-US-Ben')
    // Uma escolha nova por língua passa à frente da antiga, sem apagá-la.
    setTtsVoice(MODEL, 'fr-FR-Claire', 'fr')
    expect(getTtsVoice(MODEL, 'fr')).toBe('fr-FR-Claire')
    expect(getTtsVoice(MODEL, 'es')).toBe('en-US-Ben')
  })

  it('a region in the language does not split the memory', () => {
    setTtsVoice(MODEL, 'fr-FR-Claire', 'fr-CA')
    expect(getTtsVoice(MODEL, 'fr')).toBe('fr-FR-Claire')
  })

  it('clearing a voice clears only that language', () => {
    setTtsVoice(MODEL, 'fr-FR-Claire', 'fr')
    setTtsVoice(MODEL, 'en-US-Ben', 'en')
    setTtsVoice(MODEL, null, 'fr')
    expect(getTtsVoice(MODEL, 'fr')).toBeNull()
    expect(getTtsVoice(MODEL, 'en')).toBe('en-US-Ben')
  })

  it('setTtsChoice saves the model and the voice of the language', () => {
    setTtsChoice(MODEL, 'fr-FR-Claire', 'fr')
    expect(localStorage.getItem('monet:tts-model')).toBe(MODEL)
    expect(getTtsVoice(MODEL, 'fr')).toBe('fr-FR-Claire')
  })

  it('a corrupted value reads as nothing saved', () => {
    localStorage.setItem(TTS_VOICES_KEY, '{not json')
    expect(getTtsVoice(MODEL, 'fr')).toBeNull()
  })
})
