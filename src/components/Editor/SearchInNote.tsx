import { useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { setSearchHighlight, type MatchRange } from './SearchHighlight'
import styles from './SearchInNote.module.css'

// Folga entre a ocorrência e a barra (ou o pé da área de rolagem).
const SCROLL_MARGIN = 8

interface SearchInNoteProps {
  editor: TiptapEditor | null
  visible: boolean
  onClose: () => void
}

function findMatches(doc: ProseMirrorNode, query: string) {
  const matches: MatchRange[] = []
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
  const barRef = useRef<HTMLDivElement>(null)

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

  // O destaque some quando a busca fecha (Esc, ×, Ctrl+F de novo).
  useEffect(() => {
    if (!editor || !visible) return
    return () => setSearchHighlight(editor, [], -1)
  }, [editor, visible])

  useEffect(() => {
    if (!editor || !visible || !query) {
      setMatchCount(0)
      setCurrentIdx(0)
      if (editor && visible) setSearchHighlight(editor, [], -1)
      return
    }
    const matches = findMatches(editor.state.doc, query)
    setMatchCount(matches.length)
    setCurrentIdx((prev) => (matches.length > 0 ? Math.min(prev, matches.length - 1) : 0))
    highlight(matches, Math.min(currentIdx, Math.max(0, matches.length - 1)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, editor, visible])

  // Seleciona e destaca a ocorrência e a rola para fora da barra. O
  // scrollIntoView do ProseMirror não rola com o foco no campo de busca (a
  // seleção do DOM fica fora do editor), então a rolagem é feita aqui, no
  // container da barra, descontando a altura dela.
  function highlight(matches: MatchRange[], current: number) {
    if (!editor) return
    setSearchHighlight(editor, matches, current)
    const match = matches[current]
    const bar = barRef.current
    const container = bar?.parentElement
    if (!match || !bar || !container || editor.isDestroyed) return
    const start = editor.view.coordsAtPos(match.from)
    const end = editor.view.coordsAtPos(match.to)
    const box = container.getBoundingClientRect()
    const top = box.top + bar.offsetHeight + SCROLL_MARGIN
    const bottom = box.bottom - SCROLL_MARGIN
    if (start.top < top) container.scrollTop -= top - start.top
    else if (end.bottom > bottom) container.scrollTop += end.bottom - bottom
  }

  function navigateTo(idx: number) {
    if (!editor || !query) return
    const matches = findMatches(editor.state.doc, query)
    if (matches.length === 0) return
    const next = ((idx % matches.length) + matches.length) % matches.length
    setCurrentIdx(next)
    highlight(matches, next)
  }

  // Fechar devolve o foco ao editor com a ocorrência atual selecionada (a
  // seleção fica visível e a régua aparece para marcar o trecho).
  function close() {
    if (editor && !editor.isDestroyed && matchCount > 0) editor.commands.focus()
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      close()
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
    <div ref={barRef} className={styles.bar} data-search-in-note>
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
        onClick={close}
        aria-label="Close search"
      >
        ×
      </button>
    </div>
  )
}
