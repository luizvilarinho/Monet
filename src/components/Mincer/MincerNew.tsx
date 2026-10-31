import { useEffect, useState } from 'react'
import { FileAudio, Microphone, Plus, StopCircle, Trash } from '@phosphor-icons/react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { MincerJobState } from '../../hooks/useMincerJob'
import type { useConfirm } from '../../hooks/useConfirm'
import type { SettingsSection } from '../Settings/SettingsModal'
import {
  formatElapsed,
  getTranscriptionModel,
  isTextFile,
  mincerPickFiles,
  mincerRecordDiscard,
  mincerRecordExtend,
  mincerRecordStart,
  mincerRecordStatus,
  mincerRecordStop,
  mincerStart,
  onMincerLevel,
  resolveSummaryModel,
  type MincerJobOptions,
  type MincerKind,
  type MincerLevel,
} from '../../lib/mincer'
import { SummaryOptions } from './SummaryOptions'
import { loadSummarySettings, resolveSummaryPrompt, saveSummarySettings, type SummarySettings } from './presets'
import shared from './Mincer.module.css'
import styles from './MincerNew.module.css'

type Mode = 'file' | 'paste' | 'record' | 'youtube' | 'web'

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'file', label: 'File' },
  { id: 'paste', label: 'Paste' },
  { id: 'record', label: 'Record' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'web', label: 'Web page' },
]

interface MincerNewProps {
  job: MincerJobState
  confirm: ReturnType<typeof useConfirm>['confirm']
  // Sem nenhum item ainda: mostra a linha que explica o Mincer.
  showIntro: boolean
  missingApiKey: boolean
  onStarted: (id: string) => void
  // Só recarrega o histórico (Start de vários arquivos com falha parcial).
  onQueued: () => void
  onOpenSettings: (section: SettingsSection) => void
}

