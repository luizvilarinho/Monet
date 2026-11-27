import { openUrl } from '@tauri-apps/plugin-opener'
import {
  Stop,
  Sliders,
  Files,
  Brain,
  X,
  NotePencil,
  Copy,
  Check,
  WarningCircle,
  ChalkboardTeacher,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useChat,
  folderConversationIds,
  type ChatMessage,
  type ChatConversation,
  type ChatTimings,
} from '../../hooks/useChat'
import { announceAppendedBlock } from '../../hooks/useBookQuotes'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import {
  appendBlockToNote,
  buildAiResponseBlock,
  noteDestinationLabel,
  resolveLinkedNote,
} from '../../lib/bookQuotes'
import { renderMarkdown } from '../../lib/markdown'
import { linkNoteMarks } from '../../lib/noteMarks'
import {
  listOpenRouterModels,
  OPENROUTER_KEY_MISSING,
} from '../../lib/openrouter'
import type { AiModel, Book, BookHighlight, Note, Notebook } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import { ChatToolsMenu } from '../ChatPanel/ChatToolsMenu'
import { ClearAllChatsButton, ClearChatButton } from '../ChatPanel/ChatClearActions'
import { emptyAnswerState } from '../ChatPanel/ChatMessageBubble'
import bubbleStyles from '../ChatPanel/ChatMessageBubble.module.css'
import { SaveToNoteModal } from '../ChatPanel/SaveToNoteModal'
import { clickedImage, useImageViewer } from '../ImageViewer/ImageViewer'
import { useMermaidDiagrams } from '../MermaidDiagram/useMermaidDiagrams'
import { FolderSystemPromptModal } from '../ChatPanel/FolderSystemPromptModal'
import { FolderDocumentSelectorModal } from '../ChatPanel/FolderDocumentSelectorModal'
import { FolderMemoryModal } from '../ChatPanel/FolderMemoryModal'
import { RagSearchStatus } from '../ChatPanel/RagSearchStatus'
import { MessageSources } from '../ChatPanel/MessageSources'
import { ScrollToBottomButton } from '../ChatPanel/ScrollToBottomButton'
import type { RagResponse } from '../../lib/rag'
import { buildReaderContext, MAX_HIGHLIGHTS } from './readerContext'
import type { ShowReaderToast } from './ReaderToast'
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

// O professor de língua (ver lib/teacherContext.ts): o interruptor da linha do Send,
// o bloco que vai ao contexto e o que o chip "AI sees" diz dele. Ausente, ou com
// `available` falso, o chat é o de sempre.
export interface ReaderTeacher {
  available: boolean
  on: boolean
  onToggle: () => void
  // O bloco acrescentado ao contexto efêmero quando `on`.
  block: string
  // "French teacher (B1) · 5 saved".
  chipLabel: string
}

