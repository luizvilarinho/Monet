import { useCallback, useEffect, useMemo, useState } from 'react'
import { Toolbar } from './components/Toolbar/Toolbar'
import { NotebookList } from './components/NotebookList/NotebookList'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { MarkdownPreview } from './components/Editor/MarkdownPreview'
import { AiPanel } from './components/AiPanel/AiPanel'
import { SettingsModal } from './components/Settings/SettingsModal'
import { useNotebooks } from './hooks/useNotebooks'
import { useNotes } from './hooks/useNotes'
import { useAi } from './hooks/useAi'
import {
  hasOpenRouterKey,
  listOpenRouterModels,
  OPENROUTER_KEY_MISSING,
} from './lib/openrouter'
import {
  hasTavilyKey,
  webSearch,
  formatSearchResults,
} from './lib/search'
import { findCommand } from './lib/commands'
import type { AiModel, CommandExecutionRequest, Note } from './types'
import './App.css'

const SYSTEM_PROMPT =
  'Voce e a assistente do Monet, um app de notas para estudo ativo. Responda em portugues, de forma clara e objetiva, usando markdown curto.'

function stripCommandLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => !/^\/[a-zA-Z]/.test(line.trim()))
    .join('\n')
    .trim()
}

function buildUserMessage(
  command: string,
  description: string,
  query: string,
  noteContent: string,
  searchContext?: string
): string {
  const parts: string[] = []
  parts.push(`Comando: ${command} — ${description}`)
  if (query.trim()) parts.push(`Parametro: ${query.trim()}`)
  if (searchContext) parts.push(`\n${searchContext}`)
  const cleanContent = stripCommandLines(noteContent)
  if (cleanContent) {
    parts.push(`\nConteudo da nota atual:\n${cleanContent}`)
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

  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [hasApiKey, setHasApiKey] = useState<boolean>(false)
  const [apiKeyChecked, setApiKeyChecked] = useState<boolean>(false)
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsLoading, setModelsLoading] = useState<boolean>(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [navigateToCard, setNavigateToCard] = useState<{ index: number; ts: number } | null>(null)

  const { responses, start, addErrorCard, removeResponse } = useAi(activeId)

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
        err instanceof Error ? err.message : String(err ?? 'falha ao carregar modelos')
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

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notebookNotes.filter((n) => {
      if (activeTag && !n.tags.includes(activeTag)) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [notebookNotes, search, activeTag])

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
  )

  function updateActive(patch: Partial<Note>) {
    if (!activeNote) return
    void saveNote({ ...activeNote, ...patch, updatedAt: Date.now() })
  }

  async function handleCreateNotebook() {
    const name = window.prompt('nome do caderno')
    if (name === null) return
    const nb = await createNotebook(name)
    setActiveNotebookId(nb.id)
    setActiveId(null)
  }

  async function handleCreateNote() {
    if (!activeNotebookId) return
    const note = await createNote(activeNotebookId)
    setActiveId(note.id)
  }

  async function handleDeleteNotebook(id: string) {
    const childNotes = notes.filter((n) => n.notebookId === id)
    await Promise.all(childNotes.map((n) => removeNote(n.id)))
    await removeNotebook(id)
    if (activeNotebookId === id) {
      setActiveNotebookId(null)
      setActiveId(null)
    }
  }

  async function handleDeleteNote(id: string) {
    await removeNote(id)
    if (activeId === id) setActiveId(null)
  }

  const handleCommand = useCallback(
    async ({ cmd, query }: CommandExecutionRequest) => {
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
          'Chave de API não configurada. Cadastre a chave do OpenRouter em Settings para iniciar solicitações.'
        )
        return true
      }
      if (!modelId || models.length === 0) {
        addErrorCard(
          activeId,
          cmd,
          query,
          'Nenhum modelo disponível para selecionar. Verifique sua conta OpenRouter.'
        )
        return true
      }
      if (def.usesSearch) {
        if (!hasTavilyKey()) {
          addErrorCard(
            activeId,
            cmd,
            query,
            'Busca web não configurada. Cadastre a chave Tavily em Settings > Busca Web para usar este comando.'
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

      await start({
        noteId: activeId,
        model: modelId,
        command: cmd,
        query: def && !def.takesQuery ? '' : query,
        systemPrompt: SYSTEM_PROMPT,
        userMessage: buildUserMessage(cmd, def.description, query, noteContent, searchContext),
      })
      return true
    },
    [activeId, activeNote, modelId, models.length, start, addErrorCard]
  )

  return (
    <div className="app">
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        onExport={() => {}}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen((v) => !v)}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((v) => !v)}
      />
      <div className="workspace">
        <NotebookList
          notebooks={notebooks}
          activeId={activeNotebookId}
          onSelect={(id) => {
            setActiveNotebookId(id)
            setActiveId(null)
          }}
          onCreate={handleCreateNotebook}
          onDelete={handleDeleteNotebook}
          onRename={handleRenameNotebook}
          tags={allTags}
          activeTag={activeTag}
          onSelectTag={setActiveTag}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <Sidebar
          notes={visibleNotes}
          activeId={activeId}
          notebookSelected={activeNotebookId !== null}
          onSelect={setActiveId}
          onCreate={handleCreateNote}
          onDelete={handleDeleteNote}
        />
        {previewOpen ? (
          <MarkdownPreview
            title={activeNote?.title ?? ''}
            tags={activeNote?.tags ?? []}
            content={activeNote?.content ?? ''}
          />
        ) : (
          <Editor
            title={activeNote?.title ?? ''}
            onTitleChange={(title) => updateActive({ title })}
            tags={activeNote?.tags ?? []}
            onTagsChange={(tags) => updateActive({ tags })}
            value={activeNote?.content ?? ''}
            onChange={(content) => updateActive({ content })}
            onCommand={handleCommand}
            onNavigateToCard={(index) => setNavigateToCard({ index, ts: Date.now() })}
          />
        )}
        <AiPanel
          open={aiOpen}
          responses={responses}
          hasApiKey={hasApiKey}
          apiKeyChecked={apiKeyChecked}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          models={models}
          modelId={modelId}
          onModelChange={setModelId}
          onOpenSettings={() => setSettingsOpen(true)}
          navigateToCard={navigateToCard}
          onDeleteResponse={removeResponse}
        />
      </div>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApiKeyChanged={handleApiKeyChanged}
      />
    </div>
  )
}

export default App
