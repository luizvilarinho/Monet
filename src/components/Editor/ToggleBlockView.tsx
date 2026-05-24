import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import styles from './ToggleBlock.module.css'

export function ToggleBlockView({ node, updateAttributes }: NodeViewProps) {
  const title = (node.attrs.title as string) ?? ''
  const collapsed = node.attrs.collapsed === true
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const span = spanRef.current
    if (span && span.textContent !== title) {
      span.textContent = title
    }
  }, [title])

  return (
    <NodeViewWrapper className={styles.toggle}>
      <div className={styles.header} contentEditable={false} onClick={() => updateAttributes({ collapsed: !collapsed })}>
        <span
          className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        >
          ›
        </span>
        <span
          ref={spanRef}
          className={styles.titleInput}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => updateAttributes({ title: e.currentTarget.textContent ?? '' })}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
          data-placeholder="Toggle title"
        />
      </div>
      <NodeViewContent className={styles.content} style={{ display: collapsed ? 'none' : undefined }} />
    </NodeViewWrapper>
  )
}
