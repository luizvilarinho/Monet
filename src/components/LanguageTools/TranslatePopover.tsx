import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowCounterClockwise,
  BookmarkSimple,
  GearSix,
  NotePencil,
  Sparkle,
  SpeakerHigh,
  X,
} from '@phosphor-icons/react'
import { LANGUAGE_CODES, languageName } from '../../lib/language'
import {
  TRANSLATE_CHAR_LIMIT,
  TranslateError,
  classifySelection,
  requestTranslation,
  type Translation,
} from '../../lib/translate'
import { splitAtTerm } from '../../lib/vocabulary'
import { placeFloatingPanel, type PlacementAnchor } from '../Reader/toolbarPlacement'
import styles from './TranslatePopover.module.css'

export interface TranslatePopoverProps {
  open: boolean
  // Retângulo da seleção, em coordenadas da janela (o popover é `fixed`).
  anchor: PlacementAnchor
  text: string
  // Frase de contexto da seleção (o bloco da seleção no EPUB; a frase achada no
  // texto limpo da página no PDF).
  sentence: string
  // "p. 42" no PDF, "Chapter 3, 41%" no EPUB.
  positionLabel: string
  sourceLanguage: string
  targetLanguage: string
  model: string
  onListen: (text: string) => void
  // `null` = a tradução ainda não chegou (o item entra sem sentido).
  onAddToVocabulary: (translation: Translation | null) => void
  onAddToNote: () => void
  onAskAi: () => void
  onChangeBookLanguage: (code: string) => void
  onChangeTargetLanguage: (code: string) => void
  onOpenSettings: () => void
  onClose: () => void
  // Raiz do popover: o "clique fora" do leitor ignora cliques dentro dele.
  rootRef: RefObject<HTMLDivElement | null>
  // O popover é de um item que já está no vocabulário (o "Translate" da aba): o
  // botão passa a "Save translation" e só aparece com a tradução pronta, e como
  // não há seleção do leitor para fechá-lo, fecha sozinho com Esc e clique fora.
  savedItem?: boolean
  // O popover não nasce de uma seleção do leitor (o "Translate here" de uma palavra
  // marcada): fecha sozinho com Esc e clique fora, como o de um item, mas guarda
  // como "Add to vocabulary".
  standalone?: boolean
}

type Phase = 'loading' | 'done' | 'error' | 'no_key'

function languageOptions(current: string): readonly string[] {
  const known: readonly string[] = LANGUAGE_CODES
  return current && !known.includes(current) ? [...known, current] : known
}

// A frase de contexto com o termo em negrito (sem diferença de caixa, palavra inteira).
function highlightTerm(sentence: string, term: string): ReactNode {
  const parts = splitAtTerm(sentence, term)
  if (!parts) return sentence
  return (
    <>
      {parts.before}
      <strong>{parts.match}</strong>
      {parts.after}
    </>
  )
}

