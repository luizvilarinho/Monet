import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { AiPanel } from './components/AiPanel/AiPanel'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { DocumentsModal } from './components/DocumentsModal/DocumentsModal'
import { Editor } from './components/Editor/Editor'
import { EmptyEditor } from './components/Editor/EmptyEditor'
import { MarkdownPreview } from './components/Editor/MarkdownPreview'
import { NotebookList } from './components/NotebookList/NotebookList'
import { RelatedContent } from './components/RelatedContent/RelatedContent'
import { SettingsModal } from './components/Settings/SettingsModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Toolbar, type ActiveMode } from './components/Toolbar/Toolbar'
import { useAi } from './hooks/useAi'
import { useNotebooks } from './hooks/useNotebooks'
import { useNotes } from './hooks/useNotes'
import { findCommand } from './lib/commands'
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
import {
  documentsList,
  documentsSearch,
  embedText,
  type ChunkResult,
} from './lib/documents'
import type { AiModel, AiSource, CommandExecutionRequest, Note } from './types'

const SYSTEM_PROMPT = `Você é o assistente de estudo do Monet.

Responda sempre em português do Brasil, com Markdown enxuto e sem saudações, despedidas ou frases de enchimento.

Objetivo geral:
- Complementar a nota atual sem repetir literalmente o que já está escrito.
- Tratar a nota como contexto principal.
- Priorizar informação útil que não esteja explicitamente presente na nota: exemplos concretos, implicações práticas, conexões entre conceitos, exceções, riscos, contrapontos e contexto relevante.

Regras gerais:
- Não reescreva, resuma ou parafraseie trechos da nota, exceto quando o próprio comando pedir síntese.
- Não transforme o conteúdo existente apenas em outras palavras.
- Se precisar mencionar algo que já está na nota, faça isso de forma breve e apenas para conectar a nova informação.
- Não invente fatos, nomes, números, datas ou referências.
- Se o comando depender de pesquisa web, use somente os resultados fornecidos.
- Se os resultados de pesquisa forem insuficientes, responda exatamente: "Não encontrei informações suficientes nos resultados disponíveis."
- Se não houver complemento relevante além do que já está explícito na nota, responda exatamente: "Sem complemento relevante além do que já está na nota."

Comportamento por comando:
- /resumir: sintetize apenas o essencial da nota em bullets curtos. Aqui pode reformular o conteúdo da nota, mas sem floreio.
- /definir: dê uma definição curta e, se útil, acrescente 1 exemplo, contraste ou implicação que não esteja explícito na nota.
- /tabela: responda em tabela Markdown, comparativa e simétrica.
- /opiniao: organize em prós, contras e conclusão direta.
- /pesquisa e /quem: responda de forma factual, somente com base nos resultados fornecidos.
- /aprofundar: entregue apenas informações novas e úteis que não estejam explicitamente presentes na nota. Não resuma, não reformule e não repita o texto da nota em outras palavras. Adicione apenas contexto, conexões, implicações, exemplos, exceções, riscos, contrapontos ou detalhes ausentes.
- /documentos: responda usando exclusivamente os "Trechos relevantes de documentos do caderno". Ignore a nota e seu conhecimento geral. Cite o nome do documento entre parênteses ao final de cada afirmação. Se os trechos não trouxerem informação suficiente para responder, responda exatamente: "Não encontrei essa informação nos documentos do caderno."`

const COLLAPSED_PANEL_WIDTH = 48

function stripCommandLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => !/^\/[a-zA-Z]/.test(line.trim()))
    .join('\n')
    .trim()
}

