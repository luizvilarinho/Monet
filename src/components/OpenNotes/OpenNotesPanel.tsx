import { useMemo } from 'react'
import { ArrowCounterClockwise, Broom, Checks, SquareSplitHorizontal, X } from '@phosphor-icons/react'
import { notePreview } from '../../lib/noteSearch'
import type { OpenEntryKind } from '../../lib/openNotes'
import { isOpen, statusColor, statusName, todosTitleOf } from '../../lib/tasks'
import type { Note, NoteType, Task } from '../../types'
import { TypeEyebrow } from '../NoteTypes/TypeEyebrow'
import { useTasksEnv } from '../TasksView/TasksEnv'
import styles from './OpenNotes.module.css'

export type OpenCard =
  | { kind: 'note'; note: Note; notebookName: string; type?: NoteType; openedAt: number }
  | { kind: 'task'; task: Task; notebookName: string; openedAt: number }

interface OpenNotesPanelProps {
  cards: OpenCard[]
  activeNoteId: string | null
  activeTaskId: string | null
  sideNoteId: string | null
  onOpen: (noteId: string) => void
  onOpenTask: (taskId: string) => void
  onOpenOnSide: (noteId: string) => void
  onRemove: (kind: OpenEntryKind, id: string) => void
  // Há card além do aberto agora (o Clear all mantém o aberto).
  canClearAll: boolean
  onClearAll: () => void
  // Undo do Clear all, até a próxima abertura.
  canUndoClear: boolean
  onUndoClear: () => void
}

function openedTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Aba Open: um card por nota ou task aberta hoje, a mais recente primeiro, no
// formato dos cards do Related content (tipo, caderno, título, prévia e tags),
// em até duas colunas. Clique abre na área principal (a task, no modal); "Side"
// abre a nota na lateral (duas notas ao mesmo tempo).
export function OpenNotesPanel({
  cards,
  activeNoteId,
  activeTaskId,
  sideNoteId,
  onOpen,
  onOpenTask,
  onOpenOnSide,
  onRemove,
  canClearAll,
  onClearAll,
  canUndoClear,
  onUndoClear,
}: OpenNotesPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>Opened today</span>
        <div className={styles.headerActions}>
          <span className={styles.hint}>
            <kbd>Alt</kbd>+<kbd>←</kbd> last note
          </span>
          {canClearAll && (
            <button
              type="button"
              className={styles.textButton}
              onClick={onClearAll}
              title="Clear the list, except what is open now (notes and tasks are not deleted)"
            >
              <Broom size={12} aria-hidden />
              Clear all
            </button>
          )}
        </div>
      </div>
      {/* Com o card que ficou (o aberto no Clear all), o Undo vai acima dele. */}
      {canUndoClear && (
        <p className={cards.length > 0 ? styles.cleared : styles.empty}>
          List cleared.{' '}
          <button type="button" className={styles.textButton} onClick={onUndoClear}>
            <ArrowCounterClockwise size={12} aria-hidden />
            Undo
          </button>
        </p>
      )}
      {cards.length === 0 ? (
        !canUndoClear && <p className={styles.empty}>Notes and tasks you open today show up here.</p>
      ) : (
        <ul className={styles.list}>
          {cards.map((card) =>
            card.kind === 'task' ? (
              <OpenTaskCardItem
                key={`task-${card.task.id}`}
                card={card}
                isCurrent={card.task.id === activeTaskId}
                onOpenTask={onOpenTask}
                onRemove={onRemove}
              />
            ) : (
              <OpenNoteCardItem
                key={`note-${card.note.id}`}
                card={card}
                isActive={card.note.id === activeNoteId}
                isSide={card.note.id === sideNoteId}
                onOpen={onOpen}
                onOpenOnSide={onOpenOnSide}
                onRemove={onRemove}
              />
            )
          )}
        </ul>
      )}
    </div>
  )
}

interface OpenNoteCardItemProps {
  card: Extract<OpenCard, { kind: 'note' }>
  isActive: boolean
  isSide: boolean
  onOpen: (noteId: string) => void
  onOpenOnSide: (noteId: string) => void
  onRemove: (kind: OpenEntryKind, id: string) => void
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
              onClick={() => onRemove('note', note.id)}
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

interface OpenTaskCardItemProps {
  card: Extract<OpenCard, { kind: 'task' }>
  isCurrent: boolean
  onOpenTask: (taskId: string) => void
  onRemove: (kind: OpenEntryKind, id: string) => void
}

// Card da task: status, caderno, TODOS e título (riscado se fechada). Sem
// "Side": a nota-corpo não vai para a lateral. Com a nota-corpo já no editor,
// o clique não abre um segundo editor nela.
function OpenTaskCardItem({ card, isCurrent, onOpenTask, onRemove }: OpenTaskCardItemProps) {
  const { task, notebookName, openedAt } = card
  const { statuses, todosById } = useTasksEnv()
  const todos = todosTitleOf(task, todosById)
  const state = [isCurrent ? 'Current' : null, openedTime(openedAt)].filter(Boolean)
  return (
    <li className={isCurrent ? `${styles.card} ${styles.cardActive}` : styles.card}>
      <button
        type="button"
        className={styles.cardMain}
        onClick={() => {
          if (!isCurrent) onOpenTask(task.id)
        }}
        aria-current={isCurrent ? 'page' : undefined}
      >
        <span className={styles.cardMeta}>
          <span className={styles.statusDot} style={{ background: statusColor(task.status, statuses) }} aria-hidden />
          <span className={styles.cardStatus}>{statusName(task.status, statuses)}</span>
          {notebookName && <span className={styles.cardNotebook}>{notebookName}</span>}
        </span>
        {todos && (
          <span className={styles.cardTodos}>
            <Checks size={11} aria-hidden />
            <span>{todos}</span>
          </span>
        )}
        <span className={isOpen(task) ? styles.cardTitle : `${styles.cardTitle} ${styles.cardTitleClosed}`}>
          {task.title.trim() || 'Untitled'}
        </span>
      </button>
      <div className={styles.cardFooter}>
        <span className={styles.cardState}>{state.join(' · ')}</span>
        <div className={styles.cardActions}>
          {!isCurrent && (
            <button
              type="button"
              className={`${styles.iconButton} ${styles.removeButton}`}
              onClick={() => onRemove('task', task.id)}
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
