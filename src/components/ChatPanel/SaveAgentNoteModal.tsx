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
import { paperAuthorsText, paperNoteContent, paperNoteTitle } from '../../lib/papers'
import { inspectPaperType, READING_LIST_CHANGED_EVENT } from '../../lib/paperSetup'
import { nameKey, type PlanDraft } from '../../lib/plan'
import type { PlanEntry } from '../../lib/planNotes'
import { loadLastNotebookId, saveLastNotebookId } from './SaveToNoteModal'
import styles from './SaveToNoteModal.module.css'
import own from './SaveAgentNoteModal.module.css'

// "Save as Plan note": grava a resposta do planner como nota do tipo de plano,
// com as propriedades; no replanejamento, oferece arquivar o plano antigo.
// "Save study profile": grava o bloco de perfil do tutor como nota com a tag
// do perfil. "Save radar profile": o mesmo com o perfil do Radar. "Add to
// reading list": cria a nota do tipo Paper de um artigo. Uma resposta (ou um
// artigo) já salva abre em "already" (sem duplicar).

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
  // "Open reading list" do sucesso do "Add to reading list": abre o board do tipo
  // Paper. Ausente = sem o botão (a janela assistant não tem o board).
  onOpenReadingList?: () => void
  onClose: () => void
}

// O que o "Add to reading list" diz no sucesso além de "Paper added".
interface PaperNotice {
  firstTime: boolean // o tipo Paper foi criado agora
  warnings: string[] // propriedade que o tipo Paper tem com outro tipo de dado
}

type Stage =
  | { kind: 'already'; note: Note }
  | { kind: 'form' }
  | { kind: 'saving' }
  | {
      kind: 'success'
      notebookId: string
      notebookName: string
      noteId: string
      noteTitle: string
      paper: PaperNotice | null
    }
  | { kind: 'error'; message: string; retry: () => void }

// Textos do modal por tipo de rascunho.
const KIND_TEXT: Record<
  AgentNoteDraft['kind'],
  { action: string; noun: string; inputLabel: string; savedTitle: string; savedAs: string; summary: string | null }
