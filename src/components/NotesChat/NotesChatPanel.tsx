import { openUrl } from '@tauri-apps/plugin-opener'
import { Stop, Sliders, Files, Brain } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useChat,
  type ChatMessage,
  type ChatConversation,
  type TasksSnapshot,
  NO_RESPONSE_MESSAGE,
} from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import { notesFolderDocId } from '../../lib/documents'
import { loadEmbedResponses } from '../../lib/noteFileText'
import type { ChecklistProgress } from '../../lib/tasks'
import {
  listOpenRouterModels,
  OPENROUTER_KEY_MISSING,
} from '../../lib/openrouter'
import type { AiModel, Note, Notebook, Task } from '../../types'
import { ModelSelector } from '../AiPanel/ModelSelector'
import { ChatToolsMenu } from '../ChatPanel/ChatToolsMenu'
import { FolderSystemPromptModal } from '../ChatPanel/FolderSystemPromptModal'
import { FolderDocumentSelectorModal } from '../ChatPanel/FolderDocumentSelectorModal'
import { FolderMemoryModal } from '../ChatPanel/FolderMemoryModal'
import { buildNotesContext } from './notesContext'
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

interface NotesChatPanelProps {
  // Caderno existente (null = sem caderno: estado vazio)
  notebook: { id: string; name: string } | null
  activeNote: Note | null
  resolveNoteTitle: (noteId: string) => string | undefined
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
  canInsert: boolean
  onInsertIntoNote: (content: NoteInsert, where: 'cursor' | 'end') => void
}

