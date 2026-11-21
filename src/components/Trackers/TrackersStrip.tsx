import { useMemo, useState } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { weekDayKeys } from '../../lib/tasks'
import {
  countDone,
  trackerDayTitle,
  trackerMonthLine,
  trackerMonthTitle,
  weekCountsLine,
  weekCountTitle,
  weekHeaderLabel,
  weekRangeLabel,
  type TrackerDays,
} from '../../lib/trackers'
import type { NoteType, Tracker } from '../../types'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import styles from './TrackersStrip.module.css'

// Inicial de cada dia da semana em foco (segunda a domingo).
const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const EMPTY_DAYS: TrackerDays = new Map()
// Faixa recolhida: uma chave por janela (a main e a keep passam a sua).
const DEFAULT_COLLAPSED_KEY = 'monet:trackers-collapsed'

// '1' = recolhida, '0' = expandida (escolha do usuário); sem valor gravado vale
// o padrão da janela.
function readCollapsed(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    return stored === '1' ? true : stored === '0' ? false : fallback
  } catch {
    return fallback
  }
}

function writeCollapsed(key: string, collapsed: boolean): void {
  try {
    localStorage.setItem(key, collapsed ? '1' : '0')
  } catch {
    // preferência de conveniência: sem storage, só não persiste
  }
}

// Faixa "Trackers" do Calendar: uma linha por tracker ativo com os 7 dias da
// semana em foco (n/meta), e o total do mês exibido com as semanas na meta. O
// cabeçalho recolhe a faixa (recolhida, mostra o n/meta de cada tracker). O dia
// vindo de nota do tipo vinculado não se desmarca aqui: o clique abre a nota (o
// botão fica `aria-disabled`, com foco, e o círculo leva um anel interno); dia
// futuro não aceita marca. Uma falha de gravação aparece numa linha
// sob o cabeçalho (o hook desfaz a marca na memória); uma falha de leitura, no
// lugar da lista, para a lista vazia não parecer "nenhum tracker".
interface TrackersStripProps {
  // Ativos.
  trackers: Tracker[]
  days: Map<string, TrackerDays>
  // Segunda-feira da semana em foco.
  weekStart: string
  year: number
  month0: number
  todayKey: string
  // Nome do tipo vinculado no tooltip.
  noteTypes: NoteType[]
  onToggle: (trackerId: string, day: string, on: boolean) => void
  // Clique no dia vindo de nota: abre a nota do dia.
  onOpenNote?: (noteId: string) => void
  // Ausente: sem o botão "Manage" nem o "New tracker" do estado vazio.
  onManage?: () => void
  // A leitura dos trackers falhou (sem lista, a faixa mostra "couldn't load").
  loadFailed?: boolean
  // A 1ª leitura terminou. Antes dela, sem lista, a faixa mostra só o título: o
  // "New tracker" convidaria a criar o que talvez já exista.
  loaded?: boolean
  // "Retry" da falha de leitura; ausente: sem o botão.
  onRetry?: () => Promise<unknown>
  // Falha ao gravar uma marca.
  error?: string | null
  collapsedKey?: string
  // Estado da faixa enquanto o usuário não escolheu (a keep começa recolhida: lá a
  // faixa empurra os cards do dia para fora da janela, e os chips já marcam o dia).
  defaultCollapsed?: boolean
}

