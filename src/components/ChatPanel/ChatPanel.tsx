import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowCounterClockwise, CaretRight, Files, GearSix } from '@phosphor-icons/react'
import {
  getMincerItemIdForChatFolder,
  useChat,
  type ChatFolder,
  type ChatMessage,
  type RetryTurn,
  type TasksSnapshot,
} from '../../hooks/useChat'
import { useConfirm } from '../../hooks/useConfirm'
import { useChatPanelState } from '../../hooks/useChatPanelState'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import { chatAgentComposerHint, findChatAgent } from '../../lib/agents/chat'
import { notesFolderDocId } from '../../lib/documents'
import type { AgentNoteDraft, AgentNoteRequest } from '../../lib/agentNotes'
import { mincerGet } from '../../lib/mincer'
import type { ChecklistProgress } from '../../lib/tasks'
import type { AiModel, Note, Notebook, Task } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import { buildMincerContext, mincerTruncationNotice } from '../Mincer/mincerContext'
import { useTasksEnv } from '../TasksView/TasksEnv'
import styles from './ChatPanel.module.css'
import { ChatComposer } from './ChatComposer'
import { agentLabelIds, ChatMessageBubble } from './ChatMessageBubble'
import { MessageSources } from './MessageSources'
import { ClearChatButton } from './ChatClearActions'
import { ChatSidebar } from './ChatSidebar'
import { FolderDocumentSelectorModal } from './FolderDocumentSelectorModal'
import { FolderMemoryModal } from './FolderMemoryModal'
import { FolderSystemPromptModal } from './FolderSystemPromptModal'
import { SaveAgentNoteModal } from './SaveAgentNoteModal'
import { SaveToNoteModal } from './SaveToNoteModal'
import { ScrollToBottomButton } from './ScrollToBottomButton'

// As imagens só ficam em memória: depois de reabrir o app, a pergunta guarda só
// quantas eram.
const IMAGES_GONE = 'The images from the original message are no longer available.'
const imagesGone = (m: ChatMessage) => (m.imageCount ?? 0) > (m.imageDataUrls?.length ?? 0)

