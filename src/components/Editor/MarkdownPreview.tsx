import { useEffect, useState, type ReactNode } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import styles from './MarkdownPreview.module.css'
import editorStyles from './Editor.module.css'

const EMBED_START_RE = /<!--monet-embed:([a-zA-Z0-9_-]+)-->/g
const DETAILS_RE = /<details(?:\s[^>]*)?>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g

interface ToggleBlock {
  start: number
  end: number
  title: string
  body: string
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractToggleBlocks(text: string): ToggleBlock[] {
  const blocks: ToggleBlock[] = []

  const embedRe = new RegExp(EMBED_START_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = embedRe.exec(text)) !== null) {
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
    blocks.push({ start: m.index, end: endIdx + endMarker.length, title, body })
  }

  const detailsRe = new RegExp(DETAILS_RE.source, 'g')
  let d: RegExpExecArray | null
  while ((d = detailsRe.exec(text)) !== null) {
    const title = d[1].trim()
    const body = d[2].trim()
    blocks.push({
      start: d.index,
      end: d.index + d[0].length,
      title,
      body,
    })
  }

  blocks.sort((a, b) => a.start - b.start)
  return blocks
}

async function renderWithEmbeds(content: string): Promise<string> {
  const filtered = content
    .split('\n')
    .filter((line) => !/^\/[a-zA-Z]/.test(line.trim()))
    .join('\n')

  const blocks = extractToggleBlocks(filtered)

  if (blocks.length === 0) {
    return renderMarkdown(filtered)
  }

  let lastEnd = 0
  const parts: string[] = []
  for (const block of blocks) {
    const before = filtered.slice(lastEnd, block.start)
    if (before.trim()) {
      parts.push(await renderMarkdown(before))
    }
    const bodyHtml = await renderMarkdown(block.body)
    parts.push(
      `<details open style="margin:0.8em 0;background:var(--surface-1,#1e1e22);border:1px solid var(--border,#333340);border-radius:6px;">
        <summary style="padding:6px 10px;cursor:pointer;font-size:13px;color:var(--text-secondary,#a0a0b8);user-select:none;font-weight:500;">${escapeHtml(block.title)}</summary>
        <div style="padding:0 10px 10px 28px;">${bodyHtml}</div>
      </details>`
    )
    lastEnd = block.end
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
  relatedContent?: ReactNode
}

export function MarkdownPreview({ title, tags, content, relatedContent }: Props) {
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
      {relatedContent}
    </div>
  )
}
