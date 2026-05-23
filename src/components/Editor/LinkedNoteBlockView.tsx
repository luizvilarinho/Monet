import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { ArrowSquareOut, LinkBreak } from '@phosphor-icons/react'
import { renderMarkdown } from '../../lib/markdown'
import { storage } from '../../storage'
import type { Note } from '../../types'
import { useEditorNotes } from './EditorNotesContext'
import styles from './LinkedNoteBlock.module.css'

export function LinkedNoteBlockView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const noteId = node.attrs.noteId as string
  const collapsed = node.attrs.collapsed as boolean

  const { onNavigateToNote } = useEditorNotes()

  const [note, setNote] = useState<Note | null>(null)
  const [renderedHtml, setRenderedHtml] = useState('')

  useEffect(() => {
    if (!noteId) return
    storage.getNote(noteId).then((n) => setNote(n))
  }, [noteId])

  useEffect(() => {
    if (collapsed || !note?.content) {
      setRenderedHtml('')
      return
    }
    let cancelled = false
    renderMarkdown(note.content).then((html) => {
      if (!cancelled) setRenderedHtml(html)
    })
    return () => {
      cancelled = true
    }
  }, [note?.content, collapsed])

  const toggle = () => updateAttributes({ collapsed: !collapsed })

  return (
    <NodeViewWrapper className={styles.block}>
      <div className={styles.header} contentEditable={false}>
        <button
          type="button"
          className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`}
          onClick={toggle}
          aria-label="toggle"
        >
          ›
        </button>
        <span className={styles.title}>{note?.title || 'Linked note'}</span>
        <button
          type="button"
          className={styles.btnEdit}
          onClick={() => onNavigateToNote(noteId)}
          aria-label="Edit linked note"
          contentEditable={false}
        >
          <ArrowSquareOut size={12} />
        </button>
        <button
          type="button"
          className={styles.btnUnlink}
          onClick={() => deleteNode()}
          aria-label="Unlink note"
          contentEditable={false}
        >
          <LinkBreak size={12} />
        </button>
      </div>
      {!collapsed && (
        <div
          className={styles.body}
          contentEditable={false}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
    </NodeViewWrapper>
  )
}
