import { useEffect, useMemo, useState } from 'react'
import { Checks } from '@phosphor-icons/react'
import type { Note, Notebook, NoteType, Task } from '../../types'
import { scoreRelatedNotes } from './scoreNotes'
import { findTermLinkedNotes, relatedTermsKey, relatedTermsOf, type TermReason } from '../../lib/relatedTerms'
import { notePreview } from '../../lib/noteSearch'
import { isOpen, isTaskBodyNote, statusColor, statusName, taskRefIds, todosTitleOf } from '../../lib/tasks'
import { TypeEyebrow } from '../NoteTypes/TypeEyebrow'
import { useTasksEnv } from '../TasksView/TasksEnv'
import styles from './RelatedContent.module.css'

interface Props {
  activeNote: Note
  notes: Note[]
  notebooks: Notebook[]
  noteTypes: NoteType[]
  tasks: Task[]
  // Só o grupo dos termos, sem sugestões automáticas (nota diária).
  termsOnly?: boolean
  onSelect: (id: string) => void
  onSelectTask: (taskId: string) => void
}

// Notas do grupo dos termos visíveis antes do "Show N more".
const TERMS_VISIBLE = 8
// Notas do "Suggested" e tasks sugeridas (conteúdo parecido).
const SUGGESTED_VISIBLE = 5
// Tasks do grupo "Tasks" visíveis antes do "Show N more".
const TASKS_VISIBLE = 5
// Espera do termo editado antes de recalcular (digitar dentro de um termo).
const TERMS_DEBOUNCE_MS = 400

function reasonText(r: TermReason): string {
  return r.found ? `mentions "${r.term}" ≈ "${r.found}"` : `mentions "${r.term}"`
}

// Task achada pela nota-corpo: com os termos que a ligam à nota ativa, ou
// `null` quando veio das sugestões (conteúdo parecido).
interface TaskHit {
  task: Task
  reasons: TermReason[] | null
}

function mentionsTerm(reasons: TermReason[] | null, key: string): boolean {
  return !!reasons?.some((r) => r.key === key)
}

