import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowClockwise,
  ChatCircleText,
  Check,
  FloppyDisk,
  FolderOpen,
  Notebook as NotebookIcon,
  PencilSimple,
  Play,
  StopCircle,
  Trash,
  X,
} from '@phosphor-icons/react'
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener'
import type { Note, Notebook } from '../../types'
import { useMincerProgress, type MincerJobState } from '../../hooks/useMincerJob'
import type { useConfirm } from '../../hooks/useConfirm'
import {
  createMincerChatConversation,
  deleteMincerChatFolder,
  getMincerChatFolderId,
} from '../../hooks/useChat'
import { renderMarkdown } from '../../lib/markdown'
import {
  KIND_LABELS,
  MINCER_SAVE_FOLDER_KEY,
  STAGE_LABELS,
  isTranscriptKind,
  mincerCancel,
  mincerDelete,
  mincerGet,
  mincerMarkSentToNotebook,
  mincerPickFolder,
  mincerRegenerateSummary,
  mincerRename,
  mincerResume,
  mincerSaveFiles,
  resolveSummaryModel,
  splitMincerError,
  type MincerItem,
} from '../../lib/mincer'
import { SaveToNoteModal } from '../ChatPanel/SaveToNoteModal'
import { SummaryOptions } from './SummaryOptions'
import {
  describeSummarySettings,
  resolveSummaryPrompt,
  summarySettingsFromItem,
  type SummarySettings,
} from './presets'
import shared from './Mincer.module.css'
import styles from './MincerItemView.module.css'

interface MincerItemViewProps {
  itemId: string
  job: MincerJobState
  confirm: ReturnType<typeof useConfirm>['confirm']
  onDeleted: () => void
  onChanged: () => void
  notebooks: Notebook[]
  notes: Note[]
  onCreateNotebook: (name: string) => Promise<Notebook>
  onCreateNote: (notebookId: string, title: string, content: string) => Promise<Note>
  onSaveNote: (note: Note) => Promise<void>
  onNavigateToNote: (notebookId: string, noteId: string) => void
  onOpenChat: () => void
}

type Tab = 'summary' | 'text'

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message === 'OPENROUTER_KEY_MISSING' ? 'Add your OpenRouter key in Settings.' : message
}

function readSaveFolder(): string | null {
  try {
    return localStorage.getItem(MINCER_SAVE_FOLDER_KEY)
  } catch {
    return null
  }
}

function writeSaveFolder(folder: string) {
  try {
    localStorage.setItem(MINCER_SAVE_FOLDER_KEY, folder)
  } catch {
    // sem storage: a pasta é pedida de novo na próxima vez
  }
}

// Linha de origem no topo da nota: de onde veio e que é conteúdo de IA.
function noteOriginLine(item: MincerItem, hasSummary: boolean, textLabel: string): string {
  const parts: string[] = []
  if (item.source) {
    const source = /^https?:\/\//.test(item.source)
      ? `<${item.source}>`
      : (item.source.split(/[\\/]/).pop() ?? item.source)
    parts.push(`Source: ${source}`)
  }
  if (hasSummary) {
    const how = describeSummarySettings(summarySettingsFromItem(item.preset, item.summaryPrompt))
    parts.push(`Mincer summary (${item.summaryModel ? `${how}, ${item.summaryModel}` : how})`)
  } else {
    parts.push(item.kind === 'web_capture' ? 'Captured by Mincer' : `${textLabel} from Mincer`)
  }
  parts.push(new Date(item.createdAt).toLocaleDateString())
  return `*${parts.join(' · ')}*`
}

