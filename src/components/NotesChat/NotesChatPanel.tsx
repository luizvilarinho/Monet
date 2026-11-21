import { openUrl } from '@tauri-apps/plugin-opener'
import { Stop, FileText, Brain, GearSix, Plus, X } from '@phosphor-icons/react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  useChat,
  folderConversationIds,
  getLinkedChatConversationId,
  linkResponseToChatConversation,
  type ChatMessage,
  type ChatConversation,
  type ChatTimings,
  type ChatTools,
  type TasksSnapshot,
  NO_RESPONSE_MESSAGE,
} from '../../hooks/useChat'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import { renderMarkdown } from '../../lib/markdown'
import { expandItemMarkers, hasAgentPayload } from '../../lib/agentItems'
import { AGENT_DRAFT_ACTION, agentNoteDraft, type AgentNoteDraft, type AgentNoteRequest } from '../../lib/agentNotes'
import { dateKeyFromMs } from '../../lib/calendar'
import { linkNoteMarks } from '../../lib/noteMarks'
import { notesFolderDocId } from '../../lib/documents'
import { loadEmbedResponses } from '../../lib/noteFileText'
import { ocrTextsForContent } from '../../lib/imageOcr'
import { storage } from '../../storage'
import { hasTavilyKey, TAVILY_KEY_CHANGED_EVENT } from '../../lib/search'
import type { ChecklistProgress } from '../../lib/tasks'
import {
  listOpenRouterModels,
  OPENROUTER_KEY_MISSING,
} from '../../lib/openrouter'
import type { AiModel, Note, Notebook, Task } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import { useTasksEnv } from '../TasksView/TasksEnv'
import { SystemPromptIcon } from '../ChatPanel/SystemPromptIcon'
import { AgentPicker, AgentSuggestions, useAgentShortcut } from '../ChatPanel/AgentPicker'
import { chatAgentComposerHint, findChatAgent, parseAgentShortcut, type ChatAgentDef } from '../../lib/agents/chat'
import { ChatToolsMenu } from '../ChatPanel/ChatToolsMenu'
import { ClearAllChatsButton, ClearChatButton } from '../ChatPanel/ChatClearActions'
import { clickedImage, useImageViewer } from '../ImageViewer/ImageViewer'
import { useMermaidDiagrams } from '../MermaidDiagram/useMermaidDiagrams'
import { FolderSystemPromptModal } from '../ChatPanel/FolderSystemPromptModal'
import { FolderDocumentSelectorModal } from '../ChatPanel/FolderDocumentSelectorModal'
import { FolderMemoryModal } from '../ChatPanel/FolderMemoryModal'
import { RagSearchStatus } from '../ChatPanel/RagSearchStatus'
import { MessageSources } from '../ChatPanel/MessageSources'
import { AGENT_DRAFT_ICON, AgentReplyLabel, agentLabelIds, STOPPED_BEFORE_REPLY } from '../ChatPanel/ChatMessageBubble'
import { AgentItemsList, type AgentItemActions } from '../ChatPanel/AgentItemsList'
import { ScrollToBottomButton } from '../ChatPanel/ScrollToBottomButton'
import { SaveAgentNoteModal } from '../ChatPanel/SaveAgentNoteModal'
import type { RagResponse } from '../../lib/rag'
import { buildNotesContext, NOTE_TEXT_BUDGET, noteTruncatedForAi, type NoteMetaForAi } from './notesContext'
import { codeFence, messageToMarkdown, splitMessageBlocks, type NoteInsert } from './noteBlocks'
import styles from './NotesChatPanel.module.css'

// Chat da aba "Chat" da coluna direita das Anotações, no padrão do
// ReaderChatPanel: reaproveita o motor (`useChat` em modo `notes`) — não
// reimplementa streaming nem persistência. Cada caderno tem a sua PASTA de
// chat (vínculo notebookId → folderId em `monet:notes-notebook-folder-link`),
// criada sob demanda. Diferente do Reader, o painel NÃO é remontado por
// caderno: refaz o bind a cada troca (remontar cancelaria um stream ativo).
// A cada envio, a nota aberta e a seleção do editor vão como contexto
// EFÊMERO (nunca persistido), e a nota atual é excluída do RAG.

const ASK_AI_QUOTE_BUDGET = 600

// O aviso de um turno que precisa da chave do Tavily (deep research, web search
// ou o pipeline do agente, como no `send()` do useChat); null = o turno não a
// pede. O envio confere a chave antes de limpar o rascunho.
function tavilyNeedMessage(agent: ChatAgentDef, tools: ChatTools): string | null {
  if (tools.deepResearch && agent.context.deepResearch) {
    return 'Deep Research needs a Tavily key. Add it in Settings > Web Search, or turn it off.'
  }
  if (tools.webSearch && agent.context.web) {
    return 'Web Search needs a Tavily key. Add it in Settings > Web Search, or turn it off.'
  }
  return agent.webPipeline?.needsTavily ? `${agent.label} needs a Tavily key for web search. Add it in Settings > Web Search.` : null
}

// "Chat" de um card da aba AI: a pergunta e a resposta abrem numa conversa
// da pasta do caderno (IA-03).
export interface NotesChatExchange {
  responseId: string
  title: string
  userMessage: string
  assistantMessage: string
}

