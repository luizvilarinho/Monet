export interface Heading {
  level: number
  text: string
  line: number
  offset: number
}

const ATX_HEADING_RE = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/

export function parseHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  let offset = 0
  let lineNumber = 1

  let i = 0
  while (i < content.length) {
    const nl = content.indexOf('\n', i)
    const line = nl === -1 ? content.slice(i) : content.slice(i, nl)
    const match = line.match(ATX_HEADING_RE)
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: lineNumber,
        offset,
      })
    }
    if (nl === -1) break
    i = nl + 1
    offset = i
    lineNumber++
  }

  return headings
}

export function findClosestHeading(
  headings: Heading[],
  offset: number
): Heading | null {
  let closest: Heading | null = null
  for (const h of headings) {
    if (h.offset <= offset) {
      closest = h
    } else {
      break
    }
  }
  return closest
}

export function findHeadingByOffset(
  headings: Heading[],
  offset: number
): Heading | null {
  return headings.find((h) => h.offset === offset) ?? null
}

export function truncateHeading(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}
