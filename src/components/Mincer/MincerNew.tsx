import { useEffect, useRef, useState } from 'react'
import { FileAudio, Microphone, Plus, StopCircle, Trash, Warning } from '@phosphor-icons/react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { MincerJobState } from '../../hooks/useMincerJob'
import type { useConfirm } from '../../hooks/useConfirm'
import type { SettingsSection } from '../Settings/SettingsModal'
import {
  formatElapsed,
  getTranscriptionModel,
  isTextFile,
  MAX_RECORD_HOURS,
  mincerPickFiles,
  mincerRecordDevices,
  mincerRecordDiscard,
  mincerRecordExtend,
  mincerRecordSetTitle,
  mincerRecordStart,
  mincerRecordStatus,
  mincerRecordStop,
  mincerStart,
  onMincerLevel,
  resolveSummaryModel,
  type MincerJobOptions,
  type MincerKind,
  type MincerLevel,
  type MincerRecordDevices,
} from '../../lib/mincer'
import { SummaryOptions } from './SummaryOptions'
import {
  loadPresetForTab,
  loadSummarySettings,
  resolveSummaryPrompt,
  saveSummarySettings,
  type SummarySettings,
} from './presets'
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
// a reiniciar o app. O título da gravação em curso fica no Rust.
const draft = {
  mode: 'file' as Mode,
  filePaths: [] as string[],
  text: '',
  youtubeUrl: '',
  webUrl: '',
  webCapture: false,
  recordTitle: '',
}

// Arquivos soltos com um item aberto (Mincer.tsx): a tela New abre com eles
// selecionados. Durante a gravação a aba Record fica.
export function queueDroppedFiles(paths: string[], recording: boolean): void {
  draft.filePaths = paths
  if (!recording) draft.mode = 'file'
}