interface NotesChatPanelProps {
  // Caderno existente (null = sem caderno: estado vazio)
  notebook: { id: string; name: string } | null
  activeNote: Note | null
  resolveNoteTitle: (noteId: string) => string | undefined
  isNoteArchived: (noteId: string) => boolean
  resolveNoteContent: (noteId: string) => string | undefined
  getSelectionText: () => string
  // Tasks do caderno, anexadas ao contexto efêmero (vazio se o caderno está
  // fora da IA).
  projectTasks?: Task[]
  todayKey: string
  taskChecklist: Map<string, ChecklistProgress>
  // Todas as tasks e cadernos, para a tool "Tasks" (query_tasks).
  tasks: Task[]
  notebooks: Notebook[]
  // Visual apenas — o painel permanece montado quando escondido.
  visible: boolean
  // Trecho vindo do "Ask AI" da toolbar de seleção do editor.
  pendingQuote: string | null
  onPendingQuoteConsumed: () => void
  // Resposta da aba AI a continuar aqui; consumida assim que abre.
  pendingExchange?: NotesChatExchange | null
  onPendingExchangeConsumed?: () => void
  // Botão "Settings" do seletor de modelo e da faixa sem chave.
  onOpenSettings: () => void
  // "Open Settings" do aviso da chave do Tavily: abre o Settings na seção da busca.
  // Ausente: abre o Settings na seção de abertura.
  onOpenSettingsSection?: (section: 'search') => void
  canInsert: boolean
  onInsertIntoNote: (content: NoteInsert, where: 'cursor' | 'end') => void
  // Clique numa NoteMark (`==texto==`) citada na resposta: abre a nota no
  // ponto marcado (o App decide entre abrir direto e o seletor de notas).
  onOpenMark?: (text: string) => void
  // "Save as Plan note" da resposta do planner.
  notes: Note[]
  onCreateAgentNote: (req: AgentNoteRequest, requestId: string) => Promise<Note>
  onNavigateToNote: (notebookId: string, noteId: string) => void
  // "Open in Library" de um artigo: o App abre o livro na Library.
  onOpenBook: (bookId: string) => void
  // "Open reading list" do "Add to reading list": abre o board do tipo Paper.
  // Ausente (ainda não há o board) = sem o botão.
  onOpenReadingList?: () => void
  // Subject, tipo, propriedades e tags da nota aberta, para o contexto da IA.
  describeNote: (note: Note) => NoteMetaForAi
}