export function TranslatePopover({
  open,
  anchor,
  text,
  sentence,
  positionLabel,
  sourceLanguage,
  targetLanguage,
  model,
  onListen,
  onAddToVocabulary,
  onAddToNote,
  onAskAi,
  onChangeBookLanguage,
  onChangeTargetLanguage,
  onOpenSettings,
  onClose,
  rootRef,
  savedItem = false,
  standalone = false,
}: TranslatePopoverProps) {
  const term = text.replace(/\s+/g, ' ').trim()
  const context = sentence.replace(/\s+/g, ' ').trim()
  const kind = classifySelection(term, context)
  const tooLong = text.length > TRANSLATE_CHAR_LIMIT
  const isWord = kind !== 'sentence'

  const [requested, setRequested] = useState<Phase>('loading')
  const [translation, setTranslation] = useState<Translation | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const [editingLanguages, setEditingLanguages] = useState(false)

  // A chamada roda ao abrir e a cada troca de texto, língua ou modelo; é
  // abortada ao fechar ou ao trocar. Acima do limite não há chamada.
  useEffect(() => {
    if (!open || tooLong) return
    const controller = new AbortController()
    setRequested('loading')
    setTranslation(null)
    requestTranslation({
      text: term,
      sentence: context,
      kind,
      sourceLanguage,
      targetLanguage,
      model,
      signal: controller.signal,
    })
      .then((result) => {
        setTranslation(result)
        setRequested('done')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setRequested(error instanceof TranslateError && error.kind === 'no_key' ? 'no_key' : 'error')
      })
    return () => controller.abort()
  }, [open, tooLong, term, context, kind, sourceLanguage, targetLanguage, model, retryNonce])

  useEffect(() => {
    if (!open) setEditingLanguages(false)
  }, [open])

  // Item do vocabulário ou palavra marcada: sem seleção que o feche, Esc e o
  // clique fora fecham.
  const selfClosing = savedItem || standalone
  useEffect(() => {
    if (!open || !selfClosing) return
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
  }, [open, selfClosing, rootRef, onClose])

  // Acima do limite não há chamada: o estado é só o aviso.
  const phase: Phase | 'too_long' = tooLong ? 'too_long' : requested

  // Posição contra a janela, medida com o conteúdo atual: abaixo da seleção,
  // acima quando não cabe, ou do lado com mais espaço e com rolagem por dentro.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!open || !el) return
    el.style.maxHeight = ''
    const placed = placeFloatingPanel(
      anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    el.style.left = `${placed.left}px`
    el.style.top = `${placed.top}px`
    el.style.maxHeight = `${Math.min(460, placed.maxHeight)}px`
  }, [open, rootRef, anchor.x, anchor.y, anchor.w, anchor.h, phase, translation, editingLanguages, isWord])

  if (!open) return null

  const actions = (
    <div className={styles.actions}>
      <button type="button" className={styles.action} onClick={() => onListen(term)}>
        <SpeakerHigh size={13} aria-hidden />
        Listen
      </button>
      {phase !== 'too_long' && (!savedItem || translation) && (
        <button type="button" className={styles.action} onClick={() => onAddToVocabulary(translation)}>
          <BookmarkSimple size={13} aria-hidden />
          {savedItem ? 'Save translation' : 'Add to vocabulary'}
        </button>
      )}
      {phase !== 'too_long' && (
        <button type="button" className={styles.action} onClick={onAddToNote}>
          <NotePencil size={13} aria-hidden />
          Add to note
        </button>
      )}
      <button type="button" className={styles.action} onClick={onAskAi}>
        <Sparkle size={13} aria-hidden />
        Ask AI
      </button>
    </div>
  )

  const showFooter = phase === 'loading' || phase === 'done' || phase === 'error'
  const wide = !isWord || phase === 'too_long'

  let sub: string | null = null
  if (phase === 'done' && translation?.kind === 'word') {
    const showBase =
      translation.baseForm !== null && translation.baseForm.toLowerCase() !== term.toLowerCase()
    sub =
      [showBase ? translation.baseForm : null, translation.partOfSpeech, translation.gender]
        .filter(Boolean)
        .join(' · ') || null
  }

  let body: ReactNode
  if (phase === 'loading') {
    body = (
      <div className={styles.body} aria-busy="true">
        <div className={styles.skeleton} style={{ width: '70%' }} />
        <div className={styles.skeleton} style={{ width: '92%' }} />
        {!isWord && <div className={styles.skeleton} style={{ width: '84%' }} />}
      </div>
    )
  } else if (phase === 'error') {
    body = (
      <>
        <div className={styles.body}>
          <div className={styles.warning}>Couldn’t translate.</div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={() => setRetryNonce((n) => n + 1)}>
            <ArrowCounterClockwise size={13} aria-hidden />
            Try again
          </button>
        </div>
      </>
    )
  } else if (phase === 'no_key') {
    body = (
      <>
        <div className={styles.body}>
          <div className={styles.warning}>Add your OpenRouter key in Settings.</div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={onOpenSettings}>
            <GearSix size={13} aria-hidden />
            Open Settings
          </button>
        </div>
      </>
    )
  } else if (phase === 'too_long') {
    body = (
      <>
        <div className={styles.body}>
          <div className={styles.warning}>
            This selection has {text.length.toLocaleString('en-US')} characters. Translate works up to{' '}
            {TRANSLATE_CHAR_LIMIT.toLocaleString('en-US')} (about a paragraph).
          </div>
        </div>
        {actions}
      </>
    )
  } else if (translation?.kind === 'word') {
    body = (
      <>
        <div className={styles.body}>
          <div className={styles.meaning}>{translation.sense}</div>
          {context && (
            <div className={styles.context}>
              {highlightTerm(context, term)}
              <small>Meaning in this sentence · {positionLabel}</small>
            </div>
          )}
          {translation.note && <div className={styles.note}>{translation.note}</div>}
        </div>
        {actions}
      </>
    )
  } else if (translation?.kind === 'passage') {
    body = (
      <>
        <div className={styles.body}>
          <div className={styles.passage}>{translation.translation}</div>
          {translation.grammar.length > 0 && (
            <ul className={styles.grammar}>
              {translation.grammar.map((note, i) => (
                <li key={i} className={styles.note}>
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
        {actions}
      </>
    )
  }

  return createPortal(
    <div
      ref={rootRef}
      className={`${styles.popover} ${wide ? styles.wide : ''}`}
      role="dialog"
      aria-label="Translation"
      // A seleção do texto continua marcada ao clicar no popover; os campos
      // (select) precisam do clique normal para abrir. O texto de um rótulo também
      // é prevenido: o clique no rótulo ainda foca o campo, mas não começa uma
      // seleção nova dentro do popover (que desfaria a do livro).
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('select, input, textarea')) e.preventDefault()
      }}
      // O portal borbulha pela árvore do React até a página: o mouseup daqui não
      // pode chegar ao `handleTextMouseUp`, que com a seleção colapsada a limparia
      // e fecharia este popover.
      onMouseUp={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.stopPropagation()
        onClose()
      }}
    >
      <div className={styles.header}>
        {isWord && phase !== 'too_long' ? (
          <div className={styles.term}>{term}</div>
        ) : (
          <div className={styles.kind}>Translation</div>
        )}
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close" title="Close (Esc)">
          <X size={14} aria-hidden />
        </button>
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
      {body}
      {showFooter && (
        <div className={styles.footer}>
          {editingLanguages ? (
            <div className={styles.languages}>
              <label className={styles.languageField}>
                Book language
                <select
                  value={sourceLanguage}
                  onChange={(e) => onChangeBookLanguage(e.target.value)}
                  aria-label="Book language"
                >
                  {languageOptions(sourceLanguage).map((code) => (
                    <option key={code} value={code}>
                      {languageName(code)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.languageField}>
                Translate into
                <select
                  value={targetLanguage}
                  onChange={(e) => onChangeTargetLanguage(e.target.value)}
                  aria-label="Translate into"
                >
                  {languageOptions(targetLanguage).map((code) => (
                    <option key={code} value={code}>
                      {languageName(code)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <span>
              {languageName(sourceLanguage)} → {languageName(targetLanguage)}
            </span>
          )}
          <button
            type="button"
            className={styles.change}
            onClick={() => setEditingLanguages((v) => !v)}
            title="Wrong language? Change the language of this book or the one you translate into"
          >
            {editingLanguages ? 'Done' : 'Change'}
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
