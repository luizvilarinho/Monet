import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import styles from './ToggleBlock.module.css'

export function ToggleBlockView({ node, updateAttributes }: NodeViewProps) {
  const title = (node.attrs.title as string) ?? ''
  const collapsed = node.attrs.collapsed === true

  return (
    <NodeViewWrapper className={styles.toggle}>
      <div className={styles.header} contentEditable={false}>
        <span
          className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`}
          aria-hidden="true"
          onClick={() => updateAttributes({ collapsed: !collapsed })}
        >
          ›
        </span>
        <input
          className={styles.titleInput}
          value={title}
          placeholder="Toggle title"
          onChange={(e) => updateAttributes({ title: e.target.value })}
        />
      </div>
      <NodeViewContent className={styles.content} style={{ display: collapsed ? 'none' : undefined }} />
    </NodeViewWrapper>
  )
}
