// Língua dos livros do Library: códigos base, nomes e a regra que decide
// quando as ferramentas de língua (Translate, e nas entregas seguintes Listen e
// vocabulário) aparecem. Funções puras: a configuração fica em languageSettings.

// Códigos oferecidos na edição de um livro, no Translate e no Settings.
export const LANGUAGE_CODES = [
  'en', 'fr', 'pt', 'es', 'it', 'de', 'nl', 'ca', 'ro', 'pl', 'sv', 'da', 'no', 'fi', 'cs', 'tr',
] as const

// Metadado de EPUB às vezes vem em ISO 639-2 ("eng" é o padrão do Calibre).
const ISO3_TO_BASE: Record<string, string> = {
  eng: 'en', fra: 'fr', fre: 'fr', por: 'pt', spa: 'es', ita: 'it', deu: 'de', ger: 'de',
  nld: 'nl', dut: 'nl', cat: 'ca', ron: 'ro', rum: 'ro', pol: 'pl', swe: 'sv', dan: 'da',
  nor: 'no', nob: 'no', fin: 'fi', ces: 'cs', cze: 'cs', tur: 'tr',
}

// Códigos de metadado que não dizem a língua: indeterminada ("und", o que o
// Calibre grava sem preenchimento), múltiplas, sem conteúdo linguístico, não
// codificada, e as subtags privadas ("x-…") e legadas ("i-…").
const NOT_A_LANGUAGE = new Set(['und', 'mul', 'zxx', 'mis', 'x', 'i'])

// Só a língua base, em minúsculas: 'pt-BR' e 'pt_BR' dão 'pt'. Vazio, ausente ou
// um código que não é língua ('und') dá '' (língua não reconhecida).
export function baseLanguage(tag: string | null | undefined): string {
  if (!tag) return ''
  const base = tag.trim().toLowerCase().split(/[-_]/)[0] ?? ''
  if (NOT_A_LANGUAGE.has(base)) return ''
  return ISO3_TO_BASE[base] ?? base
}

let displayNames: Intl.DisplayNames | null | undefined

// "French" para 'fr'; '—' para '' (não reconhecida). Código que o Intl não
// conhece volta como veio, em maiúsculas.
export function languageName(code: string): string {
  if (!code) return '—'
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'language' })
    } catch {
      displayNames = null
    }
  }
  try {
    return displayNames?.of(code) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

// Etiqueta curta da coluna Language: 'FR'; '—' para não reconhecida.
export function languageTag(code: string): string {
  return code ? code.toUpperCase() : '—'
}

// Quando mostrar as ferramentas: só em livro de outra língua (padrão), em todo
// livro com língua, ou nunca.
export type LanguageToolsMode = 'other' | 'all' | 'never'

// Livro sem língua definida (null) ou não reconhecida ('') nunca ativa as
// ferramentas: o leitor fica idêntico ao de antes.
export function languageToolsOn(
  bookLanguage: string | null,
  nativeLanguage: string,
  mode: LanguageToolsMode,
): boolean {
  if (mode === 'never') return false
  const book = baseLanguage(bookLanguage)
  if (!book) return false
  if (mode === 'all') return true
  return book !== baseLanguage(nativeLanguage)
}
