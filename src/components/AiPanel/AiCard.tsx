import { ArrowClockwise, CaretRight, ChatCircle, Check, Copy, FileText, GearSix, Stop, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import type { AiResponse, AiSource } from '../../types'
import { findAgent } from '../../lib/agents'
import { renderMarkdown } from '../../lib/markdown'
import styles from './AiPanel.module.css'

function SourcesSection({ sources }: { sources: AiSource[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <details className={styles.sources}>
      <summary className={styles.sourcesSummary}>
        <FileText size={11} aria-hidden />
        Sources ({sources.length})
      </summary>
      <ul className={styles.sourcesList}>
        {sources.map((s, i) => {
          const key = `${s.documentId}-${s.chunkIndex}-${i}`
          const isExpanded = !!expanded[key]
          return (
            <li key={key} className={styles.sourceItem}>
              <button
                type="button"
                className={styles.sourceToggle}
                onClick={() => toggle(key)}
                aria-expanded={isExpanded}
              >
                <FileText size={11} aria-hidden />
                <span className={styles.sourceName}>{s.documentName}</span>
                <span className={styles.sourceMeta}>· excerpt {s.chunkIndex + 1}</span>
              </button>
              {isExpanded && (
                <p className={styles.sourceSnippet}>{s.snippet}</p>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

// Seção do Settings que resolve o erro (chave ausente ou inválida).
export type AiSettingsSection = 'openrouter' | 'search'

function settingsSectionFor(message: string): AiSettingsSection | null {
  if (/tavily/i.test(message)) return 'search'
  if (/OPENROUTER_KEY_MISSING|openrouter key|api key/i.test(message)) return 'openrouter'
  return null
}

export interface AiCardActions {
  onDelete?: (id: string) => void
  onOpenInChat?: (response: AiResponse) => void
  // Erro ou interrupção: roda o mesmo comando de novo.
  onRetry?: (response: AiResponse) => void
  // Preparo ou streaming: para o pedido.
  onStop?: (id: string) => void
  onOpenSettings?: (section: AiSettingsSection) => void
}

export interface AiCardProps extends AiCardActions {
  response: AiResponse
  globalExpand?: boolean | null
  hasApiKey?: boolean
  // A resposta está inserida como bloco de IA na nota aberta.
  inNote?: boolean
}

// Só os status que pedem atenção; o concluído não leva rótulo.
function statusLabel(r: AiResponse): string | null {
  switch (r.status) {
    case 'preparing':
      return r.statusText || 'Preparing…'
    case 'streaming':
      return 'Responding…'
    case 'interrupted':
      return r.response ? 'Interrupted' : 'Stopped'
    case 'error':
      return 'Error'
    default:
      return null
  }
}

export function AiCard({
  response,
  globalExpand,
  hasApiKey,
  inNote,
  onDelete,
  onOpenInChat,
  onRetry,
  onStop,
  onOpenSettings,
}: AiCardProps) {
  const active = response.status === 'preparing' || response.status === 'streaming'
  const [open, setOpen] = useState(active)
  const [renderedHtml, setRenderedHtml] = useState('')
  // React 19 regrava o innerHTML se o objeto muda a cada render (perde a seleção).
  const inner = useMemo(() => ({ __html: renderedHtml }), [renderedHtml])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = () => {
    if (!response.response) return
    navigator.clipboard
      .writeText(response.response)
      .then(() => setCopied(true))
      .catch((err) => console.error('failed to copy response', err))
  }

  useEffect(() => {
    if (globalExpand === null || globalExpand === undefined) return
    if (active) return
    setOpen(globalExpand)
  }, [globalExpand, active])

  useEffect(() => {
    if (active) return
    if (!response.response) { setRenderedHtml(''); return }
    let cancelled = false
    renderMarkdown(response.response).then((html) => {
      if (!cancelled) setRenderedHtml(html)
    })
    return () => { cancelled = true }
  }, [response.response, active])

  const statusClass =
    active
      ? styles.statusStreaming
      : response.status === 'interrupted'
        ? styles.statusInterrupted
        : response.status === 'error'
          ? styles.statusError
          : styles.statusCompleted

  const empty = response.response.length === 0
  const showError = response.status === 'error'
  const hasBody = !showError && !empty
  const label = statusLabel(response)
  const failed = response.status === 'error' || response.status === 'interrupted'
  const canRetry = failed && !!onRetry && !!findAgent(response.command)
  const settingsSection = showError ? settingsSectionFor(response.response) : null

  return (
    <article
      className={active ? `${styles.card} ${styles.cardStreaming}` : styles.card}
      aria-live={active ? 'polite' : undefined}
      data-status={response.status}
    >
      <header
        className={`${styles.cardHeader} ${hasBody ? styles.cardHeaderClickable : ''}`}
        onClick={hasBody ? () => setOpen((v) => !v) : undefined}
      >
        {hasBody && (
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true">
            <CaretRight size={12} />
          </span>
        )}
        <span className={styles.cmd}>{response.command}</span>
        {response.query && (
          <span className={styles.query}>{response.query}</span>
        )}
        {inNote && (
          <span className={styles.inNoteBadge} title="This response is inserted as an AI block in the open note">
            In note
          </span>
        )}
        {label && (
          <span className={`${styles.status} ${statusClass}`}>
            {active && <span className={styles.streamDot} aria-hidden="true" />}
            {label}
          </span>
        )}
        {onDelete && !active && (
          <button
            className={`${styles.deleteBtn} ${failed ? styles.deleteBtnVisible : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(response.id)
            }}
            aria-label="Delete response"
            title="Delete response"
            type="button"
          >
            <X size={12} aria-hidden />
          </button>
        )}
      </header>
      {response.model && (
        <div className={styles.modelTag}>{response.model}</div>
      )}
      {showError ? (
        <div className={styles.errorBody}>
          {response.response || 'Unknown error.'}
        </div>
      ) : response.status === 'preparing' ? null : (
        <div className={`${styles.body} ${response.status !== 'streaming' ? styles.bodyMd : ''} ${!open ? styles.bodyCollapsed : ''}`}>
          {response.status === 'streaming' ? (
            <>
              <span style={{ whiteSpace: 'pre-wrap' }}>{response.response}</span>
              <span className={styles.caretBlink} aria-hidden="true">▍</span>
            </>
          ) : (
            <div dangerouslySetInnerHTML={inner} />
          )}
        </div>
      )}
      {response.status === 'interrupted' && (open || empty) && (
        <div className={styles.interruptedNote}>
          {empty ? 'Stopped before the response started.' : 'Response interrupted before finishing.'}
        </div>
      )}
      {active && onStop && (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.cardActionBtn}
            onClick={() => onStop(response.id)}
            title="Stop this request"
          >
            <Stop size={12} weight="fill" aria-hidden />
            <span>Stop</span>
          </button>
        </div>
      )}
      {failed && (canRetry || (settingsSection && onOpenSettings)) && (
        <div className={styles.cardActions}>
          {settingsSection && onOpenSettings && (
            <button
              type="button"
              className={styles.cardActionBtn}
              onClick={() => onOpenSettings(settingsSection)}
            >
              <GearSix size={12} aria-hidden />
              <span>Open Settings</span>
            </button>
          )}
          {canRetry && (
            <button
              type="button"
              className={styles.cardActionBtn}
              onClick={() => onRetry?.(response)}
              title="Run this command again"
            >
              <ArrowClockwise size={12} aria-hidden />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}
      {response.status === 'completed' && open && hasBody && (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={`${styles.cardActionBtn} ${copied ? styles.cardActionBtnConfirmed : ''}`}
            onClick={handleCopy}
            aria-label={copied ? 'Response copied' : 'Copy response'}
            title={copied ? 'Copied!' : 'Copy response'}
          >
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className={styles.cardActionBtn}
            onClick={() => {
              if (!hasApiKey) return
              onOpenInChat?.(response)
            }}
            disabled={!hasApiKey}
            aria-label="Continue in chat"
            aria-disabled={!hasApiKey}
            title={hasApiKey ? 'Continue this conversation in the notebook chat' : 'Add your OpenRouter key in Settings'}
          >
            <ChatCircle size={13} aria-hidden />
            <span>Chat</span>
          </button>
        </div>
      )}
      {response.sources && response.sources.length > 0 && !active && (
        <SourcesSection sources={response.sources} />
      )}
    </article>
  )
}
