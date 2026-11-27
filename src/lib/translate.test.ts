import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sem Tauri: os comandos e eventos do chat são simulados, na ordem em que o
// Rust os usa (ouvintes primeiro, depois o invoke, que emite chunk e done).
const rt = vi.hoisted(() => {
  type Handler = (payload: Record<string, unknown>) => void
  return {
    handlers: { chunk: new Set<Handler>(), done: new Set<Handler>(), error: new Set<Handler>() },
    order: [] as string[],
    reply: '' as string,
    startError: null as string | null,
    startImpl: null as null | ((requestId: string) => void),
  }
})

vi.mock('./openrouter', async (importActual) => {
  const actual = await importActual<typeof import('./openrouter')>()
  const subscribe = (name: 'chunk' | 'done' | 'error') =>
    vi.fn(async (handler: (p: Record<string, unknown>) => void) => {
      rt.order.push(`listen:${name}`)
      rt.handlers[name].add(handler)
      return () => rt.handlers[name].delete(handler)
    })
  return {
    ...actual,
    onOpenRouterChunk: subscribe('chunk'),
    onOpenRouterDone: subscribe('done'),
    onOpenRouterError: subscribe('error'),
    cancelOpenRouterStream: vi.fn(async () => {}),
    startOpenRouterStream: vi.fn(async ({ requestId }: { requestId: string }) => {
      rt.order.push('start')
      if (rt.startError) throw rt.startError
      if (rt.startImpl) return rt.startImpl(requestId)
      rt.handlers.chunk.forEach((h) => h({ requestId, text: rt.reply }))
      rt.handlers.done.forEach((h) => h({ requestId }))
    }),
  }
})

import * as openrouter from './openrouter'
import {
  TranslateError,
  buildTranslatePrompt,
  classifySelection,
  parseTranslation,
  requestTranslation,
  type TranslateInput,
} from './translate'

// Textos inventados (Apêndice E do plano).
const SENTENCE =
  "La porte du grenier était entrebâillée et il n'y avait pas de lumière, alors elle monta en tâtonnant."

const WORD_JSON =
  '{"kind":"word","term":"entrebâillée","baseForm":"entrebâiller","partOfSpeech":"participe passé","gender":"féminin","sense":"entreaberta","note":null}'

describe('classifySelection', () => {
  it('uma palavra é "word", mesmo com apóstrofo ou hífen', () => {
    expect(classifySelection('entrebâillée', SENTENCE)).toBe('word')
    expect(classifySelection("l'homme", SENTENCE)).toBe('word')
    expect(classifySelection('peut-être', SENTENCE)).toBe('word')
  })

  it('de duas a quatro palavras que não são a frase é "expression"', () => {
    expect(classifySelection('en tâtonnant', SENTENCE)).toBe('expression')
    expect(classifySelection('pas de lumière', SENTENCE)).toBe('expression')
    expect(classifySelection('il n’y avait pas', SENTENCE)).toBe('expression')
  })

  it('a frase inteira, mesmo curta, é "sentence" (sem diferença de pontuação)', () => {
    expect(classifySelection('Elle sursauta.', 'Elle sursauta.')).toBe('sentence')
    expect(classifySelection('elle  sursauta', 'Elle sursauta.')).toBe('sentence')
  })

  it('cinco palavras ou mais, e texto sem palavras, são "sentence"', () => {
    expect(classifySelection('une vieille malle pleine de lettres', SENTENCE)).toBe('sentence')
    expect(classifySelection('1984', SENTENCE)).toBe('sentence')
  })
})

describe('parseTranslation', () => {
  it('lê o JSON limpo de palavra', () => {
    expect(parseTranslation(WORD_JSON, 'word')).toEqual({
      kind: 'word',
      term: 'entrebâillée',
      baseForm: 'entrebâiller',
      partOfSpeech: 'participe passé',
      gender: 'féminin',
      sense: 'entreaberta',
      note: null,
    })
  })

  it('tira as cercas ``` e ```json', () => {
    expect(parseTranslation(`\`\`\`json\n${WORD_JSON}\n\`\`\``, 'word')?.kind).toBe('word')
    expect(parseTranslation(`\`\`\`\n${WORD_JSON}\n\`\`\``, 'expression')?.kind).toBe('word')
  })

  it('campos "null" ou vazios viram null', () => {
    const t = parseTranslation('{"sense":"entreaberta","baseForm":"null","gender":"  ","note":""}', 'word')
    expect(t).toMatchObject({ sense: 'entreaberta', baseForm: null, gender: null, note: null })
  })

  it('lê a passagem e fica com no máximo duas notas de gramática', () => {
    const raw = '{"kind":"passage","translation":"A porta estava entreaberta.","grammar":["a","b","c"]}'
    expect(parseTranslation(raw, 'sentence')).toEqual({
      kind: 'passage',
      translation: 'A porta estava entreaberta.',
      grammar: ['a', 'b'],
    })
  })

  it('passagem com JSON quebrado mostra o texto cru', () => {
    expect(parseTranslation('  A porta estava entreaberta.  ', 'sentence')).toEqual({
      kind: 'passage',
      translation: 'A porta estava entreaberta.',
      grammar: [],
    })
    expect(parseTranslation('{"translation": "A porta', 'sentence')).toMatchObject({ kind: 'passage' })
    expect(parseTranslation('', 'sentence')).toBeNull()
  })

  it('palavra com JSON quebrado, ou sem sentido, dá null', () => {
    expect(parseTranslation('{"kind":"word","term":"x"', 'word')).toBeNull()
    expect(parseTranslation('{"kind":"word","term":"x"}', 'word')).toBeNull()
    expect(parseTranslation('entreaberta', 'expression')).toBeNull()
  })
})

