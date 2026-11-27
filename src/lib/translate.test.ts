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
  extractPartialTranslation,
  parseTranslation,
  requestTranslation,
  type PartialTranslation,
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

describe('extractPartialTranslation, the passage text while the answer is still arriving', () => {
  const text = (raw: string) => extractPartialTranslation(raw).text
  const head = '{"translation":"'

  it('shows nothing until the "translation" key and its opening quote have arrived', () => {
    expect(extractPartialTranslation('')).toEqual({ text: '', closed: false })
    expect(text('{')).toBe('')
    expect(text('{"kind":"pass')).toBe('')
    expect(text('{"kind":"passage","translat')).toBe('')
    expect(text('{"kind":"passage","translation"')).toBe('')
    expect(text('{"kind":"passage","translation":')).toBe('')
    expect(text('{"kind":"passage","translation": ')).toBe('')
  })

  it('grows with the value of the field, as the pieces arrive', () => {
    const start = '{"kind":"passage","translation":"'
    expect(text(`${start}A porta`)).toBe('A porta')
    expect(text(`${start}A porta estava entre`)).toBe('A porta estava entre')
    expect(extractPartialTranslation(`${start}A porta estava entreaberta.`)).toEqual({
      text: 'A porta estava entreaberta.',
      closed: false,
    })
  })

  it('stops at the closing quote and says the text is closed', () => {
    const raw = '{"kind":"passage","translation":"A porta estava entreaberta.","grammar":["Uma nota'
    expect(extractPartialTranslation(raw)).toEqual({ text: 'A porta estava entreaberta.', closed: true })
  })

  it('decodes the JSON escapes', () => {
    expect(text(`${head}Ela disse \\"oi\\" e saiu`)).toBe('Ela disse "oi" e saiu')
    expect(text(`${head}Linha um\\nlinha dois\\ttab`)).toBe('Linha um\nlinha dois\ttab')
    expect(text(`${head}a\\\\b\\/c`)).toBe('a\\b/c')
    expect(text(`${head}entreaberta \\u00e9 e \\u00C0`)).toBe('entreaberta é e À')
    expect(text(`${head}caf\\u00e9, fim"`)).toBe('café, fim')
  })

  it('holds back an escape that was cut at the end', () => {
    expect(text(`${head}Ela disse \\`)).toBe('Ela disse')
    expect(text(`${head}Ela disse \\u`)).toBe('Ela disse')
    expect(text(`${head}Ela disse \\u00`)).toBe('Ela disse')
    expect(text(`${head}Ela disse \\u00e`)).toBe('Ela disse')
    expect(text(`${head}Ela disse \\u00e9`)).toBe('Ela disse é')
    // O escape inteiro, depois do pedaço cortado, aparece.
    expect(text(`${head}Ela disse \\"oi`)).toBe('Ela disse "oi')
  })

  it('a backslash that is itself escaped is text, not the start of an escape', () => {
    expect(text(`${head}a\\\\`)).toBe('a\\')
  })

  it('waits for the second half of a surrogate pair', () => {
    const start = `${head}Olá `
    expect(text(`${start}\\ud83d`)).toBe('Olá')
    expect(text(`${start}\\ud83d\\`)).toBe('Olá')
    expect(text(`${start}\\ud83d\\ude0`)).toBe('Olá')
    expect(text(`${start}\\ud83d\\ude00`)).toBe('Olá \u{1F600}')
    expect(text(`${start}\\ud83d\\ude00 e mais`)).toBe('Olá \u{1F600} e mais')
  })

  it('an escape that is not valid JSON counts as its character', () => {
    expect(text(`${head}a\\xb`)).toBe('axb')
    expect(text(`${head}a\\uZZZZb`)).toBe('auZZZZb')
  })

  it('skips the opening code fence, even before the line ends', () => {
    expect(text('`')).toBe('')
    expect(text('``')).toBe('')
    expect(text('```')).toBe('')
    expect(text('```json')).toBe('')
    expect(text('```json\n')).toBe('')
    expect(text('```json\n{"translation":"A porta')).toBe('A porta')
    expect(text('```\n{"translation":"A porta","grammar":[]}\n```')).toBe('A porta')
  })

  it('an answer in plain text, without JSON, is shown raw (as parseTranslation does at the end)', () => {
    expect(extractPartialTranslation('  A porta estava ')).toEqual({ text: 'A porta estava', closed: false })
    expect(text('A porta estava entreaberta.')).toBe('A porta estava entreaberta.')
  })

  it('JSON without the key never shows anything, and the end falls back to the raw text', () => {
    const raw = '{"text":"A porta estava entreaberta."}'
    expect(text(raw)).toBe('')
    expect(parseTranslation(raw, 'sentence')).toMatchObject({ kind: 'passage', translation: raw })
  })

  it('what the partial shows is always a prefix of the final translation', () => {
    const final = '{"kind":"passage","translation":"Ela disse \\"oi\\"\\npuis \\u00e9tait partie.","grammar":["a"]}'
    const parsed = parseTranslation(final, 'sentence')
    expect(parsed).toMatchObject({ kind: 'passage' })
    const full = parsed?.kind === 'passage' ? parsed.translation : ''
    expect(full).toBe('Ela disse "oi"\npuis était partie.')
    for (let end = 0; end <= final.length; end++) {
      expect(full.startsWith(extractPartialTranslation(final.slice(0, end)).text)).toBe(true)
    }
    expect(extractPartialTranslation(final)).toEqual({ text: full, closed: true })
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
  const input = (
    patch: Partial<
      TranslateInput & { model: string; signal: AbortSignal; onPartial: (partial: PartialTranslation) => void }
    > = {},
  ) => ({
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

  describe('com onPartial (o texto da passagem crescendo enquanto chega)', () => {
    const PASSAGE = '{"kind":"passage","translation":"A porta estava entreaberta.","grammar":["Uma nota"]}'
    const pieces =
      (...parts: string[]) =>
      (requestId: string) => {
        parts.forEach((text) => rt.handlers.chunk.forEach((h) => h({ requestId, text })))
        rt.handlers.done.forEach((h) => h({ requestId }))
      }

    it('avisa o texto a cada pedaço que o muda e termina com o resultado do parseTranslation', async () => {
      rt.startImpl = pieces(
        '{"kind":"passage",',
        '"translation":"A porta',
        ' estava entre',
        'aberta.",',
        '"grammar":["Uma',
        ' nota"]}',
      )
      const seen: PartialTranslation[] = []
      const result = await requestTranslation(
        input({ text: SENTENCE, kind: 'sentence', onPartial: (p) => seen.push(p) }),
      )
      expect(seen).toEqual([
        { text: 'A porta', closed: false },
        { text: 'A porta estava entre', closed: false },
        { text: 'A porta estava entreaberta.', closed: true },
      ])
      expect(result).toEqual({ kind: 'passage', translation: 'A porta estava entreaberta.', grammar: ['Uma nota'] })
    })

    it('resposta em texto puro: o parcial é o texto cru, e o fim também', async () => {
      rt.startImpl = pieces('A porta ', 'estava entreaberta.')
      const seen: string[] = []
      const result = await requestTranslation(
        input({ text: `${SENTENCE} (texto puro)`, kind: 'sentence', onPartial: (p) => seen.push(p.text) }),
      )
      expect(seen).toEqual(['A porta', 'A porta estava entreaberta.'])
      expect(result).toMatchObject({ kind: 'passage', translation: 'A porta estava entreaberta.' })
    })

    it('a palavra não chega aos poucos: sem parcial, o mesmo resultado', async () => {
      rt.startImpl = pieces(WORD_JSON.slice(0, 60), WORD_JSON.slice(60))
      const onPartial = vi.fn()
      const result = await requestTranslation(input({ text: 'sursauter', onPartial }))
      expect(onPartial).not.toHaveBeenCalled()
      expect(result).toMatchObject({ kind: 'word', sense: 'entreaberta' })
    })

    it('consulta em cache responde na hora, sem parcial e sem nova chamada', async () => {
      rt.startImpl = pieces(PASSAGE)
      const text = `${SENTENCE} (cache)`
      await requestTranslation(input({ text, kind: 'sentence' }))
      const onPartial = vi.fn()
      const calls = vi.mocked(openrouter.startOpenRouterStream).mock.calls.length
      const result = await requestTranslation(input({ text, kind: 'sentence', onPartial }))
      expect(onPartial).not.toHaveBeenCalled()
      expect(vi.mocked(openrouter.startOpenRouterStream).mock.calls.length).toBe(calls)
      expect(result).toMatchObject({ kind: 'passage' })
    })

    it('erro no meio: o parcial já foi avisado e a requisição rejeita', async () => {
      rt.startImpl = (requestId) => {
        rt.handlers.chunk.forEach((h) => h({ requestId, text: '{"translation":"A porta est' }))
        rt.handlers.error.forEach((h) => h({ requestId, code: 'NETWORK_ERROR', message: 'network error' }))
      }
      const seen: string[] = []
      await expect(
        requestTranslation(
          input({ text: `${SENTENCE} (erro)`, kind: 'sentence', onPartial: (p) => seen.push(p.text) }),
        ),
      ).rejects.toMatchObject({ kind: 'failed' })
      expect(seen).toEqual(['A porta est'])
    })

    it('abortada, não avisa mais nada', async () => {
      const controller = new AbortController()
      rt.startImpl = (requestId) => {
        rt.handlers.chunk.forEach((h) => h({ requestId, text: '{"translation":"A porta' }))
        controller.abort()
        rt.handlers.chunk.forEach((h) => h({ requestId, text: ' estava' }))
      }
      const seen: string[] = []
      const error = await requestTranslation(
        input({
          text: `${SENTENCE} (abort)`,
          kind: 'sentence',
          signal: controller.signal,
          onPartial: (p) => seen.push(p.text),
        }),
      ).catch((e) => e)
      expect(error.name).toBe('AbortError')
      expect(seen).toEqual(['A porta'])
    })
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
