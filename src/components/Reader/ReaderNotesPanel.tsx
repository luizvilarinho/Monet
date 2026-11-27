import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Sparkle, X } from '@phosphor-icons/react'
import type { Book, Note, NoteType, Notebook } from '../../types'
import type { NoteViewRequest } from '../../hooks/useBookQuotes'
import {
  getReaderNoteLink,
  setReaderNoteLink,
  unlinkBookFromReaderNote,
} from '../../lib/readerNoteLink'
import { collectNoteMarks, summarizeMarks } from '../../lib/noteMarks'
import { extractLastRetell, hasRetell } from '../../lib/retell'
import { Editor } from '../Editor/Editor'
import { NoteTypePicker } from '../NoteTypes/NoteTypePicker'
import type { ShowReaderToast } from './ReaderToast'
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
  // Tipos de nota (vêm da janela principal): o escolhido aqui vale para a
  // PRÓXIMA nota criada.
  noteTypes: NoteType[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  // `requestId` fica no 4º lugar (mesma assinatura do Chat) e o `typeId` no 5º.
  onCreateNote: (
    notebookId: string,
    title: string,
    content: string,
    requestId?: string,
    typeId?: string | null
  ) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  // Sobe quando o vínculo livro → nota muda fora daqui (checkbox do modal de
  // citação, "Open" de um toast): a aba relê o vínculo e mostra a nota.
  linkVersion: number
  // "Só mostrar esta nota" (o "Open" do envio de vocabulário): a aba exibe a nota
  // pedida sem trocar a vinculada ao livro. Sem pedido, a aba é a de sempre.
  viewRequest: NoteViewRequest | null
  open: boolean
  onClose: () => void
  // "Ask for feedback": manda o reconto da nota ao chat do leitor, com o professor
  // ligado. Só existe com as ferramentas de língua; a nota precisa ter um bloco de
  // Retell.
  onAskFeedback?: (retelling: string) => void
  showToast: ShowReaderToast
}

