import { useEffect, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import styles from './MarkdownPreview.module.css'
import editorStyles from './Editor.module.css'

interface Props {
  title: string
  tags: string[]
  content: string
}

export function MarkdownPreview({ title, tags, content }: Props) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false
    const filtered = content
      .split('\n')
      .filter((line) => !/^\/[a-zA-Z]/.test(line.trim()))
      .join('\n')
    renderMarkdown(filtered).then((result) => {
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
