import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat, type ChatMessage } from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import type { AiModel, Note, Notebook } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import styles from './ChatPanel.module.css'
import { ChatSidebar } from './ChatSidebar'
import { ChatToolsMenu } from './ChatToolsMenu'
import { SaveToNoteModal } from './SaveToNoteModal'

export interface ChatPanelProps {
  models: AiModel[]
  modelsLoading: boolean
  modelsError: string | null
  onOpenSettings: () => void
  notebooks: Notebook[]
  notes: Note[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (notebookId: string, title: string, content: string) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  onNavigateToNote: (notebookId: string, noteId: string) => void
}

export function ChatPanel({
  models,
  modelsLoading,
  modelsError,
  onOpenSettings,
  notebooks,
  notes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
  onNavigateToNote,
}: ChatPanelProps) {
  const {
    conversations,
    folders,
    looseConversationIds,
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
    newConversationInFolder,
    deleteConversation,
    createFolder,
    renameFolder,
    deleteFolder,
    setFolderExpanded,
    moveConversation,
    removeConversationFromFolder,
    reorderFolders,
    reorderInFolder,
    reorderLoose,
  } = useChat()

  const [draft, setDraft] = useState('')
  const [saveTarget, setSaveTarget] = useState<{ messageId: string; content: string } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('monet:chat-sidebar-width') ?? '', 10)
    if (isNaN(saved)) return 240
    return Math.min(480, Math.max(180, saved))
  })

  useEffect(() => {
    if (!hasApiKey) return
    inputRef.current?.focus()
  }, [hasApiKey])

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

  // Identifica qual mensagem (se alguma) está atualmente em streaming:
  // sempre a última mensagem do tipo assistant da conversa ativa, quando
  // isStreaming === true.
  const streamingMessageId = useMemo(() => {
    if (!isStreaming) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [isStreaming, messages])

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
        folders={folders}
        looseConversationIds={looseConversationIds}
        activeId={activeId}
        onSelect={selectConversation}
        onNew={newConversation}
        onDelete={deleteConversation}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onToggleFolderExpanded={setFolderExpanded}
        onNewConversationInFolder={newConversationInFolder}
        onMoveConversation={moveConversation}
        onRemoveConversationFromFolder={removeConversationFromFolder}
        onReorderFolders={reorderFolders}
        onReorderInFolder={reorderInFolder}
        onReorderLoose={reorderLoose}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
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
            messages.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                isStreaming={m.id === streamingMessageId}
                onSaveToNote={(content) =>
                  setSaveTarget({ messageId: m.id, content })
                }
              />
            ))
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
              ref={inputRef}
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

      <SaveToNoteModal
        open={saveTarget !== null}
        content={saveTarget?.content ?? ''}
        notebooks={notebooks}
        notes={notes}
        onCreateNotebook={onCreateNotebook}
        onCreateNote={onCreateNote}
        onSaveNote={onSaveNote}
        onNavigateToNote={onNavigateToNote}
        onClose={() => setSaveTarget(null)}
      />
    </section>
  )
}

interface ChatBubbleProps {
  message: ChatMessage
  isStreaming: boolean
  onSaveToNote: (content: string) => void
}

function ChatBubble({ message, isStreaming, onSaveToNote }: ChatBubbleProps) {
  const isUser = message.role === 'user'
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const isStreamingPlaceholder = !isUser && message.content.length === 0
  const isErrorMessage =
    !isUser &&
    message.content.startsWith('Erro:')
  const canSaveToNote =
    !isUser &&
    !isStreaming &&
    !isStreamingPlaceholder &&
    !isErrorMessage &&
    message.content.trim().length > 0

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
          <div className={styles.assistantActions}>
            {canSaveToNote && (
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => onSaveToNote(message.content)}
                aria-label="Salvar resposta em uma nota"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 2h8l2 2v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
                  <polyline points="5,2 5,7 10,7 10,2" />
                  <line x1="5" y1="11" x2="11" y2="11" />
                </svg>
                Salvar em nota
              </button>
            )}
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
          </div>
        </>
      )}
    </div>
  )
}
