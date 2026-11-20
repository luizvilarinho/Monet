import { invoke } from '@tauri-apps/api/core'
import { Brain, GearSix, MagnifyingGlassPlus, Monitor, Paperclip, Stop, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatFolder, ChatTools } from '../../hooks/useChat'
import type { DeepResearchPhase } from '../../lib/deepResearch'
import { hasTavilyKey, TAVILY_KEY_CHANGED_EVENT } from '../../lib/search'
import type { AiModel } from '../../types'
import { chatAgentComposerHint, findChatAgent, parseAgentShortcut } from '../../lib/agents/chat'
import { AgentPicker, AgentSuggestions, useAgentShortcut } from './AgentPicker'
import { ChatToolsMenu } from './ChatToolsMenu'
import { RagSearchStatus } from './RagSearchStatus'
import { useImageViewer } from '../ImageViewer/ImageViewer'
import styles from './ChatComposer.module.css'

type DraftDoc = { name: string; type: string; data: string }

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

interface ChatComposerProps {
  hasApiKey: boolean
  isStreaming: boolean
  selectedModel: AiModel | undefined
  tools: ChatTools
  setTool: (key: keyof ChatTools, value: boolean) => void
  thinkingEnabled: boolean
  toggleThinking: () => void
  // Pasta da conversa ativa: toggles de memoria e web research da pasta.
  activeFolder: ChatFolder | null
  setFolderMemoryEnabled: (folderId: string, enabled: boolean) => void
  setFolderWebResearchEnabled: (folderId: string, enabled: boolean) => void
  deepResearchPhase: DeepResearchPhase | null
  webSearchActive: boolean
  ragSearching: boolean
  memoryToastVisible: boolean
  webSourcesToast: { count: number } | null
  // Muda a cada troca de conversa: limpa o rascunho.
  resetKey: string | null
  rows: number
  // Agente da conversa: seletor e atalho "/agente" (sem agentes = escondidos).
  agentId: string
  agentsAvailable: boolean
  onSelectAgent: (id: string) => void
  // `agentId` vem do atalho "/agente texto".
  onSend: (text: string, images?: string[], docs?: DraftDoc[], agentId?: string) => void
  onStop: () => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  // So no Assistant: print da tela (data URL), anexado como imagem colada.
  onCaptureScreen?: () => Promise<string>
  // Abre o Settings na seção que resolve o aviso (chave do Tavily). Ausente:
  // o aviso fica só com o texto.
  onOpenSettings?: (section: 'search') => void
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function ChatComposer({
  hasApiKey,
  isStreaming,
  selectedModel,
  tools,
  setTool,
  thinkingEnabled,
  toggleThinking,
  activeFolder,
  setFolderMemoryEnabled,
  setFolderWebResearchEnabled,
  deepResearchPhase,
  webSearchActive,
  ragSearching,
  memoryToastVisible,
  webSourcesToast,
  resetKey,
  rows,
  agentId,
  agentsAvailable,
  onSelectAgent,
  onSend,
  onStop,
  inputRef,
  onCaptureScreen,
  onOpenSettings,
}: ChatComposerProps) {
  const [draft, setDraft] = useState('')
  const shortcut = useAgentShortcut(draft, setDraft, agentsAvailable)
  const [draftImages, setDraftImages] = useState<string[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [draftDocs, setDraftDocs] = useState<DraftDoc[]>([])
  const [docError, setDocError] = useState<string | null>(null)
  const [isPdfProcessing, setIsPdfProcessing] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  // Conversa atual, lida depois do await da captura.
  const resetKeyRef = useRef(resetKey)
  // Miniatura do anexo (ex.: print do Assistant): conferir antes de enviar.
  const imageViewer = useImageViewer()

  // Limpa o draft ao trocar de conversa
  useEffect(() => {
    resetKeyRef.current = resetKey
    setDraft('')
    setDraftImages([])
    setImageError(null)
    setDraftDocs([])
    setDocError(null)
  }, [resetKey])

  // Estado efetivo dos toggles pelo agente da conversa: o agente que não usa
  // web search ou deep research os desliga no turno (o toggle fica guardado).
  const agent = findChatAgent(agentsAvailable ? agentId : undefined)
  // Placeholder e mensagem padrão do agente ativo: Coach e Plan week enviam
  // com o rascunho vazio (o app monta o contexto).
  const agentHint = agentsAvailable ? chatAgentComposerHint(agentId) : null
  const deepResearchOffByAgent = !agent.context.deepResearch
  const effectiveDeepResearch = tools.deepResearch && !deepResearchOffByAgent
  const effectiveWebSearch = tools.webSearch && agent.context.web
  const needsTavily = effectiveDeepResearch || effectiveWebSearch

  // Web search ou deep research sem a chave do Tavily: o envio fica parado (o
  // rascunho não se perde) e o aviso leva ao Settings. Checado ao ligar, na
  // montagem, ao focar a caixa, quando a chave muda no Settings desta janela
  // e na volta à janela (chave salva na outra).
  const [tavilyMissing, setTavilyMissing] = useState(false)
  const tavilyCheckRef = useRef(0)
  const checkTavily = () => {
    if (!needsTavily) {
      setTavilyMissing(false)
      return
    }
    const check = ++tavilyCheckRef.current
    void hasTavilyKey().then((ok) => {
      if (check === tavilyCheckRef.current) setTavilyMissing(!ok)
    })
  }
  useEffect(() => {
    checkTavily()
    if (!needsTavily) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkTavily()
    }
    window.addEventListener(TAVILY_KEY_CHANGED_EVENT, checkTavily)
    window.addEventListener('focus', checkTavily)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(TAVILY_KEY_CHANGED_EVENT, checkTavily)
      window.removeEventListener('focus', checkTavily)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // checkTavily só depende de needsTavily.
  }, [needsTavily])

  const modelSupportsVision = selectedModel?.supportsVision ?? false
  const visionWarning = draftImages.length > 0 && !modelSupportsVision
  const hasDraft = draft.trim().length > 0 || draftImages.length > 0 || draftDocs.length > 0
  const tavilyBlocked = needsTavily && tavilyMissing

  const canSend =
    !isStreaming &&
    !isPdfProcessing &&
    hasApiKey &&
    (hasDraft || !!agentHint?.defaultMessage) &&
    !!selectedModel &&
    !visionWarning &&
    !tavilyBlocked

  const sendTitle = !selectedModel
    ? 'Select a model first'
    : tavilyBlocked
      ? 'Add a Tavily key in Settings, or turn off web search'
      : undefined

  function handleSend() {
    const parsed = agentsAvailable ? parseAgentShortcut(draft) : null
    const hasAttachments = draftImages.length > 0 || draftDocs.length > 0
    // Sem texto, o agente que não pede pergunta manda a mensagem padrão dele.
    const fallback = agentsAvailable
      ? (chatAgentComposerHint(parsed ? parsed.agent.id : agentId)?.defaultMessage ?? '')
      : ''
    if (parsed && !parsed.rest && !hasAttachments && (!fallback || !canSend)) {
      // Só o comando: liga o seletor (vale também durante o streaming).
      onSelectAgent(parsed.agent.id)
      setDraft('')
      return
    }
    if (!canSend) return
    const typed = parsed ? parsed.rest : draft
    const text = typed.trim() ? typed : fallback || typed
    const images = draftImages
    const docs = draftDocs
    setDraft('')
    setDraftImages([])
    setImageError(null)
    setDraftDocs([])
    setDocError(null)
    onSend(text, images.length > 0 ? images : undefined, docs.length > 0 ? docs : undefined, parsed?.agent.id)
  }

  async function handleCaptureScreen() {
    if (!onCaptureScreen || isCapturing) return
    setIsCapturing(true)
    setImageError(null)
    const key = resetKeyRef.current
    try {
      const image = await onCaptureScreen()
      // A conversa mudou durante a captura: o print era da anterior.
      if (resetKeyRef.current !== key) return
      setDraftImages((prev) => [...prev, image])
      inputRef.current?.focus()
    } catch (err) {
      if (resetKeyRef.current !== key) return
      setImageError(typeof err === 'string' ? err : 'Could not capture the screen.')
    } finally {
      setIsCapturing(false)
    }
  }

  // Imagens coladas ou escolhidas: todas entram (cada uma lida à parte, na
  // ordem); acima de 5 MB fica de fora com aviso.
  function addImageFiles(files: File[]) {
    const tooBig = files.filter((f) => f.size > MAX_ATTACHMENT_BYTES)
    const ok = files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)
    if (tooBig.length > 0) {
      setImageError(
        tooBig.length === 1
          ? `Image exceeds the 5 MB limit${tooBig[0].name ? `: ${tooBig[0].name}` : ''}.`
          : `${tooBig.length} images exceed the 5 MB limit and were not attached.`
      )
    }
    if (ok.length === 0) return
    const key = resetKeyRef.current
    void Promise.all(ok.map((f) => readAsDataUrl(f).catch(() => null))).then((urls) => {
      if (resetKeyRef.current !== key) return
      const read = urls.filter((u): u is string => !!u)
      if (read.length > 0) setDraftImages((prev) => [...prev, ...read])
    })
  }

