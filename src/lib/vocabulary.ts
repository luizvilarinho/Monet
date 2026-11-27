// Vocabulário de um livro (aba Vocabulary), sem React e sem UI: duplicata, item
// novo, âncora, bloco que vai à nota, rótulo do botão de envio e fonte do
// "Listen to list". Os leitores só informam o texto, a frase e o lugar.
import type { ListenSource } from '../hooks/useListenPlayer'
import type {
  Book,
  BookHighlightRect,
  VocabularyAnchor,
  VocabularyItem,
  VocabularyKind,
} from '../types'
import { baseLanguage } from './language'
import { splitSentences } from './sentences'
import type { Translation } from './translate'

// ─── Termo e duplicata ───────────────────────────────────────────────────

// Forma de comparação: NFC, minúsculas, espaços colapsados e aspas tipográficas
// (inclusive « ») como as retas.
export function normalizeTerm(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟«»]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// O mesmo texto na mesma frase do mesmo livro é o mesmo item; a mesma palavra
// em outra frase é um item novo.
export function vocabularyDedupKey(bookId: string, text: string, sentence: string): string {
  return `${bookId}\0${normalizeTerm(text)}\0${normalizeTerm(sentence)}`
}

export function findDuplicate(
  items: VocabularyItem[],
  candidate: Pick<VocabularyItem, 'bookId' | 'text' | 'sentence'>,
): VocabularyItem | null {
  const key = vocabularyDedupKey(candidate.bookId, candidate.text, candidate.sentence)
  return items.find((i) => vocabularyDedupKey(i.bookId, i.text, i.sentence) === key) ?? null
}

// ─── Item novo e âncora ──────────────────────────────────────────────────

// O que o leitor sabe da seleção; o resto (id, data, língua) o item ganha aqui.
export interface VocabularyDraft {
  text: string
  sentence: string
  kind: VocabularyKind
  sense: string | null
  baseForm: string | null
  page: number
  positionLabel: string
  anchor: VocabularyAnchor
}

export function buildVocabularyItem(input: VocabularyDraft & { book: Book }): VocabularyItem {
  const text = input.text.replace(/\s+/g, ' ').trim()
  return {
    id: crypto.randomUUID(),
    bookId: input.book.id,
    text,
    kind: input.kind,
    // Uma frase guardada é a própria frase de origem.
    sentence: input.kind === 'sentence' ? text : input.sentence.replace(/\s+/g, ' ').trim(),
    sense: input.sense?.trim() || null,
    baseForm: input.baseForm?.trim() || null,
    language: baseLanguage(input.book.language),
    page: input.page,
    positionLabel: input.positionLabel,
    anchor: input.anchor,
    createdAt: new Date().toISOString(),
    sentAt: null,
    sentNotebookId: null,
    sentNoteId: null,
  }
}

