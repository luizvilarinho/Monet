import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import type { Book } from '../../types'
import { storage } from '../../storage'
import { bookChoices, showBookFilter, type BookChoice } from '../../lib/bookList'
import { getReaderNoteLinks, type ReaderNoteLinks } from '../../lib/readerNoteLink'
import styles from './PaperBookPicker.module.css'

// Seletor de livros da Library para ligar a uma nota Paper (popover sob a linha da
// barra, na ordem da Library). Lê a Library ao abrir. Campo de filtro quando há mais
// de 10 livros; ↑↓ e Enter escolhem; Esc (captura: o modal do board não fecha junto)
// e o clique fora fecham. O livro já ligado a outra nota vem marcado: quem chama
// pede a confirmação.
interface PaperBookPickerProps {
  noteId: string
  // A linha da barra: o clique no gatilho (dentro dela) não conta como "fora".
  containerRef: RefObject<HTMLElement | null>
  onPick: (choice: BookChoice) => void
  // `restoreFocus`: fechou pelo Esc, o foco volta ao gatilho.
  onClose: (restoreFocus: boolean) => void
}

type Loaded = { books: Book[]; links: ReaderNoteLinks }

export function PaperBookPicker({ noteId, containerRef, onPick, onClose }: PaperBookPickerProps) {
  // null = lendo; 'error' = a Library não abriu.
  const [loaded, setLoaded] = useState<Loaded | 'error' | null>(null)
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState(0)
  const filterRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    let cancelled = false
    storage
      .getBooks()
      .then((books) => {
        if (!cancelled) setLoaded({ books, links: getReaderNoteLinks() })
      })
      .catch((err) => {
        console.warn('failed to read the library for the book picker', err)
        if (!cancelled) setLoaded('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const books = loaded && loaded !== 'error' ? loaded.books : null
  const choices = useMemo(
    () => (loaded && loaded !== 'error' ? bookChoices(loaded.books, filter, loaded.links, noteId) : []),
    [loaded, filter, noteId]
  )
  const showFilter = books !== null && showBookFilter(books.length, filter)
  const activeIndex = Math.min(active, choices.length - 1)
  const activeChoice = choices[activeIndex]

  // O foco vai ao filtro (ou à lista, sem filtro) quando os livros chegam.
  const ready = books !== null && books.length > 0
  useEffect(() => {
    if (!ready) return
    if (filterRef.current) filterRef.current.focus()
    else listRef.current?.focus()
  }, [ready])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onCloseRef.current(false)
    }
    // Captura: o Esc não chega ao modal do board nem a outros atalhos.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onCloseRef.current(true)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [containerRef])

  useEffect(() => {
    if (!activeChoice) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-book-id="${CSS.escape(activeChoice.book.id)}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeChoice])

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (choices.length === 0) return
    const inFilter = e.target === filterRef.current
    const next =
      e.key === 'ArrowDown' ? Math.min(activeIndex + 1, choices.length - 1)
      : e.key === 'ArrowUp' ? Math.max(activeIndex - 1, 0)
      : e.key === 'Home' && !inFilter ? 0
      : e.key === 'End' && !inFilter ? choices.length - 1
      : -1
    if (next >= 0) {
      e.preventDefault()
      setActive(next)
    } else if (e.key === 'Enter' && activeChoice) {
      e.preventDefault()
      onPick(activeChoice)
    }
  }

  const activeDescendant = activeChoice ? `paper-book-${activeChoice.book.id}` : undefined

  return (
    <div className={styles.picker} onKeyDown={handleKeyDown}>
      {loaded === null && <p className={styles.message}>Loading books…</p>}
      {loaded === 'error' && <p className={styles.message}>Could not read the Library. Try again.</p>}
      {books !== null && books.length === 0 && (
        <p className={styles.message}>No books in the Library yet. Import the PDF in the Library first.</p>
      )}
      {showFilter && (
        <input
          ref={filterRef}
          type="text"
          className={styles.filter}
          placeholder="Filter by title or author…"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setActive(0)
          }}
          aria-label="Filter books"
          role="combobox"
          aria-expanded
          aria-controls="paper-book-list"
          aria-activedescendant={activeDescendant}
        />
      )}
      {books !== null && books.length > 0 && choices.length === 0 && (
        <p className={styles.message}>No books match this filter.</p>
      )}
      {choices.length > 0 && (
        <ul
          ref={listRef}
          id="paper-book-list"
          className={styles.list}
          role="listbox"
          aria-label="Library books"
          tabIndex={showFilter ? -1 : 0}
          aria-activedescendant={showFilter ? undefined : activeDescendant}
        >
          {choices.map((choice, i) => (
            <li
              key={choice.book.id}
              id={`paper-book-${choice.book.id}`}
              data-book-id={choice.book.id}
              role="option"
              aria-selected={i === activeIndex}
              className={i === activeIndex ? `${styles.item} ${styles.itemActive}` : styles.item}
              onMouseMove={() => setActive(i)}
              onClick={() => onPick(choice)}
            >
              <span className={styles.itemTitle} title={choice.book.title}>
                {choice.book.title}
              </span>
              <span className={styles.itemMeta}>
                <span className={styles.itemAuthor}>{choice.book.author || '—'}</span>
                {choice.linkedElsewhere && <span className={styles.itemWarn}>linked to another note</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
