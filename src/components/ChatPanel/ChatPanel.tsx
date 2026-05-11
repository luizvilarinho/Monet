import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useMemo, useState } from 'react'
import { useChat, type ChatMessage } from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import type { AiModel } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import styles from './ChatPanel.module.css'
import { ChatSidebar } from './ChatSidebar'
import { ChatToolsMenu } from './ChatToolsMenu'

export interface ChatPanelProps {
  models: AiModel[]
  modelsLoading: boolean
  modelsError: string | null
  onOpenSettings: () => void
}

export function ChatPanel({
  models,
  modelsLoading,
  modelsError,
  onOpenSettings,
}: ChatPanelProps) {
  const {
    conversations,
    activeId,
    messages,
    model,
    setModel,
    hasApiKey,
    apiKeyChecked,
    tools,
    setTool,
    isStreaming,
    error,
    send,
    selectConversation,
    newConversation,
    deleteConversation,
  } = useChat()

  const [draft, setDraft] = useState('')

  // Selecionar modelo padrao quando a lista carregar
  useEffect(() => {
    if (models.length === 0) return
    if (model && models.some((m) => m.id === model)) return
    const fallback = localStorage.getItem('lastModelId')
    const next =
      fallback && models.some((m) => m.id === fallback)
        ? fallback
        : models[0].id
    setModel(next)
  }, [models, model, setModel])

  // Limpa o draft ao trocar de conversa
  useEffect(() => {
    setDraft('')
  }, [activeId])

  const canSend =
    !isStreaming &&
    hasApiKey &&
    draft.trim().length > 0 &&
    !!model &&
    models.length > 0

  function handleSend() {
    if (!canSend) return
    const text = draft
    setDraft('')
    void send(text)
  }

  return (
    <section className={styles.panel} aria-label="Chat com a IA">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNew={newConversation}
        onDelete={deleteConversation}
      />

      <div className={styles.main}>
        <header className={styles.header}>
          <span className={styles.title}>Chat</span>
          <ModelSelector
            hasApiKey={hasApiKey}
            apiKeyChecked={apiKeyChecked}
            loading={modelsLoading}
            error={modelsError}
            models={models}
            selectedId={model}
            onSelect={setModel}
            onOpenSettings={onOpenSettings}
          />
        </header>

        {apiKeyChecked && !hasApiKey && (
          <div className={styles.keyBanner} role="alert">
            <span>
              Configure a chave do OpenRouter em Settings para conversar com a IA.
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              className={styles.keyBannerCta}
            >
              abrir Settings
            </button>
          </div>
        )}

        <div className={styles.history}>
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Olá! Eu sou o seu assistente.</p>
              <p className={styles.emptyHint}>
                Pergunte qualquer coisa, discuta ideias ou peça ajuda — sem
                precisar criar uma nota.
              </p>
            </div>
          ) : (
            messages.map((m) => <ChatBubble key={m.id} message={m} />)
          )}
        </div>

        {error && messages.length > 0 && (
          <div className={styles.errorRow} role="alert">
            {error}
          </div>
        )}

        <footer className={styles.composer}>
          <div className={styles.composerInner}>
            <textarea
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={
                hasApiKey
                  ? 'Escreva uma mensagem...'
                  : 'Configure a chave do OpenRouter para começar.'
              }
              rows={3}
              disabled={!hasApiKey}
              aria-label="mensagem"
            />
            <div className={styles.composerActions}>
              <ChatToolsMenu tools={tools} onToggle={setTool} />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!canSend}
              >
                {isStreaming ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </section>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const isStreamingPlaceholder = !isUser && message.content.length === 0

  const cacheKey = useMemo(
    () => (isUser ? null : `${message.id}:${message.content.length}`),
    [isUser, message.id, message.content]
  )

  useEffect(() => {
    if (isUser) return
    if (!message.content) {
      setHtml('')
      return
    }
    let cancelled = false
    renderMarkdown(message.content).then((out) => {
      if (!cancelled) setHtml(out)
    })
    return () => {
      cancelled = true
    }
  }, [isUser, message.content, cacheKey])

  function handleCopy() {
    if (isUser) return
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className={isUser ? styles.bubbleUser : styles.bubbleAssistant}
      data-role={message.role}
    >
      {isUser ? (
        <p className={styles.userText}>{message.content}</p>
      ) : isStreamingPlaceholder ? (
        <span className={styles.streamingDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <>
          <div
            className={styles.assistantBody}
            dangerouslySetInnerHTML={{ __html: html }}
            onClick={(e) => {
              const target = (e.target as HTMLElement).closest('a')
              if (!target) return
              const href = target.getAttribute('href')
              if (!href || !href.startsWith('http')) return
              e.preventDefault()
              void openUrl(href)
            }}
          />
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopy}
            title={copied ? 'Copiado!' : 'Copiar resposta'}
            aria-label="Copiar resposta"
          >
            {copied ? (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="3,8 6,11 13,4" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="5" width="9" height="9" rx="1" />
                <path d="M11 4V3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1" />
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  )
}
