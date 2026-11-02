import { useEffect, useMemo, useState } from 'react'
import type { Note, Notebook, NoteType } from '../../types'
import { scoreRelatedNotes } from './scoreNotes'
import { findTermLinkedNotes, relatedTermsKey, relatedTermsOf, type TermReason } from '../../lib/relatedTerms'
import { notePreview } from '../../lib/noteSearch'
import { TypeEyebrow } from '../NoteTypes/TypeEyebrow'
import styles from './RelatedContent.module.css'

interface Props {
  activeNote: Note
  notes: Note[]
  notebooks: Notebook[]
  noteTypes: NoteType[]
  // Só o grupo dos termos, sem sugestões automáticas (nota diária).
  termsOnly?: boolean
  onSelect: (id: string) => void
}

// Notas do grupo dos termos visíveis antes do "Show N more".
const TERMS_VISIBLE = 8
// Espera do termo editado antes de recalcular (digitar dentro de um termo).
const TERMS_DEBOUNCE_MS = 400

function reasonText(r: TermReason): string {
  return r.found ? `mentions "${r.term}" ≈ "${r.found}"` : `mentions "${r.term}"`
}

export function RelatedContent({ activeNote, notes, notebooks, noteTypes, termsOnly = false, onSelect }: Props) {
  // Começa fechado: a lista ocupa muito espaço. O App remonta por nota
  // (key = id), então cada nota aberta volta fechada.
  const [open, setOpen] = useState(false)
  const [showAllTerms, setShowAllTerms] = useState(false)
  // Chip de termo ativo (RelatedTerm.key): o grupo mostra só as notas dele.
  const [termFilter, setTermFilter] = useState<string | null>(null)
  // Recalcula só quando a nota ativa muda, entra/sai uma nota ou mudam os
  // termos da nota ativa (com debounce), não a cada tecla: o cálculo passa
  // por todas as notas e travava a digitação.
  const notesKey = notes.map((n) => n.id).join('|')
  const termsKey = relatedTermsKey(activeNote)
  const [debouncedTermsKey, setDebouncedTermsKey] = useState(termsKey)
  useEffect(() => {
    if (termsKey === debouncedTermsKey) return
    const timer = setTimeout(() => setDebouncedTermsKey(termsKey), TERMS_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [termsKey, debouncedTermsKey])
  // Os termos da nota vêm junto das notas achadas, para os chips seguirem o
  // mesmo debounce.
  const { terms, termHits } = useMemo(
    () => ({ terms: relatedTermsOf(activeNote), termHits: findTermLinkedNotes(activeNote, notes) }),
    [activeNote.id, notesKey, debouncedTermsKey]
  )
  // Notas por termo da nota ativa, inclusive os que não acham nenhuma.
  const termCounts = useMemo(
    () => terms.map((term) => ({ term, count: termHits.filter((h) => h.reasons.some((r) => r.key === term.key)).length })),
    [terms, termHits]
  )
  const related = useMemo(
    () =>
      termsOnly
        ? []
        : scoreRelatedNotes(activeNote, notes, { exclude: new Set(termHits.map((h) => h.note.id)) }),
    [activeNote.id, notesKey, termHits, termsOnly]
  )
  const typeById = useMemo(() => new Map(noteTypes.map((t) => [t.id, t])), [noteTypes])

  // Com termo na nota, o painel aparece mesmo sem nenhuma nota achada.
  const showTermsGroup = terms.length > 0 || termHits.length > 0
  if (!showTermsGroup && related.length === 0) return null

  // O filtro cai sozinho se o termo sai da nota ou fica sem notas.
  const filter = termCounts.some((c) => c.term.key === termFilter && c.count > 0) ? termFilter : null
  const shownTerms = filter ? termHits.filter((h) => h.reasons.some((r) => r.key === filter)) : termHits
  const visibleTerms = showAllTerms ? shownTerms : shownTerms.slice(0, TERMS_VISIBLE)
  const hiddenTerms = shownTerms.length - visibleTerms.length

  const renderItem = (note: Note, reasons?: TermReason[]) => {
    const preview = notePreview(note)
    const notebookName = notebooks.find((n) => n.id === note.notebookId)?.name
    const type = note.typeId ? typeById.get(note.typeId) : undefined
    return (
      <li key={note.id} className={styles.item}>
        <button
          type="button"
          className={styles.itemButton}
          onClick={() => onSelect(note.id)}
        >
          {(type || notebookName) && (
            <div className={styles.itemMeta}>
              {type && <TypeEyebrow type={type} />}
              {notebookName && <span className={styles.itemNotebook}>{notebookName}</span>}
            </div>
          )}
          <div className={styles.itemTitle}>
            {note.title.trim() || 'Untitled'}
          </div>
          {reasons && reasons.length > 0 && (
            <div className={styles.itemReason}>{reasons.map(reasonText).join(' · ')}</div>
          )}
          {preview && <div className={styles.itemSnippet}>{preview}</div>}
          {note.tags.length > 0 && (
            <div className={styles.itemTags}>
              {note.tags.map((t) => (
                <span key={t} className={styles.itemTag}>#{t}</span>
              ))}
            </div>
          )}
        </button>
      </li>
    )
  }

  return (
    <div className={styles.related}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
        <span className={styles.title}>Related content</span>
        <span className={styles.count}>{termHits.length + related.length}</span>
      </button>
      {open && (
        <ul className={styles.list}>
          {showTermsGroup && <li className={styles.section}>Linked by terms</li>}
          {terms.length > 0 && (
            <li className={styles.termChips}>
              {termCounts.map(({ term, count }) => {
                const active = filter === term.key
                return (
                  <button
                    key={term.key}
                    type="button"
                    className={`${styles.termChip} ${active ? styles.termChipActive : ''}`}
                    aria-pressed={active}
                    aria-disabled={count === 0 || undefined}
                    title={
                      count === 0
                        ? 'No other note mentions this'
                        : active
                          ? 'Show all terms'
                          : `Only notes that mention "${term.text}"`
                    }
                    onClick={() => {
                      if (count === 0) return
                      setTermFilter(active ? null : term.key)
                      setShowAllTerms(false)
                    }}
                  >
                    <span className={styles.termChipText}>{term.text}</span>
                    <span className={styles.termChipCount}>{count}</span>
                  </button>
                )
              })}
            </li>
          )}
          {visibleTerms.map(({ note, reasons }) => renderItem(note, reasons))}
          {hiddenTerms > 0 && (
            <li className={styles.moreRow}>
              <button type="button" className={styles.more} onClick={() => setShowAllTerms(true)}>
                Show {hiddenTerms} more
              </button>
            </li>
          )}
          {showTermsGroup && related.length > 0 && <li className={styles.section}>Suggested</li>}
          {related.map(({ note }) => renderItem(note))}
        </ul>
      )}
    </div>
  )
}
