import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from '@phosphor-icons/react'
import type { Book, Note, NoteType, Notebook, VocabularyItem } from '../../types'
import { resolveLinkedNote } from '../../lib/bookQuotes'
import { getUserLocale, getVocabSendTranslation } from '../../lib/languageSettings'
import { buildVocabularyNoteBlock, noteDateLabel } from '../../lib/vocabulary'
import { defaultNotebooks, vocabularyNoteTitle } from '../../lib/vocabularyDestination'
import { QuoteToNoteModal, loadLastNotebookId } from '../Reader/QuoteToNoteModal'
import styles from './SendVocabularyModal.module.css'

// Para onde vai o envio: uma nota nova de vocabulário no caderno, ou uma nota que
// já existe (a vinculada ao livro, ou a escolhida pelo modal de citação).
export type VocabularyDestinationChoice =
  | { kind: 'new'; notebookId: string }
  | { kind: 'note'; note: Note }

export interface SendVocabularyModalProps {
  book: Book
  // O que seria enviado agora (os marcados ou os novos); vazio quando o modal só
  // serve para trocar o destino.
  items: VocabularyItem[]
  notebooks: Notebook[]
  notes: Note[]
  noteTypes: NoteType[]
  // O destino lembrado do livro, quando a nota ainda existe: o "Change" abre nele,
  // e não numa nota nova.
  current: Note | null
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (
    notebookId: string,
    title: string,
    content: string,
    requestId?: string,
    typeId?: string | null,
  ) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  onConfirm: (choice: VocabularyDestinationChoice, includeTranslation: boolean) => void
  onClose: () => void
}

type Option = 'new' | 'current' | 'linked' | 'picked'

function noteLabel(note: Note, notebooks: Notebook[]): string {
  const notebook = notebooks.find((nb) => nb.id === note.notebookId)
  const title = note.title.trim() || 'Untitled'
  return notebook ? `${notebook.name} · ${title}` : title
}

