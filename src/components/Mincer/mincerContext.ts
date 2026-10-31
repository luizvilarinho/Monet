import { KIND_LABELS, isTranscriptKind, type MincerItem } from '../../lib/mincer'

// ─── Builder do bloco de contexto do Mincer ─────────────────────────────────
// Função pura (sem I/O): monta o bloco EFÊMERO anexado a cada envio do chat de
// uma pasta do Mincer. Os orçamentos limitam o custo de cada mensagem.

const SUMMARY_BUDGET = 12000
const TRANSCRIPT_BUDGET = 60000

function formatDate(ms: number): string {
  try {
    return new Date(ms).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

// Aviso visível ao usuário no Chat quando a transcrição/o texto passa do orçamento.
export function mincerTruncationNotice(item: MincerItem): string | null {
  const total = item.transcript?.trim().length ?? 0
  if (total <= TRANSCRIPT_BUDGET) return null
  const label = isTranscriptKind(item.kind, item.source) ? 'transcript' : 'text'
  const percent = Math.floor((TRANSCRIPT_BUDGET / total) * 100)
  return `This ${label} is long: the AI only sees its first ${percent}% (${TRANSCRIPT_BUDGET.toLocaleString()} of ${total.toLocaleString()} characters). Answers about later parts may be incomplete.`
}

// summaryInHistory: o resumo já está numa mensagem da conversa e não é repetido.
export function buildMincerContext(item: MincerItem, summaryInHistory = false): string {
  const lines: string[] = []
  lines.push(
    '[Mincer context — automatically attached; the content this conversation is about. Not visible to the user.]'
  )
  lines.push(`Title: "${item.title}"`)
  lines.push(`Type: ${KIND_LABELS[item.kind] ?? item.kind}`)
  if (item.source) lines.push(`Source: ${item.source}`)
  lines.push(`Processed: ${formatDate(item.createdAt)}`)

  const summary = item.summary?.trim() ?? ''
  if (summary && summaryInHistory) {
    lines.push('')
    lines.push('Summary: the first assistant message of this conversation.')
  } else if (summary) {
    lines.push('')
    lines.push('Summary:')
    lines.push(
      summary.length > SUMMARY_BUDGET ? summary.slice(0, SUMMARY_BUDGET) + ' [truncated]' : summary
    )
  }

  const transcript = item.transcript?.trim() ?? ''
  if (transcript) {
    const label = isTranscriptKind(item.kind, item.source) ? 'Transcript' : 'Text'
    lines.push('')
    lines.push(`${label} (${transcript.length} characters):`)
    if (transcript.length > TRANSCRIPT_BUDGET) {
      lines.push(transcript.slice(0, TRANSCRIPT_BUDGET))
      lines.push(
        `[truncated — only the first ${TRANSCRIPT_BUDGET} of ${transcript.length} characters are included; say so if the answer may be in the missing part]`
      )
    } else {
      lines.push(transcript)
    }
  }

  return lines.join('\n')
}
