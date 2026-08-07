import { openUrl } from '@tauri-apps/plugin-opener'
import { Stop, Sliders, Files, Brain } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useChat,
  type ChatMessage,
  type ChatConversation,
} from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import {
  listOpenRouterModels,
  OPENROUTER_KEY_MISSING,
} from '../../lib/openrouter'
import type { AiModel, Book, BookHighlight } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import { ChatToolsMenu } from '../ChatPanel/ChatToolsMenu'
import { FolderSystemPromptModal } from '../ChatPanel/FolderSystemPromptModal'
import { FolderDocumentSelectorModal } from '../ChatPanel/FolderDocumentSelectorModal'
import { FolderMemoryModal } from '../ChatPanel/FolderMemoryModal'
import { buildReaderContext } from './readerContext'
import styles from './ReaderChatPanel.module.css'

// Versão compacta do chat para a coluna do Reader, no padrão AssistantPanel:
// reaproveita o motor de chat (`useChat` em modo `reader`) — não reimplementa
// streaming nem persistência. Cada livro tem a sua PASTA de chat (vínculo
// bookId → folderId em `monet:reader-book-folder-link`), com várias conversas
// dentro dela; a pasta dá de graça o gerenciamento existente (system prompt,
// documentos/RAG e memória por livro, via os modais de pasta). A cada envio,
// o contexto de leitura atual (página, últimos grifos) é anexado como bloco
// EFÊMERO (nunca persistido). O painel fica SEMPRE montado (escondido via CSS
// quando `open` é false): desmontar o useChat cancelaria um stream ativo.

const ASK_AI_QUOTE_BUDGET = 600

// Largura da coluna, redimensionável por arrasto (padrão do ChatSidebar).
const WIDTH_KEY = 'monet:reader-chat-width'
const MIN_WIDTH = 260
const MAX_WIDTH = 560
const DEFAULT_WIDTH = 340

interface ReaderChatPanelProps {
  book: Book
  pageNum: number
  totalPages: number
  highlights: BookHighlight[]
  getPageText: (pageNum: number) => Promise<string | null>
  // Visual apenas — o painel permanece montado quando fechado.
  open: boolean
  onClose: () => void
  // Trecho vindo do "Ask AI" da toolbar de seleção do Reader.
  pendingQuote: { text: string; page: number } | null
  onPendingQuoteConsumed: () => void
}

