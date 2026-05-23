import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import type { Update } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { AiPanel } from './components/AiPanel/AiPanel'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { DocumentsModal } from './components/DocumentsModal/DocumentsModal'
import { Editor } from './components/Editor/Editor'
import { EmptyEditor } from './components/Editor/EmptyEditor'
import { NotebookList } from './components/NotebookList/NotebookList'
import { Onboarding } from './components/Onboarding/Onboarding'
import { RelatedContent } from './components/RelatedContent/RelatedContent'
import { SettingsModal } from './components/Settings/SettingsModal'
import { UpdaterDialog } from './components/UpdaterDialog/UpdaterDialog'
import { SearchPalette } from './components/SearchPalette/SearchPalette'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Toolbar, type ActiveMode } from './components/Toolbar/Toolbar'
import { useAi } from './hooks/useAi'
import {
  activateChatConversation,
  chatConversationExists,
  createPreloadedChatConversation,
  getLinkedChatConversationId,
  linkResponseToChatConversation,
  unlinkResponseFromChat,
} from './hooks/useChat'
import { useNotebooks } from './hooks/useNotebooks'
import { useNotes } from './hooks/useNotes'
import { findCommand } from './lib/commands'
import {
  getUpdatePreference,
  getSkippedVersion,
  isCheckDue,
  recordCheck,
  isMandatory,
  setSkippedVersion,
} from './lib/updater'
import { getToggleTitle } from './components/Editor/commandParser'
import {
  documentsList,
  documentsSearch,
  embedText,
  type ChunkResult,
} from './lib/documents'
import { applyOrder, loadNoteOrder, loadOrder, mergeOrder, saveNoteOrder, saveOrder } from './lib/noteOrder'
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
  Note,
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
- /docs: respond using exclusively the "Relevant document excerpts from the notebook". Ignore the note and your general knowledge. Cite the document name in parentheses at the end of each claim. If the excerpts do not contain enough information to answer, respond exactly: "I could not find this information in the notebook documents."`
}

const SYSTEM_PROMPT = buildSystemPrompt(USER_LANGUAGE)

const COLLAPSED_PANEL_WIDTH = 48

function stripCommandLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => !/^\/[a-zA-Z]/.test(line.trim()))
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

function buildUserMessage(
  command: string,
  description: string,
  query: string,
  noteContent: string,
  searchContext?: string,
  ragContext?: string
): string {
  const parts: string[] = []
  parts.push(`Command: ${command} - ${description}`)
  if (query.trim()) parts.push(`Parameter: ${query.trim()}`)
  if (ragContext) parts.push(`\n${ragContext}`)
  if (searchContext) parts.push(`\n${searchContext}`)
  const cleanContent = stripCommandLines(noteContent)
  if (cleanContent) {
    parts.push(`\nCurrent note content:\n${cleanContent}`)
  }
  return parts.join('\n')
}

function App() {
  const { notebooks, save: saveNotebook, create: createNotebook, remove: removeNotebook } =
    useNotebooks()
  const {
    notes,
    save: saveNote,
    create: createNote,
    remove: removeNote,
  } = useNotes()

  const [activeMode, setActiveMode] = useState<ActiveMode>(() => {
    const saved = localStorage.getItem('monet:active-mode')
    return saved === 'chat' ? 'chat' : 'notebook'
  })
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [documentsModalNotebookId, setDocumentsModalNotebookId] = useState<string | null>(null)

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
    const saved = parseInt(localStorage.getItem('monet:sidebar-width') ?? '', 10)
    return isNaN(saved) ? 220 : saved
  })
  const [notebookCollapsed, setNotebookCollapsed] = useState(
    () => localStorage.getItem('monet:notebook-collapsed') === '1'
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('monet:sidebar-collapsed') === '1'
  )
  const [focusMode, setFocusMode] = useState(false)
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [noteOrder, setNoteOrder] = useState<string[]>(() => loadNoteOrder())
  const [notebookOrder, setNotebookOrder] = useState<string[]>(() => loadOrder('monet:notebook-order'))
  const [updateDialog, setUpdateDialog] = useState<{
    update: Update
    mandatory: boolean
    autoStart: boolean
  } | null>(null)

  const { responses, start, addErrorCard, removeResponse } = useAi(activeId)

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

  const allTags = useMemo(
    () =>
      Array.from(new Set(notes.flatMap((n) => n.tags))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [notes]
  )

  const notebookNotes = useMemo(
    () => activeNotebookId === null
      ? notes
      : notes.filter((n) => n.notebookId === activeNotebookId),
    [notes, activeNotebookId]
  )

  const orderedNotebooks = useMemo(
    () => applyOrder(notebooks, notebookOrder),
    [notebooks, notebookOrder]
  )

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = notebookNotes.filter((n) => {
      if (activeTag && !n.tags.includes(activeTag)) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
    return applyOrder(filtered, noteOrder)
  }, [notebookNotes, search, activeTag, noteOrder])

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
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

  const handleCommand = useCallback(
    async ({ cmd, query, commandId }: CommandExecutionRequest) => {
      if (!activeId) return false
      const def = findCommand(cmd)
      if (!def) return false
      if (def.takesQuery && query.trim().length === 0) {
        return false
      }
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

      let availableDocsCount = 0
      let docsListFailed = false
      if (notebookId) {
        try {
          const docs = await documentsList(notebookId)
          availableDocsCount = docs.filter((d) => d.status === 'available').length

          if (isDocsOnly && availableDocsCount === 0) {
            const indexing = docs.some((d) => d.status === 'indexing')
            addErrorCard(
              activeId,
              cmd,
              query,
              indexing
                ? 'No document available yet — wait for indexing to finish.'
                : 'No document in this notebook. Add one via the documents icon on the notebook.'
            )
            return true
          }
        } catch (err) {
          docsListFailed = true
          console.warn('documentsList failed:', err)
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

      let ragContext: string | undefined
      let ragSources: AiSource[] | undefined
      if (notebookId && !docsListFailed && availableDocsCount > 0) {
        try {
          const queryText = query.trim() || stripCommandLines(noteContent).slice(0, 500)
          if (queryText) {
            const embedding = await embedText(queryText)
            const topK = isDocsOnly ? 8 : 5
            const chunks = await documentsSearch(notebookId, embedding, topK)
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

      const userMessage = isDocsOnly
        ? buildUserMessage(cmd, def.description, query, '', undefined, ragContext)
        : buildUserMessage(cmd, def.description, query, noteContent, searchContext, ragContext)

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
    [activeId, activeNote, modelId, models.length, start, addErrorCard]
  )

  const effectiveNotebookWidth = notebookCollapsed ? COLLAPSED_PANEL_WIDTH : notebookWidth
  const effectiveSidebarWidth = sidebarCollapsed ? COLLAPSED_PANEL_WIDTH : sidebarWidth

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

  async function handleCreateNote() {
    if (!activeNotebookId) return
    const note = await createNote(activeNotebookId)
    setActiveId(note.id)
    setNoteOrder((prev) => {
      const next = [note.id, ...prev]
      saveNoteOrder(next)
      return next
    })
  }

  async function handleDeleteNotebook(id: string) {
    const childNotes = notes.filter((n) => n.notebookId === id)
    await Promise.all(childNotes.map((n) => removeNote(n.id)))
    await removeNotebook(id)
    if (activeNotebookId === id) {
      setActiveNotebookId(null)
      setActiveId(null)
    }
    setNotebookOrder((prev) => {
      const next = prev.filter((x) => x !== id)
      saveOrder('monet:notebook-order', next)
      return next
    })
  }

  async function handleDeleteNote(id: string) {
    await removeNote(id)
    if (activeId === id) setActiveId(null)
    setNoteOrder((prev) => {
      const next = prev.filter((x) => x !== id)
      saveNoteOrder(next)
      return next
    })
  }

  const handleMergeNotes = useCallback(
    async (sourceId: string, targetId: string) => {
      const source = notes.find((n) => n.id === sourceId)
      const target = notes.find((n) => n.id === targetId)
      if (!source || !target) return
      const mergedContent = target.content
        ? target.content + '\n\n---\n\n' + source.content
        : source.content
      await saveNote({ ...target, content: mergedContent, updatedAt: Date.now() })
      await removeNote(sourceId)
      if (activeId === sourceId) setActiveId(targetId)
    },
    [notes, saveNote, removeNote, activeId]
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
    async (notebookId: string, title: string, content: string) => {
      const note = await createNote(notebookId)
      const filled: Note = {
        ...note,
        title,
        content,
        updatedAt: Date.now(),
      }
      await saveNote(filled)
      setNoteOrder((prev) => {
        const next = [filled.id, ...prev.filter((x) => x !== filled.id)]
        saveNoteOrder(next)
        return next
      })
      return filled
    },
    [createNote, saveNote]
  )

  const handleNavigateToNote = useCallback(
    (notebookId: string, noteId: string) => {
      setActiveMode('notebook')
      setActiveNotebookId(notebookId)
      setActiveId(noteId)
      setActiveTag(null)
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

  return (
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
      />
      {activeMode === 'chat' ? (
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
            onSaveNote={saveNote}
            onNavigateToNote={handleNavigateToNote}
          />
        </div>
      ) : (
      <div className="workspace">
        {!focusMode && <NotebookList
          notebooks={orderedNotebooks}
          activeId={activeNotebookId}
          onSelect={(id) => {
            setActiveNotebookId(id)
            const notebookNotes = applyOrder(
              notes.filter((n) => n.notebookId === id),
              noteOrder
            )
            setActiveId(notebookNotes[0]?.id ?? null)
          }}
          onCreate={handleCreateNotebook}
          onDelete={handleDeleteNotebook}
          onRename={handleRenameNotebook}
          onOpenDocuments={(id) => {
            setActiveNotebookId(id)
            setDocumentsModalNotebookId(id)
          }}
          tags={allTags}
          activeTag={activeTag}
          onSelectTag={setActiveTag}
          onOpenSettings={handleOpenSettings}
          width={effectiveNotebookWidth}
          collapsed={notebookCollapsed}
          onToggleCollapsed={() => setNotebookCollapsed((v) => !v)}
          onWidthChange={setNotebookWidth}
          onReorder={handleNotebookReorder}
        />}
        {!focusMode && <Sidebar
          notes={visibleNotes}
          activeId={activeId}
          notebookSelected={activeNotebookId !== null}
          onSelect={setActiveId}
          onCreate={handleCreateNote}
          onDelete={handleDeleteNote}
          onReorder={handleReorder}
          onMerge={handleMergeNotes}
          width={effectiveSidebarWidth}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          onWidthChange={setSidebarWidth}
        />}
        {activeNote ? (
          <Editor
            title={activeNote.title}
            onTitleChange={(title) => updateActive({ title })}
            tags={activeNote.tags}
            onTagsChange={(tags) => updateActive({ tags })}
            value={activeNote.content}
            onChange={(content) => updateActive({ content })}
            onCommand={handleCommand}
            executedCommandTexts={executedCommandTexts}
            responses={responses}
            onRemoveResponse={(id) => {
              removeResponse(id)
              unlinkResponseFromChat(id)
            }}
            notebookNotes={notebookNotes.filter((n) => n.id !== activeId)}
            onNavigateToNote={handleNoteLinkNavigation}
            relatedContent={
              <RelatedContent activeNote={activeNote} notes={notes} onSelect={setActiveId} />
            }
          />
        ) : (
          <EmptyEditor
            hasNotebook={activeNotebookId !== null}
            onCreate={handleCreateNote}
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
        onClose={() => setDocumentsModalNotebookId(null)}
      />
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
        onSelectNote={(notebookId, noteId) => {
          handleNavigateToNote(notebookId, noteId)
          setSearchPaletteOpen(false)
        }}
      />
    </div>
  )
}

export default App
