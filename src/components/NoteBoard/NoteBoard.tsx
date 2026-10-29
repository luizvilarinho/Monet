import { useMemo, useState, type ReactNode } from 'react'
import { DownloadSimple, GearSix, MagnifyingGlass, Plus, X } from '@phosphor-icons/react'
import {
  boardCsv,
  boardCsvFileName,
  boardNoteOrder,
  boardNotes,
  buildBoardColumns,
  columnKeyOf,
  newNoteProperties,
  NO_VALUE_KEY,
  noSectionLabel,
  valueForKey,
  withPropertyValue,
  type ResolvedBoard,
} from '../../lib/noteBoard'
import { normalizeSearch, noteFirstParagraph } from '../../lib/noteSearch'
import type { MetadataDef, MetadataValue, Note, Notebook, NoteType } from '../../types'
import { BoardColumns, type BoardColumn } from '../TasksView/BoardColumns'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import { NoteCard } from './NoteCard'
import boardStyles from '../TasksView/WeekBoard.module.css'
import headerStyles from '../TasksView/TasksHeader.module.css'
import columnStyles from '../TasksView/BoardColumns.module.css'
import styles from './NoteBoard.module.css'

// Board em cards das notas de um tipo, na área inteira (como os boards de
// Tasks). Colunas = valores da propriedade da coluna; arrastar o card grava o
// valor (onSetProperties); soltar numa seção grava também a propriedade da
// seção. "New" na coluna (e na seção) cria a nota já com esses valores.
// Header: caderno, busca por título, chips das opções da seção, "Clear
// filters", export CSV dos cards visíveis e "Board settings". Caderno, chips e
// o caderno do último "New" ficam no localStorage por tipo; a busca não.
interface NoteBoardProps {
  type: NoteType
  board: ResolvedBoard
  // Propriedades do tipo (colunas extras do CSV).
  typeDefs: MetadataDef[]
  // Todas as notas; o board pega as do tipo (boardNotes).
  notes: Note[]
  notebooks: Notebook[]
  // Tasks de cada nota (`parentNoteId`), para o progresso no card.
  taskProgress: Map<string, { done: number; total: number }>
  onSetProperties: (noteId: string, properties: Record<string, MetadataValue>) => void
  // Nota nova do tipo no caderno (null = Inbox), já com as propriedades.
  onCreateNote: (notebookId: string | null, properties: Record<string, MetadataValue>) => void
  // `order`: ids dos cards na ordem visível (Prev/Next do modal).
  onOpenNote: (note: Note, order: string[]) => void
  onOpenInNotebook: (note: Note) => void
  onOpenSettings: () => void
  // Salva o CSV (diálogo nativo); false = cancelado.
  onExportCsv: (fileName: string, csv: string) => Promise<boolean>
}

const ALL_NOTEBOOKS = '__all__'
// Separa coluna e seção na chave de drop de uma seção. Ids de opção não têm ':'.
const SECTION_SEP = '::'
// Limites do Build your own Radar (só aviso, não bloqueia).
const BYOR_MAX = 4
const STORAGE_PREFIX = 'monet:note-board:'
// Tamanho da `description` do CSV quando vem do 1º parágrafo da nota.
const CSV_DESCRIPTION_MAX = 300

interface SavedState {
  notebookId: string | null
  sections: string[]
  // Caderno da última nota criada pelo "New" deste board.
  lastNotebookId: string | null
}

function loadState(typeId: string): SavedState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_PREFIX + typeId) ?? 'null') as Partial<SavedState> | null
    return {
      notebookId: typeof raw?.notebookId === 'string' ? raw.notebookId : null,
      sections: Array.isArray(raw?.sections) ? raw.sections.filter((k): k is string => typeof k === 'string') : [],
      lastNotebookId: typeof raw?.lastNotebookId === 'string' ? raw.lastNotebookId : null,
    }
  } catch {
    return { notebookId: null, sections: [], lastNotebookId: null }
  }
}