export function ReaderChatPanel({
  book,
  pageNum,
  totalPages,
  highlights,
  getPageText,
  open,
  onClose,
  pendingQuote,
  onPendingQuoteConsumed,
}: ReaderChatPanelProps) {
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  const {
    activeId,
    activeConversation,
    conversations,
    folders,
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
    selectConversation,
    ensureReaderBookFolder,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    setFolderMemory,
    setFolderMemoryEnabled,
  } = useChat(models, { mode: 'reader' })

  const [draft, setDraft] = useState('')
  const [bookFolderId, setBookFolderId] = useState<string | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)

  const bookFolder = useMemo(
    () => folders.find((f) => f.id === bookFolderId) ?? null,
    [folders, bookFolderId]
  )

  // Conversas da pasta do livro, na ordem da pasta (mais recente primeiro —
  // materialização e novas conversas fazem prepend). Só conversas DESTE livro
  // aparecem aqui: trocar de conversa nunca vaza contexto de outro livro.
  const folderConversations = useMemo(() => {
    if (!bookFolder) return []
    const byId = new Map(conversations.map((c) => [c.id, c]))
    return bookFolder.conversationIds
      .map((id) => byId.get(id))
      .filter((c): c is ChatConversation => !!c)
  }, [bookFolder, conversations])

  // Rascunho ativo (conversa nova ainda não materializada): aparece no
  // seletor como "New conversation".
  const isDraftActive =
    !!activeConversation &&
    !folderConversations.some((c) => c.id === activeConversation.id)

  // ─── Largura redimensionável (padrão do ChatSidebar) ────────────────────
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(WIDTH_KEY) ?? '', 10)
    if (isNaN(saved)) return DEFAULT_WIDTH
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, saved))
  })
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)
  const currentWidthRef = useRef(width)

  useEffect(() => {
    currentWidthRef.current = width
  }, [width])

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = currentWidthRef.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      // Painel encostado à DIREITA: arrastar o handle para a esquerda
      // aumenta a largura.
      const delta = startXRef.current - e.clientX
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta))
      currentWidthRef.current = next
      setWidth(next)
    }
    const onMouseUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(WIDTH_KEY, String(currentWidthRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Carrega os modelos de forma independente (padrão AssistantPanel).
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

  // Mount (o Reader é remontado por livro, então isto roda 1x por livro):
  // garante a pasta do livro e retoma a conversa mais recente da pasta — ou
  // inicia um rascunho (materializado na pasta só no 1º envio).
  const startedRef = useRef(false)
  // true depois que a instância teve uma conversa ativa — distingue o null
  // inicial (antes do bind) do null de "conversa apagada em outra janela".
  const hadConversationRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const folderId = ensureReaderBookFolder({ id: book.id, title: book.title })
    setBookFolderId(folderId)
    const folder = folders.find((f) => f.id === folderId)
    const convs = folder
      ? conversations.filter((c) => folder.conversationIds.includes(c.id))
      : []
    if (convs.length > 0) {
      const latest = convs.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b))
      selectConversation(latest.id)
    } else {
      // Rascunho ja nasce com a pasta de destino fixada: a materializacao no
      // 1o envio nao depende de resolucao posterior de pasta.
      startAssistantConversation(folderId)
    }
  }, [
    book.id,
    book.title,
    conversations,
    folders,
    ensureReaderBookFolder,
    selectConversation,
    startAssistantConversation,
  ])

  // Se a pasta do livro for apagada no ChatPanel (outra janela), recria no
  // próximo uso: aqui, assim que a remoção reflete no estado. Idempotente —
  // o ensure devolve a pasta existente quando nada mudou.
  useEffect(() => {
    if (!startedRef.current) return
    if (bookFolderId && folders.some((f) => f.id === bookFolderId)) return
    const folderId = ensureReaderBookFolder({ id: book.id, title: book.title })
    setBookFolderId(folderId)
  }, [folders, bookFolderId, book.id, book.title, ensureReaderBookFolder])

  // Recuperação mid-session: apagar a pasta/conversa ativa derruba o activeId
  // para null (modo detached) — inicia um rascunho novo já apontando para a
  // pasta do livro (o ensure recria a pasta se ela também foi apagada).
  useEffect(() => {
    if (activeId !== null) {
      hadConversationRef.current = true
      return
    }
    if (!hadConversationRef.current) return
    hadConversationRef.current = false
    const folderId = ensureReaderBookFolder({ id: book.id, title: book.title })
    setBookFolderId(folderId)
    startAssistantConversation(folderId)
  }, [
    activeId,
    book.id,
    book.title,
    ensureReaderBookFolder,
    startAssistantConversation,
  ])

  // Seleciona um modelo padrão quando a lista carregar.
  useEffect(() => {
    if (models.length === 0) return
    if (model && models.some((m) => m.id === model)) return
    const fallback = localStorage.getItem('lastModelId')
    const next =
      fallback && models.some((m) => m.id === fallback) ? fallback : models[0].id
    setModel(next)
  }, [models, model, setModel])

  // "Ask AI": pré-preenche o composer com o trecho selecionado como citação.
  // NÃO envia automaticamente — o usuário complementa e envia.
  useEffect(() => {
    if (!pendingQuote) return
    const text =
      pendingQuote.text.length > ASK_AI_QUOTE_BUDGET
        ? pendingQuote.text.slice(0, ASK_AI_QUOTE_BUDGET).trimEnd() + '…'
        : pendingQuote.text
    setDraft(`> "${text}"\n> — p. ${pendingQuote.page}\n\n`)
    inputRef.current?.focus()
    onPendingQuoteConsumed()
  }, [pendingQuote, onPendingQuoteConsumed])

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

  async function handleSend() {
    if (!canSend) return
    // Idempotente; recria a pasta (e refresca o ref usado pelo fallback do
    // send) caso ela tenha sido apagada em outra janela durante a sessão.
    ensureReaderBookFolder({ id: book.id, title: book.title })
    const text = draft
    setDraft('')
    // Contexto montado NO MOMENTO do envio: cada envio usa a página e os
    // grifos atuais; navegação posterior não afeta a resposta em streaming.
    const pageText = await getPageText(pageNum).catch(() => null)
    const ephemeralContext = buildReaderContext({
      bookTitle: book.title,
      bookAuthor: book.author,
      pageNum,
      totalPages,
      pageText,
      highlights,
    })
    void send(text, undefined, undefined, { ephemeralContext })
  }

  return (
    <aside
      className={open ? styles.panel : `${styles.panel} ${styles.panelHidden}`}
      style={{ width }}
      aria-label="Book chat"
    >
      <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
      <div className={styles.header}>
        <h3 className={styles.title}>Chat</h3>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="System prompt"
            title="System prompt"
            onClick={() => setPromptOpen(true)}
          >
            <Sliders size={14} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Documents"
            title="Documents"
            onClick={() => setDocsOpen(true)}
          >
            <Files size={14} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Folder memory"
            title="Folder memory"
            onClick={() => setMemoryOpen(true)}
          >
            <Brain size={14} />
          </button>
          <div className={styles.toolsMenu}>
            <ChatToolsMenu
              tools={tools}
              onToggle={setTool}
              folderMemory={bookFolder ? { enabled: bookFolder.memoryEnabled } : null}
              onToggleFolderMemory={(v) =>
                bookFolder && setFolderMemoryEnabled(bookFolder.id, v)
              }
            />
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
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close chat panel"
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.convBar}>
        <select
          className={styles.convSelect}
          value={activeId ?? ''}
          onChange={(e) => {
            if (e.target.value) selectConversation(e.target.value)
          }}
          aria-label="Conversation"
        >
          {isDraftActive && activeConversation && (
            <option value={activeConversation.id}>New conversation</option>
          )}
          {folderConversations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.newChatBtn}
          onClick={() => {
            // Ensure devolve o id fresco (recria a pasta se foi apagada em
            // outra janela) e o rascunho nasce vinculado a ela.
            const folderId = ensureReaderBookFolder({
              id: book.id,
              title: book.title,
            })
            setBookFolderId(folderId)
            startAssistantConversation(folderId)
          }}
        >
          New chat
        </button>
      </div>

      {apiKeyChecked && !hasApiKey && (
        <div className={styles.keyBanner} role="alert">
          Add your OpenRouter key in Settings to chat about this book.
        </div>
      )}

      <div className={styles.history} ref={historyRef}>
        {messages.length === 0 ? (
          <p className={styles.empty}>
            Ask about this book — the AI sees your current page and your most
            recent highlights.
          </p>
        ) : (
          messages.map((m) => (
            <ReaderChatBubble
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
              void handleSend()
            }
          }}
          placeholder={
            hasApiKey ? 'Ask about this book...' : 'Configure your OpenRouter key first.'
          }
          rows={3}
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
              onClick={() => void handleSend()}
              disabled={!canSend}
            >
              Send
            </button>
          )}
        </div>
      </div>

      <FolderSystemPromptModal
        open={promptOpen}
        folder={bookFolder}
        onConfirm={(folderId, text, mode) =>
          setFolderSystemPrompt(folderId, text, mode)
        }
        onClose={() => setPromptOpen(false)}
      />
      <FolderDocumentSelectorModal
        open={docsOpen}
        folder={bookFolder}
        onConfirm={(folderId, visibleDocumentIds) =>
          setFolderVisibleDocuments(folderId, visibleDocumentIds)
        }
        onClose={() => setDocsOpen(false)}
      />
      <FolderMemoryModal
        open={memoryOpen}
        folder={bookFolder}
        onConfirm={(folderId, text) => setFolderMemory(folderId, text)}
        onClose={() => setMemoryOpen(false)}
      />
    </aside>
  )
}

interface ReaderChatBubbleProps {
  message: ChatMessage
  isStreaming: boolean
}

function ReaderChatBubble({ message, isStreaming }: ReaderChatBubbleProps) {
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
