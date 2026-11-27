import { useEffect, useLayoutEffect, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { MagnifyingGlass, Plus, SpeakerHigh, Translate, Trash, X } from '@phosphor-icons/react'
import type { VocabularyItem } from '../../types'
import { getUserLocale } from '../../lib/languageSettings'
import { formatVocabularyDate, normalizeTerm, splitAtTerm } from '../../lib/vocabulary'
import { placeFloatingPanel, type PlacementAnchor } from '../Reader/toolbarPlacement'
import base from './TranslatePopover.module.css'
import own from './SavedWordPopover.module.css'

export interface SavedWordPopoverProps {
  // Retângulo da palavra clicada, em coordenadas da janela (o popover é `fixed`).
  anchor: PlacementAnchor
  // A palavra como está no texto.
  term: string
  // Os itens guardados que a marca mostra: deste livro e de outros da mesma língua.
  items: VocabularyItem[]
  bookId: string
  bookTitles: ReadonlyMap<string, string>
  onListen: (text: string) => void
  onTranslateHere: () => void
  onAddSentence: () => void
  // "Find in book" só existe onde há busca (o PDF).
  onFind?: () => void
  // Remove só os itens deste livro.
  onRemove: () => void
  onClose: () => void
  // Raiz do popover: o clique fora o fecha, e o do leitor o ignora.
  rootRef: RefObject<HTMLDivElement | null>
}

// A frase de origem com o termo guardado em negrito (sem diferença de caixa).
function sentenceWithTerm(item: VocabularyItem): ReactNode {
  const parts = item.kind === 'sentence' ? null : splitAtTerm(item.sentence, item.text)
  if (!parts) return item.sentence
  return (
    <>
      {parts.before}
      <strong>{parts.match}</strong>
      {parts.after}
    </>
  )
}

// O popover de uma palavra marcada no texto ("onde você guardou"): as frases em
// que ela foi guardada, com o livro, a posição e o sentido, e o que fazer com ela.
// Sem "I know this": a lista é de quem guardou, e o único gesto de saída é Remove.
export function SavedWordPopover({
  anchor,
  term,
  items,
  bookId,
  bookTitles,
  onListen,
  onTranslateHere,
  onAddSentence,
  onFind,
  onRemove,
  onClose,
  rootRef,
}: SavedWordPopoverProps) {
  const locale = getUserLocale()
  // Deste livro primeiro, depois os de outros, cada grupo na ordem em que foi guardado.
  const rows = [...items].sort((a, b) => Number(a.bookId !== bookId) - Number(b.bookId !== bookId))
  const hasOwn = rows.some((i) => i.bookId === bookId)
  const hasOther = rows.some((i) => i.bookId !== bookId)
  // Uma frase guardada marca o trecho inteiro: não há palavra a traduzir nem frase a juntar.
  const onlySentences = rows.every((i) => i.kind === 'sentence')
  const baseForm = rows.find((i) => i.baseForm && normalizeTerm(i.baseForm) !== normalizeTerm(term))?.baseForm

  // Sem seleção do leitor que o feche: Esc e o clique fora fecham.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [rootRef, onClose])

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    el.style.maxHeight = ''
    const placed = placeFloatingPanel(
      anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    el.style.left = `${placed.left}px`
    el.style.top = `${placed.top}px`
    el.style.maxHeight = `${Math.min(460, placed.maxHeight)}px`
  }, [rootRef, anchor.x, anchor.y, anchor.w, anchor.h, rows.length])

  return createPortal(
    <div
      ref={rootRef}
      className={base.popover}
      role="dialog"
      aria-label="Saved in your vocabulary"
      // O clique no popover não desfaz a seleção do texto nem tira o foco da página.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className={base.header}>
        {onlySentences ? <div className={base.kind}>In your vocabulary · sentence</div> : <div className={base.term}>{term}</div>}
        <button type="button" className={base.close} onClick={onClose} aria-label="Close" title="Close (Esc)">
          <X size={14} aria-hidden />
        </button>
      </div>
      {baseForm && !onlySentences && <div className={base.sub}>{baseForm}</div>}
      <div className={base.body}>
        {!onlySentences && <div className={own.section}>In your vocabulary: where you saved it</div>}
        {rows.map((item) => {
          const other = item.bookId !== bookId
          const date = formatVocabularyDate(item.createdAt, locale)
          return (
            <div key={item.id} className={base.context}>
              {sentenceWithTerm(item)}
              <small>
                {other && (
                  <>
                    <span className={own.otherBook}>Saved in another book</span>
                    {bookTitles.get(item.bookId) ? ` · ${bookTitles.get(item.bookId)}` : ''}
                    {' · '}
                  </>
                )}
                {item.positionLabel}
                {date && ` · ${date}`}
                {item.sentAt && ' · sent to notebook'}
              </small>
              {item.sense && item.kind !== 'sentence' && <div className={own.sense}>{item.sense}</div>}
              {item.sense && item.kind === 'sentence' && <div className={own.sentenceSense}>{item.sense}</div>}
              {!item.sense && <div className={own.noSense}>No translation saved</div>}
            </div>
          )
        })}
      </div>
      <div className={base.actions}>
        <button type="button" className={base.action} onClick={() => onListen(onlySentences ? rows[0].sentence : term)}>
          <SpeakerHigh size={13} aria-hidden />
          Listen
        </button>
        {!onlySentences && (
          <button type="button" className={base.action} onClick={onTranslateHere}>
            <Translate size={13} aria-hidden />
            Translate here
          </button>
        )}
        {!onlySentences && (
          <button type="button" className={base.action} onClick={onAddSentence}>
            <Plus size={13} aria-hidden />
            Add this sentence
          </button>
        )}
        {onFind && !onlySentences && (
          <button type="button" className={base.action} onClick={onFind}>
            <MagnifyingGlass size={13} aria-hidden />
            Find in book
          </button>
        )}
        {hasOwn && (
          <button
            type="button"
            className={base.action}
            onClick={onRemove}
            title={hasOther ? 'Removes only what you saved in this book' : undefined}
          >
            <Trash size={13} aria-hidden />
            {hasOther ? 'Remove from this book' : 'Remove'}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
