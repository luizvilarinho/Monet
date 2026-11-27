import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CircleNotch,
  DotsThree,
  Info,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Warning,
  X,
} from '@phosphor-icons/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ColumnBox } from '../../hooks/useColumnBox'
import { useLanguageSettings } from '../../hooks/useLanguageSettings'
import type { ListenPlayer } from '../../hooks/useListenPlayer'
import { TTS_SPEEDS, getTtsVoice, setTtsChoice, setTtsShowText, setTtsSkipHeaders } from '../../lib/languageSettings'
import {
  TTS_ACTION_LABEL,
  ttsErrorActions,
  ttsErrorSentence,
  ttsUsage,
  type TtsErrorAction,
  type TtsModel,
} from '../../lib/speech'
import { formatUsd, sumUsageCost } from '../../lib/ttsCost'
import type { SettingsSection } from '../Settings/SettingsModal'
import styles from './MiniPlayer.module.css'
import { VoiceModelPicker } from './VoiceModelPicker'

export interface MiniPlayerProps {
  player: ListenPlayer
  // Onde fica a coluna da página (coordenadas da janela): o player é `fixed` e
  // ocupa a coluna menos os botões de página.
  column: ColumnBox
  models: TtsModel[]
  modelsLoading: boolean
  // Livro aberto, para o custo do menu ⋯, e a língua dele, para a voz.
  bookId: string
  language: string
  // "Back to p. 42": vai à página de origem do áudio.
  onBackToPage: (page: number) => void
  onOpenSettingsSection: (section: SettingsSection) => void
  onHeightChange: (px: number) => void
}

// Abaixo disso os controles não cabem com a origem e o progresso.
const NARROW_COLUMN = 576
const BUTTONS_MARGIN = 144
const MAX_WIDTH = 560
const MIN_WIDTH = 300
const MAX_SEGMENTS = 40
const NOTICE_MS = 5000
// Como os botões de página: a 20 px da base da área.
const PLAYER_BOTTOM = 20

function speedLabel(speed: number): string {
  return `${speed === 1 ? '1.0' : speed}×`
}

// Segmentos do progresso: um por frase; passando de 40 frases, 40 segmentos
// proporcionais ao trecho.
function progressSegments(count: number, index: number, ended: boolean): Array<'done' | 'current' | 'todo'> {
  const total = Math.min(count, MAX_SEGMENTS)
  return Array.from({ length: total }, (_, k) => {
    const sentence = count > MAX_SEGMENTS ? Math.floor((k * count) / MAX_SEGMENTS) : k
    if (ended || sentence < index) return 'done'
    return sentence === index ? 'current' : 'todo'
  })
}