export function NotesChatPanel({
  notebook,
  activeNote,
  describeNote,
  resolveNoteTitle,
  isNoteArchived,
  resolveNoteContent,
  getSelectionText,
  projectTasks,
  todayKey,
  taskChecklist,
  tasks,
  notebooks,
  visible,
  pendingQuote,
  onPendingQuoteConsumed,
  pendingExchange = null,
  onPendingExchangeConsumed,
  onOpenSettings,
  onOpenSettingsSection,
  canInsert,
  onInsertIntoNote,
  onOpenMark,
  notes,
  onCreateAgentNote,
  onNavigateToNote,
  onOpenBook,
  onOpenReadingList,
}: NotesChatPanelProps) {
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const { statuses } = useTasksEnv()
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
    webSearchActive,
    ragTraces,
    chatTimings,
    error,
    errorSettings,
    send,
    activeAgentId,
    agentsAvailable,
    setConversationAgent,
    cancel,
    startAssistantConversation,
    selectConversation,
    ensureScopedFolder,
    openConversationWithExchange,
    clearConversations,
    deleteFolderConversations,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    getFolderVisibleDocumentIds,
    setFolderMemory,
    setFolderMemoryEnabled,
    setFolderWebResearchEnabled,
    registerAiSourcesFolder,
  } = useChat(models, { mode: 'notes', getTasksSnapshot: () => tasksSnapshotRef.current })

  const [draft, setDraft] = useState('')
  const shortcut = useAgentShortcut(draft, setDraft, agentsAvailable)
  // Aviso da chave do Tavily ausente, achado ao enviar (o rascunho fica). Some ao
  // salvar a chave, ao trocar de conversa ou de agente e no próximo envio.
  const [tavilyBlock, setTavilyBlock] = useState<string | null>(null)
  // Envio em curso (da conferência da chave até o `send()` voltar): um 2º Enter não
  // dispara outro turno.
  const sendingRef = useRef(false)
  const [notebookFolderId, setNotebookFolderId] = useState<string | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [agentDraft, setAgentDraft] = useState<AgentNoteDraft | null>(null)
  // Caderno do escopo de um artigo ("Add to reading list"); null = o do chat.
  const [agentDefaultNotebookId, setAgentDefaultNotebookId] = useState<string | null>(null)
  // Chip do contexto: nota aberta e/ou seleção fora do envio (R8).
  const [excludedNoteId, setExcludedNoteId] = useState<string | null>(null)
  const [removedSelection, setRemovedSelection] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const { historyRef, atBottom, onScroll, scrollToBottom } = useStickToBottom({ messages, isStreaming, activeId })
  // Respostas com o rótulo do agente (quando ele muda).
  const agentLabels = agentLabelIds(messages)

  // Trocar de nota zera as remoções do chip.
  useEffect(() => {
    setExcludedNoteId(null)
    setRemovedSelection(null)
  }, [activeNote?.id])

  // Seleção não re-renderiza o painel: um listener mantém o chip em dia (o
  // texto, e não só se há seleção, para o "×" remover a seleção atual).
  const [selection, setSelection] = useState('')
  useEffect(() => {
    if (!visible) {
      setSelection('')
      return
    }
    function update() {
      setSelection(getSelectionText().trim())
    }
    document.addEventListener('selectionchange', update)
    // Seleção que já existia antes de abrir o painel.
    update()
    return () => document.removeEventListener('selectionchange', update)
  }, [visible, getSelectionText])

  const notebookFolder = useMemo(
    () => folders.find((f) => f.id === notebookFolderId) ?? null,
    [folders, notebookFolderId]
  )

  // Ações dos itens do Radar: "Add to KB" grava na pasta do caderno.
  const itemActions = useMemo<AgentItemActions>(
    () => ({
      kb: notebookFolder
        ? {
            chatFolderId: notebookFolder.id,
            folderName: notebookFolder.name,
            webResearchEnabled: notebookFolder.webResearchEnabled,
            setWebResearchEnabled: (enabled) => setFolderWebResearchEnabled(notebookFolder.id, enabled),
            registerAiSourcesFolder,
          }
        : null,
      onOpenNote: onNavigateToNote,
      onAddPaper: (draft, defaultNotebookId) => {
        setAgentDefaultNotebookId(defaultNotebookId)
        setAgentDraft(draft)
      },
      onOpenBook,
    }),
    [notebookFolder, setFolderWebResearchEnabled, registerAiSourcesFolder, onNavigateToNote, onOpenBook]
  )

  const visibleDocCount = notebookFolder
    ? getFolderVisibleDocumentIds(notebookFolder.id).length
    : 0
  const hasSystemPrompt = (notebookFolder?.systemPrompt ?? '').trim().length > 0
  const hasMemory = (notebookFolder?.memory ?? '').trim().length > 0

  // Conversas da pasta do caderno, na ordem da pasta (mais recente primeiro).
  const folderConversations = useMemo(() => {
    if (!notebookFolder) return []
    const byId = new Map(conversations.map((c) => [c.id, c]))
    return notebookFolder.conversationIds
      .map((id) => byId.get(id))
      .filter((c): c is ChatConversation => !!c)
  }, [notebookFolder, conversations])

  // Rascunho ativo (conversa nova ainda não materializada): aparece no
  // seletor como "New conversation".
  const isDraftActive =
    !!activeConversation &&
    !folderConversations.some((c) => c.id === activeConversation.id)

  // Carrega os modelos de forma independente (padrão AssistantPanel/Reader).
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

  // Bind por caderno (sem remontar): a cada troca de caderno, garante a pasta
  // dele e retoma a conversa mais recente da pasta — ou inicia um rascunho
  // (materializado na pasta só no 1º envio). Um stream em andamento continua
  // na conversa original. `notebook` vem sempre de um caderno existente: o
  // ensure nunca é chamado para um caderno apagado (recriaria a pasta). Só
  // faz o bind com a aba visível: navegar pelos cadernos sem abrir o chat não
  // cria pastas de chat.
  const boundNotebookIdRef = useRef<string | null>(null)
  // true depois que a instância teve uma conversa ativa — distingue o null
  // inicial (antes do bind) do null de "conversa apagada em outra janela".
  const hadConversationRef = useRef(false)
  useEffect(() => {
    if (!notebook || !visible) return
    if (boundNotebookIdRef.current === notebook.id) return
    boundNotebookIdRef.current = notebook.id
    const folderId = ensureScopedFolder({
      kind: 'notebook',
      id: notebook.id,
      title: notebook.name,
    })
    setNotebookFolderId(folderId)
    const folder = folders.find((f) => f.id === folderId)
    const convs = folder
      ? conversations.filter((c) => folder.conversationIds.includes(c.id))
      : []
    if (convs.length > 0) {
      const latest = convs.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b))
      selectConversation(latest.id)
    } else {
      startAssistantConversation(folderId)
    }
  }, [
    notebook,
    visible,
    conversations,
    folders,
    ensureScopedFolder,
    selectConversation,
    startAssistantConversation,
  ])

  // Se a pasta do caderno for apagada no ChatPanel (outra janela), recria
  // assim que a remoção reflete no estado. Idempotente.
  useEffect(() => {
    if (!notebook || boundNotebookIdRef.current !== notebook.id) return
    if (notebookFolderId && folders.some((f) => f.id === notebookFolderId)) return
    const folderId = ensureScopedFolder({
      kind: 'notebook',
      id: notebook.id,
      title: notebook.name,
    })
    setNotebookFolderId(folderId)
  }, [folders, notebookFolderId, notebook, ensureScopedFolder])

  // Recuperação mid-session: apagar a pasta/conversa ativa derruba o activeId
  // para null (modo detached) — inicia um rascunho novo na pasta do caderno.
  useEffect(() => {
    if (activeId !== null) {
      hadConversationRef.current = true
      return
    }
    if (!hadConversationRef.current) return
    if (!notebook || boundNotebookIdRef.current !== notebook.id) return
    hadConversationRef.current = false
    const folderId = ensureScopedFolder({
      kind: 'notebook',
      id: notebook.id,
      title: notebook.name,
    })
    setNotebookFolderId(folderId)
    startAssistantConversation(folderId)
  }, [activeId, notebook, ensureScopedFolder, startAssistantConversation])

  // "Chat" de um card da aba AI: reabre a conversa já ligada à resposta, se
  // ela está na pasta do caderno; senão cria uma nova com a pergunta e a
  // resposta. Roda depois do bind (efeito acima), que fixa a pasta.
  const handledExchangeRef = useRef<NotesChatExchange | null>(null)
  useEffect(() => {
    if (!pendingExchange || !notebook || !visible) return
    if (boundNotebookIdRef.current !== notebook.id) return
    if (handledExchangeRef.current === pendingExchange) return
    handledExchangeRef.current = pendingExchange
    const folderId = ensureScopedFolder({
      kind: 'notebook',
      id: notebook.id,
      title: notebook.name,
    })
    setNotebookFolderId(folderId)
    const linkedId = getLinkedChatConversationId(pendingExchange.responseId)
    const folder = folders.find((f) => f.id === folderId)
    if (
      linkedId &&
      folder?.conversationIds.includes(linkedId) &&
      conversations.some((c) => c.id === linkedId)
    ) {
      selectConversation(linkedId)
    } else {
      const convId = openConversationWithExchange({
        folderId,
        title: pendingExchange.title,
        userMessage: pendingExchange.userMessage,
        assistantMessage: pendingExchange.assistantMessage,
      })
      linkResponseToChatConversation(pendingExchange.responseId, convId)
    }
    onPendingExchangeConsumed?.()
    inputRef.current?.focus()
  }, [
    pendingExchange,
    notebook,
    visible,
    folders,
    conversations,
    ensureScopedFolder,
    selectConversation,
    openConversationWithExchange,
    onPendingExchangeConsumed,
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
      pendingQuote.length > ASK_AI_QUOTE_BUDGET
        ? pendingQuote.slice(0, ASK_AI_QUOTE_BUDGET).trimEnd() + '…'
        : pendingQuote
    setDraft(`> "${text}"\n\n`)
    inputRef.current?.focus()
    onPendingQuoteConsumed()
  }, [pendingQuote, onPendingQuoteConsumed])

  // "Insert selection": seleção dentro de UMA resposta da IA mostra uma ação
  // flutuante logo abaixo do trecho. Seleções que atravessam mensagens ou
  // saem do conteúdo da resposta (ações, outras bolhas) não mostram nada.
  const [selectionInsert, setSelectionInsert] = useState<{
    content: NoteInsert
    top: number
    left: number
  } | null>(null)
  useEffect(() => {
    if (!visible) {
      setSelectionInsert(null)
      return
    }
    function update() {
      const history = historyRef.current
      const sel = window.getSelection()
      if (!history || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelectionInsert(null)
        return
      }
      const range = sel.getRangeAt(0)
      const messageOf = (n: Node) =>
        (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement)?.closest(
          '[data-chat-message]'
        ) ?? null
      const root = messageOf(range.startContainer)
      if (!root || root !== messageOf(range.endContainer) || !history.contains(root)) {
        setSelectionInsert(null)
        return
      }
      const content = selectionToHtml(range, root)
      if (!content.text) {
        setSelectionInsert(null)
        return
      }
      const rect = range.getBoundingClientRect()
      const hostRect = history.getBoundingClientRect()
      setSelectionInsert({
        content,
        top: rect.bottom - hostRect.top + history.scrollTop + 6,
        // Limita à largura do painel (a barra tem ~260px).
        left: Math.max(0, Math.min(rect.left - hostRect.left, history.clientWidth - 260)),
      })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [visible])

  const streamingMessageId = useMemo(() => {
    if (!isStreaming) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [isStreaming, messages])

  // Placeholder, estado vazio e mensagem padrão do agente ativo (IA-19).
  const agentHint = chatAgentComposerHint(activeAgentId)
  const activeAgent = findChatAgent(agentsAvailable ? activeAgentId : undefined)

  useEffect(() => {
    setTavilyBlock(null)
  }, [activeId, activeAgentId])
  useEffect(() => {
    const clear = () => setTavilyBlock(null)
    window.addEventListener(TAVILY_KEY_CHANGED_EVENT, clear)
    return () => window.removeEventListener(TAVILY_KEY_CHANGED_EVENT, clear)
  }, [])

  // Faixa de erro: o erro do turno que não vira balão e o aviso da chave do
  // Tavily achado no envio. Sem mensagem na conversa, só o da chave aparece (com
  // "Open Settings"): o erro do envio sem balão ainda não tem onde aparecer.
  const searchKeyIssue = tavilyBlock !== null || errorSettings === 'search'
  const errorText = tavilyBlock ?? error
  const showErrorRow = !!errorText && (messages.length > 0 || searchKeyIssue)

  const ready =
    !!notebook &&
    !isStreaming &&
    hasApiKey &&
    !!model &&
    models.length > 0 &&
    !!activeId
  // Coach e Plan week enviam com o rascunho vazio (a mensagem padrão).
  const canSend = ready && (draft.trim().length > 0 || !!agentHint?.defaultMessage)

  const selectedModel = models.find((m) => m.id === model)

  const noteIncluded = !!activeNote && excludedNoteId !== activeNote.id
  const selectionIncluded = !!selection && selection !== removedSelection

  // A IA só vê o começo da nota longa (IA-17). Estimativa sem as respostas
  // embutidas e o OCR, que só se resolvem no envio.
  const deferredNoteContent = useDeferredValue(
    visible && noteIncluded ? (activeNote?.content ?? '') : ''
  )
  const noteTruncated = useMemo(
    () =>
      noteTruncatedForAi(deferredNoteContent, {
        resolveNoteTitle,
        resolveLinkedNoteContent: resolveNoteContent,
      }),
    [deferredNoteContent, resolveNoteTitle, resolveNoteContent]
  )

  async function handleSend() {
    const parsed = agentsAvailable ? parseAgentShortcut(draft) : null
    // Agente que não pede pergunta: sem texto, vai a mensagem padrão dele.
    const fallback = chatAgentComposerHint(parsed ? parsed.agent.id : activeAgentId)?.defaultMessage ?? ''
    // Atalho "/agente" sem texto, sem mensagem padrão ou de agente com pipeline de
    // busca (Radar, Papers): só liga o seletor (também durante o streaming). A
    // consulta custa buscas e consome a janela do escopo; o Enter com o rascunho
    // vazio, com o agente já selecionado, envia a mensagem padrão.
    if (parsed && !parsed.rest && (!fallback || !ready || !!parsed.agent.webPipeline)) {
      setConversationAgent(parsed.agent.id)
      setDraft('')
      return
    }
    const typed = parsed ? parsed.rest : draft
    const text = typed.trim() ? typed : fallback
    if (!ready || !text || !notebook) return
    // Um 2º Enter durante os `await` abaixo (e até o `send()` voltar, já com o turno
    // em andamento) veria o rascunho vazio, cairia na mensagem padrão do agente e
    // dispararia outro turno: o `isStreaming` do `useChat` só vale no render
    // seguinte. A trava vai da entrada até o `send()` retornar.
    if (sendingRef.current) return
    sendingRef.current = true
    try {
      // Turno que pede a chave do Tavily: confere antes de limpar o rascunho, e sem
      // a chave o aviso fica no painel e o texto digitado não se perde.
      const turnAgent = findChatAgent(agentsAvailable ? (parsed ? parsed.agent.id : activeAgentId) : undefined)
      const tavilyMessage = tavilyNeedMessage(turnAgent, tools)
      if (tavilyMessage) {
        const hasKey = await hasTavilyKey().catch(() => true)
        if (!hasKey) {
          setTavilyBlock(tavilyMessage)
          return
        }
      }
      setTavilyBlock(null)
      // Idempotente; recria a pasta (e refresca o ref usado pelo fallback do
      // send) caso ela tenha sido apagada em outra janela durante a sessão.
      ensureScopedFolder({ kind: 'notebook', id: notebook.id, title: notebook.name })
      setDraft('')
      // Contexto montado NO MOMENTO do envio: trocar de nota depois não afeta
      // a resposta em streaming.
      const note = activeNote
      // A nota pode ter sido apagada com o painel aberto (R11d): cai fora do
      // contexto e o chip mostra que ela não vai.
      const exists = note ? !!(await storage.getNote(note.id)) : false
      if (note && !exists) setExcludedNoteId(note.id)
      const attachedNote = note && exists && noteIncluded ? note : null
      const selectionText = attachedNote && selectionIncluded ? getSelectionText() : ''
      const embeds = await loadEmbedResponses(
        attachedNote ? [attachedNote.content] : [],
        resolveNoteContent
      )
      const imageTexts = await ocrTextsForContent(attachedNote?.content ?? '')
      const ephemeralContext = buildNotesContext({
        notebookName: notebook.name,
        note: attachedNote,
        noteMeta: attachedNote ? describeNote(attachedNote) : null,
        selectionText,
        resolveNoteTitle,
        isNoteArchived,
        resolveLinkedNoteContent: resolveNoteContent,
        resolveEmbed: (id) => embeds.get(id),
        resolveImageText: (dataUrl) => imageTexts.get(dataUrl),
        projectTasks,
        todayKey,
        checklist: taskChecklist,
        statuses,
      })
      await send(text, undefined, undefined, {
        ephemeralContext,
        excludeNoteId: note?.id ?? null,
        agentId: parsed?.agent.id,
        noteContext: attachedNote
          ? {
              noteId: attachedNote.id,
              noteTitle: attachedNote.title,
            }
          : undefined,
      })
    } finally {
      sendingRef.current = false
    }
  }

  return (
    <section
      className={visible ? styles.panel : `${styles.panel} ${styles.panelHidden}`}
      aria-label="Notebook chat"
    >
      {!notebook ? (
        <p className={styles.empty}>Open a notebook to chat about its notes.</p>
      ) : (
        <>
          <div className={styles.header}>
            <span className={styles.notebookName} title={notebook.name}>
              {notebook.name}
            </span>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.iconBtn} ${visibleDocCount > 0 ? styles.iconBtnActive : ''}`}
                aria-label={`configure documents for ${notebook.name || 'folder'}`}
                title={
                  visibleDocCount > 0
                    ? `${visibleDocCount} document(s) active (click to edit)`
                    : 'select knowledge base documents for this folder'
                }
                onClick={() => setDocsOpen(true)}
              >
                <FileText size={12} aria-hidden />
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${hasSystemPrompt ? styles.iconBtnActive : ''}`}
                aria-label={`configure system prompt for ${notebook.name || 'folder'}`}
                title={
                  hasSystemPrompt
                    ? 'system prompt active (click to edit)'
                    : 'set folder system prompt'
                }
                onClick={() => setPromptOpen(true)}
              >
                <SystemPromptIcon />
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${hasMemory ? styles.iconBtnActive : ''}`}
                aria-label={`view folder memory for ${notebook.name || 'folder'}`}
                title={
                  hasMemory
                    ? 'folder memory active (click to view/edit)'
                    : 'view/edit folder memory'
                }
                onClick={() => setMemoryOpen(true)}
              >
                <Brain size={12} aria-hidden />
              </button>
              <ClearAllChatsButton
                folderName={notebook.name}
                count={notebookFolder ? folderConversationIds(notebookFolder, conversations, folders).length : 0}
                onClearAll={() => notebookFolder && deleteFolderConversations(notebookFolder.id)}
                className={styles.iconBtn}
              />
              <div className={styles.toolsMenu}>
                <ChatToolsMenu
                  tools={tools}
                  onToggle={setTool}
                  folderMemory={
                    notebookFolder ? { enabled: notebookFolder.memoryEnabled } : null
                  }
                  onToggleFolderMemory={(v) =>
                    notebookFolder && setFolderMemoryEnabled(notebookFolder.id, v)
                  }
                  folderMemoryLabel="Notebook memory"
                  folderWebResearch={
                    notebookFolder ? { enabled: notebookFolder.webResearchEnabled } : null
                  }
                  onToggleFolderWebResearch={(v) =>
                    notebookFolder && setFolderWebResearchEnabled(notebookFolder.id, v)
                  }
                  tasksTool={{ supported: selectedModel?.supportsTools ?? false }}
                  trackersTool={{ supported: selectedModel?.supportsTools ?? false }}
                  dailyNotesTool={{ supported: selectedModel?.supportsTools ?? false }}
                  notesTool={{ supported: selectedModel?.supportsTools ?? false }}
                  agent={activeAgent}
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
                const folderId = ensureScopedFolder({
                  kind: 'notebook',
                  id: notebook.id,
                  title: notebook.name,
                })
                setNotebookFolderId(folderId)
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
              <span>Add your OpenRouter key in Settings to chat about your notes.</span>
              <button type="button" className={styles.keyBannerBtn} onClick={onOpenSettings}>
                <GearSix size={12} aria-hidden />
                Open Settings
              </button>
            </div>
          )}

          <div className={styles.historyWrap}>
            <div className={styles.history} ref={historyRef} onScroll={onScroll}>
              {messages.length === 0 ? (
                <p className={styles.empty}>
                  {agentHint?.empty ??
                    "Ask about this notebook — the AI sees the open note, your selection and the notebook's indexed notes."}
                </p>
              ) : (
                messages.map((m) => (
                  <NotesChatBubble
                    key={m.id}
                    message={m}
                    isStreaming={m.id === streamingMessageId}
                    showAgentLabel={agentLabels.has(m.id)}
                    canInsert={canInsert}
                    onInsert={onInsertIntoNote}
                    onOpenMark={onOpenMark}
                    onSaveAgentNote={setAgentDraft}
                    itemActions={itemActions}
                    trace={ragTraces[m.id]}
                    timings={chatTimings[m.id]}
                  />
                ))
              )}
              {selectionInsert && (
                <div
                  className={styles.selectionInsert}
                  style={{ top: selectionInsert.top, left: selectionInsert.left }}
                  // Não deixa o clique desfazer a seleção antes do onClick.
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span className={styles.selectionInsertLabel}>Insert into note</span>
                  <button
                    type="button"
                    className={styles.messageActionBtn}
                    disabled={!canInsert}
                    onClick={() => onInsertIntoNote(selectionInsert.content, 'cursor')}
                  >
                    At cursor
                  </button>
                  <button
                    type="button"
                    className={styles.messageActionBtn}
                    disabled={!canInsert}
                    onClick={() => onInsertIntoNote(selectionInsert.content, 'end')}
                  >
                    At end
                  </button>
                </div>
              )}
            </div>

            {!atBottom && <ScrollToBottomButton className={styles.scrollBtn} onClick={scrollToBottom} />}
          </div>

          {showErrorRow && (
            <div className={styles.errorRow} role="alert">
              <span>{errorText}</span>
              {searchKeyIssue && (
                <button
                  type="button"
                  className={styles.keyBannerBtn}
                  onClick={() => (onOpenSettingsSection ? onOpenSettingsSection('search') : onOpenSettings())}
                >
                  <GearSix size={12} aria-hidden />
                  Open Settings
                </button>
              )}
            </div>
          )}

          <div className={styles.composer}>
            {webSearchActive && activeAgent.webPipeline && <RagSearchStatus label={activeAgent.webPipeline.status} />}
            {ragSearching && <RagSearchStatus />}
            {activeNote && (
              <div className={styles.contextChips}>
                {noteIncluded ? (
                  <span className={styles.contextChip}>
                    <FileText size={11} aria-hidden />
                    <span className={styles.contextChipText} title={activeNote.title || 'Untitled'}>
                      {activeNote.title.trim() || 'Untitled'}
                    </span>
                    {noteTruncated && (
                      <span
                        className={styles.contextChipNote}
                        title={`This note is long: the AI sees only its first ${NOTE_TEXT_BUDGET.toLocaleString('en-US')} characters. Select a passage to send it too.`}
                      >
                        · first {Math.round(NOTE_TEXT_BUDGET / 1000)}k chars
                      </span>
                    )}
                    <button
                      type="button"
                      className={styles.contextChipBtn}
                      aria-label="remove note from context"
                      title="Remove this note from the context"
                      onClick={() => setExcludedNoteId(activeNote.id)}
                    >
                      <X size={10} aria-hidden />
                    </button>
                  </span>
                ) : (
                  <span className={styles.contextChip} data-off>
                    <span className={styles.contextChipText}>Note not included</span>
                    <button
                      type="button"
                      className={styles.contextAdd}
                      aria-label="add note back to context"
                      title="Add this note back to the context"
                      onClick={() => setExcludedNoteId(null)}
                    >
                      <Plus size={10} aria-hidden />
                    </button>
                  </span>
                )}
                {selectionIncluded && (
                  <span className={styles.contextChip}>
                    <span className={styles.contextChipText} title={selection}>
                      Selection
                    </span>
                    <button
                      type="button"
                      className={styles.contextChipBtn}
                      aria-label="remove selection from context"
                      title="Remove the selection from the context"
                      onClick={() => setRemovedSelection(selection)}
                    >
                      <X size={10} aria-hidden />
                    </button>
                  </span>
                )}
              </div>
            )}
            <AgentSuggestions
              items={shortcut.suggestions}
              highlighted={shortcut.highlighted}
              onPick={shortcut.pick}
            />
            <textarea
              ref={inputRef}
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (shortcut.onKeyDown(e)) return
                if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              placeholder={
                hasApiKey
                  ? (agentHint?.placeholder ?? 'Ask about your notes…')
                  : 'Configure your OpenRouter key first.'
              }
              rows={3}
              disabled={!hasApiKey}
              aria-label="message"
            />
            <div className={styles.actions}>
              {agentsAvailable && (
                <AgentPicker agentId={activeAgentId} onSelect={setConversationAgent} compact />
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
        </>
      )}

      <FolderSystemPromptModal
        open={promptOpen}
        folder={notebookFolder}
        onConfirm={(folderId, text, mode) =>
          setFolderSystemPrompt(folderId, text, mode)
        }
        onClose={() => setPromptOpen(false)}
      />
      <FolderDocumentSelectorModal
        open={docsOpen}
        folder={notebookFolder}
        initialSelectedIds={
          notebookFolder ? getFolderVisibleDocumentIds(notebookFolder.id) : []
        }
        implicitDocumentId={notebook ? notesFolderDocId(notebook.id) : null}
        onConfirm={(folderId, visibleDocumentIds) =>
          setFolderVisibleDocuments(folderId, visibleDocumentIds)
        }
        onClose={() => setDocsOpen(false)}
      />
      <FolderMemoryModal
        open={memoryOpen}
        folder={notebookFolder}
        onConfirm={(folderId, text) => setFolderMemory(folderId, text)}
        onClose={() => setMemoryOpen(false)}
      />
      <SaveAgentNoteModal
        open={agentDraft !== null}
        draft={agentDraft}
        notebooks={notebooks}
        notes={notes}
        defaultNotebookId={agentDefaultNotebookId ?? notebook?.id ?? null}
        onCreate={onCreateAgentNote}
        onNavigateToNote={onNavigateToNote}
        onOpenReadingList={onOpenReadingList}
        onClose={() => {
          setAgentDraft(null)
          setAgentDefaultNotebookId(null)
        }}
      />
    </section>
  )
}

interface NotesChatBubbleProps {
  message: ChatMessage
  isStreaming: boolean
  showAgentLabel: boolean
  canInsert: boolean
  onInsert: (content: NoteInsert, where: 'cursor' | 'end') => void
  onOpenMark?: (text: string) => void
  onSaveAgentNote: (draft: AgentNoteDraft) => void
  itemActions: AgentItemActions
  trace?: RagResponse
  timings?: ChatTimings
}

function NotesChatBubble({
  message,
  isStreaming,
  showAgentLabel,
  canInsert,
  onInsert,
  onOpenMark,
  onSaveAgentNote,
  itemActions,
  trace,
  timings,
}: NotesChatBubbleProps) {
  const isUser = message.role === 'user'
  const isEmpty = !isUser && message.content.length === 0
  // Radar: os marcadores [W3] viram título, link e fonte a partir do payload do
  // app (no fim do turno o content já vem expandido e a expansão não muda nada).
  const displayContent = useMemo(
    () => (message.agentItems ? expandItemMarkers(message.content, message.agentItems) : message.content),
    [message.content, message.agentItems]
  )
  const segments = useMemo(
    () => (isUser ? [] : splitMessageBlocks(displayContent)),
    [isUser, displayContent]
  )
  // Resposta do planner com plano datado ou do tutor com bloco de perfil
  // (só depois do streaming).
  const agentDraft = useMemo(
    () => (isUser || isStreaming ? null : agentNoteDraft(message, dateKeyFromMs(Date.now()))),
    [isUser, isStreaming, message]
  )
  const DraftIcon = agentDraft ? AGENT_DRAFT_ICON[agentDraft.kind] : null
  const imageViewer = useImageViewer()

  if (isUser) {
    return (
      <div className={styles.bubbleUser}>
        {message.content}
        {message.noteTitle && (
          <span className={styles.fromNote}>
            From: {message.noteTitle.trim() || 'Untitled'}
          </span>
        )}
      </div>
    )
  }

  if (isEmpty) {
    // Pontinhos só durante o streaming; vazia fora dele = turno sem resposta.
    return isStreaming ? (
      <span className={styles.streamingDots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    ) : (
      <div className={styles.bubbleAssistant}>
        {message.interrupted === 'stopped' ? STOPPED_BEFORE_REPLY : NO_RESPONSE_MESSAGE}
      </div>
    )
  }

  const insertDisabled = !canInsert || isStreaming

  return (
    <div className={styles.assistantBlock}>
      {showAgentLabel && <AgentReplyLabel agentId={message.agentId} />}
      <div
        className={`${styles.bubbleAssistant} ${onOpenMark ? styles.markClickable : ''}`}
        data-streaming={isStreaming || undefined}
        data-chat-message
        onClick={(e) => {
          const img = clickedImage(e)
          if (img) {
            imageViewer.open(img.src, img.alt)
            return
          }
          const nm = (e.target as HTMLElement).closest('mark[data-nm]')
          if (nm) {
            const text = nm.getAttribute('data-nm')
            if (text) onOpenMark?.(text)
            return
          }
          const target = (e.target as HTMLElement).closest('a')
          if (!target) return
          const href = target.getAttribute('href')
          if (!href || !href.startsWith('http')) return
          e.preventDefault()
          void openUrl(href)
        }}
      >
        {segments.map((seg, i) => {
          if (seg.kind === 'text')
            return <MarkdownHtml key={i} markdown={seg.markdown} allowedImageUrls={message.allowedImageUrls} />
          // Bloco ainda aberto só conta como "em construção" enquanto a
          // mensagem está em streaming (um Stop deixa a fence aberta). No
          // streaming, o último bloco também segue em construção: o "fechamento"
          // pode ser só o início de uma fence aninhada (```js chegando aos poucos).
          const pending = isStreaming && (!seg.closed || i === segments.length - 1)
          if (!pending && !seg.body.trim()) return null
          return seg.kind === 'note' ? (
            <BlockCard
              key={i}
              label="Note"
              markdown={seg.body}
              allowedImageUrls={message.allowedImageUrls}
              copyText={seg.body}
              pending={pending}
              canInsert={canInsert}
              onInsert={(where) => onInsert({ markdown: seg.body }, where)}
            />
          ) : (
            <BlockCard
              key={i}
              label={seg.language || 'Code'}
              markdown={codeFence(seg.body, seg.language)}
              copyText={seg.body}
              pending={pending}
              canInsert={canInsert}
              onInsert={(where) =>
                onInsert({ code: seg.body, language: seg.language }, where)
              }
            />
          )
        })}
      </div>
      {message.agentItems && hasAgentPayload(message) && (
        <AgentItemsList
          payload={message.agentItems}
          actions={itemActions}
          disabled={isStreaming}
          messageId={message.id}
          content={message.content}
        />
      )}
      <div className={styles.messageActions}>
        {agentDraft && (
          <button
            type="button"
            className={styles.messageActionBtn}
            disabled={isStreaming}
            onClick={() => onSaveAgentNote(agentDraft)}
            aria-label={AGENT_DRAFT_ACTION[agentDraft.kind].title}
          >
            {DraftIcon && <DraftIcon size={13} className={styles.messageActionIcon} aria-hidden />}
            {AGENT_DRAFT_ACTION[agentDraft.kind].label}
          </button>
        )}
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={insertDisabled}
          onClick={() => onInsert({ markdown: messageToMarkdown(segments) }, 'cursor')}
          title="Insert at the cursor in the open note"
        >
          Insert into note
        </button>
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={insertDisabled}
          onClick={() => onInsert({ markdown: messageToMarkdown(segments) }, 'end')}
          title="Insert at the end of the open note"
        >
          Insert at end
        </button>
      </div>
      <MessageSources message={message} trace={trace} timings={timings} />
      {imageViewer.viewer}
    </div>
  )
}

