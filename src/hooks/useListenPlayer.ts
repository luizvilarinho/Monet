import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ShowReaderToast } from '../components/Reader/ReaderToast'
import { getTtsModel, getTtsSpeed, getTtsVoice, setTtsSpeed } from '../lib/languageSettings'
import { LONG_LISTEN_CHARS, planPrefetch, type SentenceStatus } from '../lib/listenQueue'
import { splitSentences } from '../lib/sentences'
import {
  onTtsWarning,
  toTtsError,
  ttsCancel,
  ttsErrorSentence,
  ttsSpeak,
  type TtsError,
  type TtsModel,
} from '../lib/speech'
import { estimateCost, listenMinutes, resolveVoice } from '../lib/ttsCost'

export interface ListenSource {
  id: string // crypto.randomUUID() por Listen
  kind: 'selection' | 'page' | 'list'
  originLabel: string // "Selection · p. 42" | "Page 42" | "Vocabulary · 6 items"
  endLabel: string // "End of the selection" | "End of page 42" | "End of the visible text" | "End of the list"
  sentences: string[]
  chars: number
  page: number | null // página (PDF) ou ordinal (EPUB) de origem; null na lista
  cfi?: string // EPUB: início do trecho, para "Back to"
  backLabel: string | null // "p. 42" | "Chapter 3, 41%"
  notice: string | null // aviso de 5 s ("Not read: page header and page number")
}

export type ListenStatus =
  | 'idle'
  | 'preparing'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error'
  | 'blocked'
  | 'confirm-long'

export interface ListenState {
  source: ListenSource | null
  index: number
  statuses: SentenceStatus[]
  status: ListenStatus
  error: TtsError | null
  speed: number
  awayFromPage: number | null
  longEstimate: { minutes: number; cost: number | null } | null
}

export interface ListenPlayer {
  state: ListenState
  open: boolean
  play(source: ListenSource): void
  toggle(): void
  next(): void
  prev(): void
  repeat(): void
  pause(reason: 'away' | 'translate' | 'user'): void
  // O leitor voltou à página do áudio pausado: o aviso "this audio is from…" sai
  // (o áudio segue pausado; quem retoma é o Espaço).
  clearAway(): void
  close(): void
  setSpeed(speed: number): void
  retry(): void
  skip(): void
  confirmLong(): void
  playAnyway(): void
  // Fala o termo ou o trecho do popover (e o "Test voice" e os itens da aba) sem
  // mexer no estado do player. Rejeita com TtsError se falhar. `language` melhora
  // o corte em frases do que passa de 400 caracteres.
  speakOnce(text: string, language?: string): Promise<void>
}

export interface ListenOpts {
  // null no "Test voice": o áudio vai para o cache compartilhado.
  bookId: string | null
  mincerRecording: boolean
  showToast: ShowReaderToast
  // Catálogo de modelos de voz (pode estar vazio, sem rede): vale para a voz e o preço.
  models: TtsModel[]
  // Língua do livro (ou a do "Test voice"): a voz padrão é a que traz essa língua.
  language: string
}

// Mais que isso numa frase falada sozinha vira várias chamadas.
const ONCE_SINGLE_CALL_CHARS = 400
const MINCER_MESSAGE = 'Mincer is recording. This audio would end up in the recording.'
const DECODE_ERROR: TtsError = {
  kind: 'duration',
  message: "The audio didn't match the text, so it wasn't played.",
}

interface Session {
  // Resposta de uma sessão anterior (outra fonte, fechada) é descartada.
  gen: number
  urls: Array<string | null>
  requestIds: Array<string | null>
  errors: Array<TtsError | null>
  confirmed: boolean
}

interface OnceRun {
  cancelled: boolean
  audio: HTMLAudioElement
  requestIds: Set<string>
  urls: string[]
  release: (() => void) | null
}

function initialState(): ListenState {
  return {
    source: null,
    index: 0,
    statuses: [],
    status: 'idle',
    error: null,
    speed: getTtsSpeed(),
    awayFromPage: null,
    longEstimate: null,
  }
}

// O `load()` do <audio> devolve a velocidade a 1: a velocidade vai DEPOIS de trocar
// o `src`, a cada frase (e de novo em `loadedmetadata`, por garantia).
function applySpeed(audio: HTMLAudioElement, speed: number): void {
  audio.defaultPlaybackRate = speed
  audio.playbackRate = speed
  audio.preservesPitch = true
}

function onceChunks(text: string, language: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  if (clean.length <= ONCE_SINGLE_CALL_CHARS) return [clean]
  return splitSentences(clean, language || 'en')
}

