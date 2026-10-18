import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat, type ChatFolder, type TasksSnapshot } from '../../hooks/useChat'
import { useChatPanelState } from '../../hooks/useChatPanelState'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import { notesFolderDocId } from '../../lib/documents'
import type { ChecklistProgress } from '../../lib/tasks'
import type { AiModel, Note, Notebook, Task } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import { useTasksEnv } from '../TasksView/TasksEnv'
import styles from './ChatPanel.module.css'
import { ChatComposer } from './ChatComposer'
import { ChatMessageBubble } from './ChatMessageBubble'
import { MessageSources } from './MessageSources'
import { ChatSidebar } from './ChatSidebar'
import { FolderDocumentSelectorModal } from './FolderDocumentSelectorModal'
import { FolderMemoryModal } from './FolderMemoryModal'
import { FolderSystemPromptModal } from './FolderSystemPromptModal'
import { SaveToNoteModal } from './SaveToNoteModal'
import { ScrollToBottomButton } from './ScrollToBottomButton'


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
  // Tool "Tasks" (opt-in no menu de ferramentas).
  tasks: Task[]
  todayKey: string
  taskChecklist: Map<string, ChecklistProgress>
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
  tasks,
  todayKey,
  taskChecklist,
}: ChatPanelProps) {
  const { statuses } = useTasksEnv()
  const tasksSnapshotRef = useRef<TasksSnapshot>({ tasks, notebooks, todayKey, checklist: taskChecklist, statuses })
  tasksSnapshotRef.current = { tasks, notebooks, todayKey, checklist: taskChecklist, statuses }
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
    ragSearching,
    ragTraces,
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
  const folderDocsNotebookId = folderDocsFolder ? getFolderNotebookId(folderDocsFolder.id) : null
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const { historyRef, atBottom, onScroll, scrollToBottom } = useStickToBottom({ messages, isStreaming, activeId })
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
        getFolderVisibleDocumentCount={(id) => getFolderVisibleDocumentIds(id).length}
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
          onScroll={onScroll}
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
              <ChatMessageBubble
                key={m.id}
                message={m}
                isStreaming={m.id === streamingMessageId}
                onSaveToNote={(content) =>
                  setSaveTarget({ messageId: m.id, content })
                }
                footer={<MessageSources message={m} trace={ragTraces[m.id]} />}
              />
            ))
          )}
        </div>

        {!atBottom && <ScrollToBottomButton className={styles.scrollBtn} onClick={scrollToBottom} />}

        {error && messages.length > 0 && (
          <div className={styles.errorRow} role="alert">
            {error}
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
          onSend={(text, image, docs) => void send(text, image, docs)}
          onStop={cancel}
          inputRef={inputRef}
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
    </section>
  )
}
