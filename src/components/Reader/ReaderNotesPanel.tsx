import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Book, Note, Notebook } from '../../types'
import {
  getReaderNoteLink,
  setReaderNoteLink,
  unlinkBookFromReaderNote,
} from '../../lib/readerNoteLink'
import { Editor } from '../Editor/Editor'
import styles from './ReaderNotesPanel.module.css'

// Aba "Notes" da coluna lateral do Reader, no mesmo padrão SEMPRE MONTADO do
// ReaderChatPanel (escondido via CSS quando `open` é false). Permite
// selecionar Notebook → Nota (ou criar uma nova) e editar com o Editor
// completo, sem slash commands. O vínculo livro→nota é persistido em
// localStorage (monet:reader-book-note-link) e restaurado ao reabrir o
// livro — sem cascade delete de nota/notebook (ver src/lib/readerNoteLink.ts).

// Largura da coluna, redimensionável por arrasto — mesma chave do
// ReaderChatPanel (largura inicial coerente entre as duas abas), mas com
// estado próprio e independente (não sincroniza ao vivo entre abas).
const WIDTH_KEY = 'monet:reader-chat-width'
const MIN_WIDTH = 260
const MAX_WIDTH = 560
const DEFAULT_WIDTH = 340

interface ReaderNotesPanelProps {
  book: Book
  notebooks: Notebook[]
  notes: Note[]
  onCreateNote: (notebookId: string, title: string, content: string) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  open: boolean
  onClose: () => void
}

