import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { nanoid } from 'nanoid'
import { X } from '@phosphor-icons/react'
import type { Note, Notebook } from '../../types'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs } from '../../lib/calendar'
import {
  loadPlanEntries,
  rememberAgentNote,
  replacedPlanNote,
  savedAgentNoteId,
  type AgentNoteDraft,
  type AgentNoteRequest,
} from '../../lib/agentNotes'
import { nameKey, type PlanDraft } from '../../lib/plan'
import type { PlanEntry } from '../../lib/planNotes'
import { loadLastNotebookId, saveLastNotebookId } from './SaveToNoteModal'
import styles from './SaveToNoteModal.module.css'
import own from './SaveAgentNoteModal.module.css'

// "Save as Plan note": grava a resposta do planner como nota do tipo de plano,
// com as propriedades; no replanejamento, oferece arquivar o plano antigo.
// "Save study profile": grava o bloco de perfil do tutor como nota com a tag
// do perfil. Uma resposta já salva abre em "already" (sem duplicar).

export interface SaveAgentNoteModalProps {
  open: boolean
  draft: AgentNoteDraft | null
  notebooks: Notebook[]
  notes: Note[]
  // Caderno da pasta da conversa (pré-selecionado); null = último usado.
  defaultNotebookId: string | null
  // `requestId` é um por ação e reaproveitado pelo "Try again" (janela Assistant).
  onCreate: (req: AgentNoteRequest, requestId: string) => Promise<Note>
  onNavigateToNote: (notebookId: string, noteId: string) => void
  onClose: () => void
}

type Stage =
  | { kind: 'already'; note: Note }
  | { kind: 'form' }
  | { kind: 'saving' }
  | { kind: 'success'; notebookId: string; notebookName: string; noteId: string; noteTitle: string }
  | { kind: 'error'; message: string; retry: () => void }

// '2026-11-30' → '30/11/2026'
function dmy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Por que o rascunho não pode virar nota de plano; null = pode.
function planIssueText(plan: PlanDraft): string | null {
  if (plan.issue === 'noDates') {
    return 'No checklist item starts with a date (dd/mm), so the coach could not track this plan. Ask the planner to redo it with a date at the start of each item.'
  }
  if (plan.issue === 'endBeforeStart') {
    return `The End (${dmy(plan.end!)}) is before the Start (${dmy(plan.start!)}). Ask the planner to fix the dates.`
  }
  return null
}

