// Configuração das ferramentas de língua do Library, em localStorage. Cada
// setter avisa por evento: o useLanguageSettings re-renderiza e as ferramentas
// aparecem e somem na hora, sem recarregar o leitor.
import { baseLanguage, type LanguageToolsMode } from './language'

export const LANGUAGE_SETTINGS_EVENT = 'monet:language-settings'

export const NATIVE_LANGUAGE_KEY = 'monet:native-language'
export const LANGUAGE_TOOLS_KEY = 'monet:language-tools'
export const TRANSLATE_MODEL_KEY = 'monet:translate-model'
export const TTS_MODEL_KEY = 'monet:tts-model'
export const TTS_VOICES_KEY = 'monet:tts-voices'
export const TTS_SPEED_KEY = 'monet:tts-speed'
export const TTS_SHOW_TEXT_KEY = 'monet:tts-show-text'
export const TTS_SKIP_HEADERS_KEY = 'monet:tts-skip-headers'
export const VOCAB_HIDE_SENSES_KEY = 'monet:vocab-hide-senses'
export const VOCAB_SEND_TRANSLATION_KEY = 'monet:vocab-send-translation'
export const VOCAB_MARKS_KEY = 'monet:vocab-marks'
export const READER_TEACHER_KEY = 'monet:reader-teacher'

export const DEFAULT_TRANSLATE_MODEL = 'openai/gpt-4.1-mini'
// O único id de modelo de voz escrito no código. Todo o resto (modelos, vozes,
// formatos, preços) vem do catálogo do OpenRouter em tempo de execução.
export const DEFAULT_TTS_MODEL = 'google/gemini-3.8-flash-tts'

// Velocidades do player. Mais lenta que a voz natural, para quem está aprendendo.
export const TTS_SPEEDS = [0.75, 0.85, 1] as const
export const DEFAULT_TTS_SPEED = 0.85

function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key)?.trim()
    return value ? value : null
  } catch {
    return null
  }
}

// `value` null apaga a chave (volta ao padrão).
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Sem armazenamento (janela privada, cota): vale só até recarregar.
  }
  window.dispatchEvent(new Event(LANGUAGE_SETTINGS_EVENT))
}

// Padrão: a língua do sistema (`monet:user-language`, gravado no App na
// primeira carga). Essa chave comanda os prompts do app inteiro e a agenda, por
// isso só é lida aqui, nunca escrita.
export function getSystemLanguage(): string {
  return baseLanguage(read('monet:user-language') ?? navigator.language) || 'en'
}

export function getNativeLanguage(): string {
  return baseLanguage(read(NATIVE_LANGUAGE_KEY)) || getSystemLanguage()
}

// '' volta ao padrão (a língua do sistema).
export function setNativeLanguage(code: string): void {
  write(NATIVE_LANGUAGE_KEY, baseLanguage(code) || null)
}

export function getLanguageToolsMode(): LanguageToolsMode {
  const raw = read(LANGUAGE_TOOLS_KEY)
  return raw === 'all' || raw === 'never' ? raw : 'other'
}

export function setLanguageToolsMode(mode: LanguageToolsMode): void {
  write(LANGUAGE_TOOLS_KEY, mode === 'other' ? null : mode)
}

export function getTranslateModel(): string {
  return read(TRANSLATE_MODEL_KEY) ?? DEFAULT_TRANSLATE_MODEL
}

// Mesmo critério do `is_valid_model_id` do Rust: `provedor/nome`, sem espaço.
export function isValidModelId(model: string): boolean {
  return model.length <= 200 && /^[A-Za-z0-9._:-]+\/[A-Za-z0-9._:-]+$/.test(model)
}

// Vazio volta ao padrão.
export function setTranslateModel(model: string): void {
  const trimmed = model.trim()
  write(TRANSLATE_MODEL_KEY, trimmed && trimmed !== DEFAULT_TRANSLATE_MODEL ? trimmed : null)
}

export function getTtsModel(): string {
  return read(TTS_MODEL_KEY) ?? DEFAULT_TTS_MODEL
}

// Vale a partir da próxima frase gerada: o player lê o modelo a cada pedido.
export function setTtsModel(model: string): void {
  const trimmed = model.trim()
  if (trimmed && !isValidModelId(trimmed)) return
  write(TTS_MODEL_KEY, trimmed && trimmed !== DEFAULT_TTS_MODEL ? trimmed : null)
}

