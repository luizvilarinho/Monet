// Recontar ("Retell"): o botão da aba Vocabulary acrescenta à nota do livro um bloco
// com as palavras guardadas e o espaço para o usuário escrever; o "Ask for
// feedback" da aba Notes lê o que ele escreveu. Funções puras: o texto do bloco, o
// rótulo do trecho e a extração do último reconto.
import type { VocabularyItem } from '../types'
import { itemsToSend, normalizeTerm } from './vocabulary'

// O que se usa no reconto: os itens marcados ou, sem marca, os novos; só palavra e
// expressão (uma frase guardada não é para "usar").
export function retellItems(items: VocabularyItem[], selectedIds: ReadonlySet<string>): VocabularyItem[] {
  return itemsToSend(items, selectedIds).filter((item) => item.kind !== 'sentence')
}

// Os textos desses itens, sem repetir a forma (a mesma palavra guardada em duas
// frases entra uma vez).
export function retellWords(items: VocabularyItem[], selectedIds: ReadonlySet<string>): string[] {
  const seen = new Set<string>()
  const words: string[] = []
  for (const item of retellItems(items, selectedIds)) {
    const word = item.text.replace(/\s+/g, ' ').trim()
    const key = normalizeTerm(word)
    if (!word || seen.has(key)) continue
    seen.add(key)
    words.push(word)
  }
  return words
}

// "p. 42" ou "p. 42–43" no PDF, pela menor e a maior página dos itens; no EPUB, o
// capítulo do primeiro item, sem o percentual ("Chapter 3, 41%" dá "Chapter 3"; um
// rótulo que é só o percentual fica como está).
export function retellRangeLabel(items: VocabularyItem[], format: 'pdf' | 'epub'): string {
  if (items.length === 0) return ''
  if (format === 'pdf') {
    const pages = items.map((item) => item.page)
    const first = Math.min(...pages)
    const last = Math.max(...pages)
    return first === last ? `p. ${first}` : `p. ${first}–${last}`
  }
  const label = items[0].positionLabel.trim()
  return label.replace(/,?\s*\d+%$/, '').trim() || label
}

// O bloco que vai à nota: o cabeçalho (nível 3, o editor só tem H1 a H3), a linha
// das palavras e nada mais: o usuário escreve embaixo (o editor deixa um parágrafo
// vazio no fim da nota).
export function buildRetellBlock(words: string[], rangeLabel: string, dateLabel: string): string {
  return [`### Retell · ${rangeLabel} · ${dateLabel}`, `Words: ${words.join(' · ')}`].join('\n\n')
}

const RETELL_HEADER_RE = /^###\s+Retell\s+·/i
const ANY_HEADER_RE = /^#{1,6}\s/
const WORDS_LINE_RE = /^\s*(\*\*)?Words(\*\*)?\s*:/i

// A nota tem algum bloco de reconto: é o que mostra o "Ask for feedback" na aba Notes.
export function hasRetell(content: string): boolean {
  return content.split('\n').some((line) => RETELL_HEADER_RE.test(line.trim()))
}

// O texto escrito depois do ÚLTIMO cabeçalho "### Retell ·", sem a linha "Words:", até
// o próximo cabeçalho do markdown ou o fim da nota. null quando não há cabeçalho ou
// o usuário ainda não escreveu nada.
export function extractLastRetell(content: string): string | null {
  const lines = content.split('\n')
  let start = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (RETELL_HEADER_RE.test(lines[i].trim())) {
      start = i
      break
    }
  }
  if (start < 0) return null
  const written: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (ANY_HEADER_RE.test(line.trim())) break
    if (WORDS_LINE_RE.test(line)) continue
    written.push(line)
  }
  const text = written.join('\n').trim()
  return text ? text : null
}

const FEEDBACK_BUDGET = 1500

// A mensagem que o "Ask for feedback" manda ao chat: o reconto como citação (cada
// linha com "> ", cortado em 1.500 caracteres) e o pedido, que é comentar e não
// reescrever.
export function buildFeedbackMessage(retelling: string): string {
  const text = retelling.trim()
  const cut = text.length > FEEDBACK_BUDGET ? `${text.slice(0, FEEDBACK_BUDGET).trimEnd()}…` : text
  const quoted = cut
    .split('\n')
    .map((line) => `> ${line}`.trimEnd())
    .join('\n')
  return `${quoted}\n\nComment on my retelling. Don't rewrite it.`
}
