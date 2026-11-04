import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { check } from '@tauri-apps/plugin-updater'
import type { Update } from '@tauri-apps/plugin-updater'
import {
  clearOpenRouterKey,
  hasOpenRouterKey,
  saveOpenRouterKey,
} from '../../lib/openrouter'
import {
  clearTavilyKey,
  hasTavilyKey,
  saveTavilyKey,
} from '../../lib/search'
import {
  getUpdatePreference,
  setUpdatePreference,
  isMandatory,
  type UpdatePreference,
} from '../../lib/updater'
import { RAG_REWRITE_MODEL_KEY } from '../../lib/rag'
import {
  DEFAULT_MAX_RECORD_HOURS,
  DEFAULT_SILENCE_STOP_MINUTES,
  MINCER_MAX_RECORD_KEY,
  MINCER_SILENCE_STOP_KEY,
  MINCER_SUMMARY_MODEL_KEY,
  MINCER_TRANSCRIPTION_MODEL_KEY,
  mincerListTranscriptionModels,
  type MincerModel,
} from '../../lib/mincer'
import {
  DEFAULT_WORK_DAYS,
  DEFAULT_WORK_HOURS_PER_DAY,
  isValidWorkHours,
  loadWorkCapacity,
  saveWorkCapacity,
} from '../../lib/workCapacity'
import styles from './SettingsModal.module.css'

export type SettingsSection = 'openrouter' | 'search' | 'agenda' | 'mincer' | 'about'

export interface SettingsModalProps {
  open: boolean
  /** Section shown when the modal opens (default: OpenRouter). */
  initialSection?: SettingsSection
  onClose: () => void
  onApiKeyChanged: (hasKey: boolean) => void
  onUpdateFound: (update: Update, mandatory: boolean) => void
}

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'openrouter', label: 'OpenRouter Integration' },
  { id: 'search', label: 'Web Search' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'mincer', label: 'Mincer' },
  { id: 'about', label: 'About & Updates' },
]

// Dias de trabalho na ordem seg→dom; valor como em Date.getDay().
const WORK_DAY_OPTIONS: Array<{ day: number; label: string }> = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
]
// Texto do padrão, dos mesmos valores que o agente usa.
const DEFAULT_WORK_DAY_NAMES = WORK_DAY_OPTIONS.filter(({ day }) => DEFAULT_WORK_DAYS.includes(day))
  .map(({ label }) => label)
  .join(', ')

