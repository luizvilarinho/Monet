import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { check } from '@tauri-apps/plugin-updater'
import type { Update } from '@tauri-apps/plugin-updater'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createNodeFromContent, type Editor as TiptapEditor } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import './App.css'
import { AiPanel } from './components/AiPanel/AiPanel'
import { CalendarView } from './components/CalendarView/CalendarView'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { appendToggleToContent } from './components/ChatPanel/SaveToNoteModal'
import { Library } from './components/Library/Library'
import { DocumentsModal } from './components/DocumentsModal/DocumentsModal'
import { KnowledgeBaseModal } from './components/KnowledgeBaseModal/KnowledgeBaseModal'
import { Editor } from './components/Editor/Editor'
import { EmptyEditor } from './components/Editor/EmptyEditor'
import { ArchivedBadge } from './components/Editor/ArchivedBadge'
import { NotebookList } from './components/NotebookList/NotebookList'
import { NotesChatPanel } from './components/NotesChat/NotesChatPanel'
import { NotebookTasksSection } from './components/Sidebar/NotebookTasksSection'
import { codeFence, type NoteInsert } from './components/NotesChat/noteBlocks'
import { insertAsListContinuation } from './components/Editor/listContinuation'
import { Onboarding } from './components/Onboarding/Onboarding'
import { RelatedContent } from './components/RelatedContent/RelatedContent'
import { SettingsModal } from './components/Settings/SettingsModal'
import { UpdaterDialog } from './components/UpdaterDialog/UpdaterDialog'
import { SearchPalette } from './components/SearchPalette/SearchPalette'
import { MarkNotePicker } from './components/SearchPalette/MarkNotePicker'
import { MarksView } from './components/MarksView/MarksView'
import { TagView } from './components/TagView/TagView'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TasksView } from './components/TasksView/TasksView'
import type { NewTaskDraft } from './components/TasksView/TasksHeader'
import { TasksEnvProvider, type TasksEnv } from './components/TasksView/TasksEnv'
import { StatusManagerModal } from './components/TasksView/StatusManagerModal'
import { MetadataManagerModal } from './components/TasksView/MetadataManagerModal'
import { NoteTypesModal } from './components/NoteTypes/NoteTypesModal'
import { NoteTypePicker } from './components/NoteTypes/NoteTypePicker'
import { NotePropertiesBar } from './components/NoteTypes/NotePropertiesBar'
import { TodosPanel } from './components/NoteTypes/TodosPanel'
import { TodosMigrationModal } from './components/NoteTypes/TodosMigrationModal'
import { ProjectsBoard } from './components/TasksView/ProjectsBoard'
import { TodosBoard } from './components/TasksView/TodosBoard'
import { TodayBoard } from './components/TasksView/TodayBoard'
import {
  EPHEMERAL_VIEW,
  resolveMainView,
  type TasksMainView,
} from './components/TasksView/views'
import { WeekBoard } from './components/TasksView/WeekBoard'
import { KanbanBoard } from './components/TasksView/KanbanBoard'
import { DueTodayBlock } from './components/TasksView/DueTodayBlock'
import { WeeklyReview } from './components/TasksView/WeeklyReview'
import { TaskPropertiesBar } from './components/TasksView/TaskPropertiesBar'
import { TaskEditorModal } from './components/TasksView/TaskEditorModal'
import { TaskModalEditor } from './components/TasksView/TaskModalEditor'
import type { TaskChanges } from './components/TasksView/useTaskKeyboard'
import { Toolbar, type ActiveMode } from './components/Toolbar/Toolbar'
import { useAi } from './hooks/useAi'
import {
  activateChatConversation,
  chatConversationExists,
  createPreloadedChatConversation,
  deleteNotebookChatFolder,
  getLinkedChatConversationId,
  linkResponseToChatConversation,
  moveNotebookChatFolder,
  unlinkResponseFromChat,
} from './hooks/useChat'
import { useNotebooks } from './hooks/useNotebooks'
import { useNotes } from './hooks/useNotes'
import { useNotesIndexSync } from './hooks/useNotesIndexSync'
import { useReminders } from './hooks/useReminders'
import { useSubjects } from './hooks/useSubjects'
import { useTasks } from './hooks/useTasks'
import { useTaskStatuses } from './hooks/useTaskStatuses'
import { useMetadataDefs } from './hooks/useMetadataDefs'
import { useNoteTypes } from './hooks/useNoteTypes'
import { useConfirm } from './hooks/useConfirm'
import {
  canHaveType,
  isTodosNote,
  migrateProperties,
  TODOS_DEFAULT_TEMPLATE,
  TODOS_TYPE_ID,
  typeDefs,
} from './lib/noteTypes'
import {
  buildTodosContent,
  missingPillLines,
  planTodosMigration,
  type MigrationRow,
} from './lib/todosMigration'
import { SIDEBAR_WIDTH_KEY, SIDEBAR_WIDE_WIDTH_KEY, WIDE_MAX_WIDTH } from './hooks/useSidebarResize'
import { useTaskViews } from './hooks/useTaskViews'
import { useToday } from './hooks/useToday'
import { findCommand } from './lib/commands'
import { onAssistantNoteRequest } from './lib/assistantNoteBridge'
import {
  getUpdatePreference,
  getSkippedVersion,
  isCheckDue,
  recordCheck,
  isMandatory,
  setSkippedVersion,
} from './lib/updater'
import { getToggleTitle, isPotentialCommandLine } from './components/Editor/commandParser'
import { cleanNoteContentForAi, loadEmbedResponses } from './lib/noteFileText'
import {
  collectNoteMarks,
  stripMarkCitations,
  summarizeMarks,
  type MarkLabelFilter,
  type NoteMarkEntry,
  type NoteMarkHit,
} from './lib/noteMarks'
import { normalizeSearch } from './lib/noteSearch'
import { summarizeTags } from './lib/noteTags'
import { ocrTextsForContent } from './lib/imageOcr'
import { RemindersProvider } from './components/Editor/RemindersContext'
import { TasksProvider } from './components/Editor/TasksContext'
import {
  checklistProgress,
  compareTasks,
  extractTaskRefTitles,
  INBOX_NOTEBOOK_ID,
  isDone,
  isOpen,
  isTaskBodyNote,
  isTasksSubject,
  normalizeName,
  rewriteTaskRefItemTitle,
  splitPipeTitle,
  summaryMatches,
  stripPipePrefix,
  TASK_SUMMARY_KEYS,
  TASKS_SUBJECT_NAME,
  taskProgressByNotebook,
  taskRefIds,
  tasksSubjectId,
  todosProgressByNote,
  type ProjectChoice,
  type TaskGroupBy,
  type TaskPatch,
  type TaskSummaryKey,
  type TodosInfo,
} from './lib/tasks'
import {
  CALENDAR_NOTEBOOK_ID,
  formatCalendarTitle,
  parseCalendarTitle,
  toDateKey,
} from './lib/calendar'
import { storage } from './storage'
import {
  deleteChatWebFolder,
  documentsSearchByIds,
  embedText,
  getNotebookVisibleDocumentIds,
  getNotebooksWithVisibleDocs,
  notesFolderDocId,
  replaceNotebookVisibility,
  resolveSearchableIds,
  type ChunkResult,
} from './lib/documents'
import {
  applyOrder,
  loadNoteOrder,
  loadNoteSort,
  loadOrder,
  mergeOrder,
  saveNoteOrder,
  saveNoteSort,
  saveOrder,
  sortNotes,
  type NoteSort,
} from './lib/noteOrder'
import {
  hasOpenRouterKey,
  listOpenRouterModels,
  OPENROUTER_KEY_MISSING,
} from './lib/openrouter'
import {
  formatSearchResults,
  hasTavilyKey,
  webSearch,
} from './lib/search'
import type {
  AiModel,
  AiResponse,
  AiSource,
  CommandExecutionRequest,
  MetadataValue,
  Note,
  Notebook,
  Task,
  TaskViewConfig,
} from './types'

function getSystemLanguage(): string {
  const stored = localStorage.getItem('monet:user-language')
  if (stored) return stored
  const detected = navigator.language || 'en'
  localStorage.setItem('monet:user-language', detected)
  return detected
}

const USER_LANGUAGE = getSystemLanguage()

function buildSystemPrompt(language: string): string {
  return `You are the Monet study assistant.

Always respond in the user's language: ${language}. Use concise Markdown with no greetings, farewells, or filler phrases.

General goal:
- Complement the current note without literally repeating what is already written.
- Treat the note as the main context.
- Prioritize useful information not explicitly present in the note: concrete examples, practical implications, connections between concepts, exceptions, risks, counterpoints, and relevant context.

General rules:
- Do not rewrite, summarize, or paraphrase sections of the note, unless the command itself asks for synthesis.
- Do not rephrase existing content in other words.
- If you need to reference something already in the note, do so briefly and only to connect new information.
- Do not invent facts, names, numbers, dates, or references.
- If the command depends on web search, use only the provided results.
- If search results are insufficient, respond exactly: "I could not find enough information in the available results."
- If there is no relevant complement beyond what is already explicit in the note, respond exactly: "No relevant complement beyond what is already in the note."

Command behavior:
- /summarize: synthesize only the essentials of the note in short bullets. Here you may rephrase note content, but without embellishment.
- /define: give a short definition and, if useful, add 1 example, contrast, or implication not explicit in the note.
- /table: respond with a comparative, symmetric Markdown table.
- /opinion: organize into pros, cons, and a direct conclusion.
- /search and /profile: respond factually, based only on the provided results.
- /expand: deliver only new and useful information not explicitly present in the note. Do not summarize, rephrase, or repeat the note's text in other words. Add only context, connections, implications, examples, exceptions, risks, counterpoints, or missing details.
- /docs: respond using exclusively the "Relevant document excerpts from the notebook". Ignore the note and your general knowledge. Cite the document name in parentheses at the end of each claim. If the excerpts do not contain enough information to answer, respond exactly: "I could not find this information in the notebook documents."
- /week: respond using exclusively the "Calendar notes from the last 7 days" block as context. Answer the user's free-form question about their week (activities, plans, patterns) based only on those notes. If they do not contain enough information, say so plainly.`
}

const SYSTEM_PROMPT = buildSystemPrompt(USER_LANGUAGE)

const COLLAPSED_PANEL_WIDTH = 48

function stripCommandLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => !/^\/[a-zA-Z]/.test(line.trim()))
    // Marcador de parágrafo em branco (ver extensions.ts) vira linha em
    // branco de verdade no contexto enviado à IA.
    .map((line) => (line.trim() === '<br>' ? '' : line))
    .join('\n')
    .trim()
}

function expandEmbedBlocks(content: string, responses: AiResponse[]): string {
  if (!content.includes('<embed-block')) return content
  const byId = new Map(responses.map((r) => [r.id, r]))
  return content.replace(/<embed-block\b[^>]*><\/embed-block>/g, (match) => {
    const cmdMatch = match.match(/data-cmd="([^"]+)"/)
    if (!cmdMatch) return ''
    const response = byId.get(cmdMatch[1])
    if (!response) return ''
    const body = response.response.trim()
    if (!body) return ''
    const title = getToggleTitle(response.command)
    const quoted = body
      .split('\n')
      .map((l) => (l.length > 0 ? `> ${l}` : '>'))
      .join('\n')
    return `> **${title}**\n>\n${quoted}`
  })
}

function formatRagContext(chunks: ChunkResult[]): string {
  if (chunks.length === 0) return ''
  const blocks = chunks.map((c) => {
    const header = `[${c.documentName}, excerpt ${c.chunkIndex + 1}]`
    return `${header}\n${c.snippet}`
  })
  return `Relevant document excerpts from the notebook:\n\n${blocks.join('\n\n')}\n\n---`
}

function getWeekCalendarNotes(
  notes: Note[],
  anchor: Date
): { dateLabel: string; note: Note }[] {
  const byTitle = new Map(
    notes
      .filter((n) => n.notebookId === CALENDAR_NOTEBOOK_ID)
      .map((n) => [n.title, n] as const)
  )
  const entries: { dateLabel: string; note: Note }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date(anchor)
    day.setDate(day.getDate() - i)
    const title = formatCalendarTitle(day)
    const note = byTitle.get(title)
    if (!note) continue
    entries.push({ dateLabel: title, note })
  }
  return entries
}