export interface ChatPanelProps {
  models: AiModel[]
  modelsLoading: boolean
  modelsError: string | null
  // Sem seção: a tela inicial do Settings. 'search' é a chave do Tavily.
  onOpenSettings: (section?: 'openrouter' | 'search') => void
  notebooks: Notebook[]
  notes: Note[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (notebookId: string, title: string, content: string) => Promise<Note>
  // "Save as Plan note" da resposta do planner; o "Try again" repete o requestId.
  onCreateAgentNote: (req: AgentNoteRequest, requestId: string) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  onNavigateToNote: (notebookId: string, noteId: string) => void
  // Tool "Tasks" (opt-in no menu de ferramentas).
  tasks: Task[]
  todayKey: string
  taskChecklist: Map<string, ChecklistProgress>
  // Cadernos com a indexação de IA desligada: títulos deles não entram nas
  // tools (query_tasks).
  disabledNotebookIds: Set<string>
  // Clique numa NoteMark (`==texto==`) citada na resposta: abre a nota no
  // ponto marcado (o App decide entre abrir direto e o seletor de notas).
  onOpenMark?: (text: string) => void
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
  onCreateAgentNote,
  onSaveNote,
  onNavigateToNote,
  tasks,
  todayKey,
  taskChecklist,
  disabledNotebookIds,
  onOpenMark,
}: ChatPanelProps) {
  const { statuses } = useTasksEnv()
  const resolveNoteTitle = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId)
    if (!note) return undefined
    if (note.notebookId && disabledNotebookIds.has(note.notebookId)) return undefined
    return note.title
  }
  const isNoteArchived = (noteId: string) => !!notes.find((n) => n.id === noteId)?.archivedAt
  const tasksSnapshotRef = useRef<TasksSnapshot>({
    tasks,
    notebooks,
    todayKey,
    checklist: taskChecklist,
    statuses,
    resolveNoteTitle,
    isNoteArchived,
  })
  tasksSnapshotRef.current = {
    tasks,
    notebooks,
    todayKey,
    checklist: taskChecklist,
    statuses,
    resolveNoteTitle,
    isNoteArchived,
  }
  const {
    conversations,
    folders,
    looseConversationIds,
    activeId,
    activeConversation,
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
    ragSearching,
    ragTraces,
    chatTimings,
    thinkingEnabled,
    toggleThinking,
    error,
    errorSettings,
    send,
    activeAgentId,
    agentsAvailable,
    setConversationAgent,
    cancel,
    selectConversation,
    newConversation,
    newConversationInFolder,
    deleteConversationWithUndo,
    undoDelete,
    pendingDelete,
    prepareRetry,
    markMessageSavedToNote,
    clearConversations,
    deleteFolderConversations,
    renameConversation,
    createFolder,
    renameFolder,
    deleteFolder,
    setFolderExpanded,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    getFolderVisibleDocumentIds,
    getFolderNotebookId,
    setFolderMemory,
    setFolderMemoryEnabled,
    setFolderWebResearchEnabled,
    folderMemoryUpdatedAt,
    webSourcesSaved,
    moveConversation,
    removeConversationFromFolder,
    reorderFolders,
    reorderInFolder,
    reorderLoose,
  } = useChat(models, { getTasksSnapshot: () => tasksSnapshotRef.current })

  const [saveTarget, setSaveTarget] = useState<{ messageId: string; content: string } | null>(null)
  const [agentNoteDraft, setAgentNoteDraft] = useState<AgentNoteDraft | null>(null)
  const [systemPromptFolderId, setSystemPromptFolderId] = useState<string | null>(
    null,
  )
  const [memoryFolderId, setMemoryFolderId] = useState<string | null>(null)
  const { selectedModel, streamingMessageId, memoryToastVisible, webSourcesToast } = useChatPanelState(models, {
    model,
    setModel,
    messages,
    isStreaming,
    folderMemoryUpdatedAt,
    webSourcesSaved,
  })
  const [folderDocsFolder, setFolderDocsFolder] = useState<ChatFolder | null>(null)
  const { confirm, modal: confirmModal } = useConfirm()
  const folderDocsNotebookId = folderDocsFolder ? getFolderNotebookId(folderDocsFolder.id) : null
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const { historyRef, atBottom, onScroll, scrollToBottom } = useStickToBottom({ messages, isStreaming, activeId })
  // Respostas com o rótulo do agente (quando ele muda).
  const agentLabels = agentLabelIds(messages)
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

  const activeFolderId = activeFolder?.id ?? null

  // Contexto da conversa (cabeçalho e estado vazio): pasta e documentos que a
  // resposta usa. As notas do caderno vinculado entram sempre (doc implícito).
  const activeFolderNotebookId = activeFolderId ? getFolderNotebookId(activeFolderId) : null
  const activeFolderDocCount = activeFolderId
    ? getFolderVisibleDocumentIds(activeFolderId).filter(
        (id) => !activeFolderNotebookId || id !== notesFolderDocId(activeFolderNotebookId)
      ).length
    : 0
  const docsLabel = `${activeFolderDocCount} document${activeFolderDocCount === 1 ? '' : 's'}`
  const folderDocsSummary = activeFolderNotebookId
    ? activeFolderDocCount > 0
      ? `Notebook notes + ${docsLabel}`
      : 'Notebook notes'
    : activeFolderDocCount > 0
      ? docsLabel
      : 'No documents'
  const agentHint = agentsAvailable ? chatAgentComposerHint(activeAgentId) : null
  const mincerItemId = useMemo(
    () => (activeFolderId ? getMincerItemIdForChatFolder(activeFolderId) : null),
    [activeFolderId]
  )

  // Transcrição maior que o orçamento do contexto: o usuário também é avisado.
  const [mincerNotice, setMincerNotice] = useState<string | null>(null)
  useEffect(() => {
    setMincerNotice(null)
    if (!mincerItemId) return
    let cancelled = false
    mincerGet(mincerItemId)
      .then((item) => {
        if (!cancelled) setMincerNotice(item ? mincerTruncationNotice(item) : null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mincerItemId])

  // Pasta de um item do Mincer: o conteúdo do item vai como contexto efêmero
  // (sem agentes ali: `agentId` só vem fora do Mincer).
  async function handleSend(
    text: string,
    images?: string[],
    docs?: Array<{ name: string; type: string; data: string }>,
    agentId?: string,
    retry?: RetryTurn
  ) {
    if (!mincerItemId) {
      await send(text, images, docs, agentId || retry ? { agentId, retry } : undefined)
      return
    }
    const item = await mincerGet(mincerItemId).catch(() => null)
    const summary = item?.summary?.trim()
    const summaryInHistory =
      !!summary && messages.some((m) => m.role === 'assistant' && m.content.trim() === summary)
    await send(
      text,
      images,
      docs,
      item || retry
        ? { ephemeralContext: item ? buildMincerContext(item, summaryInHistory) : undefined, retry }
        : undefined
    )
  }

  // Retry: reenvia o que foi mandado no último turno (texto, imagens e
  // documentos), no lugar dele. O agente é o da conversa. Sem as imagens
  // (app reaberto), pergunta antes.
  async function handleRetry(assistantId: string) {
    const turn = await prepareRetry(assistantId)
    if (!turn) return
    const question = messages.find((m) => m.id === turn.retry.questionId)
    if (question && imagesGone(question)) {
      const ok = await confirm(`${IMAGES_GONE} Retry without them?`, {
        title: 'Retry without images',
        confirmLabel: 'Retry',
        destructive: false,
      })
      if (!ok) return
    }
    await handleSend(
      turn.text,
      turn.images.length > 0 ? turn.images : undefined,
      turn.documents.length > 0 ? turn.documents : undefined,
      undefined,
      turn.retry
    )
  }

  const lastMessage = messages[messages.length - 1]
  const retryableId = !isStreaming && lastMessage?.role === 'assistant' ? lastMessage.id : null
  // A pergunta só tinha imagens, que não estão mais disponíveis: nada a reenviar.
  const retryQuestion = retryableId ? messages[messages.length - 2] : undefined
  const retryDisabledReason =
    retryQuestion?.role === 'user' &&
    imagesGone(retryQuestion) &&
    !retryQuestion.content.trim() &&
    !retryQuestion.attachedDocs?.length
      ? IMAGES_GONE
      : undefined

  // A faixa da chave ausente já cobre o erro de chave.
  const showErrorRow = !!error && !(apiKeyChecked && !hasApiKey && errorSettings === 'openrouter')

  function renderEmptyState() {
    let title: string
    let hint: string
    let addDocs = false
    const folderName = activeFolder?.name.trim() || 'this folder'
    if (mincerItemId) {
      title = `Ask about ${folderName}`
      hint = "Answers use this item's summary and content."
    } else if (agentHint) {
      title = findChatAgent(activeAgentId).label
      hint = agentHint.empty
    } else if (activeFolder && activeFolderNotebookId) {
      title = `Ask about ${folderName}`
      hint =
        activeFolderDocCount > 0
          ? `Answers use the notebook's notes and its ${docsLabel}.`
          : "Answers use the notebook's notes."
    } else if (activeFolder && activeFolderDocCount > 0) {
      title = `Ask about ${folderName}`
      hint = `Answers use its ${docsLabel}.`
    } else if (activeFolder) {
      title = folderName
      hint = "This folder has no documents, so answers don't use your material yet."
      addDocs = true
    } else {
      title = 'Chat'
      hint =
        "Answers here don't use your notes or documents. Open a notebook's chat, or add documents to a folder."
    }
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{title}</p>
        <p className={styles.emptyHint}>{hint}</p>
        {addDocs && activeFolder && (
          <button
            type="button"
            className={styles.emptyAction}
            onClick={() => setFolderDocsFolder(activeFolder)}
          >
            <Files size={14} aria-hidden />
            Add documents
          </button>
        )}
      </div>
    )
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
        onDelete={deleteConversationWithUndo}
        onRenameConversation={renameConversation}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onClearFolder={deleteFolderConversations}
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
        getFolderVisibleDocumentCount={(id) => getFolderVisibleDocumentIds(id).length}
        width={sidebarCollapsed ? 48 : sidebarWidth}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onWidthChange={setSidebarWidth}
      />

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.context}>
            <span className={styles.title}>Chat</span>
            {activeFolder && (
              <>
                <CaretRight size={11} className={styles.contextSep} aria-hidden />
                <span className={styles.contextFolder} title={activeFolder.name}>
                  {activeFolder.name.trim() || 'Unnamed folder'}
                </span>
                <button
                  type="button"
                  className={styles.contextDocs}
                  onClick={() => setFolderDocsFolder(activeFolder)}
                  title="Choose the documents this folder's answers use"
                >
                  <Files size={13} aria-hidden />
                  {folderDocsSummary}
                </button>
              </>
            )}
          </div>
          <div className={styles.headerActions}>
            <ClearChatButton
              className={styles.clearBtn}
              disabled={messages.length === 0}
              conversationTitle={activeConversation?.title ?? ''}
              messageCount={messages.length}
              streaming={isStreaming}
              onClear={() => {
                if (activeId) clearConversations([activeId])
                inputRef.current?.focus()
              }}
            />
            <ModelSelector
              hasApiKey={hasApiKey}
              apiKeyChecked={apiKeyChecked}
              loading={modelsLoading}
              error={modelsError}
              models={models}
              selectedId={model}
              onSelect={setModel}
              onOpenSettings={() => onOpenSettings('openrouter')}
            />
          </div>
        </header>

        {apiKeyChecked && !hasApiKey && (
          <div className={styles.keyBanner} role="alert">
            <span>
              Add your OpenRouter key in Settings to chat with the AI.
            </span>
            <button
              type="button"
              onClick={() => onOpenSettings('openrouter')}
              className={styles.keyBannerCta}
            >
              <GearSix size={12} aria-hidden />
              Open Settings
            </button>
          </div>
        )}

        <div
          className={styles.history}
          ref={historyRef}
          onScroll={onScroll}
        >
          {messages.length === 0
            ? renderEmptyState()
            : messages.map((m) => {
                // Marca "Saved to <nota>" com o título atual; some se a nota sumiu.
                const savedTo = m.savedToNote
                const savedNoteRow = savedTo ? notes.find((n) => n.id === savedTo.noteId) : undefined
                return (
                  <ChatMessageBubble
                    key={m.id}
                    message={m}
                    isStreaming={m.id === streamingMessageId}
                    showAgentLabel={agentLabels.has(m.id)}
                    onSaveToNote={(content) =>
                      setSaveTarget({ messageId: m.id, content })
                    }
                    onSaveAgentNote={setAgentNoteDraft}
                    onOpenMark={onOpenMark}
                    onRetry={m.id === retryableId ? () => void handleRetry(m.id) : undefined}
                    retryDisabledReason={m.id === retryableId ? retryDisabledReason : undefined}
                    onOpenSettings={() => onOpenSettings('openrouter')}
                    savedNote={
                      savedNoteRow
                        ? {
                            title: savedNoteRow.title.trim() || 'Untitled',
                            onOpen: () =>
                              onNavigateToNote(savedNoteRow.notebookId ?? savedTo?.notebookId ?? '', savedNoteRow.id),
                          }
                        : undefined
                    }
                    footer={<MessageSources message={m} trace={ragTraces[m.id]} timings={chatTimings[m.id]} />}
                  />
                )
              })}
        </div>

        {!atBottom && <ScrollToBottomButton className={styles.scrollBtn} onClick={scrollToBottom} />}

        {mincerNotice && (
          <div className={styles.noticeRow} role="note">
            {mincerNotice}
          </div>
        )}

        {showErrorRow && (
          <div className={styles.errorRow} role="alert">
            <span>{error}</span>
            {errorSettings && (
              <button
                type="button"
                className={styles.keyBannerCta}
                onClick={() => onOpenSettings(errorSettings)}
              >
                <GearSix size={12} aria-hidden />
                Open Settings
              </button>
            )}
          </div>
        )}

        {pendingDelete && (
          <div className={styles.undoRow} role="status">
            <span className={styles.undoText}>
              Deleted “{pendingDelete.title.trim() || 'New conversation'}”
            </span>
            <button type="button" className={styles.undoBtn} onClick={undoDelete}>
              <ArrowCounterClockwise size={12} aria-hidden />
              Undo
            </button>
          </div>
        )}

        <ChatComposer
          hasApiKey={hasApiKey}
          isStreaming={isStreaming}
          selectedModel={selectedModel}
          tools={tools}
          setTool={setTool}
          thinkingEnabled={thinkingEnabled}
          toggleThinking={toggleThinking}
          activeFolder={activeFolder}
          setFolderMemoryEnabled={setFolderMemoryEnabled}
          setFolderWebResearchEnabled={setFolderWebResearchEnabled}
          deepResearchPhase={deepResearchPhase}
          webSearchActive={webSearchActive}
          ragSearching={ragSearching}
          memoryToastVisible={memoryToastVisible}
          webSourcesToast={webSourcesToast}
          resetKey={activeId}
          rows={3}
          agentId={activeAgentId}
          agentsAvailable={agentsAvailable}
          onSelectAgent={setConversationAgent}
          onSend={(text, images, docs, agentId) => void handleSend(text, images, docs, agentId)}
          onStop={cancel}
          inputRef={inputRef}
          onOpenSettings={(section) => onOpenSettings(section)}
        />
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
        onSaved={(target) => {
          if (saveTarget) markMessageSavedToNote(saveTarget.messageId, target)
        }}
      />

      <SaveAgentNoteModal
        open={agentNoteDraft !== null}
        draft={agentNoteDraft}
        notebooks={notebooks}
        notes={notes}
        defaultNotebookId={activeFolder ? getFolderNotebookId(activeFolder.id) : null}
        onCreate={onCreateAgentNote}
        onNavigateToNote={onNavigateToNote}
        onClose={() => setAgentNoteDraft(null)}
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
        initialSelectedIds={folderDocsFolder ? getFolderVisibleDocumentIds(folderDocsFolder.id) : []}
        implicitDocumentId={folderDocsNotebookId ? notesFolderDocId(folderDocsNotebookId) : null}
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
      {confirmModal}
    </section>
  )
}
