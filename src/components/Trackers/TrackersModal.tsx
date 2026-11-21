import { useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Archive, ArrowCounterClockwise, ArrowDown, ArrowUp, Trash } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import type { TrackersRegistry } from '../../hooks/useTrackers'
import { setUpPracticeType } from '../../lib/practiceSetup'
import { normalizeName } from '../../lib/tasks'
import {
  deleteTrackerText,
  linkHint,
  MAX_TRACKER_NAME,
  MAX_WEEKLY_TARGET,
  MIN_WEEKLY_TARGET,
  noteOnlyDayCount,
  typeNotesLabel,
  unlinkConfirmText,
} from '../../lib/trackers'
import type { NoteType, Tracker } from '../../types'
import { IconPicker } from '../NoteTypes/IconPicker'
import { TypeIcon } from '../NoteTypes/TypeIcon'
import { ColorDots } from '../TasksView/ColorDots'
import styles from '../TasksView/StatusManagerModal.module.css'
import own from './TrackersModal.module.css'

// "Trackers": hábitos com meta semanal. Lista à esquerda (ativos na ordem, com
// setas para reordenar, e os arquivados abaixo) e detalhe à direita (nome, meta,
// tipo de nota vinculado, cor, ícone, arquivar e excluir). Sem lembrete, streak
// ou qualquer gamificação.
interface TrackersModalProps {
  registry: TrackersRegistry
  // Tipos de nota do vínculo ("From notes"). Lidos de forma defensiva: o vínculo
  // para um tipo que não existe mais (apagado nesta janela, onde os trackers em
  // memória não recarregam) vale como "None".
  noteTypes: NoteType[]
  // Depois de "Create 'Practice' type": quem chama relê os próprios tipos.
  onTypesChanged: () => void | Promise<unknown>
  // "Open log" na linha de status do atalho Practice. Ausente (a keep não tem a
  // visão Log): sem o botão.
  onOpenLog?: (typeId: string) => void
  onClose: () => void
}

// Valor da opção que cria ou completa o tipo Practice (não é id de tipo).
const PRACTICE_OPTION = '__practice__'
const PRACTICE_NAME = 'practice'

const TARGET_OPTIONS = Array.from(
  { length: MAX_WEEKLY_TARGET - MIN_WEEKLY_TARGET + 1 },
  (_, i) => MIN_WEEKLY_TARGET + i
)

// O tipo que o atalho reaproveita: o 1º tipo não embutido chamado Practice (a mesma
// regra do `practiceSaveChanges`).
function findPracticeType(types: NoteType[]): NoteType | undefined {
  return [...types]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((nt) => !nt.builtin && normalizeName(nt.name.trim()) === PRACTICE_NAME)
}

function targetLabel(n: number): string {
  if (n === 1) return '1 time a week'
  return n === MAX_WEEKLY_TARGET ? `${n} times a week (daily)` : `${n} times a week`
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Esc no campo descarta o rascunho (o blur que segue não grava).
function draftKeys(cancelRef: { current: boolean }) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      cancelRef.current = true
      e.currentTarget.blur()
    }
  }
}