function formatRagContext(chunks: ChunkResult[]): string {
  if (chunks.length === 0) return ''
  const blocks = chunks.map((c) => {
    const header = `[${c.documentName}, trecho ${c.chunkIndex + 1}]`
    return `${header}\n${c.snippet}`
  })
  return `Trechos relevantes de documentos do caderno:\n\n${blocks.join('\n\n')}\n\n---`
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
  parts.push(`Comando: ${command} - ${description}`)
  if (query.trim()) parts.push(`Parametro: ${query.trim()}`)
  if (ragContext) parts.push(`\n${ragContext}`)
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

  const [activeMode, setActiveMode] = useState<ActiveMode>(() => {
    const saved = localStorage.getItem('monet:active-mode')
    return saved === 'chat' ? 'chat' : 'caderno'
  })
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [documentsModalNotebookId, setDocumentsModalNotebookId] = useState<string | null>(null)

  const [hasApiKey, setHasApiKey] = useState<boolean>(false)
  const [apiKeyChecked, setApiKeyChecked] = useState<boolean>(false)
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsLoading, setModelsLoading] = useState<boolean>(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [navigateToCard, setNavigateToCard] = useState<{ index: number; ts: number } | null>(null)
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
  const [exportSuccess, setExportSuccess] = useState(false)
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [commandLineToRemove, setCommandLineToRemove] = useState<{ id: string; ts: number } | null>(null)
  const [noteOrder, setNoteOrder] = useState<string[]>(() => loadNoteOrder())
  const [notebookOrder, setNotebookOrder] = useState<string[]>(() => loadOrder('monet:notebook-order'))

  const { responses, start, addErrorCard, removeResponse } = useAi(activeId)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault()
        setFocusMode((v) => !v)
      }
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault()
        setPreviewOpen((v) => !v)
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
    const content = stripCommandLines(activeNote.content)
    const defaultName = activeNote.title.trim()
      ? `${activeNote.title.trim()}.md`
      : 'nota-sem-titulo.md'
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
  }, [activeNote])

  const executedCommandIds = useMemo(
    () => new Set(responses.map((r) => r.commandId ?? r.id)),
    [responses]
  )

  const effectiveNotebookWidth = notebookCollapsed ? COLLAPSED_PANEL_WIDTH : notebookWidth
  const effectiveSidebarWidth = sidebarCollapsed ? COLLAPSED_PANEL_WIDTH : sidebarWidth

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
        if (!(await hasTavilyKey())) {
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

      const isDocsOnly = cmd === '/documentos'
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
                ? 'Nenhum documento disponível ainda — aguarde a indexação terminar.'
                : 'Nenhum documento neste caderno. Adicione um pelo ícone de documentos no caderno.'
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
              'Falha ao consultar documentos do caderno.'
            )
            return true
          }
        }
      } else if (isDocsOnly) {
        addErrorCard(
          activeId,
          cmd,
          query,
          'Esta nota não pertence a um caderno. /documentos requer um caderno com documentos indexados.'
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
          'Não consegui buscar trechos relevantes nos documentos. Verifique a conexão e tente novamente.'
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
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen((v) => !v)}
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
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
      ) : (
      <div className="workspace">
        {!focusMode && <NotebookList
          notebooks={orderedNotebooks}
          activeId={activeNotebookId}
          onSelect={(id) => {
            setActiveNotebookId(id)
            setActiveId(null)
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
          onOpenSettings={() => setSettingsOpen(true)}
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
          width={effectiveSidebarWidth}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          onWidthChange={setSidebarWidth}
        />}
        {previewOpen && activeNote ? (
          <MarkdownPreview
            title={activeNote.title}
            tags={activeNote.tags}
            content={activeNote.content}
            relatedContent={
              <RelatedContent activeNote={activeNote} notes={notes} onSelect={setActiveId} />
            }
          />
        ) : activeNote ? (
          <Editor
            executedCommandIds={executedCommandIds}
            title={activeNote.title}
            onTitleChange={(title) => updateActive({ title })}
            tags={activeNote.tags}
            onTagsChange={(tags) => updateActive({ tags })}
            value={activeNote.content}
            onChange={(content) => updateActive({ content })}
            onCommand={handleCommand}
            onNavigateToCard={(index) => setNavigateToCard({ index, ts: Date.now() })}
            onDeleteCommand={(id) => removeResponse(id)}
            commandLineToRemove={commandLineToRemove}
            responses={responses}
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
          onOpenSettings={() => setSettingsOpen(true)}
          navigateToCard={navigateToCard}
          onDeleteResponse={(id) => {
            removeResponse(id)
            setCommandLineToRemove({ id, ts: Date.now() })
          }}
        />
      </div>
      )}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApiKeyChanged={handleApiKeyChanged}
      />
      <DocumentsModal
        open={documentsModalNotebookId !== null}
        notebookId={documentsModalNotebookId}
        notebookName={
          notebooks.find((n) => n.id === documentsModalNotebookId)?.name ?? ''
        }
        onClose={() => setDocumentsModalNotebookId(null)}
      />
    </div>
  )
}

export default App
