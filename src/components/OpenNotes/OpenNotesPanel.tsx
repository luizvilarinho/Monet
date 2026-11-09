import { useMemo } from 'react'
import { SquareSplitHorizontal, X } from '@phosphor-icons/react'
import { notePreview } from '../../lib/noteSearch'
import type { Note, NoteType } from '../../types'
import { TypeEyebrow } from '../NoteTypes/TypeEyebrow'
import styles from './OpenNotes.module.css'

export interface OpenNoteCard {
  note: Note
  notebookName: string
  type?: NoteType
  openedAt: number
}

interface OpenNotesPanelProps {
  cards: OpenNoteCard[]
  activeNoteId: string | null
  sideNoteId: string | null
  onOpen: (noteId: string) => void
  onOpenOnSide: (noteId: string) => void
  onRemove: (noteId: string) => void
}

function openedTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Aba Open: um card por nota aberta hoje, a mais recente primeiro, no formato
// dos cards do Related content (tipo, caderno, título, prévia e tags), em até
// duas colunas. Clique abre na área principal; "Side" abre na lateral (duas
// notas ao mesmo tempo).
export function OpenNotesPanel({
  cards,
  activeNoteId,
  sideNoteId,
  onOpen,
  onOpenOnSide,
  onRemove,
}: OpenNotesPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>Opened today</span>
        <span className={styles.hint}>
          <kbd>Alt</kbd>+<kbd>←</kbd> last note
        </span>
      </div>
      {cards.length === 0 ? (
        <p className={styles.empty}>Notes you open today show up here.</p>
      ) : (
        <ul className={styles.list}>
          {cards.map((card) => (
            <OpenNoteCardItem
              key={card.note.id}
              card={card}
              isActive={card.note.id === activeNoteId}
              isSide={card.note.id === sideNoteId}
              onOpen={onOpen}
              onOpenOnSide={onOpenOnSide}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface OpenNoteCardItemProps {
  card: OpenNoteCard
  isActive: boolean
  isSide: boolean
  onOpen: (noteId: string) => void
  onOpenOnSide: (noteId: string) => void
  onRemove: (noteId: string) => void
}

function OpenNoteCardItem({ card, isActive, isSide, onOpen, onOpenOnSide, onRemove }: OpenNoteCardItemProps) {
  const { note, notebookName, type, openedAt } = card
  // Só a nota que mudou recalcula a prévia (digitar na principal com a aba à
  // vista não reprocessa as outras).
  const preview = useMemo(() => notePreview(note), [note])
  // Estados primeiro: o fim da linha é cortado em card estreito.
  const state = [
    isActive ? 'Current' : null,
    isSide ? 'On the side' : null,
    note.archivedAt ? 'Archived' : null,
    openedTime(openedAt),
  ].filter(Boolean)
  return (
    <li className={isActive ? `${styles.card} ${styles.cardActive}` : styles.card}>
      <button
        type="button"
        className={styles.cardMain}
        onClick={() => onOpen(note.id)}
        aria-current={isActive ? 'page' : undefined}
      >
        {(type || notebookName) && (
          <span className={styles.cardMeta}>
            {type && <TypeEyebrow type={type} />}
            {notebookName && <span className={styles.cardNotebook}>{notebookName}</span>}
          </span>
        )}
        <span className={styles.cardTitle}>{note.title.trim() || 'Untitled'}</span>
        {preview && <span className={styles.cardSnippet}>{preview}</span>}
        {note.tags.length > 0 && (
          <span className={styles.cardTags}>
            {note.tags.map((t) => (
              <span key={t} className={styles.cardTag}>#{t}</span>
            ))}
          </span>
        )}
      </button>
      <div className={styles.cardFooter}>
        <span className={styles.cardState}>{state.join(' · ')}</span>
        <div className={styles.cardActions}>
          {!isActive && !isSide && (
            <button
              type="button"
              className={styles.sideButton}
              onClick={() => onOpenOnSide(note.id)}
              title="Open on the side"
            >
              <SquareSplitHorizontal size={12} />
              Side
            </button>
          )}
          {/* Sem X na nota atual: tirá-la da lista deixaria o Alt+← sem
              caminho de volta para ela. */}
          {!isActive && (
            <button
              type="button"
              className={`${styles.iconButton} ${styles.removeButton}`}
              onClick={() => onRemove(note.id)}
              aria-label="Remove from list"
              title="Remove from list"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
