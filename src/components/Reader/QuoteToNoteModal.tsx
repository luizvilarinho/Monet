import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BookQuote, Note, Notebook } from '../../types'
import styles from './QuoteToNoteModal.module.css'

const LAST_NOTEBOOK_KEY = 'monet:quote-save-last-notebook-id'
const QUOTE_BLOCKQUOTE_LIMIT = 2000

export interface QuoteToNoteModalProps {
  open: boolean
  notebooks: Notebook[]
  notes: Note[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (notebookId: string, title: string, content: string) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  quoteText: string
  bookTitle: string
  page: number
  bookId: string
  onSaved: (quote: BookQuote) => void
  onClose: () => void
}

type Stage =
  | { kind: 'notebook-select' }
  | { kind: 'notebook-empty-create' }
  | { kind: 'note-select'; notebookId: string }
  | { kind: 'new-note-title'; notebookId: string }
  | { kind: 'saving'; notebookId: string }
  | {
      kind: 'success'
      notebookId: string
      notebookName: string
      noteId: string
      noteTitle: string
      truncated: boolean
    }
  | {
      kind: 'error'
      message: string
      retry: () => void
    }

function loadLastNotebookId(): string | null {
  try {
    const raw = localStorage.getItem(LAST_NOTEBOOK_KEY)
    return raw && raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

function saveLastNotebookId(id: string): void {
  try {
    localStorage.setItem(LAST_NOTEBOOK_KEY, id)
  } catch (err) {
    console.error('failed to persist last notebook id', err)
  }
}

export function buildQuoteBlock(rawText: string, bookTitle: string, page: number): {
  content: string
  truncated: boolean
} {
  const text = rawText.trim()
  const truncated = text.length > QUOTE_BLOCKQUOTE_LIMIT
  const quote = truncated
    ? text.slice(0, QUOTE_BLOCKQUOTE_LIMIT).trimEnd() + '…'
    : text
  const content = `> ${quote}\n\n— *${bookTitle}*, p. ${page}`
  return { content, truncated }
}

export function appendQuoteToContent(existing: string, block: string): string {
  if (!existing.trim()) return block
  const trimmedEnd = existing.replace(/\n+$/, '')
  return `${trimmedEnd}\n\n${block}`
}

export function QuoteToNoteModal({
  open,
  notebooks,
  notes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
  quoteText,
  bookTitle,
  page,
  bookId,
  onSaved,
  onClose,
}: QuoteToNoteModalProps) {
  const [stage, setStage] = useState<Stage>(() => initialStage(notebooks.length))
  const [newNotebookName, setNewNotebookName] = useState('')
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [recentlyPickedNotebookId, setRecentlyPickedNotebookId] = useState<
    string | null
  >(null)

  const newNotebookInputRef = useRef<HTMLInputElement | null>(null)
  const newNoteTitleInputRef = useRef<HTMLInputElement | null>(null)

  function initialStage(notebookCount: number): Stage {
    if (notebookCount === 0) return { kind: 'notebook-empty-create' }
    return { kind: 'notebook-select' }
  }

  useEffect(() => {
    if (!open) return
    setStage(initialStage(notebooks.length))
    setNewNotebookName('')
    setNewNoteTitle('')
    setTitleError(null)
    setRecentlyPickedNotebookId(null)
  }, [open, notebooks.length])

  useEffect(() => {
    if (!open) return
    if (stage.kind === 'notebook-empty-create') {
      newNotebookInputRef.current?.focus()
    } else if (stage.kind === 'new-note-title') {
      newNoteTitleInputRef.current?.focus()
    }
  }, [open, stage.kind])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const lastNotebookId = useMemo(() => {
    if (!open) return null
    const stored = loadLastNotebookId()
    if (!stored) return null
    return notebooks.some((n) => n.id === stored) ? stored : null
  }, [open, notebooks])

  const orderedNotebooks = useMemo(() => {
    if (!lastNotebookId) return notebooks
    const last = notebooks.find((n) => n.id === lastNotebookId)
    if (!last) return notebooks
    return [last, ...notebooks.filter((n) => n.id !== lastNotebookId)]
  }, [notebooks, lastNotebookId])

  const selectedNotebookId =
    stage.kind === 'note-select' ||
    stage.kind === 'new-note-title' ||
    stage.kind === 'saving'
      ? stage.notebookId
      : null

  const selectedNotebookName = selectedNotebookId
    ? (notebooks.find((n) => n.id === selectedNotebookId)?.name ?? '')
    : ''

  const notesOfSelected = useMemo(() => {
    if (!selectedNotebookId) return []
    return notes.filter((n) => n.notebookId === selectedNotebookId)
  }, [notes, selectedNotebookId])

  if (!open) return null

  async function handleCreateNotebookFromEmpty() {
    const name = newNotebookName.trim()
    if (!name) return
    try {
      const nb = await onCreateNotebook(name)
      setNewNotebookName('')
      setStage({ kind: 'new-note-title', notebookId: nb.id })
    } catch (err) {
      setStage({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to create notebook.',
        retry: () => setStage({ kind: 'notebook-empty-create' }),
      })
    }
  }

  async function appendToExistingNote(notebookId: string, note: Note) {
    setStage({ kind: 'saving', notebookId })
    const { content: block, truncated } = buildQuoteBlock(quoteText, bookTitle, page)
    const newContent = appendQuoteToContent(note.content, block)
    try {
      await onSaveNote({
        ...note,
        content: newContent,
        updatedAt: Date.now(),
      })
      const quote: BookQuote = {
        id: crypto.randomUUID(),
        bookId,
        page,
        text: quoteText,
        targetNoteId: note.id,
        createdAt: Date.now(),
      }
      saveLastNotebookId(notebookId)
      const nb = notebooks.find((n) => n.id === notebookId)
      setStage({
        kind: 'success',
        notebookId,
        notebookName: nb?.name ?? '',
        noteId: note.id,
        noteTitle: note.title.trim() || 'untitled',
        truncated,
      })
      onSaved(quote)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save quote to note.'
      setStage({
        kind: 'error',
        message,
        retry: () => void appendToExistingNote(notebookId, note),
      })
    }
  }

  async function createAndSaveNewNote(notebookId: string, title: string) {
    setStage({ kind: 'saving', notebookId })
    const { content: block, truncated } = buildQuoteBlock(quoteText, bookTitle, page)
    try {
      const note = await onCreateNote(notebookId, title, block)
      const quote: BookQuote = {
        id: crypto.randomUUID(),
        bookId,
        page,
        text: quoteText,
        targetNoteId: note.id,
        createdAt: Date.now(),
      }
      saveLastNotebookId(notebookId)
      const nb = notebooks.find((n) => n.id === notebookId)
      setStage({
        kind: 'success',
        notebookId,
        notebookName: nb?.name ?? '',
        noteId: note.id,
        noteTitle: note.title.trim() || title,
        truncated,
      })
      onSaved(quote)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create note.'
      setStage({
        kind: 'error',
        message,
        retry: () => void createAndSaveNewNote(notebookId, title),
      })
    }
  }

  function handleConfirmNewNoteTitle(notebookId: string) {
    const title = newNoteTitle.trim()
    if (!title) {
      setTitleError('Please enter a title for the new note.')
      return
    }
    setTitleError(null)
    void createAndSaveNewNote(notebookId, title)
  }

  function renderStage() {
    if (stage.kind === 'notebook-empty-create') {
      return (
        <div className={styles.body}>
          <p className={styles.emptyTitle}>You have no notebooks yet</p>
          <p className={styles.emptyHelp}>
            Create a notebook to save this quote as a note.
          </p>
          <input
            ref={newNotebookInputRef}
            className={styles.input}
            value={newNotebookName}
            onChange={(e) => setNewNotebookName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateNotebookFromEmpty()
            }}
            placeholder="notebook name"
            aria-label="notebook name"
          />
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleCreateNotebookFromEmpty}
              disabled={newNotebookName.trim().length === 0}
            >
              create notebook
            </button>
          </div>
        </div>
      )
    }

    if (stage.kind === 'notebook-select') {
      return (
        <div className={styles.body}>
          <p className={styles.stepLabel}>Step 1 of 2 · choose a notebook</p>
          <ul className={styles.list} role="listbox">
            {orderedNotebooks.map((nb) => {
              const isLast = nb.id === lastNotebookId
              const isPicked = nb.id === recentlyPickedNotebookId
              const cls = [styles.listItem]
              if (isLast) cls.push(styles.listItemHighlight)
              if (isPicked) cls.push(styles.listItemPicked)
              return (
                <li key={nb.id}>
                  <button
                    type="button"
                    className={cls.join(' ')}
                    onClick={() => {
                      setRecentlyPickedNotebookId(nb.id)
                      setStage({ kind: 'note-select', notebookId: nb.id })
                    }}
                    aria-selected={isPicked}
                  >
                    <span className={styles.listItemLabel}>{nb.name}</span>
                    {isLast && <span className={styles.pillLast}>Last used</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )
    }

    if (stage.kind === 'note-select') {
      const notebookId = stage.notebookId
      return (
        <div className={styles.body}>
          <div className={styles.breadcrumb}>
            <button
              type="button"
              className={styles.linkBack}
              onClick={() => setStage({ kind: 'notebook-select' })}
              aria-label="go back to notebook selection"
            >
              ← back
            </button>
            <span className={styles.breadcrumbName}>{selectedNotebookName}</span>
          </div>
          <p className={styles.stepLabel}>Step 2 of 2 · choose a note</p>
          <ul className={styles.list} role="listbox">
            <li>
              <button
                type="button"
                className={`${styles.listItem} ${styles.listItemCreate}`}
                onClick={() => setStage({ kind: 'new-note-title', notebookId })}
              >
                <span className={styles.listItemLabel}>+ Create new note</span>
              </button>
            </li>
            {notesOfSelected.length === 0 ? (
              <li className={styles.muted}>This notebook has no notes yet.</li>
            ) : (
              notesOfSelected.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={styles.listItem}
                    onClick={() => void appendToExistingNote(notebookId, n)}
                  >
                    <span className={styles.listItemLabel}>
                      {n.title.trim() || 'untitled'}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )
    }

    if (stage.kind === 'new-note-title') {
      const notebookId = stage.notebookId
      return (
        <div className={styles.body}>
          <div className={styles.breadcrumb}>
            <button
              type="button"
              className={styles.linkBack}
              onClick={() => {
                setNewNoteTitle('')
                setTitleError(null)
                setStage({ kind: 'note-select', notebookId })
              }}
              aria-label="cancel note creation"
            >
              ← back
            </button>
            <span className={styles.breadcrumbName}>{selectedNotebookName}</span>
          </div>
          <p className={styles.stepLabel}>New note title</p>
          <input
            ref={newNoteTitleInputRef}
            className={styles.input}
            value={newNoteTitle}
            onChange={(e) => {
              setNewNoteTitle(e.target.value)
              if (titleError) setTitleError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmNewNoteTitle(notebookId)
            }}
            placeholder="e.g.: Quotes from this book"
            aria-label="new note title"
            aria-invalid={!!titleError}
          />
          {titleError && (
            <p className={styles.errorMsg} role="alert">
              {titleError}
            </p>
          )}
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setNewNoteTitle('')
                setTitleError(null)
                setStage({ kind: 'note-select', notebookId })
              }}
            >
              cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => handleConfirmNewNoteTitle(notebookId)}
            >
              create and save
            </button>
          </div>
        </div>
      )
    }

    if (stage.kind === 'saving') {
      return (
        <div className={styles.body}>
          <p className={styles.stepLabel}>Saving...</p>
          <div className={styles.savingDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )
    }

    if (stage.kind === 'success') {
      return (
        <div className={styles.body}>
          <p className={styles.successTitle}>Quote saved</p>
          <p className={styles.successHelp}>
            Added to{' '}
            <span className={styles.targetNotebook}>{stage.notebookName}</span>
            {' / '}
            <span className={styles.targetNote}>{stage.noteTitle}</span>.
          </p>
          {stage.truncated && (
            <p className={styles.errorMsg}>
              Excerpt truncated for the blockquote.
            </p>
          )}
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      )
    }

    if (stage.kind === 'error') {
      return (
        <div className={styles.body}>
          <p className={styles.errorTitle}>Could not save</p>
          <p className={styles.errorBody}>{stage.message}</p>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={stage.retry}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Copy quote to a note"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Copy quote to note</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="close"
          >
            ×
          </button>
        </header>
        {renderStage()}
      </div>
    </div>,
    document.body,
  )
}