// Markdown da IA renderizado pelo pipeline seguro (sanitize + bloqueio de URLs).
// O objeto `__html` é memoizado: o React 19 compara por identidade e, com um
// objeto novo a cada render, reescreve o DOM e desfaz a seleção do usuário.
// `pending`: bloco ainda em streaming (diagrama Mermaid só desenha fechado).
// `allowedImageUrls`: imagens da busca do turno, que carregam sem clique.
function MarkdownHtml({
  markdown,
  className,
  pending = false,
  allowedImageUrls,
}: {
  markdown: string
  className?: string
  pending?: boolean
  allowedImageUrls?: readonly string[]
}) {
  const [html, setHtml] = useState('')
  const inner = useMemo(() => ({ __html: html }), [html])
  const bodyRef = useRef<HTMLDivElement>(null)
  useMermaidDiagrams(bodyRef, html, pending)

  useEffect(() => {
    let cancelled = false
    renderMarkdown(markdown, { allowedImageUrls }).then((out) => {
      if (!cancelled) setHtml(linkNoteMarks(out))
    })
    return () => {
      cancelled = true
    }
  }, [markdown, allowedImageUrls?.join('\n')])

  return <div ref={bodyRef} className={className} dangerouslySetInnerHTML={inner} />
}

interface BlockCardProps {
  label: string
  markdown: string
  allowedImageUrls?: readonly string[]
  copyText: string
  pending: boolean
  canInsert: boolean
  onInsert: (where: 'cursor' | 'end') => void
}

