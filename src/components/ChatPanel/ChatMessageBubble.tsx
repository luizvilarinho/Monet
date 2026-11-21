import {
  ArrowClockwise,
  BookmarkSimple,
  Broadcast,
  CalendarPlus,
  Check,
  Copy,
  FloppyDisk,
  GearSix,
  IdentificationCard,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ChatMessage } from '../../hooks/useChat'
import { expandItemMarkers, hasAgentPayload } from '../../lib/agentItems'
import { AGENT_DRAFT_ACTION, agentNoteDraft, type AgentNoteDraft } from '../../lib/agentNotes'
import { CHAT_AGENTS } from '../../lib/agents/chat'
import { dateKeyFromMs } from '../../lib/calendar'
import { renderMarkdown } from '../../lib/markdown'
import { linkNoteMarks } from '../../lib/noteMarks'
import { clickedImage, useImageViewer } from '../ImageViewer/ImageViewer'
import { useMermaidDiagrams } from '../MermaidDiagram/useMermaidDiagrams'
import { AgentItemsList, type AgentItemActions } from './AgentItemsList'
import styles from './ChatMessageBubble.module.css'

// Ícone do botão de cada rascunho de nota de agente (o rótulo vem de
// AGENT_DRAFT_ACTION); também usado pelo balão do chat das Anotações.
export const AGENT_DRAFT_ICON: Record<AgentNoteDraft['kind'], Icon> = {
  plan: CalendarPlus,
  profile: IdentificationCard,
  radarProfile: Broadcast,
  paper: BookmarkSimple,
}

// Respostas que levam o rótulo do agente: com agentId diferente do da resposta
// anterior do assistant (General não grava agentId).
export function agentLabelIds(messages: ChatMessage[]): Set<string> {
  const ids = new Set<string>()
  let previous: string | undefined
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    if (m.agentId && m.agentId !== previous) ids.add(m.id)
    previous = m.agentId
  }
  return ids
}

// Resposta vazia que esta instância não está escrevendo. Com a marca de corte
// (gravada por quem cortou), ou velha demais para um turno vivo (app fechado no
// meio), ela não chegou: "No response (interrupted)". Sem a marca, outra janela
// ainda a escreve: sem Retry, que duplicaria o turno.
const STALE_EMPTY_ANSWER_MS = 15 * 60_000

// Resposta vazia parada pelo usuário (Stop com o Radar ou o Papers ainda montando o
// contexto): o balão fica, com este texto no lugar de "No response".
export const STOPPED_BEFORE_REPLY = 'Stopped before the response started'

export function emptyAnswerState(message: ChatMessage, isStreaming: boolean): 'streaming' | 'elsewhere' | 'stopped' | null {
  if (message.role !== 'assistant' || message.content.length > 0) return null
  if (isStreaming) return 'streaming'
  if (message.interrupted) return 'stopped'
  const age = Date.now() - Date.parse(message.timestamp)
  return age > STALE_EMPTY_ANSWER_MS ? 'stopped' : 'elsewhere'
}

// Ícone + nome do agente acima da resposta (id desconhecido = sem rótulo).
export function AgentReplyLabel({ agentId }: { agentId: string | undefined }) {
  const agent = CHAT_AGENTS.find((a) => a.id === agentId)
  if (!agent) return null
  const Icon = agent.icon
  return (
    <div className={styles.agentLabel}>
      <Icon size={12} aria-hidden />
      {agent.label}
    </div>
  )
}

interface ChatMessageBubbleProps {
  message: ChatMessage
  isStreaming: boolean
  // Mostra o rótulo do agente acima da resposta (ver agentLabelIds).
  showAgentLabel?: boolean
  // Ausente esconde o botao "Save to note".
  onSaveToNote?: (content: string) => void
  // Ausente esconde o "Save as Plan note" (resposta do planner com plano datado).
  onSaveAgentNote?: (draft: AgentNoteDraft) => void
  // Clique numa marca (`==texto==`) citada na resposta: abre a nota nela (o
  // App decide entre abrir direto e o seletor de notas).
  onOpenMark?: (text: string) => void
  // Retry do turno (erro, sem resposta ou interrompido). Só na última resposta.
  onRetry?: () => void
  // Retry sem o que reenviar (a pergunta só tinha imagens, que não ficam
  // gravadas): o botão aparece desabilitado, com o motivo no title.
  retryDisabledReason?: string
  // Erro que se resolve no Settings (chave, créditos): botão "Open Settings".
  onOpenSettings?: () => void
  // Marca "Saved to <nota>": título atual da nota e como abri-la. Ausente com
  // a nota apagada.
  savedNote?: { title: string; onOpen: () => void }
  // Ações dos itens do Radar embaixo da resposta (Open, Send to Mincer, Add to
  // KB). Ausente = sem a lista.
  itemActions?: AgentItemActions | null
  // Conteudo extra abaixo da resposta do assistant.
  footer?: ReactNode
}