export interface ListenEngine {
  getState(): ListenState
  play(source: ListenSource): void
  toggle(): void
  next(): void
  prev(): void
  repeat(): void
  pause(reason: 'away' | 'translate' | 'user'): void
  clearAway(): void
  close(): void
  setSpeed(speed: number): void
  retry(): void
  skip(): void
  confirmLong(): void
  playAnyway(): void
  speakOnce(text: string, language?: string): Promise<void>
  onMincerRecording(recording: boolean): void
  dispose(): void
}

// A máquina de estados do player, fora do React: o hook só liga o estado e os
// efeitos. Uma frase por chamada; a atual e até duas à frente geradas, no máximo
// duas em voo (`planPrefetch`).
export function createListenEngine(getOpts: () => ListenOpts, onState: (state: ListenState) => void): ListenEngine {
  let state = initialState()
  let session: Session = { gen: 0, urls: [], requestIds: [], errors: [], confirmed: false }
  let audio: HTMLAudioElement | null = null
  let once: OnceRun | null = null
  // "Play anyway": vale até o Mincer parar de gravar.
  let allowRecording = false

  function commit(patch: Partial<ListenState>): void {
    state = { ...state, ...patch }
    onState(state)
  }

  function setSentenceStatus(index: number, status: SentenceStatus): void {
    const statuses = state.statuses.slice()
    statuses[index] = status
    commit({ statuses })
  }

  function getAudio(): HTMLAudioElement {
    if (!audio) {
      const element = new Audio()
      element.preservesPitch = true
      element.addEventListener('loadedmetadata', () => applySpeed(element, state.speed))
      element.addEventListener('ended', onEnded)
      element.addEventListener('error', onAudioError)
      audio = element
    }
    return audio
  }

  // Cancela o que está em voo, para o som e solta a memória da fonte atual.
  function teardown(): void {
    for (const requestId of session.requestIds) {
      if (requestId) void ttsCancel(requestId).catch(() => {})
    }
    audio?.pause()
    for (const url of session.urls) {
      if (url) URL.revokeObjectURL(url)
    }
    session = { gen: session.gen + 1, urls: [], requestIds: [], errors: [], confirmed: false }
  }

  function pump(): void {
    if (!state.source) return
    if (state.status !== 'preparing' && state.status !== 'playing' && state.status !== 'paused') return
    for (const index of planPrefetch(state.index, state.statuses)) requestSentence(index)
  }

  function requestSentence(index: number): void {
    const source = state.source
    if (!source) return
    const gen = session.gen
    const requestId = crypto.randomUUID()
    session.requestIds[index] = requestId
    setSentenceStatus(index, 'loading')
    // Modelo e voz lidos a cada pedido: a troca vale a partir da próxima frase.
    const opts = getOpts()
    const model = getTtsModel()
    const voice = resolveVoice(opts.models, model, getTtsVoice(model, opts.language), opts.language)
    const stale = () => session.gen !== gen || session.requestIds[index] !== requestId
    ttsSpeak({ requestId, bookId: opts.bookId, model, voice, text: source.sentences[index] }).then(
      (blob) => {
        if (stale()) return
        session.requestIds[index] = null
        session.urls[index] = URL.createObjectURL(blob)
        setSentenceStatus(index, 'ready')
        if (index === state.index && state.status === 'preparing') startPlayback(index)
        pump()
      },
      (e: unknown) => {
        if (stale()) return
        session.requestIds[index] = null
        const error = toTtsError(e)
        if (error.kind === 'cancelled') return
        session.errors[index] = error
        setSentenceStatus(index, 'error')
        // Só a frase atual para o player; as de adiante esperam a vez.
        if (index === state.index && state.status === 'preparing') commit({ status: 'error', error })
        pump()
      },
    )
  }

  function startPlayback(index: number): void {
    const url = session.urls[index]
    if (!url) return
    // O Listen de um item ou de uma palavra e o player nunca tocam juntos.
    stopOnce()
    const element = getAudio()
    element.src = url
    applySpeed(element, state.speed)
    commit({ status: 'playing', error: null })
    element.play().catch((e: unknown) => {
      // Trocar o src ou pausar interrompe o play anterior: não é erro.
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (state.status === 'playing' && state.index === index) commit({ status: 'paused' })
    })
  }

  // Toca a frase atual, ou espera por ela e pede as da frente. Esperando ou em
  // erro, a frase de antes não pode seguir soando (Next para uma frase em voo).
  function startCurrent(): void {
    const sentence = state.statuses[state.index]
    if (sentence === 'ready') {
      startPlayback(state.index)
    } else if (sentence === 'error') {
      audio?.pause()
      commit({ status: 'error', error: session.errors[state.index] ?? DECODE_ERROR })
      return
    } else {
      audio?.pause()
      commit({ status: 'preparing', error: null })
    }
    pump()
  }

  // Antes de tocar: Mincer gravando, trecho longo; depois a frase atual.
  function proceed(): void {
    const source = state.source
    if (!source) return
    if (getOpts().mincerRecording && !allowRecording) {
      audio?.pause()
      commit({ status: 'blocked', error: null, longEstimate: null })
      return
    }
    if (source.chars > LONG_LISTEN_CHARS && !session.confirmed) {
      const model = getOpts().models.find((m) => m.id === getTtsModel())
      commit({
        status: 'confirm-long',
        error: null,
        longEstimate: { minutes: listenMinutes(source.chars), cost: model ? estimateCost(model, source.chars) : null },
      })
      return
    }
    commit({ longEstimate: null })
    startCurrent()
  }

  function goTo(index: number): void {
    const source = state.source
    if (!source || index < 0 || index >= source.sentences.length) return
    if (state.status === 'idle' || state.status === 'blocked' || state.status === 'confirm-long') return
    commit({ index, awayFromPage: null, error: null })
    proceed()
  }

  function onEnded(): void {
    if (state.status !== 'playing' || !state.source) return
    const next = state.index + 1
    if (next >= state.source.sentences.length) {
      commit({ status: 'ended' })
      return
    }
    commit({ index: next })
    startCurrent()
  }

  function onAudioError(): void {
    if (state.status !== 'playing') return
    // Áudio que não decodifica: a frase vira erro, como uma recusada pela duração.
    session.errors[state.index] = DECODE_ERROR
    setSentenceStatus(state.index, 'error')
    commit({ status: 'error', error: DECODE_ERROR })
  }

  function stopOnce(): void {
    const run = once
    if (!run) return
    run.cancelled = true
    for (const requestId of run.requestIds) void ttsCancel(requestId).catch(() => {})
    run.audio.pause()
    run.release?.()
  }

  function playChunk(run: OnceRun, url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const element = run.audio
      run.release = resolve
      element.onended = () => resolve()
      element.onerror = () => reject(DECODE_ERROR)
      element.src = url
      applySpeed(element, getTtsSpeed())
      element.play().catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') resolve()
        else reject(DECODE_ERROR)
      })
    })
  }

  const engine: ListenEngine = {
    getState: () => state,

    play(source) {
      if (source.sentences.length === 0) return
      stopOnce()
      teardown()
      session = {
        gen: session.gen,
        urls: source.sentences.map(() => null),
        requestIds: source.sentences.map(() => null),
        errors: source.sentences.map(() => null),
        confirmed: false,
      }
      commit({
        source,
        index: 0,
        statuses: source.sentences.map(() => 'idle'),
        status: 'preparing',
        error: null,
        speed: getTtsSpeed(),
        awayFromPage: null,
        longEstimate: null,
      })
      proceed()
    },

    toggle() {
      switch (state.status) {
        case 'playing':
        case 'preparing':
          engine.pause('user')
          break
        case 'paused':
          // Retoma do começo da frase.
          commit({ awayFromPage: null })
          proceed()
          break
        case 'ended':
          commit({ index: 0, awayFromPage: null })
          proceed()
          break
        case 'error':
          engine.retry()
          break
        default:
          break
      }
    },

    next: () => goTo(state.index + 1),
    prev: () => goTo(state.index - 1),
    repeat: () => goTo(state.index),

    pause(reason) {
      const source = state.source
      if (!source) return
      const away = reason === 'away' ? source.page : null
      if (state.status === 'playing' || state.status === 'preparing') {
        audio?.pause()
        commit({ status: 'paused', awayFromPage: away })
      } else if (state.status === 'paused' && away !== null) {
        commit({ awayFromPage: away })
      }
    },

    clearAway() {
      if (state.awayFromPage !== null) commit({ awayFromPage: null })
    },

    close() {
      teardown()
      commit({
        source: null,
        index: 0,
        statuses: [],
        status: 'idle',
        error: null,
        awayFromPage: null,
        longEstimate: null,
      })
    },

    setSpeed(speed) {
      setTtsSpeed(speed)
      commit({ speed })
      if (audio) applySpeed(audio, speed)
    },

    retry() {
      if (state.status !== 'error' || !state.source) return
      session.errors[state.index] = null
      setSentenceStatus(state.index, 'idle')
      startCurrent()
    },

    skip() {
      if (state.status !== 'error' || !state.source) return
      const next = state.index + 1
      if (next >= state.source.sentences.length) {
        commit({ status: 'ended', error: null })
        return
      }
      commit({ index: next, error: null })
      proceed()
    },

    confirmLong() {
      if (state.status !== 'confirm-long') return
      session.confirmed = true
      proceed()
    },

    playAnyway() {
      if (state.status !== 'blocked') return
      allowRecording = true
      proceed()
    },

    async speakOnce(text, language = '') {
      if (getOpts().mincerRecording) {
        const blocked: TtsError = { kind: 'blocked', message: MINCER_MESSAGE }
        throw blocked
      }
      const chunks = onceChunks(text, language)
      if (chunks.length === 0) return
      stopOnce()
      // O player em curso pausa: as duas vozes não saem juntas.
      engine.pause('user')
      const opts = getOpts()
      const model = getTtsModel()
      const voiceLanguage = language || opts.language
      const voice = resolveVoice(opts.models, model, getTtsVoice(model, voiceLanguage), voiceLanguage)
      const run: OnceRun = { cancelled: false, audio: new Audio(), requestIds: new Set(), urls: [], release: null }
      run.audio.preservesPitch = true
      once = run
      // A frase seguinte é pedida enquanto a atual toca.
      const fetchChunk = (i: number) => {
        const requestId = crypto.randomUUID()
        run.requestIds.add(requestId)
        const promise = ttsSpeak({ requestId, bookId: opts.bookId, model, voice, text: chunks[i] })
        promise.catch(() => {})
        return promise
      }
      try {
        let pending = fetchChunk(0)
        for (let i = 0; i < chunks.length; i++) {
          const blob = await pending
          if (run.cancelled) return
          if (i + 1 < chunks.length) pending = fetchChunk(i + 1)
          const url = URL.createObjectURL(blob)
          run.urls.push(url)
          await playChunk(run, url)
          if (run.cancelled) return
        }
      } catch (e) {
        if (run.cancelled) return
        throw toTtsError(e)
      } finally {
        run.audio.pause()
        for (const url of run.urls) URL.revokeObjectURL(url)
        if (once === run) once = null
      }
    },

    onMincerRecording(recording) {
      if (!recording) {
        allowRecording = false
        return
      }
      // O Mincer começou a gravar com áudio saindo: pausa e pede a decisão.
      if (state.status === 'playing' || state.status === 'preparing') {
        audio?.pause()
        commit({ status: 'blocked' })
      }
    },

    dispose() {
      teardown()
      stopOnce()
      audio = null
      commit({ ...initialState(), speed: state.speed })
    },
  }
  return engine
}