// O que o Translate sabia do termo, para o item: o sentido nesta frase (ou a
// tradução da frase) e a forma base. Sem tradução, nada.
export function translationFields(translation: Translation | null): {
  sense: string | null
  baseForm: string | null
} {
  if (!translation) return { sense: null, baseForm: null }
  if (translation.kind === 'word') return { sense: translation.sense, baseForm: translation.baseForm }
  return { sense: translation.translation, baseForm: null }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRect(value: unknown): value is BookHighlightRect {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return isFiniteNumber(r.x) && isFiniteNumber(r.y) && isFiniteNumber(r.w) && isFiniteNumber(r.h)
}

// Lê o `anchor_json` do banco. null quando não é uma âncora válida: o item sem
// lugar no livro é ignorado por quem lê.
export function parseVocabularyAnchor(raw: string): VocabularyAnchor | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const a = parsed as Record<string, unknown>
    if (a.format === 'epub') {
      return typeof a.cfiRange === 'string' && a.cfiRange ? { format: 'epub', cfiRange: a.cfiRange } : null
    }
    if (a.format === 'pdf' && isFiniteNumber(a.page) && isFiniteNumber(a.start) && isFiniteNumber(a.end)) {
      return {
        format: 'pdf',
        page: a.page,
        start: a.start,
        end: a.end,
        rects: Array.isArray(a.rects) ? a.rects.filter(isRect) : [],
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── Lista, seleção e envio ──────────────────────────────────────────────

export function splitBySent(items: VocabularyItem[]): { fresh: VocabularyItem[]; sent: VocabularyItem[] } {
  return {
    fresh: items.filter((i) => !i.sentAt),
    sent: items.filter((i) => i.sentAt),
  }
}

// Os marcados, na ordem da lista; sem nenhum marcado, os novos (ainda não enviados).
export function itemsToSend(items: VocabularyItem[], selectedIds: ReadonlySet<string>): VocabularyItem[] {
  const selected = items.filter((i) => selectedIds.has(i.id))
  return selected.length > 0 ? selected : items.filter((i) => !i.sentAt)
}

// O que o "Listen to list" lê: o que seria enviado e, com tudo já enviado, a lista inteira.
export function itemsToListen(items: VocabularyItem[], selectedIds: ReadonlySet<string>): VocabularyItem[] {
  const picked = itemsToSend(items, selectedIds)
  return picked.length > 0 ? picked : items
}

// "Send 6 new to notebook", "Send 2 selected", "Send 1 selected again" (todos os
// marcados já foram enviados) e "Send 3 selected (1 again)" (mistura).
export function sendButtonLabel(newCount: number, selectedItems: VocabularyItem[]): string {
  if (selectedItems.length === 0) {
    return newCount > 0 ? `Send ${newCount} new to notebook` : 'Nothing new to send'
  }
  const again = selectedItems.filter((i) => i.sentAt).length
  if (again === 0) return `Send ${selectedItems.length} selected`
  if (again === selectedItems.length) return `Send ${selectedItems.length} selected again`
  return `Send ${selectedItems.length} selected (${again} again)`
}

export interface SentMark {
  at: string
  notebookId: string
  noteId: string
}

// A marca de enviado que o item tem agora, ou null se nunca foi enviado.
export function sentMarkOf(item: VocabularyItem): SentMark | null {
  if (!item.sentAt || !item.sentNotebookId || !item.sentNoteId) return null
  return { at: item.sentAt, notebookId: item.sentNotebookId, noteId: item.sentNoteId }
}

// Agrupa os itens pela marca de enviado que têm: o Undo de um envio devolve a
// cada grupo a marca de antes (null = ainda não enviado), o que cobre o reenvio.
export function groupBySentMark(items: VocabularyItem[]): Array<{ ids: string[]; sent: SentMark | null }> {
  const groups = new Map<string, { ids: string[]; sent: SentMark | null }>()
  for (const item of items) {
    const sent = sentMarkOf(item)
    const key = sent ? `${sent.at}\0${sent.notebookId}\0${sent.noteId}` : ''
    const group = groups.get(key)
    if (group) group.ids.push(item.id)
    else groups.set(key, { ids: [item.id], sent })
  }
  return [...groups.values()]
}

// ─── Bloco que vai à nota ────────────────────────────────────────────────

const QUOTE_LIMIT = 2000
const TRANSLATION_TOGGLE =
  '<div data-type="toggle-block" data-title="Translation" data-collapsed="true">'

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function itemBlock(item: VocabularyItem, bookTitle: string, withTranslation: boolean): string {
  const lines: string[] = []
  if (item.kind !== 'sentence') {
    const base =
      item.baseForm && normalizeTerm(item.baseForm) !== normalizeTerm(item.text)
        ? ` (${oneLine(item.baseForm)})`
        : ''
    lines.push(`**${oneLine(item.text)}**${base}`, '')
  }
  const quote = oneLine(item.kind === 'sentence' ? item.text : item.sentence)
  const cut = quote.length > QUOTE_LIMIT ? `${quote.slice(0, QUOTE_LIMIT).trimEnd()}…` : quote
  lines.push(`> ${cut}`, '', `— *${bookTitle}*, ${item.positionLabel}`)
  if (withTranslation && item.sense) {
    // O toggle como o ToggleBlock.ts o serializa: a tag sozinha na linha, o
    // conteúdo entre linhas em branco e o fechamento.
    lines.push('', TRANSLATION_TOGGLE, '', oneLine(item.sense), '', '</div>')
  }
  return lines.join('\n')
}

// Um bloco único para o envio inteiro (é o que o Undo tira da nota): título do
// livro e data (um cabeçalho de nível 3: o editor só tem H1 a H3 e regrava o H4
// como parágrafo, o que mudaria o bloco depois de a nota ser aberta e o Undo não
// o acharia mais), e por item o termo em negrito (com a forma base entre parênteses
// quando difere), a frase como citação, a linha "— *Livro*, p. 42" e, só nos
// itens com sentido, a tradução num toggle recolhido. Frase guardada vai só como
// citação.
export function buildVocabularyNoteBlock(
  items: VocabularyItem[],
  bookTitle: string,
  withTranslation: boolean,
  dateLabel: string,
): string {
  return [
    `### From *${bookTitle}* · ${dateLabel}`,
    ...items.map((item) => itemBlock(item, bookTitle, withTranslation)),
  ].join('\n\n')
}

// ─── Tela ────────────────────────────────────────────────────────────────

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u

// O trecho [start, end) é uma palavra (ou expressão) inteira na frase: nenhuma
// letra, marca ou dígito encosta nas pontas ("malle" não é a de "mallette").
function isWholeWord(sentence: string, start: number, end: number): boolean {
  const before = start > 0 ? sentence[start - 1] : ''
  const after = end < sentence.length ? sentence[end] : ''
  return !(before && WORD_CHAR.test(before)) && !(after && WORD_CHAR.test(after))
}

// A frase de origem partida em volta do termo (sem diferença de caixa), para o
// termo ir em negrito: a primeira ocorrência como palavra inteira, ou, só se não há
// nenhuma, a primeira como pedaço. null quando o termo não está na frase.
export function splitAtTerm(
  sentence: string,
  term: string,
): { before: string; match: string; after: string } | null {
  const needle = term.trim()
  if (!needle) return null
  const hay = sentence.toLowerCase()
  const wanted = needle.toLowerCase()
  const first = hay.indexOf(wanted)
  if (first < 0) return null
  let at = first
  for (let from = first; from >= 0; from = hay.indexOf(wanted, from + 1)) {
    if (isWholeWord(sentence, from, from + wanted.length)) {
      at = from
      break
    }
  }
  return {
    before: sentence.slice(0, at),
    match: sentence.slice(at, at + needle.length),
    after: sentence.slice(at + needle.length),
  }
}

// Data curta no locale do usuário; vazio se a data não lê.
export function formatVocabularyDate(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return date.toLocaleDateString(locale)
  } catch {
    return date.toLocaleDateString()
  }
}

// "Nov 27", o rótulo de data do cabeçalho do bloco na nota.
export function noteDateLabel(now: Date, locale: string): string {
  try {
    return now.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  } catch {
    return now.toLocaleDateString()
  }
}

// ─── Listen to list ──────────────────────────────────────────────────────

// A frase de origem de cada item, na ordem da lista (as acima de 400 caracteres
// saem partidas). Sem faixa cinza na página e sem pausa por troca de página:
// `page` é null. Sem nada para ler, null.
export function buildListenSource(items: VocabularyItem[], language: string): ListenSource | null {
  const sentences = items.flatMap((item) => splitSentences(item.sentence, language))
  if (sentences.length === 0) return null
  return {
    id: crypto.randomUUID(),
    kind: 'list',
    originLabel: `Vocabulary · ${items.length} ${items.length === 1 ? 'item' : 'items'}`,
    endLabel: 'End of the list',
    sentences,
    chars: sentences.reduce((total, sentence) => total + sentence.length, 0),
    page: null,
    backLabel: null,
    notice: null,
  }
}
