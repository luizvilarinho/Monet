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
import styles from './SettingsModal.module.css'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onApiKeyChanged: (hasKey: boolean) => void
  onUpdateFound: (update: Update, mandatory: boolean) => void
}

type Section = 'openrouter' | 'search' | 'about'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'openrouter', label: 'OpenRouter Integration' },
  { id: 'search', label: 'Web Search' },
  { id: 'about', label: 'About & Updates' },
]

export function SettingsModal({
  open,
  onClose,
  onApiKeyChanged,
  onUpdateFound,
}: SettingsModalProps) {
  const [section, setSection] = useState<Section>('openrouter')

  // OpenRouter state
  const [keyValue, setKeyValue] = useState('')
  const [hasKey, setHasKey] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{
    kind: 'idle' | 'success' | 'error'
    message: string
  }>({ kind: 'idle', message: '' })

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
    if (!open) return
    setStatus({ kind: 'idle', message: '' })
    setKeyValue('')
    hasOpenRouterKey()
      .then(setHasKey)
      .catch(() => setHasKey(false))
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
