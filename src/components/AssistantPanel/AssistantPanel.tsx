import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { FileText, Brain } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { notesFolderDocId, notesIndexGetDisabledNotebooks } from '../../lib/documents'
import {
  useChat,
  ASSISTANT_FOLDER_NAME,
  type TasksSnapshot,
} from '../../hooks/useChat'
import { useChatPanelState } from '../../hooks/useChatPanelState'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import { CALENDAR_NOTEBOOK_ID, dateKeyFromMs, parseCalendarTitle } from '../../lib/calendar'
import {
  appendToNoteViaMain,
  createNotebookViaMain,
  createNoteViaMain,
} from '../../lib/assistantNoteBridge'
import { checklistProgress, type ChecklistProgress } from '../../lib/tasks'
import {
  listOpenRouterModels,
  OPENROUTER_KEY_MISSING,
} from '../../lib/openrouter'
import { storage } from '../../storage'
import type { AiModel, Note, Notebook } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import { ChatComposer } from '../ChatPanel/ChatComposer'
import { ChatMessageBubble } from '../ChatPanel/ChatMessageBubble'
import { FolderSystemPromptModal } from '../ChatPanel/FolderSystemPromptModal'
import { FolderDocumentSelectorModal } from '../ChatPanel/FolderDocumentSelectorModal'
import { FolderMemoryModal } from '../ChatPanel/FolderMemoryModal'
import { SystemPromptIcon } from '../ChatPanel/SystemPromptIcon'
import { MessageSources } from '../ChatPanel/MessageSources'
import { SaveToNoteModal } from '../ChatPanel/SaveToNoteModal'
import { ScrollToBottomButton } from '../ChatPanel/ScrollToBottomButton'
import styles from './AssistantPanel.module.css'

// Pasta escolhida no seletor do cabeçalho (ausente = pasta `assistant`). É
// preferência só desta janela: o sync entre janelas do useChat ignora a chave.
const ASSISTANT_FOLDER_KEY = 'monet:assistant-folder-id'

// Snapshot da tool "Tasks", lido do storage: esta janela não tem o estado de
// tasks da main. O checklist vem das notas-corpo das tasks e só é lido quando
// a tool é chamada (uma consulta por nota-corpo).
async function loadTasksSnapshot(): Promise<TasksSnapshot> {
  const [tasks, notebooks, statuses, summaries, disabledIds] = await Promise.all([
    storage.getTasks(),
    storage.getNotebooks(),
    storage.getTaskStatuses(),
    storage.getNoteSummaries(),
    notesIndexGetDisabledNotebooks(),
  ])
  // Cadernos com a indexação de IA desligada não contribuem com títulos para a IA.
  const disabled = new Set(disabledIds)
  const titleById = new Map(
    summaries.filter((n) => !n.notebookId || !disabled.has(n.notebookId)).map((n) => [n.id, n.title])
  )
  const archivedById = new Map(summaries.map((n) => [n.id, n.archivedAt ?? null]))
  const checklist = async () => {
    const progressById = new Map<string, ChecklistProgress>()
    await Promise.all(
      tasks.map(async (t) => {
        if (!t.noteId) return
        const note = await storage.getNote(t.noteId)
        const progress = note ? checklistProgress(note.content) : null
        if (progress) progressById.set(t.id, progress)
      })
    )
    return progressById
  }
  return {
    tasks,
    notebooks,
    todayKey: dateKeyFromMs(Date.now()),
    checklist,
    statuses,
    resolveNoteTitle: (id) => titleById.get(id),
    isNoteArchived: (id) => archivedById.get(id) != null,
  }
}