export function MincerItemView({
  itemId,
  job,
  confirm,
  onDeleted,
  onChanged,
  notebooks,
  notes,
  onCreateNotebook,
  onCreateNote,
  onSaveNote,
  onNavigateToNote,
  onOpenChat,
}: MincerItemViewProps) {
  const [item, setItem] = useState<MincerItem | null>(null)
  const [tab, setTab] = useState<Tab | null>(null)
  const [html, setHtml] = useState('')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [savedDir, setSavedDir] = useState<string | null>(null)
  const [regenSettings, setRegenSettings] = useState<SummarySettings | null>(null)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [includeTranscript, setIncludeTranscript] = useState(false)
  const progress = useMincerProgress(itemId)

  const load = useCallback(async () => {
    try {
      setItem(await mincerGet(itemId))
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }, [itemId])

  useEffect(() => {
    void load()
  }, [load, job.revision])

  const summary = item?.summary?.trim() ?? ''
  const transcript = item?.transcript?.trim() ?? ''

  useEffect(() => {
    let cancelled = false
    if (!summary) {
      setHtml('')
      return
    }
    renderMarkdown(summary).then((out) => {
      if (!cancelled) setHtml(out)
    })
    return () => {
      cancelled = true
    }
  }, [summary])
  // React 19 reescreve o innerHTML quando o objeto muda (quebra a seleção).
  const markup = useMemo(() => ({ __html: html }), [html])

  if (!item) {
    return actionError ? <p className={`${shared.error} ${styles.pad}`}>{actionError}</p> : null
  }

  const isCapture = item.kind === 'web_capture'
  const isTranscript = isTranscriptKind(item.kind, item.source)
  const textLabel = isTranscript ? 'Transcript' : 'Text'
  const activeTab: Tab = tab ?? (summary && !isCapture ? 'summary' : 'text')
  const live = job.activeItemId === item.id ? progress : null
  const stage = live ? live.stage : item.stage
  const current = live ? live.current : item.progressCurrent
  const total = live ? live.total : item.progressTotal
  const busy = item.status === 'running' || item.status === 'queued'
  const hasContent = !!summary || !!transcript
  const chatFolderId = getMincerChatFolderId(item.id)

  async function act(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
      onChanged()
      await load()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  async function handleRename() {
    const title = editingTitle?.trim()
    setEditingTitle(null)
    if (!item || !title || title === item.title) return
    await act(() => mincerRename(item.id, title))
  }

  async function handleSave(pickNew: boolean) {
    if (!item) return
    setActionError(null)
    try {
      let folder = pickNew ? null : readSaveFolder()
      if (!folder) {
        folder = await mincerPickFolder()
        if (!folder) return
        writeSaveFolder(folder)
      }
      setSavedDir(await mincerSaveFiles(item.id, folder))
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  async function handleRegenerate() {
    if (!item || !regenSettings) return
    const summaryModel = resolveSummaryModel()
    if (!summaryModel) {
      setActionError('Choose a summary model in Settings.')
      return
    }
    await act(() =>
      mincerRegenerateSummary(item.id, {
        summaryModel,
        preset: regenSettings.presetId,
        summaryPrompt: resolveSummaryPrompt(regenSettings),
      })
    )
    setRegenSettings(null)
  }

  async function handleDelete() {
    if (!item) return
    const ok = await confirm('Delete this item? Its Mincer chat folder and conversations are deleted too.', {
      title: 'Delete item',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    setActionError(null)
    try {
      await mincerDelete(item.id)
      deleteMincerChatFolder(item.id)
      onDeleted()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  function handleSendToChat() {
    if (!item) return
    const firstMessage =
      summary || `Captured text from **${item.title}** is attached to this conversation as context.`
    createMincerChatConversation({ itemId: item.id, title: item.title, firstMessage })
    onOpenChat()
  }

  const originLine = noteOriginLine(item, !!summary, textLabel)
  const textSection = isTranscript
    ? `## Transcript\n\n*Transcribed by Mincer${item.transcriptionModel ? ` (${item.transcriptionModel})` : ''}*\n\n${transcript}`
    : `## Original text\n\n${transcript}`
  const noteContent = summary
    ? includeTranscript && transcript
      ? `${originLine}\n\n${summary}\n\n${textSection}`
      : `${originLine}\n\n${summary}`
    : `${originLine}\n\n${transcript}`
  const regenLabel = describeSummarySettings(summarySettingsFromItem(item.preset, item.summaryPrompt))
  const errorParts = item.error ? splitMincerError(item.error) : null

  let stageDetail = ''
  if (stage === 'transcribing' && total > 0) stageDetail = ` — part ${Math.min(current + 1, total)} of ${total}`
  else if (stage === 'downloading') stageDetail = ` — ${current}%`

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        {editingTitle !== null ? (
          <input
            className={styles.titleInput}
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRename()
              if (e.key === 'Escape') setEditingTitle(null)
            }}
            onBlur={() => void handleRename()}
            autoFocus
          />
        ) : (
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{item.title || 'Untitled'}</h2>
            <button
              type="button"
              className={shared.ghost}
              onClick={() => setEditingTitle(item.title)}
              aria-label="Rename"
              title="Rename"
            >
              <PencilSimple size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        <p className={styles.meta}>
          <span>{KIND_LABELS[item.kind] ?? item.kind}</span>
          {item.source && (
            <>
              <span aria-hidden="true">·</span>
              {/^https?:\/\//.test(item.source) ? (
                <button type="button" className={`${shared.linkButton} ${styles.source}`} onClick={() => void openUrl(item.source!)}>
                  {item.source}
                </button>
              ) : (
                <span className={styles.source}>{item.source}</span>
              )}
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{new Date(item.createdAt).toLocaleString()}</span>
        </p>
      </header>

      {item.status === 'queued' && (
        <div className={styles.banner}>
          <span className={shared.muted}>Queued — starts when the items ahead of it finish.</span>
          <button type="button" className={shared.secondary} onClick={() => void act(() => mincerCancel(item.id))}>
            <X size={14} aria-hidden="true" />
            Remove from queue
          </button>
        </div>
      )}

      {item.status === 'running' && (
        <div className={styles.progressBox}>
          <div className={styles.progressHead}>
            <span className={styles.stage} aria-live="polite">
              {(stage && STAGE_LABELS[stage]) || 'Starting'}
              {stageDetail}
            </span>
            <button type="button" className={shared.secondary} onClick={() => void act(() => mincerCancel(item.id))}>
              <StopCircle size={14} aria-hidden="true" />
              Cancel
            </button>
          </div>
          <div className={styles.bar} role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={total || undefined} aria-valuenow={total > 0 ? current : undefined}>
            {total > 0 ? (
              <div className={styles.barFill} style={{ width: `${Math.min(100, (current / total) * 100)}%` }} />
            ) : (
              <div className={styles.barIndeterminate} />
            )}
          </div>
        </div>
      )}

      {(item.status === 'error' || item.status === 'cancelled' || item.status === 'interrupted') && (
        // Cancelar é escolha do usuário: banner neutro, não o de erro.
        <div className={item.status === 'cancelled' ? styles.banner : styles.errorBanner}>
          <div className={styles.bannerText}>
            <span>{errorParts ? errorParts.message : 'This item did not finish.'}</span>
            {errorParts?.detail && (
              <details className={styles.errorDetail}>
                <summary>Technical details</summary>
                <pre>{errorParts.detail}</pre>
              </details>
            )}
          </div>
          <button type="button" className={shared.secondary} onClick={() => void act(() => mincerResume(item.id))}>
            <Play size={14} aria-hidden="true" />
            Resume
          </button>
        </div>
      )}

      {!busy && hasContent && (
        <div className={styles.actions}>
          <span className={styles.noteGroup}>
            <button type="button" className={shared.secondary} onClick={() => setNoteModalOpen(true)}>
              <NotebookIcon size={14} aria-hidden="true" />
              Send to notebook
            </button>
            {summary && transcript && (
              <label className={styles.includeTranscript}>
                <input
                  type="checkbox"
                  checked={includeTranscript}
                  onChange={(e) => setIncludeTranscript(e.target.checked)}
                />
                Include {textLabel.toLowerCase()} in note
              </label>
            )}
            {item.sentToNotebookAt !== null && (
              <span className={styles.sent} title={new Date(item.sentToNotebookAt).toLocaleString()}>
                <Check size={12} aria-hidden="true" />
                Sent to notebook
              </span>
            )}
          </span>
          <button type="button" className={shared.secondary} onClick={handleSendToChat}>
            <ChatCircleText size={14} aria-hidden="true" />
            {chatFolderId ? 'Open in Chat' : 'Send to Chat'}
          </button>
          <button type="button" className={shared.secondary} onClick={() => void handleSave(false)}>
            <FloppyDisk size={14} aria-hidden="true" />
            Save .md
          </button>
          {!isCapture && transcript && (
            <button
              type="button"
              className={shared.secondary}
              onClick={() =>
                setRegenSettings((v) => (v ? null : summarySettingsFromItem(item.preset, item.summaryPrompt)))
              }
              aria-expanded={regenSettings !== null}
            >
              <ArrowClockwise size={14} aria-hidden="true" />
              Regenerate
            </button>
          )}
          <button type="button" className={shared.danger} onClick={() => void handleDelete()}>
            <Trash size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
      {(item.status === 'queued' || (!busy && !hasContent)) && (
        <div className={styles.actions}>
          <button type="button" className={shared.danger} onClick={() => void handleDelete()}>
            <Trash size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
      )}

      {savedDir && (
        <div className={styles.savedRow}>
          <span className={shared.muted}>Saved to {savedDir}</span>
          <button type="button" className={shared.ghost} onClick={() => void revealItemInDir(savedDir)}>
            <FolderOpen size={14} aria-hidden="true" />
            Open folder
          </button>
          <button type="button" className={shared.linkButton} onClick={() => void handleSave(true)}>
            Change folder
          </button>
        </div>
      )}

      {regenSettings && (
        <div className={styles.regen}>
          <p className={shared.muted}>Current summary: {summary ? regenLabel : 'none'}</p>
          <SummaryOptions value={regenSettings} onChange={setRegenSettings} />
          <div className={styles.regenActions}>
            <button type="button" className={shared.primary} onClick={() => void handleRegenerate()}>
              Regenerate summary
            </button>
            <span className={shared.muted}>The new summary replaces the current one when it is ready.</span>
          </div>
        </div>
      )}

      {actionError && <p className={shared.error}>{actionError}</p>}

      {hasContent && (
        <>
          <div className={styles.tabs} role="tablist">
            {!isCapture && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'summary'}
                className={activeTab === 'summary' ? styles.tabActive : styles.tab}
                onClick={() => setTab('summary')}
              >
                Summary
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'text'}
              className={activeTab === 'text' ? styles.tabActive : styles.tab}
              onClick={() => setTab('text')}
            >
              {textLabel}
            </button>
          </div>
          {activeTab === 'summary' && !isCapture ? (
            summary ? (
              <div
                className={styles.markdown}
                dangerouslySetInnerHTML={markup}
                onClick={(e) => {
                  const href = (e.target as HTMLElement).closest('a')?.getAttribute('href')
                  if (!href) return
                  e.preventDefault()
                  if (href.startsWith('http')) void openUrl(href)
                }}
              />
            ) : (
              <p className={shared.muted}>No summary yet.</p>
            )
          ) : transcript ? (
            <div className={styles.transcript}>{transcript}</div>
          ) : (
            <p className={shared.muted}>No text yet.</p>
          )}
        </>
      )}

      <SaveToNoteModal
        open={noteModalOpen}
        content={noteContent}
        plain
        defaultNoteTitle={item.title}
        notebooks={notebooks}
        notes={notes}
        onCreateNotebook={onCreateNotebook}
        onCreateNote={async (notebookId, title, content) => {
          const note = await onCreateNote(notebookId, title, content)
          void act(() => mincerMarkSentToNotebook(item.id))
          return note
        }}
        onSaveNote={async (note) => {
          await onSaveNote(note)
          void act(() => mincerMarkSentToNotebook(item.id))
        }}
        onNavigateToNote={onNavigateToNote}
        onClose={() => setNoteModalOpen(false)}
      />
    </div>
  )
}