export function SaveAgentNoteModal({
  open,
  draft,
  notebooks,
  notes,
  defaultNotebookId,
  onCreate,
  onNavigateToNote,
  onClose,
}: SaveAgentNoteModalProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'form' })
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [archivePrevious, setArchivePrevious] = useState(true)
  // Notas de plano lidas do storage ao abrir (só com "Replaces:"); null = carregando.
  const [planEntries, setPlanEntries] = useState<PlanEntry[] | null>(null)
  const titleRef = useRef<HTMLInputElement | null>(null)

  const targets = useMemo(() => notebooks.filter((nb) => nb.id !== CALENDAR_NOTEBOOK_ID), [notebooks])
  const plan = draft?.kind === 'plan' ? draft.plan : null
  const profile = draft?.kind === 'profile' ? draft.profile : null
  const savedId = open && draft ? savedAgentNoteId(draft.messageId) : null
  const replaced = useMemo(
    () => (open && plan && planEntries ? replacedPlanNote(plan, planEntries, savedId) : null),
    [open, plan, planEntries, savedId]
  )

  useEffect(() => {
    setPlanEntries(null)
    if (!open || !plan?.replaces || plan.issue) return
    let cancelled = false
    loadPlanEntries(dateKeyFromMs(Date.now()))
      .then((entries) => {
        if (!cancelled) setPlanEntries(entries)
      })
      .catch((err) => console.warn('failed to load plans for archive previous plan', err))
    return () => {
      cancelled = true
    }
  }, [open, plan])

  // Reset a cada abertura (ou resposta nova).
  useEffect(() => {
    if (!open || !draft) return
    const saved = savedId ? notes.find((n) => n.id === savedId) : undefined
    setStage(saved ? { kind: 'already', note: saved } : { kind: 'form' })
    const last = loadLastNotebookId()
    // Perfil: o caderno citado no cabeçalho do bloco vem antes.
    const named =
      draft.kind === 'profile' && draft.profile.notebookName
        ? targets.find((nb) => nameKey(nb.name) === nameKey(draft.profile.notebookName!))?.id
        : undefined
    const pick =
      [named, defaultNotebookId, last].find((id) => id && targets.some((nb) => nb.id === id)) ??
      targets[0]?.id ??
      null
    setNotebookId(pick)
    setTitle(
      draft.kind === 'profile'
        ? draft.profile.title
        : (draft.plan.title ?? (draft.plan.book ? `Plan — ${draft.plan.book}` : 'Plan'))
    )
    setArchivePrevious(true)
    // Só na abertura: atualizações de notas/cadernos durante o modal não o reiniciam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft?.messageId])

  useEffect(() => {
    if (open && stage.kind === 'form') titleRef.current?.focus()
  }, [open, stage.kind])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !draft) return null
  const nbName = (id: string | null) => notebooks.find((nb) => nb.id === id)?.name ?? ''
  const action = profile ? 'Save study profile' : 'Save as Plan note'
  const planIssue = plan ? planIssueText(plan) : null
  const undated = plan ? plan.items - plan.datedItems : 0

  const summary = plan
    ? planIssue ?? [
        `Start ${dmy(plan.start!)} to End ${dmy(plan.end!)}`,
        `${plan.items} item${plan.items === 1 ? '' : 's'}` + (undated > 0 ? ` (${undated} without a date)` : ''),
        plan.capacity !== null ? `Capacity ${plan.capacity}h/day` : null,
        plan.book ? `Book ${plan.book}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Creates a note tagged "study profile". The tutor reads it as the goal and level of this notebook.'

  async function save(req: AgentNoteRequest, requestId = nanoid()) {
    setStage({ kind: 'saving' })
    try {
      const note = await onCreate(req, requestId)
      rememberAgentNote(draft!.messageId, note.id)
      saveLastNotebookId(req.notebookId)
      setStage({
        kind: 'success',
        notebookId: req.notebookId,
        notebookName: nbName(req.notebookId),
        noteId: note.id,
        noteTitle: note.title.trim() || req.title,
      })
    } catch (err) {
      setStage({
        kind: 'error',
        message: err instanceof Error ? err.message : `Failed to save the ${profile ? 'profile' : 'plan'}.`,
        retry: () => void save(req, requestId),
      })
    }
  }

  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed || !notebookId) return
    if (profile) {
      void save({ kind: 'profile', notebookId, title: trimmed, content: profile.body })
      return
    }
    if (!plan || planIssue) return
    void save({
      kind: 'plan',
      notebookId,
      title: trimmed,
      content: plan.body,
      start: plan.start!,
      end: plan.end!,
      capacity: plan.capacity,
      book: plan.book,
      archiveNoteId: replaced && archivePrevious ? replaced.id : null,
    })
  }

  function renderStage() {
    if (stage.kind === 'already') {
      const note = stage.note
      return (
        <div className={styles.body}>
          <p className={styles.successHelp}>
            This {profile ? 'profile' : 'plan'} was already saved as{' '}
            <span className={styles.targetNote}>{note.title.trim() || 'Untitled'}</span>
            {note.notebookId && (
              <>
                {' '}(<span className={styles.targetNotebook}>{nbName(note.notebookId)}</span>)
              </>
            )}
            .
          </p>
          <div className={styles.footerActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setStage({ kind: 'form' })}>
              Save a copy
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                if (note.notebookId) onNavigateToNote(note.notebookId, note.id)
                onClose()
              }}
            >
              Go to note
            </button>
          </div>
        </div>
      )
    }

    if (stage.kind === 'form') {
      if (targets.length === 0) {
        return (
          <div className={styles.body}>
            <p className={styles.emptyHelp}>Create a notebook first to save this {profile ? 'profile' : 'plan'}.</p>
            <div className={styles.footerActions}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )
      }
      if (planIssue) {
        return (
          <div className={styles.body}>
            <p className={styles.emptyHelp}>{planIssue}</p>
            <div className={styles.footerActions}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )
      }
      return (
        <div className={styles.body}>
          <p className={own.summary}>{summary}</p>
          <p className={styles.stepLabel}>Notebook</p>
          <ul className={styles.list} role="listbox" aria-label="notebook">
            {targets.map((nb) => (
              <li key={nb.id}>
                <button
                  type="button"
                  className={`${styles.listItem} ${nb.id === notebookId ? styles.listItemPicked : ''}`}
                  onClick={() => setNotebookId(nb.id)}
                  aria-selected={nb.id === notebookId}
                >
                  <span className={styles.listItemLabel}>{nb.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.stepLabel}>Title</p>
          <input
            ref={titleRef}
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
            aria-label={profile ? 'study profile title' : 'plan note title'}
          />
          {replaced && (
            <label className={own.checkRow}>
              <input
                type="checkbox"
                checked={archivePrevious}
                onChange={(e) => setArchivePrevious(e.target.checked)}
              />
              Archive previous plan "{replaced.title.trim() || 'Untitled'}"
            </label>
          )}
          {plan && (
            <p className={styles.emptyHelp}>
              Creates a note of the plan type with these properties. From then on it is your note.
            </p>
          )}
          <div className={styles.footerActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={!title.trim() || !notebookId}
            >
              {action}
            </button>
          </div>
        </div>
      )
    }

    if (stage.kind === 'saving') {
      return (
        <div className={styles.body}>
          <p className={styles.stepLabel}>Saving...</p>
          <div className={styles.savingDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )
    }

    if (stage.kind === 'success') {
      return (
        <div className={styles.body}>
          <p className={styles.successTitle}>{profile ? 'Profile saved' : 'Plan saved'}</p>
          <p className={styles.successHelp}>
            Saved as {profile ? 'study profile' : 'Plan note'} in <span className={styles.targetNotebook}>{stage.notebookName}</span>
            {' / '}
            <span className={styles.targetNote}>{stage.noteTitle}</span>.
          </p>
          <div className={styles.footerActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                onNavigateToNote(stage.notebookId, stage.noteId)
                onClose()
              }}
            >
              Go to note
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className={styles.body}>
        <p className={styles.errorTitle}>Could not save</p>
        <p className={styles.errorBody}>{stage.message}</p>
        <div className={styles.footerActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.btnPrimary} onClick={stage.retry}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  return createPortal(
    <div
      className={`${styles.overlay} ${own.overlayTop}`}
      role="dialog"
      aria-modal="true"
      aria-label={action}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>{action}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="close">
            <X size={14} aria-hidden />
          </button>
        </header>
        {renderStage()}
      </div>
    </div>,
    document.body
  )
}
