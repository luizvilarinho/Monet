// Tradução da seleção do Library (popover de Translate), pelo comando de chat
// que já existe (`openrouter_stream_chat`): sem comando novo no Rust. A IA dá o
// sentido no contexto, na língua nativa; nada é guardado aqui, só a memória da
// sessão para a consulta repetida não chamar a IA de novo.
import type { UnlistenFn } from '@tauri-apps/api/event'
import { languageName } from './language'
import {
  OPENROUTER_KEY_MISSING,
  cancelOpenRouterStream,
  onOpenRouterChunk,
  onOpenRouterDone,
  onOpenRouterError,
  readableChatError,
  startOpenRouterStream,
} from './openrouter'

// Acima disso o Translate não chama a IA (cerca de um parágrafo): a IA não
// traduz a página pelo usuário.
export const TRANSLATE_CHAR_LIMIT = 1500

export type SelectionKind = 'word' | 'expression' | 'sentence'

export interface WordTranslation {
  kind: 'word'
  term: string
  baseForm: string | null
  partOfSpeech: string | null
  gender: string | null
  sense: string
  note: string | null
}

export interface PassageTranslation {
  kind: 'passage'
  translation: string
  grammar: string[]
}

export type Translation = WordTranslation | PassageTranslation

export interface TranslateInput {
  text: string
  sentence: string
  kind: SelectionKind
  sourceLanguage: string
  targetLanguage: string
}

// 'no_key' leva ao "Open Settings"; 'failed' ao "Try again".
export class TranslateError extends Error {
  kind: 'no_key' | 'failed'
  constructor(kind: 'no_key' | 'failed', message: string) {
    super(message)
    this.name = 'TranslateError'
    this.kind = kind
  }
}

const WORD_RE = /\p{L}+(?:['’-]\p{L}+)*/gu

// Sem pontuação, espaço colapsado, minúsculas: "Elle sursauta" e
// "Elle sursauta." são a mesma frase.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Uma palavra é 'word'; de duas a quatro que não são a frase inteira, 'expression';
// o resto, 'sentence'.
export function classifySelection(text: string, sentence: string): SelectionKind {
  const count = text.match(WORD_RE)?.length ?? 0
  if (count === 1) return 'word'
  if (count >= 2 && count <= 4 && normalize(text) !== normalize(sentence)) return 'expression'
  return 'sentence'
}

export function buildTranslatePrompt(input: TranslateInput): {
  systemPrompt: string
  userMessage: string
} {
  const source = languageName(input.sourceLanguage)
  const target = languageName(input.targetLanguage)
  const header = `Book language: ${source}. Reader's language: ${target}.`
  const systemPrompt = `You help a reader who is learning ${source}. Reply with JSON only, no prose, no code fences.`
  const userMessage =
    input.kind === 'sentence'
      ? `${header}\nText: «${input.text}»\nTranslate the text into ${target}, faithful and natural. Add at most two short grammar notes in ${target} about structures in the text a learner may not know. JSON: {"kind":"passage","translation":"…","grammar":["…"]}`
      : `${header}\nTerm: «${input.text}»\nSentence: «${input.sentence}»\nGive the meaning of the term in this sentence, in ${target}. JSON: {"kind":"word","term":"…","baseForm":"… or null","partOfSpeech":"… or null","gender":"… or null","sense":"meaning in this sentence, in ${target}, at most 12 words","note":"one short usage note in ${target}, or null"}`
  return { systemPrompt, userMessage }
}

function stripFences(raw: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim())
  return fenced ? fenced[1] : raw.trim()
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.toLowerCase() !== 'null' ? trimmed : null
}

// JSON da IA → tradução. Passagem com JSON inválido mostra o texto cru; palavra
// com JSON inválido dá null (o popover mostra o erro).
export function parseTranslation(raw: string, kind: SelectionKind): Translation | null {
  let data: Record<string, unknown> | null = null
  try {
    const parsed: unknown = JSON.parse(stripFences(raw))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>
    }
  } catch {
    data = null
  }

  if (kind === 'sentence') {
    const translation = data ? asText(data.translation) : null
    if (data && translation) {
      const grammar = Array.isArray(data.grammar)
        ? data.grammar.map(asText).filter((g): g is string => g !== null).slice(0, 2)
        : []
      return { kind: 'passage', translation, grammar }
    }
    const text = raw.trim()
    return text ? { kind: 'passage', translation: text, grammar: [] } : null
  }

  const sense = data ? asText(data.sense) : null
  if (!data || !sense) return null
  return {
    kind: 'word',
    term: asText(data.term) ?? '',
    baseForm: asText(data.baseForm),
    partOfSpeech: asText(data.partOfSpeech),
    gender: asText(data.gender),
    sense,
    note: asText(data.note),
  }
}

// Memória da sessão: a mesma consulta não chama a IA de novo.
const cache = new Map<string, Translation>()

function translationCacheKey(model: string, input: TranslateInput): string {
  const { sourceLanguage, targetLanguage, kind, text, sentence } = input
  // A frase de contexto só entra no prompt da palavra e da expressão.
  const context = kind === 'sentence' ? '' : sentence.trim()
  return [model, sourceLanguage, targetLanguage, kind, text.trim(), context].join('\u0000')
}

function abortError(): DOMException {
  return new DOMException('Translation aborted', 'AbortError')
}

function failure(code: string | undefined, message: string): TranslateError {
  if (code === OPENROUTER_KEY_MISSING || message.includes(OPENROUTER_KEY_MISSING)) {
    return new TranslateError('no_key', 'Add your OpenRouter key in Settings.')
  }
  return new TranslateError('failed', readableChatError(code, message).message)
}

// Os ouvintes entram ANTES do invoke (o primeiro chunk pode chegar antes de ele
// resolver). Abortar cancela a requisição no Rust e rejeita com AbortError.
export async function requestTranslation(
  input: TranslateInput & { model: string; signal: AbortSignal },
): Promise<Translation> {
  const { model, signal, ...translate } = input
  const key = translationCacheKey(model, translate)
  const cached = cache.get(key)
  if (cached) return cached
  if (signal.aborted) throw abortError()

  const requestId = crypto.randomUUID()
  const { systemPrompt, userMessage } = buildTranslatePrompt(translate)
  const unlisteners: UnlistenFn[] = []
  let raw = ''
  let settle!: { resolve: () => void; reject: (reason: unknown) => void }
  const outcome = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject }
  })
  // Se o invoke falhar antes de alguém esperar o desfecho, não vira rejeição solta.
  outcome.catch(() => {})
  const onAbort = () => {
    void cancelOpenRouterStream(requestId).catch(() => {})
    settle.reject(abortError())
  }

  try {
    unlisteners.push(
      await onOpenRouterChunk((p) => {
        if (p.requestId === requestId) raw += p.text
      }),
      await onOpenRouterDone((p) => {
        if (p.requestId === requestId) settle.resolve()
      }),
      await onOpenRouterError((p) => {
        if (p.requestId === requestId) settle.reject(failure(p.code, p.message))
      }),
    )
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) throw abortError()

    try {
      await startOpenRouterStream({ requestId, model, systemPrompt, userMessage })
    } catch (e) {
      throw failure(undefined, e instanceof Error ? e.message : String(e))
    }
    await outcome

    const parsed = parseTranslation(raw, translate.kind)
    if (!parsed) throw new TranslateError('failed', 'The AI answered in an unexpected format.')
    cache.set(key, parsed)
    return parsed
  } finally {
    signal.removeEventListener('abort', onAbort)
    unlisteners.forEach((unlisten) => unlisten())
  }
}