function storeState(typeId: string, state: SavedState) {
  try {
    localStorage.setItem(STORAGE_PREFIX + typeId, JSON.stringify(state))
  } catch {
    // Sem storage o filtro só não é lembrado.
  }
}

export function NoteBoard({
  type,
  board,
  typeDefs,
  notes,
  notebooks,
  taskProgress,
  onSetProperties,
  onCreateNote,
  onOpenNote,
  onOpenInNotebook,
  onOpenSettings,
  onExportCsv,
}: NoteBoardProps) {
  const { column, section, config, cardDefs } = board
  const [saved, setSaved] = useState(() => loadState(type.id))
  const [query, setQuery] = useState('')
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  // Outro tipo no mesmo componente: relê o estado dele e limpa a busca e o
  // aviso do export.
  const [stateTypeId, setStateTypeId] = useState(type.id)
  if (stateTypeId !== type.id) {
    setStateTypeId(type.id)
    setSaved(loadState(type.id))
    setQuery('')
    setExportStatus(null)
  }

  function updateSaved(next: SavedState) {
    setSaved(next)
    storeState(type.id, next)
  }

  const typeNotes = useMemo(() => boardNotes(notes, board, type.id), [notes, board, type.id])
  const notebookOptions = useMemo(
    () => notebooks.filter((nb) => typeNotes.some((n) => n.notebookId === nb.id)),
    [notebooks, typeNotes]
  )
  const notebookNameById = useMemo(
    () => new Map(notebooks.map((nb) => [nb.id, nb.name || 'unnamed'])),
    [notebooks]
  )
  // Caderno ou chip que não existe mais é ignorado (sem reescrever o storage).
  const notebookId = notebookOptions.some((nb) => nb.id === saved.notebookId) ? saved.notebookId : null
  // Caderno do "New": o do filtro; com "All notebooks", o do último "New"
  // deste board, senão o que tem mais notas do tipo, senão o Inbox (null).
  const mostUsedNotebookId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of typeNotes) if (n.notebookId) counts.set(n.notebookId, (counts.get(n.notebookId) ?? 0) + 1)
    let best: string | null = null
    for (const [id, count] of counts) if (best === null || count > (counts.get(best) ?? 0)) best = id
    return best
  }, [typeNotes])
  const newNotebookId =
    notebookId ??
    (saved.lastNotebookId && notebookNameById.has(saved.lastNotebookId) ? saved.lastNotebookId : mostUsedNotebookId)
  const newNotebookName = newNotebookId ? notebookNameById.get(newNotebookId) ?? 'unnamed' : 'Inbox'
  const sectionChips = section
    ? [
        ...(section.options ?? []).map((o) => ({ key: o.id, label: o.name, color: o.color })),
        { key: NO_VALUE_KEY, label: noSectionLabel(section), color: null },
      ]
    : []
  const activeSections = saved.sections.filter((k) => sectionChips.some((c) => c.key === k))
  const sectionFilter = section && activeSections.length > 0 ? new Set(activeSections) : null
  const wanted = normalizeSearch(query.trim())

  const visible = typeNotes.filter(
    (n) =>
      (!notebookId || n.notebookId === notebookId) &&
      (!wanted || normalizeSearch(n.title).includes(wanted)) &&
      (!sectionFilter || !section || sectionFilter.has(columnKeyOf(n, section).key))
  )
  const columns = buildBoardColumns(visible, board, sectionFilter)
  const shown = columns.reduce((n, c) => n + c.notes.length, 0)
  // Notas sem valor que ficaram de fora com "Hide No value".
  const hidden = visible.length - shown
  const filtered = notebookId !== null || activeSections.length > 0

  function newButton(label: string, columnKey: string, sectionKey?: string) {
    return (
      <button
        type="button"
        className={styles.newBtn}
        onClick={() => handleCreate(columnKey, sectionKey)}
        aria-label={`new ${type.name} note in ${label}`}
        title={`New ${type.name} note in ${label} (notebook: ${newNotebookName})`}
      >
        <Plus size={12} aria-hidden />
        New
      </button>
    )
  }

  const boardColumns: BoardColumn<Note>[] = columns.map((c) => ({
    key: c.key,
    title: c.title,
    color: c.color,
    count: c.notes.length,
    items: c.notes,
    sections: c.sections?.map((s) => ({
      label: s.label,
      items: s.notes,
      dropKey: `${c.key}${SECTION_SEP}${s.key}`,
      action: newButton(`${c.title} · ${s.label}`, c.key, s.key),
    })),
    headerExtra: (
      <span className={styles.columnEnd}>
        {c.orphanCount > 0 && (
          <span className={columnStyles.columnMeta}>{c.orphanCount} with a deleted option</span>
        )}
        {newButton(c.title, c.key)}
      </span>
    ),
  }))

  // `key` = coluna, ou `coluna::seção` quando soltou numa seção (grava as
  // duas propriedades numa chamada). Valor igual não grava; a nota com opção
  // apagada solta em "No value" também não.
  function handleDrop(noteId: string, dropKey: string) {
    const note = typeNotes.find((n) => n.id === noteId)
    if (!note) return
    const [key, sectionKey] = dropKey.split(SECTION_SEP) as [string, string | undefined]
    const columnChanged = columnKeyOf(note, column).key !== key
    const sectionChanged =
      section !== null && sectionKey !== undefined && columnKeyOf(note, section).key !== sectionKey
    if (!columnChanged && !sectionChanged) return
    let next = note.properties ?? {}
    if (columnChanged) next = withPropertyValue(next, column.id, valueForKey(column, key))
    if (section && sectionKey !== undefined && sectionChanged) {
      next = withPropertyValue(next, section.id, valueForKey(section, sectionKey))
    }
    onSetProperties(note.id, next)
  }

  // A nota nova não pode sumir pelos filtros da tela: a busca é limpa e, com
  // chips ativos, o chip da seção dela liga ("No <Seção>" no "New" da coluna).
  // O caderno já é o do filtro.
  function handleCreate(columnKey: string, sectionKey?: string) {
    const newSectionKey = sectionKey ?? NO_VALUE_KEY
    const sections =
      sectionFilter && !sectionFilter.has(newSectionKey) ? [...activeSections, newSectionKey] : activeSections
    if (sections !== activeSections || (newNotebookId && newNotebookId !== saved.lastNotebookId)) {
      updateSaved({ notebookId, sections, lastNotebookId: newNotebookId ?? saved.lastNotebookId })
    }
    setQuery('')
    onCreateNote(newNotebookId, newNoteProperties(board, columnKey, sectionKey))
  }

  function clearFilters() {
    updateSaved({ notebookId: null, sections: [], lastNotebookId: saved.lastNotebookId })
    setQuery('')
  }

  async function handleExport() {
    setExportStatus(null)
    const { csv, rows, rings, quadrants } = boardCsv(columns, board, typeDefs, (note) =>
      noteFirstParagraph(note, CSV_DESCRIPTION_MAX)
    )
    try {
      if (!(await onExportCsv(boardCsvFileName(type.name), csv))) return
      let message = `Exported ${rows} ${rows === 1 ? 'note' : 'notes'}.`
      if (rings > BYOR_MAX || quadrants > BYOR_MAX) {
        message += ` Build your own Radar accepts at most ${BYOR_MAX} rings and ${BYOR_MAX} quadrants; this export has ${rings} rings and ${quadrants} quadrants.`
      }
      setExportStatus(message)
    } catch {
      setExportStatus('Export failed.')
    }
  }

  function toggleSection(key: string) {
    const sections = activeSections.includes(key)
      ? activeSections.filter((k) => k !== key)
      : [...activeSections, key]
    updateSaved({ notebookId, sections, lastNotebookId: saved.lastNotebookId })
  }

  const settingsButton = (
    <button type="button" className={styles.headerBtn} onClick={onOpenSettings}>
      <GearSix size={14} aria-hidden />
      Board settings
    </button>
  )
  const clearButton = (
    <button type="button" className={styles.headerBtn} onClick={clearFilters}>
      <X size={14} aria-hidden />
      Clear filters
    </button>
  )
  let empty: ReactNode = null
  if (typeNotes.length === 0 && !board.filter) {
    empty = `No ${type.name} notes yet. Use “New” on a column, or give a note the type ${type.name}.`
  } else if (shown === 0 && hidden > 0) {
    empty = (
      <>
        {`${hidden === 1 ? 'The only note has' : `All ${hidden} notes have`} no ${column.name}. Turn off “Hide ‘No value’ column” in Board settings to see ${hidden === 1 ? 'it' : 'them'}.`}
        {settingsButton}
      </>
    )
  } else if (shown === 0) {
    empty = (
      <>
        No notes match the filters.
        {filtered || wanted ? clearButton : settingsButton}
      </>
    )
  }

  return (
    <section className={boardStyles.board} aria-label={`${type.name} notes board`}>
      <div className={boardStyles.top}>
        <div className={`${headerStyles.titleRow} ${styles.titleRow}`}>
          <span className={styles.title}>
            <span className={styles.typeIcon} style={{ color: type.color ?? undefined }}>
              <TypeIcon name={type.icon} size={14} />
            </span>
            {type.name} notes
            <span className={styles.by}>· by {column.name}</span>
          </span>
          <span className={styles.count}>
            {shown} {shown === 1 ? 'note' : 'notes'}
            {hidden > 0 && ` · ${hidden} with no ${column.name} hidden`}
          </span>
          {board.filter && <span className={styles.hint}>Only notes where {board.filter.name} is checked</span>}
          <select
            className={headerStyles.select}
            value={notebookId ?? ALL_NOTEBOOKS}
            onChange={(e) =>
              updateSaved({
                notebookId: e.target.value === ALL_NOTEBOOKS ? null : e.target.value,
                sections: activeSections,
                lastNotebookId: saved.lastNotebookId,
              })
            }
            aria-label="filter by notebook"
          >
            <option value={ALL_NOTEBOOKS}>All notebooks</option>
            {notebookOptions.map((nb) => (
              <option key={nb.id} value={nb.id}>
                {nb.name || 'unnamed'}
              </option>
            ))}
          </select>
          {filtered && clearButton}
          <button type="button" className={styles.headerBtn} onClick={handleExport} disabled={shown === 0}>
            <DownloadSimple size={14} aria-hidden />
            Export CSV
          </button>
          {settingsButton}
        </div>
        {exportStatus && (
          <p role="status" className={styles.status}>
            {exportStatus}
          </p>
        )}
        <label className={headerStyles.searchRow}>
          <MagnifyingGlass size={12} aria-hidden />
          <input
            className={headerStyles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                if (query) setQuery('')
                else e.currentTarget.blur()
              }
            }}
            placeholder="Search notes…"
            aria-label="search notes"
          />
        </label>
        {section && (
          <div className={headerStyles.chips} role="group" aria-label={`filter by ${section.name}`}>
            {sectionChips.map((chip) => {
              const active = activeSections.includes(chip.key)
              return (
                <button
                  key={chip.key}
                  type="button"
                  className={`${headerStyles.chip} ${active ? headerStyles.chipActive : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleSection(chip.key)}
                >
                  {chip.color && <span className={styles.chipDot} style={{ background: chip.color }} aria-hidden />}
                  {chip.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {empty && <p className={styles.empty}>{empty}</p>}
      <BoardColumns
        columns={boardColumns}
        onDrop={handleDrop}
        renderCard={(note) => (
          <NoteCard
            note={note}
            fields={cardDefs}
            showTags={config.showTags}
            notebookName={
              notebookId === null && note.notebookId ? notebookNameById.get(note.notebookId) ?? 'unnamed' : undefined
            }
            taskProgress={taskProgress.get(note.id)}
            onOpen={() => onOpenNote(note, boardNoteOrder(columns))}
            onOpenInNotebook={() => onOpenInNotebook(note)}
          />
        )}
      />
    </section>
  )
}