// Player de voz do leitor: uma frase por chamada, o áudio por `blob:`, com 2 ou 3
// frases geradas à frente. O leitor desmontado (fechar o livro, Ctrl+1…4) para o
// som, cancela os pedidos e solta a memória.
export function useListenPlayer(opts: ListenOpts): ListenPlayer {
  const optsRef = useRef(opts)
  useLayoutEffect(() => {
    optsRef.current = opts
  })
  const [state, setState] = useState<ListenState>(initialState)
  const engineRef = useRef<ListenEngine | null>(null)
  if (!engineRef.current) engineRef.current = createListenEngine(() => optsRef.current, setState)
  const engine = engineRef.current

  useEffect(() => {
    engine.onMincerRecording(opts.mincerRecording)
  }, [engine, opts.mincerRecording])

  useEffect(() => () => engine.dispose(), [engine])

  // Aviso do Rust (áudio que não pode ser guardado): um toast por sessão do leitor.
  useEffect(() => {
    let alive = true
    let warned = false
    let unlisten: (() => void) | null = null
    onTtsWarning((message) => {
      if (warned) return
      warned = true
      optsRef.current.showToast({ message: ttsErrorSentence({ kind: 'warning', message }), tone: 'error' })
    }).then(
      (fn) => {
        if (alive) unlisten = fn
        else fn()
      },
      () => {},
    )
    return () => {
      alive = false
      unlisten?.()
    }
  }, [])

  return useMemo<ListenPlayer>(
    () => ({
      state,
      open: state.source !== null,
      play: engine.play,
      toggle: engine.toggle,
      next: engine.next,
      prev: engine.prev,
      repeat: engine.repeat,
      pause: engine.pause,
      clearAway: engine.clearAway,
      close: engine.close,
      setSpeed: engine.setSpeed,
      retry: engine.retry,
      skip: engine.skip,
      confirmLong: engine.confirmLong,
      playAnyway: engine.playAnyway,
      speakOnce: engine.speakOnce,
    }),
    [state, engine],
  )
}
