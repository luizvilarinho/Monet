import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TtsError, TtsModel } from '../lib/speech'

// O Rust e o <audio> são simulados: o que se testa é a máquina de estados.
const speak = vi.fn()
const cancel = vi.fn((_requestId: string) => Promise.resolve())
vi.mock('../lib/speech', async () => {
  const actual = await vi.importActual<typeof import('../lib/speech')>('../lib/speech')
  return {
    ...actual,
    ttsSpeak: (input: unknown) => speak(input),
    ttsCancel: (requestId: string) => cancel(requestId),
    onTtsWarning: () => Promise.resolve(() => {}),
  }
})

import { createListenEngine, type ListenOpts, type ListenSource, type ListenState } from './useListenPlayer'

class FakeAudio {
  static instances: FakeAudio[] = []
  src = ''
  playbackRate = 1
  defaultPlaybackRate = 1
  preservesPitch = false
  paused = true
  plays: Array<{ src: string; rate: number }> = []
  private listeners = new Map<string, Array<() => void>>()
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    FakeAudio.instances.push(this)
  }
  addEventListener(type: string, handler: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler])
  }
  // O load() do elemento real devolve a velocidade a 1.
  private load() {
    this.playbackRate = this.defaultPlaybackRate
  }
  play() {
    this.paused = false
    this.plays.push({ src: this.src, rate: this.playbackRate })
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
  emit(type: string) {
    for (const handler of this.listeners.get(type) ?? []) handler()
    if (type === 'ended') this.onended?.()
    if (type === 'error') this.onerror?.()
  }
  setSrc(value: string) {
    this.src = value
    this.load()
  }
}

const SENTENCES = ['Élise monte au grenier à 21 h 30.', 'Elle sursauta.', 'Je cherchais seulement une lampe, répondit-elle.', 'Au fond, une vieille malle.']

function source(over: Partial<ListenSource> = {}): ListenSource {
  return {
    id: 'src-1',
    kind: 'page',
    originLabel: 'Page 42',
    endLabel: 'End of page 42',
    sentences: SENTENCES,
    chars: SENTENCES.join('').length,
    page: 42,
    backLabel: 'p. 42',
    notice: null,
    ...over,
  }
}

const gemini: TtsModel = {
  id: 'google/gemini-3.8-flash-tts',
  name: 'Google: Gemini 3.8 Flash TTS',
  promptPrice: 0.0000005,
  completionPrice: 0.000009,
  voices: ['Zephyr', 'Puck'],
}

interface Pending {
  input: { requestId: string; bookId: string | null; model: string; voice: string | null; text: string }
  resolve: (blob: Blob) => void
  reject: (error: unknown) => void
}

let pending: Pending[]
let opts: ListenOpts
let states: ListenState[]
let engine: ReturnType<typeof createListenEngine>

function latest(): ListenState {
  return states[states.length - 1]
}

