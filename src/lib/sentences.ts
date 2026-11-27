// Divisão do texto em frases (a unidade do Translate e, nas entregas
// seguintes, do áudio e do cache). Parte do Intl.Segmenter e corrige o que ele
// erra em livro: abreviação, inicial, minúscula depois do ponto, citação com
// « … » e frase longa demais para uma chamada de voz. Funções puras.
import { baseLanguage } from './language'

// Teto de uma frase: é o que cabe numa chamada de voz.
const MAX_SENTENCE_CHARS = 400

// Abreviações que terminam em ponto sem terminar a frase (comparadas sem o
// ponto final).
const ABBREVIATIONS: Record<string, Set<string>> = {
  fr: new Set(
    ['M', 'MM', 'Mme', 'Mlle', 'Mmes', 'Dr', 'Pr', 'St', 'Ste', 'p', 'pp', 'cf', 'etc', 'av', 'apr', 'J.-C', 'n°', 'vol', 'chap'],
  ),
  en: new Set(['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'vs', 'e.g', 'i.e', 'p', 'pp', 'vol', 'ch', 'etc']),
}

// O `lib` do projeto é ES2020 e o tipo do Intl.Segmenter (ES2022) não vem com
// ele; o Node e o WebView2 têm a API.
interface SentenceSegmenter {
  segment(input: string): Iterable<{ segment: string }>
}
const { Segmenter } = Intl as unknown as {
  Segmenter: new (locale: string, options: { granularity: 'sentence' }) => SentenceSegmenter
}

function makeSegmenter(language: string): SentenceSegmenter {
  try {
    return new Segmenter(language || 'en', { granularity: 'sentence' })
  } catch {
    return new Segmenter('en', { granularity: 'sentence' })
  }
}

// O segmento termina numa abreviação da língua ou numa inicial maiúscula ("J.").
function endsWithAbbreviation(text: string, language: string): boolean {
  const trimmed = text.trimEnd()
  if (!trimmed.endsWith('.')) return false
  const token = (trimmed.split(/\s+/).pop() ?? '').replace(/^[«"“(]+/, '').slice(0, -1)
  if (/^\p{Lu}$/u.test(token)) return true
  return ABBREVIATIONS[baseLanguage(language)]?.has(token) ?? false
}

function hasOpenFrenchQuote(text: string): boolean {
  return (text.match(/«/g)?.length ?? 0) > (text.match(/»/g)?.length ?? 0)
}

function shouldMerge(acc: string, next: string, language: string): boolean {
  return (
    endsWithAbbreviation(acc, language) ||
    /^[\p{Ll}\d]/u.test(next.trimStart()) ||
    hasOpenFrenchQuote(acc)
  )
}

// Parte a frase longa na última `;`, `:` ou `,` antes do teto; sem elas, no
// último espaço; sem espaço (texto contínuo), no próprio teto.
function capSentence(sentence: string): string[] {
  const pieces: string[] = []
  let rest = sentence
  while (rest.length > MAX_SENTENCE_CHARS) {
    const window = rest.slice(0, MAX_SENTENCE_CHARS)
    let cut = Math.max(window.lastIndexOf(';'), window.lastIndexOf(':'), window.lastIndexOf(','))
    if (cut < 0) cut = window.lastIndexOf(' ')
    if (cut <= 0) cut = MAX_SENTENCE_CHARS - 1
    pieces.push(rest.slice(0, cut + 1))
    rest = rest.slice(cut + 1)
  }
  pieces.push(rest)
  return pieces
}

// O travessão de diálogo depois de uma frase abre outra fala: o Segmenter não
// corta ali (o travessão é "SContinue" nas regras do Unicode).
const DIALOGUE_DASH_BREAK = /(?<=[.!?…])\s+(?=[—–]\s)/

export function splitSentences(text: string, language: string): string[] {
  const segmenter = makeSegmenter(language)
  const sentences: string[] = []
  const push = (raw: string) => {
    const sentence = raw.trim()
    if (sentence) sentences.push(...capSentence(sentence).map((s) => s.trim()).filter(Boolean))
  }
  // `\n` e o travessão de diálogo são limites duros.
  for (const block of text.split('\n').flatMap((line) => line.split(DIALOGUE_DASH_BREAK))) {
    let acc = ''
    for (const { segment } of segmenter.segment(block)) {
      if (acc && !shouldMerge(acc, segment, language)) {
        push(acc)
        acc = ''
      }
      acc += segment
    }
    push(acc)
  }
  return sentences
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

// A frase do texto que contém a seleção (sem diferença de espaço nem de caixa).
// Seleção que atravessa frases, ou que não está no texto, volta como veio.
export function findContextSentence(text: string, selection: string, language: string): string {
  const wanted = normalize(selection)
  if (!wanted) return selection
  return splitSentences(text, language).find((s) => normalize(s).includes(wanted)) ?? selection
}