// Listas do "Save to note", lidas do storage ao abrir o modal. As notas vêm
// sem conteúdo: o append é feito pela main (ponte), que tem a versão atual.
async function loadSaveTargets(): Promise<{ notebooks: Notebook[]; notes: Note[] }> {
  const [notebooks, summaries] = await Promise.all([
    storage.getNotebooks(),
    storage.getNoteSummaries(),
  ])
  const notes = summaries
    .filter((n) => n.notebookId !== CALENDAR_NOTEBOOK_ID || parseCalendarTitle(n.title) !== null)
    .map((n): Note => ({ ...n, content: '', tags: [] }))
  return { notebooks, notes }
}

// Versao compacta do chat para a janela `assistant`. Reaproveita o motor de
// chat (`useChat`) — nao reimplementa streaming nem persistencia. As conversas
// sao criadas dentro da pasta escolhida no seletor (padrao: `assistant`),
// compartilhada via localStorage com a janela principal.
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
    deepResearchPhase,
    webSearchActive,
    ragSearching,
    ragTraces,
    chatTimings,
    thinkingEnabled,
    toggleThinking,
    error,
    send,
    cancel,
    startAssistantConversation,
    conversations,
    folders,
    ensureAssistantFolder,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    getFolderVisibleDocumentIds,
    getFolderNotebookId,
    setFolderMemory,
    setFolderMemoryEnabled,
    setFolderWebResearchEnabled,
    folderMemoryUpdatedAt,
    webSourcesSaved,
  } = useChat(models, { mode: 'assistant', getTasksSnapshot: loadTasksSnapshot })

  const { selectedModel, streamingMessageId, memoryToastVisible, webSourcesToast } = useChatPanelState(models, {
    model,
    setModel,
    messages,
    isStreaming,
    folderMemoryUpdatedAt,
    webSourcesSaved,
  })
  const [promptOpen, setPromptOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [saveTarget, setSaveTarget] = useState<{
    content: string
    notebooks: Notebook[]
    notes: Note[]
  } | null>(null)
  const assistantFolder = useMemo(
    () => folders.find((f) => f.name === ASSISTANT_FOLDER_NAME) ?? null,
    [folders]
  )
  const [chosenFolderId, setChosenFolderId] = useState<string | null>(() =>
    localStorage.getItem(ASSISTANT_FOLDER_KEY)
  )
  const chosenFolder = useMemo(
    () => (chosenFolderId ? folders.find((f) => f.id === chosenFolderId) ?? null : null),
    [folders, chosenFolderId]
  )
  // Pasta efetiva: a escolhida, se existir; senão a `assistant`. Fornece RAG,
  // prompt, memória e web research às conversas novas, pelo folderId do
  // rascunho (o send() resolve tudo pelo folderId da conversa).
  const effectiveFolder = chosenFolder ?? assistantFolder
  const folderNotebookId = effectiveFolder ? getFolderNotebookId(effectiveFolder.id) : null
  const folderDocCount = effectiveFolder ? getFolderVisibleDocumentIds(effectiveFolder.id).length : 0
  const folderIdRef = useRef<string | undefined>(effectiveFolder?.id)
  folderIdRef.current = effectiveFolder?.id
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const { historyRef, atBottom, onScroll, scrollToBottom } = useStickToBottom({ messages, isStreaming, activeId })

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

  // Cria uma conversa NOVA e zerada na pasta efetiva a cada exibicao da
  // janela. A janela e escondida/mostrada (nao remontada), entao o disparo nao
  // pode ser so no mount: o Rust emite `assistant-shown` ao MOSTRAR a janela e
  // escutamos esse evento aqui. No primeiro mount (janela ja visivel), o
  // rascunho vem do efeito "sem conversa ativa" abaixo.
  const startedRef = useRef(false)
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      ensureAssistantFolder()
    }
    let unlisten: (() => void) | undefined
    let cancelled = false
    void listen('assistant-shown', () => {
      startAssistantConversation(folderIdRef.current)
      ensureAssistantFolder()
      inputRef.current?.focus()
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [startAssistantConversation, ensureAssistantFolder])

  // Sem conversa ativa (mount, ou a conversa exibida foi apagada na janela
  // principal, com ou sem a pasta dela): abre um rascunho na pasta efetiva.
  // Assim o send() nunca cai no caminho da conversa solta. Não grava nada.
  useEffect(() => {
    if (!activeId) startAssistantConversation(folderIdRef.current)
  }, [activeId, startAssistantConversation])

  // Pasta escolhida apagada (ex.: na janela principal): volta ao padrão. Se a
  // conversa ativa é rascunho ou sumiu junto com a pasta, abre um rascunho
  // novo na `assistant`; uma conversa existente fica onde está. Não grava em
  // pastas nem conversas.
  useEffect(() => {
    if (!chosenFolderId || chosenFolder) return
    setChosenFolderId(null)
    localStorage.removeItem(ASSISTANT_FOLDER_KEY)
    if (!conversations.some((c) => c.id === activeId)) {
      startAssistantConversation(assistantFolder?.id)
    }
  }, [chosenFolderId, chosenFolder, conversations, activeId, assistantFolder, startAssistantConversation])

  // Trocar de pasta vale para as PRÓXIMAS conversas: abre um rascunho novo na
  // pasta escolhida. O rascunho anterior (só em memória) é descartado; uma
  // conversa já iniciada continua na pasta dela.
  function handleChooseFolder(folderId: string) {
    const next = folderId && folderId !== assistantFolder?.id ? folderId : null
    setChosenFolderId(next)
    if (next) localStorage.setItem(ASSISTANT_FOLDER_KEY, next)
    else localStorage.removeItem(ASSISTANT_FOLDER_KEY)
    startAssistantConversation(folderId || undefined)
    inputRef.current?.focus()
  }

  useEffect(() => {
    if (hasApiKey) inputRef.current?.focus()
  }, [hasApiKey])

  async function openSaveToNote(content: string) {
    try {
      const { notebooks, notes } = await loadSaveTargets()
      setSaveTarget({ content, notebooks, notes })
    } catch (err) {
      console.error('failed to load notebooks for save to note', err)
    }
  }

  return (
    <div className={styles.window}>
      <div className={styles.titlebar} data-tauri-drag-region>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Assistant</span>
          <select
            className={styles.folderSelect}
            value={effectiveFolder?.id ?? ''}
            onChange={(e) => handleChooseFolder(e.target.value)}
            disabled={isStreaming}
            aria-label="Chat folder"
            title="Folder for new conversations"
          >
            {!assistantFolder && <option value="">{ASSISTANT_FOLDER_NAME}</option>}
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name || 'unnamed'}
              </option>
            ))}
          </select>
          <div className={styles.folderTools}>
            <button
              type="button"
              className={`${styles.iconBtn} ${folderDocCount > 0 ? styles.iconBtnActive : ''}`}
              aria-label={`configure documents for ${effectiveFolder?.name || 'folder'}`}
              title={
                folderDocCount > 0
                  ? `${folderDocCount} document(s) active (click to edit)`
                  : 'select knowledge base documents for this folder'
              }
              onClick={() => {
                ensureAssistantFolder()
                setDocsOpen(true)
              }}
            >
              <FileText size={12} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${
                effectiveFolder && effectiveFolder.systemPrompt.trim().length > 0 ? styles.iconBtnActive : ''
              }`}
              aria-label={`configure system prompt for ${effectiveFolder?.name || 'folder'}`}
              title={
                effectiveFolder && effectiveFolder.systemPrompt.trim().length > 0
                  ? 'system prompt active (click to edit)'
                  : 'set folder system prompt'
              }
              onClick={() => {
                ensureAssistantFolder()
                setPromptOpen(true)
              }}
            >
              <SystemPromptIcon />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${
                effectiveFolder && effectiveFolder.memory.trim().length > 0 ? styles.iconBtnActive : ''
              }`}
              aria-label={`view folder memory for ${effectiveFolder?.name || 'folder'}`}
              title={
                effectiveFolder && effectiveFolder.memory.trim().length > 0
                  ? 'folder memory active (click to view/edit)'
                  : 'view/edit folder memory'
              }
              onClick={() => {
                ensureAssistantFolder()
                setMemoryOpen(true)
              }}
            >
              <Brain size={12} aria-hidden />
            </button>
          </div>
        </div>
        <div className={styles.titleActions}>
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

      <div className={styles.historyWrap}>
        <div className={styles.history} ref={historyRef} onScroll={onScroll}>
          {messages.length === 0 ? (
            <p className={styles.empty}>Ask anything — press Enter to send.</p>
          ) : (
            messages.map((m) => (
              <ChatMessageBubble
                key={m.id}
                message={m}
                isStreaming={m.id === streamingMessageId}
                onSaveToNote={(content) => void openSaveToNote(content)}
                footer={<MessageSources message={m} trace={ragTraces[m.id]} timings={chatTimings[m.id]} />}
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

      <ChatComposer
        hasApiKey={hasApiKey}
        isStreaming={isStreaming}
        selectedModel={selectedModel}
        tools={tools}
        setTool={setTool}
        thinkingEnabled={thinkingEnabled}
        toggleThinking={toggleThinking}
        activeFolder={effectiveFolder}
        setFolderMemoryEnabled={setFolderMemoryEnabled}
        setFolderWebResearchEnabled={setFolderWebResearchEnabled}
        deepResearchPhase={deepResearchPhase}
        webSearchActive={webSearchActive}
        ragSearching={ragSearching}
        memoryToastVisible={memoryToastVisible}
        webSourcesToast={webSourcesToast}
        resetKey={activeId}
        rows={2}
        onSend={(text, image, docs) => void send(text, image, docs)}
        onStop={cancel}
        inputRef={inputRef}
        onCaptureScreen={() => invoke<string>('capture_screen_without_assistant')}
      />

      <SaveToNoteModal
        open={saveTarget !== null}
        content={saveTarget?.content ?? ''}
        notebooks={saveTarget?.notebooks ?? []}
        notes={saveTarget?.notes ?? []}
        onCreateNotebook={async (name, requestId) => {
          const nb = await createNotebookViaMain(name, requestId)
          setSaveTarget((prev) => (prev ? { ...prev, notebooks: [nb, ...prev.notebooks] } : prev))
          return nb
        }}
        onCreateNote={createNoteViaMain}
        onSaveNote={async () => {
          throw new Error('Saving a whole note is not supported in the Assistant.')
        }}
        onAppendToNote={(note, block, requestId) => appendToNoteViaMain(note.id, block, requestId)}
        onNavigateToNote={(_notebookId, noteId) => {
          void invoke('open_note_in_main', { noteId }).catch((err) =>
            console.warn('open note in main failed', err)
          )
        }}
        onClose={() => setSaveTarget(null)}
      />
      <FolderSystemPromptModal
        open={promptOpen}
        folder={effectiveFolder}
        onConfirm={(folderId, text, mode) =>
          setFolderSystemPrompt(folderId, text, mode)
        }
        onClose={() => setPromptOpen(false)}
      />
      <FolderDocumentSelectorModal
        open={docsOpen}
        folder={effectiveFolder}
        initialSelectedIds={effectiveFolder ? getFolderVisibleDocumentIds(effectiveFolder.id) : []}
        implicitDocumentId={folderNotebookId ? notesFolderDocId(folderNotebookId) : null}
        onConfirm={(folderId, visibleDocumentIds) =>
          setFolderVisibleDocuments(folderId, visibleDocumentIds)
        }
        onClose={() => setDocsOpen(false)}
      />
      <FolderMemoryModal
        open={memoryOpen}
        folder={effectiveFolder}
        onConfirm={(folderId, text) => setFolderMemory(folderId, text)}
        onClose={() => setMemoryOpen(false)}
      />
    </div>
  )
}
