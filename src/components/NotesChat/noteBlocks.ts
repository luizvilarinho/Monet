// ─── Blocos cercados das respostas do chat das Anotações ────────────────────
// Função pura: divide a resposta da IA em trechos de texto e blocos cercados
// (```note … ``` vira cartão inserível; qualquer outra linguagem vira bloco de
// código com os mesmos botões). Segue as regras de fence do CommonMark
// (até 3 espaços de recuo, ``` ou ~~~, fechamento com o mesmo caractere e
// comprimento >= ao da abertura, sem info string). Dentro de um bloco `note`,
// uma fence do mesmo caractere COM linguagem abre um bloco aninhado (a IA
// costuma aninhar ```js dentro de ```note); a próxima fence sem linguagem
// fecha o aninhado, não o `note`. Um bloco ainda aberto (streaming) consome o
// resto da resposta com `closed: false`.

export type ChatSegment =
  | { kind: 'text'; markdown: string }
  | { kind: 'note'; body: string; closed: boolean }
  | { kind: 'code'; language: string; body: string; closed: boolean }

const FENCE_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/

export function splitMessageBlocks(content: string): ChatSegment[] {
  const lines = content.split('\n')
  const segments: ChatSegment[] = []
  let text: string[] = []

  const flushText = () => {
    const markdown = text.join('\n')
    if (markdown.trim()) segments.push({ kind: 'text', markdown })
    text = []
  }

  let i = 0
  while (i < lines.length) {
    const open = FENCE_RE.exec(lines[i])
    // Info string de fence com crases não pode conter crase (CommonMark).
    if (!open || (open[2][0] === '`' && open[3].includes('`'))) {
      text.push(lines[i])
      i++
      continue
    }
    flushText()
    const indent = open[1].length
    const fence = open[2]
    const language = open[3].trim().split(/\s+/)[0] ?? ''
    const isNote = language.toLowerCase() === 'note'
    const nested: number[] = []
    const body: string[] = []
    let closed = false
    let j = i + 1
    for (; j < lines.length; j++) {
      const m = FENCE_RE.exec(lines[j])
      if (m && m[2][0] === fence[0]) {
        const bare = m[3].trim() === ''
        if (!bare && isNote && !(fence[0] === '`' && m[3].includes('`'))) {
          nested.push(m[2].length)
        } else if (bare && nested.length > 0) {
          if (m[2].length >= nested[nested.length - 1]) nested.pop()
        } else if (bare && m[2].length >= fence.length) {
          closed = true
          break
        }
      }
      // Remove até `indent` espaços, como o CommonMark faz no conteúdo.
      body.push(lines[j].replace(new RegExp(`^ {0,${indent}}`), ''))
    }
    const bodyText = body.join('\n')
    segments.push(
      isNote
        ? { kind: 'note', body: bodyText, closed }
        : { kind: 'code', language, body: bodyText, closed }
    )
    i = j + 1
  }
  flushText()
  return segments
}

// Fence de bloco de código segura para o conteúdo: mais longa que qualquer
// sequência de crases do corpo. Linguagem com crase (possível vinda de ~~~) é
// descartada, porque é inválida em fence de crases.
export function codeFence(body: string, language: string): string {
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((s) => s.length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  const info = language.includes('`') ? '' : language
  return `${fence}${info}\n${body}\n${fence}`
}

// Markdown da resposta inteira para inserir na nota: o bloco `note` entra
// pelo conteúdo (sem a fence) e o código volta como fence.
export function messageToMarkdown(segments: ChatSegment[]): string {
  return segments
    .map((s) =>
      s.kind === 'text' ? s.markdown : s.kind === 'note' ? s.body : codeFence(s.body, s.language)
    )
    .map((md) => md.replace(/^\n+|\n+$/g, ''))
    .filter((md) => md.trim())
    .join('\n\n')
}

// O que o chat manda inserir na nota: markdown (resposta ou bloco `note`),
// bloco de código, ou uma seleção da resposta (HTML renderizado, com o texto
// simples como fallback).
export type NoteInsert =
  | { markdown: string }
  | { code: string; language: string }
  | { html: string; text: string }