function formatWeekContext(entries: { dateLabel: string; content: string }[]): string {
  if (entries.length === 0) return ''
  const blocks = entries.map((e) => `[${e.dateLabel}]\n${e.content}`)
  return `Calendar notes from the last 7 days:\n\n${blocks.join('\n\n')}\n\n---`
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDatedNotes(notes: Note[], anchor: Date): Note[] {
  const isoDate = toIsoDate(anchor)
  return notes.filter((note) => note.notebookId !== CALENDAR_NOTEBOOK_ID && note.date === isoDate)
}

function formatDatedNotesContext(entries: { title: string; content: string }[]): string {
  if (entries.length === 0) return ''
  const blocks = entries.map((e) => `[${e.title}]\n${e.content}`)
  return `Notes tagged with this date:\n\n${blocks.join('\n\n')}\n\n---`
}

function buildUserMessage(
  command: string,
  description: string,
  query: string,
  noteContent: string,
  searchContext?: string,
  ragContext?: string,
  weekContext?: string,
  datedNotesContext?: string
): string {
  const parts: string[] = []
  parts.push(`Command: ${command} - ${description}`)
  if (query.trim()) parts.push(`Parameter: ${query.trim()}`)
  if (ragContext) parts.push(`\n${ragContext}`)
  if (searchContext) parts.push(`\n${searchContext}`)
  if (weekContext) parts.push(`\n${weekContext}`)
  if (datedNotesContext) parts.push(`\n${datedNotesContext}`)
  const cleanContent = noteContent.trim()
  if (cleanContent) {
    parts.push(`\nCurrent note content:\n${cleanContent}`)
  }
  return parts.join('\n')
}

// Caderno de mesmo nome (sem diferenciar maiúsculas); o Calendar nunca conta.
function findNotebookByName(notebooks: Notebook[], name: string): Notebook | undefined {
  const key = name.trim().toLowerCase()
  return notebooks.find(
    (nb) => nb.id !== CALENDAR_NOTEBOOK_ID && nb.name.trim().toLowerCase() === key
  )
}

function App() {
  const {
    notebooks,
    loaded: notebooksLoaded,
    loadFailed: notebooksLoadFailed,
    save: saveNotebook,
    create: createNotebook,
    remove: removeNotebook,
    setColor: setNotebookColor,
    saveError: notebookSaveError,
  } = useNotebooks()
  const {
    notes,
    loaded: notesLoaded,
    loadFailed: notesLoadFailed,
    save: saveNote,
    create: createNote,
    remove: removeNote,
    refresh: refreshNotes,
    setType: setNoteType,
    setProperties: setNoteProperties,
    setArchived: setNoteArchived,
    saveError: noteSaveError,
  } = useNotes()

  const [activeMode, setActiveMode] = useState<ActiveMode>(() => {
    const saved = localStorage.getItem('monet:active-mode')
    return saved === 'chat' || saved === 'library' ? saved : 'notebook'
  })
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)
  const {
    subjects,
    save: saveSubject,
    remove: removeSubject,
    create: createSubject,
    reorder: reorderSubjects,
    refresh: refreshSubjects,
    saveError: subjectSaveError,
  } = useSubjects(activeNotebookId)
  const [activeId, setActiveId] = useState<string | null>(null)
  // When in All Notes (activeNotebookId === null), load subjects for the active note's notebook
  const allNotesNoteNotebookId = activeNotebookId === null
    ? (notes.find((n) => n.id === activeId)?.notebookId ?? null)
    : null
  const { subjects: allNotesSubjects } = useSubjects(allNotesNoteNotebookId)
  const effectiveSubjects = activeNotebookId === null ? allNotesSubjects : subjects
  const [search, setSearch] = useState('')
  const [aiOpen, setAiOpen] = useState(true)
  // Aba da coluna direita (AI = cards dos slash commands; Chat = chat do caderno).
  const [rightTab, setRightTabState] = useState<'ai' | 'chat'>(() => {
    try {
      return localStorage.getItem('monet:notes-right-tab') === 'chat' ? 'chat' : 'ai'
    } catch {
      return 'ai'
    }
  })
  const setRightTab = useCallback((tab: 'ai' | 'chat') => {
    setRightTabState(tab)
    try {
      localStorage.setItem('monet:notes-right-tab', tab)
    } catch {
      /* ignorar */
    }
  }, [])
  // Trecho do "Ask AI" da toolbar de seleção, consumido pelo NotesChatPanel.
  const [pendingNotesQuote, setPendingNotesQuote] = useState<string | null>(null)
  // Pedido sobre uma marca da nota (lista Marks, Ctrl+P, `==` do chat):
  // `reveal` abre a nota na marca (cursor, menu e flash); `resolve` desfaz a
  // marca pelo Editor, que confere a marca pelo índice e pelo texto.
  const [pendingNoteReveal, setPendingNoteReveal] = useState<{
    noteId: string
    index: number
    text: string
    nonce: number
    action: 'reveal' | 'resolve'
  } | null>(null)
  // Clique num `==texto==` do chat com várias notas correspondentes: seletor
  // de candidatas (R11). Zero correspondências também passa por aqui — o
  // seletor vira o feedback "essa marca não existe mais".
  const [markPicker, setMarkPicker] = useState<{ text: string; hits: NoteMarkHit[] } | null>(null)
  // Sequência dos pedidos (contador incremental: Date.now() colidiria no
  // mesmo milissegundo e o segundo pedido seria engolido).
  const revealSeqRef = useRef(0)
  // Lista transversal na coluna das notas (como a TasksView): as marcas, com
  // o filtro de rótulo, ou as notas de uma tag. Uma por vez.
  const [sideView, setSideView] = useState<{ kind: 'marks' } | { kind: 'tag'; tag: string } | null>(null)
  const marksViewOpen = sideView?.kind === 'marks'
  const tagViewTag = sideView?.kind === 'tag' ? sideView.tag : null
  const [marksFilter, setMarksFilter] = useState<MarkLabelFilter>(null)
  const [selectedMark, setSelectedMark] = useState<{ noteId: string; index: number } | null>(null)
  // Instância do Tiptap da nota aberta (inserir resposta do chat na nota).
  const notesEditorRef = useRef<TiptapEditor | null>(null)
  const [hasEditor, setHasEditor] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [documentsModalNotebookId, setDocumentsModalNotebookId] = useState<string | null>(null)
  const [notebooksWithDocs, setNotebooksWithDocs] = useState<Set<string>>(new Set())
  const [kbOpen, setKbOpen] = useState(false)
  const [hasApiKey, setHasApiKey] = useState<boolean>(false)
  const [apiKeyChecked, setApiKeyChecked] = useState<boolean>(false)
  const [onboardingActive, setOnboardingActive] = useState<boolean>(
    () => localStorage.getItem('onboarding_completed') !== '1'
  )
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsLoading, setModelsLoading] = useState<boolean>(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [notebookWidth, setNotebookWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('monet:notebook-width') ?? '', 10)
    return isNaN(saved) ? 180 : saved
  })
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? '', 10)
    return isNaN(saved) ? 220 : saved
  })
  // Largura própria da coluna Tasks/Anotações com os cadernos ocultos.
  const [wideSidebarWidth, setWideSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(SIDEBAR_WIDE_WIDTH_KEY) ?? '', 10)
    return isNaN(saved) ? sidebarWidth : saved
  })
  const [notebookCollapsed, setNotebookCollapsed] = useState(
    () => localStorage.getItem('monet:notebook-collapsed') === '1'
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('monet:sidebar-collapsed') === '1'
  )
  const [focusMode, setFocusMode] = useState(false)
  // Entrada virtual "Tasks" do NotebookList: a TasksView ocupa o slot da
  // Sidebar; a task selecionada é a que tem a nota-corpo aberta no editor.
  const [tasksViewOpen, setTasksViewOpen] = useState(false)
  // Caderno-projeto filtrado na TasksView (null = todos).
  const [tasksFilter, setTasksFilter] = useState<string | null>(null)
  // Filtro da faixa de resumo da TasksView (null = lista agrupada por data).
  const [tasksSummaryFilter, setTasksSummaryFilter] = useState<TaskSummaryKey | null>(null)
  // Visão da área principal das Tasks: lista (TasksView + nota-corpo) ou
  // Week/Kanban board/Weekly review ocupando tudo à direita do NotebookList.
  // O review nunca é lembrado.
  const [tasksMainView, setTasksMainViewState] = useState<TasksMainView>(() => {
    try {
      const view = resolveMainView(localStorage.getItem('monet:tasks-main-view'))
      return view === EPHEMERAL_VIEW ? 'list' : view
    } catch {
      return 'list'
    }
  })
  const setTasksMainView = useCallback((view: TasksMainView) => {
    const next = resolveMainView(view)
    setTasksMainViewState(next)
    if (next === EPHEMERAL_VIEW) return
    try {
      localStorage.setItem('monet:tasks-main-view', next)
    } catch {
      /* ignorar */
    }
  }, [])
  // Busca de texto (título/TODOS) aplicada a todas as visões de Tasks.
  const [tasksSearch, setTasksSearch] = useState('')
  const [statusManagerOpen, setStatusManagerOpen] = useState(false)
  // "Manage properties" aberto (focusId = definição focada ao abrir, pelo lápis da task).
  const [metadataManager, setMetadataManager] = useState<{ focusId: string | null } | null>(null)
  // "Note types" aberto (focusTypeId = tipo selecionado ao abrir; reorder =
  // aberto por "Reorder types…" da lista de notas).
  const [noteTypesOpen, setNoteTypesOpen] = useState<{ focusTypeId: string | null; reorder?: boolean } | null>(null)
  const { confirm, choose, modal: confirmModal } = useConfirm()
  // Group by da lista de tasks.
  const [tasksGroupBy, setTasksGroupByState] = useState<TaskGroupBy>(() => {
    try {
      const saved = localStorage.getItem('monet:tasks-group-by')
      // 'group' (antes dos TODOS) é lido como 'todos', sem regravar.
      if (saved === 'group' || saved === 'todos') return 'todos'
      return saved === 'project' || saved === 'status' ? saved : 'date'
    } catch {
      return 'date'
    }
  })
  const setTasksGroupBy = useCallback((mode: TaskGroupBy) => {
    setTasksGroupByState(mode)
    try {
      localStorage.setItem('monet:tasks-group-by', mode)
    } catch {
      /* ignorar */
    }
  }, [])
  const [previewMode, setPreviewMode] = useState(false)
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [noteOrder, setNoteOrder] = useState<string[]>(() => loadNoteOrder())
  const [notebookOrder, setNotebookOrder] = useState<string[]>(() => loadOrder('monet:notebook-order'))
  const calendarNotebookId = CALENDAR_NOTEBOOK_ID

  const [updateDialog, setUpdateDialog] = useState<{
    update: Update
    mandatory: boolean
    autoStart: boolean
  } | null>(null)

  const { responses, start, addErrorCard, removeResponse } = useAi(activeId)

  const today = useToday()
  const {
    tasks,
    tasksById,
    loaded: tasksLoaded,
    loadFailed: tasksLoadFailed,
    createTasks,
    updateTask,
    updateTasks,
    deleteTasks,
    reassignStatus,
    stripMetadata,
    reload: reloadTasks,
    saveError: tasksSaveError,
  } = useTasks()
  // Registro de status e visões salvas (SQLite, compartilhados entre janelas).
  const {
    statuses: statusRegistry,
    create: createStatus,
    rename: renameStatus,
    update: updateStatus,
    remove: removeStatus,
    reorder: reorderStatuses,
    saveError: statusSaveError,
  } = useTaskStatuses({ onRemoved: (id) => reassignStatus(id, 'todo') })
  // Definições de metadados personalizados (globais, compartilhadas entre janelas).
  const metadata = useMetadataDefs({ onRemoved: (id) => stripMetadata(id) })
  // Tipos de nota e propriedades (scope 'note'). Excluir tipo/propriedade
  // limpa as notas no banco; a memória relê (só com o modal aberto, sem
  // digitação em voo no editor).
  const noteTypes = useNoteTypes({
    onRemoved: () => void refreshNotes().catch((err) => console.error('failed to reload notes', err)),
  })
  const {
    views: savedViews,
    create: createSavedView,
    rename: renameSavedView,
    remove: removeSavedView,
  } = useTaskViews()
  const { disabledNotebookIds, setNotebookIndexEnabled } = useNotesIndexSync({
    notes,
    notesLoaded,
    notebooks,
    notebooksLoaded,
    tasks,
    tasksLoaded,
    tasksLoadFailed,
    statuses: statusRegistry,
    noteTypes: noteTypes.types,
    noteDefs: noteTypes.defs,
    loadFailed: notesLoadFailed || notebooksLoadFailed,
    hasApiKey,
    activeNoteId: activeId,
  })

  // ─── Tasks: projeto = caderno; corpo = nota no subject "Tasks" dele ──────
  const notesRef = useRef(notes)
  notesRef.current = notes
  const notebooksRef = useRef(notebooks)
  notebooksRef.current = notebooks

  // ─── TODOS: nota entregável que agrupa tasks (`parentNoteId`) ────────────
  // Mapa estável enquanto id/título/caderno das TODOS não mudam (digitar numa
  // nota não recria). Pai fora do mapa (apagado por outra janela) = sem TODOS.
  const todosKey = useMemo(
    () => JSON.stringify(notes.filter(isTodosNote).map((n) => [n.id, n.title, n.notebookId, !!n.archivedAt])),
    [notes]
  )
  const todosById = useMemo(() => {
    const entries = JSON.parse(todosKey) as Array<[string, string, string | null, boolean]>
    return new Map<string, TodosInfo>(
      entries.map(([id, title, notebookId, archived]) => [id, { id, title, notebookId, archived }])
    )
  }, [todosKey])
  const todosOptions = useMemo(() => [...todosById.values()], [todosById])
  const todosTemplate = noteTypes.types.find((t) => t.id === TODOS_TYPE_ID)?.template ?? TODOS_DEFAULT_TEMPLATE

  // Nota TODOS nova no caderno, com o template do tipo; devolve o id.
  const createTodosNote = useCallback(
    async (notebookId: string, title: string): Promise<string> => {
      const now = Date.now()
      const note: Note = {
        id: nanoid(),
        notebookId,
        subjectId: null,
        title: title.trim(),
        content: todosTemplate,
        tags: [],
        createdAt: now,
        updatedAt: now,
      }
      if (!(await saveNote(note))) throw new Error('Failed to save note.')
      if (!(await setNoteType(note.id, TODOS_TYPE_ID))) throw new Error('Failed to set note type.')
      setNoteOrder((prev) => {
        const next = [note.id, ...prev]
        saveNoteOrder(next)
        return next
      })
      return note.id
    },
    [saveNote, setNoteType, todosTemplate]
  )

  // Tasks das TODOS em `noteIds` ficam sem TODOS (a task não é apagada).
  const detachTodosChildren = useCallback(
    (noteIds: Set<string>) => {
      const changes = tasks
        .filter((t) => t.parentNoteId !== null && noteIds.has(t.parentNoteId))
        .map((t) => ({ id: t.id, patch: { parentNoteId: null } }))
      return changes.length > 0 ? updateTasks(changes) : Promise.resolve(true)
    },
    [tasks, updateTasks]
  )

  // Tasks vinculadas por TODOS (inclui descartadas: aviso de exclusão/troca de tipo).
  const todosTaskCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tasks) if (t.parentNoteId) map.set(t.parentNoteId, (map.get(t.parentNoteId) ?? 0) + 1)
    return map
  }, [tasks])

  // Inbox: caderno singleton de id fixo (como o Calendar) que recebe as tasks
  // sem projeto. Criado no boot e, por garantia, antes de receber uma task.
  const ensureInbox = useCallback(async (): Promise<string> => {
    if (!notebooksRef.current.some((nb) => nb.id === INBOX_NOTEBOOK_ID)) {
      const now = Date.now()
      await saveNotebook({ id: INBOX_NOTEBOOK_ID, name: 'Inbox', createdAt: now, updatedAt: now })
    }
    return INBOX_NOTEBOOK_ID
  }, [saveNotebook])

  // Caderno escolhido no seletor de projeto. Nome novo reaproveita um caderno
  // de mesmo nome; vazio cai no Inbox. O Calendar nunca é projeto.
  const resolveProject = useCallback(
    async (choice: ProjectChoice): Promise<string> => {
      if ('notebookId' in choice) {
        const id = choice.notebookId
        return id === CALENDAR_NOTEBOOK_ID || id === INBOX_NOTEBOOK_ID ? ensureInbox() : id
      }
      const name = choice.newName.trim()
      if (!name) return ensureInbox()
      const existing = findNotebookByName(notebooksRef.current, name)
      if (existing) return existing.id
      const nb = await createNotebook(name)
      setNotebookOrder((prev) => {
        const next = [nb.id, ...prev.filter((x) => x !== nb.id)]
        saveOrder('monet:notebook-order', next)
        return next
      })
      return nb.id
    },
    [createNotebook, ensureInbox]
  )

  // Subject "Tasks" do caderno, criado na primeira task (id derivado do
  // caderno: UPSERT idempotente).
  const ensureTasksSubject = useCallback(
    async (notebookId: string): Promise<string> => {
      const id = tasksSubjectId(notebookId)
      const existing = await storage.getSubjects(notebookId)
      if (existing.some((s) => s.id === id)) return id
      const now = Date.now()
      await storage.saveSubject({
        id,
        notebookId,
        name: TASKS_SUBJECT_NAME,
        sortOrder: existing.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1,
        createdAt: now,
        updatedAt: now,
      })
      void refreshSubjects()
      return id
    },
    [refreshSubjects]
  )

  const createTaskNote = useCallback(
    async (notebookId: string, title: string): Promise<Note> => {
      const subjectId = await ensureTasksSubject(notebookId)
      const now = Date.now()
      const note: Note = {
        id: nanoid(),
        notebookId,
        subjectId,
        title,
        content: '',
        tags: [],
        createdAt: now,
        updatedAt: now,
      }
      await saveNote(note)
      return note
    },
    [ensureTasksSubject, saveNote]
  )

  // Falha na criação (caderno, subject ou nota-corpo) vira banner e `[]`.
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null)
  const [subjectConvertError, setSubjectConvertError] = useState<string | null>(null)
  const createProjectTasks = useCallback(
    async (
      inputs: Array<{
        title: string
        status?: Task['status']
        dueDate?: string | null
        scheduledDate?: string | null
        important?: boolean
        sourceNoteId?: string | null
        parentNoteId?: string | null
      }>,
      project: ProjectChoice
    ): Promise<Task[]> => {
      try {
        const notebookId = await resolveProject(project)
        const withNotes = []
        for (const input of inputs) {
          const note = await createTaskNote(notebookId, input.title)
          withNotes.push({ ...input, notebookId, noteId: note.id })
        }
        const created = await createTasks(withNotes)
        setTaskCreateError(null)
        return created
      } catch (err) {
        console.error('failed to create tasks', err)
        setTaskCreateError('Failed to create task.')
        return []
      }
    },
    [resolveProject, createTaskNote, createTasks]
  )

  // O título da nota-corpo acompanha o título da task.
  const updateProjectTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      const task = tasksById.get(id)
      await updateTask(id, patch)
      if (patch.title === undefined || !task?.noteId) return
      const note = notesRef.current.find((n) => n.id === task.noteId)
      if (note && note.title !== patch.title) {
        await saveNote({ ...note, title: patch.title, updatedAt: Date.now() })
      }
    },
    [tasksById, updateTask, saveNote]
  )

  // "sistema | título" → vínculo com a TODOS "sistema" do mesmo caderno (criada
  // se não houver; uma por nome no lote) + título, em lote (ação confirmada
  // pelo usuário). O título da nota-corpo acompanha.
  const convertPipeTitles = useCallback(
    async (list: Task[]) => {
      const created = new Map<string, string>()
      const changes: Array<{ id: string; patch: { title: string; parentNoteId: string } }> = []
      try {
        for (const t of list) {
          const split = splitPipeTitle(t.title)
          if (!split) continue
          const wanted = normalizeName(split.prefix)
          const key = `${t.notebookId}\u0000${wanted}`
          let parentNoteId =
            created.get(key) ??
            notesRef.current.find(
              (n) => isTodosNote(n) && n.notebookId === t.notebookId && normalizeName(n.title.trim()) === wanted
            )?.id
          if (!parentNoteId) {
            parentNoteId = await createTodosNote(t.notebookId, split.prefix)
            created.set(key, parentNoteId)
          }
          changes.push({ id: t.id, patch: { title: split.title, parentNoteId } })
        }
      } catch (err) {
        console.error('failed to create TODOS', err)
        setTaskCreateError('Failed to create TODOS note.')
      }
      await updateTasks(changes)
      for (const { id, patch } of changes) {
        const task = list.find((t) => t.id === id)
        const note = task?.noteId ? notesRef.current.find((n) => n.id === task.noteId) : undefined
        if (note && note.title !== patch.title) {
          await saveNote({ ...note, title: patch.title, updatedAt: Date.now() })
        }
      }
    },
    [updateTasks, saveNote, createTodosNote]
  )

  // Leva a task e a nota-corpo (para o subject "Tasks") para outro caderno.
  const relocateTask = useCallback(
    async (task: Task, notebookId: string): Promise<boolean> => {
      const subjectId = await ensureTasksSubject(notebookId)
      const note = task.noteId ? notesRef.current.find((n) => n.id === task.noteId) : undefined
      if (note) {
        const saved = await saveNote({ ...note, notebookId, subjectId, updatedAt: Date.now() })
        if (!saved) return false
      }
      await updateTask(task.id, { notebookId })
      return true
    },
    [ensureTasksSubject, saveNote, updateTask]
  )

  const moveProjectTask = useCallback(
    async (id: string, project: ProjectChoice) => {
      const task = tasksById.get(id)
      if (!task) return
      const notebookId = await resolveProject(project)
      if (notebookId !== task.notebookId) await relocateTask(task, notebookId)
    },
    [tasksById, resolveProject, relocateTask]
  )

  // Antes de excluir/mover um caderno: as tasks dele (com as notas-corpo) vão
  // para outro caderno. Retorna os ids das notas-corpo movidas, que o chamador
  // não deve apagar nem achatar junto com as notas comuns. `ok` = false quando
  // alguma task não pôde ser movida: o chamador NÃO deve excluir/mesclar o caderno.
  const relocateNotebookTasks = useCallback(
    async (fromId: string, toId: string): Promise<{ movedNoteIds: Set<string>; ok: boolean }> => {
      const moving = tasks.filter((t) => t.notebookId === fromId)
      for (const t of moving) {
        if (!(await relocateTask(t, toId))) return { movedNoteIds: new Set(), ok: false }
      }
      return { movedNoteIds: new Set(moving.flatMap((t) => (t.noteId ? [t.noteId] : []))), ok: true }
    },
    [tasks, relocateTask]
  )
  const taskStatuses = useMemo(
    () => new Map(tasks.map((t) => [t.id, t.status])),
    [tasks]
  )

  // Navegação para a nota-corpo de uma task que mantém a TasksView aberta
  // (o efeito de navegação abaixo a fecharia). Só marca quando a nota muda,
  // senão o efeito não roda e a marca vazaria para a próxima navegação.
  const keepTasksViewRef = useRef(false)
  const showTaskNote = useCallback(
    (noteId: string | null) => {
      if (noteId === activeId) return
      keepTasksViewRef.current = true
      setActiveId(noteId)
    },
    [activeId]
  )

  // Abre a nota-corpo da task no editor principal. Task sem nota-corpo (nota
  // apagada por fora) ganha uma vazia, para nunca ficar sem corpo.
  const selectTask = useCallback(
    async (task: Task) => {
      if (task.noteId && notesRef.current.some((n) => n.id === task.noteId)) {
        showTaskNote(task.noteId)
        return
      }
      const note = await createTaskNote(task.notebookId, task.title)
      await updateTask(task.id, { noteId: note.id })
      showTaskNote(note.id)
    },
    [showTaskNote, createTaskNote, updateTask]
  )

  const openTask = useCallback(
    (id: string) => {
      const task = tasksById.get(id)
      if (!task) return
      setTasksFilter(null)
      setTasksSummaryFilter(null)
      setTasksMainView('list')
      setTasksViewOpen(true)
      void selectTask(task)
    },
    [tasksById, selectTask, setTasksMainView]
  )

  // Visões que não são List: a task abre num modal com o mesmo editor da
  // nota-corpo, sem trocar de visão. Guarda o id da task do modal.
  const [taskModalId, setTaskModalId] = useState<string | null>(null)
  const openTaskModal = useCallback(
    (task: Task) => {
      setTaskModalId(task.id)
      void selectTask(task)
    },
    [selectTask]
  )

  // Modal da task aberto de dentro de uma nota (sem trocar a nota de trás).
  // Separado de `taskModalId`, que é das visões em quadro.
  const [noteTaskModalId, setNoteTaskModalId] = useState<string | null>(null)
  const openTaskModalInPlace = useCallback(
    (id: string) => {
      if (tasksById.has(id)) setNoteTaskModalId(id)
    },
    [tasksById]
  )

  // "New task…" das Tasks (lista e Week board), com os campos do quick add.
  // TODOS nova (`>Nome` confirmado) nasce no projeto da task.
  const createNewTask = useCallback(
    async (draft: NewTaskDraft): Promise<Task | undefined> => {
      let notebookId: string
      let parentNoteId: string | null = null
      try {
        notebookId = await resolveProject(draft.project)
        if (draft.todos && 'noteId' in draft.todos) parentNoteId = draft.todos.noteId
        else if (draft.todos) parentNoteId = await createTodosNote(notebookId, draft.todos.newTitle)
      } catch (err) {
        console.error('failed to create task', err)
        setTaskCreateError('Failed to create task.')
        return undefined
      }
      const [task] = await createProjectTasks(
        [
          {
            title: draft.title,
            status: draft.status ?? undefined,
            scheduledDate: draft.scheduledDate,
            dueDate: draft.dueDate,
            important: draft.important,
            parentNoteId,
          },
        ],
        { notebookId }
      )
      return task
    },
    [resolveProject, createTodosNote, createProjectTasks]
  )

  // Week/Kanban board ocupa a área da lista e do editor (fora do modo foco).
  const tasksBoardOpen = tasksViewOpen && tasksMainView !== 'list' && !focusMode

  // Saiu do quadro (List, foco, navegação): o modal não volta sozinho depois.
  useEffect(() => {
    if (!tasksBoardOpen) setTaskModalId(null)
  }, [tasksBoardOpen])

  const taskProgress = useMemo(() => taskProgressByNotebook(tasks, today), [tasks, today])
  // Progresso de cada nota TODOS (lista de notas e faixa da nota).
  const todosProgress = useMemo(() => todosProgressByNote(tasks, today), [tasks, today])

  // Progresso do checklist da nota-corpo de cada task (`2/5` nos cards).
  const taskChecklist = useMemo(() => {
    const noteById = new Map(notes.map((n) => [n.id, n]))
    const map = new Map<string, { done: number; total: number }>()
    for (const t of tasks) {
      const note = t.noteId ? noteById.get(t.noteId) : undefined
      const progress = note ? checklistProgress(note.content) : null
      if (progress) map.set(t.id, progress)
    }
    return map
  }, [tasks, notes])

  const handleToggleLinkedTask = useCallback(
    (id: string, checked: boolean) => {
      void updateTask(id, { status: checked ? 'done' : 'todo' })
    },
    [updateTask]
  )

  // Qualquer navegação para nota/caderno (busca, link, Ctrl+N, Calendar) sai
  // da TasksView, exceto a seleção de task feita por ela (showTaskNote).
  useEffect(() => {
    if (keepTasksViewRef.current) {
      keepTasksViewRef.current = false
      return
    }
    setTasksViewOpen(false)
  }, [activeId, activeNotebookId])

  // A lista transversal (marcas ou tag) segue a mesma regra: navegação de
  // fora dela a fecha; a feita por ela (requestMarkAction, handleOpenTaggedNote)
  // marca keepSideViewRef — só quando a nota ou o caderno mudam, senão o efeito
  // não roda e a marca vazaria. Abrir a TasksView também fecha a lista.
  const keepSideViewRef = useRef(false)
  useEffect(() => {
    if (keepSideViewRef.current) {
      keepSideViewRef.current = false
      return
    }
    setSideView(null)
  }, [activeId, activeNotebookId])

  useEffect(() => {
    if (tasksViewOpen) setSideView(null)
  }, [tasksViewOpen])

  // Título da task ⇄ texto do item (checklist com o <task-ref>) nas "casas" da
  // task: a nota de ORIGEM (source_note_id) e a TODOS dela (parent_note_id,
  // onde o "Insert into checklist" põe o item). Cópias coladas em outras notas
  // não sincronizam. Dois efeitos:
  //  - item → task: editar o texto do item renomeia a task;
  //  - task → item (espelho): renomear a task fora do item (modal, lista,
  //    quick add, keep) reescreve o item nas casas.
  // Para um não ecoar o outro: o espelho grava como "visto" o texto que
  // escreveu (o item → task não o lê como edição) e a leitura do item → task
  // mais velha que a gravação do espelho é descartada (snapshot de `notes`
  // anterior ao render); o item → task marca a nota de onde veio o título, e o
  // espelho não reescreve essa nota (o usuário pode estar digitando nela).
  // Chave do "visto" do item → task: nota + task (a task tem até duas casas).
  const seenItemTitlesRef = useRef(new Map<string, string>())
  // Títulos da task vistos pelo espelho.
  const seenTaskTitlesRef = useRef(new Map<string, string>())
  // Título que o item → task gravou e a nota de onde veio.
  const titlesFromItemRef = useRef(new Map<string, { title: string; noteId: string }>())
  // `updatedAt` da última gravação do espelho por nota.
  const mirrorWritesRef = useRef(new Map<string, number>())
  useEffect(() => {
    const timer = setTimeout(() => {
      const seen = seenItemTitlesRef.current
      for (const note of notes) {
        if (!note.content.includes('<task-ref')) continue
        // Snapshot anterior à gravação do espelho: o item ainda tem o texto velho.
        if (note.updatedAt < (mirrorWritesRef.current.get(note.id) ?? 0)) continue
        for (const { id, title } of extractTaskRefTitles(note.content)) {
          const task = tasksById.get(id)
          if (!task || (task.sourceNoteId !== note.id && task.parentNoteId !== note.id)) continue
          const key = `${note.id}\u0000${id}`
          const previous = seen.get(key)
          seen.set(key, title)
          // Task com TODOS: o prefixo "<TODOS> | " do item não volta ao título.
          const prefix = task.parentNoteId ? todosById.get(task.parentNoteId)?.title ?? null : null
          const synced = stripPipePrefix(title, prefix)
          if (previous !== undefined && previous !== title && task.title !== synced) {
            titlesFromItemRef.current.set(id, { title: synced, noteId: note.id })
            void updateProjectTask(id, { title: synced })
          }
        }
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [notes, tasksById, todosById, updateProjectTask])

  // Espelho (task → item): uma gravação por nota, sobre a base mais nova (a
  // keep e o assistant gravam por fora); item que já mostra o título não é
  // regravado (rewriteTaskRefItemTitle). O `calendar-note-updated` manda a
  // keep recarregar a nota se estiver nela.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const seen = seenTaskTitlesRef.current
      const fromItem = titlesFromItemRef.current
      const ids = new Set(tasks.map((t) => t.id))
      for (const id of seen.keys()) if (!ids.has(id)) seen.delete(id)
      const renamedByNote = new Map<string, Task[]>()
      for (const task of tasks) {
        const previous = seen.get(task.id)
        seen.set(task.id, task.title)
        // A 1ª passada só registra: não reescreve o que já estava lá.
        if (previous === undefined || previous === task.title) continue
        // Consumido só quando o título muda: o item → task marca antes de a
        // task nova chegar ao estado.
        const origin = fromItem.get(task.id)
        fromItem.delete(task.id)
        const skip = origin?.title === task.title ? origin.noteId : null
        for (const noteId of new Set([task.sourceNoteId, task.parentNoteId])) {
          if (!noteId || noteId === skip) continue
          const list = renamedByNote.get(noteId) ?? []
          list.push(task)
          renamedByNote.set(noteId, list)
        }
      }
      for (const [noteId, renamed] of renamedByNote) {
        const local = notesRef.current.find((n) => n.id === noteId)
        if (!local || !local.content.includes('<task-ref')) continue
        const stored = await storage.getNote(noteId).catch(() => null)
        const base = stored && stored.updatedAt > local.updatedAt ? stored : local
        let content = base.content
        for (const task of renamed) {
          const prefix = task.parentNoteId ? todosById.get(task.parentNoteId)?.title ?? null : null
          content = rewriteTaskRefItemTitle(content, task.id, task.title, prefix)
        }
        if (content === base.content) continue
        const renamedIds = new Set(renamed.map((t) => t.id))
        for (const { id, title } of extractTaskRefTitles(content)) {
          if (renamedIds.has(id)) seenItemTitlesRef.current.set(`${noteId}\u0000${id}`, title)
        }
        const updatedAt = Date.now()
        mirrorWritesRef.current.set(noteId, updatedAt)
        if (await saveNote({ ...base, content, updatedAt })) {
          void emit('calendar-note-updated', { noteId })
        }
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [tasks, todosById, saveNote])

  useEffect(() => {
    if (!notebooksLoaded) return
    if (notebooks.some((nb) => nb.id === CALENDAR_NOTEBOOK_ID)) return
    // Cria o Calendar com id fixo. saveNotebook é UPSERT por id (ON CONFLICT),
    // então mesmo que este efeito dispare mais de uma vez nunca gera duplicata.
    const now = Date.now()
    void saveNotebook({
      id: CALENDAR_NOTEBOOK_ID,
      name: 'Calendar',
      createdAt: now,
      updatedAt: now,
    }).then(() => {
      setNotebookOrder((prev) => {
        const next = [CALENDAR_NOTEBOOK_ID, ...prev.filter((x) => x !== CALENDAR_NOTEBOOK_ID)]
        saveOrder('monet:notebook-order', next)
        return next
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebooksLoaded])

  // Bootstrap do Inbox. Com a leitura falha não cria (o UPSERT renomearia um
  // Inbox existente).
  useEffect(() => {
    if (!notebooksLoaded || notebooksLoadFailed) return
    void ensureInbox()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebooksLoaded])

  const refreshNotebooksWithDocs = useCallback(async () => {
    try {
      const ids = await getNotebooksWithVisibleDocs()
      setNotebooksWithDocs(new Set(ids))
    } catch {
      // non-critical, keep previous state
    }
  }, [])

  useEffect(() => {
    void refreshNotebooksWithDocs()
  }, [refreshNotebooksWithDocs])

  const executedCommandTexts = useMemo(() => {
    const set = new Set<string>()
    for (const r of responses) {
      if (r.status === 'error') continue
      const text = r.query.trim() ? `${r.command} ${r.query.trim()}` : r.command
      set.add(text)
    }
    return set
  }, [responses])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault()
        setFocusMode((v) => !v)
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        setSearchPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  const refreshApiKey = useCallback(async () => {
    const present = await hasOpenRouterKey()
    setHasApiKey(present)
    setApiKeyChecked(true)
    return present
  }, [])

  const refreshModels = useCallback(async () => {
    setModelsLoading(true)
    setModelsError(null)
    try {
      const list = await listOpenRouterModels()
      setModels(list)
      const savedModelId = localStorage.getItem('lastModelId')
      setModelId((current) => {
        if (current && list.some((m) => m.id === current)) return current
        if (savedModelId && list.some((m) => m.id === savedModelId)) return savedModelId
        return list[0]?.id ?? null
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err ?? 'failed to load models')
      if (message.includes(OPENROUTER_KEY_MISSING)) {
        setModels([])
        setModelsError(null)
      } else {
        setModels([])
        setModelsError(message)
      }
    } finally {
      setModelsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const present = await refreshApiKey()
      if (cancelled) return
      if (present) await refreshModels()
    })()
    return () => {
      cancelled = true
    }
  }, [refreshApiKey, refreshModels])

  useEffect(() => {
    async function runUpdateCheck() {
      const pref = getUpdatePreference()
      if (!isCheckDue()) return

      try {
        recordCheck()
        const update = await check()
        if (!update?.available) return

        const mandatory = isMandatory(update.body)
        if (pref === 'never' && !mandatory) return
        if (!mandatory && update.version === getSkippedVersion()) return

        setUpdateDialog({
          update,
          mandatory,
          autoStart: pref === 'auto' && !mandatory,
        })
      } catch {
        // silent failure — no internet or server unavailable
      }
    }

    runUpdateCheck()
  }, [])

  const handleUpdateFound = useCallback((update: Update, mandatory: boolean) => {
    setSettingsOpen(false)
    setUpdateDialog({
      update,
      mandatory,
      autoStart: getUpdatePreference() === 'auto' && !mandatory,
    })
  }, [])

  const handleApiKeyChanged = useCallback(
    (present: boolean) => {
      setHasApiKey(present)
      setApiKeyChecked(true)
      if (present) {
        void refreshModels()
      } else {
        setModels([])
        setModelId(null)
        setModelsError(null)
      }
    },
    [refreshModels]
  )

  useEffect(() => {
    if (modelId) localStorage.setItem('lastModelId', modelId)
  }, [modelId])

  useEffect(() => {
    localStorage.setItem('monet:active-mode', activeMode)
  }, [activeMode])

  const handleSetMode = useCallback((mode: ActiveMode) => {
    setActiveMode((prev) => (prev === mode ? prev : mode))
  }, [])

  useEffect(() => {
    localStorage.setItem('monet:notebook-collapsed', notebookCollapsed ? '1' : '0')
  }, [notebookCollapsed])

  useEffect(() => {
    localStorage.setItem('monet:sidebar-collapsed', sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  async function handleRenameNotebook(id: string, name: string) {
    const nb = notebooks.find((n) => n.id === id)
    if (!nb) return
    await saveNotebook({ ...nb, name: name.trim() || nb.name, updatedAt: Date.now() })
  }

  // Tags das notas de caderno (variações de caixa/acento juntas, a grafia
  // mais usada), com a contagem: seção "Tags", lista transversal, autocomplete
  // do editor e `tag:` do Ctrl+P.
  const tagSummary = useMemo(() => summarizeTags(notes), [notes])
  const allTags = useMemo(() => tagSummary.map((t) => t.tag), [tagSummary])

  // Marcas de todas as notas de caderno não arquivadas (extração cacheada por
  // nota): lista Marks, contagens da coluna de cadernos e rótulos já usados
  // (os mais usados primeiro), que alimentam o editor e o Ctrl+P.
  const allMarkHits = useMemo(() => collectNoteMarks(notes), [notes])
  const markSummary = useMemo(() => summarizeMarks(allMarkHits.map((h) => h.entry)), [allMarkHits])
  const markLabels = useMemo(() => markSummary.labels.map((l) => l.label), [markSummary])

  const notebookNotes = useMemo(
    () => activeNotebookId === null
      ? notes
      : notes.filter((n) => n.notebookId === activeNotebookId),
    [notes, activeNotebookId]
  )

  // Notas-corpo de task não aparecem na lista (vivem na TasksView).
  const subjectFilteredNotes = useMemo(() => {
    const listed = notes.filter((n) => !isTaskBodyNote(n))
    if (activeNotebookId === null) return listed.filter((n) => n.notebookId !== calendarNotebookId)
    if (activeSubjectId !== null) {
      return listed.filter((n) => n.notebookId === activeNotebookId && n.subjectId === activeSubjectId)
    }
    return listed.filter((n) => n.notebookId === activeNotebookId)
  }, [notes, activeNotebookId, activeSubjectId])

  const orderedNotebooks = useMemo(
    () => applyOrder(notebooks, notebookOrder),
    [notebooks, notebookOrder]
  )

  // Navegação para nota/caderno usada pelos cards de task (antes do contexto
  // do editor, que expõe `onOpenTodos`).
  const handleNavigateToNote = useCallback(
    (notebookId: string, noteId: string, subjectId?: string | null) => {
      setActiveMode('notebook')
      setActiveNotebookId(notebookId)
      setActiveSubjectId(subjectId ?? null)
      setActiveId(noteId)
      setSearch('')
    },
    []
  )

  const handleNoteLinkNavigation = useCallback(
    (noteId: string) => {
      const note = notes.find((n) => n.id === noteId)
      if (!note || !note.notebookId) return
      handleNavigateToNote(note.notebookId, noteId)
    },
    [notes, handleNavigateToNote]
  )

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
  )
  const activeNoteRef = useRef<Note | null>(null)
  activeNoteRef.current = activeNote
  // Booleano (e não a nota): o contexto dos cards não muda a cada tecla.
  const activeNoteIsTodos = !!activeNote && isTodosNote(activeNote)

  // Task e nota-corpo do modal aberto de dentro de uma nota (R4). A nota-corpo
  // apagada por fora vira `undefined`: o modal cai no caso "sem nota-corpo".
  const noteTaskModalTask = noteTaskModalId ? tasksById.get(noteTaskModalId) : undefined
  const noteTaskModalNote = noteTaskModalTask?.noteId
    ? notes.find((n) => n.id === noteTaskModalTask.noteId)
    : undefined

  // Grava a nota-corpo do modal sobre a base da memória (não da render).
  const updateModalNote = useCallback(
    (patch: Partial<Note>) => {
      const task = noteTaskModalTask
      const current = task?.noteId ? notesRef.current.find((n) => n.id === task.noteId) : undefined
      if (current) void saveNote({ ...current, ...patch, updatedAt: Date.now() })
    },
    [noteTaskModalTask, saveNote]
  )
  const addBodyNoteToModalTask = useCallback(async () => {
    const task = noteTaskModalTask
    // `noteTaskModalNote` (e não `task.noteId`): a nota-corpo apagada por fora
    // deixa o id velho na task, e o "Add body note" precisa recriá-la.
    if (!task || noteTaskModalNote) return
    const note = await createTaskNote(task.notebookId, task.title)
    await updateTask(task.id, { noteId: note.id })
  }, [noteTaskModalTask, noteTaskModalNote, createTaskNote, updateTask])
  // Provider do corpo do modal: sem `onOpenTask`/`onOpenTaskModal` (nada
  // navega atrás do modal).
  const modalTasksContext = useMemo(
    () => ({
      tasksById,
      todayKey: today,
      checklist: taskChecklist,
      statuses: statusRegistry,
      metadataDefs: metadata.defs,
      todosTitle: (noteId: string) => todosById.get(noteId)?.title,
      currentNoteId: noteTaskModalNote?.id ?? null,
      onSetStatus: (id: string, status: string) => void updateTask(id, { status }),
      onToggleTask: handleToggleLinkedTask,
    }),
    [
      tasksById,
      today,
      taskChecklist,
      statusRegistry,
      metadata.defs,
      todosById,
      noteTaskModalNote?.id,
      updateTask,
      handleToggleLinkedTask,
    ]
  )

  const tasksContextValue = useMemo(
    () => ({
      tasksById,
      todayKey: today,
      onOpenTask: openTask,
      notebooks: orderedNotebooks,
      onToggleTask: handleToggleLinkedTask,
      checklist: taskChecklist,
      statuses: statusRegistry,
      onSetStatus: (id: string, status: string) => {
        void updateTask(id, { status })
      },
      metadataDefs: metadata.defs,
      todosTitle: (noteId: string) => todosById.get(noteId)?.title,
      currentNoteId: activeId,
      onUpdateTask: (id: string, patch: TaskPatch) => void updateTask(id, patch),
      onMoveTask: (id: string, project: ProjectChoice) => void moveProjectTask(id, project),
      todosOptions,
      onOpenTodos: handleNoteLinkNavigation,
      onCreateTodos: createTodosNote,
      onManageMetadata: (focusId?: string) => setMetadataManager({ focusId: focusId ?? null }),
      currentNoteIsTodos: activeNoteIsTodos,
      // Shift+click no ↗ da task: modal sem trocar a nota, em qualquer nota.
      // Nas visões em quadro o editor já está num modal: fica o clique simples.
      onOpenTaskModal: tasksBoardOpen ? undefined : openTaskModalInPlace,
    }),
    [
      tasksById,
      today,
      openTask,
      orderedNotebooks,
      handleToggleLinkedTask,
      taskChecklist,
      statusRegistry,
      updateTask,
      metadata.defs,
      todosById,
      activeId,
      activeNoteIsTodos,
      tasksBoardOpen,
      moveProjectTask,
      todosOptions,
      handleNoteLinkNavigation,
      createTodosNote,
      openTaskModalInPlace,
    ]
  )

  // Filtro por tipo da lista de notas (N4): opções = tipos presentes nas notas
  // listadas; tipo que some da lista volta a "All".
  const [noteTypeFilter, setNoteTypeFilter] = useState<string | null>(null)
  const typeFilterOptions = useMemo(() => {
    const present = new Set(subjectFilteredNotes.map((n) => n.typeId).filter(Boolean))
    return noteTypes.types.filter((t) => present.has(t.id))
  }, [subjectFilteredNotes, noteTypes.types])
  const activeTypeFilter = typeFilterOptions.some((t) => t.id === noteTypeFilter) ? noteTypeFilter : null

  // Ordem da lista de notas (global): fora de 'manual', a lista não arrasta.
  const [noteSort, setNoteSortState] = useState<NoteSort>(loadNoteSort)
  const setNoteSort = useCallback((sort: NoteSort) => {
    setNoteSortState(sort)
    saveNoteSort(sort)
  }, [])

  // Arquivadas ficam fora da lista (rodapé "Archived · N" da Sidebar).
  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = subjectFilteredNotes.filter((n) => {
      if (n.archivedAt) return false
      if (activeTypeFilter && n.typeId !== activeTypeFilter) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
    return sortNotes(
      applyOrder(filtered, noteOrder),
      noteSort,
      noteTypes.types.map((t) => t.id)
    )
  }, [subjectFilteredNotes, search, activeTypeFilter, noteOrder, noteSort, noteTypes.types])

  // Arquivadas do caderno/subject atual, da mais recente para a mais antiga.
  const archivedNotes = useMemo(
    () =>
      subjectFilteredNotes
        .filter((n) => !!n.archivedAt)
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [subjectFilteredNotes]
  )

  // Task cuja nota-corpo está aberta no editor (null = nota comum).
  const activeTask = useMemo(
    () => (activeId ? tasks.find((t) => t.noteId === activeId) ?? null : null),
    [tasks, activeId]
  )

  // Tipo da nota aberta: só nota de caderno (D4); id órfão = sem tipo.
  const canTypeActive = !!activeNote && !activeTask && canHaveType(activeNote)
  const activeNoteType =
    canTypeActive && activeNote?.typeId
      ? noteTypes.types.find((t) => t.id === activeNote.typeId) ?? null
      : null
  const activeArchived = !!activeNote?.archivedAt

  // TODOS aberta: tasks vinculadas sem pill no conteúdo ("Linked outside this
  // checklist").
  const todosOutside = useMemo(() => {
    if (!activeNote || !isTodosNote(activeNote)) return []
    const present = taskRefIds(activeNote.content)
    return tasks.filter((t) => t.parentNoteId === activeNote.id && !present.has(t.id))
  }, [tasks, activeNote])

  // "Insert into checklist": item no fim da nota (no último checklist, se o
  // documento termina num), marcado se a task está concluída. Só por clique.
  const handleInsertTodosTask = useCallback((task: Task) => {
    const editor = notesEditorRef.current
    if (!editor || editor.isDestroyed || !editor.isEditable) return
    const item = {
      type: 'taskItem',
      attrs: { checked: isDone(task) },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: `${task.title.trim() || 'Untitled'} ` },
            { type: 'taskRef', attrs: { id: task.id } },
          ],
        },
      ],
    }
    const { doc } = editor.state
    if (doc.lastChild?.type.name === 'taskList') {
      editor.chain().insertContentAt(doc.content.size - 1, item).run()
    } else {
      editor.chain().insertContentAt(doc.content.size, { type: 'taskList', content: [item] }).run()
    }
  }, [])

  // Apaga as tasks e as notas-corpo. Se a task aberta no editor está entre
  // elas, a nota fecha antes.
  const deleteProjectTasks = useCallback(
    async (ids: string[]) => {
      const list = ids.map((id) => tasksById.get(id)).filter((t): t is Task => !!t)
      if (activeTask && ids.includes(activeTask.id)) {
        if (tasksViewOpen) showTaskNote(null)
        else setActiveId(null)
      }
      await deleteTasks(ids)
      for (const task of list) {
        if (task.noteId) await removeNote(task.noteId)
      }
    },
    [tasksById, activeTask, tasksViewOpen, showTaskNote, deleteTasks, removeNote]
  )

  // Dia da nota diária do Calendar aberta (bloco "Due today").
  const activeCalendarDay = useMemo(() => {
    if (!activeNote || activeNote.notebookId !== CALENDAR_NOTEBOOK_ID) return null
    const d = parseCalendarTitle(activeNote.title)
    return d ? toDateKey(d.getFullYear(), d.getMonth(), d.getDate()) : null
  }, [activeNote])

  // ─── Sincronização com a janela keep (Ctrl+K) ────────────────────────────
  // Ao ganhar foco com uma nota diária do Calendar ativa, relê as notas do
  // banco: a keep pode ter editado a nota de hoje enquanto a main estava em
  // segundo plano (last-write-wins, recarga no ponto de troca de contexto).
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) return
        const current = activeNoteRef.current
        if (!current) return
        if (current.notebookId !== CALENDAR_NOTEBOOK_ID) return
        if (!parseCalendarTitle(current.title)) return
        void refreshNotes().catch((err) =>
          console.error('refresh on focus failed', err)
        )
      })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [refreshNotes])

  // Botão "Open Monet" da keep: abre a nota de hoje sobre a lista recém-lida
  // do banco (a nota pode ter sido criada pela keep e não existir no estado).
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined
    void listen('open-today-note', () => {
      void (async () => {
        try {
          const fresh = await refreshNotes()
          const title = formatCalendarTitle(new Date())
          const existing = fresh.find(
            (n) => n.notebookId === CALENDAR_NOTEBOOK_ID && n.title === title
          )
          setActiveMode('notebook')
          setActiveSubjectId(null)
          setActiveNotebookId(CALENDAR_NOTEBOOK_ID)
          if (existing) {
            setActiveId(existing.id)
            return
          }
          const note = await createNote(CALENDAR_NOTEBOOK_ID)
          const filled: Note = { ...note, title, updatedAt: Date.now() }
          await saveNote(filled)
          setActiveId(filled.id)
          setNoteOrder((prev) => {
            const next = [filled.id, ...prev]
            saveNoteOrder(next)
            return next
          })
        } catch (err) {
          console.error('open-today-note failed', err)
        }
      })()
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [refreshNotes, createNote, saveNote])

  // Cards do calendário da keep: abre a nota ou a task clicada. A nota é
  // buscada na lista recém-lida do banco (pode ter sido criada pela keep).
  // Marca citada no chat da janela assistant: a main aparece e abre a nota na
  // marca (handleOpenMark, atribuído mais abaixo).
  const openTaskRef = useRef(openTask)
  openTaskRef.current = openTask
  const openMarkRef = useRef<(text: string) => void>(() => {})
  useEffect(() => {
    let cancelled = false
    const unlisteners: Array<() => void> = []
    const track = (p: Promise<() => void>) =>
      void p.then((fn) => {
        if (cancelled) fn()
        else unlisteners.push(fn)
      })
    track(
      listen<string>('open-note', (event) => {
        void (async () => {
          try {
            const fresh = await refreshNotes()
            const note = fresh.find((n) => n.id === event.payload)
            if (!note) return
            setTasksViewOpen(false)
            setActiveMode('notebook')
            setActiveSubjectId(null)
            if (note.notebookId) setActiveNotebookId(note.notebookId)
            setActiveId(note.id)
          } catch (err) {
            console.error('open-note failed', err)
          }
        })()
      })
    )
    track(listen<string>('open-task', (event) => openTaskRef.current(event.payload)))
    track(
      listen<string>('assistant-open-mark', (event) => {
        if (typeof event.payload !== 'string') return
        const main = getCurrentWindow()
        void main.unminimize().then(() => main.show()).then(() => main.setFocus()).catch(() => {})
        openMarkRef.current(event.payload)
      })
    )
    return () => {
      cancelled = true
      unlisteners.forEach((fn) => fn())
    }
  }, [refreshNotes])

  // ─── Lembretes ───────────────────────────────────────────────────────────
  // Estado "disparado" da nota diária ativa, para o Editor riscar os chips.
  const [firedReminderIds, setFiredReminderIds] = useState<Set<string>>(new Set())
  const activeIsDailyNote =
    activeNote?.notebookId === CALENDAR_NOTEBOOK_ID &&
    !!parseCalendarTitle(activeNote?.title ?? '')

  useEffect(() => {
    if (!activeId || !activeIsDailyNote) {
      setFiredReminderIds(new Set())
      return
    }
    let cancelled = false
    storage
      .getFiredReminderIds(activeId)
      .then((ids) => {
        if (!cancelled) setFiredReminderIds(new Set(ids))
      })
      .catch((err) => console.error('failed to load fired reminders', err))
    return () => {
      cancelled = true
    }
  }, [activeId, activeIsDailyNote])

  const handleRemindersFired = useCallback((noteId: string, ids: string[]) => {
    if (activeNoteRef.current?.id !== noteId) return
    setFiredReminderIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
  }, [])

  // Scheduler (tick de 30s) — roda somente nesta janela (main).
  useReminders(notes, handleRemindersFired, tasks)

  const remindersContextValue = useMemo(
    () => ({ firedIds: firedReminderIds }),
    [firedReminderIds]
  )

  const handleExport = useCallback(async () => {
    if (!activeNote) return
    const expanded = expandEmbedBlocks(activeNote.content, responses)
    const content = stripCommandLines(expanded)
    const defaultName = activeNote.title.trim()
      ? `${activeNote.title.trim()}.md`
      : 'untitled-note.md'
    try {
      const saved = await invoke<boolean>('export_markdown', { defaultName, content })
      if (saved) {
        if (exportTimerRef.current) clearTimeout(exportTimerRef.current)
        setExportSuccess(true)
        exportTimerRef.current = setTimeout(() => setExportSuccess(false), 2000)
      }
    } catch (err) {
      console.error('export failed:', err)
    }
  }, [activeNote, responses])

  const isNoteArchived = useCallback(
    (noteId: string) => !!notes.find((n) => n.id === noteId)?.archivedAt,
    [notes]
  )
  const resolveNoteContent = useCallback(
    (noteId: string) => notes.find((n) => n.id === noteId)?.content,
    [notes]
  )
  // Resolvedores dos pontos que geram texto para a IA: nota de caderno com a
  // indexação de IA desligada conta como inexistente (só as referências — a
  // nota aberta e a seleção do NotesChat seguem como hoje).
  const resolveAiNoteTitle = useCallback(
    (noteId: string) => {
      const note = notes.find((n) => n.id === noteId)
      if (!note) return undefined
      if (note.notebookId && disabledNotebookIds.has(note.notebookId)) return undefined
      return note.title
    },
    [notes, disabledNotebookIds]
  )
  const resolveAiNoteContent = useCallback(
    (noteId: string) => {
      const note = notes.find((n) => n.id === noteId)
      if (!note) return undefined
      if (note.notebookId && disabledNotebookIds.has(note.notebookId)) return undefined
      return note.content
    },
    [notes, disabledNotebookIds]
  )

  const handleCommand = useCallback(
    async ({ cmd, query, commandId }: CommandExecutionRequest) => {
      if (!activeId) return false
      const def = findCommand(cmd)
      if (!def || def.local) return false
      if (def.calendarOnly && activeNote?.notebookId !== CALENDAR_NOTEBOOK_ID) {
        return false
      }
      if (def.takesQuery && query.trim().length === 0) {
        return false
      }
      // O card nasce na aba AI; se o Chat estiver aberto, troca para ela.
      setRightTab('ai')
      const present = await hasOpenRouterKey()
      setHasApiKey(present)
      setApiKeyChecked(true)
      if (!present) {
        addErrorCard(
          activeId,
          cmd,
          query,
          'API key not configured. Add your OpenRouter key in Settings to start requests.'
        )
        return true
      }
      if (!modelId || models.length === 0) {
        addErrorCard(
          activeId,
          cmd,
          query,
          'No model available to select. Check your OpenRouter account.'
        )
        return true
      }
      if (def.usesSearch) {
        if (!(await hasTavilyKey())) {
          addErrorCard(
            activeId,
            cmd,
            query,
            'Web search not configured. Add your Tavily key in Settings > Web Search to use this command.'
          )
          return true
        }
      }

      const noteContent = activeNote?.content ?? ''
      const anchor = activeNote ? parseCalendarTitle(activeNote.title) : null
      const weekNotes = cmd === '/week' && anchor ? getWeekCalendarNotes(notes, anchor) : []
      const datedNotes =
        activeNote?.notebookId === CALENDAR_NOTEBOOK_ID && anchor ? getDatedNotes(notes, anchor) : []
      const contextContents = [noteContent, ...weekNotes.map((e) => e.note.content), ...datedNotes.map((n) => n.content)]
      const embeds = await loadEmbedResponses(contextContents, resolveNoteContent)
      const imageTexts = await ocrTextsForContent(contextContents.join('\n'))
      const toAiText = (content: string) =>
        cleanNoteContentForAi(content, {
          resolveNoteTitle: resolveAiNoteTitle,
          resolveEmbed: (id) => embeds.get(id),
          resolveLinkedNoteContent: resolveAiNoteContent,
          resolveImageText: (dataUrl) => imageTexts.get(dataUrl),
        })
      const noteText = toAiText(noteContent)
      let searchContext: string | undefined
      if (def.usesSearch && query.trim()) {
        try {
          const results = await webSearch(query)
          searchContext = formatSearchResults(results)
        } catch (err) {
          console.warn('webSearch failed:', err)
        }
      }

      const isDocsOnly = cmd === '/docs'
      const notebookId = activeNote?.notebookId ?? null

      let visibleDocIds: string[] = []
      let docsListFailed = false
      if (notebookId) {
        try {
          const rawIds = await getNotebookVisibleDocumentIds(notebookId)
          visibleDocIds = await resolveSearchableIds(rawIds, {
            notebookId,
            excludeNoteId: activeNote?.id ?? null,
            includeAiFolders: true,
          })
        } catch (err) {
          docsListFailed = true
          console.warn('getNotebookVisibleDocumentIds failed:', err)
          if (isDocsOnly) {
            addErrorCard(
              activeId,
              cmd,
              query,
              'Failed to query notebook documents.'
            )
            return true
          }
        }
      } else if (isDocsOnly) {
        addErrorCard(
          activeId,
          cmd,
          query,
          'This note does not belong to a notebook. /docs requires a notebook with indexed documents.'
        )
        return true
      }

      if (isDocsOnly && !docsListFailed && visibleDocIds.length === 0) {
        addErrorCard(
          activeId,
          cmd,
          query,
          'No documents visible in this notebook. Open the notebook documents selector to select documents from the Knowledge Base.'
        )
        return true
      }

      let ragContext: string | undefined
      let ragSources: AiSource[] | undefined
      if (visibleDocIds.length > 0 && !docsListFailed) {
        try {
          const queryText = query.trim() || noteText.slice(0, 500)
          if (queryText) {
            const embedding = await embedText(queryText)
            const topK = isDocsOnly ? 8 : 5
            const chunks = await documentsSearchByIds(visibleDocIds, embedding, topK)
            if (chunks.length > 0) {
              ragContext = formatRagContext(chunks)
              ragSources = chunks.map((c) => ({
                documentId: c.documentId,
                documentName: c.documentName,
                chunkIndex: c.chunkIndex,
                snippet: c.snippet,
              }))
            }
          }
        } catch (err) {
          console.warn('RAG context failed (continuing without):', err)
        }
      }

      if (isDocsOnly && !ragContext) {
        addErrorCard(
          activeId,
          cmd,
          query,
          'Could not retrieve relevant document excerpts. Check your connection and try again.'
        )
        return true
      }

      const isWeekOnly = cmd === '/week'
      let weekContext: string | undefined
      if (isWeekOnly) {
        if (!anchor) {
          addErrorCard(
            activeId,
            cmd,
            query,
            "This note's title is not a valid calendar date (DD/MM/YYYY)."
          )
          return true
        }
        const weekEntries = weekNotes
          .map((e) => ({ dateLabel: e.dateLabel, content: toAiText(e.note.content) }))
          .filter((e) => e.content)
        if (weekEntries.length === 0) {
          addErrorCard(
            activeId,
            cmd,
            query,
            'No calendar notes with content found in the last 7 days.'
          )
          return true
        }
        weekContext = formatWeekContext(weekEntries)
      }

      let datedNotesContext: string | undefined
      if (datedNotes.length > 0) {
        const datedEntries = datedNotes
          .map((n) => ({ title: n.title.trim() || 'Untitled', content: toAiText(n.content) }))
          .filter((e) => e.content)
        if (datedEntries.length > 0) {
          datedNotesContext = formatDatedNotesContext(datedEntries)
        }
      }

      const userMessage = isDocsOnly
        ? buildUserMessage(cmd, def.description, query, '', undefined, ragContext, undefined, datedNotesContext)
        : isWeekOnly
          ? buildUserMessage(cmd, def.description, query, '', searchContext, ragContext, weekContext, datedNotesContext)
          : buildUserMessage(cmd, def.description, query, noteText, searchContext, ragContext, undefined, datedNotesContext)

      // Log dos contextos montados para o slash command (complementa o log
      // do payload final em useAi.ts).
      if (import.meta.env.DEV) console.log('[Monet AI] Command contexts', {
        cmd,
        query,
        model: modelId,
        systemPrompt: SYSTEM_PROMPT,
        searchContext,
        ragContext,
        weekContext,
        datedNotesContext,
        userMessage,
      })

      await start({
        noteId: activeId,
        model: modelId,
        command: cmd,
        query: def && !def.takesQuery ? '' : query,
        commandId,
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        sources: ragSources,
      })
      return true
    },
    [activeId, activeNote, modelId, models.length, start, addErrorCard, notes, setRightTab, resolveAiNoteTitle, resolveAiNoteContent]
  )

  const effectiveNotebookWidth = notebookCollapsed ? COLLAPSED_PANEL_WIDTH : notebookWidth
  // Com cadernos ocultos vale a largura "wide" (clampada ao teto maior, sem
  // regravar); com cadernos visíveis, a normal de sempre.
  const columnWidth = notebookCollapsed
    ? Math.min(WIDE_MAX_WIDTH, wideSidebarWidth)
    : sidebarWidth
  const setColumnWidth = notebookCollapsed ? setWideSidebarWidth : setSidebarWidth
  const effectiveSidebarWidth = sidebarCollapsed ? COLLAPSED_PANEL_WIDTH : columnWidth

  function updateActive(patch: Partial<Note>) {
    if (!activeNote) return
    void saveNote({ ...activeNote, ...patch, updatedAt: Date.now() })
  }

  async function handleCreateNotebook() {
    const name = window.prompt('Notebook name')
    if (name === null) return
    const nb = await createNotebook(name)
    setActiveNotebookId(nb.id)
    setActiveId(null)
    setNotebookOrder((prev) => {
      const next = [nb.id, ...prev]
      saveOrder('monet:notebook-order', next)
      return next
    })
  }

  // `typeId`: "New <tipo>" (nota com o template do tipo como conteúdo).
  async function handleCreateNote(typeId: string | null = null) {
    if (!activeNotebookId) return
    const note = await createNote(activeNotebookId, activeSubjectId)
    if (typeId) {
      const template = noteTypes.types.find((t) => t.id === typeId)?.template
      if (template) await saveNote({ ...note, content: template, updatedAt: Date.now() })
      await setNoteType(note.id, typeId)
    }
    setActiveId(note.id)
    setNoteOrder((prev) => {
      const next = [note.id, ...prev]
      saveNoteOrder(next)
      return next
    })
  }

  // Troca o tipo da nota aberta (§4.5): valores migram por nome + tipo de
  // dado; os sem correspondente ficam guardados, com confirmação. O template do
  // tipo novo só entra em nota vazia.
  async function handleSetNoteType(typeId: string | null) {
    const note = activeNote
    if (!note) return
    const props = note.properties ?? {}
    const { next, hidden } = migrateProperties(
      props,
      typeDefs(noteTypes.defs, activeNoteType?.id),
      typeDefs(noteTypes.defs, typeId)
    )
    if (hidden.length > 0) {
      const ok = await confirm(
        `Switch type? These properties will be hidden (values are kept): ${hidden.map((d) => d.name).join(', ')}.`,
        { title: 'Change note type', confirmLabel: 'Switch' }
      )
      if (!ok) return
    }
    // Deixar de ser TODOS desvincula as tasks dela (não as apaga).
    const linked = isTodosNote(note) && typeId !== TODOS_TYPE_ID ? todosTaskCount.get(note.id) ?? 0 : 0
    if (linked > 0) {
      const ok = await confirm(
        `${linked} task${linked === 1 ? '' : 's'} stop belonging to this TODOS (they are not deleted).`,
        { title: 'Change note type', confirmLabel: 'Switch' }
      )
      if (!ok) return
    }
    if (!(await setNoteType(note.id, typeId))) return
    if (linked > 0) await detachTodosChildren(new Set([note.id]))
    if (next !== props) await setNoteProperties(note.id, next)
    const template = typeId ? noteTypes.types.find((t) => t.id === typeId)?.template : null
    const fresh = notesRef.current.find((n) => n.id === note.id)
    if (template && fresh && fresh.content.trim() === '') {
      void saveNote({ ...fresh, content: template, updatedAt: Date.now() })
    }
  }

  // Valor vazio sai do JSON (checkbox `false` conta como valor).
  function handleNotePropertyChange(defId: string, value: MetadataValue) {
    if (!activeNote) return
    const { [defId]: _old, ...rest } = activeNote.properties ?? {}
    void setNoteProperties(activeNote.id, value === null || value === '' ? rest : { ...rest, [defId]: value })
  }

  // "Insert template": acrescenta ao fim, nunca sobrescreve.
  function handleInsertTemplate() {
    const template = activeNoteType?.template
    if (!activeNote || !template) return
    const body = activeNote.content.trimEnd()
    updateActive({ content: body ? `${body}\n\n${template}` : template })
  }

  async function handleDeleteNotebook(id: string) {
    if (id === INBOX_NOTEBOOK_ID || id === CALENDAR_NOTEBOOK_ID) return
    // As tasks do caderno (com as notas-corpo) vão para o Inbox ANTES da
    // exclusão em cascata das notas do caderno.
    const { movedNoteIds, ok } = await relocateNotebookTasks(id, await ensureInbox())
    if (!ok) return
    if (tasksFilter === id) setTasksFilter(null)
    // Falhou no banco: o caderno volta no próximo load, então o chat, as fontes
    // web e as notas ficam.
    if (!(await removeNotebook(id))) return
    // A pasta de chat do caderno sai junto, com as conversas e a pasta web.
    // Depois do removeNotebook: com o caderno ainda no estado, o chat das
    // Anotações recriaria a pasta.
    const chatFolderId = deleteNotebookChatFolder(id)
    if (chatFolderId) {
      deleteChatWebFolder(chatFolderId).catch((err) =>
        console.error('failed to delete web sources folder', err)
      )
    }
    const childNotes = notes.filter((n) => n.notebookId === id && !movedNoteIds.has(n.id))
    // Tasks (já no Inbox) das TODOS apagadas ficam sem TODOS.
    await detachTodosChildren(new Set(childNotes.filter(isTodosNote).map((n) => n.id)))
    childNotes.forEach((n) => removeNote(n.id))
    if (activeNotebookId === id) {
      setActiveNotebookId(null)
      setActiveSubjectId(null)
      setActiveId(null)
    }
    setNotebookOrder((prev) => {
      const next = prev.filter((x) => x !== id)
      saveOrder('monet:notebook-order', next)
      return next
    })
  }

  async function handleDeleteNote(id: string) {
    // As tasks da TODOS ficam sem TODOS (não são apagadas).
    await detachTodosChildren(new Set([id]))
    await removeNote(id)
    if (activeId === id) setActiveId(null)
    setNoteOrder((prev) => {
      const next = prev.filter((x) => x !== id)
      saveNoteOrder(next)
      return next
    })
  }

  // Arquivar/desarquivar (R2). Arquivar uma TODOS com tasks abertas pergunta
  // antes (R6); nada é arquivado sozinho.
  async function handleSetArchived(noteId: string, archived: boolean) {
    const note = notesRef.current.find((n) => n.id === noteId)
    if (!note) return
    if (!archived) {
      await setNoteArchived(noteId, false)
      return
    }
    if (isTodosNote(note)) {
      const open = tasks.filter((t) => t.parentNoteId === noteId && isOpen(t))
      if (open.length > 0) {
        const choice = await choose(
          `"${note.title.trim() || 'Untitled'}" has ${open.length} open task${open.length === 1 ? '' : 's'}. Archived TODOS keep their tasks linked.`,
          {
            title: 'Archive TODOS',
            confirmLabel: 'Archive anyway',
            altLabel: 'Mark open as Dropped and archive',
            cancelLabel: 'Cancel',
            destructive: false,
          }
        )
        if (choice === 'cancel') return
        if (choice === 'alt') {
          if (!(await updateTasks(open.map((t) => ({ id: t.id, patch: { status: 'dropped' } }))))) return
        }
      }
    }
    await setNoteArchived(noteId, true)
  }

  async function handleCreateSubject() {
    if (!activeNotebookId) return
    const name = window.prompt('Subject name')
    if (name === null) return
    await createSubject(name)
  }

  // Visão Tasks filtrada por um caderno (subject "Tasks" e "Show all" da
  // seção de tasks da coluna de notas).
  function openNotebookTasks(notebookId: string) {
    setTasksFilter(notebookId)
    setTasksSummaryFilter(null)
    setTasksViewOpen(true)
  }

  function handleSelectSubject(id: string | null) {
    const subject = id ? subjects.find((s) => s.id === id) : undefined
    if (subject && isTasksSubject(subject)) {
      openNotebookTasks(subject.notebookId)
      return
    }
    setActiveSubjectId(id)
    if (id === null) return
    const first = applyOrder(
      notes.filter((n) => n.notebookId === activeNotebookId && n.subjectId === id && !n.archivedAt),
      noteOrder
    )[0]
    setActiveId(first?.id ?? null)
  }

  async function handleDeleteSubject(id: string) {
    const childNotes = notes.filter((n) => n.subjectId === id)
    await removeSubject(id)
    await detachTodosChildren(new Set(childNotes.filter(isTodosNote).map((n) => n.id)))
    await Promise.all(childNotes.map((n) => removeNote(n.id)))
    if (activeSubjectId === id) setActiveSubjectId(null)
    if (childNotes.some((n) => n.id === activeId)) setActiveId(null)
  }

  // Subject → caderno (inverso do handleMoveNotebook): as notas do subject vão
  // para a raiz de um caderno com o nome dele — o de mesmo nome, se existir
  // (mesma regra do resolveProject), ou um novo, que herda a visibilidade de
  // RAG da origem. As notas são gravadas ANTES do deleteSubject, que
  // cascade-deleta as notas do subject; falha em qualquer gravação aborta sem
  // apagar o subject.
  async function handleTurnSubjectIntoNotebook(id: string) {
    const subject = subjects.find((s) => s.id === id)
    if (!subject || isTasksSubject(subject)) return
    const sourceId = subject.notebookId
    if (sourceId === CALENDAR_NOTEBOOK_ID) return
    const name = subject.name.trim() || 'unnamed'
    let destId = findNotebookByName(notebooks, name)?.id
    if (!destId) {
      const nb = await createNotebook(name)
      destId = nb.id
      if (disabledNotebookIds.has(sourceId)) await setNotebookIndexEnabled(nb.id, false)
      setNotebookOrder((prev) => {
        const i = prev.indexOf(sourceId)
        const next = i >= 0 ? [...prev.slice(0, i + 1), nb.id, ...prev.slice(i + 1)] : [nb.id, ...prev]
        saveOrder('monet:notebook-order', next)
        return next
      })
    }
    const childNotes = notes.filter((n) => n.subjectId === id)
    // Nota-corpo de task reatribuída a este subject volta ao subject "Tasks"
    // do destino, junto com a task.
    const taskByNoteId = new Map(tasks.flatMap((t) => (t.noteId ? [[t.noteId, t] as const] : [])))
    const moved: Note[] = []
    let failed = false
    try {
      for (const n of childNotes) {
        const task = taskByNoteId.get(n.id)
        if (task) {
          if (!(await relocateTask(task, destId))) failed = true
          continue
        }
        const next = { ...n, notebookId: destId, subjectId: null, updatedAt: Date.now() }
        await storage.saveNote(next)
        moved.push(next)
      }
    } catch (err) {
      console.error('failed to move subject notes', err)
      failed = true
    }
    // Leva ao state o que já foi gravado (useNotes.save engole erro, por isso
    // a gravação de verdade acima é feita direto no storage).
    await Promise.all(moved.map((n) => saveNote(n)))
    if (failed) {
      setSubjectConvertError('Failed to turn subject into notebook. The subject was kept.')
      return
    }
    setSubjectConvertError(null)
    await removeSubject(id)
    if (destId === sourceId) {
      if (activeSubjectId === id) setActiveSubjectId(null)
      return
    }
    setTasksViewOpen(false)
    setActiveNotebookId(destId)
    setActiveSubjectId(null)
    if (!childNotes.some((n) => n.id === activeId)) {
      const movedIds = new Set(moved.map((n) => n.id))
      const destNotes = [
        ...moved,
        ...notes.filter(
          (n) => n.notebookId === destId && !movedIds.has(n.id) && !isTaskBodyNote(n) && !n.archivedAt
        ),
      ]
      setActiveId(applyOrder(destNotes, noteOrder)[0]?.id ?? null)
    }
  }

  async function handleRenameSubject(id: string, name: string) {
    const subject = subjects.find((s) => s.id === id)
    if (!subject) return
    await saveSubject({ ...subject, name: name.trim() || subject.name, updatedAt: Date.now() })
  }

  function handleReorderSubjects(newOrder: string[]) {
    void reorderSubjects(newOrder)
  }

  // Nota diária do Calendar para `date` (criada se ainda não existir), sem
  // navegar até ela.
  const ensureCalendarNote = useCallback(
    async (date: Date): Promise<Note | null> => {
      if (!calendarNotebookId) return null
      const title = formatCalendarTitle(date)
      const existing = notes.find(
        (n) => n.notebookId === calendarNotebookId && n.title === title
      )
      if (existing) return existing
      const note = await createNote(calendarNotebookId)
      const filled: Note = { ...note, title, updatedAt: Date.now() }
      await saveNote(filled)
      setNoteOrder((prev) => {
        const next = [filled.id, ...prev]
        saveNoteOrder(next)
        return next
      })
      return filled
    },
    [calendarNotebookId, notes, createNote, saveNote]
  )

  const handleCalendarDayClick = useCallback(
    async (date: Date) => {
      if (!calendarNotebookId) return
      setActiveNotebookId(calendarNotebookId)
      const note = await ensureCalendarNote(date)
      if (note) setActiveId(note.id)
    },
    [calendarNotebookId, ensureCalendarNote]
  )

  // Weekly review: acrescenta o markdown ao fim da nota diária de hoje (nunca
  // sobrescreve). `askAi` acrescenta também uma linha `/week` e abre a nota
  // para o usuário executá-la com Enter — a IA nunca roda sozinha.
  const saveWeeklyReview = useCallback(
    async (markdown: string, askAi: boolean) => {
      const note = await ensureCalendarNote(new Date())
      if (!note || !calendarNotebookId) return
      // A keep salva a nota de hoje direto no banco sem passar pelo estado da
      // main: parte da versão mais recente entre o banco e o estado local.
      const local = notesRef.current.find((n) => n.id === note.id) ?? note
      const stored = await storage.getNote(note.id).catch(() => null)
      const current = stored && stored.updatedAt > local.updatedAt ? stored : local
      const block = askAi
        ? `${markdown}\n\n/week summarize what I completed and what slipped this week`
        : markdown
      const content = current.content.trim() ? `${current.content.trimEnd()}\n\n${block}` : block
      await saveNote({ ...current, content, updatedAt: Date.now() })
      // A keep recarrega a nota, senão o próximo autosave dela apagaria o review.
      void emit('calendar-note-updated', { noteId: note.id })
      if (askAi) {
        setTasksViewOpen(false)
        setActiveNotebookId(calendarNotebookId)
        setActiveId(note.id)
      }
    },
    [ensureCalendarNote, calendarNotebookId, saveNote]
  )

  const handleMergeNotes = useCallback(
    async (sourceId: string, targetId: string) => {
      const source = notes.find((n) => n.id === sourceId)
      const target = notes.find((n) => n.id === targetId)
      if (!source || !target) return
      const mergedContent = target.content
        ? target.content + '\n\n---\n\n' + source.content
        : source.content
      await saveNote({ ...target, content: mergedContent, updatedAt: Date.now() })
      // Tasks da TODOS de origem: passam para o destino se ele também é TODOS;
      // senão ficam sem TODOS.
      if (isTodosNote(target)) {
        const changes = tasks
          .filter((t) => t.parentNoteId === sourceId)
          .map((t) => ({ id: t.id, patch: { parentNoteId: targetId } }))
        if (changes.length > 0) await updateTasks(changes)
      } else {
        await detachTodosChildren(new Set([sourceId]))
      }
      await removeNote(sourceId)
      if (activeId === sourceId) setActiveId(targetId)
    },
    [notes, saveNote, removeNote, activeId, tasks, updateTasks, detachTodosChildren]
  )

  const handleAssignNoteToSubject = useCallback(
    async (noteId: string, subjectId: string | null) => {
      const note = notes.find((n) => n.id === noteId)
      if (!note) return
      await saveNote({ ...note, subjectId, updatedAt: Date.now() })
    },
    [notes, saveNote]
  )

  const handleMoveNote = useCallback(
    async (noteId: string, destNotebookId: string) => {
      const note = notes.find((n) => n.id === noteId)
      if (!note) return
      if (note.notebookId === destNotebookId) return
      await saveNote({ ...note, notebookId: destNotebookId, subjectId: null, updatedAt: Date.now() })
    },
    [notes, saveNote]
  )

  // Mover caderno inteiro: a origem vira um subject no destino (mesclando se
  // já houver subject com o mesmo nome), todas as notas da origem são
  // achatadas nesse subject e o caderno de origem deixa de existir. As notas
  // são re-salvas no destino ANTES do deleteNotebook, que cascade-deleta
  // notes/subjects da origem.
  const handleMoveNotebook = useCallback(
    async (sourceId: string, destId: string) => {
      if (sourceId === destId || sourceId === INBOX_NOTEBOOK_ID || sourceId === CALENDAR_NOTEBOOK_ID) return
      const source = notebooks.find((n) => n.id === sourceId)
      const dest = notebooks.find((n) => n.id === destId)
      if (!source || !dest) return
      const destSubjects = await storage.getSubjects(destId)
      let target = destSubjects.find((s) => s.name === source.name)
      if (!target) {
        const now = Date.now()
        const maxOrder = destSubjects.reduce((max, s) => Math.max(max, s.sortOrder), -1)
        target = {
          id: nanoid(),
          notebookId: destId,
          name: source.name,
          sortOrder: maxOrder + 1,
          createdAt: now,
          updatedAt: now,
        }
        await storage.saveSubject(target)
      }
      // Tasks (e notas-corpo) seguem para o subject "Tasks" do destino; só as
      // notas comuns são achatadas no subject com o nome da origem.
      const { movedNoteIds, ok } = await relocateNotebookTasks(sourceId, destId)
      if (!ok) return
      if (tasksFilter === sourceId) setTasksFilter(null)
      const childNotes = notes.filter((n) => n.notebookId === sourceId && !movedNoteIds.has(n.id))
      await Promise.all(
        childNotes.map((n) =>
          saveNote({ ...n, notebookId: destId, subjectId: target.id, updatedAt: Date.now() })
        )
      )
      // Documentos visíveis: o destino fica com a união das duas seleções
      // (lida antes do removeNotebook, que apaga a da origem). As pastas de
      // notas dos dois cadernos ficam de fora: são implícitas no destino.
      try {
        const [sourceVisible, destVisible] = await Promise.all([
          getNotebookVisibleDocumentIds(sourceId),
          getNotebookVisibleDocumentIds(destId),
        ])
        const implicit = new Set([notesFolderDocId(sourceId), notesFolderDocId(destId)])
        const union = [...new Set([...destVisible, ...sourceVisible])].filter((docId) => !implicit.has(docId))
        if (union.length !== destVisible.length) await replaceNotebookVisibility(destId, union)
      } catch (err) {
        console.error('failed to merge notebook document visibility', err)
      }
      if (!(await removeNotebook(sourceId))) return
      // A pasta de chat da origem vai para o destino (ver moveNotebookChatFolder).
      // Fundida numa pasta já existente, a pasta web dela é apagada: o
      // caminho dela no disco é o id da pasta de origem.
      const removedChatFolderId = moveNotebookChatFolder(sourceId, destId, dest.name)
      if (removedChatFolderId) {
        deleteChatWebFolder(removedChatFolderId).catch((err) =>
          console.error('failed to delete web sources folder', err)
        )
      }
      if (activeNotebookId === sourceId) {
        setActiveNotebookId(null)
        setActiveSubjectId(null)
        setActiveId(null)
      } else if (activeNotebookId === destId) {
        void refreshSubjects()
      }
      setNotebookOrder((prev) => {
        const next = prev.filter((x) => x !== sourceId)
        saveOrder('monet:notebook-order', next)
        return next
      })
    },
    [notebooks, notes, saveNote, removeNotebook, activeNotebookId, refreshSubjects, relocateNotebookTasks, tasksFilter]
  )

  const handleCreateNotebookFromChat = useCallback(
    async (name: string) => {
      const nb = await createNotebook(name)
      setNotebookOrder((prev) => {
        const next = [nb.id, ...prev.filter((x) => x !== nb.id)]
        saveOrder('monet:notebook-order', next)
        return next
      })
      return nb
    },
    [createNotebook]
  )

  const handleCreateNoteFromChat = useCallback(
    async (
      notebookId: string,
      title: string,
      content: string,
      // `requestId` continua no 4º lugar (é o que o "Save to note" do Chat
      // passa) e segue sem uso aqui; o `typeId` é o 5º para não colidir com ele.
      _requestId?: string,
      typeId?: string | null
    ) => {
      const note = await createNote(notebookId)
      const filled: Note = {
        ...note,
        title,
        content,
        updatedAt: Date.now(),
      }
      if (!(await saveNote(filled))) throw new Error('Failed to save note.')
      if (typeId) {
        // O tipo fica fora do UPSERT do saveNote (de propósito): grava depois.
        await setNoteType(filled.id, typeId)
      }
      setNoteOrder((prev) => {
        const next = [filled.id, ...prev.filter((x) => x !== filled.id)]
        saveNoteOrder(next)
        return next
      })
      return filled
    },
    [createNote, saveNote, setNoteType]
  )

  // "Save to note" da janela assistant (Ctrl+M): a main grava, para a lista e
  // a nota aberta no Editor refletirem a mudança. Só roda pelo clique do
  // usuário no modal da assistant.
  useEffect(
    () =>
      onAssistantNoteRequest(async (request) => {
        if (request.kind === 'create-notebook') {
          return { notebook: await handleCreateNotebookFromChat(request.name) }
        }
        if (request.kind === 'create-note') {
          return {
            note: await handleCreateNoteFromChat(request.notebookId, request.title, request.content),
          }
        }
        // Parte da versão mais recente entre o estado (inclui o que está sendo
        // digitado no Editor) e o banco (a keep grava direto nele).
        const local = notesRef.current.find((n) => n.id === request.noteId)
        const stored = await storage.getNote(request.noteId).catch(() => null)
        const current = stored && (!local || stored.updatedAt > local.updatedAt) ? stored : local
        if (!current) throw new Error('Note not found.')
        const note: Note = {
          ...current,
          content: appendToggleToContent(current.content, request.block),
          updatedAt: Date.now(),
        }
        if (!(await saveNote(note))) throw new Error('Failed to save note.')
        // A keep recarrega a nota se for a aberta nela, senão o autosave dela
        // apagaria o bloco.
        void emit('calendar-note-updated', { noteId: note.id })
        return { note }
      }),
    [handleCreateNotebookFromChat, handleCreateNoteFromChat, saveNote]
  )

  const handleOpenResponseInChat = useCallback((response: AiResponse) => {
    const linkedId = getLinkedChatConversationId(response.id)
    if (linkedId && chatConversationExists(linkedId)) {
      activateChatConversation(linkedId)
    } else {
      const cmd = response.command.trim()
      const q = response.query.trim()
      const fullCommand = q ? `${cmd} ${q}` : cmd
      const newId = createPreloadedChatConversation({
        title: fullCommand,
        userMessage: fullCommand,
        assistantMessage: response.response,
      })
      linkResponseToChatConversation(response.id, newId)
    }
    setActiveMode('chat')
  }, [])

  // ─── Chat das Anotações (aba Chat da coluna direita) ─────────────────────
  // Caderno do chat: o da nota aberta (também em "All Notes"); sem nota, o
  // caderno ativo. Sempre um caderno existente (ou null). As tasks do caderno
  // (abertas + concluídas na semana) entram no contexto efêmero, salvo se o
  // caderno estiver fora da IA.
  const chatNotebookId = activeNote?.notebookId ?? activeNotebookId
  const chatNotebook = useMemo(
    () => notebooks.find((n) => n.id === chatNotebookId) ?? null,
    [notebooks, chatNotebookId]
  )
  const chatProjectTasks = useMemo(
    () =>
      chatNotebookId === null || disabledNotebookIds.has(chatNotebookId)
        ? undefined
        : tasks
            .filter(
              (t) =>
                t.notebookId === chatNotebookId &&
                (isOpen(t) || summaryMatches('doneWeek', t, today))
            )
            .sort(compareTasks),
    [chatNotebookId, disabledNotebookIds, tasks, today]
  )

  const handleEditorReady = useCallback((editor: TiptapEditor | null) => {
    notesEditorRef.current = editor
    setHasEditor(!!editor)
  }, [])

  const getNotesSelectionText = useCallback(() => {
    const editor = notesEditorRef.current
    if (!editor || editor.isDestroyed) return ''
    const { from, to } = editor.state.selection
    return from !== to ? editor.state.doc.textBetween(from, to, '\n') : ''
  }, [])

  const handleAskAi = useCallback(
    (text: string) => {
      setAiOpen(true)
      setRightTab('chat')
      setPendingNotesQuote(text)
    },
    [setRightTab]
  )

  const handleNotesQuoteConsumed = useCallback(() => setPendingNotesQuote(null), [])

  // Abre a nota de uma marca e pede ao Editor a ação nela (`reveal` ou
  // `resolve`). A lista de marcas aberta fica: a navegação é dela.
  const requestMarkAction = useCallback(
    (note: Note, entry: NoteMarkEntry, action: 'reveal' | 'resolve') => {
      if (!note.notebookId) return
      if (marksViewOpen && (note.id !== activeId || note.notebookId !== activeNotebookId)) {
        keepSideViewRef.current = true
      }
      handleNavigateToNote(note.notebookId, note.id, note.subjectId)
      setSelectedMark({ noteId: note.id, index: entry.index })
      setPendingNoteReveal({
        noteId: note.id,
        index: entry.index,
        text: entry.text,
        nonce: ++revealSeqRef.current,
        action,
      })
    },
    [handleNavigateToNote, marksViewOpen, activeId, activeNotebookId]
  )

  const handleSelectMark = useCallback(
    (note: Note, entry: NoteMarkEntry) => requestMarkAction(note, entry, 'reveal'),
    [requestMarkAction]
  )

  const handleResolveMark = useCallback(
    (hit: NoteMarkHit) => requestMarkAction(hit.note, hit.entry, 'resolve'),
    [requestMarkAction]
  )

  const handleNoteRevealConsumed = useCallback(() => setPendingNoteReveal(null), [])

  const openMarksView = useCallback((filter: MarkLabelFilter) => {
    setTasksViewOpen(false)
    setMarksFilter(filter)
    setSideView({ kind: 'marks' })
  }, [])

  const openTagView = useCallback((tag: string) => {
    setTasksViewOpen(false)
    setSideView({ kind: 'tag', tag })
  }, [])

  const closeSideView = useCallback(() => setSideView(null), [])

  // Nota aberta pela lista de uma tag: a lista fica (a navegação é dela).
  const handleOpenTaggedNote = useCallback(
    (note: Note) => {
      if (!note.notebookId) return
      if (note.id !== activeId || note.notebookId !== activeNotebookId) keepSideViewRef.current = true
      handleNavigateToNote(note.notebookId, note.id, note.subjectId)
    },
    [handleNavigateToNote, activeId, activeNotebookId]
  )

  // "List" do menu da marca e Ctrl+clique numa marca: a lista no rótulo dela,
  // com a marca destacada.
  const handleShowMarkInList = useCallback(
    (index: number, label: string | null) => {
      openMarksView(label ? { label } : null)
      const note = activeNoteRef.current
      if (note) setSelectedMark({ noteId: note.id, index })
    },
    [openMarksView]
  )

  // Clique num `==texto==` da resposta do chat (R11): procura a marca nas
  // notas, arquivadas inclusive (a IA também as vê) — texto igual (sem caixa
  // nem acento) e, sem isso, uma citação parcial. Uma marca abre a nota nela;
  // zero ou várias passam pelo seletor (uma linha por nota).
  const handleOpenMark = useCallback(
    (text: string) => {
      const wanted = normalizeSearch(text.replace(/\s+/g, ' ').trim())
      if (!wanted) return
      const hits = collectNoteMarks(notesRef.current, { includeArchived: true })
      let matches = hits.filter((h) => normalizeSearch(h.entry.text) === wanted)
      if (matches.length === 0 && wanted.length >= 4) {
        matches = hits.filter((h) => {
          const t = normalizeSearch(h.entry.text)
          return t.includes(wanted) || (t.length >= 4 && wanted.includes(t))
        })
      }
      const seen = new Set<string>()
      matches = matches.filter((h) => !seen.has(h.note.id) && !!seen.add(h.note.id))
      if (matches.length === 1) {
        handleSelectMark(matches[0].note, matches[0].entry)
        return
      }
      setMarkPicker({ text, hits: matches })
    },
    [handleSelectMark]
  )
  openMarkRef.current = handleOpenMark

  // Insere conteúdo do chat na nota (o tiptap-markdown converte o markdown
  // no insertContentAt). Linhas que começam com "/" ganham um zero-width space
  // na frente para não virarem slash command (fora de blocos de código).
  // Bloco de código entra como fence (sem o prefixo: o slash command só olha
  // parágrafos). Seleção da resposta chega como HTML e vira markdown pelo
  // serializer do editor; se falhar, vai como texto simples. Uma lista
  // inserida no fim de um item de lista do mesmo tipo continua essa lista.
  const handleInsertIntoNote = useCallback(
    (content: NoteInsert, where: 'cursor' | 'end') => {
      const editor = notesEditorRef.current
      if (!editor || editor.isDestroyed) return
      const md = (
        editor.storage as unknown as {
          markdown: {
            parser: { parse(markdown: string): string }
            serializer: { serialize(node: ProseMirrorNode): string }
          }
        }
      ).markdown
      let markdown: string
      if ('code' in content) {
        markdown = codeFence(content.code, content.language)
      } else {
        // A citação `==texto==` da IA vira texto simples: a IA não cria marcas.
        let source = stripMarkCitations('html' in content ? content.text : content.markdown)
        if ('html' in content) {
          try {
            const doc = createNodeFromContent(content.html, editor.schema, { slice: false })
            const out = doc instanceof ProseMirrorNode ? md.serializer.serialize(doc).trim() : ''
            if (out) source = out
          } catch {
            // texto simples
          }
        }
        let inFence = false
        markdown = source
          .split('\n')
          .map((line) => {
            if (/^\s*(```|~~~)/.test(line)) {
              inFence = !inFence
              return line
            }
            if (inFence || !isPotentialCommandLine(line)) return line
            return line.replace(/^(\s*)\//, '$1​/')
          })
          .join('\n')
        if (insertAsListContinuation(editor, md.parser.parse(markdown), where)) return
      }
      const pos = where === 'end' ? editor.state.doc.content.size : editor.state.selection.to
      editor.chain().focus().insertContentAt(pos, markdown).run()
    },
    []
  )

  const canInsertIntoNote = !!activeNote && hasEditor && !previewMode

  const handleCompleteOnboarding = useCallback(() => {
    localStorage.setItem('onboarding_completed', '1')
    setOnboardingActive(false)
  }, [])

  const handleSkipOnboarding = useCallback(() => {
    setOnboardingActive(false)
  }, [])

  const handleOpenSettings = useCallback(() => {
    if (onboardingActive) return
    setSettingsOpen(true)
  }, [onboardingActive])

  const handleNotebookReorder = useCallback((newOrder: string[]) => {
    setNotebookOrder(newOrder)
    saveOrder('monet:notebook-order', newOrder)
  }, [])

  const handleReorder = useCallback((newVisibleOrder: string[]) => {
    setNoteOrder((prev) => {
      const next = mergeOrder(prev, newVisibleOrder)
      saveNoteOrder(next)
      return next
    })
  }, [])

  // ─── Migração group → TODOS (D7) ─────────────────────────────────────────
  // Só nesta janela (main), uma vez por sessão e com tudo carregado: lê o
  // `task_group` dormente e abre o dry-run se houver o que migrar, fora das
  // linhas já resolvidas (registro no banco, que acompanha o DB). Nada é
  // gravado sem "Migrate"; o registro só é gravado depois de sucesso. "Later"
  // fecha nesta sessão.
  const [todosMigration, setTodosMigration] = useState<{
    rows: MigrationRow[]
    status: 'idle' | 'running' | 'done' | 'error'
    message: string | null
  } | null>(null)
  const todosMigrationCheckedRef = useRef(false)
  // Nova tentativa da checagem depois de uma falha na leitura (1, 2, 4 e 8 s).
  const [todosMigrationRetry, setTodosMigrationRetry] = useState(0)
  const todosTypeLoaded = noteTypes.types.some((t) => t.id === TODOS_TYPE_ID)
  useEffect(() => {
    if (todosMigrationCheckedRef.current) return
    if (!notesLoaded || !tasksLoaded || !notebooksLoaded || !todosTypeLoaded) return
    if (notesLoadFailed || tasksLoadFailed || notebooksLoadFailed) return
    todosMigrationCheckedRef.current = true
    void (async () => {
      try {
        const legacy = await storage.getLegacyTaskGroups()
        if (legacy.length === 0) return
        const done = new Set(await storage.getTodosMigrationDone())
        const rows = planTodosMigration(legacy, tasks, notesRef.current, notebooksRef.current).filter(
          (r) => !done.has(r.noteId)
        )
        if (rows.length > 0) setTodosMigration({ rows, status: 'idle', message: null })
      } catch (err) {
        // Lock transitório do cold start: reavalia na próxima mudança ou na
        // nova tentativa agendada.
        todosMigrationCheckedRef.current = false
        console.error('failed to read task groups', err)
        if (todosMigrationRetry < 4) {
          setTimeout(() => setTodosMigrationRetry((n) => n + 1), 1000 * 2 ** todosMigrationRetry)
        }
      }
    })()
  }, [notesLoaded, tasksLoaded, notebooksLoaded, todosTypeLoaded, notesLoadFailed, tasksLoadFailed, notebooksLoadFailed, tasks, todosMigrationRetry])

  // Execução, sem BEGIN/COMMIT e idempotente, por linha marcada: nota (nova,
  // com id determinístico, ou existente recebendo só as pills que faltam) →
  // tipo TODOS → um único updateTasks sobre o estado relido do banco, só nas
  // tasks ainda sem TODOS (um saveTask de estado defasado não desfaz o vínculo).
  // No fim, marcadas e desmarcadas ficam registradas no banco e não voltam.
  async function runTodosMigration(rows: MigrationRow[], skipped: MigrationRow[]) {
    setTodosMigration((m) => m && { ...m, status: 'running', message: null })
    let created = 0
    let linked = 0
    try {
      const fresh = await reloadTasks()
      if (!fresh) throw new Error('failed to load tasks')
      const byId = new Map(fresh.map((t) => [t.id, t]))
      for (const row of rows) {
        const rowTasks = row.taskIds
          .map((id) => byId.get(id))
          .filter((t): t is Task => !!t && t.parentNoteId === null)
        const stored = await storage.getNote(row.noteId)
        if (!stored) {
          if (rowTasks.length === 0) continue
          const now = Date.now()
          const note: Note = {
            id: row.noteId,
            notebookId: row.notebookId,
            subjectId: null,
            title: row.title,
            content: buildTodosContent(todosTemplate, rowTasks),
            tags: [],
            date: null,
            createdAt: now,
            updatedAt: now,
          }
          if (!(await saveNote(note))) throw new Error('failed to save note')
          setNoteOrder((prev) => {
            if (prev.includes(note.id)) return prev
            const next = [note.id, ...prev]
            saveNoteOrder(next)
            return next
          })
          created++
        } else {
          const local = notesRef.current.find((n) => n.id === row.noteId)
          const current = local && local.updatedAt >= stored.updatedAt ? local : stored
          const missing = missingPillLines(current.content, rowTasks)
          if (missing.length > 0) {
            const body = current.content.trimEnd()
            const content = `${body ? `${body}\n\n` : ''}## Tasks (migrated)\n\n${missing.join('\n')}`
            if (!(await saveNote({ ...current, content, updatedAt: Date.now() }))) throw new Error('failed to save note')
          }
        }
        if (!(await setNoteType(row.noteId, TODOS_TYPE_ID))) throw new Error('failed to set note type')
        if (rowTasks.length === 0) continue
        const ok = await updateTasks(
          rowTasks.map((t) => ({
            id: t.id,
            patch:
              t.sourceNoteId === null
                ? { parentNoteId: row.noteId, sourceNoteId: row.noteId }
                : { parentNoteId: row.noteId },
          }))
        )
        if (!ok) throw new Error('failed to save tasks')
        linked += rowTasks.length
      }
      await storage.markTodosMigrationDone([...rows, ...skipped].map((r) => r.noteId))
      setTodosMigration(
        (m) =>
          m && {
            ...m,
            status: 'done',
            message: `${created} TODOS created, ${linked} task${linked === 1 ? '' : 's'} linked.`,
          }
      )
    } catch (err) {
      console.error('TODOS migration failed', err)
      setTodosMigration(
        (m) =>
          m && {
            ...m,
            status: 'error',
            message: `Migration stopped (${err instanceof Error ? err.message : String(err)}). Nothing was lost: run it again to finish, it does not duplicate.`,
          }
      )
    }
  }

  const currentViewConfig = useMemo<TaskViewConfig>(
    () => ({
      base: tasksMainView,
      project: tasksFilter,
      summary: tasksSummaryFilter,
      text: tasksSearch,
      groupBy: tasksGroupBy,
    }),
    [tasksMainView, tasksFilter, tasksSummaryFilter, tasksSearch, tasksGroupBy]
  )
  // Visão salva "ativa" = a que coincide com o estado atual dos filtros.
  const activeSavedViewId =
    savedViews.find(
      (v) =>
        v.config.base === currentViewConfig.base &&
        v.config.project === currentViewConfig.project &&
        v.config.summary === currentViewConfig.summary &&
        v.config.text === currentViewConfig.text &&
        v.config.groupBy === currentViewConfig.groupBy
    )?.id ?? null

  function resetTasksView() {
    setTasksMainView('list')
    setTasksFilter(null)
    setTasksSummaryFilter(null)
    setTasksSearch('')
  }

  const tasksEnv: TasksEnv = {
    statuses: statusRegistry,
    onManageStatuses: () => setStatusManagerOpen(true),
    metadataDefs: metadata.defs,
    savedViews,
    currentViewConfig,
    activeSavedViewId,
    onApplyView: (view) => {
      const { base, project, summary, text, groupBy } = view.config
      setTasksMainView(base)
      // Projeto/filtros removidos desde que a visão foi salva são ignorados.
      setTasksFilter(project !== null && notebooks.some((nb) => nb.id === project) ? project : null)
      setTasksSummaryFilter(
        TASK_SUMMARY_KEYS.includes(summary as TaskSummaryKey) ? (summary as TaskSummaryKey) : null
      )
      setTasksSearch(text)
      if (groupBy === 'date' || groupBy === 'project' || groupBy === 'status' || groupBy === 'todos') setTasksGroupBy(groupBy)
    },
    onSaveView: (name) => void createSavedView(name, currentViewConfig),
    onRenameView: (id, name) => void renameSavedView(id, name),
    onDeleteView: (id) => {
      if (id === activeSavedViewId) resetTasksView()
      void removeSavedView(id)
    },
    search: tasksSearch,
    onSearchChange: setTasksSearch,
    onMoveTaskToProject: (taskId, notebookId) => void moveProjectTask(taskId, { notebookId }),
    onSetProjectColor: (notebookId, color) => void setNotebookColor(notebookId, color),
    todosById,
    onOpenNote: handleNoteLinkNavigation,
    onCreateTodos: createTodosNote,
  }

  // Props comuns das visões em colunas (Kanban, Projects, TODOS, Today).
  const boardProps = {
    tasks,
    notebooks: orderedNotebooks,
    todayKey: today,
    mainView: tasksMainView,
    onMainViewChange: setTasksMainView,
    filter: tasksFilter,
    onFilterChange: setTasksFilter,
    onSummaryFilterChange: (key: TaskSummaryKey | null) => {
      setTasksSummaryFilter(key)
      setTasksMainView('list')
    },
    onCreateTask: async (draft: NewTaskDraft) => {
      await createNewTask(draft)
    },
    onOpenTask: openTaskModal,
    onToggleTask: handleToggleLinkedTask,
    onUpdateTasks: (changes: TaskChanges) => void updateTasks(changes),
    onConvertPipeTitles: (list: Task[]) => void convertPipeTitles(list),
    onDeleteTasks: (ids: string[]) => void deleteProjectTasks(ids),
    checklist: taskChecklist,
  }

  // Editor da nota aberta: no slot ao lado da List ou, nas visões em quadro,
  // dentro do modal da task (TaskEditorModal).
  const noteEditor = activeNote ? (
    <RemindersProvider value={remindersContextValue}>
    <TasksProvider value={tasksContextValue}>
    <Editor
      key={activeNote.id}
      notebookName={notebooks.find((nb) => nb.id === activeNote.notebookId)?.name}
      subjectName={effectiveSubjects.find(s => s.id === activeNote.subjectId)?.name}
      title={activeNote.title}
      onTitleChange={(title) => {
        updateActive({ title })
        // Título único: a nota-corpo dá o título da task.
        if (activeTask && title.trim()) void updateTask(activeTask.id, { title: title.trim() })
      }}
      tags={activeNote.tags}
      onTagsChange={(tags) => updateActive({ tags })}
      date={activeNote.date}
      onDateChange={activeTask ? undefined : (date) => updateActive({ date })}
      value={activeNote.content}
      onChange={(content) => updateActive({ content })}
      onCommand={handleCommand}
      executedCommandTexts={executedCommandTexts}
      responses={responses}
      onRemoveResponse={(id) => {
        removeResponse(id)
        unlinkResponseFromChat(id)
      }}
      notebookNotes={
        activeNote.notebookId === calendarNotebookId
          ? notes.filter((n) => n.id !== activeId)
          : activeTask
            ? notes.filter((n) => n.notebookId === activeTask.notebookId && n.id !== activeId)
            : notebookNotes.filter((n) => n.id !== activeId)
      }
      onNavigateToNote={handleNoteLinkNavigation}
      relatedContent={
        activeNote.notebookId !== calendarNotebookId
          ? <RelatedContent key={activeNote.id} activeNote={activeNote} notes={notes} notebooks={notebooks} onSelect={setActiveId} />
          : undefined
      }
      isCalendarNote={activeNote.notebookId === calendarNotebookId}
      previewMode={previewMode}
      focusMode={focusMode}
      onAskAi={handleAskAi}
      onEditorReady={handleEditorReady}
      revealRequest={
        activeNote.id === pendingNoteReveal?.noteId ? pendingNoteReveal : null
      }
      onRevealConsumed={handleNoteRevealConsumed}
      onShowMarkInList={handleShowMarkInList}
      markLabels={markLabels}
      tagSuggestions={allTags}
      onOpenTag={openTagView}
      taskStatuses={taskStatuses}
      taskNotebooks={orderedNotebooks}
      suggestedTaskNotebookId={
        activeNote.notebookId && activeNote.notebookId !== calendarNotebookId
          ? activeNote.notebookId
          : INBOX_NOTEBOOK_ID
      }
      // Antes de as tasks carregarem, um item vinculado pareceria
      // "stale" e geraria task duplicada: "Add to Tasks" fica oculto.
      onCreateTasks={tasksLoaded ? (inputs, opts) =>
        createProjectTasks(
          inputs.map((i) => ({
            title: i.title,
            status: i.checked ? 'done' : 'todo',
            dueDate: opts.dueDate,
            sourceNoteId: activeNote.id,
            // Numa TODOS, a task nasce vinculada a ela (§5.2).
            parentNoteId: isTodosNote(activeNote) ? activeNote.id : null,
          })),
          opts.project
        ) : undefined
      }
      onToggleLinkedTask={handleToggleLinkedTask}
      // Com tipo, o controle do tipo fica na barra de propriedades; aqui o selo
      // "Archived" e o "+ type" da nota sem tipo.
      tagsRowSlot={(activeArchived && !activeTask) || (canTypeActive && !activeNoteType) ? (
        <>
          {activeArchived && !activeTask && (
            <ArchivedBadge onUnarchive={() => void handleSetArchived(activeNote.id, false)} />
          )}
          {canTypeActive && !activeNoteType && (
            <NoteTypePicker
              types={noteTypes.types}
              type={null}
              onChange={(typeId) => void handleSetNoteType(typeId)}
              onManage={() => setNoteTypesOpen({ focusTypeId: null })}
              archived={activeArchived}
              onSetArchived={(archived) => void handleSetArchived(activeNote.id, archived)}
            />
          )}
        </>
      ) : undefined}
      topSlot={activeTask ? (
        <TaskPropertiesBar
          task={activeTask}
          notebooks={orderedNotebooks}
          statuses={statusRegistry}
          todosOptions={todosOptions}
          onOpenTodos={handleNoteLinkNavigation}
          onCreateTodos={createTodosNote}
          sourceNoteExists={
            activeTask.sourceNoteId !== null && notes.some((n) => n.id === activeTask.sourceNoteId)
          }
          onUpdate={(patch) => void updateTask(activeTask.id, patch)}
          onMove={(project) => void moveProjectTask(activeTask.id, project)}
          onOpenSourceNote={() => {
            if (activeTask.sourceNoteId) handleNoteLinkNavigation(activeTask.sourceNoteId)
          }}
          onDelete={() => void deleteProjectTasks([activeTask.id])}
          metadataDefs={metadata.defs}
          onCreateMetadataDef={metadata.create}
          onManageMetadata={(focusId) => setMetadataManager({ focusId: focusId ?? null })}
        />
      ) : activeCalendarDay ? (
        <DueTodayBlock
          tasks={tasks}
          dayKey={activeCalendarDay}
          todayKey={today}
          onOpenTask={openTask}
        />
      ) : activeNoteType ? (
        <>
          <NotePropertiesBar
            type={activeNoteType}
            typeControl={
              <NoteTypePicker
                types={noteTypes.types}
                type={activeNoteType}
                onChange={(typeId) => void handleSetNoteType(typeId)}
                onManage={() => setNoteTypesOpen({ focusTypeId: null })}
                onEditType={() => setNoteTypesOpen({ focusTypeId: activeNoteType.id })}
                archived={activeArchived}
                onSetArchived={(archived) => void handleSetArchived(activeNote.id, archived)}
              />
            }
            defs={typeDefs(noteTypes.defs, activeNoteType.id)}
            properties={activeNote.properties ?? {}}
            onChange={handleNotePropertyChange}
            onInsertTemplate={handleInsertTemplate}
          />
          {activeNoteType.id === TODOS_TYPE_ID && (
            <TodosPanel
              progress={todosProgress.get(activeNote.id)}
              outside={todosOutside}
              statuses={statusRegistry}
              onOpenTask={openTask}
              onInsert={handleInsertTodosTask}
              onArchive={activeArchived ? undefined : () => void handleSetArchived(activeNote.id, true)}
            />
          )}
        </>
      ) : null}
    />
    </TasksProvider>
    </RemindersProvider>
  ) : null

  return (
    <TasksEnvProvider value={tasksEnv}>
    <div className="app">
      <Toolbar
        activeMode={activeMode}
        onSetMode={handleSetMode}
        search={search}
        onSearchChange={setSearch}
        onExport={handleExport}
        hasNote={!!activeNote}
        exportSuccess={exportSuccess}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((v) => !v)}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((v) => !v)}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode((v) => !v)}
      />
      {(noteSaveError || notebookSaveError || subjectSaveError || tasksSaveError || statusSaveError || metadata.saveError || noteTypes.saveError || taskCreateError || subjectConvertError) && (
        <div className="saveErrorBanner" role="alert">
          {noteSaveError || notebookSaveError || subjectSaveError || tasksSaveError || statusSaveError || metadata.saveError || noteTypes.saveError || taskCreateError || subjectConvertError}
        </div>
      )}
      {activeMode === 'library' ? (
        <div className="workspace">
          <Library
            notebooks={orderedNotebooks}
            notes={notes}
            noteTypes={noteTypes.types}
            onCreateNotebook={handleCreateNotebookFromChat}
            onCreateNote={handleCreateNoteFromChat}
            onSaveNote={async (note) => {
              await saveNote(note)
            }}
          />
        </div>
      ) : activeMode === 'chat' ? (
        <div className="workspace">
          <ChatPanel
            models={models}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            onOpenSettings={handleOpenSettings}
            notebooks={orderedNotebooks}
            notes={notes}
            onCreateNotebook={handleCreateNotebookFromChat}
            onCreateNote={handleCreateNoteFromChat}
            onSaveNote={async (note) => {
              await saveNote(note)
            }}
            onNavigateToNote={handleNavigateToNote}
            tasks={tasks}
            todayKey={today}
            taskChecklist={taskChecklist}
            disabledNotebookIds={disabledNotebookIds}
            onOpenMark={handleOpenMark}
          />
        </div>
      ) : (
      <div className="workspace">
        {!focusMode && <NotebookList
          notebooks={orderedNotebooks}
          activeId={activeNotebookId}
          onSelect={(id) => {
            setTasksViewOpen(false)
            setSideView(null)
            setActiveSubjectId(null)
            if (id === calendarNotebookId) {
              void handleCalendarDayClick(new Date())
            } else {
              setActiveNotebookId(id)
              const notebookNotes = applyOrder(
                notes.filter((n) => n.notebookId === id && !isTaskBodyNote(n) && !n.archivedAt),
                noteOrder
              )
              setActiveId(notebookNotes[0]?.id ?? null)
            }
          }}
          onCreate={handleCreateNotebook}
          onDelete={handleDeleteNotebook}
          onMoveNotebook={handleMoveNotebook}
          onRename={handleRenameNotebook}
          onOpenDocuments={(id) => {
            setActiveNotebookId(id)
            setDocumentsModalNotebookId(id)
          }}
          onOpenKnowledgeBase={() => setKbOpen(true)}
          notebooksWithDocs={notebooksWithDocs}
          tags={tagSummary}
          activeTag={tagViewTag}
          onOpenTag={openTagView}
          onCloseTags={closeSideView}
          markSummary={markSummary}
          marksActive={marksViewOpen}
          marksFilter={marksFilter}
          onOpenMarks={openMarksView}
          onCloseMarks={closeSideView}
          onOpenSettings={handleOpenSettings}
          calendarNotebookId={calendarNotebookId}
          tasksActive={tasksViewOpen}
          taskProgress={taskProgress}
          onOpenTasks={() => {
            setTasksFilter(null)
            setTasksSummaryFilter(null)
            setTasksViewOpen(true)
          }}
          width={effectiveNotebookWidth}
          collapsed={notebookCollapsed}
          onToggleCollapsed={() => setNotebookCollapsed((v) => !v)}
          onWidthChange={setNotebookWidth}
          onReorder={handleNotebookReorder}
          subjects={subjects}
          activeSubjectId={tasksViewOpen && tasksFilter ? tasksSubjectId(tasksFilter) : activeSubjectId}
          onSelectSubject={handleSelectSubject}
          onCreateSubject={handleCreateSubject}
          onDeleteSubject={handleDeleteSubject}
          onTurnSubjectIntoNotebook={handleTurnSubjectIntoNotebook}
          onRenameSubject={handleRenameSubject}
          onReorderSubjects={handleReorderSubjects}
        />}
        {tasksBoardOpen && tasksMainView === 'review' ? (
          <WeeklyReview
            tasks={tasks}
            notebooks={orderedNotebooks}
            todayKey={today}
            mainView={tasksMainView}
            onMainViewChange={setTasksMainView}
            filter={tasksFilter}
            onFilterChange={setTasksFilter}
            onSummaryFilterChange={(key) => {
              setTasksSummaryFilter(key)
              setTasksMainView('list')
            }}
            onCreateTask={async (draft) => {
              await createNewTask(draft)
            }}
            onConvertPipeTitles={(list) => void convertPipeTitles(list)}
            onOpenTask={openTaskModal}
            onToggleTask={handleToggleLinkedTask}
            onUpdateTasks={(changes) => void updateTasks(changes)}
            checklist={taskChecklist}
            onSaveReview={saveWeeklyReview}
          />
        ) : tasksBoardOpen && tasksMainView === 'kanban' ? (
          <KanbanBoard {...boardProps} />
        ) : tasksBoardOpen && tasksMainView === 'projects' ? (
          <ProjectsBoard {...boardProps} />
        ) : tasksBoardOpen && tasksMainView === 'todos' ? (
          <TodosBoard {...boardProps} />
        ) : tasksBoardOpen && tasksMainView === 'plan' ? (
          <TodayBoard {...boardProps} />
        ) : tasksBoardOpen ? (
          <WeekBoard
            tasks={tasks}
            notebooks={orderedNotebooks}
            todayKey={today}
            mainView={tasksMainView}
            onMainViewChange={setTasksMainView}
            filter={tasksFilter}
            onFilterChange={setTasksFilter}
            onSummaryFilterChange={(key) => {
              setTasksSummaryFilter(key)
              setTasksMainView('list')
            }}
            onCreateTask={async (draft) => {
              await createNewTask(draft)
            }}
            onOpenTask={openTaskModal}
            onToggleTask={handleToggleLinkedTask}
            onSchedule={(id, scheduledDate) => void updateTask(id, { scheduledDate })}
            onUpdateTasks={(changes) => void updateTasks(changes)}
            onConvertPipeTitles={(list) => void convertPipeTitles(list)}
            onDeleteTasks={(ids) => void deleteProjectTasks(ids)}
            checklist={taskChecklist}
          />
        ) : !focusMode && (tasksViewOpen ? (
          <TasksView
            tasks={tasks}
            notebooks={orderedNotebooks}
            todayKey={today}
            mainView={tasksMainView}
            onMainViewChange={setTasksMainView}
            width={columnWidth}
            wide={notebookCollapsed}
            onWidthChange={setColumnWidth}
            filter={tasksFilter}
            onFilterChange={setTasksFilter}
            summaryFilter={tasksSummaryFilter}
            onSummaryFilterChange={setTasksSummaryFilter}
            groupBy={tasksGroupBy}
            onGroupByChange={setTasksGroupBy}
            onConvertPipeTitles={(list) => void convertPipeTitles(list)}
            selectedTaskId={activeTask?.id ?? null}
            onSelectTask={(task) => void selectTask(task)}
            onCreateTask={async (draft) => {
              const task = await createNewTask(draft)
              if (task?.noteId) showTaskNote(task.noteId)
            }}
            onToggleTask={handleToggleLinkedTask}
            onUpdateTasks={(changes) => void updateTasks(changes)}
            onDeleteTasks={(ids) => void deleteProjectTasks(ids)}
            checklist={taskChecklist}
          />
        ) : marksViewOpen ? (
          <MarksView
            hits={allMarkHits}
            summary={markSummary}
            notebooks={orderedNotebooks}
            filter={marksFilter}
            onFilterChange={setMarksFilter}
            selected={selectedMark}
            onSelect={(hit) => handleSelectMark(hit.note, hit.entry)}
            onResolve={handleResolveMark}
            onClose={closeSideView}
            width={effectiveSidebarWidth}
            wide={notebookCollapsed}
            onWidthChange={setColumnWidth}
          />
        ) : tagViewTag !== null ? (
          <TagView
            notes={notes}
            notebooks={orderedNotebooks}
            noteTypes={noteTypes.types}
            tags={tagSummary}
            tag={tagViewTag}
            onSelectTag={openTagView}
            activeNoteId={activeId}
            onOpenNote={handleOpenTaggedNote}
            onClose={closeSideView}
            width={effectiveSidebarWidth}
            wide={notebookCollapsed}
            onWidthChange={setColumnWidth}
          />
        ) : activeNotebookId === calendarNotebookId ? (
          <CalendarView
            notes={notes.filter((n) => n.notebookId === calendarNotebookId)}
            datedNotes={notes.filter((n) => !!n.date)}
            notebooks={notebooks}
            recentlyActiveNotes={notes.filter((n) => !isTaskBodyNote(n))}
            onDayClick={handleCalendarDayClick}
            onNoteClick={(noteId) => {
              const note = notes.find((n) => n.id === noteId)
              if (!note) return
              if (note.notebookId) setActiveNotebookId(note.notebookId)
              setActiveId(noteId)
            }}
            width={effectiveSidebarWidth}
            wide={notebookCollapsed}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
            onWidthChange={setColumnWidth}
            tasks={tasks}
            todayKey={today}
            onToggleTaskDone={handleToggleLinkedTask}
            onCreateTask={(scheduledDate, title, project) =>
              void createProjectTasks([{ title, scheduledDate }], project).then(([task]) => {
                if (task?.noteId) setActiveId(task.noteId)
              })
            }
            onOpenTask={openTask}
          />
        ) : (
          <Sidebar
            notes={visibleNotes}
            archivedNotes={archivedNotes}
            onSetArchived={(id, archived) => void handleSetArchived(id, archived)}
            activeId={activeId}
            notebookSelected={activeNotebookId !== null}
            onSelect={setActiveId}
            onCreate={() => void handleCreateNote()}
            noteTypes={noteTypes.types}
            // Subject "Tasks": as notas são notas-corpo, sem tipo (D4).
            onCreateTyped={
              activeNotebookId && activeSubjectId === tasksSubjectId(activeNotebookId)
                ? undefined
                : (typeId) => void handleCreateNote(typeId)
            }
            noteDefs={noteTypes.defs}
            todosProgress={todosProgress}
            todosTaskCount={todosTaskCount}
            typeFilterOptions={typeFilterOptions}
            typeFilter={activeTypeFilter}
            onTypeFilterChange={setNoteTypeFilter}
            sort={noteSort}
            onSortChange={setNoteSort}
            onReorderTypes={() => setNoteTypesOpen({ focusTypeId: null, reorder: true })}
            onDelete={handleDeleteNote}
            onReorder={handleReorder}
            onMerge={handleMergeNotes}
            notebooks={orderedNotebooks}
            onMoveNote={handleMoveNote}
            width={effectiveSidebarWidth}
            wide={notebookCollapsed}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
            onWidthChange={setColumnWidth}
            subjects={effectiveSubjects.filter((s) => !isTasksSubject(s))}
            onAssignSubject={handleAssignNoteToSubject}
            tasksSection={activeNotebookId !== null && tasksLoaded ? (
              <NotebookTasksSection
                notebookId={activeNotebookId}
                tasks={tasks}
                notebooks={orderedNotebooks}
                todayKey={today}
                checklist={taskChecklist}
                onOpenTask={(task) => void selectTask(task)}
                onToggleTask={handleToggleLinkedTask}
                onCreateTask={async (draft) => {
                  await createNewTask(draft)
                }}
                onShowAll={() => openNotebookTasks(activeNotebookId)}
                defaultTodosNoteId={
                  isTodosNote(activeNote) && activeNote?.notebookId === activeNotebookId ? activeNote.id : null
                }
              />
            ) : undefined}
          />
        ))}
        {tasksBoardOpen ? null : noteEditor ?? (
          <EmptyEditor
            hasNotebook={activeNotebookId !== null}
            onCreate={() => void handleCreateNote()}
          />
        )}
        <AiPanel
          open={aiOpen}
          noteId={activeId}
          responses={responses}
          hasApiKey={hasApiKey}
          apiKeyChecked={apiKeyChecked}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          models={models}
          modelId={modelId}
          onModelChange={setModelId}
          onOpenSettings={handleOpenSettings}
          navigateToCard={null}
          onDeleteResponse={(id) => {
            removeResponse(id)
            unlinkResponseFromChat(id)
          }}
          onOpenInChat={handleOpenResponseInChat}
          activeTab={rightTab}
          onTabChange={setRightTab}
          chatPanel={
            <NotesChatPanel
              notebook={chatNotebook}
              activeNote={activeNote}
              projectTasks={chatProjectTasks}
              todayKey={today}
              taskChecklist={taskChecklist}
              resolveNoteTitle={resolveAiNoteTitle}
              isNoteArchived={isNoteArchived}
              resolveNoteContent={resolveAiNoteContent}
              tasks={tasks}
              notebooks={orderedNotebooks}
              getSelectionText={getNotesSelectionText}
              visible={aiOpen && rightTab === 'chat'}
              pendingQuote={pendingNotesQuote}
              onPendingQuoteConsumed={handleNotesQuoteConsumed}
              canInsert={canInsertIntoNote}
              onInsertIntoNote={handleInsertIntoNote}
              onOpenMark={handleOpenMark}
            />
          }
        />
      </div>
      )}
      <SettingsModal
        open={settingsOpen && !onboardingActive}
        onClose={() => setSettingsOpen(false)}
        onApiKeyChanged={handleApiKeyChanged}
        onUpdateFound={handleUpdateFound}
      />
      {updateDialog && (
        <UpdaterDialog
          update={updateDialog.update}
          mandatory={updateDialog.mandatory}
          autoStart={updateDialog.autoStart}
          onLater={() => {}}
          onSkip={(version) => setSkippedVersion(version)}
          onClose={() => setUpdateDialog(null)}
        />
      )}
      <DocumentsModal
        open={documentsModalNotebookId !== null}
        notebookId={documentsModalNotebookId}
        notebookName={
          notebooks.find((n) => n.id === documentsModalNotebookId)?.name ?? ''
        }
        onClose={() => { setDocumentsModalNotebookId(null); void refreshNotebooksWithDocs() }}
        onOpenKnowledgeBase={() => { setDocumentsModalNotebookId(null); setKbOpen(true) }}
        notesIndexEnabled={
          documentsModalNotebookId !== null && !disabledNotebookIds.has(documentsModalNotebookId)
        }
        onToggleNotesIndex={async (enabled) => {
          if (documentsModalNotebookId) await setNotebookIndexEnabled(documentsModalNotebookId, enabled)
        }}
      />
      <KnowledgeBaseModal open={kbOpen} onClose={() => setKbOpen(false)} />
      {onboardingActive && (
        <Onboarding
          onComplete={handleCompleteOnboarding}
          onSkip={handleSkipOnboarding}
          onApiKeyChanged={handleApiKeyChanged}
        />
      )}
      <SearchPalette
        open={searchPaletteOpen}
        onClose={() => setSearchPaletteOpen(false)}
        onSelectNote={(notebookId, noteId, subjectId) => {
          handleNavigateToNote(notebookId, noteId, subjectId)
          setSearchPaletteOpen(false)
        }}
        onSelectMark={handleSelectMark}
        onSelectNotebook={(notebookId) => {
          setActiveMode('notebook')
          setActiveNotebookId(notebookId)
          setActiveSubjectId(null)
          setActiveId(null)
          setSearch('')
          setSearchPaletteOpen(false)
        }}
        onSelectTask={(taskId) => {
          openTask(taskId)
          setSearchPaletteOpen(false)
        }}
        notebooks={notebooks}
        notes={notes}
        noteTypes={noteTypes.types}
        tags={allTags}
        markLabels={markLabels}
        tasks={tasks}
        todosById={todosById}
        statuses={statusRegistry}
        hasApiKey={hasApiKey}
        disabledNotebookIds={disabledNotebookIds}
      />
      <MarkNotePicker
        open={markPicker !== null}
        text={markPicker?.text ?? ''}
        hits={markPicker?.hits ?? []}
        notebooks={notebooks}
        onClose={() => setMarkPicker(null)}
        onSelect={(hit) => {
          setMarkPicker(null)
          handleSelectMark(hit.note, hit.entry)
        }}
      />
      {tasksBoardOpen && activeTask?.id === taskModalId && noteEditor && (
        <TaskEditorModal onClose={() => setTaskModalId(null)}>{noteEditor}</TaskEditorModal>
      )}
      {noteTaskModalTask && (
        <TaskEditorModal onClose={() => setNoteTaskModalId(null)}>
          <TaskModalEditor
            task={noteTaskModalTask}
            note={noteTaskModalNote}
            notebookName={notebooks.find((nb) => nb.id === noteTaskModalNote?.notebookId)?.name}
            subjectName={noteTaskModalNote?.subjectId ? TASKS_SUBJECT_NAME : undefined}
            previewMode={previewMode}
            onNoteChange={updateModalNote}
            onAddBodyNote={addBodyNoteToModalTask}
            onUpdate={(patch) => void updateTask(noteTaskModalTask.id, patch)}
            onMove={(project) => void moveProjectTask(noteTaskModalTask.id, project)}
            onCreateTasks={(inputs, opts) =>
              createProjectTasks(
                inputs.map((i) => ({
                  title: i.title,
                  status: i.checked ? 'done' : 'todo',
                  dueDate: opts.dueDate,
                  sourceNoteId: noteTaskModalNote?.id ?? null,
                  parentNoteId: null,
                })),
                opts.project
              )
            }
            onToggleLinkedTask={handleToggleLinkedTask}
            taskStatuses={taskStatuses}
            notebooks={orderedNotebooks}
            statuses={statusRegistry}
            markLabels={markLabels}
            tagSuggestions={allTags}
            todosOptions={todosOptions}
            metadataDefs={metadata.defs}
            onCreateMetadataDef={metadata.create}
            onManageMetadata={(focusId) => setMetadataManager({ focusId: focusId ?? null })}
            sourceNoteExists={
              noteTaskModalTask.sourceNoteId !== null &&
              notes.some((n) => n.id === noteTaskModalTask.sourceNoteId)
            }
            onOpenSourceNote={() => {
              setNoteTaskModalId(null)
              if (noteTaskModalTask?.sourceNoteId) {
                handleNoteLinkNavigation(noteTaskModalTask.sourceNoteId)
              }
            }}
            onOpenTodos={(todoNoteId) => {
              setNoteTaskModalId(null)
              handleNoteLinkNavigation(todoNoteId)
            }}
            onCreateTodos={createTodosNote}
            onDelete={() => noteTaskModalTask && void deleteProjectTasks([noteTaskModalTask.id])}
            suggestedTaskNotebookId={
              noteTaskModalNote?.notebookId && noteTaskModalNote.notebookId !== calendarNotebookId
                ? noteTaskModalNote.notebookId
                : INBOX_NOTEBOOK_ID
            }
            tasksContext={modalTasksContext}
          />
        </TaskEditorModal>
      )}
      <StatusManagerModal
        open={statusManagerOpen}
        onClose={() => setStatusManagerOpen(false)}
        statuses={statusRegistry}
        tasks={tasks}
        onCreate={createStatus}
        onRename={(id, name) => void renameStatus(id, name)}
        onUpdate={(id, change) => void updateStatus(id, change)}
        onRemove={(id) => void removeStatus(id)}
        onReorder={(openIds) => void reorderStatuses(openIds)}
      />
      <MetadataManagerModal
        open={metadataManager !== null}
        onClose={() => setMetadataManager(null)}
        focusId={metadataManager?.focusId}
        defs={metadata.defs}
        tasks={tasks}
        onRename={metadata.rename}
        onRemove={(id) => void metadata.remove(id)}
        onReorder={(ids) => void metadata.reorderTaskDefs(ids)}
      />
      {noteTypesOpen && (
        <NoteTypesModal
          onClose={() => setNoteTypesOpen(null)}
          focusTypeId={noteTypesOpen.focusTypeId}
          reorder={noteTypesOpen.reorder}
          registry={noteTypes}
          notes={notes}
        />
      )}
      {todosMigration && (
        <TodosMigrationModal
          rows={todosMigration.rows}
          status={todosMigration.status}
          message={todosMigration.message}
          onMigrate={(rows, skipped) => void runTodosMigration(rows, skipped)}
          onClose={() => setTodosMigration(null)}
        />
      )}
      {confirmModal}
    </div>
    </TasksEnvProvider>
  )
}

export default App
