import { useEffect, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import styles from './MarkdownPreview.module.css'
import editorStyles from './Editor.module.css'

const EMBED_START_RE = /<!--monet-embed:([a-zA-Z0-9_-]+)-->/g

interface EmbedBlock {
  start: number
  end: number
  title: string
  body: string
}

function extractEmbeds(text: string): EmbedBlock[] {
  const embeds: EmbedBlock[] = []
  const startRe = new RegExp(EMBED_START_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = startRe.exec(text)) !== null) {
    const cmdId = m[1]
    const endMarker = `<!--monet-embed-end:${cmdId}-->`
    const endIdx = text.indexOf(endMarker, m.index + m[0].length)
    if (endIdx === -1) continue
    const blockText = text.slice(m.index + m[0].length, endIdx)
    const lines = blockText.split('\n').map((l) => l.replace(/^> /, ''))
    const bodyText = lines.join('\n').trim()
    const titleMatch = bodyText.match(/^\*\*([^*]+)\*\*/)
    const title = titleMatch ? titleMatch[1] : 'Resposta gerada pela IA'
    const body = bodyText.replace(/^\*\*[^*]+\*\*\n\n?/, '')
    embeds.push({ start: m.index, end: endIdx + endMarker.length, title, body })
  }
  embeds.sort((a, b) => a.start - b.start)
  return embeds
}

async function renderWithEmbeds(content: string): Promise<string> {
  // Remove command lines
  const filtered = content
    .split('\n')
    .filter((line) => !/^\/[a-zA-Z]/.test(line.trim()))
    .join('\n')

  const embeds = extractEmbeds(filtered)

  if (embeds.length === 0) {
    return renderMarkdown(filtered)
  }

  let lastEnd = 0
  const parts: string[] = []
  for (const embed of embeds) {
    const before = filtered.slice(lastEnd, embed.start)
    if (before.trim()) {
      parts.push(await renderMarkdown(before))
    }
    const bodyHtml = await renderMarkdown(embed.body)
    parts.push(
      `<details open style="margin:0.8em 0;background:var(--surface-1,#1e1e22);border:1px solid var(--border,#333340);border-radius:6px;">
        <summary style="padding:6px 10px;cursor:pointer;font-size:13px;color:var(--text-secondary,#a0a0b8);user-select:none;font-weight:500;">${embed.title}</summary>
        <div style="padding:0 10px 10px 28px;">${bodyHtml}</div>
      </details>`
    )
    lastEnd = embed.end
  }
  const after = filtered.slice(lastEnd)
  if (after.trim()) {
    parts.push(await renderMarkdown(after))
  }
  return parts.join('\n')
}

interface Props {
  title: string
  tags: string[]
  content: string
}

export function MarkdownPreview({ title, tags, content }: Props) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false
    renderWithEmbeds(content).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => { cancelled = true }
  }, [content])

  return (
    <div className={styles.preview}>
      {title && <h1 className={editorStyles.title}>{title}</h1>}
      {tags.length > 0 && (
        <div className={editorStyles.tagsRow}>
          {tags.map((t) => (
            <span key={t} className={editorStyles.tag}>#{t}</span>
          ))}
        </div>
      )}
      <div
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