// Cartão de um bloco `note` ou de código. O cabeçalho e as ações levam
// `data-chat-ui` para ficarem fora do "Insert selection".
function BlockCard({ label, markdown, allowedImageUrls, copyText, pending, canInsert, onInsert }: BlockCardProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (copyState === 'idle') return
    const timer = setTimeout(() => setCopyState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [copyState])

  function handleCopy() {
    navigator.clipboard
      .writeText(copyText)
      .then(() => setCopyState('copied'))
      .catch((err) => {
        console.error('failed to copy block', err)
        setCopyState('failed')
      })
  }

  const insertDisabled = !canInsert || pending

  return (
    <div className={styles.blockCard}>
      <div className={styles.blockCardHeader} data-chat-ui>
        <span>{label}</span>
        {pending && <span className={styles.blockCardStatus}>Writing…</span>}
      </div>
      <MarkdownHtml
        className={styles.blockCardBody}
        markdown={markdown}
        pending={pending}
        allowedImageUrls={allowedImageUrls}
      />
      <div className={styles.blockCardActions} data-chat-ui>
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={insertDisabled}
          onClick={() => onInsert('cursor')}
          title="Insert at the cursor in the open note"
        >
          Insert into note
        </button>
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={insertDisabled}
          onClick={() => onInsert('end')}
          title="Insert at the end of the open note"
        >
          Insert at end
        </button>
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={pending}
          onClick={handleCopy}
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

// Tags que, sendo ancestrais da seleção, envolvem o trecho copiado para
// preservar ênfase, links e blocos de código.
const SELECTION_WRAP_TAGS = new Set(['STRONG', 'EM', 'B', 'I', 'A', 'CODE', 'DEL', 'S', 'PRE'])

// Clona a seleção (dentro de `root`) como HTML, reconstruindo os ancestrais
// que dão estrutura ao trecho: inline/código sempre, e a lista quando a
// seleção atravessa itens (ancestral comum é o próprio <ul>/<ol>). Remove a
// UI dos cartões (`data-chat-ui`) e troca a imagem bloqueada (gate do "Load
// image") por um link: a nota guarda a URL sem carregar a imagem sozinha.
function selectionToHtml(range: Range, root: Element): { html: string; text: string } {
  let node: Node = range.cloneContents()
  let anc: Node | null = range.commonAncestorContainer
  if (anc.nodeType !== Node.ELEMENT_NODE) anc = anc.parentNode
  let isCommon = true
  while (anc && anc !== root && root.contains(anc)) {
    const el = anc as Element
    if (SELECTION_WRAP_TAGS.has(el.tagName) || (isCommon && /^(UL|OL)$/.test(el.tagName))) {
      const shell = el.cloneNode(false)
      shell.appendChild(node)
      node = shell
    }
    isCommon = false
    anc = anc.parentNode
  }
  const wrapper = document.createElement('div')
  wrapper.appendChild(node)
  wrapper.querySelectorAll('[data-chat-ui]').forEach((el) => el.remove())
  wrapper.querySelectorAll('[data-img-gate]').forEach((gate) => {
    const src = gate.getAttribute('data-src') ?? ''
    const link = document.createElement('a')
    link.href = src
    link.textContent = gate.getAttribute('data-alt') || src
    gate.replaceWith(link)
  })
  return { html: wrapper.innerHTML, text: (wrapper.textContent ?? '').trim() }
}
