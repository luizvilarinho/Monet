import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
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
  type PartialTranslation,
  type Translation,
} from '../../lib/translate'
import {
  DEFAULT_MAX_HEIGHT_PX,
  applyMove,
  applyResize,
  clampToViewport,
  clearGeometry,
  estimatePassageHeight,
  exceedsDragThreshold,
  readGeometry,
  reflowHeight,
  skeletonLineCount,
  writeGeometry,
  type ResizeDirection,
  type WindowGeometry,
  type WindowVariant,
} from '../../lib/translateWindow'
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
  // botão passa a "Save translation" e só vale com a tradução pronta, e como
  // não há seleção do leitor para fechá-lo, fecha sozinho com Esc e clique fora.
  savedItem?: boolean
  // O popover não nasce de uma seleção do leitor (o "Translate here" de uma palavra
  // marcada): fecha sozinho com Esc e clique fora, como o de um item, mas guarda
  // como "Add to vocabulary".
  standalone?: boolean
}

type Phase = 'loading' | 'done' | 'error' | 'no_key'

// Um gesto do usuário na janela: mover (arrastar o cabeçalho) ou redimensionar
// (uma das oito alças). `start` é a geometria medida no começo; `active` diz que o
// ponteiro passou do limiar de arrasto (vale daí em diante, mesmo que ele volte
// para perto da origem); `last` é a geometria do último movimento (null = o gesto
// não começou).
interface Gesture {
  mode: 'move' | ResizeDirection
  startX: number
  startY: number
  start: WindowGeometry
  active: boolean
  last: WindowGeometry | null
}

const HANDLES: ReadonlyArray<readonly [ResizeDirection, string]> = [
  ['n', styles.resizeN],
  ['s', styles.resizeS],
  ['e', styles.resizeE],
  ['w', styles.resizeW],
  ['ne', styles.resizeNE],
  ['nw', styles.resizeNW],
  ['se', styles.resizeSE],
  ['sw', styles.resizeSW],
]

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

// Tamanho e posição de uma vez, e o teto de altura igual à altura: com a
// geometria do usuário o teto de 460 px do padrão não vale.
function applyGeometry(el: HTMLElement, geometry: WindowGeometry) {
  el.style.left = `${geometry.left}px`
  el.style.top = `${geometry.top}px`
  el.style.width = `${geometry.width}px`
  el.style.height = `${geometry.height}px`
  el.style.maxHeight = `${geometry.height}px`
}