// Pico acima disso (~-44 dBFS) conta como áudio, como o SILENCE_PEAK do Rust.
const AUDIO_PEAK = 0.006
// System mudo por este tempo com o Mic captando: aviso de dispositivo errado.
const SYSTEM_SILENT_WARN_MS = 60_000
// Prazo para as faixas abrirem os dispositivos depois do Start (o status é
// lido a cada 2 s, então cobre o 1º e o 2º poll).
const DEVICE_OPEN_GRACE_MS = 3000

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// O mesmo nome que o Rust dá sem título (`recording_title`): hora de início.
function defaultRecordingTitle(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Recording ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

// Como a gravação em curso para sozinha, mostrado durante a gravação; com o
// início, diz a hora do teto e quanto falta ("at 17:40 (in 25 min)").
function autoStopHint(limits: RecordLimitsView, startedAt: number | null, now: number): string {
  let maxRule: string | null = null
  if (limits.maxMinutes > 0) {
    if (startedAt) {
      const stopAt = startedAt + limits.maxMinutes * 60_000
      const left = Math.max(0, Math.ceil((stopAt - now) / 60_000))
      maxRule = `at ${clockTime(stopAt)} (in ${formatMinutes(left)})`
    } else {
      maxRule = `at ${formatMinutes(limits.maxMinutes)}`
    }
  }
  const rules = [
    limits.silenceStopMinutes > 0 ? `after ${limits.silenceStopMinutes} min of silence` : null,
    maxRule,
  ].filter(Boolean)
  const auto = rules.length > 0 ? `Stops by itself ${rules.join(' or ')}. ` : ''
  return `${auto}Ctrl+Alt+R or the tray icon also stop it.`
}

function devicesLine(devices: MincerRecordDevices): string {
  return `System: ${devices.system ?? 'no output device found'} · Mic: ${devices.mic ?? 'no microphone found'}`
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
  const [summary, setSummary] = useState<SummarySettings>(() => loadSummarySettings(mode))
  const [filePaths, setFilePaths] = useState<string[]>(draft.filePaths)
  // Antes do Start fica no rascunho; durante a gravação, no Rust.
  const [recordTitle, setRecordTitle] = useState(() => (job.recording ? '' : draft.recordTitle))
  const [devices, setDevices] = useState<MincerRecordDevices | null>(null)
  // System mudo por 60 s com o Mic captando (dispositivo de saída errado?).
  const [systemSilent, setSystemSilent] = useState(false)
  // Montada com a gravação em curso: o título vem do status uma vez.
  const titleFromStatusRef = useRef(job.recording)
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

  // O título digitado antes do Start fica no rascunho; o da gravação em curso,
  // não (a próxima gravação começa sem título).
  const recording = job.recording
  useEffect(() => {
    draft.recordTitle = recording ? '' : recordTitle
  }, [recording, recordTitle])

  // Título editado durante a gravação vale para qualquer parada (tray, atalho,
  // silêncio, teto); o Stop da tela grava o último antes de parar.
  const pendingTitleRef = useRef<string | null>(null)
  useEffect(() => {
    if (!recording || titleFromStatusRef.current) {
      pendingTitleRef.current = null
      return
    }
    pendingTitleRef.current = recordTitle
    const timer = window.setTimeout(() => {
      pendingTitleRef.current = null
      mincerRecordSetTitle(recordTitle).catch(() => {})
    }, 300)
    return () => window.clearTimeout(timer)
  }, [recording, recordTitle])
  // Ao desmontar (troca de modo, remontagem pela `key`), o título ainda no
  // debounce vai na hora.
  useEffect(
    () => () => {
      const pending = pendingTitleRef.current
      if (pending !== null) mincerRecordSetTitle(pending).catch(() => {})
    },
    [],
  )

  // Dispositivos padrão antes do Start, relidos ao voltar à janela (um headset
  // conectado muda a saída padrão).
  useEffect(() => {
    if (mode !== 'record' || recording) return
    let cancelled = false
    const load = () =>
      mincerRecordDevices()
        .then((d) => {
          if (!cancelled) setDevices(d)
        })
        .catch(() => {})
    void load()
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
    }
  }, [mode, recording])

  function changeMode(next: Mode) {
    setMode(next)
    setError(null)
    setSummary((prev) => ({ ...prev, presetId: loadPresetForTab(next) }))
  }

  // Arquivos soltos na janela vão para a aba File, só selecionados (sem iniciar).
  // Durante a gravação a aba Record fica (Stop e Discard à vista).
  const modeRef = useRef(mode)
  modeRef.current = mode
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
          if (!recording && modeRef.current !== 'file') changeMode('file')
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
    saveSummarySettings(next, mode)
  }

  // Gravação em curso: relógio a cada 1 s, avisos a cada 2 s e nível por faixa
  // (~4 eventos/s do Rust, assinados só nesta tela).
  const wasRecordingRef = useRef(job.recording)
  useEffect(() => {
    if (!job.recording) {
      setRecordStartedAt(null)
      setRecordErrors([])
      setRecordLimits(null)
      setLevel(null)
      setSystemSilent(false)
      // A gravação acabou (Stop, tray, parada automática): o título era dela.
      if (wasRecordingRef.current) setRecordTitle('')
      wasRecordingRef.current = false
      return
    }
    wasRecordingRef.current = true
    // "Detecting devices…" até o status trazer os dispositivos da gravação.
    setDevices(null)
    let cancelled = false
    const poll = () =>
      mincerRecordStatus()
        .then((s) => {
          if (cancelled) return
          setRecordStartedAt(s.startedAt)
          setRecordErrors(s.errors)
          setRecordLimits({ silenceStopMinutes: s.silenceStopMinutes, maxMinutes: s.maxMinutes })
          // Logo depois do Start as faixas ainda abrem os dispositivos (nome
          // vazio no status); passado o prazo, vazio quer dizer "não achou".
          const opening = s.startedAt !== null && Date.now() - s.startedAt < DEVICE_OPEN_GRACE_MS
          if (!opening || (s.devices.system !== null && s.devices.mic !== null)) setDevices(s.devices)
          if (titleFromStatusRef.current) {
            titleFromStatusRef.current = false
            setRecordTitle(s.title ?? '')
          }
        })
        .catch(() => {})
    void poll()
    const pollTimer = window.setInterval(poll, 2000)
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000)
    let systemSilentSince = Date.now()
    let micHeard = false
    const pendingLevel = onMincerLevel((l) => {
      if (cancelled) return
      setLevel(l)
      if (l.system > AUDIO_PEAK) {
        systemSilentSince = Date.now()
        micHeard = false
        setSystemSilent(false)
        return
      }
      if (l.mic !== null && l.mic > AUDIO_PEAK) micHeard = true
      if (micHeard && Date.now() - systemSilentSince >= SYSTEM_SILENT_WARN_MS) setSystemSilent(true)
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
  // Na aba File sem arquivo ainda não se sabe se haverá áudio.
  const showsTranscriptionModel = needsTranscription || (mode === 'file' && filePaths.length === 0)
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
      await mincerRecordStart(buildOptions(), recordTitle)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // O título mais recente vai antes do Stop (o envio do campo espera 300 ms).
  async function stopRecording(): Promise<string> {
    // Antes do 1º status o campo ainda não tem o título do Rust.
    if (!titleFromStatusRef.current) await mincerRecordSetTitle(recordTitle).catch(() => {})
    return mincerRecordStop()
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
  const atMaxRecordLength = !!recordLimits && recordLimits.maxMinutes >= MAX_RECORD_HOURS * 60
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
            onClick={() => changeMode(m.id)}
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

        {mode === 'record' && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Title (optional)</span>
            <input
              className={styles.input}
              value={recordTitle}
              onChange={(e) => setRecordTitle(e.target.value)}
              placeholder={
                recordStartedAt ? defaultRecordingTitle(recordStartedAt) : 'Leave empty to name it by the start time'
              }
              maxLength={200}
            />
          </label>
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
              <p className={styles.devices}>{devices ? devicesLine(devices) : 'Detecting devices…'}</p>
              <div className={styles.levels}>
                <LevelMeter label="System" peak={level ? level.system : 0} />
                <LevelMeter label="Mic" peak={level ? level.mic : 0} />
              </div>
              {systemSilent && (
                <p className={styles.warning} role="status">
                  <Warning size={14} aria-hidden="true" />
                  No system audio detected. Is the meeting playing on another device?
                </p>
              )}
              {recordLimits && <p className={shared.muted}>{autoStopHint(recordLimits, recordStartedAt, now)}</p>}
            </>
          ) : (
            <>
              <p className={shared.muted}>Records system audio and your microphone.</p>
              {devices && (
                <p
                  className={styles.devices}
                  title="Monet records the Windows default output and microphone. Change them in Windows sound settings."
                >
                  {devicesLine(devices)}
                </p>
              )}
            </>
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
          <SummaryOptions
            value={summary}
            onChange={updateSummary}
            confirm={confirm}
            disabled={mode === 'record' && job.recording}
          />
        )}

        {(showsTranscriptionModel || needsSummary) && (
          <p className={styles.models}>
            {[
              showsTranscriptionModel ? `Transcription: ${transcriptionModel ?? 'not set'}` : null,
              needsSummary ? `Summary: ${summaryModel ?? 'not set'}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}{' '}
            <button type="button" className={shared.linkButton} onClick={() => onOpenSettings('mincer')}>
              Change in Settings
            </button>
          </p>
        )}

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
                  onClick={() => void run(stopRecording, () => {})}
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
                    disabled={busy || atMaxRecordLength}
                    title={
                      atMaxRecordLength
                        ? 'Maximum length (6 h) reached'
                        : 'Extend the recording limit by 30 minutes'
                    }
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