// "Send vocabulary to a note": o destino (nota nova, a nota do livro, ou uma
// escolhida nos dois passos do modal de citação), a tradução e uma prévia do
// bloco. O destino escolhido fica lembrado por livro.
export function SendVocabularyModal({
  book,
  items,
  notebooks,
  notes,
  noteTypes,
  current,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
  onConfirm,
  onClose,
}: SendVocabularyModalProps) {
  const linkedNote = useMemo(() => resolveLinkedNote(book.id, notes), [book.id, notes])
  // Onde uma nota nova pode nascer: nunca no Calendar, que costuma ser o primeiro da lista.
  const choices = useMemo(() => defaultNotebooks(notebooks), [notebooks])
  const [notebookId, setNotebookId] = useState(() => {
    const last = loadLastNotebookId()
    const candidates = [linkedNote?.notebookId, last]
    for (const id of candidates) {
      if (id && choices.some((nb) => nb.id === id)) return id
    }
    return choices[0]?.id ?? ''
  })
  const [picked, setPicked] = useState<Note | null>(null)
  // O destino de agora já marcado, para "Change" e "Send" não criarem uma segunda
  // nota de vocabulário; a do livro quando é a mesma nota.
  const separateCurrent = current && current.id !== linkedNote?.id ? current : null
  const [option, setOption] = useState<Option>(() => {
    if (separateCurrent) return 'current'
    if (current) return 'linked'
    return choices.length > 0 ? 'new' : linkedNote ? 'linked' : 'picked'
  })
  const [withTranslation, setWithTranslation] = useState(getVocabSendTranslation)
  const [picking, setPicking] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // O foco entra no modal (e volta a ele depois do seletor de nota): é o que
  // mantém as teclas do leitor longe daqui e o Esc funcionando.
  useEffect(() => {
    if (!picking) rootRef.current?.focus()
  }, [picking])

  const dateLabel = useMemo(() => noteDateLabel(new Date(), getUserLocale()), [])
  const preview = useMemo(
    () => buildVocabularyNoteBlock(items, book.title, withTranslation, dateLabel),
    [items, book.title, withTranslation, dateLabel],
  )

  const choice: VocabularyDestinationChoice | null =
    option === 'new'
      ? notebookId
        ? { kind: 'new', notebookId }
        : null
      : option === 'current'
        ? separateCurrent
          ? { kind: 'note', note: separateCurrent }
          : null
        : option === 'linked'
          ? linkedNote
            ? { kind: 'note', note: linkedNote }
            : null
          : picked
            ? { kind: 'note', note: picked }
            : null

  const canSend = choice !== null

  return createPortal(
    <>
      {!picking && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Send vocabulary to a note"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
          // As teclas do leitor (Espaço, R, T…) não agem com o modal aberto.
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') onClose()
          }}
        >
          <div className={styles.modal} ref={rootRef} tabIndex={-1}>
            <header className={styles.header}>
              <h2 className={styles.title}>Send vocabulary to a note</h2>
              <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                <X size={14} aria-hidden />
              </button>
            </header>

            <div className={styles.body}>
              <p className={styles.step}>Send to</p>
              <div className={styles.options} role="radiogroup" aria-label="Destination">
                <div className={`${styles.option} ${option === 'new' ? styles.optionOn : ''}`}>
                  <label className={styles.optionLabel}>
                    <input
                      type="radio"
                      name="vocab-destination"
                      checked={option === 'new'}
                      disabled={choices.length === 0}
                      onChange={() => setOption('new')}
                    />
                    <Plus size={13} aria-hidden />
                    <span className={styles.optionText}>
                      New note: {vocabularyNoteTitle(book.title)}
                    </span>
                  </label>
                  {choices.length > 0 ? (
                    <div className={styles.optionSub}>
                      in
                      <select
                        className={styles.select}
                        value={notebookId}
                        onChange={(e) => {
                          setNotebookId(e.target.value)
                          setOption('new')
                        }}
                        aria-label="Notebook for the new note"
                      >
                        {choices.map((nb) => (
                          <option key={nb.id} value={nb.id}>
                            {nb.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className={styles.optionSub}>No notebook for a new note yet.</div>
                  )}
                </div>

                {separateCurrent && (
                  <div className={`${styles.option} ${option === 'current' ? styles.optionOn : ''}`}>
                    <label className={styles.optionLabel}>
                      <input
                        type="radio"
                        name="vocab-destination"
                        checked={option === 'current'}
                        onChange={() => setOption('current')}
                      />
                      <span className={styles.optionText}>
                        Current destination: {separateCurrent.title.trim() || 'Untitled'}
                      </span>
                    </label>
                    <div className={styles.optionSub}>{noteLabel(separateCurrent, notebooks)}</div>
                  </div>
                )}

                {linkedNote && (
                  <div className={`${styles.option} ${option === 'linked' ? styles.optionOn : ''}`}>
                    <label className={styles.optionLabel}>
                      <input
                        type="radio"
                        name="vocab-destination"
                        checked={option === 'linked'}
                        onChange={() => setOption('linked')}
                      />
                      <span className={styles.optionText}>
                        The book&apos;s note: {linkedNote.title.trim() || 'Untitled'}
                      </span>
                    </label>
                    <div className={styles.optionSub}>
                      {noteLabel(linkedNote, notebooks)} · linked to this book
                    </div>
                  </div>
                )}

                <div className={`${styles.option} ${option === 'picked' ? styles.optionOn : ''}`}>
                  <label className={styles.optionLabel}>
                    <input
                      type="radio"
                      name="vocab-destination"
                      checked={option === 'picked'}
                      // Escolher de novo também abre o seletor, mesmo já marcado.
                      onClick={() => setPicking(true)}
                      onChange={() => setOption('picked')}
                    />
                    <span className={styles.optionText}>
                      {picked ? noteLabel(picked, notebooks) : 'Choose notebook and note…'}
                    </span>
                  </label>
                  {picked && <div className={styles.optionSub}>Click to choose another note</div>}
                </div>
              </div>

              <p className={styles.step}>Translation</p>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={withTranslation}
                  onChange={(e) => setWithTranslation(e.target.checked)}
                />
                Include the translation (collapsed)
              </label>
              <p className={styles.help}>
                Only items you translated have one. The note shows the word and its sentence; the
                translation stays one click away.
              </p>

              <p className={styles.step}>
                {items.length > 0
                  ? `In the note (${items.length} ${items.length === 1 ? 'item' : 'items'})`
                  : 'In the note'}
              </p>
              {items.length > 0 ? (
                <pre className={styles.preview}>{preview}</pre>
              ) : (
                <p className={styles.help}>
                  Nothing new to send now. The destination is remembered for the next time.
                </p>
              )}
            </div>

            <footer className={styles.footer}>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={!canSend}
                onClick={() => choice && onConfirm(choice, withTranslation)}
              >
                {items.length > 0 ? 'Send' : 'Save destination'}
              </button>
            </footer>
          </div>
        </div>
      )}
      {picking && (
        <QuoteToNoteModal
          open
          notebooks={notebooks}
          notes={notes}
          noteTypes={noteTypes}
          onCreateNotebook={onCreateNotebook}
          onCreateNote={onCreateNote}
          onSaveNote={onSaveNote}
          onPickDestination={(_notebookId, note) => {
            setPicked(note)
            setOption('picked')
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>,
    document.body,
  )
}