export function ReaderNotesPanel({
  book,
  notebooks,
  notes,
  noteTypes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
  linkVersion,
  viewRequest,
  open,
  onClose,
  onAskFeedback,
  showToast,
}: ReaderNotesPanelProps) {
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  // Tipo que será aplicado à próxima nota criada neste painel.
  const [pendingTypeId, setPendingTypeId] = useState<string | null>(null)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [notebookError, setNotebookError] = useState<string | null>(null)
  const notebookRestoreDoneRef = useRef(false)
  const noteRestoreDoneRef = useRef(false)
  const seenLinkVersionRef = useRef(linkVersion)
  // A nota que a aba mostra foi pedida só para ver e pode não ser a vinculada ao
  // livro (ver `viewingUnlinked`). Escolher caderno ou nota pelos seletores, criar
  // nota ou uma troca de vínculo fora da aba encerram isso.
  const [viewing, setViewing] = useState(false)
  const seenViewSeqRef = useRef(viewRequest?.seq ?? 0)

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
  // Rótulos de marca e tags já usados, como no editor da janela principal.
  const markLabels = useMemo(
    () => summarizeMarks(collectNoteMarks(notes).map((h) => h.entry)).labels.map((l) => l.label),
    [notes],
  )
  const tagSuggestions = useMemo(
    () => Array.from(new Set(notes.flatMap((n) => n.tags))).sort((a, b) => a.localeCompare(b)),
    [notes],
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

  // Vínculo trocado fora da aba: passa a mostrar a nota vinculada (e encerra
  // a restauração inicial, que leria o mesmo vínculo).
  useEffect(() => {
    if (linkVersion === seenLinkVersionRef.current) return
    seenLinkVersionRef.current = linkVersion
    const link = getReaderNoteLink(book.id)
    if (!link) return
    notebookRestoreDoneRef.current = true
    noteRestoreDoneRef.current = true
    setSelectedNotebookId(link.notebookId)
    setSelectedNoteId(link.noteId)
    setViewing(false)
  }, [linkVersion, book.id])

  // Pedido de "só mostrar" a nota (o "Open" do vocabulário): seleciona caderno e
  // nota sem gravar o vínculo, e encerra a restauração inicial.
  useEffect(() => {
    if (!viewRequest || viewRequest.seq === seenViewSeqRef.current) return
    seenViewSeqRef.current = viewRequest.seq
    notebookRestoreDoneRef.current = true
    noteRestoreDoneRef.current = true
    setSelectedNotebookId(viewRequest.notebookId)
    setSelectedNoteId(viewRequest.noteId)
    setViewing(true)
  }, [viewRequest])

  // A nota mostrada só para ver, e que não é a vinculada ao livro. O vínculo é lido
  // a cada render: ele muda pelos seletores, pelo modal de citação e pelo Retell.
  const linkedNoteId = viewing ? (getReaderNoteLink(book.id)?.noteId ?? null) : null
  const viewingUnlinked = viewing && selectedNoteId !== null && linkedNoteId !== selectedNoteId

  // Volta a mostrar a nota vinculada ao livro (ou nenhuma, se não há vínculo).
  const showLinked = useCallback(() => {
    setViewing(false)
    const link = getReaderNoteLink(book.id)
    setSelectedNotebookId(link?.notebookId ?? null)
    setSelectedNoteId(link?.noteId ?? null)
  }, [book.id])

  // Efeito C — recuperação "notebook apagado em outra sessão/janela". O caderno
  // de uma nota só vista não é o do vínculo: apagá-lo não apaga o vínculo.
  useEffect(() => {
    if (!selectedNotebookId) return
    if (notebooks.length === 0) return // guarda contra o mesmo race de carregamento
    if (notebooks.some((nb) => nb.id === selectedNotebookId)) return
    if (viewingUnlinked) {
      showLinked()
      return
    }
    setSelectedNotebookId(null)
    setSelectedNoteId(null)
    unlinkBookFromReaderNote(book.id)
  }, [notebooks, selectedNotebookId, book.id, viewingUnlinked, showLinked])

  // Efeito D — recuperação "nota apagada em outra sessão/janela ou dali mesmo".
  // Uma nota só vista que some (apagar a de vocabulário) volta à vinculada, sem
  // apagar o vínculo da nota do livro.
  useEffect(() => {
    if (!selectedNoteId) return
    if (notes.length === 0) return
    if (notes.some((n) => n.id === selectedNoteId)) return
    if (viewingUnlinked) {
      showLinked()
      return
    }
    setSelectedNoteId(null)
    if (selectedNotebookId) setReaderNoteLink(book.id, selectedNotebookId, null)
  }, [notes, selectedNoteId, selectedNotebookId, book.id, viewingUnlinked, showLinked])

  // O comentário lê o último reconto escrito na nota; sem texto, avisa o que falta.
  function handleAskFeedback() {
    if (!activeNote || !onAskFeedback) return
    const retelling = extractLastRetell(activeNote.content)
    if (!retelling) {
      showToast({ message: 'Write your retelling below the word list first.' })
      return
    }
    onAskFeedback(retelling)
  }

  function handleSelectNotebook(id: string) {
    setViewing(false)
    setSelectedNotebookId(id)
    setSelectedNoteId(null)
    setReaderNoteLink(book.id, id, null)
  }

  function handleSelectNote(id: string) {
    setViewing(false)
    setSelectedNoteId(id)
    if (selectedNotebookId) setReaderNoteLink(book.id, selectedNotebookId, id)
  }

  // Primeiro caderno criado aqui mesmo, sem sair do livro.
  async function handleCreateNotebook() {
    const name = newNotebookName.trim()
    if (!name) return
    setNotebookError(null)
    try {
      const nb = await onCreateNotebook(name)
      setNewNotebookName('')
      handleSelectNotebook(nb.id)
    } catch (err) {
      console.error('reader: failed to create notebook', err)
      setNotebookError("Couldn't create the notebook. Try again.")
    }
  }

  async function handleCreateNote() {
    if (!selectedNotebookId) return
    // O 4º parâmetro é o `requestId` (a assinatura do Chat) — aqui não existe.
    const note = await onCreateNote(selectedNotebookId, '', '', undefined, pendingTypeId)
    setViewing(false)
    setSelectedNoteId(note.id)
    setReaderNoteLink(book.id, selectedNotebookId, note.id)
  }

  // Não é necessário nenhum flush/debounce ao trocar de livro: onSaveNote já
  // grava a cada chamada (upsert idempotente, sem debounce em nenhum lugar do
  // app hoje) e o Reader é desmontado/remontado inteiro a cada troca de livro.
  function handleUpdateActive(patch: Partial<Note>) {
    if (!activeNote) return
    onSaveNote({ ...activeNote, ...patch, updatedAt: Date.now() }).catch((err) =>
      console.error('reader: failed to save note', err)
    )
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
        {onAskFeedback && activeNote && hasRetell(activeNote.content) && (
          <button
            type="button"
            className={styles.feedbackBtn}
            onClick={handleAskFeedback}
            title="Send your last retelling to the chat, with the Language teacher on. The AI comments and doesn't rewrite it."
          >
            <Sparkle size={12} aria-hidden />
            Ask for feedback
          </button>
        )}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close notes panel"
          title="Close"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {viewingUnlinked && (
        <div className={styles.unlinkedBar} role="status">
          <span>Not linked to this book</span>
          {getReaderNoteLink(book.id) && (
            <button type="button" className={styles.unlinkedBack} onClick={showLinked}>
              Back to the book&apos;s note
            </button>
          )}
        </div>
      )}

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
        <div className={styles.createNotebook}>
          <p className={styles.createNotebookHelp}>
            You have no notebooks yet. Create one to start taking notes here.
          </p>
          <input
            className={styles.createNotebookInput}
            value={newNotebookName}
            onChange={(e) => setNewNotebookName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateNotebook()
            }}
            placeholder="Notebook name"
            aria-label="Notebook name"
          />
          <button
            type="button"
            className={styles.newNoteBtn}
            onClick={() => void handleCreateNotebook()}
            disabled={newNotebookName.trim().length === 0}
          >
            <Plus size={12} aria-hidden />
            New notebook
          </button>
          {notebookError && (
            <p className={styles.createNotebookError} role="alert">
              {notebookError}
            </p>
          )}
        </div>
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
                  {n.title.trim() || 'Untitled'}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.newNoteBtn}
              onClick={() => void handleCreateNote()}
            >
              <Plus size={12} aria-hidden />
              New note
            </button>
            {/* Tipo da PRÓXIMA nota criada (o que já existe fica com o tipo
                que tem). Sem "Manage types…": os tipos se gerenciam na janela
                principal. */}
            <NoteTypePicker
              types={noteTypes}
              type={noteTypes.find((t) => t.id === pendingTypeId) ?? null}
              onChange={(id) => setPendingTypeId(id)}
            />
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
                disableBlockHandles
                disableRelatedTerms
                markLabels={markLabels}
                tagSuggestions={tagSuggestions}
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
