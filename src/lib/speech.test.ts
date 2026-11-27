import { describe, expect, it } from 'vitest'
import { isTtsError, sniffAudioMime, toTtsError, ttsErrorSentence } from './speech'

describe('sniffAudioMime', () => {
  it('RIFF is wav', () => {
    expect(sniffAudioMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]))).toBe('audio/wav')
  })

  it('ID3 is mpeg', () => {
    expect(sniffAudioMime(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0]))).toBe('audio/mpeg')
  })

  it('a frame sync (0xFF then the three high bits on) is mpeg', () => {
    expect(sniffAudioMime(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))).toBe('audio/mpeg')
    expect(sniffAudioMime(new Uint8Array([0xff, 0xe3, 0x90, 0x64]))).toBe('audio/mpeg')
  })

  it('0xFF without the three high bits on the next byte is not a sync', () => {
    expect(sniffAudioMime(new Uint8Array([0xff, 0x1f, 0, 0]))).toBe('audio/wav')
  })

  it('anything else, or too short, is wav', () => {
    expect(sniffAudioMime(new Uint8Array([1, 2, 3, 4]))).toBe('audio/wav')
    expect(sniffAudioMime(new Uint8Array([]))).toBe('audio/wav')
    expect(sniffAudioMime(new Uint8Array([0xff]))).toBe('audio/wav')
  })
})

describe('TtsError helpers', () => {
  it('isTtsError accepts the serialized object and rejects the rest', () => {
    expect(isTtsError({ kind: 'no_key', message: 'Add your OpenRouter key in Settings to listen.' })).toBe(true)
    expect(isTtsError({ kind: 'no_key' })).toBe(false)
    expect(isTtsError('boom')).toBe(false)
    expect(isTtsError(null)).toBe(false)
    expect(isTtsError(new Error('x'))).toBe(false)
  })

  it('ttsErrorSentence drops the technical detail', () => {
    expect(
      ttsErrorSentence({ kind: 'model', message: "This voice model didn't accept the request.\n\nvoice is not available" }),
    ).toBe("This voice model didn't accept the request.")
    expect(ttsErrorSentence({ kind: 'auth', message: 'One line.' })).toBe('One line.')
  })

  it('toTtsError keeps a TtsError and wraps anything else as a network error', () => {
    const own = { kind: 'duration', message: 'x' }
    expect(toTtsError(own)).toBe(own)
    const wrapped = toTtsError(new Error('channel closed'))
    expect(wrapped.kind).toBe('network')
    expect(ttsErrorSentence(wrapped)).toBe("Couldn't generate the audio. Check your connection.")
    expect(wrapped.message).toContain('channel closed')
  })
})
