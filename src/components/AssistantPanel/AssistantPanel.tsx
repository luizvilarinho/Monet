import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Stop, Sliders, Files } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useChat,
  ASSISTANT_FOLDER_NAME,
  type ChatMessage,
} from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import {
  listOpenRouterModels,
  OPENROUTER_KEY_MISSING,
} from '../../lib/openrouter'
import type { AiModel } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import { ChatToolsMenu } from '../ChatPanel/ChatToolsMenu'
import { FolderSystemPromptModal } from '../ChatPanel/FolderSystemPromptModal'
import { FolderDocumentSelectorModal } from '../ChatPanel/FolderDocumentSelectorModal'
import styles from './AssistantPanel.module.css'

// Versao compacta do chat para a janela `assistant`. Reaproveita o motor de
// chat (`useChat`) — nao reimplementa streaming nem persistencia. As conversas
// sao criadas dentro da pasta `assistant`, compartilhada via localStorage com
// a janela principal.
export function AssistantPanel() {
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  const {
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
    cancel,
    startAssistantConversation,
    folders,
    ensureAssistantFolder,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
  } = useChat(models, { isAssistant: true })

  const [draft, setDraft] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const assistantFolder = useMemo(
    () => folders.find((f) => f.name === ASSISTANT_FOLDER_NAME) ?? null,
    [folders]
  )
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)

  // Carrega os modelos de forma independente da janela principal.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setModelsLoading(true)
      setModelsError(null)
      try {
        const list = await listOpenRouterModels()
        if (cancelled) return
        setModels(list)
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : String(err ?? 'failed to load models')
        setModels([])
        setModelsError(message.includes(OPENROUTER_KEY_MISSING) ? null : message)
      } finally {
        if (!cancelled) setModelsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Cria uma conversa NOVA e zerada na pasta `assistant` a cada exibicao da
  // janela. A janela e escondida/mostrada (nao remontada), entao o disparo nao
  // pode ser so no mount: o Rust emite `assistant-shown` ao MOSTRAR a janela e
  // escutamos esse evento aqui. Mantemos a criacao no primeiro mount para o caso
  // de a janela ja abrir visivel na primeira vez.
  const startedRef = useRef(false)
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      startAssistantConversation()
    }
    let unlisten: (() => void) | undefined
    let cancelled = false
    void listen('assistant-shown', () => {
      startAssistantConversation()
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [startAssistantConversation])

  // Seleciona um modelo padrao quando a lista carregar.
  useEffect(() => {
    if (models.length === 0) return
    if (model && models.some((m) => m.id === model)) return
    const fallback = localStorage.getItem('lastModelId')
    const next =
      fallback && models.some((m) => m.id === fallback) ? fallback : models[0].id
    setModel(next)
  }, [models, model, setModel])

  useEffect(() => {
    if (hasApiKey) inputRef.current?.focus()
  }, [hasApiKey])

  // Acompanha o crescimento da resposta rolando para baixo.
  useEffect(() => {
    const el = historyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight })
  }, [messages])

  const streamingMessageId = useMemo(() => {
    if (!isStreaming) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [isStreaming, messages])

  const canSend =
    !isStreaming &&
    hasApiKey &&
    draft.trim().length > 0 &&
    !!model &&
    models.length > 0 &&
    !!activeId

  function handleSend() {
    if (!canSend) return
    const text = draft
    setDraft('')
    void send(text)
  }

  return (
    <div className={styles.window}>
      <div className={styles.titlebar} data-tauri-drag-region>
        <span className={styles.title}>Assistant</span>
        <div className={styles.titleActions}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="System prompt"
            title="System prompt"
            onClick={() => {
              ensureAssistantFolder()
              setPromptOpen(true)
            }}
          >
            <Sliders size={14} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Documents"
            title="Documents"
            onClick={() => {
              ensureAssistantFolder()
              setDocsOpen(true)
            }}
          >
            <Files size={14} />
          </button>
          <div className={styles.toolsMenu}>
            <ChatToolsMenu tools={tools} onToggle={setTool} />
          </div>
          <ModelSelector
            hasApiKey={hasApiKey}
            apiKeyChecked={apiKeyChecked}
            loading={modelsLoading}
            error={modelsError}
            models={models}
            selectedId={model}
            onSelect={setModel}
            onOpenSettings={() => {}}
          />
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Close"
            title="Close (Ctrl+M)"
            onClick={() => {
              void getCurrentWindow().hide()
            }}
          >
            ×
          </button>
        </div>
      </div>

      {apiKeyChecked && !hasApiKey && (
        <div className={styles.keyBanner} role="alert">
          Add your OpenRouter key in the main window Settings to use the assistant.
        </div>
      )}

      <div className={styles.history} ref={historyRef}>
        {messages.length === 0 ? (
          <p className={styles.empty}>Ask anything — press Enter to send.</p>
        ) : (
          messages.map((m) => (
            <AssistantBubble
              key={m.id}
              message={m}
              isStreaming={m.id === streamingMessageId}
            />
          ))
        )}
      </div>

      {error && messages.length > 0 && (
        <div className={styles.errorRow} role="alert">
          {error}
        </div>
      )}

      <div className={styles.composer}>
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
            hasApiKey ? 'Write a message...' : 'Configure your OpenRouter key first.'
          }
          rows={2}
          disabled={!hasApiKey}
          aria-label="message"
        />
        <div className={styles.actions}>
          {isStreaming ? (
            <button type="button" className={styles.stopBtn} onClick={cancel}>
              <Stop size={13} weight="fill" />
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

      <FolderSystemPromptModal
        open={promptOpen}
        folder={assistantFolder}
        onConfirm={(folderId, text, mode) =>
          setFolderSystemPrompt(folderId, text, mode)
        }
        onClose={() => setPromptOpen(false)}
      />
      <FolderDocumentSelectorModal
        open={docsOpen}
        folder={assistantFolder}
        onConfirm={(folderId, visibleDocumentIds) =>
          setFolderVisibleDocuments(folderId, visibleDocumentIds)
        }
        onClose={() => setDocsOpen(false)}
      />
    </div>
  )
}

interface AssistantBubbleProps {
  message: ChatMessage
  isStreaming: boolean
}

function AssistantBubble({ message, isStreaming }: AssistantBubbleProps) {
  const isUser = message.role === 'user'
  const [html, setHtml] = useState('')
  const isStreamingPlaceholder = !isUser && message.content.length === 0

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
  }, [isUser, message.content])

  if (isUser) {
    return <div className={styles.bubbleUser}>{message.content}</div>
  }

  if (isStreamingPlaceholder) {
    return (
      <span className={styles.streamingDots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    )
  }

  return (
    <div
      className={styles.bubbleAssistant}
      data-streaming={isStreaming || undefined}
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
  )
}