interface ReaderChatPanelProps {
  book: Book
  pageNum: number
  totalPages: number
  highlights: BookHighlight[]
  getPageText: (pageNum: number) => Promise<string | null>
  // Rótulos de posição por formato (ver readerContext.ts). Ausentes = PDF
  // ("page N of M" / "p. N") — o leitor de EPUB passa os seus.
  positionLabel?: string
  highlightLabel?: (h: BookHighlight) => string
  // O que o chip "AI sees" diz da posição. Ausente = PDF ("p. N").
  contextChipLabel?: string
  // Visual apenas — o painel permanece montado quando fechado.
  open: boolean
  onClose: () => void
  // Trecho vindo do "Ask AI" da toolbar de seleção do Reader.
  pendingQuote: { text: string; page: number; positionLabel?: string } | null
  onPendingQuoteConsumed: () => void
  // "Save to note" das respostas: direto na nota vinculada ao livro ou pelo
  // SaveToNoteModal.
  notebooks: Notebook[]
  notes: Note[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (
    notebookId: string,
    title: string,
    content: string,
    requestId?: string,
    typeId?: string | null,
  ) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  // Mostra a nota na aba Notes do leitor (que passa a ser a vinculada).
  onOpenNote: (notebookId: string, noteId: string) => void
  showToast: ShowReaderToast
  onOpenSettings: () => void
  teacher?: ReaderTeacher
  // Mensagem a enviar já (o "Ask for feedback" do reconto): o painel a envia assim
  // que o chat está pronto e avisa em `onPendingSendConsumed`.
  pendingSend?: { text: string } | null
  onPendingSendConsumed?: () => void
}

export function ReaderChatPanel({
  book,
  pageNum,
  totalPages,
  highlights,
  getPageText,
  positionLabel,
  highlightLabel,
  contextChipLabel,
  open,
  onClose,
  pendingQuote,
  onPendingQuoteConsumed,
  notebooks,
  notes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
  onOpenNote,
  showToast,
  onOpenSettings,
  teacher,
  pendingSend,
  onPendingSendConsumed,
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
    ragSearching,
    ragTraces,
    chatTimings,
    error,
    send,
    cancel,
    startAssistantConversation,
    selectConversation,
    ensureScopedFolder,
    clearConversations,
    deleteFolderConversations,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    getFolderVisibleDocumentIds,
    setFolderMemory,
    setFolderMemoryEnabled,
  } = useChat(models, { mode: 'reader' })

  const [draft, setDraft] = useState('')
  // A prévia do que o professor acrescenta ao contexto (o chip "AI sees" abre e fecha).
  const [teacherPreviewOpen, setTeacherPreviewOpen] = useState(false)
  const [bookFolderId, setBookFolderId] = useState<string | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  // Bloco da resposta a gravar pelo SaveToNoteModal (livro sem nota vinculada).
  const [saveBlock, setSaveBlock] = useState<string | null>(null)
  const notesRef = useRef(notes)
  notesRef.current = notes
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const { historyRef, atBottom, onScroll, scrollToBottom } = useStickToBottom({ messages, isStreaming, activeId })

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
    const folderId = ensureScopedFolder({ kind: 'book', id: book.id, title: book.title })
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
    ensureScopedFolder,
    selectConversation,
    startAssistantConversation,
  ])

  // Se a pasta do livro for apagada no ChatPanel (outra janela), recria no
  // próximo uso: aqui, assim que a remoção reflete no estado. Idempotente —
  // o ensure devolve a pasta existente quando nada mudou.
  useEffect(() => {
    if (!startedRef.current) return
    if (bookFolderId && folders.some((f) => f.id === bookFolderId)) return
    const folderId = ensureScopedFolder({ kind: 'book', id: book.id, title: book.title })
    setBookFolderId(folderId)
  }, [folders, bookFolderId, book.id, book.title, ensureScopedFolder])

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
    const folderId = ensureScopedFolder({ kind: 'book', id: book.id, title: book.title })
    setBookFolderId(folderId)
    startAssistantConversation(folderId)
  }, [
    activeId,
    book.id,
    book.title,
    ensureScopedFolder,
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

  // "Ask AI": põe o trecho selecionado como citação no início do composer,
  // antes do que já estava digitado. NÃO envia automaticamente — o usuário
  // complementa e envia.
  useEffect(() => {
    if (!pendingQuote) return
    const text =
      pendingQuote.text.length > ASK_AI_QUOTE_BUDGET
        ? pendingQuote.text.slice(0, ASK_AI_QUOTE_BUDGET).trimEnd() + '…'
        : pendingQuote.text
    const quote = `> "${text}"\n> — ${pendingQuote.positionLabel ?? `p. ${pendingQuote.page}`}\n\n`
    setDraft((prev) => quote + prev)
    inputRef.current?.focus()
    onPendingQuoteConsumed()
  }, [pendingQuote, onPendingQuoteConsumed])

  // "Save to note" de uma resposta: com nota vinculada ao livro (a da aba
  // Notes), anexa direto com toast Open/Undo; sem vínculo, ou se a gravação
  // falhar, abre o SaveToNoteModal com o mesmo bloco.
  function handleSaveToNote(content: string) {
    const block = buildAiResponseBlock(content, book.title)
    const linked = resolveLinkedNote(book.id, notesRef.current)
    if (!linked) {
      setSaveBlock(block)
      return
    }
    appendBlockToNote(onSaveNote, linked, block)
      .then((appended) =>
        announceAppendedBlock({
          showToast,
          destination: noteDestinationLabel(linked, notebooks),
          appended,
          getNotes: () => notesRef.current,
          onSaveNote,
          onOpen: () => {
            if (linked.notebookId) onOpenNote(linked.notebookId, linked.id)
          },
        }),
      )
      .catch((err) => {
        console.error('reader: failed to append response to linked note', err)
        setSaveBlock(block)
      })
  }

  const streamingMessageId = useMemo(() => {
    if (!isStreaming) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [isStreaming, messages])

  const ready = !isStreaming && hasApiKey && !!model && models.length > 0 && !!activeId
  const canSend = ready && draft.trim().length > 0
  const teacherOn = !!teacher?.available && teacher.on
  // O que a linha "AI sees" diz: a posição e os grifos (o professor, quando ligado, acrescenta o seu).
  const highlightCount = Math.min(highlights.length, MAX_HIGHLIGHTS)
  const contextChipText =
    `AI sees: ${contextChipLabel ?? `p. ${pageNum}`}` +
    (highlightCount > 0 ? ` · ${highlightCount} highlight${highlightCount === 1 ? '' : 's'}` : '')

  // `override` é a mensagem pronta do "Ask for feedback"; sem ela, vale o que está
  // no campo.
  async function handleSend(override?: string) {
    if (override === undefined ? !canSend : !ready) return
    // Idempotente; recria a pasta (e refresca o ref usado pelo fallback do
    // send) caso ela tenha sido apagada em outra janela durante a sessão.
    ensureScopedFolder({ kind: 'book', id: book.id, title: book.title })
    const text = override ?? draft
    if (override === undefined) setDraft('')
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
      positionLabel,
      highlightLabel,
      teacherBlock: teacherOn ? teacher?.block : undefined,
    })
    void send(text, undefined, undefined, { ephemeralContext })
  }

  // "Ask for feedback": espera o chat ficar pronto (a chave checada, os modelos
  // carregados e a conversa ativa) e envia uma vez. Sem chave, o aviso do chat já
  // está na tela. Sem modelo (a lista não carregou), a mensagem fica no campo.
  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend
  useEffect(() => {
    if (!pendingSend || !apiKeyChecked || modelsLoading) return
    if (!hasApiKey) {
      onPendingSendConsumed?.()
      return
    }
    if (!model || models.length === 0) {
      setDraft((prev) => (prev ? `${prev}\n\n${pendingSend.text}` : pendingSend.text))
      onPendingSendConsumed?.()
      return
    }
    if (!ready) return
    onPendingSendConsumed?.()
    void handleSendRef.current(pendingSend.text)
  }, [pendingSend, apiKeyChecked, modelsLoading, hasApiKey, model, models.length, ready, onPendingSendConsumed])

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
            aria-label="Book documents"
            title="Book documents"
            onClick={() => setDocsOpen(true)}
          >
            <Files size={14} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Book memory"
            title="Book memory"
            onClick={() => setMemoryOpen(true)}
          >
            <Brain size={14} />
          </button>
          <ClearAllChatsButton
            folderName={book.title}
            count={bookFolder ? folderConversationIds(bookFolder, conversations, folders).length : 0}
            onClearAll={() => bookFolder && deleteFolderConversations(bookFolder.id)}
            className={styles.iconBtn}
            iconSize={14}
          />
          <div className={styles.toolsMenu}>
            <ChatToolsMenu
              tools={tools}
              onToggle={setTool}
              folderMemory={bookFolder ? { enabled: bookFolder.memoryEnabled } : null}
              onToggleFolderMemory={(v) =>
                bookFolder && setFolderMemoryEnabled(bookFolder.id, v)
              }
              dailyNotesTool={{ supported: models.find((m) => m.id === model)?.supportsTools ?? false }}
              notesTool={{ supported: models.find((m) => m.id === model)?.supportsTools ?? false }}
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
            onOpenSettings={onOpenSettings}
          />
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close chat panel"
            title="Close"
          >
            <X size={14} aria-hidden />
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
            const folderId = ensureScopedFolder({
              kind: 'book',
              id: book.id,
              title: book.title,
            })
            setBookFolderId(folderId)
            startAssistantConversation(folderId)
          }}
        >
          New chat
        </button>
        <ClearChatButton
          className={styles.newChatBtn}
          disabled={messages.length === 0 || isDraftActive}
          conversationTitle={activeConversation?.title ?? ''}
          messageCount={messages.length}
          streaming={isStreaming}
          onClear={() => {
            if (activeId) clearConversations([activeId])
            inputRef.current?.focus()
          }}
        />
      </div>

      {apiKeyChecked && !hasApiKey && (
        <div className={styles.keyBanner} role="alert">
          <span>Add your OpenRouter key in Settings to chat about this book.</span>
          <button type="button" className={styles.keyBannerBtn} onClick={onOpenSettings}>
            Open Settings
          </button>
        </div>
      )}

      <div className={styles.historyWrap}>
        <div className={styles.history} ref={historyRef} onScroll={onScroll}>
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
                trace={ragTraces[m.id]}
                timings={chatTimings[m.id]}
                onSaveToNote={handleSaveToNote}
              />
            ))
          )}
        </div>

        {!atBottom && <ScrollToBottomButton className={styles.scrollBtn} onClick={scrollToBottom} />}
      </div>

      {error && messages.length > 0 && (
        <div className={styles.errorRow} role="alert">
          {error}
        </div>
      )}

      <div className={styles.composer}>
        {ragSearching && <RagSearchStatus />}
        {teacherOn && teacher ? (
          // Com o professor ligado o chip é um botão: abre e fecha o que ele acrescenta.
          <button
            type="button"
            className={`${styles.contextChip} ${styles.contextChipButton}`}
            onClick={() => setTeacherPreviewOpen((v) => !v)}
            aria-expanded={teacherPreviewOpen}
            title="Sent with each message: the text you are reading, your most recent highlights and the Language teacher block. Click to see the block."
          >
            {contextChipText} · <b>{teacher.chipLabel}</b>
          </button>
        ) : (
          <p
            className={styles.contextChip}
            title={`Sent with each message: the text you are reading and your ${MAX_HIGHLIGHTS} most recent highlights.`}
          >
            {contextChipText}
          </p>
        )}
        {teacherOn && teacher && teacherPreviewOpen && <pre className={styles.teacherPreview}>{teacher.block}</pre>}
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
          {teacher?.available && (
            <button
              type="button"
              className={styles.teacherSwitch}
              role="switch"
              aria-checked={teacher.on}
              onClick={teacher.onToggle}
              title="Adds the book's language, your language, your level and this page's saved words to what the AI sees"
            >
              <i aria-hidden="true" />
              <ChalkboardTeacher size={13} aria-hidden />
              Language teacher
            </button>
          )}
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
        initialSelectedIds={bookFolder ? getFolderVisibleDocumentIds(bookFolder.id) : []}
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
      {/* `plain`: o bloco já vem com o rótulo "AI · <livro>" do
          buildAiResponseBlock, igual ao do caminho direto. */}
      <SaveToNoteModal
        open={saveBlock !== null}
        content={saveBlock ?? ''}
        notebooks={notebooks}
        notes={notes}
        onCreateNotebook={onCreateNotebook}
        onCreateNote={onCreateNote}
        onSaveNote={onSaveNote}
        onNavigateToNote={onOpenNote}
        onClose={() => setSaveBlock(null)}
        plain
      />
    </aside>
  )
}

