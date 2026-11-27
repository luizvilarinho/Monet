import { describe, expect, it } from 'vitest'
import { baseLanguage, languageName, languageTag, languageToolsOn } from './language'

describe('baseLanguage', () => {
  it('fica só com a língua base, em minúsculas', () => {
    expect(baseLanguage('pt-BR')).toBe('pt')
    expect(baseLanguage('pt_BR')).toBe('pt')
    expect(baseLanguage('FR')).toBe('fr')
    expect(baseLanguage('en-US')).toBe('en')
    expect(baseLanguage(' fr ')).toBe('fr')
  })

  it('devolve vazio para ausente ou vazio', () => {
    expect(baseLanguage(null)).toBe('')
    expect(baseLanguage(undefined)).toBe('')
    expect(baseLanguage('')).toBe('')
  })

  it('códigos que não são língua dão vazio: o EPUB cai na amostra do texto', () => {
    for (const tag of ['und', 'UND', 'mul', 'zxx', 'mis', 'x-custom', 'x', 'i-klingon', ' und ']) {
      expect(baseLanguage(tag), tag).toBe('')
    }
  })

  it('converte o ISO 639-2 que alguns EPUB trazem', () => {
    expect(baseLanguage('eng')).toBe('en')
    expect(baseLanguage('fra')).toBe('fr')
    expect(baseLanguage('por')).toBe('pt')
  })
})

describe('languageName e languageTag', () => {
  it('dá o nome em inglês e a etiqueta curta', () => {
    expect(languageName('fr')).toBe('French')
    expect(languageName('pt')).toBe('Portuguese')
    expect(languageTag('fr')).toBe('FR')
  })

  it('língua não reconhecida aparece como "—"', () => {
    expect(languageName('')).toBe('—')
    expect(languageTag('')).toBe('—')
  })
})

describe('languageToolsOn', () => {
  it('"other": só em livro de outra língua, pela língua base', () => {
    expect(languageToolsOn('fr', 'pt', 'other')).toBe(true)
    expect(languageToolsOn('pt', 'pt', 'other')).toBe(false)
    expect(languageToolsOn('pt-BR', 'pt', 'other')).toBe(false)
    expect(languageToolsOn('pt', 'pt-BR', 'other')).toBe(false)
  })

  it('"all": em todo livro com língua, inclusive na língua nativa', () => {
    expect(languageToolsOn('fr', 'pt', 'all')).toBe(true)
    expect(languageToolsOn('pt', 'pt', 'all')).toBe(true)
  })

  it('"never": nunca', () => {
    expect(languageToolsOn('fr', 'pt', 'never')).toBe(false)
    expect(languageToolsOn('pt', 'pt', 'never')).toBe(false)
  })

  it('livro sem língua (null) ou não reconhecida ("") nunca ativa', () => {
    for (const mode of ['other', 'all', 'never'] as const) {
      expect(languageToolsOn(null, 'pt', mode)).toBe(false)
      expect(languageToolsOn('', 'pt', mode)).toBe(false)
      // "und" e afins não são língua: nem um livro já gravado assim liga as ferramentas.
      expect(languageToolsOn('und', 'pt', mode)).toBe(false)
    }
  })
})
