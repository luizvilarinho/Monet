import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Link as LinkIcon, LinkBreak } from '@phosphor-icons/react'
import { storage } from '../../storage'
import { useConfirm } from '../../hooks/useConfirm'
import type { BookChoice } from '../../lib/bookList'
import { openPdfInLibrary } from '../../lib/paperPdf'
import { paperPdfFromContent } from '../../lib/papers'
import {
  READER_NOTE_LINK_EVENT,
  findBookIdForNote,
  setReaderNoteLink,
  unlinkBookFromReaderNote,
} from '../../lib/readerNoteLink'
import { PaperBookPicker } from './PaperBookPicker'
import styles from './PaperLibraryBar.module.css'

// Ações da nota Paper com a Library (topSlot do Editor, abaixo das propriedades; no
// editor principal e no modal "Edit note" do board, que usam o mesmo editor).
// - Com um livro ligado à nota: "Open in Library" abre o livro e "Unlink" desfaz o
//   vínculo (o livro fica na Library).
// - Sem livro: com a linha `PDF:` na nota, "Open in Library" baixa o PDF, registra,
//   liga e abre; "Link a Library book…" liga um livro que já está na Library (o
//   artigo de acesso fechado, baixado por fora e importado na Library). A ação de
//   ligar exige caderno e não navega.
// A barra relê o vínculo pelo evento de janela do `readerNoteLink` (ligado ou
// desfeito aqui, no painel Notes do Reader ou na Library). Roda só no clique; a
// espera e o erro ficam numa linha. A nota Paper fica em qualquer erro. O estado é
// da nota: o App monta o componente com `key` pela nota, e o resultado de um clique
// numa nota que já não está aberta é descartado (nem erro, nem livro aberto na
// Library).
interface PaperLibraryBarProps {
  noteId: string
  notebookId: string | null
  title: string
  content: string
  // Texto da propriedade Authors da nota ('' sem ela).
  authors: string
  // O App abre o livro na Library.
  onOpenBook: (bookId: string) => void
}

export function PaperLibraryBar({ noteId, notebookId, title, content, authors, onOpenBook }: PaperLibraryBarProps) {
  const pdfLink = useMemo(() => paperPdfFromContent(content), [content])
  // O livro ligado à nota, e se ele ainda está na Library (null = lendo).
  const [linkedId, setLinkedId] = useState<string | null>(() => findBookIdForNote(noteId))
  const [check, setCheck] = useState<{ id: string; exists: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  // A nota que este componente mostra agora; null depois de desmontar.
  const shownNote = useRef<string | null>(noteId)
  const rowRef = useRef<HTMLDivElement>(null)
  const linkBtnRef = useRef<HTMLButtonElement>(null)
  const { confirm, modal } = useConfirm()

  useEffect(() => {
    shownNote.current = noteId
    setBusy(false)
    setError(null)
    setPickerOpen(false)
    const sync = () => setLinkedId(findBookIdForNote(noteId))
    sync()
    window.addEventListener(READER_NOTE_LINK_EVENT, sync)
    return () => {
      window.removeEventListener(READER_NOTE_LINK_EVENT, sync)
      shownNote.current = null
    }
  }, [noteId])

  useEffect(() => {
    if (!linkedId) return
    let cancelled = false
    storage
      .getBooks()
      .then((books) => {
        if (!cancelled) setCheck({ id: linkedId, exists: books.some((b) => b.id === linkedId) })
      })
      .catch((err) => {
        console.warn('failed to read the library for the paper note', err)
        if (!cancelled) setCheck({ id: linkedId, exists: false })
      })
    return () => {
      cancelled = true
    }
  }, [linkedId])

  const checked = linkedId !== null && check !== null && check.id === linkedId
  // Livro ligado que ainda existe; o vínculo com um livro apagado conta como sem livro.
  const hasBook = checked && check.exists
  const reading = linkedId !== null && !checked
  const canLink = notebookId !== null && !reading && !hasBook
  const canOpen = hasBook || !!pdfLink

  useEffect(() => {
    if (!canLink) setPickerOpen(false)
  }, [canLink])

  // O erro fica visível mesmo quando o botão some (livro apagado e sem link).
  if (!canOpen && !canLink && !error) return null

  async function open() {
    const started = noteId
    const stale = () => shownNote.current !== started
    setBusy(true)
    setError(null)
    try {
      const bookId = await openPdfInLibrary(
        { id: noteId, notebookId },
        { link: pdfLink, title: title.trim(), author: authors }
      )
      if (stale()) return
      onOpenBook(bookId)
    } catch (err) {
      if (stale()) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!stale()) setBusy(false)
    }
  }

  function closePicker(restoreFocus: boolean) {
    setPickerOpen(false)
    if (restoreFocus) linkBtnRef.current?.focus()
  }

  // Liga o livro escolhido a esta nota. Livro ligado a outra nota: o vínculo dele
  // passa para cá, então pergunta antes.
  async function linkBook({ book, linkedElsewhere }: BookChoice) {
    if (!notebookId) return
    const started = noteId
    setPickerOpen(false)
    if (linkedElsewhere) {
      const ok = await confirm(`"${book.title}" is linked to another note. Link it to this paper instead?`, {
        title: 'Link book',
        confirmLabel: 'Link',
        destructive: false,
      })
      if (!ok || shownNote.current !== started) return
    }
    // O vínculo com um livro que já não existe sairia na frente do novo.
    const gone = findBookIdForNote(noteId)
    if (gone && gone !== book.id) unlinkBookFromReaderNote(gone)
    setReaderNoteLink(book.id, notebookId, noteId)
    setError(null)
    setCheck({ id: book.id, exists: true })
  }

  function unlink() {
    if (!linkedId) return
    setError(null)
    unlinkBookFromReaderNote(linkedId)
  }

  return (
    <div ref={rowRef} className={styles.row}>
      {canOpen && (
        <button
          type="button"
          className={styles.btn}
          onClick={() => void open()}
          disabled={busy}
          title={hasBook ? 'Open this paper in the Library' : 'Download the open-access PDF and read it in the Library'}
        >
          <BookOpen size={13} aria-hidden />
          {busy ? (hasBook ? 'Opening…' : 'Downloading…') : 'Open in Library'}
        </button>
      )}
      {canLink && (
        <button
          ref={linkBtnRef}
          type="button"
          className={canOpen ? styles.btnSecondary : styles.btn}
          onClick={() => setPickerOpen((v) => !v)}
          disabled={busy}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          title="Pick a book from the Library and link it to this note"
        >
          <LinkIcon size={13} aria-hidden />
          Link a Library book…
        </button>
      )}
      {hasBook && (
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={unlink}
          disabled={busy}
          title="Unlink this book from the note. The book stays in the Library."
        >
          <LinkBreak size={13} aria-hidden />
          Unlink
        </button>
      )}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
      {pickerOpen && canLink && (
        <PaperBookPicker
          noteId={noteId}
          containerRef={rowRef}
          onPick={(choice) => void linkBook(choice)}
          onClose={closePicker}
        />
      )}
      {modal}
    </div>
  )
}