interface ReaderChatBubbleProps {
  message: ChatMessage
  isStreaming: boolean
  trace?: RagResponse
  timings?: ChatTimings
  onSaveToNote: (content: string) => void
}

function ReaderChatBubble({ message, isStreaming, trace, timings, onSaveToNote }: ReaderChatBubbleProps) {
  const isUser = message.role === 'user'
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  // Mesmas regras do ChatMessageBubble: pontinhos só enquanto o turno roda,
  // resposta vazia parada e erro do turno pela flag `failed`.
  const emptyState = emptyAnswerState(message, isStreaming)
  const isErrorMessage = !isUser && !!message.failed
  const canSaveToNote =
    !isUser &&
    !isStreaming &&
    emptyState === null &&
    !isErrorMessage &&
    message.content.trim().length > 0

  useEffect(() => {
    if (isUser || isErrorMessage) return
    if (!message.content) {
      setHtml('')
      return
    }
    let cancelled = false
    renderMarkdown(message.content, { allowedImageUrls: message.allowedImageUrls }).then((out) => {
      if (!cancelled) setHtml(linkNoteMarks(out))
    })
    return () => {
      cancelled = true
    }
  }, [isUser, isErrorMessage, message.content, message.allowedImageUrls?.join('\n')])
  // Memoizado: o React 19 compara `__html` por identidade e um objeto novo a
  // cada render reescreveria o DOM, desfazendo a seleção do usuário.
  const inner = useMemo(() => ({ __html: html }), [html])
  const bodyRef = useRef<HTMLDivElement>(null)
  useMermaidDiagrams(bodyRef, html, isStreaming)
  const imageViewer = useImageViewer()

  function handleCopy() {
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => console.error('clipboard write failed', err))
  }

  if (isUser) {
    return <div className={styles.bubbleUser}>{message.content}</div>
  }

  if (emptyState === 'streaming') {
    return (
      <span className={styles.streamingDots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    )
  }

  if (emptyState) {
    return (
      <p className={bubbleStyles.noResponse} role={emptyState === 'elsewhere' ? 'status' : undefined}>
        {emptyState === 'elsewhere' ? 'Responding in another window…' : 'No response (interrupted)'}
      </p>
    )
  }

  // Erro do turno: só a mensagem, sem Save to note, Copy e Sources.
  if (isErrorMessage) {
    return (
      <div className={bubbleStyles.errorBox} role="alert">
        <WarningCircle size={14} aria-hidden className={bubbleStyles.errorIcon} />
        <span>{message.content.replace(/^Error:\s*/, '')}</span>
      </div>
    )
  }

  return (
    <>
      <div
        ref={bodyRef}
        className={styles.bubbleAssistant}
        data-streaming={isStreaming || undefined}
        dangerouslySetInnerHTML={inner}
        onClick={(e) => {
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
      {canSaveToNote && (
        <div className={styles.assistantActions}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => onSaveToNote(message.content)}
            title="Save this response to a note"
          >
            <NotePencil size={13} aria-hidden />
            Save to note
          </button>
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
      )}
      <MessageSources message={message} trace={trace} timings={timings} />
      {imageViewer.viewer}
    </>
  )
}