  function resolveFileType(file: File): string {
    if (file.type) return file.type
    if (file.name.endsWith('.md')) return 'text/markdown'
    if (file.name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (file.name.endsWith('.pdf')) return 'application/pdf'
    return 'text/plain'
  }

  function handlePickFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,text/plain,text/markdown,.md,.pdf'
    input.multiple = true
    input.onchange = () => {
      const files = Array.from(input.files ?? [])
      if (files.length === 0) return
      setDocError(null)
      setImageError(null)
      const errors: string[] = []
      const images: File[] = []
      for (const file of files) {
        const mime = resolveFileType(file)
        const isImage = mime.startsWith('image/')
        const isText = mime.startsWith('text/')
        const isPdf = mime === 'application/pdf'
        const isDocx = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        if (isDocx) {
          errors.push('DOCX files are not supported yet. Please convert to PDF, TXT or Markdown.')
          continue
        }
        if (!isImage && !isText && !isPdf) {
          errors.push(`File type not supported: ${file.name}`)
          continue
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          errors.push(`File exceeds the 5 MB limit: ${file.name}`)
          continue
        }
        if (isImage) {
          images.push(file)
        } else if (isText) {
          // Text files are sent inline as message text — works with all models
          const reader = new FileReader()
          reader.onload = () =>
            setDraftDocs((prev) => [...prev, { name: file.name, type: mime, data: reader.result as string }])
          reader.readAsText(file)
        } else {
          // PDF — extract text in the backend and send inline as plain text.
          // This works with any model and avoids provider-specific document formats.
          const reader = new FileReader()
          reader.onload = async () => {
            const buffer = reader.result as ArrayBuffer
            const bytes = Array.from(new Uint8Array(buffer))
            setIsPdfProcessing(true)
            try {
              const extracted = await invoke<string>('extract_pdf_text', { bytes })
              setDraftDocs((prev) => [
                ...prev,
                { name: file.name, type: 'text/plain', data: extracted },
              ])
            } catch (err) {
              const message = typeof err === 'string' ? err : 'Failed to read PDF'
              setDocError(`${file.name}: ${message}`)
            } finally {
              setIsPdfProcessing(false)
            }
          }
          reader.readAsArrayBuffer(file)
        }
      }
      if (images.length > 0) addImageFiles(images)
      if (errors.length > 0) {
        setDocError(errors.join(' '))
      }
    }
    input.click()
  }

