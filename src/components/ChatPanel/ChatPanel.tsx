import { openUrl } from '@tauri-apps/plugin-opener'
import { Brain, Stop } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat, type ChatFolder, type ChatMessage } from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import type { AiModel, Note, Notebook } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import styles from './ChatPanel.module.css'
import { ChatSidebar } from './ChatSidebar'
import { ChatToolsMenu } from './ChatToolsMenu'
import { FolderDocumentSelectorModal } from './FolderDocumentSelectorModal'
import { FolderSystemPromptModal } from './FolderSystemPromptModal'
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
    deepResearchPhase,
    thinkingEnabled,
    toggleThinking,
    error,
    send,
    cancel,
    selectConversation,
    newConversation,
    newConversationInFolder,
    deleteConversation,
    createFolder,
    renameFolder,
    deleteFolder,
    setFolderExpanded,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    moveConversation,
    removeConversationFromFolder,
    reorderFolders,
    reorderInFolder,
    reorderLoose,
  } = useChat()

  const [draft, setDraft] = useState('')
  const [draftImage, setDraftImage] = useState<string | null>(null)
  const [saveTarget, setSaveTarget] = useState<{ messageId: string; content: string } | null>(null)
  const [systemPromptFolderId, setSystemPromptFolderId] = useState<string | null>(
    null,
  )
  const [folderDocsFolder, setFolderDocsFolder] = useState<ChatFolder | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('monet:chat-sidebar-width') ?? '', 10)
    if (isNaN(saved)) return 240
    return Math.min(480, Math.max(180, saved))
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('monet:chat-sidebar-collapsed') === '1'
  )

  useEffect(() => {
    localStorage.setItem('monet:chat-sidebar-collapsed', sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

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
    setDraftImage(null)
  }, [activeId])

  const selectedModel = models.find((m) => m.id === model)
  const modelSupportsVision = selectedModel?.supportsVision ?? false
  const visionWarning = !!draftImage && !modelSupportsVision

  const canSend =
    !isStreaming &&
    hasApiKey &&
    (draft.trim().length > 0 || !!draftImage) &&
    !!model &&
    models.length > 0 &&
    !visionWarning

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

  const systemPromptFolder: ChatFolder | null = useMemo(() => {
    if (!systemPromptFolderId) return null
    return folders.find((f) => f.id === systemPromptFolderId) ?? null
  }, [folders, systemPromptFolderId])

  // Scroll unico ao final do historico quando o usuario envia uma nova mensagem
  // na mesma conversa. Trocas de conversa nao disparam (cada conversa preserva
  // sua posicao). Streaming nao dispara (so o id da ultima msg de user importa).
  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].id
    }
    return null
  }, [messages])
  const prevActiveIdRef = useRef(activeId)
  const prevLastUserMessageIdRef = useRef(lastUserMessageId)
  useEffect(() => {
    const sameConv = prevActiveIdRef.current === activeId
    const userMsgChanged =
      prevLastUserMessageIdRef.current !== lastUserMessageId
    prevActiveIdRef.current = activeId
    prevLastUserMessageIdRef.current = lastUserMessageId
    if (!sameConv || !userMsgChanged || !lastUserMessageId) return
    const el = historyRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [activeId, lastUserMessageId])

  // Durante streaming, acompanha o crescimento da resposta rolando para baixo
  // somente se o usuario nao tiver scrollado para cima manualmente.
  useEffect(() => {
    if (!isStreaming) return
    const el = historyRef.current
    if (!el) return
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48
    if (isAtBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
    }
  }, [messages, isStreaming])

  function handleSend() {
    if (!canSend) return
    const text = draft
    const img = draftImage
    setDraft('')
    setDraftImage(null)
    void send(text, img ?? undefined)
  }

  function handleStop() {
    cancel()
  }

  function handlePickImage() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setDraftImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return (
    <section className={styles.panel} aria-label="AI Chat">
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
        onOpenFolderSystemPrompt={(folder) =>
          setSystemPromptFolderId(folder.id)
        }
        onOpenFolderDocuments={(folder) => setFolderDocsFolder(folder)}
        width={sidebarCollapsed ? 48 : sidebarWidth}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
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
              Add your OpenRouter key in Settings to chat with the AI.
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              className={styles.keyBannerCta}
            >
              open Settings
            </button>
          </div>
        )}

        <div
          className={styles.history}
          ref={historyRef}
          onScroll={() => {
            const el = historyRef.current
            if (!el) return
            setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 32)
          }}
        >
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Hi! I am your assistant.</p>
              <p className={styles.emptyHint}>
                Ask anything, discuss ideas, or get help — no note needed.
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

        {!atBottom && (
          <button
            type="button"
            className={styles.scrollBtn}
            aria-label="Scroll to bottom"
            onClick={() => {
              const el = historyRef.current
              if (!el) return
              el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
            }}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="4,6 8,10 12,6" />
            </svg>
          </button>
        )}

        {error && messages.length > 0 && (
          <div className={styles.errorRow} role="alert">
            {error}
          </div>
        )}

        <footer className={styles.composer}>
          <div className={styles.composerInner}>
            {draftImage && (
              <div className={styles.imagePreview}>
                <img src={draftImage} alt="attachment preview" className={styles.imagePreviewThumb} />
                <button
                  type="button"
                  className={styles.imagePreviewRemove}
                  onClick={() => setDraftImage(null)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            )}
            {deepResearchPhase && (
              <div className={styles.deepResearchProgress} role="status" aria-live="polite">
                <span className={styles.deepResearchDot} aria-hidden="true" />
                {deepResearchPhase === 'searching' && 'Searching the web...'}
                {deepResearchPhase === 'expanding' && 'Generating sub-queries...'}
                {deepResearchPhase === 'broadening' && 'Exploring related topics...'}
                {deepResearchPhase === 'ranking' && 'Ranking results...'}
                {deepResearchPhase === 'synthesizing' && 'Preparing synthesis...'}
              </div>
            )}
            {visionWarning && (
              <div className={styles.visionWarning} role="alert">
                This model does not support images. Switch to a vision-capable model or remove the image.
              </div>
            )}
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
              onPaste={(e) => {
                const items = Array.from(e.clipboardData.items)
                const imageItem = items.find((item) => item.type.startsWith('image/'))
                if (!imageItem) return
                e.preventDefault()
                const file = imageItem.getAsFile()
                if (!file) return
                if (file.size > 5 * 1024 * 1024) return
                const reader = new FileReader()
                reader.onload = () => setDraftImage(reader.result as string)
                reader.readAsDataURL(file)
              }}
              placeholder={
                hasApiKey
                  ? 'Write a message...'
                  : 'Configure your OpenRouter key to get started.'
              }
              rows={3}
              disabled={!hasApiKey}
              aria-label="message"
            />
            <div className={styles.composerActions}>
              <button
                type="button"
                className={styles.attachBtn}
                onClick={handlePickImage}
                title="Attach image"
                aria-label="Attach image"
                disabled={!hasApiKey}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="14" height="10" rx="1.5" />
                  <circle cx="5.5" cy="6.5" r="1" />
                  <polyline points="1,11 5,7 8,10 11,7.5 15,11" />
                </svg>
              </button>
              <ChatToolsMenu tools={tools} onToggle={setTool} />
              <button
                type="button"
                className={thinkingEnabled ? styles.thinkingBtnOn : styles.thinkingBtn}
                onClick={toggleThinking}
                title={thinkingEnabled ? 'Thinking enabled — click to disable' : 'Enable thinking'}
                aria-pressed={thinkingEnabled}
              >
                <Brain size={15} weight={thinkingEnabled ? 'fill' : 'regular'} />
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  className={styles.stopBtn}
                  onClick={handleStop}
                >
                  <Stop size={14} weight="fill" />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={!canSend}
                >
                  Send
                </button>
              )}
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

      <FolderSystemPromptModal
        open={systemPromptFolder !== null}
        folder={systemPromptFolder}
        onConfirm={(folderId, text, mode) =>
          setFolderSystemPrompt(folderId, text, mode)
        }
        onClose={() => setSystemPromptFolderId(null)}
      />

      <FolderDocumentSelectorModal
        open={folderDocsFolder !== null}
        folder={folderDocsFolder}
        onConfirm={(folderId, visibleDocumentIds) =>
          setFolderVisibleDocuments(folderId, visibleDocumentIds)
        }
        onClose={() => setFolderDocsFolder(null)}
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
    message.content.startsWith('Error:')
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
        <div>
          {message.imageDataUrl && (
            <img
              src={message.imageDataUrl}
              alt="attached image"
              className={styles.userMessageImage}
            />
          )}
          <p className={styles.userText}>{message.content}</p>
        </div>
      ) : isStreamingPlaceholder ? (
        <span className={styles.streamingDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <>
          {message.thinking && (
            <details className={styles.thinking} open={isStreaming || undefined}>
              <summary className={styles.thinkingSummary}>Thinking</summary>
              <div className={styles.thinkingContent}>{message.thinking}</div>
            </details>
          )}
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
          {!isStreaming && message.model && (
            <div className={styles.msgMeta}>
              <span>{message.model}</span>
              {message.tokensPerSecond !== undefined && (
                <span>{message.tokensPerSecond} tok/s</span>
              )}
            </div>
          )}
          <div className={styles.assistantActions}>
            {canSaveToNote && (
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => onSaveToNote(message.content)}
                aria-label="Save response to a note"
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
