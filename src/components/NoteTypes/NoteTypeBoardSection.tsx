import { Kanban } from '@phosphor-icons/react'
import {
  boardCardCandidates,
  boardColumnCandidates,
  boardFilterCandidates,
  boardSectionCandidates,
  defaultBoardConfig,
  MAX_CARD_FIELDS,
  resolveBoard,
} from '../../lib/noteBoard'
import type { MetadataDef, NoteBoardConfig, NoteType } from '../../types'
import styles from '../TasksView/StatusManagerModal.module.css'
import own from './NoteTypesModal.module.css'

// Seção "Board" do modal de tipos: liga o board em cards do tipo e escolhe a
// propriedade das colunas (select ou checkbox), das seções, os campos do card
// e o filtro por checkbox. Cada mudança grava a config inteira; desligar grava
// null (a config é descartada).
interface NoteTypeBoardSectionProps {
  type: NoteType
  // Propriedades do tipo, na ordem do tipo.
  defs: MetadataDef[]
  onChange: (board: NoteBoardConfig | null) => void
  onOpenBoard?: () => void
}

export function NoteTypeBoardSection({ type, defs, onChange, onOpenBoard }: NoteTypeBoardSectionProps) {
  const resolved = resolveBoard(type, defs)
  const columnCandidates = boardColumnCandidates(defs)

  const toggle = (
    <label className={own.inList}>
      <input
        type="checkbox"
        checked={resolved !== null}
        disabled={columnCandidates.length === 0}
        onChange={(e) => onChange(e.target.checked ? defaultBoardConfig(defs) : null)}
      />
      Show as board
    </label>
  )

  const title = (
    <p className={`${own.section} ${own.boardTitle}`}>
      <Kanban size={13} aria-hidden />
      Board
    </p>
  )

  if (!resolved) {
    return (
      <>
        {title}
        <div className={own.field}>{toggle}</div>
        {columnCandidates.length === 0 && (
          <p className={own.empty}>Add a Select or Checkbox property to show this type as a board.</p>
        )}
      </>
    )
  }

  // Config já limpa das referências que a leitura defensiva ignorou.
  const current: NoteBoardConfig = {
    ...resolved.config,
    sectionDefId: resolved.section?.id ?? null,
    filterDefId: resolved.filter?.id ?? null,
    cardDefIds: resolved.cardDefs.map((d) => d.id),
  }
  const columnId = resolved.column.id
  const sectionCandidates = boardSectionCandidates(defs, columnId)
  const filterCandidates = boardFilterCandidates(defs, columnId)
  const cardCandidates = boardCardCandidates(defs, columnId)

  function update(patch: Partial<NoteBoardConfig>) {
    onChange({ ...current, ...patch })
  }

  function setColumn(id: string) {
    update({
      columnDefId: id,
      sectionDefId: current.sectionDefId === id ? null : current.sectionDefId,
      filterDefId: current.filterDefId === id ? null : current.filterDefId,
      cardDefIds: current.cardDefIds.filter((x) => x !== id),
    })
  }

  // Campos na ordem das propriedades do tipo.
  function toggleCardField(id: string, on: boolean) {
    update({
      cardDefIds: cardCandidates
        .filter((d) => (d.id === id ? on : current.cardDefIds.includes(d.id)))
        .map((d) => d.id),
    })
  }

  return (
    <>
      {title}
      <div className={own.board}>
        <div className={own.field}>
          {toggle}
          {onOpenBoard && (
            <button type="button" className={`${styles.close} ${own.boardOpen}`} onClick={onOpenBoard}>
              <Kanban size={13} aria-hidden />
              Open board
            </button>
          )}
        </div>
        <div className={own.field}>
          <span className={own.label}>Columns</span>
          <select
            className={own.select}
            value={columnId}
            onChange={(e) => setColumn(e.target.value)}
            aria-label="board columns property"
          >
            {columnCandidates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className={own.field}>
          <span className={own.label}>Sections</span>
          <select
            className={own.select}
            value={current.sectionDefId ?? ''}
            disabled={sectionCandidates.length === 0}
            onChange={(e) => update({ sectionDefId: e.target.value || null })}
            aria-label="board sections property"
          >
            <option value="">None</option>
            {sectionCandidates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className={`${own.field} ${own.fieldTop}`}>
          <span className={own.label}>Card fields</span>
          <div className={own.boardChecks}>
            {cardCandidates.length === 0 && <p className={own.empty}>No other properties.</p>}
            {cardCandidates.map((d) => {
              const checked = current.cardDefIds.includes(d.id)
              return (
                <label
                  key={d.id}
                  className={own.inList}
                  title={`Show on cards (at most ${MAX_CARD_FIELDS})`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && current.cardDefIds.length >= MAX_CARD_FIELDS}
                    onChange={(e) => toggleCardField(d.id, e.target.checked)}
                  />
                  {d.name}
                </label>
              )
            })}
          </div>
        </div>
        <div className={own.field}>
          <span className={own.label} />
          <div className={own.boardChecks}>
            <label className={own.inList}>
              <input
                type="checkbox"
                checked={current.showTags}
                onChange={(e) => update({ showTags: e.target.checked })}
              />
              Show tags on cards
            </label>
            <label
              className={own.inList}
              title={resolved.column.type === 'checkbox' ? 'Checkbox columns are always Yes and No' : undefined}
            >
              <input
                type="checkbox"
                checked={current.hideEmpty}
                disabled={resolved.column.type === 'checkbox'}
                onChange={(e) => update({ hideEmpty: e.target.checked })}
              />
              Hide “No value” column
            </label>
          </div>
        </div>
        <div className={own.field}>
          <span className={own.label}>Only notes where</span>
          <select
            className={own.select}
            value={current.filterDefId ?? ''}
            disabled={filterCandidates.length === 0}
            onChange={(e) => update({ filterDefId: e.target.value || null })}
            aria-label="board filter property"
          >
            <option value="">None</option>
            {filterCandidates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className={own.boardHint}>is checked</span>
        </div>
      </div>
    </>
  )
}