function readVoices(): Record<string, string> {
  const raw = read(TTS_VOICES_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const voices: Record<string, string> = {}
    for (const [model, voice] of Object.entries(parsed)) {
      if (typeof voice === 'string' && voice) voices[model] = voice
    }
    return voices
  } catch {
    return {}
  }
}

// `monet:tts-voices` guarda a voz por modelo e por língua do livro: a chave é
// "<modelo>|<língua>" (o id do modelo nunca tem "|"). A chave só com o modelo é o
// formato antigo, uma voz para qualquer língua, e continua valendo.
function voiceKey(modelId: string, language: string): string {
  const base = baseLanguage(language)
  return base ? `${modelId}|${base}` : modelId
}

// A voz lembrada neste modelo para esta língua (senão a de qualquer língua, do
// formato antigo); null quando nunca se escolheu (vale a primeira que traz a
// língua, ver `voiceFor`).
export function getTtsVoice(modelId: string, language = ''): string | null {
  const voices = readVoices()
  const own = language ? voices[voiceKey(modelId, language)] : undefined
  return own ?? voices[modelId] ?? null
}

export function setTtsVoice(modelId: string, voice: string | null, language = ''): void {
  const voices = readVoices()
  const key = voiceKey(modelId, language)
  if (voice) voices[key] = voice
  else delete voices[key]
  write(TTS_VOICES_KEY, Object.keys(voices).length ? JSON.stringify(voices) : null)
}

// Modelo e voz juntos: o seletor do Settings e o do menu do player gravam assim.
export function setTtsChoice(modelId: string, voice: string | null, language = ''): void {
  setTtsModel(modelId)
  setTtsVoice(modelId, voice, language)
}

export function getTtsSpeed(): number {
  const parsed = Number(read(TTS_SPEED_KEY))
  return TTS_SPEEDS.find((speed) => speed === parsed) ?? DEFAULT_TTS_SPEED
}

export function setTtsSpeed(speed: number): void {
  write(TTS_SPEED_KEY, speed === DEFAULT_TTS_SPEED ? null : String(speed))
}

export function getTtsShowText(): boolean {
  return read(TTS_SHOW_TEXT_KEY) !== '0'
}

export function setTtsShowText(value: boolean): void {
  write(TTS_SHOW_TEXT_KEY, value ? null : '0')
}

export function getTtsSkipHeaders(): boolean {
  return read(TTS_SKIP_HEADERS_KEY) !== '0'
}

export function setTtsSkipHeaders(value: boolean): void {
  write(TTS_SKIP_HEADERS_KEY, value ? null : '0')
}

// Locale das datas da aba Vocabulary e do bloco na nota: o do usuário (pt-BR,
// en-US…), como o resto do app. Só é lido, nunca escrito.
export function getUserLocale(): string {
  return read('monet:user-language') ?? navigator.language
}

// "Hide meanings" da aba Vocabulary.
export function getVocabHideSenses(): boolean {
  return read(VOCAB_HIDE_SENSES_KEY) === '1'
}

export function setVocabHideSenses(value: boolean): void {
  write(VOCAB_HIDE_SENSES_KEY, value ? '1' : null)
}

// "Include the translation (collapsed)" do envio ao caderno.
export function getVocabSendTranslation(): boolean {
  return read(VOCAB_SEND_TRANSLATION_KEY) !== '0'
}

export function setVocabSendTranslation(value: boolean): void {
  write(VOCAB_SEND_TRANSLATION_KEY, value ? null : '0')
}

// "Mark in text": o sublinhado pontilhado das palavras guardadas. Ligado por padrão.
export function getVocabMarks(): boolean {
  return read(VOCAB_MARKS_KEY) !== '0'
}

export function setVocabMarks(value: boolean): void {
  write(VOCAB_MARKS_KEY, value ? null : '0')
}

function readTeacherBooks(): Record<string, true> {
  const raw = read(READER_TEACHER_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const books: Record<string, true> = {}
    for (const [bookId, on] of Object.entries(parsed)) {
      if (on === true) books[bookId] = true
    }
    return books
  } catch {
    return {}
  }
}

// O interruptor "Language teacher" do chat do leitor, lembrado por livro.
// Desligado por padrão.
export function getReaderTeacher(bookId: string): boolean {
  return readTeacherBooks()[bookId] === true
}

export function setReaderTeacher(bookId: string, on: boolean): void {
  const books = readTeacherBooks()
  if (on) books[bookId] = true
  else delete books[bookId]
  write(READER_TEACHER_KEY, Object.keys(books).length ? JSON.stringify(books) : null)
}