export function RelatedContent({
  activeNote,
  notes,
  notebooks,
  noteTypes,
  tasks,
  termsOnly = false,
  onSelect,
  onSelectTask,
}: Props) {
  const { statuses, todosById } = useTasksEnv()
  // Começa fechado: a lista ocupa muito espaço. O App remonta por nota
  // (key = id), então cada nota aberta volta fechada.
  const [open, setOpen] = useState(false)
  const [showAllTerms, setShowAllTerms] = useState(false)
  const [showAllTasks, setShowAllTasks] = useState(false)
  // Chip de termo ativo (RelatedTerm.key): o grupo e as tasks achadas por
  // termo mostram só as notas e tasks dele.
  const [termFilter, setTermFilter] = useState<string | null>(null)
  // Recalcula só quando a nota ativa muda, entra/sai uma nota ou mudam os
  // termos da nota ativa (com debounce), não a cada tecla: o cálculo passa
  // por todas as notas e travava a digitação.
  const notesKey = notes.map((n) => n.id).join('|')
  const termsKey = relatedTermsKey(activeNote)
  const [debouncedTermsKey, setDebouncedTermsKey] = useState(termsKey)
  useEffect(() => {
    if (termsKey === debouncedTermsKey) return
    const timer = setTimeout(() => setDebouncedTermsKey(termsKey), TERMS_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [termsKey, debouncedTermsKey])
  // Os termos da nota vêm junto das notas achadas, para os chips seguirem o
  // mesmo debounce.
  const { terms, termHits } = useMemo(
    () => ({ terms: relatedTermsOf(activeNote), termHits: findTermLinkedNotes(activeNote, notes) }),
    [activeNote.id, notesKey, debouncedTermsKey]
  )
  // Todos os pontuados (o corte é feito depois de tirar as notas-corpo).
  const scored = useMemo(
    () =>
      termsOnly
        ? []
        : scoreRelatedNotes(activeNote, notes, { exclude: new Set(termHits.map((h) => h.note.id)), topK: notes.length }),
    [activeNote.id, notesKey, termHits, termsOnly]
  )
  const refIds = useMemo(() => taskRefIds(activeNote.content), [activeNote.content])
  // Nota-corpo de task sai dos grupos de notas e entra como task no grupo
  // "Tasks", pelos mesmos dois cálculos. Ficam de fora as tasks da nota atual
  // (origem, TODOS ou pill nela). Entram todas as do termo e, como as notas do
  // "Suggested", só as primeiras sugeridas. Abertas primeiro; fechadas depois,
  // riscadas, como no Ctrl+P.
  const { noteTermHits, relatedNotes, taskHits } = useMemo(() => {
    const taskByNoteId = new Map<string, Task>()
    for (const task of tasks) if (task.noteId) taskByNoteId.set(task.noteId, task)
    const isBody = (note: Note) => isTaskBodyNote(note) || taskByNoteId.has(note.id)
    const seen = new Set<string>()
    const found: TaskHit[] = []
    const add = (note: Note, reasons: TermReason[] | null): boolean => {
      const task = taskByNoteId.get(note.id)
      if (!task || seen.has(task.id)) return false
      seen.add(task.id)
      if (task.sourceNoteId === activeNote.id || task.parentNoteId === activeNote.id || refIds.has(task.id)) return false
      found.push({ task, reasons })
      return true
    }
    for (const h of termHits) add(h.note, h.reasons)
    let suggested = 0
    for (const s of scored) {
      if (suggested === SUGGESTED_VISIBLE) break
      if (add(s.note, null)) suggested++
    }
    return {
      noteTermHits: termHits.filter((h) => !isBody(h.note)),
      relatedNotes: scored.filter((s) => !isBody(s.note)).slice(0, SUGGESTED_VISIBLE),
      taskHits: [...found.filter((h) => isOpen(h.task)), ...found.filter((h) => !isOpen(h.task))],
    }
  }, [termHits, scored, tasks, refIds, activeNote.id])
  // Notas e tasks por termo da nota ativa, inclusive os que não acham nenhuma.
  const termCounts = useMemo(
    () =>
      terms.map((term) => ({
        term,
        count:
          noteTermHits.filter((h) => mentionsTerm(h.reasons, term.key)).length +
          taskHits.filter((h) => mentionsTerm(h.reasons, term.key)).length,
      })),
    [terms, noteTermHits, taskHits]
  )
  const typeById = useMemo(() => new Map(noteTypes.map((t) => [t.id, t])), [noteTypes])

  // Com termo na nota, o painel aparece mesmo sem nenhuma nota achada.
  const showTermsGroup = terms.length > 0 || noteTermHits.length > 0
  if (!showTermsGroup && relatedNotes.length === 0 && taskHits.length === 0) return null

  // O filtro cai sozinho se o termo sai da nota ou fica sem notas e tasks.
  const filter = termCounts.some((c) => c.term.key === termFilter && c.count > 0) ? termFilter : null
  const shownTerms = filter ? noteTermHits.filter((h) => mentionsTerm(h.reasons, filter)) : noteTermHits
  const visibleTerms = showAllTerms ? shownTerms : shownTerms.slice(0, TERMS_VISIBLE)
  const hiddenTerms = shownTerms.length - visibleTerms.length
  // Com um chip ativo, das tasks achadas por termo ficam só as dele; as
  // sugeridas ficam, como as notas do "Suggested".
  const shownTasks = filter ? taskHits.filter((h) => !h.reasons || mentionsTerm(h.reasons, filter)) : taskHits
  const visibleTasks = showAllTasks ? shownTasks : shownTasks.slice(0, TASKS_VISIBLE)
  const hiddenTasks = shownTasks.length - visibleTasks.length

  const renderItem = (note: Note, reasons?: TermReason[]) => {
    const preview = notePreview(note)
    const notebookName = notebooks.find((n) => n.id === note.notebookId)?.name
    const type = note.typeId ? typeById.get(note.typeId) : undefined
    return (
      <li key={note.id} className={styles.item}>
        <button
          type="button"
          className={styles.itemButton}
          onClick={() => onSelect(note.id)}
        >
          {(type || notebookName) && (
            <div className={styles.itemMeta}>
              {type && <TypeEyebrow type={type} />}
              {notebookName && <span className={styles.itemNotebook}>{notebookName}</span>}
            </div>
          )}
          <div className={styles.itemTitle}>
            {note.title.trim() || 'Untitled'}
          </div>
          {reasons && reasons.length > 0 && (
            <div className={styles.itemReason}>{reasons.map(reasonText).join(' · ')}</div>
          )}
          {preview && <div className={styles.itemSnippet}>{preview}</div>}
          {note.tags.length > 0 && (
            <div className={styles.itemTags}>
              {note.tags.map((t) => (
                <span key={t} className={styles.itemTag}>#{t}</span>
              ))}
            </div>
          )}
        </button>
      </li>
    )
  }

  const renderTask = ({ task, reasons }: TaskHit) => {
    const notebookName = notebooks.find((n) => n.id === task.notebookId)?.name
    const todos = todosTitleOf(task, todosById)
    return (
      <li key={`task-${task.id}`} className={styles.item}>
        <button type="button" className={styles.itemButton} onClick={() => onSelectTask(task.id)}>
          <div className={styles.itemMeta}>
            <span
              className={styles.statusDot}
              style={{ background: statusColor(task.status, statuses) }}
              aria-hidden
            />
            <span className={styles.itemStatus}>{statusName(task.status, statuses)}</span>
            {notebookName && <span className={styles.itemNotebook}>{notebookName}</span>}
          </div>
          {todos && (
            <div className={styles.itemTodos}>
              <Checks size={11} aria-hidden />
              <span>{todos}</span>
            </div>
          )}
          <div className={isOpen(task) ? styles.itemTitle : `${styles.itemTitle} ${styles.itemClosed}`}>
            {task.title.trim() || 'Untitled'}
          </div>
          <div className={styles.itemReason}>{reasons ? reasons.map(reasonText).join(' · ') : 'similar content'}</div>
        </button>
      </li>
    )
  }

  return (
    <div className={styles.related}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
        <span className={styles.title}>Related content</span>
        <span className={styles.count}>{noteTermHits.length + relatedNotes.length + taskHits.length}</span>
      </button>
      {open && (
        <ul className={styles.list}>
          {showTermsGroup && <li className={styles.section}>Linked by terms</li>}
          {terms.length > 0 && (
            <li className={styles.termChips}>
              {termCounts.map(({ term, count }) => {
                const active = filter === term.key
                return (
                  <button
                    key={term.key}
                    type="button"
                    className={`${styles.termChip} ${active ? styles.termChipActive : ''}`}
                    aria-pressed={active}
                    aria-disabled={count === 0 || undefined}
                    title={
                      count === 0
                        ? 'No other note or task mentions this'
                        : active
                          ? 'Show all terms'
                          : `Only notes and tasks that mention "${term.text}"`
                    }
                    onClick={() => {
                      if (count === 0) return
                      setTermFilter(active ? null : term.key)
                      setShowAllTerms(false)
                      setShowAllTasks(false)
                    }}
                  >
                    <span className={styles.termChipText}>{term.text}</span>
                    <span className={styles.termChipCount}>{count}</span>
                  </button>
                )
              })}
            </li>
          )}
          {visibleTerms.map(({ note, reasons }) => renderItem(note, reasons))}
          {hiddenTerms > 0 && (
            <li className={styles.moreRow}>
              <button type="button" className={styles.more} onClick={() => setShowAllTerms(true)}>
                Show {hiddenTerms} more
              </button>
            </li>
          )}
          {showTermsGroup && relatedNotes.length > 0 && <li className={styles.section}>Suggested</li>}
          {relatedNotes.map(({ note }) => renderItem(note))}
          {visibleTasks.length > 0 && <li className={styles.section}>Tasks</li>}
          {visibleTasks.map(renderTask)}
          {hiddenTasks > 0 && (
            <li className={styles.moreRow}>
              <button type="button" className={styles.more} onClick={() => setShowAllTasks(true)}>
                Show {hiddenTasks} more
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
