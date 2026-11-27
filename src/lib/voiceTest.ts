// Texto do "Test voice" do Settings: uma frase curta, inventada, na língua do
// livro que o usuário abriu por último (a que ele estuda). Custa o preço de uma
// frase. O app não supõe uma língua de estudo: sem livro de outra língua, o teste
// usa a língua nativa do usuário.
import type { Book } from '../types'
import { baseLanguage } from './language'

const FALLBACK_LANGUAGE = 'en'

const TEST_SENTENCES: Record<string, string> = {
  fr: 'Élise monte au grenier à 21 h 30.',
  en: 'The attic door was ajar and there was no light, so she climbed the stairs by feel.',
  pt: 'Élise sobe ao sótão às nove e meia.',
  es: 'Élise sube al desván a las nueve y media.',
  it: 'Élise sale in soffitta alle nove e mezza.',
  de: 'Élise geht um halb zehn auf den Dachboden.',
  nl: 'Élise gaat om half tien naar de zolder.',
  ca: "L'Élise puja a les golfes a dos quarts de deu.",
  ro: 'Élise urcă la mansardă la nouă și jumătate.',
  pl: 'Élise wchodzi na strych o wpół do dziesiątej.',
  sv: 'Élise går upp på vinden klockan halv tio.',
  da: 'Élise går op på loftet klokken halv ti.',
  no: 'Élise går opp på loftet klokken halv ti.',
  fi: 'Élise nousee ullakolle puoli kymmeneltä.',
  cs: 'Élise vystoupí v půl desáté na půdu.',
  tr: 'Élise saat dokuz buçukta tavan arasına çıkıyor.',
}

// A língua que o usuário estuda: a do livro aberto por último (maior
// `lastOpenedAt`) cuja língua não é a nativa. null sem livro assim.
export function pickStudyLanguage(books: Book[], nativeLanguage: string): string | null {
  const native = baseLanguage(nativeLanguage)
  let best: Book | null = null
  for (const book of books) {
    const language = baseLanguage(book.language)
    if (!language || language === native || book.lastOpenedAt === null) continue
    if (!best || book.lastOpenedAt > (best.lastOpenedAt ?? 0)) best = book
  }
  return best ? baseLanguage(best.language) : null
}

// A língua do "Test voice" e da voz do Settings: a que o usuário estuda; sem ela, a
// nativa; sem nativa, o inglês.
export function pickTestLanguage(books: Book[], nativeLanguage: string): string {
  return pickStudyLanguage(books, nativeLanguage) ?? (baseLanguage(nativeLanguage) || FALLBACK_LANGUAGE)
}

// Língua sem frase própria (a lista cobre as que o app oferece): a inglesa.
export function testSentenceFor(language: string): string {
  return TEST_SENTENCES[baseLanguage(language)] ?? TEST_SENTENCES[FALLBACK_LANGUAGE]
}
