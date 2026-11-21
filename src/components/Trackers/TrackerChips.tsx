import { useMemo, type CSSProperties } from 'react'
import { Check } from '@phosphor-icons/react'
import { trackerDayTitle, type TrackerDays } from '../../lib/trackers'
import type { NoteType, Tracker } from '../../types'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import styles from './TrackerChips.module.css'

// Chips dos trackers ativos acima do corpo da nota diária do Calendar: um por
// tracker, marca ou desmarca o dia da nota. Nada é gravado no conteúdo da nota
// e só a chave do dia importa (a nota pode ser um rascunho ainda não gravado).
// O chip feito mostra o ícone `Check` no lugar do ícone do tracker (o estado não
// depende só da cor). O dia vindo de nota do tipo vinculado não se desmarca aqui:
// o clique abre a nota (o chip fica `aria-disabled`, com foco, e leva o sufixo
// "· note"). Dia futuro não aceita marca, então a nota dele não mostra chips. Uma
// falha ao gravar a marca aparece numa linha acima dos chips (o hook desfaz a
// marca na memória).
interface TrackerChipsProps {
  // Ativos.
  trackers: Tracker[]
  days: Map<string, TrackerDays>
  dayKey: string
  todayKey: string
  // Nome do tipo vinculado no tooltip.
  noteTypes: NoteType[]
  onToggle: (trackerId: string, day: string, on: boolean) => void
  // Clique no dia vindo de nota: abre a nota do dia.
  onOpenNote?: (noteId: string) => void
  error?: string | null
}

export function TrackerChips({
  trackers,
  days,
  dayKey,
  todayKey,
  noteTypes,
  onToggle,
  onOpenNote,
  error = null,
}: TrackerChipsProps) {
  const typeNameById = useMemo(() => new Map(noteTypes.map((t) => [t.id, t.name])), [noteTypes])
  if (trackers.length === 0 || dayKey > todayKey) return null
  return (
    <div className={styles.chips} role="group" aria-label="Trackers">
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {trackers.map((t) => {
        const day = days.get(t.id)?.get(dayKey)
        const fromNote = !!day?.fromNote
        const linkedTypeName = t.linkedTypeId ? (typeNameById.get(t.linkedTypeId) ?? null) : null
        const label = trackerDayTitle(t, day, dayKey, todayKey, linkedTypeName)
        return (
          <button
            key={t.id}
            type="button"
            className={`${styles.chip} ${day ? styles.chipDone : ''}`}
            style={{ '--tracker-color': t.color } as CSSProperties}
            aria-disabled={fromNote || undefined}
            aria-pressed={!!day}
            aria-label={label}
            title={label}
            onClick={() => {
              if (!fromNote) onToggle(t.id, dayKey, !day?.manual)
              else if (day?.noteId) onOpenNote?.(day.noteId)
            }}
          >
            <span className={styles.icon}>
              {day ? <Check size={12} weight="bold" aria-hidden /> : <TypeIcon name={t.icon} size={12} />}
            </span>
            <span className={styles.name}>{t.name}</span>
            {fromNote && <span className={styles.suffix}>· note</span>}
          </button>
        )
      })}
    </div>
  )
}
