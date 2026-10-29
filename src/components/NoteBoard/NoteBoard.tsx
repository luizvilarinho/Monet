import { useMemo, useState } from 'react'
import { DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react'
import {
  boardCsv,
  boardCsvFileName,
  boardNotes,
  buildBoardColumns,
  columnKeyOf,
  NO_VALUE_KEY,
  valueForKey,
  withPropertyValue,
  type ResolvedBoard,
} from '../../lib/noteBoard'
import { normalizeSearch } from '../../lib/noteSearch'
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
// seção. Header: caderno, busca por título, chips das opções da seção e
// export CSV dos cards visíveis. Caderno e chips ficam no localStorage por
// tipo; a busca não.
interface NoteBoardProps {
  type: NoteType
  board: ResolvedBoard
  // Propriedades do tipo (colunas extras do CSV).
  typeDefs: MetadataDef[]
  // Todas as notas; o board pega as do tipo (boardNotes).
  notes: Note[]
  notebooks: Notebook[]
  onSetProperties: (noteId: string, properties: Record<string, MetadataValue>) => void
  onOpenNote: (note: Note) => void
  onOpenInNotebook: (note: Note) => void
  // Salva o CSV (diálogo nativo); false = cancelado.
  onExportCsv: (fileName: string, csv: string) => Promise<boolean>
}

const ALL_NOTEBOOKS = '__all__'
// Separa coluna e seção na chave de drop de uma seção. Ids de opção não têm ':'.
const SECTION_SEP = '::'
// Limites do Build your own Radar (só aviso, não bloqueia).
const BYOR_MAX = 4
const STORAGE_PREFIX = 'monet:note-board:'

interface SavedState {
  notebookId: string | null
  sections: string[]
}

function loadState(typeId: string): SavedState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_PREFIX + typeId) ?? 'null') as Partial<SavedState> | null
    return {
      notebookId: typeof raw?.notebookId === 'string' ? raw.notebookId : null,
      sections: Array.isArray(raw?.sections) ? raw.sections.filter((k): k is string => typeof k === 'string') : [],
    }
  } catch {
    return { notebookId: null, sections: [] }
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
  onSetProperties,
  onOpenNote,
  onOpenInNotebook,
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
  const sectionChips = section
    ? [
        ...(section.options ?? []).map((o) => ({ key: o.id, label: o.name, color: o.color })),
        { key: NO_VALUE_KEY, label: 'No value', color: null },
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
    })),
    headerExtra:
      c.orphanCount > 0 ? (
        <span className={columnStyles.columnMeta}>{c.orphanCount} with a deleted option</span>
      ) : undefined,
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

  async function handleExport() {
    setExportStatus(null)
    const { csv, rows, rings, quadrants } = boardCsv(columns, board, typeDefs)
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
    updateSaved({ notebookId, sections })
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
          <button type="button" className={styles.exportBtn} onClick={handleExport} disabled={shown === 0}>
            <DownloadSimple size={14} aria-hidden />
            Export CSV
          </button>
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
      {typeNotes.length === 0 && !board.filter ? (
        <p className={styles.empty}>
          No {type.name} notes yet. Give a note the type {type.name} to see it here.
        </p>
      ) : shown === 0 ? (
        <p className={styles.empty}>
          {hidden > 0
            ? `${hidden === 1 ? 'The only note has' : `All ${hidden} notes have`} no ${column.name}. Turn off “Hide ‘No value’ column” in the type's Board settings to see ${hidden === 1 ? 'it' : 'them'}.`
            : 'No notes match the filters.'}
        </p>
      ) : (
        <BoardColumns
          columns={boardColumns}
          onDrop={handleDrop}
          renderCard={(note) => (
            <NoteCard
              note={note}
              type={type}
              fields={cardDefs}
              showTags={config.showTags}
              notebookName={
                notebookId === null && note.notebookId ? notebookNameById.get(note.notebookId) ?? 'unnamed' : undefined
              }
              onOpen={() => onOpenNote(note)}
              onOpenInNotebook={() => onOpenInNotebook(note)}
            />
          )}
        />
      )}
    </section>
  )
}