// Mini-player da leitura em voz alta: flutua embaixo, no centro da coluna da
// página. Controles, origem, progresso, velocidade e o menu ⋯ com o modelo de voz.
export function MiniPlayer({
  player,
  column,
  models,
  modelsLoading,
  bookId,
  language,
  onBackToPage,
  onOpenSettingsSection,
  onHeightChange,
}: MiniPlayerProps) {
  const { state } = player
  const { source, status, index, error, speed, awayFromPage, longEstimate } = state
  const settings = useLanguageSettings()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const moreRef = useRef<HTMLButtonElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [noticeVisible, setNoticeVisible] = useState(false)
  const [bookUsage, setBookUsage] = useState<Record<string, number> | null>(null)

  // O aviso da fonte ("Not read: page header and page number") dura 5 s.
  const sourceId = source?.id
  const hasNotice = !!source?.notice
  useEffect(() => {
    if (!hasNotice) {
      setNoticeVisible(false)
      return
    }
    setNoticeVisible(true)
    const timer = window.setTimeout(() => setNoticeVisible(false), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [sourceId, hasNotice])

  // Altura medida: o leitor sobe o aviso e a margem da página por ela.
  const hasSource = source !== null
  useLayoutEffect(() => {
    const element = rootRef.current
    if (!element) return
    const report = () => onHeightChange(Math.round(element.getBoundingClientRect().height))
    report()
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => {
      observer.disconnect()
      onHeightChange(0)
    }
  }, [onHeightChange, hasSource])

  // Esc e clique fora fecham o menu. O Esc é consumido aqui para não limpar também
  // a seleção do leitor.
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setMenuOpen(false)
      moreRef.current?.focus()
    }
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || moreRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('mousedown', onMouseDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [menuOpen])

  // O custo do livro vem do uso contado pelo Rust; relido a cada abertura do menu.
  useEffect(() => {
    if (!menuOpen) return
    let alive = true
    ttsUsage().then(
      (usage) => alive && setBookUsage(usage.books[bookId] ?? {}),
      () => alive && setBookUsage(null),
    )
    return () => {
      alive = false
    }
  }, [menuOpen, bookId])

  if (!source) return null

  const narrow = column.width < NARROW_COLUMN
  const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, column.width - BUTTONS_MARGIN))
  const inactive = status === 'idle' || status === 'blocked' || status === 'confirm-long'
  const sentence = source.sentences[index] ?? ''

  function runAction(action: TtsErrorAction) {
    if (action === 'settings') onOpenSettingsSection('openrouter')
    else if (action === 'retry') player.retry()
    else if (action === 'skip') player.skip()
    else setMenuOpen(true)
  }

  // Mensagem acima da frase: erro, Mincer, trecho longo, fora da página, aviso.
  let message: { warn: boolean; icon: ReactNode; text: string; actions: Array<[string, () => void]> } | null = null
  if (status === 'error' && error) {
    message = {
      warn: true,
      icon: <Warning size={14} aria-hidden />,
      text: ttsErrorSentence(error),
      actions: ttsErrorActions(error).map((action) => [TTS_ACTION_LABEL[action], () => runAction(action)]),
    }
  } else if (status === 'blocked') {
    message = {
      warn: true,
      icon: <span className={styles.recDot} aria-hidden />,
      text: 'Mincer is recording. This audio would end up in the recording.',
      actions: [
        ['Play anyway', () => player.playAnyway()],
        ['Cancel', () => player.close()],
      ],
    }
  } else if (status === 'confirm-long' && longEstimate) {
    const cost = longEstimate.cost === null ? '' : `, around ~${formatUsd(longEstimate.cost)} with this voice`
    message = {
      warn: false,
      icon: <Info size={13} aria-hidden />,
      text: `Long passage: about ${longEstimate.minutes} min of audio${cost}. You only pay for what you listen to.`,
      actions: [
        ['Listen', () => player.confirmLong()],
        ['Cancel', () => player.close()],
      ],
    }
  } else if (status === 'paused' && awayFromPage !== null && source.backLabel) {
    const page = awayFromPage
    message = {
      warn: false,
      icon: null,
      text: `Paused: this audio is from ${source.backLabel}.`,
      actions: [[`Back to ${source.backLabel}`, () => onBackToPage(page)]],
    }
  } else if (noticeVisible && source.notice) {
    message = { warn: false, icon: <Info size={13} aria-hidden />, text: source.notice, actions: [] }
  }

  // Linha da frase: a falada (até 3 linhas), "Preparing audio…" ou o fim.
  let caption: ReactNode = null
  let dim = false
  if (status === 'preparing') {
    dim = true
    caption = (
      <span className={styles.preparing}>
        <CircleNotch size={13} className={styles.spin} aria-hidden />
        Preparing audio…
      </span>
    )
  } else if (status === 'ended') {
    dim = true
    caption = source.endLabel
  } else if (settings.ttsShowText && (status === 'playing' || status === 'paused')) {
    caption = sentence
  }

  const ended = status === 'ended'
  const playLabel = status === 'playing' ? 'Pause (Space)' : ended ? 'Listen again (Space)' : 'Play (Space)'
  const segments = progressSegments(source.sentences.length, index, ended)
  const bookCost = bookUsage ? sumUsageCost(bookUsage, models) : null
  const hasBookUsage = bookUsage !== null && Object.keys(bookUsage).length > 0

  // Em portal no body: `fixed` não depende de nenhum ancestral (transform, overflow).
  return createPortal(
    <div
      ref={rootRef}
      className={`${styles.player} ${menuOpen ? styles.menuOpen : ''}`}
      style={{ width, left: column.centerX, bottom: column.bottom + PLAYER_BOTTOM }}
      role="group"
      aria-label="Read aloud"
      // O clique no player não rouba o foco nem mexe na seleção do texto; campos do
      // menu continuam funcionando.
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('input, select, textarea, label')) e.preventDefault()
      }}
    >
      {message && (
        <div className={`${styles.message} ${message.warn ? styles.warn : ''}`} role={message.warn ? 'alert' : 'status'}>
          {message.icon}
          <span className={styles.messageText}>{message.text}</span>
          {message.actions.map(([label, run]) => (
            <button key={label} type="button" className={styles.mini} onClick={run}>
              {label}
            </button>
          ))}
        </div>
      )}
      {caption !== null && <div className={`${styles.caption} ${dim ? styles.dim : ''}`}>{caption}</div>}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.iconButton}
          title="Back one sentence (Shift+←)"
          aria-label="Back one sentence"
          disabled={inactive || index <= 0}
          onClick={player.prev}
        >
          <SkipBack size={15} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${ended ? styles.listenAgain : styles.play}`}
          title={playLabel}
          aria-label={ended ? 'Listen again' : status === 'playing' ? 'Pause' : 'Play'}
          disabled={inactive}
          onClick={player.toggle}
        >
          {status === 'preparing' ? (
            <CircleNotch size={16} className={styles.spin} aria-hidden />
          ) : status === 'playing' ? (
            <Pause size={16} weight="fill" aria-hidden />
          ) : ended ? (
            <>
              <ArrowCounterClockwise size={14} aria-hidden />
              Listen again
            </>
          ) : (
            <Play size={16} weight="fill" aria-hidden />
          )}
        </button>
        <button
          type="button"
          className={styles.iconButton}
          title="Next sentence (Shift+→)"
          aria-label="Next sentence"
          disabled={inactive || index >= source.sentences.length - 1}
          onClick={player.next}
        >
          <SkipForward size={15} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.repeat}`}
          title="Repeat this sentence (R)"
          disabled={inactive}
          onClick={player.repeat}
        >
          <ArrowClockwise size={14} aria-hidden />
          Repeat
        </button>
        {!narrow && (
          <>
            <span className={styles.origin}>{source.originLabel}</span>
            <div className={styles.progress} aria-hidden>
              {segments.map((kind, k) => (
                <i key={k} className={kind === 'done' ? styles.done : kind === 'current' ? styles.current : undefined} />
              ))}
            </div>
          </>
        )}
        {narrow && <span className={styles.spacer} />}
        <button
          type="button"
          className={styles.speed}
          title="Speed: 0.75×, 0.85× or 1.0×"
          onClick={() => player.setSpeed(TTS_SPEEDS[(TTS_SPEEDS.findIndex((s) => s === speed) + 1) % TTS_SPEEDS.length])}
        >
          {speedLabel(speed)}
        </button>
        <button
          ref={moreRef}
          type="button"
          className={styles.iconButton}
          title="Voice and options"
          aria-label="Voice and options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <DotsThree size={16} weight="bold" aria-hidden />
        </button>
        <button type="button" className={styles.iconButton} title="Close" aria-label="Close player" onClick={player.close}>
          <X size={14} aria-hidden />
        </button>
      </div>
      {menuOpen && (
        <div ref={menuRef} className={styles.menu} role="dialog" aria-label="Voice and options">
          <VoiceModelPicker
            compact
            idPrefix="player-voice"
            models={models}
            loading={modelsLoading}
            modelId={settings.ttsModel}
            voice={getTtsVoice(settings.ttsModel, language)}
            language={language}
            onChange={(modelId, voice) => setTtsChoice(modelId, voice, language)}
          />
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.ttsShowText}
              onChange={(e) => setTtsShowText(e.target.checked)}
            />
            Show the text in the player
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.ttsSkipHeaders}
              onChange={(e) => setTtsSkipHeaders(e.target.checked)}
            />
            Skip page headers and numbers
          </label>
          <div className={styles.cost}>
            {hasBookUsage && bookCost
              ? `This book so far: ~${formatUsd(bookCost.cost)} (estimate).${bookCost.unpriced ? ' Some models have no published price.' : ''}`
              : 'No audio has been generated for this book yet.'}
          </div>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setMenuOpen(false)
              onOpenSettingsSection('language')
            }}
          >
            Language settings…
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
