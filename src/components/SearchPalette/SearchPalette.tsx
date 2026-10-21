import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { X } from '@phosphor-icons/react'
import { CALENDAR_NOTEBOOK_ID } from '../../lib/calendar'
import { notesFolderDocId } from '../../lib/documents'
import {
  normalizeSearch,
  parseSearchQuery,
  recentNotes,
  searchNotes,
  searchTasks,
  typeToken,
  type NoteSearchResult,
} from '../../lib/noteSearch'
import { RAG_REWRITE_MODEL_KEY, ragRetrieve } from '../../lib/rag'
import { isOpen, isTaskBodyNote, statusColor, statusName, todosTitleOf, type TodosInfo } from '../../lib/tasks'
import type { Note, Notebook, NoteType, Task, TaskStatusDef } from '../../types'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import styles from './SearchPalette.module.css'

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  onSelectNote: (notebookId: string, noteId: string, subjectId?: string | null) => void
  onSelectNotebook?: (notebookId: string) => void
  onSelectTask: (taskId: string) => void
  notebooks?: Notebook[]
  notes: Note[]
  noteTypes: NoteType[]
  tasks: Task[]
  todosById: Map<string, TodosInfo>
  statuses: TaskStatusDef[]
  // "Search by meaning" (RAG): só com chave e fora dos cadernos com IA desligada.
  hasApiKey: boolean
  disabledNotebookIds: Set<string>
}

interface MeaningHit {
  note: Note
  excerpt: string
}

type SearchResult =
  | { kind: 'notebook'; notebook: Notebook }
  | ({ kind: 'note' } & NoteSearchResult)
  | { kind: 'task'; task: Task }
  | { kind: 'meaning' }
  | ({ kind: 'meaningNote' } & MeaningHit)

// Resultado do RAG da consulta `key` (filtros + texto); outra consulta descarta.
interface MeaningState {
  key: string
  status: 'loading' | 'done' | 'error'
  hits: MeaningHit[]
  error: string | null
}

const MAX_NOTEBOOKS = 3
const MEANING_MIN_CHARS = 3
const MEANING_EXCERPT_CHARS = 120

function noteLabel(note: Note): string | null {
  if (note.notebookId === CALENDAR_NOTEBOOK_ID) return 'Daily'
  if (isTaskBodyNote(note)) return 'Task'
  return null
}

// Consulta sem o token `raw` (chip removido).
function withoutToken(query: string, raw: string): string {
  const words = query.split(/\s+/).filter(Boolean)
  const i = words.indexOf(raw)
  if (i >= 0) words.splice(i, 1)
  return words.join(' ')
}

