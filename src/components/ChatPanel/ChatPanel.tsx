import { openUrl } from '@tauri-apps/plugin-opener'
import { invoke } from '@tauri-apps/api/core'
import { Brain, Paperclip, Stop } from '@phosphor-icons/react'
import deepGrayIcon from '../../assets/icons/deep-gray.svg'
import deepGreenIcon from '../../assets/icons/deep-green.svg'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat, type ChatFolder, type ChatMessage } from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import type { AiModel, Note, Notebook } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import styles from './ChatPanel.module.css'
import { ChatSidebar } from './ChatSidebar'
import { ChatToolsMenu } from './ChatToolsMenu'
import { FolderDocumentSelectorModal } from './FolderDocumentSelectorModal'
import { FolderMemoryModal } from './FolderMemoryModal'
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
    webSearchActive,
    thinkingEnabled,
    toggleThinking,
    error,
    send,
    cancel,
    selectConversation,
    newConversation,
    newConversationInFolder,
    deleteConversation,
    renameConversation,
    createFolder,
    renameFolder,
    deleteFolder,
    setFolderExpanded,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    setFolderMemory,
    setFolderMemoryEnabled,
    folderMemoryUpdatedAt,
    moveConversation,
    removeConversationFromFolder,
    reorderFolders,
    reorderInFolder,
    reorderLoose,
  } = useChat(models)

  const [draft, setDraft] = useState('')
  const [draftImage, setDraftImage] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [draftDocs, setDraftDocs] = useState<Array<{ name: string; type: string; data: string }>>([])
  const [docError, setDocError] = useState<string | null>(null)
  const [isPdfProcessing, setIsPdfProcessing] = useState(false)
  const [saveTarget, setSaveTarget] = useState<{ messageId: string; content: string } | null>(null)
  const [systemPromptFolderId, setSystemPromptFolderId] = useState<string | null>(
    null,
  )
  const [memoryFolderId, setMemoryFolderId] = useState<string | null>(null)
  const [memoryToastVisible, setMemoryToastVisible] = useState(false)
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
    setDraftDocs([])
  }, [activeId])

  const selectedModel = models.find((m) => m.id === model)
  const modelSupportsVision = selectedModel?.supportsVision ?? false
  const visionWarning = !!draftImage && !modelSupportsVision

  const canSend =
    !isStreaming &&
    !isPdfProcessing &&
    hasApiKey &&
    (draft.trim().length > 0 || !!draftImage || draftDocs.length > 0) &&
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

  const memoryFolder: ChatFolder | null = useMemo(() => {
    if (!memoryFolderId) return null
    return folders.find((f) => f.id === memoryFolderId) ?? null
  }, [folders, memoryFolderId])

  const activeFolder: ChatFolder | null = useMemo(() => {
    if (!activeId) return null
    return folders.find((f) => f.conversationIds.includes(activeId)) ?? null
  }, [folders, activeId])

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

  useEffect(() => {
    if (folderMemoryUpdatedAt === null) return
    setMemoryToastVisible(true)
    const id = window.setTimeout(() => setMemoryToastVisible(false), 4000)
    return () => window.clearTimeout(id)
  }, [folderMemoryUpdatedAt])

  function handleSend() {
    if (!canSend) return
    const text = draft
    const img = draftImage
    const docs = draftDocs
    setDraft('')
    setDraftImage(null)
    setDraftDocs([])
    void send(text, img ?? undefined, docs.length > 0 ? docs : undefined)
  }

  function handleStop() {
    cancel()
  }

  function resolveFileType(file: File): string {
    if (file.type) return file.type
    if (file.name.endsWith('.md')) return 'text/markdown'
    if (file.name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (file.name.endsWith('.pdf')) return 'application/pdf'
    return 'text/plain'
  }

  function handlePickFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,text/plain,text/markdown,.md,.pdf'
    input.multiple = true
    input.onchange = () => {
      const files = Array.from(input.files ?? [])
      if (files.length === 0) return
      setDocError(null)
      setImageError(null)
      const errors: string[] = []
      for (const file of files) {
        const mime = resolveFileType(file)
        const isImage = mime.startsWith('image/')
        const isText = mime.startsWith('text/')
        const isPdf = mime === 'application/pdf'
        const isDocx = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        if (isDocx) {
          errors.push('DOCX files are not supported yet. Please convert to PDF, TXT or Markdown.')
          continue
        }
        if (!isImage && !isText && !isPdf) {
          errors.push(`File type not supported: ${file.name}`)
          continue
        }
        if (file.size > 5 * 1024 * 1024) {
          errors.push(`File exceeds the 5 MB limit: ${file.name}`)
          continue
        }
        if (isImage) {
          const reader = new FileReader()
          reader.onload = () => setDraftImage(reader.result as string)
          reader.readAsDataURL(file)
        } else if (isText) {
          // Text files are sent inline as message text — works with all models
          const reader = new FileReader()
          reader.onload = () =>
            setDraftDocs((prev) => [...prev, { name: file.name, type: mime, data: reader.result as string }])
          reader.readAsText(file)
        } else {
          // PDF — extract text in the backend and send inline as plain text.
          // This works with any model and avoids provider-specific document formats.
          const reader = new FileReader()
          reader.onload = async () => {
            const buffer = reader.result as ArrayBuffer
            const bytes = Array.from(new Uint8Array(buffer))
            setIsPdfProcessing(true)
            try {
              const extracted = await invoke<string>('extract_pdf_text', { bytes })
              setDraftDocs((prev) => [
                ...prev,
                { name: file.name, type: 'text/plain', data: extracted },
              ])
            } catch (err) {
              const message = typeof err === 'string' ? err : 'Failed to read PDF'
              setDocError(`${file.name}: ${message}`)
            } finally {
              setIsPdfProcessing(false)
            }
          }
          reader.readAsArrayBuffer(file)
        }
      }
      if (errors.length > 0) {
        setDocError(errors.join(' '))
      }
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
        onRenameConversation={renameConversation}
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
        onOpenFolderMemory={(folder) => setMemoryFolderId(folder.id)}
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
            {(draftImage || draftDocs.length > 0) && (
              <div className={styles.attachmentPreviews}>
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
                {draftDocs.map((doc, i) => (
                  <div key={i} className={styles.docPill}>
                    <span className={styles.docPillName}>{doc.name}</span>
                    <button
                      type="button"
                      className={styles.docPillRemove}
                      onClick={() => setDraftDocs((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${doc.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isPdfProcessing && (
              <div className={styles.pdfProcessing} role="status" aria-live="polite">
                Processing document...
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
            {webSearchActive && (
              <div className={styles.webSearchProgress} role="status" aria-live="polite">
                <span className={styles.webSearchDot} aria-hidden="true" />
                Searching the web...
              </div>
            )}
            {memoryToastVisible && (
              <div className={styles.webSearchProgress} role="status" aria-live="polite">
                <span className={styles.webSearchDot} aria-hidden="true" />
                Folder memory updated
              </div>
            )}
            {visionWarning && (
              <div className={styles.visionWarning} role="alert">
                This model does not support images. Switch to a vision-capable model or remove the image.
              </div>
            )}
            {imageError && (
              <div className={styles.visionWarning} role="alert">
                {imageError}
              </div>
            )}
            {docError && (
              <div className={styles.visionWarning} role="alert">
                {docError}
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
                className={tools.deepResearch ? styles.deepResearchBtnOn : styles.deepResearchBtn}
                onClick={() => setTool('deepResearch', !tools.deepResearch)}
                title={tools.deepResearch ? 'Deep Research enabled — click to disable' : 'Enable Deep Research'}
                aria-pressed={tools.deepResearch}
              >
                <img src={tools.deepResearch ? deepGreenIcon : deepGrayIcon} alt="" aria-hidden="true" className={styles.deepResearchIcon} />
                Deep Research
              </button>
              <button
                type="button"
                className={thinkingEnabled ? styles.thinkingBtnOn : styles.thinkingBtn}
                onClick={toggleThinking}
                title={thinkingEnabled ? 'Thinking enabled — click to disable' : 'Enable thinking'}
                aria-pressed={thinkingEnabled}
              >
                <Brain size={15} weight={thinkingEnabled ? 'fill' : 'regular'} />
              </button>
              <button
                type="button"
                className={styles.attachBtn}
                onClick={handlePickFile}
                title="Attach file"
                aria-label="Attach file"
                disabled={!hasApiKey}
              >
                <Paperclip size={15} />
              </button>
              <ChatToolsMenu
                tools={tools}
                onToggle={setTool}
                folderMemory={activeFolder ? { enabled: activeFolder.memoryEnabled } : null}
                onToggleFolderMemory={(v) => activeFolder && setFolderMemoryEnabled(activeFolder.id, v)}
              />
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

      <FolderMemoryModal
        open={memoryFolder !== null}
        folder={memoryFolder}
        onConfirm={(folderId, text) => setFolderMemory(folderId, text)}
        onClose={() => setMemoryFolderId(null)}
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

  const hasAttachedDocs = isUser && message.attachedDocs && message.attachedDocs.length > 0

  return (
    <div
      className={isUser ? (hasAttachedDocs ? styles.bubbleUserWrapper : styles.bubbleUser) : styles.bubbleAssistant}
      data-role={message.role}
    >
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
            {message.imageDataUrl && (
              <img
                src={message.imageDataUrl}
                alt="attached image"
                className={styles.userMessageImage}
              />
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
