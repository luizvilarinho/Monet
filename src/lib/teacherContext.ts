// O professor de língua do chat do leitor: um bloco a mais no contexto efêmero de
// cada mensagem (não é um agente). Função pura: quem monta sabe a língua do livro,
// a nativa, o nível lido da nota de perfil e o vocabulário guardado na página.
import { languageName } from './language'
import { normalizeTerm } from './vocabulary'

// O contexto não cresce sem limite numa página cheia de itens guardados.
const MAX_SAVED_WORDS = 20
const SENSE_BUDGET = 60

export interface TeacherInput {
  // Código base da língua do livro e da língua do usuário ("fr", "pt").
  bookLanguage: string
  nativeLanguage: string
  // O nível lido da nota de perfil nesta língua ("B1"); null sem nota ou sem a linha.
  level: string | null
  // As linhas "Explain" e "Don't" da nota de perfil.
  explain: string | null
  avoid: string | null
  // O vocabulário deste livro guardado na página que está na tela.
  savedOnPage: Array<{ text: string; sense: string | null }>
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// As palavras que vão ao bloco: sem repetir a mesma palavra guardada em duas
// frases, e até o teto.
function distinctSavedWords(saved: TeacherInput['savedOnPage']): string[] {
  const seen = new Set<string>()
  const words: string[] = []
  for (const { text, sense } of saved) {
    const word = oneLine(text)
    const key = normalizeTerm(word)
    if (!word || seen.has(key)) continue
    seen.add(key)
    const meaning = sense ? oneLine(sense) : ''
    words.push(meaning ? `${word} (${meaning.slice(0, SENSE_BUDGET)})` : word)
    if (words.length === MAX_SAVED_WORDS) break
  }
  return words
}

// Quantas palavras o bloco leva: é o número do chip, para ele e a prévia contarem
// a mesma coisa.
export function savedWordsCount(saved: TeacherInput['savedOnPage']): number {
  return distinctSavedWords(saved).length
}

function savedWordsLine(saved: TeacherInput['savedOnPage']): string | null {
  const words = distinctSavedWords(saved)
  return words.length > 0 ? `- Words the reader saved on this page: ${words.join('; ')}.` : null
}

// O bloco que o `buildReaderContext` acrescenta ao fim do contexto quando o
// interruptor "Language teacher" está ligado.
export function buildTeacherBlock(input: TeacherInput): string {
  const book = languageName(input.bookLanguage)
  const native = languageName(input.nativeLanguage)
  const level = input.level ? ` Level in ${book}: ${oneLine(input.level)}.` : ''
  const lines = [
    'Language teacher (on)',
    `- Book language: ${book}. Reader's language: ${native}.${level}`,
    `- Answer in ${native}. Quote examples in ${book} from the page.`,
    `- When the reader writes in ${book}, comment on what to fix and why. Don't rewrite the whole text.`,
  ]
  if (input.explain) lines.push(`- Explain: ${oneLine(input.explain)}`)
  if (input.avoid) lines.push(`- Avoid: ${oneLine(input.avoid)}`)
  const saved = savedWordsLine(input.savedOnPage)
  if (saved) lines.push(saved)
  return lines.join('\n')
}

// O que a linha "AI sees" acrescenta com o professor ligado: "French teacher (B1) ·
// 5 saved"; sem nível, "French teacher · 5 saved"; sem itens, sem o "· N saved".
export function teacherChipLabel(bookLanguage: string, level: string | null, savedCount: number): string {
  const label = `${languageName(bookLanguage)} teacher${level ? ` (${oneLine(level)})` : ''}`
  return savedCount > 0 ? `${label} · ${savedCount} saved` : label
}
