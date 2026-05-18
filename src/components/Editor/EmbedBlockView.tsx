import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useMemo, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import { useEditorResponses } from './EditorResponsesContext'
import { getToggleTitle } from './commandParser'
import styles from './EmbedBlockView.module.css'

export function EmbedBlockView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const commandId = (node.attrs.commandId as string | null) ?? null
  const collapsed = node.attrs.collapsed !== false
  const responses = useEditorResponses()

  const response = useMemo(
    () => (commandId ? responses.find((r) => r.id === commandId) : undefined),
    [responses, commandId]
  )

  const title = response ? getToggleTitle(response.command) : 'Resposta gerada pela IA'
  const body = response?.response ?? ''

  const [renderedHtml, setRenderedHtml] = useState('')

  useEffect(() => {
    if (collapsed) return
    if (!body) {
      setRenderedHtml('')
      return
    }
    let cancelled = false
    renderMarkdown(body).then((html) => {
      if (!cancelled) setRenderedHtml(html)
    })
    return () => {
      cancelled = true
    }
  }, [body, collapsed])

  const toggle = () => {
    if (!editor.isEditable) return
    updateAttributes({ collapsed: !collapsed })
  }

  return (
    <NodeViewWrapper
      className={`${styles.embed} ${selected ? styles.selected : ''}`}
      data-monet-embed
      contentEditable={false}
    >
      <button
        type="button"
        className={styles.header}
        onClick={toggle}
        aria-expanded={!collapsed}
      >
        <span className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`} aria-hidden="true">
          ›
        </span>
        <span className={styles.title}>{title}</span>
      </button>
      {!collapsed && (
        body ? (
          <div
            className={styles.body}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <div className={styles.empty}>Response not available.</div>
        )
      )}
    </NodeViewWrapper>
  )
}