function currentViewport() {
  return { width: window.innerWidth, height: window.innerHeight }
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
  // A janela larga é a da passagem (e a do aviso de texto longo). A geometria que
  // o usuário grava é uma por variante.
  const wide = !isWord || tooLong
  const variant: WindowVariant = wide ? 'passage' : 'word'

  const [requested, setRequested] = useState<Phase>('loading')
  const [translation, setTranslation] = useState<Translation | null>(null)
  // O texto da passagem enquanto chega; fica no erro, para o que já foi lido não sumir.
  const [partial, setPartial] = useState<PartialTranslation | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const [editingLanguages, setEditingLanguages] = useState(false)
  // A geometria gravada desta variante (null = ancorada na seleção, como sempre).
  const [stored, setStored] = useState(() => ({ variant, geometry: readGeometry(variant) }))
  let saved = stored.geometry
  if (stored.variant !== variant) {
    saved = readGeometry(variant)
    setStored({ variant, geometry: saved })
  }
  const bodyRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  // A altura da janela está reservada (a passagem está chegando): o fim da
  // tradução faz o único ajuste.
  const reservedRef = useRef(false)

  // A chamada roda ao abrir e a cada troca de texto, língua ou modelo; é
  // abortada ao fechar ou ao trocar. Acima do limite não há chamada.
  useEffect(() => {
    if (!open || tooLong) return
    const controller = new AbortController()
    setRequested('loading')
    setTranslation(null)
    setPartial(null)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    requestTranslation({
      text: term,
      sentence: context,
      kind,
      sourceLanguage,
      targetLanguage,
      model,
      signal: controller.signal,
      onPartial: (next) => {
        if (!controller.signal.aborted) setPartial(next)
      },
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

  // Posição contra a janela, medida com o conteúdo atual. Com a geometria do
  // usuário, ela vale como está (limitada à janela do app). Sem ela: abaixo da
  // seleção, acima quando não cabe, ou do lado com mais espaço e com rolagem por
  // dentro. A passagem que está chegando reserva a altura pela estimativa do
  // texto de origem e não se mexe a cada pedaço (as dependências não incluem o
  // texto parcial); o fim da tradução faz um único ajuste de altura.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!open || !el) return
    const viewport = currentViewport()
    if (saved) {
      reservedRef.current = false
      applyGeometry(el, clampToViewport(saved, viewport))
      return
    }
    // Medida antes de soltar a altura: o lugar da janela que estava com a altura reservada.
    const reservedRect = reservedRef.current ? el.getBoundingClientRect() : null
    el.style.width = ''
    el.style.height = ''
    el.style.maxHeight = ''
    if (phase === 'loading' && wide) {
      const reserved = estimatePassageHeight(term.length)
      const placed = placeFloatingPanel(anchor, { width: el.offsetWidth, height: reserved }, viewport)
      const cap = Math.min(DEFAULT_MAX_HEIGHT_PX, placed.maxHeight)
      el.style.left = `${placed.left}px`
      el.style.top = `${placed.top}px`
      el.style.maxHeight = `${cap}px`
      el.style.height = `${Math.min(reserved, cap)}px`
      reservedRef.current = true
      return
    }
    reservedRef.current = false
    if (reservedRect) {
      el.style.maxHeight = `${DEFAULT_MAX_HEIGHT_PX}px`
      const next = reflowHeight(
        { top: reservedRect.top, height: reservedRect.height },
        el.offsetHeight,
        anchor,
        viewport,
      )
      el.style.top = `${next.top}px`
      el.style.maxHeight = `${next.maxHeight}px`
      return
    }
    const placed = placeFloatingPanel(
      anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      viewport,
    )
    el.style.left = `${placed.left}px`
    el.style.top = `${placed.top}px`
    el.style.maxHeight = `${Math.min(DEFAULT_MAX_HEIGHT_PX, placed.maxHeight)}px`
  }, [
    open,
    rootRef,
    anchor.x,
    anchor.y,
    anchor.w,
    anchor.h,
    phase,
    translation,
    editingLanguages,
    isWord,
    wide,
    saved,
    term.length,
  ])

  // A janela do app mudou de tamanho com o popover aberto: a geometria gravada é
  // limitada de novo (sem regravar, para voltar ao lugar quando voltar a caber).
  useEffect(() => {
    if (!open || !saved) return
    const onResize = () => {
      const el = rootRef.current
      if (el) applyGeometry(el, clampToViewport(saved, currentViewport()))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, saved, rootRef])

  if (!open) return null

  // Pointer events com captura: no EPUB o livro está num iframe e no PDF há a
  // camada de texto por baixo, e sem a captura o movimento sobre eles se perde. O
  // mouseup também fica no popover, e o do leitor não limpa a seleção.
  function beginGesture(e: ReactPointerEvent<HTMLElement>, mode: Gesture['mode']) {
    const el = rootRef.current
    if (e.button !== 0 || !el) return
    const rect = el.getBoundingClientRect()
    gestureRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      start: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      active: false,
      last: null,
    }
    el.dataset.gesture = mode === 'move' ? 'move' : 'resize'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function moveGesture(e: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current
    const el = rootRef.current
    if (!gesture || !el) return
    const dx = e.clientX - gesture.startX
    const dy = e.clientY - gesture.startY
    // Um clique com tremor não é arrasto; passado o limiar o gesto vale com o delta inteiro.
    if (!gesture.active) {
      if (!exceedsDragThreshold(dx, dy)) return
      gesture.active = true
    }
    const viewport = currentViewport()
    const next =
      gesture.mode === 'move'
        ? applyMove(gesture.start, dx, dy, viewport)
        : applyResize(gesture.start, gesture.mode, dx, dy, viewport)
    gesture.last = next
    applyGeometry(el, next)
  }

  // Só o gesto do usuário grava, e uma vez, ao soltar. Cancelado, volta ao que era.
  function endGesture(e: ReactPointerEvent<HTMLElement>, keep: boolean) {
    const gesture = gestureRef.current
    if (!gesture) return
    gestureRef.current = null
    const el = rootRef.current
    if (el) delete el.dataset.gesture
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!gesture.last) return
    if (keep) {
      writeGeometry(variant, gesture.last)
      setStored({ variant, geometry: gesture.last })
    } else if (el) {
      applyGeometry(el, gesture.start)
    }
  }

  const gestureProps = (mode: Gesture['mode']) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => beginGesture(e, mode),
    onPointerMove: moveGesture,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => endGesture(e, true),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => endGesture(e, false),
    onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => endGesture(e, true),
  })
  const headerGesture = gestureProps('move')

  // Duplo clique no cabeçalho: apaga a geometria desta variante e volta ao padrão.
  function resetGeometry() {
    clearGeometry(variant)
    setStored({ variant, geometry: null })
  }

  const vocabularyReady = phase === 'done'
  const actions = (
    <div className={styles.actions}>
      {phase === 'no_key' ? (
        <button type="button" className={styles.action} onClick={onOpenSettings}>
          <GearSix size={13} aria-hidden />
          Open Settings
        </button>
      ) : (
        <>
          {phase === 'error' && (
            <button type="button" className={styles.action} onClick={() => setRetryNonce((n) => n + 1)}>
              <ArrowCounterClockwise size={13} aria-hidden />
              Try again
            </button>
          )}
          <button type="button" className={styles.action} onClick={() => onListen(term)}>
            <SpeakerHigh size={13} aria-hidden />
            Listen
          </button>
          {(phase === 'loading' || phase === 'done') && (
            <button
              type="button"
              className={styles.action}
              disabled={!vocabularyReady}
              title={vocabularyReady ? undefined : 'Available when the translation is complete'}
              onClick={() => onAddToVocabulary(translation)}
            >
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
        </>
      )}
    </div>
  )

  const showFooter = phase === 'loading' || phase === 'done' || phase === 'error'

  let sub: string | null = null
  if (phase === 'done' && translation?.kind === 'word') {
    const showBase =
      translation.baseForm !== null && translation.baseForm.toLowerCase() !== term.toLowerCase()
    sub =
      [showBase ? translation.baseForm : null, translation.partOfSpeech, translation.gender]
        .filter(Boolean)
        .join(' · ') || null
  }

  let content: ReactNode = null
  if (phase === 'loading') {
    if (isWord) {
      content = (
        <>
          <div className={styles.skeleton} style={{ width: '70%' }} />
          <div className={styles.skeleton} style={{ width: '92%' }} />
        </>
      )
    } else if (partial) {
      // O texto chega aos poucos; com o texto completo e as notas por vir, uma
      // barra no lugar delas.
      content = (
        <>
          <div className={styles.passage}>{partial.text}</div>
          {partial.closed && <div className={`${styles.skeleton} ${styles.skeletonNotes}`} />}
        </>
      )
    } else {
      const lines = skeletonLineCount(term.length)
      content = (
        <div className={styles.skeletonLines}>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={styles.skeleton} style={{ width: i === lines - 1 ? '60%' : '100%' }} />
          ))}
        </div>
      )
    }
  } else if (phase === 'error') {
    content = (
      <>
        {partial && <div className={styles.passage}>{partial.text}</div>}
        <div className={styles.warning}>
          {partial ? 'The translation stopped before the end.' : 'Couldn’t translate.'}
        </div>
      </>
    )
  } else if (phase === 'no_key') {
    content = <div className={styles.warning}>Add your OpenRouter key in Settings.</div>
  } else if (phase === 'too_long') {
    content = (
      <div className={styles.warning}>
        This selection has {text.length.toLocaleString('en-US')} characters. Translate works up to{' '}
        {TRANSLATE_CHAR_LIMIT.toLocaleString('en-US')} (about a paragraph).
      </div>
    )
  } else if (translation?.kind === 'word') {
    content = (
      <>
        <div className={styles.meaning}>{translation.sense}</div>
        {context && (
          <div className={styles.context}>
            {highlightTerm(context, term)}
            <small>Meaning in this sentence · {positionLabel}</small>
          </div>
        )}
        {translation.note && <div className={styles.note}>{translation.note}</div>}
      </>
    )
  } else if (translation?.kind === 'passage') {
    content = (
      <>
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
      // seleção nova dentro do popover (que desfaria a do livro). Vale para o
      // cabeçalho e as alças: arrastar não desfaz a seleção.
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
      <div
        className={`${styles.header} ${styles.draggable}`}
        title="Drag to move · Double-click to reset"
        // O X é um botão: o clique nele não começa arrasto nem volta ao padrão.
        onPointerDown={(e) => {
          if (!(e.target as HTMLElement).closest('button')) headerGesture.onPointerDown(e)
        }}
        onPointerMove={headerGesture.onPointerMove}
        onPointerUp={headerGesture.onPointerUp}
        onPointerCancel={headerGesture.onPointerCancel}
        onLostPointerCapture={headerGesture.onLostPointerCapture}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) resetGeometry()
        }}
      >
        {isWord && phase !== 'too_long' ? (
          <div className={styles.term}>{term}</div>
        ) : (
          <div className={styles.kind}>{phase === 'loading' ? 'Translating…' : 'Translation'}</div>
        )}
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close" title="Close (Esc)">
          <X size={14} aria-hidden />
        </button>
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
      <div ref={bodyRef} className={styles.body} aria-busy={phase === 'loading'}>
        {content}
      </div>
      {actions}
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
      {HANDLES.map(([direction, className]) => (
        <div
          key={direction}
          className={`${styles.resize} ${className}`}
          aria-hidden
          {...gestureProps(direction)}
        />
      ))}
    </div>,
    document.body,
  )
}
