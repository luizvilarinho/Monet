import { useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import styles from './SearchInNote.module.css'

interface SearchInNoteProps {
  editor: TiptapEditor | null
  visible: boolean
  onClose: () => void
}

function findMatches(doc: ProseMirrorNode, query: string) {
  const matches: Array<{ from: number; to: number }> = []
  if (!query) return matches
  const lower = query.toLowerCase()
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.toLowerCase()
    let idx = 0
    while ((idx = text.indexOf(lower, idx)) !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + query.length })
      idx++
    }
  })
  return matches
}

export function SearchInNote({ editor, visible, onClose }: SearchInNoteProps) {
  const [query, setQuery] = useState('')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      setQuery('')
      setCurrentIdx(0)
      setMatchCount(0)
    }
  }, [visible])

  useEffect(() => {
    if (!editor || !visible || !query) {
      setMatchCount(0)
      setCurrentIdx(0)
      return
    }
    const matches = findMatches(editor.state.doc, query)
    setMatchCount(matches.length)
    setCurrentIdx((prev) => (matches.length > 0 ? Math.min(prev, matches.length - 1) : 0))
    if (matches.length > 0) {
      const match = matches[Math.min(currentIdx, matches.length - 1)]
      editor.chain().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, editor, visible])

  function navigateTo(idx: number) {
    if (!editor || !query) return
    const matches = findMatches(editor.state.doc, query)
    if (matches.length === 0) return
    const next = ((idx % matches.length) + matches.length) % matches.length
    setCurrentIdx(next)
    const match = matches[next]
    editor.chain().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        navigateTo(currentIdx - 1)
      } else {
        navigateTo(currentIdx + 1)
      }
    }
  }

  if (!visible) return null

  const displayIdx = matchCount > 0 ? currentIdx + 1 : 0

  return (
    <div className={styles.bar}>
      <input
        ref={inputRef}
        className={styles.input}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setCurrentIdx(0) }}
        onKeyDown={handleKeyDown}
        placeholder="Search in note..."
        type="text"
      />
      <span className={styles.count}>
        {query ? `${displayIdx} / ${matchCount}` : ''}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={() => navigateTo(currentIdx - 1)}
        aria-label="Previous match"
      >
        ↑
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={() => navigateTo(currentIdx + 1)}
        aria-label="Next match"
      >
        ↓
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={onClose}
        aria-label="Close search"
      >
        ×
      </button>
    </div>
  )
}
