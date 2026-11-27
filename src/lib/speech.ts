// Voz do Library: invoke dos comandos `tts_*` do Rust (speech.rs). O áudio chega
// como ArrayBuffer e vira Blob; a chave do OpenRouter fica no Rust.
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// Espelha o TtsModel do Rust (que também guarda os formatos, só dele). Nada aqui é
// lista fixa: tudo vem do catálogo do OpenRouter.
export interface TtsModel {
  id: string
  name: string
  promptPrice: number
  completionPrice: number
  voices: string[]
}

// O invoke rejeita com o objeto serializado `{ kind, message }`. A mensagem é a
// frase do leitor; o detalhe técnico, quando há, vem depois de uma linha em branco.
export interface TtsError {
  kind: string
  message: string
}

export interface TtsCacheSize {
  files: number
  bytes: number
}

export interface TtsUsage {
  // bookId → modelId → caracteres gerados
  books: Record<string, Record<string, number>>
  // "YYYY-MM" → modelId → caracteres gerados
  months: Record<string, Record<string, number>>
}

export function isTtsError(e: unknown): e is TtsError {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as TtsError).kind === 'string' &&
    typeof (e as TtsError).message === 'string'
  )
}

// O que se oferece para cada erro de voz (frases no Rust, Apêndice D.3 do plano):
// o player e o "Test voice" do Settings usam a mesma tabela.
export type TtsErrorAction = 'settings' | 'retry' | 'skip' | 'change-model'

const ERROR_ACTIONS: Record<string, TtsErrorAction[]> = {
  no_key: ['settings'],
  auth: ['settings'],
  no_credit: ['settings'],
  refused: ['skip'],
  model: ['change-model', 'skip'],
  too_long: ['skip'],
  rate_limit: ['retry'],
  server: ['retry', 'skip'],
  network: ['retry'],
  duration: ['retry', 'skip'],
  invalid: ['skip'],
}

export function ttsErrorActions(error: TtsError): TtsErrorAction[] {
  return ERROR_ACTIONS[error.kind] ?? ['retry', 'skip']
}

export const TTS_ACTION_LABEL: Record<TtsErrorAction, string> = {
  settings: 'Open Settings',
  retry: 'Try again',
  skip: 'Skip',
  'change-model': 'Change voice model',
}

// A frase do erro, sem o detalhe técnico que vem depois de "\n\n".
export function ttsErrorSentence(error: TtsError): string {
  return error.message.split('\n\n')[0]
}

// Qualquer rejeição vira TtsError (erro de rede do próprio invoke, por exemplo).
export function toTtsError(e: unknown): TtsError {
  if (isTtsError(e)) return e
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unexpected error.'
  return { kind: 'network', message: `Couldn't generate the audio. Check your connection.\n\n${message}` }
}

// RIFF → wav; ID3 ou sync de frame MPEG (0xFF e os 3 bits altos do segundo byte)
// → mpeg; o resto, wav.
export function sniffAudioMime(bytes: Uint8Array): 'audio/wav' | 'audio/mpeg' {
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'audio/wav'
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'audio/mpeg'
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  return 'audio/wav'
}

export interface TtsSpeakInput {
  requestId: string
  // null: "Test voice", que grava no cache compartilhado.
  bookId: string | null
  model: string
  voice: string | null
  text: string
}

export async function ttsSpeak(input: TtsSpeakInput): Promise<Blob> {
  const buffer = await invoke<ArrayBuffer>('tts_speak', {
    requestId: input.requestId,
    bookId: input.bookId,
    model: input.model,
    voice: input.voice,
    text: input.text,
  })
  return new Blob([buffer], { type: sniffAudioMime(new Uint8Array(buffer)) })
}

export function ttsCancel(requestId: string): Promise<void> {
  return invoke<void>('tts_cancel', { requestId })
}

export function ttsCatalog(): Promise<TtsModel[]> {
  return invoke<TtsModel[]>('tts_catalog')
}

export function ttsClearBook(bookId: string): Promise<void> {
  return invoke<void>('tts_clear_book', { bookId })
}

export function ttsClearAll(): Promise<void> {
  return invoke<void>('tts_clear_all')
}

export function ttsCacheSize(): Promise<TtsCacheSize> {
  return invoke<TtsCacheSize>('tts_cache_size')
}

export function ttsUsage(): Promise<TtsUsage> {
  return invoke<TtsUsage>('tts_usage')
}

// Aviso do Rust quando o áudio não pode ser guardado (ffmpeg ausente, disco).
// A mensagem é a frase; o detalhe técnico vem depois de "\n\n".
export function onTtsWarning(handler: (message: string) => void): Promise<UnlistenFn> {
  return listen<{ message: string }>('tts://warning', (event) => handler(event.payload.message))
}
