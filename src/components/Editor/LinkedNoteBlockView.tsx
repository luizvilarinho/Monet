import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowSquareOut, CaretRight, LinkBreak } from '@phosphor-icons/react'
import { renderNoteContent } from '../../lib/markdown'
import { useMermaidDiagrams } from '../MermaidDiagram/useMermaidDiagrams'
import { storage } from '../../storage'
import type { Note } from '../../types'
import { useEditorNotes } from './EditorNotesContext'
import styles from './LinkedNoteBlock.module.css'

export function LinkedNoteBlockView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const noteId = node.attrs.noteId as string
  const collapsed = node.attrs.collapsed as boolean

  const { onNavigateToNote } = useEditorNotes()

  // undefined = carregando; null = a nota foi apagada.
  const [note, setNote] = useState<Note | null | undefined>(undefined)
  const [renderedHtml, setRenderedHtml] = useState('')
  // React 19 regrava o innerHTML se o objeto muda a cada render (perde a seleção).
  const inner = useMemo(() => ({ __html: renderedHtml }), [renderedHtml])
  const bodyRef = useRef<HTMLDivElement>(null)
  useMermaidDiagrams(bodyRef, renderedHtml)

  useEffect(() => {
    if (!noteId) {
      setNote(null)
      return
    }
    let cancelled = false
    storage
      .getNote(noteId)
      .then((n) => {
        if (!cancelled) setNote(n)
      })
      .catch((err) => console.warn('linked note: failed to load', err))
    return () => {
      cancelled = true
    }
  }, [noteId])

  useEffect(() => {
    if (collapsed || !note?.content) {
      setRenderedHtml('')
      return
    }
    let cancelled = false
    renderNoteContent(note.content).then((html) => {
      if (!cancelled) setRenderedHtml(html)
    })
    return () => {
      cancelled = true
    }
  }, [note?.content, collapsed])

  const toggle = () => updateAttributes({ collapsed: !collapsed })

  // Nota apagada: o bloco diz isso e oferece só o Unlink.
  if (note === null) {
    return (
      <NodeViewWrapper className={styles.block}>
        <div className={`${styles.header} ${styles.deleted}`} contentEditable={false}>
          <span className={styles.title}>This note was deleted</span>
          <button
            type="button"
            className={styles.btnUnlinkLabeled}
            onClick={() => deleteNode()}
            title="Remove this link from the note"
          >
            <LinkBreak size={12} aria-hidden />
            Unlink
          </button>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className={styles.block}>
      <div className={styles.header} contentEditable={false}>
        <button
          type="button"
          className={`${styles.chevron} ${!collapsed ? styles.chevronOpen : ''}`}
          onClick={toggle}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <CaretRight size={12} weight="bold" aria-hidden />
        </button>
        <span className={styles.title}>{note?.title || 'Linked note'}</span>
        <button
          type="button"
          className={styles.btnEdit}
          onClick={() => onNavigateToNote(noteId)}
          aria-label="Open linked note"
          title="Open the note"
          contentEditable={false}
        >
          <ArrowSquareOut size={12} />
        </button>
        <button
          type="button"
          className={styles.btnUnlink}
          onClick={() => deleteNode()}
          aria-label="Unlink note"
          title="Unlink (the note is kept)"
          contentEditable={false}
        >
          <LinkBreak size={12} />
        </button>
      </div>
      {!collapsed && (
        <div
          ref={bodyRef}
          className={styles.body}
          contentEditable={false}
          dangerouslySetInnerHTML={inner}
        />
      )}
    </NodeViewWrapper>
  )
}
