import { invoke } from '@tauri-apps/api/core'
import { Brain, Monitor, Paperclip, Stop } from '@phosphor-icons/react'
import deepGrayIcon from '../../assets/icons/deep-gray.svg'
import deepGreenIcon from '../../assets/icons/deep-green.svg'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatFolder, ChatTools } from '../../hooks/useChat'
import type { DeepResearchPhase } from '../../lib/deepResearch'
import type { AiModel } from '../../types'
import { ChatToolsMenu } from './ChatToolsMenu'
import { RagSearchStatus } from './RagSearchStatus'
import styles from './ChatComposer.module.css'

type DraftDoc = { name: string; type: string; data: string }

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
  onSend: (text: string, image?: string, docs?: DraftDoc[]) => void
  onStop: () => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  // So no Assistant: print da tela (data URL), anexado como imagem colada.
  onCaptureScreen?: () => Promise<string>
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
  onSend,
  onStop,
  inputRef,
  onCaptureScreen,
}: ChatComposerProps) {
  const [draft, setDraft] = useState('')
  const [draftImage, setDraftImage] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [draftDocs, setDraftDocs] = useState<DraftDoc[]>([])
  const [docError, setDocError] = useState<string | null>(null)
  const [isPdfProcessing, setIsPdfProcessing] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  // Conversa atual, lida depois do await da captura.
  const resetKeyRef = useRef(resetKey)

  // Limpa o draft ao trocar de conversa
  useEffect(() => {
    resetKeyRef.current = resetKey
    setDraft('')
    setDraftImage(null)
    setImageError(null)
    setDraftDocs([])
  }, [resetKey])

  const modelSupportsVision = selectedModel?.supportsVision ?? false
  const visionWarning = !!draftImage && !modelSupportsVision

  const canSend =
    !isStreaming &&
    !isPdfProcessing &&
    hasApiKey &&
    (draft.trim().length > 0 || !!draftImage || draftDocs.length > 0) &&
    !!selectedModel &&
    !visionWarning

  function handleSend() {
    if (!canSend) return
    const text = draft
    const img = draftImage
    const docs = draftDocs
    setDraft('')
    setDraftImage(null)
    setImageError(null)
    setDraftDocs([])
    onSend(text, img ?? undefined, docs.length > 0 ? docs : undefined)
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
      setDraftImage(image)
      inputRef.current?.focus()
    } catch (err) {
      if (resetKeyRef.current !== key) return
      setImageError(typeof err === 'string' ? err : 'Could not capture the screen.')
    } finally {
      setIsCapturing(false)
    }
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
        if (file.size > 5 * 1024 * 1024) {
          errors.push(`File exceeds the 5 MB limit: ${file.name}`)
          continue
        }
        if (isImage) {
          const reader = new FileReader()
          reader.onload = () => setDraftImage(reader.result as string)
          reader.readAsDataURL(file)
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
      if (errors.length > 0) {
        setDocError(errors.join(' '))
      }
    }
    input.click()
  }

  return (
    <footer className={styles.composer}>
      <div className={styles.composerInner}>
        {(draftImage || draftDocs.length > 0) && (
          <div className={styles.attachmentPreviews}>
            {draftImage && (
              <div className={styles.imagePreview}>
                <img src={draftImage} alt="attachment preview" className={styles.imagePreviewThumb} />
                <button
                  type="button"
                  className={styles.imagePreviewRemove}
                  onClick={() => setDraftImage(null)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            )}
            {draftDocs.map((doc, i) => (
              <div key={i} className={styles.docPill}>
                <span className={styles.docPillName}>{doc.name}</span>
                <button
                  type="button"
                  className={styles.docPillRemove}
                  onClick={() => setDraftDocs((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove ${doc.name}`}
                >
                  ×
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
        <textarea
          ref={inputRef}
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData.items)
            const imageItem = items.find((item) => item.type.startsWith('image/'))
            if (!imageItem) return
            e.preventDefault()
            setImageError(null)
            const file = imageItem.getAsFile()
            if (!file) return
            if (file.size > 5 * 1024 * 1024) return
            const reader = new FileReader()
            reader.onload = () => setDraftImage(reader.result as string)
            reader.readAsDataURL(file)
          }}
          placeholder={
            hasApiKey
              ? 'Write a message...'
              : 'Configure your OpenRouter key to get started.'
          }
          rows={rows}
          disabled={!hasApiKey}
          aria-label="message"
        />
        <div className={styles.composerActions}>
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
            className={tools.deepResearch ? styles.deepResearchBtnOn : styles.deepResearchBtn}
            onClick={() => setTool('deepResearch', !tools.deepResearch)}
            title={tools.deepResearch ? 'Deep Research enabled — click to disable' : 'Enable Deep Research'}
            aria-pressed={tools.deepResearch}
          >
            <img src={tools.deepResearch ? deepGreenIcon : deepGrayIcon} alt="" aria-hidden="true" className={styles.deepResearchIcon} />
            <span className={styles.deepResearchLabel}>Deep Research</span>
          </button>
          <button
            type="button"
            className={thinkingEnabled ? styles.thinkingBtnOn : styles.thinkingBtn}
            onClick={toggleThinking}
            title={thinkingEnabled ? 'Thinking enabled — click to disable' : 'Enable thinking'}
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
            >
              Send
            </button>
          )}
        </div>
      </div>
    </footer>
  )
}
