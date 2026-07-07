import { useEffect, useState } from 'react'
import type { Book, Note, Notebook } from '../../types'
import { storage } from '../../storage'
import { booksDeleteFile, importBook } from '../../lib/books'
import { useConfirm } from '../../hooks/useConfirm'
import {
  deleteChatFolderById,
  getReaderChatFolderId,
  unlinkBookFromReaderFolder,
} from '../../hooks/useChat'
import { Reader } from '../Reader/Reader'
import styles from './Library.module.css'

export interface LibraryProps {
  notebooks: Notebook[]
  notes: Note[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (notebookId: string, title: string, content: string) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString()
}

// Continuação de leitura: id do livro aberto no Reader. Gravado ao abrir um
// livro e limpo no "Back to Library" — entrar no modo Library retoma o último
// livro direto na última página, mesmo após fechar/reabrir o app.
const OPEN_BOOK_KEY = 'monet:reader-open-book'

export function Library({
  notebooks,
  notes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
}: LibraryProps) {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [openBook, setOpenBook] = useState<Book | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [authorDraft, setAuthorDraft] = useState('')
  const { confirm, modal: confirmModal } = useConfirm()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await storage.getBooks()
        if (cancelled) return
        setBooks(loaded)
        const savedId = localStorage.getItem(OPEN_BOOK_KEY)
        if (savedId) {
          // Livro removido desde então: cai na lista e limpa o estado salvo.
          // Arquivo ausente no disco é coberto pelo estado de erro do Reader.
          const saved = loaded.find((b) => b.id === savedId)
          if (saved) setOpenBook(saved)
          else localStorage.removeItem(OPEN_BOOK_KEY)
        }
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function handleBookChange(updated: Book) {
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    setOpenBook((prev) => (prev && prev.id === updated.id ? updated : prev))
  }

  async function handleImport() {
    setErrorMessage(null)
    setImporting(true)
    try {
      const book = await importBook()
      if (book) setBooks((prev) => [book, ...prev])
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }

  function startEdit(book: Book) {
    setEditingId(book.id)
    setTitleDraft(book.title)
    setAuthorDraft(book.author ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
    setTitleDraft('')
    setAuthorDraft('')
  }

  async function saveEdit(book: Book) {
    const title = titleDraft.trim() || book.title
    const author = authorDraft.trim() || null
    const updated = { ...book, title, author }
    try {
      await storage.saveBook(updated)
      handleBookChange(updated)
      cancelEdit()
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDelete(book: Book) {
    const ok = await confirm(
      `Delete "${book.title}"? The book file will be removed.`,
      { title: 'Delete book' },
    )
    if (!ok) return
    setErrorMessage(null)
    try {
      await booksDeleteFile(book.filePath)
      await storage.deleteBook(book.id)
      // Cascata: a PASTA de chat do leitor deste livro (com todas as
      // conversas) é REMOVIDA junto com o livro (decisão explícita — sem
      // pasta órfã no Chat). Seguro na mesma janela: no modo Library nenhum
      // useChat está montado (ver comentário de deleteChatFolderById). O
      // unlink roda mesmo sem pasta existente, limpando links órfãos.
      const linkedFolderId = getReaderChatFolderId(book.id)
      if (linkedFolderId) deleteChatFolderById(linkedFolderId)
      unlinkBookFromReaderFolder(book.id)
      setBooks((prev) => prev.filter((b) => b.id !== book.id))
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
    }
  }

  function openReader(book: Book) {
    localStorage.setItem(OPEN_BOOK_KEY, book.id)
    setOpenBook(book)
  }

  function closeReader() {
    localStorage.removeItem(OPEN_BOOK_KEY)
    setOpenBook(null)
  }

  if (openBook) {
    return (
      <Reader
        book={openBook}
        onBack={closeReader}
        onBookChange={handleBookChange}
        onLoadError={() => localStorage.removeItem(OPEN_BOOK_KEY)}
        notebooks={notebooks}
        notes={notes}
        onCreateNotebook={onCreateNotebook}
        onCreateNote={onCreateNote}
        onSaveNote={onSaveNote}
      />
    )
  }

  return (
    <div className={styles.library}>
      {confirmModal}
      <header className={styles.header}>
        <h2 className={styles.title}>Library</h2>
        <button
          type="button"
          className={styles.primary}
          onClick={handleImport}
          disabled={importing}
        >
          {importing ? 'Importing…' : '+ Import PDF'}
        </button>
      </header>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.body}>
        {loading ? (
          <ul className={styles.skeletonList} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className={styles.skeletonRow}>
                <span className={`${styles.skeletonBar} ${styles.skeletonName}`} />
                <span className={`${styles.skeletonBar} ${styles.skeletonMeta}`} />
                <span className={`${styles.skeletonBar} ${styles.skeletonAction}`} />
              </li>
            ))}
          </ul>
        ) : books.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No books yet.</p>
            <p className={styles.emptyHelp}>Import a PDF to start reading.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colTitle}>title</th>
                <th className={styles.colAuthor}>author</th>
                <th className={styles.colPages}>pages</th>
                <th className={styles.colProgress}>progress</th>
                <th className={styles.colDate}>added</th>
                <th className={styles.colDate}>last opened</th>
                <th className={styles.colActions}>actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => {
                const isEditing = editingId === book.id
                return (
                  <tr
                    key={book.id}
                    className={isEditing ? undefined : styles.bookRow}
                    onClick={() => {
                      if (!isEditing) openReader(book)
                    }}
                  >
                    <td className={styles.cellTitle} title={book.title}>
                      {isEditing ? (
                        <input
                          className={styles.editInput}
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveEdit(book)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          aria-label="Book title"
                          autoFocus
                        />
                      ) : (
                        book.title
                      )}
                    </td>
                    <td className={styles.cellAuthor}>
                      {isEditing ? (
                        <input
                          className={styles.editInput}
                          value={authorDraft}
                          onChange={(e) => setAuthorDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveEdit(book)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          aria-label="Book author"
                        />
                      ) : (
                        book.author ?? '—'
                      )}
                    </td>
                    <td className={styles.cellMeta}>{book.totalPages}</td>
                    <td className={styles.cellMeta}>
                      {book.lastOpenedAt === null
                        ? '—'
                        : `${book.lastPage} / ${book.totalPages}`}
                    </td>
                    <td className={styles.cellMeta}>{formatDate(book.addedAt)}</td>
                    <td className={styles.cellMeta}>
                      {book.lastOpenedAt === null
                        ? 'Never'
                        : formatDate(book.lastOpenedAt)}
                    </td>
                    <td
                      className={styles.cellActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => void saveEdit(book)}
                          >
                            save
                          </button>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={cancelEdit}
                          >
                            cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => startEdit(book)}
                            aria-label={`edit ${book.title}`}
                          >
                            edit
                          </button>
                          <button
                            type="button"
                            className={styles.danger}
                            onClick={() => void handleDelete(book)}
                            aria-label={`delete ${book.title}`}
                          >
                            delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
