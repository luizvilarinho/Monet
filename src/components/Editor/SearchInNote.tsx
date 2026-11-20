import { useEffect, useRef, useState } from 'react'
import { CaretDown, CaretUp, X } from '@phosphor-icons/react'
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

// Sem caixa e sem acento: "acao" acha "Ação".
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function countIn(text: string, q: string): number {
  let n = 0
  for (let idx = text.indexOf(q); idx !== -1; idx = text.indexOf(q, idx + 1)) n++
  return n
}

// Ocorrências em ordem do documento: título de cada toggle e o texto de cada
// bloco (inclusive através de negrito, link etc. no meio da palavra). O texto
// dobrado guarda, por caractere, a posição do original no doc.
function findMatches(doc: ProseMirrorNode, query: string) {
  const matches: MatchRange[] = []
  const q = fold(query)
  if (!q) return matches
  doc.descendants((node, pos) => {
    if (node.type.name === 'toggleBlock') {
      const hits = countIn(fold(String(node.attrs.title ?? '')), q)
      for (let i = 0; i < hits; i++) matches.push({ from: pos, to: pos + node.nodeSize, title: true })
      return true
    }
    if (!node.isTextblock) return true
    let folded = ''
    const starts: number[] = []
    const ends: number[] = []
    node.forEach((child, offset) => {
      const childPos = pos + 1 + offset
      if (!child.isText || !child.text) {
        // Nó inline (chip, quebra de linha): separa, nunca casa.
        folded += '\u0000'
        starts.push(childPos)
        ends.push(childPos + child.nodeSize)
        return
      }
      let offsetInText = 0
      for (const ch of child.text) {
        const at = childPos + offsetInText
        const f = fold(ch)
        for (let k = 0; k < f.length; k++) {
          starts.push(at)
          ends.push(at + ch.length)
        }
        folded += f
        offsetInText += ch.length
      }
    })
    for (let idx = folded.indexOf(q); idx !== -1; idx = folded.indexOf(q, idx + 1)) {
      matches.push({ from: starts[idx], to: ends[idx + q.length - 1] })
    }
    return false
  })
  return matches
}

// Toggle fechado mais de fora que esconde a ocorrência (null: visível). No
// título, `from` é o próprio toggle e só os de fora contam.
function hidingToggle(doc: ProseMirrorNode, match: MatchRange): number | null {
  const $pos = doc.resolve(match.from)
  let found: number | null = null
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.type.name === 'toggleBlock' && node.attrs.collapsed) found = $pos.before(d)
  }
  return found
}

// Ocorrência escondida num toggle fechado: abre os toggles em volta (fora do
// desfazer). Volta true se o doc mudou. Só na navegação (Enter, setas) e ao
// fechar a busca: digitar não abre nem grava toggles.
function revealMatch(editor: TiptapEditor, match: MatchRange): boolean {
  const $pos = editor.state.doc.resolve(match.from)
  const tr = editor.state.tr
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (node.type.name === 'toggleBlock' && node.attrs.collapsed) {
      tr.setNodeMarkup($pos.before(d), undefined, { ...node.attrs, collapsed: false })
    }
  }
  if (!tr.docChanged) return false
  editor.view.dispatch(tr.setMeta('addToHistory', false))
  return true
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
    highlight(matches, Math.min(currentIdx, Math.max(0, matches.length - 1)), false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, editor, visible])

  // Seleciona e destaca a ocorrência e a rola para fora da barra. O
  // scrollIntoView do ProseMirror não rola com o foco no campo de busca (a
  // seleção do DOM fica fora do editor), então a rolagem é feita aqui, no
  // container da barra, descontando a altura dela.
  // Ocorrência num toggle fechado: na navegação (`reveal`), abre o toggle;
  // digitando, rola só até o cabeçalho dele. No código de um Mermaid, a
  // seleção nele troca o bloco para Code. Quando a altura muda depois do
  // render, a rolagem é refeita no quadro seguinte.
  function highlight(matches: MatchRange[], current: number, reveal: boolean) {
    if (!editor) return
    const match = matches[current]
    const opened = match && reveal ? revealMatch(editor, match) : false
    setSearchHighlight(editor, matches, current)
    if (!match) return
    const hiddenAt = hidingToggle(editor.state.doc, match)
    const target: MatchRange = hiddenAt === null ? match : { from: hiddenAt, to: hiddenAt, title: true }
    scrollToMatch(target)
    const parent = editor.state.doc.resolve(match.from).parent
    if (opened || (hiddenAt === null && !match.title && parent.type.name === 'codeBlock')) {
      requestAnimationFrame(() => scrollToMatch(target))
    }
  }

  function scrollToMatch(match: MatchRange) {
    const bar = barRef.current
    const container = bar?.parentElement
    if (!editor || !bar || !container || editor.isDestroyed) return
    const start = editor.view.coordsAtPos(match.from)
    // Título do toggle: basta o cabeçalho na tela.
    const end = match.title ? start : editor.view.coordsAtPos(match.to)
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
    highlight(matches, next, true)
  }

  // Fechar devolve o foco ao editor com a ocorrência atual selecionada (a
  // seleção fica visível e a régua aparece para marcar o trecho). Se ela está
  // num toggle fechado, o toggle abre agora: o cursor vai para lá.
  function close() {
    if (editor && !editor.isDestroyed && matchCount > 0) {
      const match = findMatches(editor.state.doc, query)[currentIdx]
      if (match) revealMatch(editor, match)
      editor.commands.focus()
    }
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
        title="Previous match (Shift+Enter)"
      >
        <CaretUp size={12} aria-hidden />
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={() => navigateTo(currentIdx + 1)}
        aria-label="Next match"
        title="Next match (Enter)"
      >
        <CaretDown size={12} aria-hidden />
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={close}
        aria-label="Close search"
        title="Close (Esc)"
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  )
}
