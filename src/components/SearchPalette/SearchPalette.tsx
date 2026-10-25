import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Tag, X } from '@phosphor-icons/react'
import { CALENDAR_NOTEBOOK_ID } from '../../lib/calendar'
import { notesFolderDocId } from '../../lib/documents'
import { clipContextStart, type NoteMarkEntry } from '../../lib/noteMarks'
import {
  markLabelToken,
  normalizeSearch,
  parseSearchQuery,
  recentNotes,
  searchMarks,
  searchNotes,
  searchTasks,
  typeToken,
  type MarkSearchResult,
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
  // Marca (`has:mark`/`mark:`): abre a nota na marca.
  onSelectMark?: (note: Note, entry: NoteMarkEntry) => void
  onSelectNotebook?: (notebookId: string) => void
  onSelectTask: (taskId: string) => void
  notebooks?: Notebook[]
  notes: Note[]
  noteTypes: NoteType[]
  // Tags e rótulos de marca existentes (filtros `tag:` e `mark:`), os mais
  // usados primeiro nos rótulos.
  tags?: string[]
  markLabels?: string[]
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
  | ({ kind: 'mark' } & MarkSearchResult)
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
// Rótulos clicáveis na linha de chips quando o filtro de marcas está ligado.
const MAX_LABEL_CHIPS = 6
const NO_STRINGS: string[] = []

function noteLabel(note: Note): string | null {
  if (note.archivedAt) return 'archived'
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
  onSelectMark,
  onSelectNotebook,
  onSelectTask,
  notebooks = [],
  notes,
  noteTypes,
  tags = NO_STRINGS,
  markLabels = NO_STRINGS,
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
  const vocab = useMemo(() => ({ tags, markLabels }), [tags, markLabels])
  const liveParsed = useMemo(() => parseSearchQuery(query, notebooks, noteTypes, vocab), [query, notebooks, noteTypes, vocab])
  const parsed = useMemo(() => parseSearchQuery(debounced, notebooks, noteTypes, vocab), [debounced, notebooks, noteTypes, vocab])
  const text = parsed.text.trim()
  const hasFilters =
    parsed.notebookId !== null || parsed.typeId !== null || parsed.archived || parsed.marked || parsed.tag !== null

  const results = useMemo<SearchResult[]>(() => {
    if (!open) return []
    if (!text && !hasFilters) return recentNotes(searchable).map((r) => ({ kind: 'note', ...r }))
    // Com `has:mark`/`mark:` os resultados são as marcas (uma linha por
    // marca), não notas/tasks.
    if (parsed.marked) {
      return searchMarks(searchable, text, {
        notebookId: parsed.notebookId,
        typeId: parsed.typeId,
        archived: parsed.archived,
        tag: parsed.tag,
        label: parsed.markLabel,
      }).map((r): SearchResult => ({ kind: 'mark', ...r }))
    }
    const q = normalizeSearch(text)
    const matchingNotebooks: SearchResult[] =
      hasFilters || !q
        ? []
        : notebooks
            .filter((nb) => normalizeSearch(nb.name).startsWith(q))
            .slice(0, MAX_NOTEBOOKS)
            .map((nb) => ({ kind: 'notebook', notebook: nb }))
    // `type:`, `tag:` e `is:archived` filtram só notas: com eles a seção de
    // tasks some.
    const foundTasks =
      parsed.typeId || parsed.archived || parsed.tag
        ? []
        : searchTasks(tasks, text, todosById, { notebookId: parsed.notebookId })
    // A nota-corpo de uma task listada não repete na seção de notas.
    const taskNoteIds = new Set(foundTasks.map((t) => t.noteId))
    const foundNotes: SearchResult[] = searchNotes(searchable, text, {
      notebookId: parsed.notebookId,
      typeId: parsed.typeId,
      archived: parsed.archived,
      tag: parsed.tag,
    })
      .filter((r) => !(isTaskBodyNote(r.note) && taskNoteIds.has(r.note.id)))
      .map((r) => ({ kind: 'note', ...r }))
    return [
      ...matchingNotebooks,
      ...foundNotes,
      ...foundTasks.map((task): SearchResult => ({ kind: 'task', task })),
    ]
  }, [open, searchable, notebooks, tasks, todosById, text, hasFilters, parsed.notebookId, parsed.typeId, parsed.archived, parsed.marked, parsed.markLabel, parsed.tag])

  // Escopo semântico: pastas de notas dos cadernos com IA ligada (só a do
  // `#Caderno`, se houver).
  const meaningScopeIds = useMemo(
    () =>
      notebooks
        .filter((nb) => !disabledNotebookIds.has(nb.id) && (!parsed.notebookId || nb.id === parsed.notebookId))
        .map((nb) => notesFolderDocId(nb.id)),
    [notebooks, disabledNotebookIds, parsed.notebookId]
  )
  // A busca por significado não se aplica às marcas.
  const canSearchMeaning = !parsed.marked && hasApiKey && text.length >= MEANING_MIN_CHARS && meaningScopeIds.length > 0
  const meaningKey = `${parsed.notebookId ?? ''}|${parsed.typeId ?? ''}|${parsed.tag ?? ''}|${parsed.archived ? 'a' : ''}|${text}`
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
    const archivedOnly = parsed.archived
    const tagKey = parsed.tag ? normalizeSearch(parsed.tag) : null
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
        if (archivedOnly && !note.archivedAt) continue
        if (tagKey && !note.tags.some((t) => normalizeSearch(t) === tagKey)) continue
        seen.add(note.id)
        // 1º chunk: pula o cabeçalho gerado (`# título`, Project:, Status:...).
        const headerEnd = c.chunkIndex === 0 && c.content.startsWith('# ') ? c.content.indexOf('\n\n') : -1
        const flat = (headerEnd >= 0 ? c.content.slice(headerEnd + 2) : c.content).replace(/\s+/g, ' ').trim()
        const excerpt = flat.length > MEANING_EXCERPT_CHARS ? `${flat.slice(0, MEANING_EXCERPT_CHARS)}…` : flat
        hits.push({ note, excerpt })
      }
      // Arquivadas depois das ativas (sort estável: mantém a ordem do RAG).
      hits.sort((a, b) => Number(!!a.note.archivedAt) - Number(!!b.note.archivedAt))
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
  }, [meaningKey, parsed.typeId, parsed.archived, parsed.tag, meaningScopeIds, text, searchable, results.length])

  const selectResult = useCallback((result: SearchResult) => {
    if (result.kind === 'meaning') {
      if (!currentMeaning || currentMeaning.status === 'error') void runMeaningSearch()
      return
    }
    if (result.kind === 'notebook') {
      onSelectNotebook?.(result.notebook.id)
    } else if (result.kind === 'task') {
      onSelectTask(result.task.id)
    } else if (result.kind === 'mark') {
      if (result.note.notebookId) onSelectMark?.(result.note, result.entry)
    } else {
      const note = result.note
      if (note.notebookId) {
        onSelectNote(note.notebookId, note.id, note.subjectId)
      }
    }
    onClose()
  }, [onSelectNotebook, onSelectNote, onSelectMark, onSelectTask, onClose, currentMeaning, runMeaningSearch])

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

  // Atalho do filtro de marcas (botão sempre visível na linha de chips): liga
  // com `has:mark`; desliga tirando também o `mark:` do rótulo.
  const toggleMarks = () => {
    let next = query.trim()
    if (liveParsed.marked) {
      for (const c of liveParsed.chips) {
        if (c.kind === 'marked' || c.kind === 'markLabel') next = withoutToken(next, c.raw)
      }
    } else {
      next = `${next} has:mark`.trim()
    }
    setQuery(next ? `${next} ` : '')
    inputRef.current?.focus()
  }

  // Rótulo de marca alterna `mark:<rótulo>` (um por vez).
  const toggleMarkLabel = (label: string) => {
    const active = liveParsed.chips.find((c) => c.kind === 'markLabel')
    let next = active ? withoutToken(query, active.raw) : query.trim()
    if (!active || active.label !== label) next = `${next} ${markLabelToken(label)}`.trim()
    setQuery(next ? `${next} ` : '')
    inputRef.current?.focus()
  }

  if (!open) return null

  const showRecent = !text && !hasFilters && results.length > 0
  const notebookChip = liveParsed.chips.find((c) => c.kind === 'notebook')
  const archivedChip = liveParsed.chips.find((c) => c.kind === 'archived')
  const tagChip = liveParsed.chips.find((c) => c.kind === 'tag')
  const labelChips = liveParsed.marked
    ? [
        ...(liveParsed.markLabel ? [liveParsed.markLabel] : []),
        ...markLabels.filter((l) => l !== liveParsed.markLabel),
      ].slice(0, MAX_LABEL_CHIPS)
    : []

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
          placeholder="Search… (#notebook, tag:, type:, is:archived, has:mark)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
            {archivedChip && (
              <button
                type="button"
                className={`${styles.chip} ${styles.chipActive}`}
                title="Remove archived filter"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeChip(archivedChip.raw)}
              >
                <span>is:archived</span>
                <X size={10} aria-hidden />
              </button>
            )}
            {tagChip && (
              <button
                type="button"
                className={`${styles.chip} ${styles.chipActive}`}
                title="Remove tag filter"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeChip(tagChip.raw)}
              >
                <Tag size={11} aria-hidden />
                <span>{tagChip.label}</span>
                <X size={10} aria-hidden />
              </button>
            )}
            {/* Atalho do filtro de marcas: botão sempre visível, alterna
                `has:mark` na consulta. Ligado, os rótulos viram chips. */}
            <button
              type="button"
              className={`${styles.chip} ${styles.markChip} ${liveParsed.marked ? styles.chipActive : ''}`}
              title={liveParsed.marked ? 'Remove marks filter' : 'Show marks (has:mark)'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleMarks}
            >
              <span>Marks</span>
              {liveParsed.marked && <X size={10} aria-hidden />}
            </button>
            {labelChips.map((label) => {
              const active = liveParsed.markLabel === label
              return (
                <button
                  key={`label-${label}`}
                  type="button"
                  className={`${styles.chip} ${styles.markChip} ${active ? styles.chipActive : ''}`}
                  title={active ? 'Remove label filter' : `Only "${label}" marks`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleMarkLabel(label)}
                >
                  <span>{label}</span>
                  {active && <X size={10} aria-hidden />}
                </button>
              )
            })}
            {/* Com as marcas ligadas, os rótulos tomam a linha: dos tipos fica
                só o ativo (o `type:` continua filtrando as marcas). */}
            {noteTypes.filter((t) => !liveParsed.marked || liveParsed.typeId === t.id).map((t) => {
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
        <div ref={listRef} className={styles.list}>
          {results.length === 0 && (text || hasFilters) && (
            <div className={styles.empty}>No results found</div>
          )}
          {showRecent && <div className={styles.sectionHeader}>Recent</div>}
          {items.map((result, i) => {
            const prev = items[i - 1]
            const header =
              result.kind === 'mark' && prev?.kind !== 'mark'
                ? 'Marks'
                : result.kind === 'task' && prev?.kind !== 'task'
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
            } else if (result.kind === 'mark') {
              const { note, entry } = result
              const label = noteLabel(note)
              key = `mark-${note.id}-${entry.index}`
              body = (
                <div {...itemProps}>
                  {note.notebookId && notebookMap.has(note.notebookId) && (
                    <div className={styles.itemNotebook}>{notebookMap.get(note.notebookId)}</div>
                  )}
                  <div className={styles.itemTitleRow}>
                    <div className={styles.itemTitle}>{note.title || 'Untitled'}</div>
                    {entry.label && <span className={styles.markLabel}>{entry.label}</span>}
                    {label && <span className={styles.itemLabel}>{label}</span>}
                  </div>
                  <div className={styles.markPreview}>
                    {clipContextStart(entry.before)}
                    <mark className={styles.markText}>{entry.text}</mark>
                    {entry.after}
                  </div>
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
                    {result.kind === 'note' && result.tag && (
                      <span className={styles.itemTag}>
                        <Tag size={10} aria-hidden />
                        {result.tag}
                      </span>
                    )}
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
