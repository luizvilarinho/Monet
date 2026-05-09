export interface Heading {
  level: number
  text: string
  line: number
  offset: number
}

const ATX_HEADING_RE = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/

export function parseHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  let offset = 0
  let lineNumber = 1
  let fenceChar: '`' | '~' | null = null
  let fenceLen = 0

  let i = 0
  while (i < content.length) {
    const nl = content.indexOf('\n', i)
    const line = nl === -1 ? content.slice(i) : content.slice(i, nl)

    const fenceMatch = line.match(FENCE_RE)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      const ch = marker[0] as '`' | '~'
      if (fenceChar === null) {
        fenceChar = ch
        fenceLen = marker.length
      } else if (ch === fenceChar && marker.length >= fenceLen) {
        fenceChar = null
        fenceLen = 0
      }
    } else if (fenceChar === null) {
      const match = line.match(ATX_HEADING_RE)
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].trim(),
          line: lineNumber,
          offset,
        })
      }
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