// Responde o pedido da frase `text` (ou o primeiro em aberto).
function answer(text?: string): Pending {
  const i = pending.findIndex((p) => (text ? p.input.text === text : true))
  expect(i).toBeGreaterThanOrEqual(0)
  const [request] = pending.splice(i, 1)
  return request
}
async function ready(text?: string) {
  answer(text).resolve(new Blob(['x'], { type: 'audio/wav' }))
  await flush()
}
async function fail(error: TtsError, text?: string) {
  answer(text).reject(error)
  await flush()
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function audio(): FakeAudio {
  return FakeAudio.instances[0]
}

beforeEach(() => {
  pending = []
  states = []
  FakeAudio.instances = []
  localStorage.clear()
  let urlCounter = 0
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:fake/${++urlCounter}`, revokeObjectURL: vi.fn() }))
  // Cada `src` novo passa pelo load(), como no elemento real.
  Object.defineProperty(FakeAudio.prototype, 'src', {
    configurable: true,
    get() {
      return (this as { _src?: string })._src ?? ''
    },
    set(value: string) {
      ;(this as { _src?: string })._src = value
      ;(this as unknown as { load: () => void }).load()
    },
  })
  speak.mockReset()
  cancel.mockReset()
  // O Rust rejeita a chamada em voo com kind "cancelled".
  cancel.mockImplementation((requestId: string) => {
    const i = pending.findIndex((p) => p.input.requestId === requestId)
    if (i >= 0) pending.splice(i, 1)[0].reject({ kind: 'cancelled', message: 'Cancelled.' })
    return Promise.resolve()
  })
  speak.mockImplementation(
    (input: Pending['input']) =>
      new Promise<Blob>((resolve, reject) => {
        pending.push({ input, resolve, reject })
      }),
  )
  opts = { bookId: 'book-1', mincerRecording: false, showToast: vi.fn(), models: [gemini], language: 'fr' }
  engine = createListenEngine(() => opts, (s) => states.push(s))
})

afterEach(() => {
  engine.dispose()
  vi.unstubAllGlobals()
})

describe('play', () => {
  it('asks for the first sentence and two ahead, but only two at a time', () => {
    engine.play(source())
    expect(latest().status).toBe('preparing')
    expect(pending.map((p) => p.input.text)).toEqual([SENTENCES[0], SENTENCES[1]])
    expect(latest().statuses).toEqual(['loading', 'loading', 'idle', 'idle'])
  })

  it('asks with the default model and the first voice of the catalog, and no speed', () => {
    engine.play(source())
    const { input } = pending[0]
    expect(input).toMatchObject({ bookId: 'book-1', model: 'google/gemini-3.8-flash-tts', voice: 'Zephyr' })
    expect('speed' in input).toBe(false)
  })

  it('starts playing when the first sentence is ready and keeps asking ahead', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    expect(latest().status).toBe('playing')
    expect(audio().plays).toHaveLength(1)
    // O lugar livre foi para a terceira frase.
    expect(pending.map((p) => p.input.text)).toEqual([SENTENCES[1], SENTENCES[2]])
  })

  it('moves to the next sentence when one ends, and ends with the last', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    await ready(SENTENCES[1])
    audio().emit('ended')
    expect(latest().index).toBe(1)
    expect(latest().status).toBe('playing')
    await ready(SENTENCES[2])
    await ready(SENTENCES[3])
    audio().emit('ended')
    audio().emit('ended')
    expect(latest().index).toBe(3)
    audio().emit('ended')
    expect(latest().status).toBe('ended')
  })

  it('waits in "preparing" when the next sentence is not ready yet', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    audio().emit('ended')
    expect(latest().index).toBe(1)
    expect(latest().status).toBe('preparing')
    await ready(SENTENCES[1])
    expect(latest().status).toBe('playing')
  })

  it('a new Listen replaces the one playing: cancels in flight and ignores late answers', async () => {
    engine.play(source())
    const oldRequests = [...pending]
    const old = oldRequests.map((p) => p.input.requestId)
    engine.play(source({ id: 'src-2', sentences: ['Une autre phrase.'], chars: 17 }))
    expect(cancel.mock.calls.map((c) => c[0]).sort()).toEqual(old.sort())
    // Respostas da fonte anterior que chegam tarde não tocam nada.
    for (const request of oldRequests) request.resolve(new Blob(['x']))
    await flush()
    expect(audio()?.plays.length ?? 0).toBe(0)
    expect(latest().source?.id).toBe('src-2')
    expect(latest().status).toBe('preparing')
  })

  it('does nothing for a source without sentences', () => {
    engine.play(source({ sentences: [], chars: 0 }))
    expect(latest()).toBeUndefined()
  })
})

describe('speed', () => {
  it('applies playbackRate after the src is set, on every sentence', async () => {
    engine.play(source())
    expect(latest().speed).toBe(0.85)
    await ready(SENTENCES[0])
    await ready(SENTENCES[1])
    expect(audio().plays[0].rate).toBe(0.85)
    expect(audio().preservesPitch).toBe(true)
    audio().emit('ended')
    expect(audio().plays[1]).toMatchObject({ src: 'blob:fake/2', rate: 0.85 })
  })

  it('setSpeed persists, updates the state and the element', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    engine.setSpeed(0.75)
    expect(latest().speed).toBe(0.75)
    expect(audio().playbackRate).toBe(0.75)
    expect(localStorage.getItem('monet:tts-speed')).toBe('0.75')
    // A próxima fonte já parte da velocidade escolhida.
    engine.play(source({ id: 'src-2' }))
    expect(latest().speed).toBe(0.75)
  })
})

describe('model and voice', () => {
  it('a change takes effect from the next sentence asked, not the ready ones', async () => {
    engine.play(source())
    // As duas primeiras já estão em voo com o modelo antigo.
    localStorage.setItem('monet:tts-model', 'elevenlabs/eleven-v4-turbo')
    localStorage.setItem('monet:tts-voices', JSON.stringify({ 'elevenlabs/eleven-v4-turbo': 'george' }))
    expect(pending.map((p) => p.input.model)).toEqual(['google/gemini-3.8-flash-tts', 'google/gemini-3.8-flash-tts'])
    await ready(SENTENCES[0])
    // A terceira, pedida depois da troca, sai com o modelo novo.
    const third = pending.find((p) => p.input.text === SENTENCES[2])!
    expect(third.input.model).toBe('elevenlabs/eleven-v4-turbo')
    // Modelo fora do catálogo carregado: vale a voz lembrada.
    expect(third.input.voice).toBe('george')
    // A que já estava pronta continua tocando.
    expect(latest().status).toBe('playing')
  })
})

describe('voice by book language', () => {
  const multilingual: TtsModel = {
    id: 'acme/voice-1',
    name: 'Acme: Voice 1',
    promptPrice: 0.00002,
    completionPrice: 0,
    voices: ['cs-CZ-Anna:Voice-1', 'en-US-Ben:Voice-1', 'fr-FR-Claire:Voice-1'],
  }

  beforeEach(() => {
    opts.models = [gemini, multilingual]
    localStorage.setItem('monet:tts-model', multilingual.id)
  })

  it('without a saved voice, asks with the voice that carries the language of the book', () => {
    engine.play(source())
    expect(pending[0].input.voice).toBe('fr-FR-Claire:Voice-1')
    engine.close()
    opts.language = 'en'
    engine.play(source())
    expect(pending[pending.length - 1].input.voice).toBe('en-US-Ben:Voice-1')
  })

  it('the voice is remembered per model and per language: a French and an English book keep their own', () => {
    localStorage.setItem(
      'monet:tts-voices',
      JSON.stringify({ 'acme/voice-1|fr': 'cs-CZ-Anna:Voice-1', 'acme/voice-1|en': 'en-US-Ben:Voice-1' }),
    )
    engine.play(source())
    expect(pending[0].input.voice).toBe('cs-CZ-Anna:Voice-1')
    engine.close()
    opts.language = 'en'
    engine.play(source())
    expect(pending[pending.length - 1].input.voice).toBe('en-US-Ben:Voice-1')
  })

  it('the old format (one voice per model) still works, for any language', () => {
    localStorage.setItem('monet:tts-voices', JSON.stringify({ 'acme/voice-1': 'en-US-Ben:Voice-1' }))
    engine.play(source())
    expect(pending[0].input.voice).toBe('en-US-Ben:Voice-1')
  })

  it('speakOnce uses the language it is given, falling back to the one of the book', async () => {
    opts.language = ''
    const first = engine.speakOnce('entrebâillée', 'fr')
    await flush()
    expect(pending[0].input.voice).toBe('fr-FR-Claire:Voice-1')
    engine.dispose()
    await first
  })
})

describe('errors', () => {
  const noCredit: TtsError = { kind: 'no_credit', message: 'OpenRouter has no credit left for audio.' }

  it('an error on the current sentence stops the player with the TtsError', async () => {
    engine.play(source())
    await fail(noCredit, SENTENCES[0])
    expect(latest().status).toBe('error')
    expect(latest().error).toEqual(noCredit)
  })

  it('sentences ready before the failing one still play, and the error shows when it is reached', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    await fail({ kind: 'network', message: 'Couldn\'t generate the audio. Check your connection.' }, SENTENCES[1])
    expect(latest().status).toBe('playing')
    audio().emit('ended')
    expect(latest().index).toBe(1)
    expect(latest().status).toBe('error')
    expect(latest().error?.kind).toBe('network')
  })

  it('retry asks again; skip goes to the next sentence', async () => {
    engine.play(source())
    await fail(noCredit, SENTENCES[0])
    engine.retry()
    expect(latest().status).toBe('preparing')
    expect(pending.some((p) => p.input.text === SENTENCES[0])).toBe(true)
    await ready(SENTENCES[0])
    expect(latest().status).toBe('playing')

    audio().emit('ended')
    await fail(noCredit, SENTENCES[1])
    expect(latest().status).toBe('error')
    engine.skip()
    expect(latest().index).toBe(2)
    expect(latest().status).toBe('preparing')
  })

  it('does not ask for more sentences while the current one is in error', async () => {
    engine.play(source())
    await fail(noCredit, SENTENCES[0])
    await fail(noCredit, SENTENCES[1])
    expect(pending).toHaveLength(0)
  })

  it('a "cancelled" answer is ignored', async () => {
    engine.play(source())
    await fail({ kind: 'cancelled', message: 'Cancelled.' }, SENTENCES[0])
    expect(latest().status).toBe('preparing')
  })

  it('a play() the webview refuses (NotAllowedError) leaves the player paused, not stuck on "playing"', async () => {
    const play = vi.spyOn(FakeAudio.prototype, 'play').mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    engine.play(source())
    await ready(SENTENCES[0])
    await flush()
    expect(play).toHaveBeenCalled()
    expect(latest().status).toBe('paused')
    play.mockRestore()
  })

  it('audio that does not decode becomes an error like a refused one', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    audio().emit('error')
    expect(latest().status).toBe('error')
    expect(latest().error?.kind).toBe('duration')
  })
})

describe('pause, resume and navigation', () => {
  it('pause("away") records the page; toggle resumes from the start of the sentence', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    engine.pause('away')
    expect(latest().status).toBe('paused')
    expect(latest().awayFromPage).toBe(42)
    expect(audio().paused).toBe(true)
    engine.toggle()
    expect(latest().status).toBe('playing')
    expect(latest().awayFromPage).toBeNull()
    expect(audio().plays).toHaveLength(2)
  })

  it('clearAway takes the "away" notice off and leaves the audio paused', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    engine.pause('away')
    expect(latest().awayFromPage).toBe(42)
    engine.clearAway()
    expect(latest().awayFromPage).toBeNull()
    expect(latest().status).toBe('paused')
    expect(audio().paused).toBe(true)
    // Sem aviso, nada a limpar: não gera estado novo.
    const count = states.length
    engine.clearAway()
    expect(states).toHaveLength(count)
  })

  it('pause("translate") pauses without the away page', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    engine.pause('translate')
    expect(latest().status).toBe('paused')
    expect(latest().awayFromPage).toBeNull()
  })

  it('a sentence that arrives while paused does not start playing', async () => {
    engine.play(source())
    engine.pause('user')
    expect(latest().status).toBe('paused')
    await ready(SENTENCES[0])
    expect(latest().status).toBe('paused')
    expect(audio()?.plays.length ?? 0).toBe(0)
    engine.toggle()
    expect(latest().status).toBe('playing')
  })

  it('toggle while playing pauses', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    engine.toggle()
    expect(latest().status).toBe('paused')
  })

  it('next to a sentence still loading silences the current one at once', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    expect(audio().paused).toBe(false)
    // A segunda ainda está em voo.
    engine.next()
    expect(latest().index).toBe(1)
    expect(latest().status).toBe('preparing')
    expect(audio().paused).toBe(true)
    // Quando chega, toca.
    await ready(SENTENCES[1])
    expect(latest().status).toBe('playing')
    expect(audio().paused).toBe(false)
  })

  it('next to a sentence that already failed silences the current one and shows the error', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    await ready(SENTENCES[1])
    audio().emit('ended')
    expect(latest().index).toBe(1)
    // A terceira, pedida à frente, falha enquanto a segunda toca.
    await fail({ kind: 'network', message: "Couldn't generate the audio." }, SENTENCES[2])
    expect(audio().paused).toBe(false)
    engine.next()
    expect(latest().status).toBe('error')
    expect(latest().index).toBe(2)
    expect(audio().paused).toBe(true)
  })

  it('next, prev and repeat jump and play', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    await ready(SENTENCES[1])
    engine.next()
    expect(latest().index).toBe(1)
    expect(latest().status).toBe('playing')
    engine.repeat()
    expect(latest().index).toBe(1)
    expect(audio().plays).toHaveLength(3)
    engine.prev()
    expect(latest().index).toBe(0)
    // Os limites não fazem nada.
    engine.prev()
    expect(latest().index).toBe(0)
  })

  it('after the end, toggle listens again from the first sentence, with no new requests', async () => {
    engine.play(source({ sentences: SENTENCES.slice(0, 2), chars: 10 }))
    await ready(SENTENCES[0])
    await ready(SENTENCES[1])
    audio().emit('ended')
    audio().emit('ended')
    expect(latest().status).toBe('ended')
    engine.toggle()
    expect(latest().index).toBe(0)
    expect(latest().status).toBe('playing')
    expect(pending).toHaveLength(0)
  })
})

describe('Mincer', () => {
  it('blocks at the start while recording; "Play anyway" goes on', async () => {
    opts.mincerRecording = true
    engine.play(source())
    expect(latest().status).toBe('blocked')
    expect(pending).toHaveLength(0)
    engine.playAnyway()
    expect(latest().status).toBe('preparing')
    expect(pending).toHaveLength(2)
  })

  it('a recording that starts while playing pauses and blocks; the allowance lasts until it stops', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    opts.mincerRecording = true
    engine.onMincerRecording(true)
    expect(latest().status).toBe('blocked')
    expect(audio().paused).toBe(true)
    engine.playAnyway()
    expect(latest().status).toBe('playing')
    // Outro Listen na mesma gravação não bloqueia de novo.
    engine.play(source({ id: 'src-2' }))
    expect(latest().status).toBe('preparing')
    // Parou de gravar: o próximo bloqueio volta.
    opts.mincerRecording = false
    engine.onMincerRecording(false)
    opts.mincerRecording = true
    engine.play(source({ id: 'src-3' }))
    expect(latest().status).toBe('blocked')
  })

  it('speakOnce refuses while Mincer records', async () => {
    opts.mincerRecording = true
    await expect(engine.speakOnce('entrebâillée')).rejects.toMatchObject({ kind: 'blocked' })
  })
})

describe('long passages', () => {
  it('asks for confirmation above 5,000 characters, with minutes and cost', () => {
    engine.play(source({ chars: 6000 }))
    expect(latest().status).toBe('confirm-long')
    expect(latest().longEstimate?.minutes).toBe(6)
    expect(latest().longEstimate?.cost).toBeGreaterThan(0)
    expect(pending).toHaveLength(0)
    engine.confirmLong()
    expect(latest().status).toBe('preparing')
    expect(latest().longEstimate).toBeNull()
    expect(pending).toHaveLength(2)
  })

  it('no price (model outside the catalog) gives minutes without a cost', () => {
    opts.models = []
    engine.play(source({ chars: 6000 }))
    expect(latest().longEstimate).toEqual({ minutes: 6, cost: null })
  })

  it('exactly 5,000 characters plays without asking', () => {
    engine.play(source({ chars: 5000 }))
    expect(latest().status).toBe('preparing')
  })
})

describe('close and dispose', () => {
  it('close cancels what is in flight, revokes the blobs and goes back to idle', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    const inFlight = pending.map((p) => p.input.requestId)
    engine.close()
    expect(latest().status).toBe('idle')
    expect(latest().source).toBeNull()
    expect(cancel.mock.calls.map((c) => c[0])).toEqual(inFlight)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake/1')
    expect(audio().paused).toBe(true)
  })

  it('dispose (the reader unmounting) does the same', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    engine.dispose()
    expect(latest().status).toBe('idle')
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})

describe('speakOnce and the player never play together', () => {
  it('speakOnce pauses the player that is playing, and Space brings the player back', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    expect(latest().status).toBe('playing')
    const done = engine.speakOnce('entrebâillée')
    await flush()
    expect(latest().status).toBe('paused')
    expect(latest().awayFromPage).toBeNull()
    expect(audio().paused).toBe(true)
    await ready('entrebâillée')
    FakeAudio.instances[1].emit('ended')
    await done
    expect(latest().status).toBe('paused')
  })

  it('speakOnce also holds a player that was still preparing', async () => {
    engine.play(source())
    const done = engine.speakOnce('malle')
    await flush()
    expect(latest().status).toBe('paused')
    // A frase que chega depois não toca por cima.
    await ready(SENTENCES[0])
    expect(audio()?.plays.length ?? 0).toBe(0)
    engine.dispose()
    await done
  })

  it('a Listen that starts the player stops a speakOnce in flight', async () => {
    const once = engine.speakOnce('malle')
    await flush()
    const onceId = pending[0].input.requestId
    engine.play(source())
    expect(cancel).toHaveBeenCalledWith(onceId)
    await once
    await ready(SENTENCES[0])
    expect(latest().status).toBe('playing')
    // O áudio do speakOnce (o primeiro elemento) nunca tocou; o do player, sim.
    expect(FakeAudio.instances[0].plays).toHaveLength(0)
    expect(FakeAudio.instances[1].plays).toHaveLength(1)
  })

  it('a speakOnce that is already playing stops when the player resumes', async () => {
    engine.play(source())
    await ready(SENTENCES[0])
    const done = engine.speakOnce('malle')
    await flush()
    await ready('malle')
    const onceAudio = FakeAudio.instances[1]
    expect(onceAudio.paused).toBe(false)
    engine.toggle()
    expect(latest().status).toBe('playing')
    expect(onceAudio.paused).toBe(true)
    await done
  })
})

describe('speakOnce', () => {
  it('speaks a short text with one call and does not touch the player state when it is closed', async () => {
    const done = engine.speakOnce('entrebâillée')
    await flush()
    expect(pending.map((p) => p.input.text)).toContain('entrebâillée')
    expect(states).toHaveLength(0)
    await ready('entrebâillée')
    const once = FakeAudio.instances[0]
    expect(once.plays).toHaveLength(1)
    once.emit('ended')
    await done
    expect(states).toHaveLength(0)
  })

  it('cuts a long text into sentences and plays them in order', async () => {
    const long = 'Élise monte au grenier. '.repeat(30)
    const done = engine.speakOnce(long, 'fr')
    await flush()
    expect(pending.length).toBeGreaterThan(0)
    expect(pending.every((p) => p.input.text.length <= 400)).toBe(true)
    await ready()
    const once = FakeAudio.instances[0]
    expect(once.plays).toHaveLength(1)
    // Corta e solta para o teste não esperar 30 frases.
    engine.dispose()
    await done
  })

  it('rejects with the TtsError when the voice fails', async () => {
    const done = engine.speakOnce('entrebâillée')
    const outcome = expect(done).rejects.toMatchObject({ kind: 'auth' })
    await flush()
    await fail({ kind: 'auth', message: "OpenRouter didn't accept the key. Check it in Settings." })
    await outcome
  })

  it('a second call replaces the first', async () => {
    const first = engine.speakOnce('malle')
    await flush()
    const firstId = pending[0].input.requestId
    const second = engine.speakOnce('fouiller')
    await flush()
    expect(cancel).toHaveBeenCalledWith(firstId)
    await first
    await ready('fouiller')
    FakeAudio.instances[FakeAudio.instances.length - 1].emit('ended')
    await second
  })

  it('an empty text does nothing', async () => {
    await engine.speakOnce('   ')
    expect(pending).toHaveLength(0)
  })
})
