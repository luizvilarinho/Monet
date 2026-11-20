import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { TextSelection } from '@tiptap/pm/state'
import { CaretRight } from '@phosphor-icons/react'
import { SEARCH_TITLE_SPEC } from './SearchHighlight'
import styles from './ToggleBlock.module.css'

export function ToggleBlockView({ node, updateAttributes, editor, getPos, decorations }: NodeViewProps) {
  const title = (node.attrs.title as string) ?? ''
  const collapsed = node.attrs.collapsed === true
  const spanRef = useRef<HTMLSpanElement>(null)
  // Ocorrência da busca na nota (Ctrl+F) no título: com mais de uma no mesmo
  // título, vale a atual.
  const titleHits = decorations.map((d) => d.spec?.[SEARCH_TITLE_SPEC] as 'match' | 'current' | undefined)
  const searchMatch = titleHits.includes('current') ? 'current' : titleHits.includes('match') ? 'match' : undefined

  useEffect(() => {
    const span = spanRef.current
    if (span && span.textContent !== title) {
      span.textContent = title
    }
  }, [title])

  // Enter no título: abre o toggle e põe o cursor no começo do corpo.
  function enterBody() {
    const pos = getPos()
    if (typeof pos !== 'number') return
    const { state, view } = editor
    const tr = state.tr
    if (collapsed) tr.setNodeMarkup(pos, undefined, { ...node.attrs, collapsed: false })
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
    view.dispatch(tr.scrollIntoView())
    view.focus()
  }

  return (
    <NodeViewWrapper className={styles.toggle}>
      <div className={styles.header} contentEditable={false} onClick={() => updateAttributes({ collapsed: !collapsed })}>
        <span
          className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        >
          <CaretRight size={12} weight="bold" />
        </span>
        <span
          ref={spanRef}
          className={[
            styles.titleInput,
            searchMatch === 'current' ? styles.titleMatchCurrent : searchMatch === 'match' ? styles.titleMatch : '',
          ].join(' ')}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => updateAttributes({ title: e.currentTarget.textContent ?? '' })}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            enterBody()
          }}
          data-placeholder="Toggle title"
        />
      </div>
      <NodeViewContent className={styles.content} style={{ display: collapsed ? 'none' : undefined }} />
    </NodeViewWrapper>
  )
}