describe('buildTranslatePrompt', () => {
  const base: TranslateInput = {
    text: 'entrebâillée',
    sentence: SENTENCE,
    kind: 'word',
    sourceLanguage: 'fr',
    targetLanguage: 'pt',
  }

  it('palavra: traz as línguas por nome, o termo e a frase de contexto', () => {
    const { systemPrompt, userMessage } = buildTranslatePrompt(base)
    expect(systemPrompt).toContain('learning French')
    expect(userMessage).toContain("Book language: French. Reader's language: Portuguese.")
    expect(userMessage).toContain('Term: «entrebâillée»')
    expect(userMessage).toContain(`Sentence: «${SENTENCE}»`)
    expect(userMessage).toContain('"kind":"word"')
  })

  it('expressão usa o formato de palavra', () => {
    const { userMessage } = buildTranslatePrompt({ ...base, text: 'en tâtonnant', kind: 'expression' })
    expect(userMessage).toContain('Term: «en tâtonnant»')
    expect(userMessage).toContain('"kind":"word"')
  })

  it('passagem: traz o texto e pede a tradução com notas de gramática', () => {
    const { userMessage } = buildTranslatePrompt({ ...base, text: SENTENCE, kind: 'sentence' })
    expect(userMessage).toContain(`Text: «${SENTENCE}»`)
    expect(userMessage).toContain('"kind":"passage"')
    expect(userMessage).toContain('Translate the text into Portuguese')
    expect(userMessage).not.toContain('Sentence: «')
  })
})

describe('requestTranslation', () => {
  const input = (patch: Partial<TranslateInput & { model: string; signal: AbortSignal }> = {}) => ({
    text: 'entrebâillée',
    sentence: SENTENCE,
    kind: 'word' as const,
    sourceLanguage: 'fr',
    targetLanguage: 'pt',
    model: 'openai/gpt-4.1-mini',
    signal: new AbortController().signal,
    ...patch,
  })

  beforeEach(() => {
    rt.order.length = 0
    rt.reply = WORD_JSON
    rt.startError = null
    rt.startImpl = null
    vi.mocked(openrouter.startOpenRouterStream).mockClear()
    vi.mocked(openrouter.cancelOpenRouterStream).mockClear()
  })

  it('registra os ouvintes antes do invoke, devolve a tradução e solta os ouvintes', async () => {
    const result = await requestTranslation(input({ text: 'tâtonnant' }))
    expect(result).toMatchObject({ kind: 'word', sense: 'entreaberta' })
    expect(rt.order).toEqual(['listen:chunk', 'listen:done', 'listen:error', 'start'])
    expect(rt.handlers.chunk.size + rt.handlers.done.size + rt.handlers.error.size).toBe(0)
  })

  it('a mesma consulta na sessão não chama a IA de novo', async () => {
    await requestTranslation(input({ text: 'malle' }))
    await requestTranslation(input({ text: 'malle' }))
    expect(openrouter.startOpenRouterStream).toHaveBeenCalledTimes(1)
    await requestTranslation(input({ text: 'malle', model: 'openai/gpt-4.1' }))
    expect(openrouter.startOpenRouterStream).toHaveBeenCalledTimes(2)
  })

  it('sem chave: vira TranslateError "no_key", pelo invoke ou pelo evento', async () => {
    rt.startError = 'OPENROUTER_KEY_MISSING'
    await expect(requestTranslation(input({ text: 'lettres' }))).rejects.toMatchObject({ kind: 'no_key' })

    rt.startError = null
    rt.startImpl = (requestId) =>
      rt.handlers.error.forEach((h) => h({ requestId, code: 'OPENROUTER_KEY_MISSING', message: 'API key not configured' }))
    const error = await requestTranslation(input({ text: 'lettres' })).catch((e) => e)
    expect(error).toBeInstanceOf(TranslateError)
    expect(error.kind).toBe('no_key')
  })

  it('erro de rede ou resposta ilegível: "failed" (nada vai ao cache)', async () => {
    rt.startImpl = (requestId) =>
      rt.handlers.error.forEach((h) => h({ requestId, code: 'NETWORK_ERROR', message: 'network error' }))
    await expect(requestTranslation(input({ text: 'fouille' }))).rejects.toMatchObject({ kind: 'failed' })

    rt.startImpl = null
    rt.reply = 'não é JSON'
    await expect(requestTranslation(input({ text: 'fouille' }))).rejects.toMatchObject({ kind: 'failed' })
    rt.reply = WORD_JSON
    await expect(requestTranslation(input({ text: 'fouille' }))).resolves.toMatchObject({ kind: 'word' })
  })

  it('abortar cancela a requisição no Rust e rejeita com AbortError', async () => {
    const controller = new AbortController()
    rt.startImpl = () => controller.abort() // a resposta nunca chega
    const error = await requestTranslation(input({ text: 'sursauta', signal: controller.signal })).catch((e) => e)
    expect(error).toBeInstanceOf(DOMException)
    expect(error.name).toBe('AbortError')
    expect(openrouter.cancelOpenRouterStream).toHaveBeenCalledTimes(1)
    expect(rt.handlers.done.size).toBe(0)
  })

  it('já abortado: nem começa', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(requestTranslation(input({ text: 'lampe', signal: controller.signal }))).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(openrouter.startOpenRouterStream).not.toHaveBeenCalled()
  })
})