export function ReaderNotesPanel({
  book,
  notebooks,
  notes,
  onCreateNote,
  onSaveNote,
  open,
  onClose,
}: ReaderNotesPanelProps) {
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const notebookRestoreDoneRef = useRef(false)
  const noteRestoreDoneRef = useRef(false)

  // ─── Largura redimensionável (padrão do ReaderChatPanel) ────────────────
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(WIDTH_KEY) ?? '', 10)
    if (isNaN(saved)) return DEFAULT_WIDTH
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, saved))
  })
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)
  const currentWidthRef = useRef(width)

  useEffect(() => {
    currentWidthRef.current = width
  }, [width])

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = currentWidthRef.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const delta = startXRef.current - e.clientX
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta))
      currentWidthRef.current = next
      setWidth(next)
    }
    const onMouseUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(WIDTH_KEY, String(currentWidthRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const selectedNotebook = useMemo(
    () => notebooks.find((nb) => nb.id === selectedNotebookId) ?? null,
    [notebooks, selectedNotebookId],
  )
  const notesOfSelectedNotebook = useMemo(
    () => notes.filter((n) => n.notebookId === selectedNotebookId),
    [notes, selectedNotebookId],
  )
  // Derivado sempre a partir do prop `notes` (nunca uma cópia local): edições
  // feitas em outro lugar (ex. tela de Notebook) aparecem aqui automaticamente
  // e vice-versa — mesmo padrão de `activeNote` em src/App.tsx.
  const activeNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )

  // Efeito A — restaurar notebook vinculado ao livro (roda até completar uma
  // vez; guarda contra `notebooks` ainda carregando de forma assíncrona).
  useEffect(() => {
    if (notebookRestoreDoneRef.current) return
    const link = getReaderNoteLink(book.id)
    if (!link) {
      notebookRestoreDoneRef.current = true
      return
    }
    if (notebooks.length === 0) return // ainda carregando — tenta de novo no próximo render
    notebookRestoreDoneRef.current = true
    if (notebooks.some((nb) => nb.id === link.notebookId)) {
      setSelectedNotebookId(link.notebookId)
    } else {
      unlinkBookFromReaderNote(book.id)
    }
  }, [book.id, notebooks])

  // Efeito B — restaurar nota vinculada (só após o notebook estar selecionado).
  useEffect(() => {
    if (noteRestoreDoneRef.current) return
    if (!selectedNotebookId) return
    const link = getReaderNoteLink(book.id)
    if (!link || !link.noteId) {
      noteRestoreDoneRef.current = true
      return
    }
    if (notes.length === 0) return // ainda carregando
    noteRestoreDoneRef.current = true
    const noteExists = notes.some(
      (n) => n.id === link.noteId && n.notebookId === selectedNotebookId,
    )
    if (noteExists) {
      setSelectedNoteId(link.noteId)
    } else {
      setReaderNoteLink(book.id, selectedNotebookId, null)
    }
  }, [book.id, selectedNotebookId, notes])

  // Efeito C — recuperação "notebook apagado em outra sessão/janela".
  useEffect(() => {
    if (!selectedNotebookId) return
    if (notebooks.length === 0) return // guarda contra o mesmo race de carregamento
    if (notebooks.some((nb) => nb.id === selectedNotebookId)) return
    setSelectedNotebookId(null)
    setSelectedNoteId(null)
    unlinkBookFromReaderNote(book.id)
  }, [notebooks, selectedNotebookId, book.id])

  // Efeito D — recuperação "nota apagada em outra sessão/janela ou dali mesmo".
  useEffect(() => {
    if (!selectedNoteId) return
    if (notes.length === 0) return
    if (notes.some((n) => n.id === selectedNoteId)) return
    setSelectedNoteId(null)
    if (selectedNotebookId) setReaderNoteLink(book.id, selectedNotebookId, null)
  }, [notes, selectedNoteId, selectedNotebookId, book.id])

  function handleSelectNotebook(id: string) {
    setSelectedNotebookId(id)
    setSelectedNoteId(null)
    setReaderNoteLink(book.id, id, null)
  }

  function handleSelectNote(id: string) {
    setSelectedNoteId(id)
    if (selectedNotebookId) setReaderNoteLink(book.id, selectedNotebookId, id)
  }

  async function handleCreateNote() {
    if (!selectedNotebookId) return
    const note = await onCreateNote(selectedNotebookId, '', '')
    setSelectedNoteId(note.id)
    setReaderNoteLink(book.id, selectedNotebookId, note.id)
  }

  // Não é necessário nenhum flush/debounce ao trocar de livro: onSaveNote já
  // grava a cada chamada (upsert idempotente, sem debounce em nenhum lugar do
  // app hoje) e o Reader é desmontado/remontado inteiro a cada troca de livro.
  function handleUpdateActive(patch: Partial<Note>) {
    if (!activeNote) return
    void onSaveNote({ ...activeNote, ...patch, updatedAt: Date.now() })
  }

  return (
    <aside
      className={open ? styles.panel : `${styles.panel} ${styles.panelHidden}`}
      style={{ width }}
      aria-label="Book notes"
    >
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
      <div className={styles.header}>
        <h3 className={styles.title}>Notes</h3>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close notes panel"
        >
          ×
        </button>
      </div>

      <div className={styles.selectBar}>
        <select
          className={styles.select}
          value={selectedNotebookId ?? ''}
          onChange={(e) => {
            if (e.target.value) handleSelectNotebook(e.target.value)
          }}
          aria-label="Notebook"
          disabled={notebooks.length === 0}
        >
          <option value="" disabled>
            Select a notebook…
          </option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.name}
            </option>
          ))}
        </select>
      </div>

      {notebooks.length === 0 ? (
        <p className={styles.empty}>
          You have no notebooks yet. Create one in the Notebook screen to start
          taking notes here.
        </p>
      ) : !selectedNotebookId ? (
        <p className={styles.empty}>Select a notebook to see its notes.</p>
      ) : (
        <>
          <div className={styles.selectBar}>
            <select
              className={styles.select}
              value={activeNote?.id ?? ''}
              onChange={(e) => {
                if (e.target.value) handleSelectNote(e.target.value)
              }}
              aria-label="Note"
            >
              <option value="" disabled>
                Select a note…
              </option>
              {notesOfSelectedNotebook.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title.trim() || 'untitled'}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.newNoteBtn}
              onClick={() => void handleCreateNote()}
            >
              + New note
            </button>
          </div>

          <div className={styles.editorWrap}>
            {activeNote ? (
              <Editor
                key={activeNote.id}
                notebookName={selectedNotebook?.name}
                title={activeNote.title}
                onTitleChange={(v) => handleUpdateActive({ title: v })}
                tags={activeNote.tags}
                onTagsChange={(tags) => handleUpdateActive({ tags })}
                value={activeNote.content}
                onChange={(content) => handleUpdateActive({ content })}
                disableSlashCommands
              />
            ) : (
              <p className={styles.empty}>
                {notesOfSelectedNotebook.length === 0
                  ? 'This notebook has no notes yet. Create one to start writing.'
                  : 'Select a note to start editing.'}
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