export function SettingsModal({
  open,
  initialSection,
  onClose,
  onApiKeyChanged,
  onUpdateFound,
}: SettingsModalProps) {
  const [section, setSection] = useState<SettingsSection>('openrouter')

  // OpenRouter state
  const [keyValue, setKeyValue] = useState('')
  const [hasKey, setHasKey] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{
    kind: 'idle' | 'success' | 'error'
    message: string
  }>({ kind: 'idle', message: '' })
  // Modelo da reescrita da consulta do RAG (vazio = padrão do backend)
  const [rewriteModel, setRewriteModel] = useState('')

  // Agenda state (capacidade de trabalho do plan-week)
  const [workHours, setWorkHours] = useState('')
  const [workDays, setWorkDays] = useState<number[]>([])
  const [workConfigured, setWorkConfigured] = useState(false)
  const [workStatus, setWorkStatus] = useState<{ kind: 'idle' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  })

  // Mincer state
  const [transcriptionModel, setTranscriptionModel] = useState('')
  const [summaryModel, setSummaryModel] = useState('')
  const [silenceStop, setSilenceStop] = useState(String(DEFAULT_SILENCE_STOP_MINUTES))
  const [maxRecordHours, setMaxRecordHours] = useState(String(DEFAULT_MAX_RECORD_HOURS))
  const [transcriptionModels, setTranscriptionModels] = useState<MincerModel[]>([])
  const [modelsStatus, setModelsStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [modelsError, setModelsError] = useState('')

  // Tavily state
  const [tavilyValue, setTavilyValue] = useState('')
  const [hasTavily, setHasTavily] = useState(false)
  const [tavSaving, setTavSaving] = useState(false)
  const [tavStatus, setTavStatus] = useState<{
    kind: 'idle' | 'success' | 'error'
    message: string
  }>({ kind: 'idle', message: '' })

  // About / Updates state
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [updatePref, setUpdatePref] = useState<UpdatePreference>('ask')
  const [checking, setChecking] = useState(false)
  const [checkStatus, setCheckStatus] = useState<{
    kind: 'idle' | 'success' | 'error'
    message: string
  }>({ kind: 'idle', message: '' })

  useEffect(() => {
    if (!open || !initialSection) return
    setSection(initialSection)
  }, [open, initialSection])

  useEffect(() => {
    if (!open) return
    setStatus({ kind: 'idle', message: '' })
    setKeyValue('')
    hasOpenRouterKey()
      .then(setHasKey)
      .catch(() => setHasKey(false))
    setRewriteModel(localStorage.getItem(RAG_REWRITE_MODEL_KEY) ?? '')
    setTranscriptionModel(localStorage.getItem(MINCER_TRANSCRIPTION_MODEL_KEY) ?? '')
    setSummaryModel(localStorage.getItem(MINCER_SUMMARY_MODEL_KEY) ?? '')
    setSilenceStop(localStorage.getItem(MINCER_SILENCE_STOP_KEY) ?? String(DEFAULT_SILENCE_STOP_MINUTES))
    setMaxRecordHours(localStorage.getItem(MINCER_MAX_RECORD_KEY) ?? String(DEFAULT_MAX_RECORD_HOURS))
    const capacity = loadWorkCapacity()
    setWorkHours(String(capacity.hoursPerDay))
    setWorkDays(capacity.workDays)
    setWorkConfigured(capacity.configured)
    setWorkStatus({ kind: 'idle', message: '' })
    setTavilyValue('')
    setTavStatus({ kind: 'idle', message: '' })
    hasTavilyKey()
      .then(setHasTavily)
      .catch(() => setHasTavily(false))
    setCheckStatus({ kind: 'idle', message: '' })
    setUpdatePref(getUpdatePreference())
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(null))
  }, [open])

  useEffect(() => {
    if (!open || section !== 'mincer' || !hasKey) return
    let cancelled = false
    setModelsStatus('loading')
    mincerListTranscriptionModels()
      .then((models) => {
        if (cancelled) return
        setTranscriptionModels(models)
        setModelsStatus('idle')
      })
      .catch((err) => {
        if (cancelled) return
        setModelsError(err instanceof Error ? err.message : String(err))
        setModelsStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [open, section, hasKey])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSave() {
    const trimmed = keyValue.trim()
    if (!trimmed) {
      setStatus({ kind: 'error', message: 'Please enter a valid key.' })
      return
    }
    if (!trimmed.startsWith('sk-or-v1-')) {
      setStatus({
        kind: 'error',
        message: 'Invalid OpenRouter key (must start with sk-or-v1-).',
      })
      return
    }
    setSaving(true)
    try {
      await saveOpenRouterKey(trimmed)
      setHasKey(true)
      setKeyValue('')
      setStatus({ kind: 'success', message: 'Key saved securely.' })
      onApiKeyChanged(true)
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to save key.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    try {
      await clearOpenRouterKey()
      setHasKey(false)
      setStatus({ kind: 'success', message: 'Key removed.' })
      onApiKeyChanged(false)
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove key.',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleRewriteModelChange(value: string) {
    setRewriteModel(value)
    const trimmed = value.trim()
    if (trimmed) localStorage.setItem(RAG_REWRITE_MODEL_KEY, trimmed)
    else localStorage.removeItem(RAG_REWRITE_MODEL_KEY)
  }

  function handleMincerSettingChange(key: string, value: string, set: (v: string) => void) {
    set(value)
    const trimmed = value.trim()
    if (trimmed) localStorage.setItem(key, trimmed)
    else localStorage.removeItem(key)
  }

  function handleWorkHoursChange(value: string) {
    setWorkHours(value)
    const n = Number(value.replace(',', '.'))
    if (isValidWorkHours(n)) {
      saveWorkCapacity(n, workDays)
      setWorkConfigured(true)
      setWorkStatus({ kind: 'idle', message: '' })
    } else {
      setWorkStatus({ kind: 'error', message: 'Enter a number of hours greater than 0 and up to 24.' })
    }
  }

  function handleWorkDayToggle(day: number, checked: boolean) {
    const next = checked ? [...workDays, day] : workDays.filter((d) => d !== day)
    if (next.length === 0) {
      setWorkStatus({ kind: 'error', message: 'Choose at least one work day.' })
      return
    }
    setWorkDays(next)
    // Horas inválidas no campo: grava os dias com as horas já salvas.
    const n = Number(workHours.replace(',', '.'))
    const hoursOk = isValidWorkHours(n)
    saveWorkCapacity(hoursOk ? n : loadWorkCapacity().hoursPerDay, next)
    setWorkConfigured(true)
    if (hoursOk) setWorkStatus({ kind: 'idle', message: '' })
  }

  async function handleTavilySave() {
    const trimmed = tavilyValue.trim()
    if (!trimmed) {
      setTavStatus({ kind: 'error', message: 'Please enter a valid key.' })
      return
    }
    if (!trimmed.startsWith('tvly-')) {
      setTavStatus({
        kind: 'error',
        message: 'Invalid Tavily key (must start with tvly-).',
      })
      return
    }
    setTavSaving(true)
    try {
      await saveTavilyKey(trimmed)
      setHasTavily(true)
      setTavilyValue('')
      setTavStatus({ kind: 'success', message: 'Key saved.' })
    } catch (err) {
      setTavStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to save key.',
      })
    } finally {
      setTavSaving(false)
    }
  }

  async function handleTavilyClear() {
    try {
      await clearTavilyKey()
      setHasTavily(false)
      setTavStatus({ kind: 'success', message: 'Key removed.' })
    } catch (err) {
      setTavStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove key.',
      })
    }
  }

  function handlePrefChange(pref: UpdatePreference) {
    setUpdatePref(pref)
    setUpdatePreference(pref)
  }

  async function handleCheckNow() {
    setChecking(true)
    setCheckStatus({ kind: 'idle', message: '' })
    try {
      const update = await check()
      if (!update?.available) {
        setCheckStatus({ kind: 'success', message: "You're up to date." })
        return
      }
      const mandatory = isMandatory(update.body)
      onUpdateFound(update, mandatory)
      onClose()
    } catch {
      setCheckStatus({
        kind: 'error',
        message: 'Could not check for updates. Check your internet connection.',
      })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Settings">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="close"
            type="button"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>
          <nav className={styles.sidebar} aria-label="sections">
            <ul className={styles.sectionList}>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    className={
                      s.id === section ? styles.sectionActive : styles.section
                    }
                    onClick={() => setSection(s.id)}
                    type="button"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.content}>
            {section === 'openrouter' && (
              <div className={styles.form}>
                <h3 className={styles.formTitle}>OpenRouter Integration</h3>
                <p className={styles.formHelp}>
                  Your key is saved in a local file by the app. It is never
                  exposed to the frontend after saving.
                </p>
                <label className={styles.label} htmlFor="or-key">
                  API Key
                </label>
                <input
                  id="or-key"
                  className={styles.input}
                  type="password"
                  value={keyValue}
                  placeholder={
                    hasKey
                      ? 'key configured — type to replace'
                      : 'sk-or-v1-...'
                  }
                  onChange={(e) => setKeyValue(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className={styles.actions}>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'saving...' : 'save key'}
                  </button>
                  {hasKey && (
                    <button
                      className={styles.secondary}
                      type="button"
                      onClick={handleClear}
                      disabled={saving}
                    >
                      remove key
                    </button>
                  )}
                </div>
                {status.kind !== 'idle' && (
                  <p
                    className={
                      status.kind === 'error'
                        ? styles.statusError
                        : styles.statusOk
                    }
                  >
                    {status.message}
                  </p>
                )}
                <p className={styles.footNote}>
                  {hasKey
                    ? 'A key is already configured in this app.'
                    : 'No key configured. Without the key, the AI panel cannot start requests.'}
                </p>
                <label className={styles.label} htmlFor="rag-rewrite-model">
                  Retrieval model (query rewrite)
                </label>
                <input
                  id="rag-rewrite-model"
                  className={styles.input}
                  type="text"
                  value={rewriteModel}
                  placeholder="openai/gpt-4.1-mini"
                  onChange={(e) => handleRewriteModelChange(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className={styles.footNote}>
                  OpenRouter model that rewrites your message into a search query for your documents. Leave empty to use the default.
                </p>
              </div>
            )}

            {section === 'search' && (
              <div className={styles.form}>
                <h3 className={styles.formTitle}>Web Search (Tavily)</h3>
                <p className={styles.formHelp}>
                  The Tavily key enables the <code>/search</code> and <code>/profile</code> commands to query the internet before responding. Create a free account at{' '}
                  <strong>tavily.com</strong> (1,000 searches/month free).
                </p>
                <label className={styles.label} htmlFor="tav-key">
                  API Key
                </label>
                <input
                  id="tav-key"
                  className={styles.input}
                  type="password"
                  value={tavilyValue}
                  placeholder={
                    hasTavily
                      ? 'key configured — type to replace'
                      : 'tvly-...'
                  }
                  onChange={(e) => setTavilyValue(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTavilySave() }}
                />
                <div className={styles.actions}>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={handleTavilySave}
                    disabled={tavSaving}
                  >
                    save key
                  </button>
                  {hasTavily && (
                    <button
                      className={styles.secondary}
                      type="button"
                      onClick={handleTavilyClear}
                      disabled={tavSaving}
                    >
                      remove key
                    </button>
                  )}
                </div>
                {tavStatus.kind !== 'idle' && (
                  <p className={tavStatus.kind === 'error' ? styles.statusError : styles.statusOk}>
                    {tavStatus.message}
                  </p>
                )}
                <p className={styles.footNote}>
                  {hasTavily
                    ? 'Web search active. /search and /profile commands query the internet.'
                    : 'Without the key, /search and /profile use only the model\'s knowledge.'}
                </p>
              </div>
            )}

            {section === 'agenda' && (
              <div className={styles.form}>
                <h3 className={styles.formTitle}>Agenda</h3>
                <p className={styles.formHelp}>
                  Your work capacity. The Plan week agent in Chat uses it to fit your week.
                </p>
                <label className={styles.label} htmlFor="work-hours">
                  Hours available for tasks on a work day (leave out meetings)
                </label>
                <input
                  id="work-hours"
                  className={styles.input}
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  inputMode="decimal"
                  value={workHours}
                  onChange={(e) => handleWorkHoursChange(e.target.value)}
                />
                <p className={styles.formHelp}>
                  Study plans have their own pace (the Capacity property of each plan).
                </p>
                <span className={styles.label}>Work days</span>
                <div className={styles.dayRow}>
                  {WORK_DAY_OPTIONS.map(({ day, label }) => (
                    <label key={day} className={styles.day}>
                      <input
                        type="checkbox"
                        checked={workDays.includes(day)}
                        onChange={(e) => handleWorkDayToggle(day, e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {workStatus.kind === 'error' && <p className={styles.statusError}>{workStatus.message}</p>}
                <p className={styles.footNote}>
                  {workConfigured
                    ? 'Saved. The Plan week agent uses these values.'
                    : `Not configured: the Plan week agent uses the default (${DEFAULT_WORK_HOURS_PER_DAY} h, ${DEFAULT_WORK_DAY_NAMES}).`}
                </p>
              </div>
            )}

            {section === 'mincer' && (
              <div className={styles.form}>
                <h3 className={styles.formTitle}>Mincer</h3>
                <p className={styles.formHelp}>
                  Models used by Mincer to transcribe audio and summarize content. Uses your OpenRouter key.
                </p>
                <label className={styles.label} htmlFor="mincer-transcription-model">
                  Transcription model
                </label>
                <select
                  id="mincer-transcription-model"
                  className={styles.select}
                  value={transcriptionModel}
                  disabled={!hasKey || modelsStatus === 'loading'}
                  onChange={(e) =>
                    handleMincerSettingChange(
                      MINCER_TRANSCRIPTION_MODEL_KEY,
                      e.target.value,
                      setTranscriptionModel,
                    )
                  }
                >
                  <option value="">
                    {!hasKey
                      ? 'Add your OpenRouter key first.'
                      : modelsStatus === 'loading'
                        ? 'loading models…'
                        : '— choose a model —'}
                  </option>
                  {transcriptionModel &&
                    !transcriptionModels.some((m) => m.id === transcriptionModel) && (
                      <option value={transcriptionModel}>{transcriptionModel}</option>
                    )}
                  {transcriptionModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {modelsStatus === 'error' && <p className={styles.statusError}>{modelsError}</p>}
                <p className={styles.footNote}>
                  Needed for audio, video, recordings and YouTube.
                </p>
                <label className={styles.label} htmlFor="mincer-summary-model">
                  Summary model
                </label>
                <input
                  id="mincer-summary-model"
                  className={styles.input}
                  type="text"
                  value={summaryModel}
                  placeholder="same as Chat model"
                  onChange={(e) =>
                    handleMincerSettingChange(MINCER_SUMMARY_MODEL_KEY, e.target.value, setSummaryModel)
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className={styles.footNote}>
                  OpenRouter model id that writes the summaries. Leave empty to use the Chat model.
                </p>
                <label className={styles.label} htmlFor="mincer-silence-stop">
                  Stop recording after silence
                </label>
                <select
                  id="mincer-silence-stop"
                  className={styles.select}
                  value={silenceStop}
                  onChange={(e) => handleMincerSettingChange(MINCER_SILENCE_STOP_KEY, e.target.value, setSilenceStop)}
                >
                  <option value="0">Off</option>
                  {[5, 10, 15, 20, 30].map((m) => (
                    <option key={m} value={String(m)}>
                      {m} min
                    </option>
                  ))}
                </select>
                <p className={styles.footNote}>
                  When neither the system audio nor the microphone has sound for this long, the recording
                  stops and is processed without the silent end. You get a Windows notice before it stops.
                </p>
                <label className={styles.label} htmlFor="mincer-max-record">
                  Maximum recording length
                </label>
                <select
                  id="mincer-max-record"
                  className={styles.select}
                  value={maxRecordHours}
                  onChange={(e) => handleMincerSettingChange(MINCER_MAX_RECORD_KEY, e.target.value, setMaxRecordHours)}
                >
                  {[1, 2, 3, 4, 6, 8].map((h) => (
                    <option key={h} value={String(h)}>
                      {h} h
                    </option>
                  ))}
                </select>
                <p className={styles.footNote}>
                  A safety limit: the recording stops and is processed when it reaches this length.
                </p>
              </div>
            )}

            {section === 'about' && (
              <div className={styles.form}>
                <h3 className={styles.formTitle}>About & Updates</h3>

                <div className={styles.versionRow}>
                  <span className={styles.label}>Version</span>
                  <span className={styles.versionText}>{appVersion ?? '…'}</span>
                </div>

                <label className={styles.label} htmlFor="update-pref">
                  Update behavior
                </label>
                <select
                  id="update-pref"
                  className={styles.select}
                  value={updatePref}
                  onChange={(e) => handlePrefChange(e.target.value as UpdatePreference)}
                >
                  <option value="ask">Ask before updating</option>
                  <option value="auto">Update automatically</option>
                  <option value="never">Never check for updates</option>
                </select>

                <div className={styles.actions}>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={handleCheckNow}
                    disabled={checking}
                  >
                    {checking ? 'Checking…' : 'Check for updates now'}
                  </button>
                </div>

                {checkStatus.kind !== 'idle' && (
                  <p
                    className={
                      checkStatus.kind === 'error' ? styles.statusError : styles.statusOk
                    }
                  >
                    {checkStatus.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