> = {
  plan: {
    action: 'Save as Plan note',
    noun: 'plan',
    inputLabel: 'plan note title',
    savedTitle: 'Plan saved',
    savedAs: 'Plan note',
    summary: null, // o resumo do plano vem do rascunho (datas, itens, capacidade, livro)
  },
  profile: {
    action: 'Save study profile',
    noun: 'profile',
    inputLabel: 'study profile title',
    savedTitle: 'Profile saved',
    savedAs: 'study profile',
    summary: 'Creates a note tagged "study profile". The tutor reads it as the goal and level of this notebook.',
  },
  radarProfile: {
    action: 'Save radar profile',
    noun: 'radar profile',
    inputLabel: 'radar profile title',
    savedTitle: 'Radar profile saved',
    savedAs: 'radar profile',
    summary:
      'Creates a note tagged "radar profile". The Radar reads it to choose what to follow, which sources to prefer and what to ignore. It applies to every Radar check, in any notebook. With more than one, the most recently edited wins.',
  },
  paper: {
    action: 'Add to reading list',
    noun: 'paper',
    inputLabel: 'paper note title',
    savedTitle: 'Paper added',
    savedAs: 'paper',
    summary:
      'Creates a Paper note (Status: To read) with the DOI link, the PDF link when there is one, authors, year, abstract, the reason and an empty "My notes" section. The Paper type is created on first use, with a board by Status.',
  },
}

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
  onOpenReadingList,
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
  const radarProfile = draft?.kind === 'radarProfile' ? draft.profile : null
  const paper = draft?.kind === 'paper' ? draft : null
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
      draft.kind === 'plan'
        ? (draft.plan.title ?? (draft.plan.book ? `Plan — ${draft.plan.book}` : 'Plan'))
        : draft.kind === 'paper'
          ? paperNoteTitle(draft.paper)
          : draft.profile.title
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
  const text = KIND_TEXT[draft.kind]
  const action = text.action
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
    : (text.summary ?? '')

  // `paperNotice`: o estado do tipo Paper lido antes da 1ª gravação; o "Try again"
  // o reaproveita (a 1ª tentativa pode já ter criado o tipo).
  async function save(req: AgentNoteRequest, requestId = nanoid(), paperNotice?: PaperNotice | null) {
    setStage({ kind: 'saving' })
    let notice = paperNotice ?? null
    try {
      if (req.kind === 'paper' && paperNotice === undefined) {
        // Só leitura; falhar aqui não impede a nota (sem o aviso e sem a frase da 1ª vez).
        notice = await inspectPaperType().then(
          (info) => ({ firstTime: !info.exists, warnings: info.warnings }),
          () => null
        )
      }
      const note = await onCreate(req, requestId)
      rememberAgentNote(draft!.messageId, note.id)
      saveLastNotebookId(req.notebookId)
      // A lista de itens relê a fila de leitura (a nota já está no banco).
      if (req.kind === 'paper') window.dispatchEvent(new Event(READING_LIST_CHANGED_EVENT))
      setStage({
        kind: 'success',
        notebookId: req.notebookId,
        notebookName: nbName(req.notebookId),
        noteId: note.id,
        noteTitle: note.title.trim() || req.title,
        paper: notice,
      })
    } catch (err) {
      setStage({
        kind: 'error',
        message: err instanceof Error ? err.message : `Failed to save the ${text.noun}.`,
        retry: () => void save(req, requestId, notice),
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
    if (radarProfile) {
      // O editor junta linhas simples num parágrafo: uma linha vazia entre as
      // linhas Follow/Sources/Ignore, como no perfil de estudo.
      void save({
        kind: 'radarProfile',
        notebookId,
        title: trimmed,
        content: radarProfile.body.split('\n').join('\n\n'),
      })
      return
    }
    if (paper) {
      void save({
        kind: 'paper',
        notebookId,
        title: trimmed,
        content: paperNoteContent(paper.paper, paper.reason, dateKeyFromMs(Date.now()), paper.agentLabel),
        year: paper.paper.year,
        authors: paperAuthorsText(paper.paper),
        doi: paper.paper.doi,
        openalexId: paper.paper.openalexId,
      })
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
            This {text.noun} was already saved as{' '}
            <span className={styles.targetNote}>{note.title.trim() || 'Untitled'}</span>
            {note.notebookId && (
              <>
                {' '}(<span className={styles.targetNotebook}>{nbName(note.notebookId)}</span>)
              </>
            )}
            .
          </p>
          <div className={styles.footerActions}>
            {/* Um artigo não se salva duas vezes: a cópia furaria o dedupe da fila. */}
            {!paper && (
              <button type="button" className={styles.btnSecondary} onClick={() => setStage({ kind: 'form' })}>
                Save a copy
              </button>
            )}
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
            <p className={styles.emptyHelp}>Create a notebook first to save this {text.noun}.</p>
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
            aria-label={text.inputLabel}
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
          <p className={styles.successTitle}>{text.savedTitle}</p>
          <p className={styles.successHelp}>
            Saved as {text.savedAs} in <span className={styles.targetNotebook}>{stage.notebookName}</span>
            {' / '}
            <span className={styles.targetNote}>{stage.noteTitle}</span>.
          </p>
          {stage.paper?.firstTime && (
            <p className={styles.emptyHelp}>Your reading list is the Paper board in the notebook column.</p>
          )}
          {stage.paper?.warnings.map((warning) => (
            <p key={warning} className={styles.errorMsg} role="status">
              {warning}
            </p>
          ))}
          <div className={styles.footerActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Close
            </button>
            {paper && onOpenReadingList && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  onOpenReadingList()
                  onClose()
                }}
              >
                Open reading list
              </button>
            )}
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
