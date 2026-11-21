import { ChartLineUp } from '@phosphor-icons/react'
import { logGroupCandidates, logSumCandidates, logTrendCandidates, resolveLog } from '../../lib/noteLog'
import type { MetadataDef, NoteLogConfig, NoteType } from '../../types'
import styles from '../TasksView/StatusManagerModal.module.css'
import own from './NoteTypesModal.module.css'

// Seção "Log" do modal de tipos: liga o Log do tipo (as notas como sessões ao
// longo do tempo) e escolhe a propriedade somada, a de tendência e a de
// agrupamento, todas opcionais. Cada mudança grava a config inteira, já limpa
// das referências que a leitura defensiva ignorou; desligar grava null.
interface NoteTypeLogSectionProps {
  type: NoteType
  // Propriedades do tipo, na ordem do tipo.
  defs: MetadataDef[]
  onChange: (log: NoteLogConfig | null) => void
  onOpenLog?: () => void
}

export function NoteTypeLogSection({ type, defs, onChange, onOpenLog }: NoteTypeLogSectionProps) {
  const resolved = resolveLog(type, defs)

  const toggle = (
    <label className={own.inList}>
      <input
        type="checkbox"
        checked={resolved !== null}
        onChange={(e) => onChange(e.target.checked ? { sumDefId: null, trendDefId: null, groupDefId: null } : null)}
      />
      Show as log
    </label>
  )

  const title = (
    <p className={`${own.section} ${own.boardTitle}`} data-log-section>
      <ChartLineUp size={13} aria-hidden />
      Log
    </p>
  )

  if (!resolved) {
    return (
      <>
        {title}
        <div className={own.field}>{toggle}</div>
      </>
    )
  }

  const current: NoteLogConfig = {
    sumDefId: resolved.sum?.id ?? null,
    trendDefId: resolved.trend?.id ?? null,
    groupDefId: resolved.group?.id ?? null,
  }
  const sumCandidates = logSumCandidates(defs)
  const trendCandidates = logTrendCandidates(defs)
  const groupCandidates = logGroupCandidates(defs)

  function update(patch: Partial<NoteLogConfig>) {
    onChange({ ...current, ...patch })
  }

  function renderSelect(
    label: string,
    value: string | null,
    candidates: MetadataDef[],
    key: keyof NoteLogConfig
  ) {
    return (
      <div className={own.field}>
        <span className={own.label}>{label}</span>
        <select
          className={own.select}
          value={value ?? ''}
          disabled={candidates.length === 0}
          onChange={(e) => update({ [key]: e.target.value || null })}
          aria-label={`log ${label.toLowerCase()} property`}
        >
          <option value="">None</option>
          {candidates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <>
      {title}
      <div className={own.board}>
        <div className={own.field}>
          {toggle}
          {onOpenLog && (
            <button type="button" className={`${styles.close} ${own.boardOpen}`} onClick={onOpenLog}>
              <ChartLineUp size={13} aria-hidden />
              Open log
            </button>
          )}
        </div>
        {renderSelect('Sum', current.sumDefId, sumCandidates, 'sumDefId')}
        {renderSelect('Trend', current.trendDefId, trendCandidates, 'trendDefId')}
        {renderSelect('Group by', current.groupDefId, groupCandidates, 'groupDefId')}
        <p className={own.empty}>Text groups equal values, ignoring case and surrounding spaces.</p>
        {sumCandidates.length === 0 && groupCandidates.length === 0 && (
          <p className={own.empty}>Add a Number, Select or Text property to total, follow or group the sessions.</p>
        )}
      </div>
    </>
  )
}