  return (
    <footer className={styles.composer}>
      <div className={styles.composerInner}>
        {(draftImages.length > 0 || draftDocs.length > 0) && (
          <div className={styles.attachmentPreviews}>
            {draftImages.map((url, i) => (
              <div key={i} className={styles.imagePreview}>
                <img
                  src={url}
                  alt={`attachment preview ${i + 1}`}
                  className={styles.imagePreviewThumb}
                  title="Open image"
                  onClick={() => imageViewer.open(url)}
                />
                <button
                  type="button"
                  className={styles.imagePreviewRemove}
                  onClick={() => setDraftImages((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove image ${i + 1}`}
                  title="Remove image"
                >
                  <X size={10} weight="bold" aria-hidden />
                </button>
              </div>
            ))}
            {draftDocs.map((doc, i) => (
              <div key={i} className={styles.docPill}>
                <span className={styles.docPillName}>{doc.name}</span>
                <button
                  type="button"
                  className={styles.docPillRemove}
                  onClick={() => setDraftDocs((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove ${doc.name}`}
                  title="Remove file"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        {isPdfProcessing && (
          <div className={styles.pdfProcessing} role="status" aria-live="polite">
            Processing document...
          </div>
        )}
        {deepResearchPhase && (
          <div className={styles.deepResearchProgress} role="status" aria-live="polite">
            <span className={styles.deepResearchDot} aria-hidden="true" />
            {deepResearchPhase === 'searching' && 'Searching the web...'}
            {deepResearchPhase === 'expanding' && 'Generating sub-queries...'}
            {deepResearchPhase === 'broadening' && 'Exploring related topics...'}
            {deepResearchPhase === 'ranking' && 'Ranking results...'}
            {deepResearchPhase === 'synthesizing' && 'Preparing synthesis...'}
          </div>
        )}
        {webSearchActive && (
          <div className={styles.webSearchProgress} role="status" aria-live="polite">
            <span className={styles.webSearchDot} aria-hidden="true" />
            Searching the web...
          </div>
        )}
        {ragSearching && <RagSearchStatus />}
        {memoryToastVisible && (
          <div className={styles.webSearchProgress} role="status" aria-live="polite">
            <span className={styles.webSearchDot} aria-hidden="true" />
            Folder memory updated
          </div>
        )}
        {webSourcesToast && (
          <div className={styles.webSearchProgress} role="status" aria-live="polite">
            <span className={styles.webSearchDot} aria-hidden="true" />
            {webSourcesToast.count === 1
              ? '1 source saved to the knowledge base'
              : `${webSourcesToast.count} sources saved to the knowledge base`}
          </div>
        )}
        {tavilyBlocked && (
          <div className={styles.noticeWithActions} role="alert">
            <span>
              {effectiveDeepResearch ? 'Deep Research' : 'Web Search'} needs a Tavily key. Add it in Settings, or turn
              it off to send.
            </span>
            <div className={styles.noticeActions}>
              {onOpenSettings && (
                <button type="button" className={styles.noticeBtn} onClick={() => onOpenSettings('search')}>
                  <GearSix size={12} aria-hidden />
                  Open Settings
                </button>
              )}
              <button
                type="button"
                className={styles.noticeBtn}
                onClick={() => setTool(effectiveDeepResearch ? 'deepResearch' : 'webSearch', false)}
              >
                Turn off
              </button>
            </div>
          </div>
        )}
        {visionWarning && (
          <div className={styles.visionWarning} role="alert">
            This model does not support images. Switch to a vision-capable model or remove the image.
          </div>
        )}
        {imageError && (
          <div className={styles.visionWarning} role="alert">
            {imageError}
          </div>
        )}
        {docError && (
          <div className={styles.visionWarning} role="alert">
            {docError}
          </div>
        )}
        {hasApiKey && !selectedModel && hasDraft && (
          <div className={styles.visionWarning} role="status">
            Select a model to send this message.
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
          onFocus={checkTavily}
          onKeyDown={(e) => {
            if (shortcut.onKeyDown(e)) return
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.items)
              .filter((item) => item.type.startsWith('image/'))
              .map((item) => item.getAsFile())
              .filter((f): f is File => !!f)
            if (files.length === 0) return
            e.preventDefault()
            setImageError(null)
            addImageFiles(files)
          }}
          placeholder={
            hasApiKey
              ? (agentHint?.placeholder ?? 'Write a message...')
              : 'Configure your OpenRouter key to get started.'
          }
          rows={rows}
          disabled={!hasApiKey}
          aria-label="message"
        />
        <div className={styles.composerActions}>
          {agentsAvailable && <AgentPicker agentId={agentId} onSelect={onSelectAgent} />}
          {onCaptureScreen && (
            <button
              type="button"
              className={styles.captureBtn}
              onClick={() => void handleCaptureScreen()}
              title={isCapturing ? 'Capturing screen...' : 'Attach screenshot'}
              aria-label="Attach screenshot"
              aria-busy={isCapturing}
              disabled={!hasApiKey || isCapturing}
            >
              <Monitor size={15} />
            </button>
          )}
          <button
            type="button"
            className={effectiveDeepResearch ? styles.deepResearchBtnOn : styles.deepResearchBtn}
            onClick={() => {
              if (deepResearchOffByAgent) return
              setTool('deepResearch', !tools.deepResearch)
            }}
            title={
              deepResearchOffByAgent
                ? `${agent.label} doesn't use Deep Research`
                : tools.deepResearch
                  ? 'Deep Research enabled — click to disable'
                  : 'Enable Deep Research'
            }
            aria-pressed={effectiveDeepResearch}
            aria-disabled={deepResearchOffByAgent || undefined}
          >
            <MagnifyingGlassPlus
              size={15}
              weight={effectiveDeepResearch ? 'bold' : 'regular'}
              aria-hidden
              className={styles.deepResearchIcon}
            />
            <span className={styles.deepResearchLabel}>Deep Research</span>
          </button>
          <button
            type="button"
            className={thinkingEnabled ? styles.thinkingBtnOn : styles.thinkingBtn}
            onClick={toggleThinking}
            title={thinkingEnabled ? 'Thinking enabled — click to disable' : 'Enable thinking'}
            aria-label="Thinking"
            aria-pressed={thinkingEnabled}
          >
            <Brain size={15} weight={thinkingEnabled ? 'fill' : 'regular'} />
          </button>
          <button
            type="button"
            className={styles.attachBtn}
            onClick={handlePickFile}
            title="Attach file"
            aria-label="Attach file"
            disabled={!hasApiKey}
          >
            <Paperclip size={15} />
          </button>
          <ChatToolsMenu
            tools={tools}
            onToggle={setTool}
            folderMemory={activeFolder ? { enabled: activeFolder.memoryEnabled } : null}
            onToggleFolderMemory={(v) => activeFolder && setFolderMemoryEnabled(activeFolder.id, v)}
            folderWebResearch={activeFolder ? { enabled: activeFolder.webResearchEnabled } : null}
            onToggleFolderWebResearch={(v) => activeFolder && setFolderWebResearchEnabled(activeFolder.id, v)}
            tasksTool={{ supported: selectedModel?.supportsTools ?? false }}
            dailyNotesTool={{ supported: selectedModel?.supportsTools ?? false }}
            notesTool={{ supported: selectedModel?.supportsTools ?? false }}
            agent={agent}
          />
          {isStreaming ? (
            <button
              type="button"
              className={styles.stopBtn}
              onClick={() => onStop()}
            >
              <Stop size={14} weight="fill" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!canSend}
              title={sendTitle}
            >
              Send
            </button>
          )}
        </div>
      </div>
      {imageViewer.viewer}
    </footer>
  )
}