export function NotesChatPanel({
  notebook,
  activeNote,
  resolveNoteTitle,
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
  canInsert,
  onInsertIntoNote,
}: NotesChatPanelProps) {
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const tasksSnapshotRef = useRef<TasksSnapshot>({ tasks, notebooks, todayKey, checklist: taskChecklist })
  tasksSnapshotRef.current = { tasks, notebooks, todayKey, checklist: taskChecklist }

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
    ensureScopedFolder,
    setFolderSystemPrompt,
    setFolderVisibleDocuments,
    getFolderVisibleDocumentIds,
    setFolderMemory,
    setFolderMemoryEnabled,
    setFolderWebResearchEnabled,
  } = useChat(models, { mode: 'notes', getTasksSnapshot: () => tasksSnapshotRef.current })

  const [draft, setDraft] = useState('')
  const [notebookFolderId, setNotebookFolderId] = useState<string | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)

  const notebookFolder = useMemo(
    () => folders.find((f) => f.id === notebookFolderId) ?? null,
    [folders, notebookFolderId]
  )

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

  // Acompanha o crescimento da resposta rolando para baixo (e ao reexibir).
  useEffect(() => {
    const el = historyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight })
  }, [messages, visible])

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

  const canSend =
    !!notebook &&
    !isStreaming &&
    hasApiKey &&
    draft.trim().length > 0 &&
    !!model &&
    models.length > 0 &&
    !!activeId

  const selectedModel = models.find((m) => m.id === model)

  async function handleSend() {
    if (!canSend || !notebook) return
    // Idempotente; recria a pasta (e refresca o ref usado pelo fallback do
    // send) caso ela tenha sido apagada em outra janela durante a sessão.
    ensureScopedFolder({ kind: 'notebook', id: notebook.id, title: notebook.name })
    const text = draft
    setDraft('')
    // Contexto montado NO MOMENTO do envio: trocar de nota depois não afeta
    // a resposta em streaming.
    const note = activeNote
    const selectionText = getSelectionText()
    const embeds = await loadEmbedResponses(note ? [note.content] : [], resolveNoteContent)
    const ephemeralContext = buildNotesContext({
      notebookName: notebook.name,
      note,
      selectionText,
      resolveNoteTitle,
      resolveLinkedNoteContent: resolveNoteContent,
      resolveEmbed: (id) => embeds.get(id),
      projectTasks,
      todayKey,
      checklist: taskChecklist,
    })
    void send(text, undefined, undefined, {
      ephemeralContext,
      excludeNoteId: note?.id ?? null,
    })
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
                aria-label="Notebook memory"
                title="Notebook memory"
                onClick={() => setMemoryOpen(true)}
              >
                <Brain size={14} />
              </button>
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
          </div>

          {apiKeyChecked && !hasApiKey && (
            <div className={styles.keyBanner} role="alert">
              Add your OpenRouter key in Settings to chat about your notes.
            </div>
          )}

          <div className={styles.history} ref={historyRef}>
            {messages.length === 0 ? (
              <p className={styles.empty}>
                Ask about this notebook — the AI sees the open note, your selection
                and the notebook's indexed notes.
              </p>
            ) : (
              messages.map((m) => (
                <NotesChatBubble
                  key={m.id}
                  message={m}
                  isStreaming={m.id === streamingMessageId}
                  canInsert={canInsert}
                  onInsert={onInsertIntoNote}
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
                <span className={styles.selectionInsertLabel}>Insert selection</span>
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
                  Append
                </button>
              </div>
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
                hasApiKey
                  ? 'Ask about your notes...'
                  : 'Configure your OpenRouter key first.'
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
    </section>
  )
}

interface NotesChatBubbleProps {
  message: ChatMessage
  isStreaming: boolean
  canInsert: boolean
  onInsert: (content: NoteInsert, where: 'cursor' | 'end') => void
}

function NotesChatBubble({ message, isStreaming, canInsert, onInsert }: NotesChatBubbleProps) {
  const isUser = message.role === 'user'
  const isEmpty = !isUser && message.content.length === 0
  const segments = useMemo(
    () => (isUser ? [] : splitMessageBlocks(message.content)),
    [isUser, message.content]
  )

  if (isUser) {
    return <div className={styles.bubbleUser}>{message.content}</div>
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
      <div className={styles.bubbleAssistant}>{NO_RESPONSE_MESSAGE}</div>
    )
  }

  const insertDisabled = !canInsert || isStreaming

  return (
    <div className={styles.assistantBlock}>
      <div
        className={styles.bubbleAssistant}
        data-streaming={isStreaming || undefined}
        data-chat-message
        onClick={(e) => {
          const target = (e.target as HTMLElement).closest('a')
          if (!target) return
          const href = target.getAttribute('href')
          if (!href || !href.startsWith('http')) return
          e.preventDefault()
          void openUrl(href)
        }}
      >
        {segments.map((seg, i) => {
          if (seg.kind === 'text') return <MarkdownHtml key={i} markdown={seg.markdown} />
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
      <div className={styles.messageActions}>
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={insertDisabled}
          onClick={() => onInsert({ markdown: messageToMarkdown(segments) }, 'cursor')}
        >
          Insert at cursor
        </button>
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={insertDisabled}
          onClick={() => onInsert({ markdown: messageToMarkdown(segments) }, 'end')}
        >
          Append to note
        </button>
      </div>
    </div>
  )
}

// Markdown da IA renderizado pelo pipeline seguro (sanitize + bloqueio de URLs).
function MarkdownHtml({ markdown, className }: { markdown: string; className?: string }) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false
    renderMarkdown(markdown).then((out) => {
      if (!cancelled) setHtml(out)
    })
    return () => {
      cancelled = true
    }
  }, [markdown])

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

interface BlockCardProps {
  label: string
  markdown: string
  copyText: string
  pending: boolean
  canInsert: boolean
  onInsert: (where: 'cursor' | 'end') => void
}

// Cartão de um bloco `note` ou de código. O cabeçalho e as ações levam
// `data-chat-ui` para ficarem fora do "Insert selection".
function BlockCard({ label, markdown, copyText, pending, canInsert, onInsert }: BlockCardProps) {
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
      <MarkdownHtml className={styles.blockCardBody} markdown={markdown} />
      <div className={styles.blockCardActions} data-chat-ui>
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={insertDisabled}
          onClick={() => onInsert('cursor')}
        >
          Insert at cursor
        </button>
        <button
          type="button"
          className={styles.messageActionBtn}
          disabled={insertDisabled}
          onClick={() => onInsert('end')}
        >
          Append to note
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
// UI dos cartões (`data-chat-ui`).
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
  return { html: wrapper.innerHTML, text: (wrapper.textContent ?? '').trim() }
}
