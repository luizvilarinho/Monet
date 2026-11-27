import { describe, expect, it, vi } from 'vitest'
import { detectEpubLanguage, type EpubBookHandle } from './epub'
import { languageToolsOn } from './language'

// Texto inventado, mais de 40 palavras.
const PORTUGUESE =
  'Élise subiu ao sótão às nove e meia. A porta estava entreaberta e não havia luz, por isso ela foi subindo às apalpadelas. Ao fundo, um velho baú cheio de cartas esperava por ela. — Não mexa nisso — disse o senhor Arnaud, que a seguira sem fazer barulho. Ela se assustou.'

// O que o `detectEpubLanguage` toca no livro: o metadado e o corpo dos itens do spine.
function fakeBook(metadataLanguage: string | undefined, bodies: string[]) {
  const unload = vi.fn()
  const book = {
    packaging: { metadata: { language: metadataLanguage } },
    load: vi.fn(),
    spine: {
      get: (i: number) =>
        i < bodies.length
          ? {
              load: () => Promise.resolve({ querySelector: () => ({ textContent: bodies[i] }) }),
              unload,
            }
          : undefined,
    },
  } as unknown as EpubBookHandle
  return { book, unload }
}

describe('detectEpubLanguage', () => {
  it('uses the metadata when it names a language, without reading the text', async () => {
    const { book, unload } = fakeBook('fr-FR', [PORTUGUESE])
    expect(await detectEpubLanguage(book)).toBe('fr')
    expect(unload).not.toHaveBeenCalled()
  })

  it('metadata "und" (what Calibre writes when the language is blank) falls to the text sample', async () => {
    for (const tag of ['und', 'mul', 'zxx', 'mis', 'x-unknown']) {
      const { book, unload } = fakeBook(tag, [PORTUGUESE])
      expect(await detectEpubLanguage(book), tag).toBe('pt')
      expect(unload).toHaveBeenCalled()
    }
  })

  it('a book in the reader language with "und" does not turn the language tools on', async () => {
    const { book } = fakeBook('und', [PORTUGUESE])
    const language = await detectEpubLanguage(book)
    expect(languageToolsOn(language, 'pt', 'other')).toBe(false)
  })

  it('"und" with a text too short to tell is "not recognized", never "und"', async () => {
    const { book } = fakeBook('und', ['Élise monte au grenier.'])
    expect(await detectEpubLanguage(book)).toBe('')
  })
})
