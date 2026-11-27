// Texto limpo das páginas de um PDF para traduzir e ouvir: linhas a partir dos
// itens do pdf.js, hífen de fim de linha desfeito, parágrafos, e cabeçalho,
// rodapé e número de página fora (só no "Listen to page"). Funções puras.
import { baseLanguage } from './language'

export interface PdfTextItem {
  str: string
  hasEOL: boolean
  // `transform[5]` do item, em unidades do PDF (origem embaixo).
  y: number
  height: number
}

export interface PdfLine {
  text: string
  y: number
  height: number
}

export interface CleanPageResult {
  text: string
  skipped: Array<'header' | 'footer' | 'page number'>
}

// Fecha a linha em `hasEOL` ou quando o `y` muda mais de meia altura de linha
// (sobrescrito e nota de chamada ficam dentro dessa folga).
export function pdfItemsToLines(items: PdfTextItem[]): PdfLine[] {
  const lines: PdfLine[] = []
  // O cast evita que o TS estreite `current` para `null`: quem o zera é o
  // fechamento, dentro de uma closure.
  let current = null as { text: string; y: number; height: number } | null

  const close = () => {
    if (!current) return
    const text = current.text.replace(/\s+/g, ' ').trim()
    if (text) lines.push({ text, y: current.y, height: current.height })
    current = null
  }

  for (const item of items) {
    if (item.str) {
      if (current && Math.abs(item.y - current.y) > 0.5 * current.height) close()
      if (!current) current = { text: item.str, y: item.y, height: item.height }
      else current.text += current.text.endsWith(' ') ? item.str : ` ${item.str}`
    }
    if (item.hasEOL) close()
  }
  close()
  return lines
}

// Partes de palavra composta: quando o pedaço que vem depois do hífen de fim de
// linha é uma delas, o hífen é real ("peut-" + "être") e fica.
const HYPHEN_KEEP: Record<string, Set<string>> = {
  fr: new Set(
    'être là ci même il ils elle elles on je tu nous vous le la les moi toi lui leur y en t-il t-elle t-on'.split(' '),
  ),
  en: new Set('based like free wide term time year old'.split(' ')),
}

// Primeira palavra do trecho que segue o hífen ("t-il" conta como uma só).
function leadingToken(text: string): string {
  return /^\p{L}+(?:-\p{L}+)?/u.exec(text)?.[0].toLowerCase() ?? ''
}

function keepsHyphen(next: string, language: string): boolean {
  return HYPHEN_KEEP[baseLanguage(language)]?.has(leadingToken(next)) ?? false
}

const PAGE_NUMBER = /^\s*[-–—]?\s*(\d{1,4}|[ivxlcdm]{1,7})\s*[-–—]?\s*$/i
const HEADER_FOOTER_MAX_CHARS = 80

// Texto de uma página. Com `skipHeaders`: cabeçalho corrido, rodapé e número de
// página saem (e voltam em `skipped`, para o aviso do player).
export function cleanPdfPage(
  lines: PdfLine[],
  pageHeight: number,
  opts: { skipHeaders: boolean; language: string },
): CleanPageResult {
  const skipped: CleanPageResult['skipped'] = []
  const dropped = new Set<PdfLine>()

  if (opts.skipHeaders) {
    const top = lines.filter((l) => l.y > 0.92 * pageHeight)
    const bottom = lines.filter((l) => l.y < 0.08 * pageHeight)
    // Linha que é só número de página, no topo ou embaixo.
    for (const line of [...top, ...bottom]) {
      if (PAGE_NUMBER.test(line.text)) {
        dropped.add(line)
        skipped.push('page number')
      }
    }
    const header = top.find((l) => !dropped.has(l) && l.text.length <= HEADER_FOOTER_MAX_CHARS)
    if (header) {
      dropped.add(header)
      skipped.push('header')
    }
    // Só a última linha da faixa de baixo é candidata a rodapé; nota de
    // rodapé que termina em pontuação de frase fica.
    const last = bottom[bottom.length - 1]
    if (
      last &&
      !dropped.has(last) &&
      last.text.length <= HEADER_FOOTER_MAX_CHARS &&
      !/[.!?…]$/.test(last.text)
    ) {
      dropped.add(last)
      skipped.push('footer')
    }
  }

  const kept = lines.filter((l) => !dropped.has(l))
  const longest = Math.max(0, ...kept.map((l) => l.text.length))
  let text = ''
  kept.forEach((line, i) => {
    if (i === 0) {
      text = line.text
      return
    }
    const prev = kept[i - 1].text
    if (/\p{L}-$/u.test(text) && /^\p{Ll}/u.test(line.text)) {
      text = (keepsHyphen(line.text, opts.language) ? text : text.slice(0, -1)) + line.text
    } else if (
      /[.!?…»"”]$/.test(prev) &&
      /^[\p{Lu}—–«]/u.test(line.text) &&
      prev.length < 0.7 * longest
    ) {
      text += `\n${line.text}`
    } else {
      text += ` ${line.text}`
    }
  })
  return { text: text.trim(), skipped }
}

// Seleção do PDF: vem com os spans juntados por espaço e quebras de linha.
// Colapsa os espaços e desfaz o hífen de fim de linha ("entrebâil- lée").
export function cleanPdfSelectionText(text: string, language: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\p{L})- (\p{Ll}\p{L}*(?:-\p{L}+)?)/gu, (_m, letter: string, rest: string) =>
      keepsHyphen(rest, language) ? `${letter}-${rest}` : `${letter}${rest}`,
    )
}

const SKIPPED_LABEL: Record<CleanPageResult['skipped'][number], string> = {
  header: 'page header',
  footer: 'page footer',
  'page number': 'page number',
}

// Aviso de 5 s do "Listen to page": "Not read: page header and page number". Sem
// nada cortado, null.
export function skippedNotice(skipped: CleanPageResult['skipped']): string | null {
  const labels = [...new Set(skipped)].map((kind) => SKIPPED_LABEL[kind])
  if (labels.length === 0) return null
  const list =
    labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
  return `Not read: ${list}`
}