export function SearchPalette({
  open,
  onClose,
  onSelectNote,
  onSelectNotebook,
  onSelectTask,
  notebooks = [],
  notes,
  noteTypes,
  tasks,
  todosById,
  statuses,
  hasApiKey,
  disabledNotebookIds,
}: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [meaning, setMeaning] = useState<MeaningState | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Rola o item selecionado para a vista só quando a seleção vem do teclado
  // (ou do reset da lista), não do hover.
  const scrollToSelectedRef = useRef(false)
  const meaningRequestRef = useRef(0)
  // Enter antes do debounce: abre o 1º resultado da consulta digitada.
  const enterPendingRef = useRef(false)

  const notebookMap = new Map(notebooks.map((nb) => [nb.id, nb.name]))
  // Nota sem caderno (Reader) não abre pela palette.
  const searchable = useMemo(() => notes.filter((n) => n.notebookId), [notes])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebounced('')
      setSelectedIndex(0)
      setMeaning(null)
      meaningRequestRef.current++
    } else {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 100)
    return () => clearTimeout(timer)
  }, [query])

  // Chips seguem o input na hora; a lista segue a consulta com debounce.
  const liveParsed = useMemo(() => parseSearchQuery(query, notebooks, noteTypes), [query, notebooks, noteTypes])
  const parsed = useMemo(() => parseSearchQuery(debounced, notebooks, noteTypes), [debounced, notebooks, noteTypes])
  const text = parsed.text.trim()
  const hasFilters = parsed.notebookId !== null || parsed.typeId !== null

  const results = useMemo<SearchResult[]>(() => {
    if (!open) return []
    if (!text && !hasFilters) return recentNotes(searchable).map((r) => ({ kind: 'note', ...r }))
    const q = normalizeSearch(text)
    const matchingNotebooks: SearchResult[] =
      hasFilters || !q
        ? []
        : notebooks
            .filter((nb) => normalizeSearch(nb.name).startsWith(q))
            .slice(0, MAX_NOTEBOOKS)
            .map((nb) => ({ kind: 'notebook', notebook: nb }))
    // Tipo de nota filtra só notas: com `type:` a seção de tasks some.
    const foundTasks = parsed.typeId ? [] : searchTasks(tasks, text, todosById, { notebookId: parsed.notebookId })
    // A nota-corpo de uma task listada não repete na seção de notas.
    const taskNoteIds = new Set(foundTasks.map((t) => t.noteId))
    const foundNotes: SearchResult[] = searchNotes(searchable, text, {
      notebookId: parsed.notebookId,
      typeId: parsed.typeId,
    })
      .filter((r) => !(isTaskBodyNote(r.note) && taskNoteIds.has(r.note.id)))
      .map((r) => ({ kind: 'note', ...r }))
    return [
      ...matchingNotebooks,
      ...foundNotes,
      ...foundTasks.map((task): SearchResult => ({ kind: 'task', task })),
    ]
  }, [open, searchable, notebooks, tasks, todosById, text, hasFilters, parsed.notebookId, parsed.typeId])

  // Escopo semântico: pastas de notas dos cadernos com IA ligada (só a do
  // `#Caderno`, se houver).
  const meaningScopeIds = useMemo(
    () =>
      notebooks
        .filter((nb) => !disabledNotebookIds.has(nb.id) && (!parsed.notebookId || nb.id === parsed.notebookId))
        .map((nb) => notesFolderDocId(nb.id)),
    [notebooks, disabledNotebookIds, parsed.notebookId]
  )
  const canSearchMeaning = hasApiKey && text.length >= MEANING_MIN_CHARS && meaningScopeIds.length > 0
  const meaningKey = `${parsed.notebookId ?? ''}|${parsed.typeId ?? ''}|${text}`
  const currentMeaning = meaning && meaning.key === meaningKey ? meaning : null
  const meaningKeyRef = useRef(meaningKey)
  meaningKeyRef.current = meaningKey

  const items = useMemo<SearchResult[]>(() => {
    if (!canSearchMeaning) return results
    if (currentMeaning?.status === 'done' && currentMeaning.hits.length > 0) {
      return [...results, ...currentMeaning.hits.map((h): SearchResult => ({ kind: 'meaningNote', ...h }))]
    }
    return [...results, { kind: 'meaning' }]
  }, [results, canSearchMeaning, currentMeaning])

  // A seleção volta ao topo quando a consulta muda, não num reload dos dados
  // (tasks de outra janela, index sync); só é limitada ao tamanho da lista.
  useEffect(() => {
    scrollToSelectedRef.current = true
    setSelectedIndex(0)
  }, [debounced])

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, items.length - 1)))
  }, [items.length])

  useEffect(() => {
    if (!scrollToSelectedRef.current) return
    scrollToSelectedRef.current = false
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, items])

  // Só por Enter/clique na linha "Search by meaning": nunca ao digitar.
  const runMeaningSearch = useCallback(async () => {
    const key = meaningKey
    const typeId = parsed.typeId
    const request = ++meaningRequestRef.current
    setMeaning({ key, status: 'loading', hits: [], error: null })
    try {
      const res = await ragRetrieve(
        { ids: meaningScopeIds, notebookId: null, excludeNoteId: null, includeAiFolders: false },
        text,
        [],
        localStorage.getItem(RAG_REWRITE_MODEL_KEY),
        { kinds: ['note'] }
      )
      if (meaningRequestRef.current !== request) return
      const byId = new Map(searchable.map((n) => [n.id, n]))
      const seen = new Set<string>()
      const hits: MeaningHit[] = []
      for (const c of res.selected) {
        // O resumo sintético das tasks do caderno não é uma nota.
        if (!c.documentId.startsWith('note:') || c.documentId.startsWith('note:tasks-')) continue
        const note = byId.get(c.documentId.slice('note:'.length))
        if (!note || seen.has(note.id) || (typeId && note.typeId !== typeId)) continue
        seen.add(note.id)
        // 1º chunk: pula o cabeçalho gerado (`# título`, Project:, Status:...).
        const headerEnd = c.chunkIndex === 0 && c.content.startsWith('# ') ? c.content.indexOf('\n\n') : -1
        const flat = (headerEnd >= 0 ? c.content.slice(headerEnd + 2) : c.content).replace(/\s+/g, ' ').trim()
        const excerpt = flat.length > MEANING_EXCERPT_CHARS ? `${flat.slice(0, MEANING_EXCERPT_CHARS)}…` : flat
        hits.push({ note, excerpt })
      }
      setMeaning({ key, status: 'done', hits, error: null })
      if (hits.length > 0 && meaningKeyRef.current === key) {
        // Seleção no primeiro resultado (a linha do gatilho dá lugar a eles).
        scrollToSelectedRef.current = true
        setSelectedIndex(results.length)
      }
    } catch (err) {
      if (meaningRequestRef.current !== request) return
      console.warn('search by meaning failed:', err)
      setMeaning({ key, status: 'error', hits: [], error: err instanceof Error ? err.message : String(err) })
    }
  }, [meaningKey, parsed.typeId, meaningScopeIds, text, searchable, results.length])

  const selectResult = useCallback((result: SearchResult) => {
    if (result.kind === 'meaning') {
      if (!currentMeaning || currentMeaning.status === 'error') void runMeaningSearch()
      return
    }
    if (result.kind === 'notebook') {
      onSelectNotebook?.(result.notebook.id)
    } else if (result.kind === 'task') {
      onSelectTask(result.task.id)
    } else {
      const note = result.note
      if (note.notebookId) {
        onSelectNote(note.notebookId, note.id, note.subjectId)
      }
    }
    onClose()
  }, [onSelectNotebook, onSelectNote, onSelectTask, onClose, currentMeaning, runMeaningSearch])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        scrollToSelectedRef.current = true
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        scrollToSelectedRef.current = true
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (query !== debounced) {
          enterPendingRef.current = true
          setDebounced(query)
          return
        }
        const result = items[selectedIndex]
        if (result) selectResult(result)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [open, items, selectedIndex, onClose, selectResult, query, debounced])

  useEffect(() => {
    if (!enterPendingRef.current || query !== debounced) return
    enterPendingRef.current = false
    const result = items[0]
    if (result) selectResult(result)
  }, [items, query, debounced, selectResult])

  const removeChip = (raw: string) => {
    setQuery((q) => withoutToken(q, raw))
    inputRef.current?.focus()
  }

  // Chip de tipo alterna `type:<nome>` no texto (um tipo por vez).
  const toggleType = (type: NoteType) => {
    const active = liveParsed.chips.find((c) => c.kind === 'type')
    let next = active ? withoutToken(query, active.raw) : query.trim()
    if (liveParsed.typeId !== type.id) next = `${next} ${typeToken(type)}`.trim()
    setQuery(next ? `${next} ` : '')
    inputRef.current?.focus()
  }

  if (!open) return null

  const showRecent = !text && !hasFilters && results.length > 0
  const notebookChip = liveParsed.chips.find((c) => c.kind === 'notebook')

  const meaningLabel = !currentMeaning
    ? `Search by meaning: '${text}'`
    : currentMeaning.status === 'loading'
      ? 'Searching…'
      : currentMeaning.status === 'error'
        ? `Search by meaning failed: ${currentMeaning.error ?? 'unknown error'}`
        : 'Nothing found by meaning'

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Search… (#notebook, type:TODOS)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(notebookChip || noteTypes.length > 0) && (
          <div className={styles.chips}>
            {notebookChip && (
              <button
                type="button"
                className={`${styles.chip} ${styles.chipActive}`}
                title="Remove notebook filter"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeChip(notebookChip.raw)}
              >
                <span>#{notebookChip.label}</span>
                <X size={10} aria-hidden />
              </button>
            )}
            {noteTypes.map((t) => {
              const active = liveParsed.typeId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.chip} ${styles.typeChip} ${active ? styles.chipActive : ''}`}
                  style={t.color ? ({ '--type-color': t.color } as CSSProperties) : undefined}
                  title={active ? 'Remove type filter' : `Only ${t.name} notes`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleType(t)}
                >
                  <TypeIcon name={t.icon} size={11} />
                  <span>{t.name}</span>
                  {active && <X size={10} aria-hidden />}
                </button>
              )
            })}
          </div>
        )}
        <div ref={listRef} className={styles.list}>
          {results.length === 0 && (text || hasFilters) && (
            <div className={styles.empty}>No results found</div>
          )}
          {showRecent && <div className={styles.sectionHeader}>Recent</div>}
          {items.map((result, i) => {
            const prev = items[i - 1]
            const header =
              result.kind === 'task' && prev?.kind !== 'task'
                ? 'Tasks'
                : result.kind === 'meaningNote' && prev?.kind !== 'meaningNote'
                  ? 'By meaning'
                  : null
            const className = `${styles.item} ${i === selectedIndex ? styles.itemActive : ''}`
            const itemProps = {
              'data-index': i,
              className,
              onMouseEnter: () => setSelectedIndex(i),
              // Sem tirar o foco do input (a linha "Search by meaning" não fecha a palette).
              onMouseDown: (e: MouseEvent) => {
                e.preventDefault()
                selectResult(result)
              },
            }
            let body
            let key: string
            if (result.kind === 'notebook') {
              key = `nb-${result.notebook.id}`
              body = (
                <div {...itemProps}>
                  <div className={styles.itemNotebook}>Notebook</div>
                  <div className={styles.itemTitle}>{result.notebook.name}</div>
                </div>
              )
            } else if (result.kind === 'task') {
              const task = result.task
              const todosTitle = todosTitleOf(task, todosById)
              key = `task-${task.id}`
              body = (
                <div {...itemProps}>
                  {notebookMap.has(task.notebookId) && (
                    <div className={styles.itemNotebook}>{notebookMap.get(task.notebookId)}</div>
                  )}
                  <div className={styles.itemTitleRow}>
                    <span
                      className={styles.statusDot}
                      style={{ background: statusColor(task.status, statuses) }}
                      title={statusName(task.status, statuses)}
                    />
                    <div className={`${styles.itemTitle} ${isOpen(task) ? '' : styles.itemClosed}`}>
                      {task.title || 'Untitled'}
                    </div>
                    {todosTitle && <span className={styles.itemMeta}>TODOS {todosTitle}</span>}
                  </div>
                </div>
              )
            } else if (result.kind === 'meaning') {
              key = 'meaning'
              body = (
                <div {...itemProps}>
                  <div className={`${styles.itemPreview} ${styles.meaningLine}`}>{meaningLabel}</div>
                </div>
              )
            } else {
              const note = result.note
              const label = noteLabel(note)
              key = `${result.kind}-${note.id}`
              body = (
                <div {...itemProps}>
                  {note.notebookId && notebookMap.has(note.notebookId) && (
                    <div className={styles.itemNotebook}>{notebookMap.get(note.notebookId)}</div>
                  )}
                  <div className={styles.itemTitleRow}>
                    <div className={styles.itemTitle}>{note.title || 'Untitled'}</div>
                    {label && <span className={styles.itemLabel}>{label}</span>}
                  </div>
                  {result.kind === 'meaningNote' ? (
                    result.excerpt && <div className={styles.itemPreview}>{result.excerpt}</div>
                  ) : (
                    result.snippet && (
                      <div className={styles.itemPreview}>
                        {result.snippet.before}
                        {result.snippet.match && <mark className={styles.match}>{result.snippet.match}</mark>}
                        {result.snippet.after}
                      </div>
                    )
                  )}
                </div>
              )
            }
            return (
              <Fragment key={key}>
                {header && <div className={styles.sectionHeader}>{header}</div>}
                {body}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