const INTERRUPTED_LABEL: Record<NonNullable<ChatMessage['interrupted']>, string> = {
  stopped: 'Stopped',
  cut: 'Interrupted',
}

export function ChatMessageBubble({
  message,
  isStreaming,
  showAgentLabel,
  onSaveToNote,
  onSaveAgentNote,
  onOpenMark,
  onRetry,
  retryDisabledReason,
  onOpenSettings,
  savedNote,
  itemActions,
  footer,
}: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const imageViewer = useImageViewer()
  const isEmptyAnswer = !isUser && message.content.length === 0
  // Balão vazio só tem os três pontinhos enquanto o turno roda aqui; parado, é
  // uma resposta que não chegou ou que outra janela ainda escreve.
  const emptyState = emptyAnswerState(message, isStreaming)
  const isStreamingPlaceholder = emptyState === 'streaming'
  const isNoResponse = emptyState === 'stopped'
  const isErrorMessage = !isUser && !!message.failed
  const errorText = isErrorMessage ? message.content.replace(/^Error:\s*/, '') : ''
  const canSaveToNote =
    !isUser &&
    !isStreaming &&
    !isEmptyAnswer &&
    !isErrorMessage &&
    message.content.trim().length > 0
  const agentDraft = useMemo(
    () => (canSaveToNote && onSaveAgentNote ? agentNoteDraft(message, dateKeyFromMs(Date.now())) : null),
    [canSaveToNote, onSaveAgentNote, message]
  )
  const DraftIcon = agentDraft ? AGENT_DRAFT_ICON[agentDraft.kind] : null

  const cacheKey = useMemo(
    () => (isUser ? null : `${message.id}:${message.content.length}`),
    [isUser, message.id, message.content]
  )

  // Radar: os marcadores [W3] viram título, link e fonte a partir do payload do
  // app (no fim do turno o content já vem expandido e a expansão não muda nada).
  const displayContent = useMemo(
    () => (message.agentItems ? expandItemMarkers(message.content, message.agentItems) : message.content),
    [message.content, message.agentItems]
  )

  useEffect(() => {
    if (isUser || isErrorMessage) return
    if (!displayContent) {
      setHtml('')
      return
    }
    let cancelled = false
    renderMarkdown(displayContent, { allowedImageUrls: message.allowedImageUrls }).then((out) => {
      if (!cancelled) setHtml(linkNoteMarks(out))
    })
    return () => {
      cancelled = true
    }
  }, [isUser, isErrorMessage, displayContent, cacheKey, message.allowedImageUrls?.join('\n')])

  // Objeto estável: o React 19 reescreve o innerHTML quando a identidade do
  // { __html } muda, e isso desfaz a seleção do usuário na resposta.
  const bodyHtml = useMemo(() => ({ __html: html }), [html])
  const bodyRef = useRef<HTMLDivElement>(null)
  useMermaidDiagrams(bodyRef, html, isStreaming)

  function handleCopy() {
    if (isUser) return
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasAttachedDocs = isUser && message.attachedDocs && message.attachedDocs.length > 0
  const images = isUser ? message.imageDataUrls ?? [] : []

  const retryButton = onRetry ? (
    <button
      type="button"
      className={styles.saveBtn}
      onClick={onRetry}
      disabled={!!retryDisabledReason}
      title={retryDisabledReason}
    >
      <ArrowClockwise size={13} aria-hidden />
      Retry
    </button>
  ) : null

  const interruptedLabel = !isStreaming && message.interrupted ? INTERRUPTED_LABEL[message.interrupted] : null
  const showMeta = !isStreaming && (!!message.model || !!interruptedLabel)

  return (
    <div
      className={isUser ? (hasAttachedDocs ? styles.bubbleUserWrapper : styles.bubbleUser) : styles.bubbleAssistant}
      data-role={message.role}
    >
      {!isUser && showAgentLabel && <AgentReplyLabel agentId={message.agentId} />}
      {isUser ? (
        <>
          {hasAttachedDocs && (
            <div className={styles.msgDocLabel}>
              {message.attachedDocs!.map((d) => (
                <span key={d.name} className={styles.msgDocChip}>{d.name}</span>
              ))}
            </div>
          )}
          <div className={hasAttachedDocs ? styles.bubbleUser : undefined}>
            {images.length > 0 && (
              <div className={styles.userImages}>
                {images.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`attached image ${i + 1}`}
                    className={styles.userMessageImage}
                    title="Open image"
                    onClick={() => imageViewer.open(url)}
                  />
                ))}
              </div>
            )}
            <p className={styles.userText}>{message.content}</p>
          </div>
        </>
      ) : isStreamingPlaceholder ? (
        <span className={styles.streamingDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : isNoResponse ? (
        <>
          <p className={styles.noResponse}>
            {message.interrupted === 'stopped' ? STOPPED_BEFORE_REPLY : 'No response (interrupted)'}
          </p>
          {retryButton && <div className={styles.turnActions}>{retryButton}</div>}
        </>
      ) : emptyState === 'elsewhere' ? (
        <p className={styles.noResponse} role="status">
          Responding in another window…
        </p>
      ) : isErrorMessage ? (
        <>
          <div className={styles.errorBox} role="alert">
            <WarningCircle size={14} aria-hidden className={styles.errorIcon} />
            <span>{errorText}</span>
          </div>
          {(retryButton || (message.failed === 'settings' && onOpenSettings)) && (
            <div className={styles.turnActions}>
              {message.failed === 'settings' && onOpenSettings && (
                <button type="button" className={styles.saveBtn} onClick={onOpenSettings}>
                  <GearSix size={13} aria-hidden />
                  Open Settings
                </button>
              )}
              {retryButton}
            </div>
          )}
          {/* Resposta com erro: sem "Sources", que sugeririam uma resposta baseada nelas. */}
        </>
      ) : (
        <>
          {message.thinking && (
            <details className={styles.thinking} open={isStreaming || undefined}>
              <summary className={styles.thinkingSummary}>Thinking</summary>
              <div className={styles.thinkingContent}>{message.thinking}</div>
            </details>
          )}
          <div
            ref={bodyRef}
            className={`${styles.assistantBody} ${onOpenMark ? styles.markClickable : ''}`}
            dangerouslySetInnerHTML={bodyHtml}
            onClick={(e) => {
              const nm = (e.target as HTMLElement).closest('mark[data-nm]')
              if (nm) {
                const text = nm.getAttribute('data-nm')
                if (text) onOpenMark?.(text)
                return
              }
              const img = clickedImage(e)
              if (img) {
                imageViewer.open(img.src, img.alt)
                return
              }
              const target = (e.target as HTMLElement).closest('a')
              if (!target) return
              const href = target.getAttribute('href')
              if (!href || !href.startsWith('http')) return
              e.preventDefault()
              void openUrl(href)
            }}
          />
          {itemActions && message.agentItems && hasAgentPayload(message) && (
            <AgentItemsList
              payload={message.agentItems}
              actions={itemActions}
              disabled={isStreaming}
              messageId={message.id}
              content={message.content}
            />
          )}
          {showMeta && (
            <div className={styles.msgMetaRow}>
              {interruptedLabel && (
                <span className={message.interrupted === 'cut' ? styles.markCut : styles.markStopped}>
                  {interruptedLabel}
                </span>
              )}
              {message.model && (
                <div className={styles.msgMeta}>
                  <span>{message.model}</span>
                  {message.tokensPerSecond !== undefined && !message.interrupted && (
                    <span>{message.tokensPerSecond} tok/s</span>
                  )}
                </div>
              )}
            </div>
          )}
          <div className={styles.assistantActions}>
            {savedNote && !isStreaming && (
              <button
                type="button"
                className={styles.savedMark}
                onClick={savedNote.onOpen}
                title={`Open "${savedNote.title}"`}
              >
                <FloppyDisk size={12} aria-hidden />
                <span className={styles.savedMarkTitle}>Saved to {savedNote.title}</span>
              </button>
            )}
            {interruptedLabel && retryButton}
            {agentDraft && onSaveAgentNote && (
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => onSaveAgentNote(agentDraft)}
                aria-label={AGENT_DRAFT_ACTION[agentDraft.kind].title}
              >
                {DraftIcon && <DraftIcon size={13} aria-hidden />}
                {AGENT_DRAFT_ACTION[agentDraft.kind].label}
              </button>
            )}
            {canSaveToNote && onSaveToNote && (
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => onSaveToNote(message.content)}
                aria-label="Save response to a note"
              >
                <FloppyDisk size={13} aria-hidden />
                Save to note
              </button>
            )}
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy response'}
              aria-label="Copy response"
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            </button>
          </div>
          {footer}
        </>
      )}
      {imageViewer.viewer}
    </div>
  )
}