// Rascunho da tela New: sobrevive à troca de modo (a tela é desmontada), não
// a reiniciar o app.
const draft = {
  mode: 'file' as Mode,
  filePaths: [] as string[],
  text: '',
  youtubeUrl: '',
  webUrl: '',
  webCapture: false,
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message === 'OPENROUTER_KEY_MISSING' ? 'Add your OpenRouter key in Settings.' : message
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

// Pico 0..1 numa escala de -60 dB a 0 dB.
function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

// Como a gravação em curso para sozinha, mostrado durante a gravação.
function autoStopHint(limits: RecordLimitsView): string {
  const rules = [
    limits.silenceStopMinutes > 0 ? `after ${limits.silenceStopMinutes} min of silence` : null,
    limits.maxMinutes > 0 ? `at ${formatMinutes(limits.maxMinutes)}` : null,
  ].filter(Boolean)
  const auto = rules.length > 0 ? `Stops by itself ${rules.join(' or ')}. ` : ''
  return `${auto}Ctrl+Alt+R or the tray icon also stop it.`
}

interface RecordLimitsView {
  silenceStopMinutes: number
  maxMinutes: number
}

function levelPercent(peak: number): number {
  if (peak <= 0) return 0
  return Math.max(0, Math.min(100, ((20 * Math.log10(peak) + 60) / 60) * 100))
}

function LevelMeter({ label, peak }: { label: string; peak: number | null }) {
  const percent = peak === null ? 0 : Math.round(levelPercent(peak))
  return (
    <div className={styles.level}>
      <span className={styles.levelLabel}>{label}</span>
      {peak === null ? (
        <span className={shared.muted}>not available</span>
      ) : (
        <div
          className={styles.levelTrack}
          role="meter"
          aria-label={`${label} level`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className={styles.levelFill} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  )
}

export function MincerNew({
  job,
  confirm,
  showIntro,
  missingApiKey,
  onStarted,
  onQueued,
  onOpenSettings,
}: MincerNewProps) {
  const [mode, setMode] = useState<Mode>(() => (job.recording ? 'record' : draft.mode))
  const [summary, setSummary] = useState<SummarySettings>(loadSummarySettings)
  const [filePaths, setFilePaths] = useState<string[]>(draft.filePaths)
  const [text, setText] = useState(draft.text)
  const [youtubeUrl, setYoutubeUrl] = useState(draft.youtubeUrl)
  const [webUrl, setWebUrl] = useState(draft.webUrl)
  const [webCapture, setWebCapture] = useState(draft.webCapture)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null)
  const [recordErrors, setRecordErrors] = useState<string[]>([])
  const [recordLimits, setRecordLimits] = useState<RecordLimitsView | null>(null)
  const [level, setLevel] = useState<MincerLevel | null>(null)
  const [dragging, setDragging] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const transcriptionModel = getTranscriptionModel()
  const summaryModel = resolveSummaryModel()

  useEffect(() => {
    Object.assign(draft, { mode, filePaths, text, youtubeUrl, webUrl, webCapture })
  }, [mode, filePaths, text, youtubeUrl, webUrl, webCapture])

  // Arquivos soltos na janela vão para a aba File, só selecionados (sem iniciar).
  // Durante a gravação a aba Record fica (Stop e Discard à vista).
  const recording = job.recording
  useEffect(() => {
    const pending = getCurrentWebview().onDragDropEvent((e) => {
      const p = e.payload
      if (p.type === 'enter' || p.type === 'over') {
        setDragging(true)
      } else if (p.type === 'leave') {
        setDragging(false)
      } else {
        setDragging(false)
        if (p.paths.length > 0) {
          if (!recording) setMode('file')
          setFilePaths(p.paths)
          setError(null)
        }
      }
    })
    return () => {
      pending.then((unlisten) => unlisten()).catch(() => {})
    }
  }, [recording])

  function updateSummary(next: SummarySettings) {
    setSummary(next)
    saveSummarySettings(next)
  }

  // Gravação em curso: relógio a cada 1 s, avisos a cada 2 s e nível por faixa
  // (~4 eventos/s do Rust, assinados só nesta tela).
  useEffect(() => {
    if (!job.recording) {
      setRecordStartedAt(null)
      setRecordErrors([])
      setRecordLimits(null)
      setLevel(null)
      return
    }
    let cancelled = false
    const poll = () =>
      mincerRecordStatus()
        .then((s) => {
          if (cancelled) return
          setRecordStartedAt(s.startedAt)
          setRecordErrors(s.errors)
          setRecordLimits({ silenceStopMinutes: s.silenceStopMinutes, maxMinutes: s.maxMinutes })
        })
        .catch(() => {})
    void poll()
    const pollTimer = window.setInterval(poll, 2000)
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000)
    const pendingLevel = onMincerLevel((l) => {
      if (!cancelled) setLevel(l)
    })
    return () => {
      cancelled = true
      window.clearInterval(pollTimer)
      window.clearInterval(clockTimer)
      pendingLevel.then((unlisten) => unlisten()).catch(() => {})
    }
  }, [job.recording])

  const hasMediaFile = mode === 'file' && filePaths.some((p) => !isTextFile(p))
  const needsTranscription = hasMediaFile || mode === 'record' || mode === 'youtube'
  const needsSummary = !(mode === 'web' && webCapture)
  const missingTranscription = needsTranscription && !transcriptionModel
  const missingSummary = needsSummary && !summaryModel
  const missingKey = missingApiKey && (needsTranscription || needsSummary)
  const blocked = missingKey || missingTranscription || missingSummary

  function buildOptions(): MincerJobOptions {
    return {
      transcriptionModel,
      summaryModel,
      preset: summary.presetId,
      summaryPrompt: resolveSummaryPrompt(summary),
    }
  }

  async function run(action: () => Promise<string>, reset: () => void) {
    setBusy(true)
    setError(null)
    try {
      const id = await action()
      reset()
      onStarted(id)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function start(kind: MincerKind, input: { source?: string; text?: string }, reset: () => void) {
    void run(() => mincerStart({ kind, ...input, options: buildOptions() }), reset)
  }

  async function handlePickFiles() {
    setError(null)
    try {
      const picked = await mincerPickFiles()
      if (picked.length > 0) setFilePaths(picked)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Um item por arquivo, na ordem; os que falham continuam selecionados, com o erro.
  async function handleStartFiles() {
    setBusy(true)
    setError(null)
    const options = buildOptions()
    const ids: string[] = []
    const failed: string[] = []
    const errors: string[] = []
    for (const path of filePaths) {
      try {
        ids.push(await mincerStart({ kind: 'file', source: path, options }))
      } catch (err) {
        failed.push(path)
        errors.push(filePaths.length > 1 ? `${fileName(path)}: ${errorMessage(err)}` : errorMessage(err))
      }
    }
    setFilePaths(failed)
    setBusy(false)
    if (errors.length > 0) {
      setError(errors.join('\n'))
      if (ids.length > 0) onQueued()
    } else if (ids.length > 0) onStarted(ids[0])
  }

  async function handleStartRecording() {
    setBusy(true)
    setError(null)
    try {
      await mincerRecordStart(buildOptions())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleExtendRecording() {
    setError(null)
    try {
      const maxMinutes = await mincerRecordExtend()
      setRecordLimits((prev) => (prev ? { ...prev, maxMinutes } : prev))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function handleDiscardRecording() {
    const ok = await confirm('Discard this recording? The audio is deleted and nothing is processed.', {
      title: 'Discard recording',
      confirmLabel: 'Discard',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await mincerRecordDiscard()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function renderPrimary(label: string, onClick: () => void, disabled: boolean) {
    return (
      <button type="button" className={shared.primary} onClick={onClick} disabled={busy || blocked || disabled}>
        {label}
      </button>
    )
  }

  const micError = recordErrors.some((e) => e.startsWith('Microphone'))
  const fileLabel = `${hasMediaFile || filePaths.length === 0 ? 'Transcribe & summarize' : 'Summarize'}${
    filePaths.length > 1 ? ` ${filePaths.length} files` : ''
  }`

  return (
    <div className={styles.new}>
      <h2 className={styles.title}>New item</h2>
      {showIntro && (
        <p className={styles.intro}>
          Turn recordings, videos, web pages and long texts into a summary and a transcript. Items run in the
          background, so you can keep working.
        </p>
      )}
      <div className={styles.tabs} role="tablist" aria-label="Input">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={mode === m.id ? styles.tabActive : styles.tab}
            onClick={() => {
              setMode(m.id)
              setError(null)
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {mode === 'file' && (
          <div className={dragging ? styles.fileRowDragging : styles.fileRow}>
            <button type="button" className={shared.secondary} onClick={() => void handlePickFiles()}>
              <FileAudio size={14} aria-hidden="true" />
              Choose files
            </button>
            <span className={styles.fileName} title={filePaths.join('\n') || undefined}>
              {filePaths.length === 0
                ? 'Audio, video, PDF, .txt or .md — or drop files here'
                : filePaths.length === 1
                  ? fileName(filePaths[0])
                  : `${filePaths.length} files: ${filePaths.map(fileName).join(', ')}`}
            </span>
          </div>
        )}

        {mode === 'paste' && (
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the text to summarize…"
            rows={12}
          />
        )}

        {mode === 'record' &&
          (job.recording ? (
            <>
              <div className={styles.recording}>
                <span className={styles.recordDot} aria-hidden="true" />
                <span className={styles.recordTime}>
                  {recordStartedAt ? formatElapsed(now - recordStartedAt) : '00:00'}
                </span>
                <span className={shared.muted}>Recording system audio and microphone…</span>
              </div>
              <div className={styles.levels}>
                <LevelMeter label="System" peak={level ? level.system : 0} />
                <LevelMeter label="Mic" peak={level ? level.mic : 0} />
              </div>
              {recordLimits && <p className={shared.muted}>{autoStopHint(recordLimits)}</p>}
            </>
          ) : (
            <p className={shared.muted}>Records system audio and your microphone.</p>
          ))}
        {mode === 'record' && recordErrors.length > 0 && (
          <div className={styles.warnings}>
            {recordErrors.map((e) => (
              <p key={e} className={shared.error}>
                {e}
              </p>
            ))}
            {micError && (
              <p className={shared.muted}>Check Windows Settings › Privacy & security › Microphone.</p>
            )}
          </div>
        )}

        {mode === 'youtube' && (
          <input
            className={styles.input}
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            spellCheck={false}
          />
        )}

        {mode === 'web' && (
          <>
            <input
              className={styles.input}
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              placeholder="https://…"
              spellCheck={false}
            />
            <div className={styles.segmented} role="radiogroup" aria-label="Web page action">
              {[false, true].map((capture) => (
                <button
                  key={String(capture)}
                  type="button"
                  role="radio"
                  aria-checked={webCapture === capture}
                  className={webCapture === capture ? styles.segmentActive : styles.segment}
                  onClick={() => setWebCapture(capture)}
                >
                  {capture ? 'Capture text' : 'Summarize'}
                </button>
              ))}
            </div>
          </>
        )}

        {needsSummary && (
          <SummaryOptions value={summary} onChange={updateSummary} disabled={mode === 'record' && job.recording} />
        )}

        <p className={styles.models}>
          Transcription: {transcriptionModel ?? 'not set'} · Summary: {summaryModel ?? 'not set'}{' '}
          <button type="button" className={shared.linkButton} onClick={() => onOpenSettings('mincer')}>
            Change in Settings
          </button>
        </p>

        {blocked && (
          <div className={styles.blocked}>
            <p className={shared.error}>
              {missingKey
                ? 'Add your OpenRouter key in Settings.'
                : missingTranscription
                  ? 'Choose a transcription model in Settings to process audio.'
                  : 'Choose a summary model in Settings.'}
            </p>
            <button
              type="button"
              className={shared.secondary}
              onClick={() => onOpenSettings(missingKey ? 'openrouter' : 'mincer')}
            >
              Open Settings
            </button>
          </div>
        )}

        <div className={styles.actions}>
          {mode === 'file' && renderPrimary(fileLabel, () => void handleStartFiles(), filePaths.length === 0)}
          {mode === 'paste' &&
            renderPrimary('Summarize', () => start('paste', { text }, () => setText('')), !text.trim())}
          {mode === 'record' &&
            (job.recording ? (
              <>
                <button
                  type="button"
                  className={shared.primary}
                  onClick={() => void run(mincerRecordStop, () => {})}
                  disabled={busy}
                >
                  <StopCircle size={14} aria-hidden="true" />
                  Stop and process
                </button>
                {recordLimits && recordLimits.maxMinutes > 0 && (
                  <button
                    type="button"
                    className={shared.secondary}
                    onClick={() => void handleExtendRecording()}
                    disabled={busy}
                    title="Extend the recording limit by 30 minutes"
                  >
                    <Plus size={14} aria-hidden="true" />
                    30 min
                  </button>
                )}
                <button
                  type="button"
                  className={shared.danger}
                  onClick={() => void handleDiscardRecording()}
                  disabled={busy}
                >
                  <Trash size={14} aria-hidden="true" />
                  Discard
                </button>
              </>
            ) : (
              <button
                type="button"
                className={shared.primary}
                onClick={() => void handleStartRecording()}
                disabled={busy || blocked}
              >
                <Microphone size={14} aria-hidden="true" />
                Start recording
              </button>
            ))}
          {mode === 'youtube' &&
            renderPrimary(
              'Transcribe & summarize',
              () => start('youtube', { source: youtubeUrl.trim() }, () => setYoutubeUrl('')),
              !youtubeUrl.trim()
            )}
          {mode === 'web' &&
            renderPrimary(
              webCapture ? 'Capture text' : 'Summarize page',
              () =>
                start(webCapture ? 'web_capture' : 'web_summary', { source: webUrl.trim() }, () =>
                  setWebUrl('')
                ),
              !webUrl.trim()
            )}
        </div>

        {job.activeItemId && !(mode === 'record' && job.recording) && (
          <p className={shared.muted}>Another item is processing — this one will wait in the queue.</p>
        )}
        {error && <p className={`${shared.error} ${styles.errorText}`}>{error}</p>}
      </div>
    </div>
  )
}