export function TrackersStrip({
  trackers,
  days,
  weekStart,
  year,
  month0,
  todayKey,
  noteTypes,
  onToggle,
  onOpenNote,
  onManage,
  loadFailed = false,
  loaded = true,
  onRetry,
  error = null,
  collapsedKey = DEFAULT_COLLAPSED_KEY,
  defaultCollapsed = false,
}: TrackersStripProps) {
  const typeNameById = useMemo(() => new Map(noteTypes.map((t) => [t.id, t.name])), [noteTypes])
  const weekKeys = useMemo(() => weekDayKeys(weekStart), [weekStart])
  const range = weekRangeLabel(weekStart)
  const weekEnd = weekKeys[6]
  const [collapsed, setCollapsed] = useState(() => readCollapsed(collapsedKey, defaultCollapsed))
  const [retrying, setRetrying] = useState(false)

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    writeCollapsed(collapsedKey, next)
  }

  async function retry() {
    setRetrying(true)
    try {
      await onRetry?.()
    } finally {
      setRetrying(false)
    }
  }

  if (trackers.length === 0 && loadFailed) {
    return (
      <section className={styles.strip} aria-label="Trackers">
        <div className={styles.empty} role="alert">
          <span>Trackers couldn't load.</span>
          {onRetry && (
            <button type="button" className={styles.linkBtn} onClick={() => void retry()} disabled={retrying}>
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </div>
      </section>
    )
  }

  if (trackers.length === 0 && !loaded) {
    return (
      <section className={styles.strip} aria-label="Trackers">
        <div className={styles.empty}>
          <span className={styles.title}>Trackers</span>
        </div>
      </section>
    )
  }

  if (trackers.length === 0) {
    return (
      <section className={styles.strip} aria-label="Trackers">
        <div className={styles.empty}>
          <span className={styles.title}>Trackers</span>
          <span aria-hidden>·</span>
          {onManage ? (
            <button type="button" className={styles.linkBtn} onClick={onManage}>
              New tracker
            </button>
          ) : (
            <span>No trackers yet.</span>
          )}
        </div>
      </section>
    )
  }

  const Caret = collapsed ? CaretRight : CaretDown
  return (
    <section className={styles.strip} aria-label="Trackers">
      <div className={styles.header}>
        <button
          type="button"
          className={styles.toggle}
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? 'Show trackers' : 'Hide trackers'}
        >
          <Caret size={10} weight="bold" aria-hidden />
          <span className={styles.title}>Trackers</span>
          {collapsed && <span className={styles.summary}>· {weekCountsLine(trackers, days, weekStart)}</span>}
        </button>
        {!collapsed && onManage && (
          <button type="button" className={styles.manage} onClick={onManage} title="Add, edit or archive trackers">
            Manage
          </button>
        )}
        {!collapsed && <span className={styles.range}>{weekHeaderLabel(weekStart, todayKey)}</span>}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!collapsed && (
        <div className={styles.rows}>
          {trackers.map((t) => {
            const trackerDays = days.get(t.id) ?? EMPTY_DAYS
            const linkedTypeName = t.linkedTypeId ? (typeNameById.get(t.linkedTypeId) ?? null) : null
            const done = countDone(trackerDays, weekStart, weekEnd)
            const monthLine = trackerMonthLine(t, trackerDays, year, month0, todayKey)
            return (
              <div key={t.id} className={styles.row}>
                <div className={styles.rowHead}>
                  <span className={styles.icon} style={{ color: t.color }}>
                    <TypeIcon name={t.icon} />
                  </span>
                  <span className={styles.name} title={t.name}>
                    {t.name}
                  </span>
                  <span className={styles.count} title={weekCountTitle(done, t.weeklyTarget, weekStart, todayKey)}>
                    {done}/{t.weeklyTarget}
                  </span>
                </div>
                <div className={styles.week} role="group" aria-label={`${t.name}, ${range}`}>
                  {weekKeys.map((key, i) => {
                    const day = trackerDays.get(key)
                    const future = key > todayKey
                    const label = trackerDayTitle(t, day, key, todayKey, linkedTypeName)
                    const fromNote = !!day?.fromNote
                    return (
                      <button
                        key={key}
                        type="button"
                        className={[
                          styles.day,
                          day ? styles.dayDone : '',
                          fromNote ? styles.dayNote : '',
                          key === todayKey ? styles.dayToday : '',
                        ].join(' ')}
                        style={day ? { background: t.color } : undefined}
                        disabled={future}
                        aria-disabled={fromNote || undefined}
                        aria-pressed={!!day}
                        aria-label={label}
                        title={label}
                        onClick={() => {
                          if (!fromNote) onToggle(t.id, key, !day?.manual)
                          else if (day?.noteId) onOpenNote?.(day.noteId)
                        }}
                      >
                        {DAY_INITIALS[i]}
                      </button>
                    )
                  })}
                </div>
                {monthLine && (
                  <p className={styles.month} title={trackerMonthTitle(t, trackerDays, year, month0, todayKey)}>
                    {monthLine}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
