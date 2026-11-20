import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import type { Book, Note, Notebook, NoteType } from '../../types'
import { storage } from '../../storage'
import { booksDeleteFile, importBook } from '../../lib/books'
import { useConfirm } from '../../hooks/useConfirm'
import {
  countReaderBookChatConversations,
  deleteChatFolderById,
  getReaderChatFolderId,
  unlinkBookFromReaderFolder,
} from '../../hooks/useChat'
import { unlinkBookFromReaderNote } from '../../lib/readerNoteLink'
import {
  clearOpenDoc,
  clearOpenDocsFolderId,
  loadDocsFolders,
  loadOpenDocsFolderId,
  pickDocsFolder,
  saveDocsFolders,
  saveOpenDocsFolderId,
  type DocsFolder,
} from '../../lib/docsFolder'
import { DocsReader } from './DocsReader'
import { EpubReader } from '../Reader/EpubReader'
import { Reader } from '../Reader/Reader'
import styles from './Library.module.css'

export interface LibraryProps {
  notebooks: Notebook[]
  notes: Note[]
  // Tipos de nota (vêm da janela principal): repassados ao Reader.
  noteTypes: NoteType[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  // `requestId` fica no 4º lugar (mesma assinatura do Chat) e o `typeId` no 5º.
  onCreateNote: (
    notebookId: string,
    title: string,
    content: string,
    requestId?: string,
    typeId?: string | null,
  ) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  // Abre o Settings do app (repassado ao chat dos leitores).
  onOpenSettings: () => void
}

// Mesma pasta escolhida duas vezes (Windows: caixa e barra final variam).
function normalizeRoot(root: string): string {
  return root.replace(/[\\/]+$/, '').toLowerCase()
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString()
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// Progresso em % nos dois formatos (no EPUB, `lastPage`/`totalPages` são
// locations, não páginas).
function progressPercent(book: Book): number {
  if (book.totalPages <= 0) return 0
  return Math.min(100, Math.round((book.lastPage / book.totalPages) * 100))
}

// Mais recente primeiro: a última abertura, ou a importação para o livro
// nunca aberto (o recém-importado aparece no topo).
function recency(book: Book): number {
  return book.lastOpenedAt ?? book.addedAt
}

// Acima disso a lista ganha o campo de filtro.
const BOOK_FILTER_MIN = 10

function foldText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Continuação de leitura: id do livro aberto no Reader. Gravado ao abrir um
// livro e limpo no "Back to Library" — entrar no modo Library retoma o último
// livro direto na última página, mesmo após fechar/reabrir o app.
const OPEN_BOOK_KEY = 'monet:reader-open-book'

export function Library({
  notebooks,
  notes,
  noteTypes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
  onOpenSettings,
}: LibraryProps) {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [openBook, setOpenBook] = useState<Book | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [authorDraft, setAuthorDraft] = useState('')
  const [bookFilter, setBookFilter] = useState('')
  // Pastas de documentação .md: persistidas em localStorage (id + root +
  // alias); o DocsReader abre como um modo próprio, como o Reader dos livros,
  // e é retomado ao voltar ao Library (mesmo regime do OPEN_BOOK_KEY).
  const [docsFolders, setDocsFolders] = useState<DocsFolder[]>(() =>
    loadDocsFolders(),
  )
  const [openDocsId, setOpenDocsId] = useState<string | null>(() =>
    loadOpenDocsFolderId(),
  )
  // Pasta recém-escolhida aguardando a confirmação do alias (Enter confirma).
  const [pendingDocsRoot, setPendingDocsRoot] = useState<string | null>(null)
  const [aliasDraft, setAliasDraft] = useState('')
  const [renamingDocsId, setRenamingDocsId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
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

  // Devolve se o livro saiu da Library.
  async function handleDelete(book: Book): Promise<boolean> {
    // O que vai junto com o livro, para a confirmação dizer.
    const highlightCount = await storage
      .getHighlights(book.id)
      .then((list) => list.length)
      .catch(() => null)
    const conversations = plural(
      countReaderBookChatConversations(book.id),
      'chat conversation',
    )
    const highlights =
      highlightCount === null ? 'highlights' : plural(highlightCount, 'highlight')
    const ok = await confirm(
      `Delete "${book.title}"? This also deletes its ${highlights} and ${conversations}. Quotes already saved in your notes are kept.`,
      {
        title: 'Delete book',
        confirmLabel: 'Delete book',
        cancelLabel: 'Cancel',
        destructive: true,
      },
    )
    if (!ok) return false
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
      // Vínculo livro→nota da aba Notes: só o LINK é removido — a
      // nota/notebook são conteúdo do usuário e sobrevivem à exclusão do
      // livro (diferente da pasta de chat, exclusiva do livro).
      unlinkBookFromReaderNote(book.id)
      setBooks((prev) => prev.filter((b) => b.id !== book.id))
      return true
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // "Remove from Library" na tela de livro sem arquivo.
  async function handleRemoveOpenBook(book: Book) {
    if (await handleDelete(book)) closeReader()
  }

  function openReader(book: Book) {
    // Um leitor por vez: a retomada passa a ser deste livro.
    clearOpenDocsFolderId()
    setOpenDocsId(null)
    localStorage.setItem(OPEN_BOOK_KEY, book.id)
    setOpenBook(book)
  }

  function closeReader() {
    localStorage.removeItem(OPEN_BOOK_KEY)
    setOpenBook(null)
  }

  // ─── Pastas de documentação .md ─────────────────────────────────────────
  function updateDocsFolders(next: DocsFolder[]) {
    saveDocsFolders(next)
    setDocsFolders(next)
  }

  async function handlePickDocsFolder() {
    setErrorMessage(null)
    try {
      const root = await pickDocsFolder()
      if (!root) return
      const normalized = normalizeRoot(root)
      const existing = docsFolders.find(
        (f) => normalizeRoot(f.root) === normalized,
      )
      if (existing) {
        setErrorMessage(`This folder is already in the Library as "${existing.alias}".`)
        return
      }
      // Sugestão de alias: nome da pasta (editável antes de confirmar).
      setAliasDraft(
        root.split(/[\\/]/).filter(Boolean).pop() ?? 'Docs',
      )
      setPendingDocsRoot(root)
      setRenamingDocsId(null)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
    }
  }

  function confirmNewDocsFolder() {
    if (!pendingDocsRoot) return
    const alias = aliasDraft.trim() || 'Docs'
    updateDocsFolders([
      ...docsFolders,
      { id: crypto.randomUUID(), root: pendingDocsRoot, alias },
    ])
    setPendingDocsRoot(null)
    setAliasDraft('')
  }

  function cancelNewDocsFolder() {
    setPendingDocsRoot(null)
    setAliasDraft('')
  }

  function startRenameDocs(folder: DocsFolder) {
    setRenameDraft(folder.alias)
    setRenamingDocsId(folder.id)
  }

  function cancelRenameDocs() {
    setRenamingDocsId(null)
    setRenameDraft('')
  }

  function saveRenameDocs(folder: DocsFolder) {
    const alias = renameDraft.trim() || folder.alias
    updateDocsFolders(
      docsFolders.map((f) => (f.id === folder.id ? { ...f, alias } : f)),
    )
    cancelRenameDocs()
  }

  async function handleRemoveDocs(folder: DocsFolder) {
    const ok = await confirm(
      `Remove "${folder.alias}"? The folder on disk is not touched.`,
      { title: 'Remove docs folder', confirmLabel: 'Remove', cancelLabel: 'Cancel' },
    )
    if (!ok) return
    updateDocsFolders(docsFolders.filter((f) => f.id !== folder.id))
    clearOpenDoc(folder.id)
    if (renamingDocsId === folder.id) cancelRenameDocs()
  }

  function openDocsReader(folder: DocsFolder) {
    localStorage.removeItem(OPEN_BOOK_KEY)
    saveOpenDocsFolderId(folder.id)
    setOpenDocsId(folder.id)
  }

  function closeDocsReader() {
    clearOpenDocsFolderId()
    setOpenDocsId(null)
  }

  const visibleBooks = useMemo(() => {
    const query = foldText(bookFilter.trim())
    const filtered = query
      ? books.filter((b) => foldText(`${b.title} ${b.author ?? ''}`).includes(query))
      : books
    return [...filtered].sort((a, b) => recency(b) - recency(a))
  }, [books, bookFilter])

  // Um modo por vez: a pasta de docs abre no lugar do Library, como o Reader.
  const openDocsFolder = docsFolders.find((f) => f.id === openDocsId)
  if (openDocsFolder) {
    return (
      <DocsReader
        key={openDocsFolder.id}
        folder={openDocsFolder}
        onBack={closeDocsReader}
      />
    )
  }

  // Um leitor por formato: a união discriminada garante em tempo de compilação
  // que cada um só recebe o livro que sabe abrir.
  if (openBook?.format === 'epub') {
    return (
      <>
        <EpubReader
          book={openBook}
          onBack={closeReader}
          onBookChange={handleBookChange}
          onLoadError={() => localStorage.removeItem(OPEN_BOOK_KEY)}
          notebooks={notebooks}
          notes={notes}
          noteTypes={noteTypes}
          onCreateNotebook={onCreateNotebook}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          onOpenSettings={onOpenSettings}
          onRemoveBook={() => void handleRemoveOpenBook(openBook)}
        />
        {confirmModal}
      </>
    )
  }

  if (openBook) {
    return (
      <>
        <Reader
          book={openBook}
          onBack={closeReader}
          onBookChange={handleBookChange}
          onLoadError={() => localStorage.removeItem(OPEN_BOOK_KEY)}
          notebooks={notebooks}
          notes={notes}
          noteTypes={noteTypes}
          onCreateNotebook={onCreateNotebook}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          onOpenSettings={onOpenSettings}
          onRemoveBook={() => void handleRemoveOpenBook(openBook)}
        />
        {confirmModal}
      </>
    )
  }

  return (
    <div className={styles.library}>
      {confirmModal}
      <header className={styles.header}>
        <h2 className={styles.title}>Library</h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void handlePickDocsFolder()}
          >
            <Plus size={12} aria-hidden />
            Add docs folder
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={handleImport}
            disabled={importing}
          >
            {!importing && <Plus size={12} aria-hidden />}
            {importing ? 'Importing…' : 'Import book'}
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            title="Dismiss"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      <div className={styles.body}>
        {(pendingDocsRoot !== null || docsFolders.length > 0) && (
          <section className={styles.docsSection} aria-label="Docs folders">
            <h3 className={styles.docsSectionTitle}>Docs folders</h3>
            <ul className={styles.docsList}>
              {docsFolders.map((folder) =>
                renamingDocsId === folder.id ? (
                  <li key={folder.id} className={styles.docsRow}>
                    <input
                      className={`${styles.editInput} ${styles.docsEditInput}`}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRenameDocs(folder)
                        if (e.key === 'Escape') cancelRenameDocs()
                      }}
                      aria-label="Docs folder name"
                      autoFocus
                    />
                    <div className={styles.docsActions}>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => saveRenameDocs(folder)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={cancelRenameDocs}
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={folder.id}
                    className={`${styles.docsRow} ${styles.docsRowClickable}`}
                    onClick={() => openDocsReader(folder)}
                  >
                    <div className={styles.docsInfo}>
                      <span className={styles.docsAlias}>{folder.alias}</span>
                      <span className={styles.docsPath} title={folder.root}>
                        {folder.root}
                      </span>
                    </div>
                    <div
                      className={styles.docsActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => openDocsReader(folder)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => startRenameDocs(folder)}
                        aria-label={`Rename ${folder.alias}`}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => void handleRemoveDocs(folder)}
                        aria-label={`Remove ${folder.alias}`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ),
              )}
              {pendingDocsRoot !== null && (
                <li className={styles.docsRow}>
                  <div className={styles.docsPending}>
                    <input
                      className={`${styles.editInput} ${styles.docsEditInput}`}
                      value={aliasDraft}
                      onChange={(e) => setAliasDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmNewDocsFolder()
                        if (e.key === 'Escape') cancelNewDocsFolder()
                      }}
                      aria-label="Docs folder name"
                      autoFocus
                    />
                    <span className={styles.docsPath} title={pendingDocsRoot}>
                      {pendingDocsRoot}
                    </span>
                  </div>
                  <div className={styles.docsActions}>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={confirmNewDocsFolder}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={cancelNewDocsFolder}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              )}
            </ul>
          </section>
        )}
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
            <p className={styles.emptyHelp}>
              Import a PDF or EPUB to start reading.
            </p>
          </div>
        ) : (
          <>
          {(books.length > BOOK_FILTER_MIN || bookFilter !== '') && (
            <input
              type="search"
              className={styles.filterInput}
              placeholder="Filter by title or author…"
              value={bookFilter}
              onChange={(e) => setBookFilter(e.target.value)}
              aria-label="Filter books"
            />
          )}
          {visibleBooks.length === 0 && (
            <p className={styles.filterEmpty}>No books match this filter.</p>
          )}
          <table className={styles.table} hidden={visibleBooks.length === 0}>
            <thead>
              <tr>
                <th className={styles.colTitle}>Title</th>
                <th className={styles.colAuthor}>Author</th>
                <th className={styles.colPages}>Pages</th>
                <th className={styles.colProgress}>Progress</th>
                <th className={styles.colDate}>Added</th>
                <th className={styles.colDate}>Last opened</th>
                <th className={styles.colActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleBooks.map((book) => {
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
                        <>
                          <span className={styles.formatBadge}>
                            {book.format}
                          </span>
                          {book.title}
                        </>
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
                    <td className={styles.cellMeta}>
                      {book.format === 'epub' ? '—' : book.totalPages}
                    </td>
                    <td
                      className={styles.cellMeta}
                      title={
                        book.format === 'pdf' && book.lastOpenedAt !== null
                          ? `p. ${book.lastPage} of ${book.totalPages}`
                          : undefined
                      }
                    >
                      {book.lastOpenedAt === null ? '—' : `${progressPercent(book)}%`}
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
                            Save
                          </button>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.primary}
                            onClick={() => openReader(book)}
                            aria-label={`Open ${book.title}`}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => startEdit(book)}
                            aria-label={`Edit ${book.title}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.danger}
                            onClick={() => void handleDelete(book)}
                            aria-label={`Delete ${book.title}`}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  )
}