export function TrackersModal({ registry, noteTypes, onTypesChanged, onOpenLog, onClose }: TrackersModalProps) {
  const { trackers, active } = registry
  const archived = trackers.filter((t) => t.archivedAt !== null)
  const { confirm, modal } = useConfirm()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Avisos do "Practice" (propriedade existente com outro tipo de dado).
  const [warnings, setWarnings] = useState<string[]>([])
  // Retorno do atalho Practice: o que foi criado ou reaproveitado, no tracker que o
  // acionou.
  const [setup, setSetup] = useState<{ trackerId: string; typeId: string; message: string } | null>(null)
  const [newName, setNewName] = useState('')
  const cancelRef = useRef(false)
  const onDraftKeys = draftKeys(cancelRef)

  const selected = trackers.find((t) => t.id === selectedId) ?? active[0] ?? trackers[0] ?? null

  async function run(op: () => Promise<unknown>): Promise<boolean> {
    try {
      await op()
      setError(null)
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    }
  }

  // Commit do nome no blur: Esc ou valor igual não gravam; em erro, o campo
  // volta ao valor salvo.
  function commitName(input: HTMLInputElement, t: Tracker) {
    if (cancelRef.current) {
      cancelRef.current = false
      input.value = t.name
      return
    }
    if (input.value.trim() === t.name.trim()) return
    void run(() => registry.updateTracker(t.id, { name: input.value })).then((ok) => {
      if (!ok) input.value = t.name
    })
  }

  async function handleCreate() {
    if (await run(async () => setSelectedId((await registry.createTracker(newName)).id))) setNewName('')
  }

  function handleMove(index: number, delta: -1 | 1) {
    const ids = active.map((t) => t.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    void run(() => registry.reorderTrackers(ids))
  }

  // "None", um tipo ou o atalho do Practice (cria ou completa o tipo, relê os
  // tipos e só então vincula, para o seletor já achar o tipo). Trocar o vínculo
  // com dias que só contam pelas notas pede confirmação (as notas ficam; religar
  // traz os dias de volta). Cancelar não muda nada: o seletor é controlado.
  async function handleLink(t: Tracker, value: string) {
    const current = noteTypes.find((nt) => nt.id === t.linkedTypeId)
    const nextId = value === PRACTICE_OPTION ? (findPracticeType(noteTypes)?.id ?? null) : value || null
    if (current && nextId !== current.id) {
      const mine = registry.days.get(t.id)
      const count = mine ? noteOnlyDayCount(mine) : 0
      if (count > 0) {
        const ok = await confirm(unlinkConfirmText(t.name, current.name, count), {
          title: 'Change linked type',
          confirmLabel: 'Change',
        })
        if (!ok) return
      }
    }
    if (value !== PRACTICE_OPTION) {
      setWarnings([])
      setSetup(null)
      void run(() => registry.updateTracker(t.id, { linkedTypeId: value || null }))
      return
    }
    void run(async () => {
      const { typeId, warnings: found, message } = await setUpPracticeType()
      await onTypesChanged()
      await registry.updateTracker(t.id, { linkedTypeId: typeId })
      setWarnings(found)
      setSetup({ trackerId: t.id, typeId, message })
    })
  }

  // A contagem de marcas é lida no momento do clique, não a do render.
  async function handleDelete(t: Tracker) {
    let count: number
    try {
      count = await registry.countMarks(t.id)
    } catch (err) {
      setError(errorText(err))
      return
    }
    const linkedType = noteTypes.find((nt) => nt.id === t.linkedTypeId)
    const ok = await confirm(deleteTrackerText(t.name, count, linkedType?.name ?? null), {
      title: 'Delete tracker',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (ok) void run(() => registry.deleteTracker(t.id))
  }

  function renderRow(t: Tracker, index: number | null) {
    const isArchived = index === null
    return (
      <div key={t.id} className={`${own.row} ${t.id === selected?.id ? own.rowActive : ''}`}>
        <button
          type="button"
          className={`${own.rowButton} ${isArchived ? own.rowArchived : ''}`}
          onClick={() => setSelectedId(t.id)}
          aria-pressed={t.id === selected?.id}
        >
          <span className={own.rowIcon} style={{ color: t.color }}>
            <TypeIcon name={t.icon} />
          </span>
          <span className={own.rowName}>{t.name}</span>
          <span className={own.rowMeta}>{t.weeklyTarget}/week</span>
        </button>
        {index !== null && active.length > 1 && (
          <>
            <button
              type="button"
              className={own.move}
              onClick={() => handleMove(index, -1)}
              disabled={index === 0}
              aria-label={`move ${t.name} up`}
              title="Move up"
            >
              <ArrowUp size={12} weight="bold" aria-hidden />
            </button>
            <button
              type="button"
              className={own.move}
              onClick={() => handleMove(index, 1)}
              disabled={index === active.length - 1}
              aria-label={`move ${t.name} down`}
              title="Move down"
            >
              <ArrowDown size={12} weight="bold" aria-hidden />
            </button>
          </>
        )}
      </div>
    )
  }

  function renderDetail(t: Tracker) {
    const isArchived = t.archivedAt !== null
    const linkableTypes = noteTypes.filter((nt) => !nt.builtin)
    const practiceExists = linkableTypes.some((nt) => normalizeName(nt.name.trim()) === PRACTICE_NAME)
    const linkedType = noteTypes.find((nt) => nt.id === t.linkedTypeId)
    const linkedTypeId = linkedType?.id ?? ''
    return (
      <div className={own.detail}>
        <div className={own.field}>
          <span className={own.label}>Name</span>
          <input
            className={styles.nameInput}
            key={`${t.id}:${t.name}`}
            defaultValue={t.name}
            maxLength={MAX_TRACKER_NAME}
            aria-label="tracker name"
            onBlur={(e) => commitName(e.currentTarget, t)}
            onKeyDown={onDraftKeys}
          />
        </div>
        <div className={own.field}>
          <span className={own.label}>Weekly target</span>
          <select
            className={own.select}
            value={t.weeklyTarget}
            onChange={(e) => void run(() => registry.updateTracker(t.id, { weeklyTarget: Number(e.target.value) }))}
            aria-label="weekly target"
          >
            {TARGET_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {targetLabel(n)}
              </option>
            ))}
          </select>
        </div>
        <p className={own.hint}>Past weeks are checked against the current target.</p>
        <div className={own.field}>
          <span className={own.label}>From notes</span>
          <select
            className={own.select}
            value={linkedTypeId}
            onChange={(e) => void handleLink(t, e.target.value)}
            aria-label="linked note type"
          >
            <option value="">None</option>
            {linkableTypes.map((nt) => (
              <option key={nt.id} value={nt.id}>
                {typeNotesLabel(nt.name)}
              </option>
            ))}
            <option value={PRACTICE_OPTION}>{practiceExists ? "Set up 'Practice' type" : "Create 'Practice' type"}</option>
          </select>
        </div>
        {linkedType && <p className={own.hint}>{linkHint(linkedType.name)}</p>}
        {setup?.trackerId === t.id && (
          <p className={own.status} role="status">
            <span>{setup.message}</span>
            {onOpenLog && (
              <button type="button" className={own.statusBtn} onClick={() => onOpenLog(setup.typeId)}>
                Open log
              </button>
            )}
          </p>
        )}
        <div className={own.field}>
          <span className={own.label}>Color</span>
          <ColorDots
            value={t.color}
            onChange={(color) => {
              if (color) void run(() => registry.updateTracker(t.id, { color }))
            }}
            label="tracker color"
          />
        </div>
        <div className={`${own.field} ${own.iconField}`}>
          <span className={own.label}>Icon</span>
          <IconPicker
            value={t.icon}
            onChange={(name) => void run(() => registry.updateTracker(t.id, { icon: name }))}
            label="tracker icon"
          />
        </div>

        <div className={own.actions}>
          <button
            type="button"
            className={own.action}
            onClick={() => void run(() => registry.setArchived(t.id, !isArchived))}
            title={
              isArchived
                ? 'Show it again in the Calendar and in the day note'
                : 'Hide it from the Calendar and the day note; the history is kept'
            }
          >
            {isArchived ? <ArrowCounterClockwise size={13} aria-hidden /> : <Archive size={13} aria-hidden />}
            {isArchived ? 'Unarchive' : 'Archive'}
          </button>
          <button type="button" className={own.deleteBtn} onClick={() => void handleDelete(t)}>
            <Trash size={13} aria-hidden />
            Delete
          </button>
        </div>
      </div>
    )
  }

  const shownError = error ?? registry.saveError

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${styles.card} ${own.card}`}
        role="dialog"
        aria-modal="true"
        aria-label="Trackers"
        onKeyDown={(e) => {
          if (
            e.key === 'Escape' &&
            !(e.target instanceof HTMLInputElement) &&
            !(e.target instanceof HTMLTextAreaElement)
          ) {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <div className={styles.header}>
          <p className={styles.title}>Trackers</p>
          <button type="button" className={styles.close} onClick={onClose}>
            Done
          </button>
        </div>
        <div className={own.columns}>
          <div className={own.list}>
            {active.map((t, i) => renderRow(t, i))}
            {archived.length > 0 && (
              <>
                <p className={own.groupLabel}>Archived</p>
                {archived.map((t) => renderRow(t, null))}
              </>
            )}
            <div className={styles.create}>
              <input
                className={styles.nameInput}
                value={newName}
                maxLength={MAX_TRACKER_NAME}
                placeholder="New tracker…"
                aria-label="new tracker name"
                // Sem tracker ativo (inclui quando vem do "New tracker" da faixa, que só
                // existe nesse caso), o campo já nasce focado.
                autoFocus={active.length === 0}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate()
                }}
              />
              <button type="button" className={styles.add} onClick={() => void handleCreate()}>
                Add
              </button>
            </div>
          </div>
          {selected ? (
            renderDetail(selected)
          ) : (
            <p className={own.empty}>
              No trackers yet. Add one to count a habit by week (for example, Guitar 3 times a week).
            </p>
          )}
        </div>
        {shownError && (
          <p className={styles.error} role="alert">
            {shownError}
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} className={own.warning} role="status">
            {w}
          </p>
        ))}
        {modal}
      </div>
    </div>,
    document.body
  )
}
