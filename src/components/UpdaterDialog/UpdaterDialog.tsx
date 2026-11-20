import { useEffect, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import type { Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { mincerActiveJob, mincerRecordStatus } from '../../lib/mincer'
import styles from './UpdaterDialog.module.css'

type Phase = 'prompt' | 'downloading' | 'ready' | 'confirmMincer' | 'error'

interface Props {
  update: Update
  mandatory: boolean
  autoStart: boolean
  onLater: () => void
  onSkip: (version: string) => void
  onClose: () => void
}

export function UpdaterDialog({ update, mandatory, autoStart, onLater, onSkip, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>(() => (autoStart ? 'downloading' : 'prompt'))
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  // Download fechado pelo usuário: o diálogo some, o download continua e ele
  // volta sozinho quando termina (ready) ou falha.
  const [hidden, setHidden] = useState(false)
  const startedRef = useRef(false)
  const mincerStoppedRef = useRef(false)

  useEffect(() => {
    if (autoStart) triggerDownload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function triggerDownload() {
    if (startedRef.current) return
    startedRef.current = true
    setPhase('downloading')
    setProgress(0)

    let total = 0
    let received = 0

    try {
      await update.download((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength
          if (total > 0) setProgress(Math.round((received / total) * 100))
        } else if (event.event === 'Finished') {
          setProgress(100)
        }
      })
      setPhase('ready')
      setHidden(false)
    } catch (err) {
      startedRef.current = false
      setErrorMsg(err instanceof Error ? err.message : 'Download failed.')
      setPhase('error')
      setHidden(false)
    }
  }

  // O install sai do processo sem passar pelo shutdown normal: com gravação do
  // Mincer em curso, bloqueia; com job em processamento, pede confirmação.
  async function handleInstallAndRestart() {
    setBlockedMsg(null)
    let recording = false
    let activeJob: string | null = null
    try {
      const [status, job] = await Promise.all([mincerRecordStatus(), mincerActiveJob()])
      recording = status.active
      activeJob = job
    } catch (err) {
      // Sem o status do Mincer, segue como ocioso para não travar a atualização.
      console.warn('updater: failed to read Mincer status', err)
    }
    if (recording) {
      setBlockedMsg('Mincer is recording. Stop the recording in Mincer before installing the update.')
      return
    }
    if (activeJob) {
      setPhase('confirmMincer')
      return
    }
    await install(false)
  }

  async function install(stopMincer: boolean) {
    try {
      if (stopMincer) {
        await invoke('mincer_prepare_update')
        mincerStoppedRef.current = true
      }
      await update.install()
      await relaunch()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to install update.'
      setErrorMsg(
        mincerStoppedRef.current ? `${msg} Restart Monet to resume Mincer processing.` : msg,
      )
      setPhase('error')
    }
  }

  function handleLater() {
    onLater()
    onClose()
  }

  function handleSkip() {
    onSkip(update.version)
    onClose()
  }

  useEffect(() => {
    if (mandatory || hidden) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (phase === 'prompt') {
        onLater()
        onClose()
      } else if (phase === 'downloading') {
        setHidden(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, mandatory, hidden, onLater, onClose])

  if (hidden) return null

  const canDismissOverlay = !mandatory && phase === 'prompt'
  const releaseNotes = update.body?.trim() || null
  const fallback = `Version ${update.version} available. Connect to the internet to see what's new.`

  return (
    <div
      className={styles.overlay}
      onClick={canDismissOverlay ? handleLater : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="App update available"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            {mandatory ? 'Required Update' : 'Update Available'}
          </h2>
          {!mandatory && (phase === 'prompt' || phase === 'downloading') && (
            <button
              className={styles.close}
              onClick={phase === 'downloading' ? () => setHidden(true) : handleLater}
              aria-label={phase === 'downloading' ? 'Continue the download in the background' : 'Close'}
              title={phase === 'downloading' ? 'Continue in the background' : 'Close'}
              type="button"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </header>

        <div className={styles.body}>
          {(phase === 'prompt' || phase === 'downloading') && (
            <>
              <div className={styles.versions}>
                <span className={styles.versionLabel}>New version</span>
                <span className={styles.versionValue}>{update.version}</span>
                <span className={styles.versionLabel}>Installed</span>
                <span className={styles.versionValue}>{update.currentVersion}</span>
              </div>

              {mandatory && phase === 'prompt' && (
                <p className={styles.mandatoryNote}>
                  This update is required to continue using the app.
                </p>
              )}

              {phase === 'prompt' && (
                <div className={styles.notes}>
                  {releaseNotes ? (
                    <pre className={styles.notesContent}>{releaseNotes}</pre>
                  ) : (
                    <p className={styles.notesOffline}>{fallback}</p>
                  )}
                </div>
              )}

              {phase === 'downloading' && (
                <div className={styles.progressArea}>
                  <p className={styles.downloadingText}>
                    Downloading update…
                    {!mandatory && ' You can keep working: this window comes back when the update is ready.'}
                  </p>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                  <span className={styles.progressPct}>{progress}%</span>
                </div>
              )}
            </>
          )}

          {phase === 'ready' && (
            <>
              <p className={styles.readyText}>
                Update downloaded. Restart the app to apply version {update.version}.
              </p>
              {blockedMsg && (
                <p className={styles.errorText} role="alert">
                  {blockedMsg}
                </p>
              )}
            </>
          )}

          {phase === 'confirmMincer' && (
            <p className={styles.confirmText}>
              Mincer is processing an item. Installing now pauses it; it resumes after the restart.
            </p>
          )}

          {phase === 'error' && (
            <p className={styles.errorText}>{errorMsg}</p>
          )}
        </div>

        <footer className={styles.footer}>
          {phase === 'prompt' && (
            <>
              <button className={styles.primary} type="button" onClick={triggerDownload}>
                Update now
              </button>
              {!mandatory && (
                <>
                  <button className={styles.secondary} type="button" onClick={handleLater}>
                    Later
                  </button>
                  <button className={styles.tertiary} type="button" onClick={handleSkip}>
                    Skip this version
                  </button>
                </>
              )}
            </>
          )}

          {phase === 'downloading' && (
            <>
              <button className={styles.primary} type="button" disabled>
                Downloading…
              </button>
              {!mandatory && (
                <button className={styles.secondary} type="button" onClick={() => setHidden(true)}>
                  Continue in background
                </button>
              )}
            </>
          )}

          {phase === 'ready' && (
            <>
              <button className={styles.primary} type="button" onClick={handleInstallAndRestart}>
                Restart now
              </button>
              <button className={styles.secondary} type="button" onClick={onClose}>
                Restart later
              </button>
            </>
          )}

          {phase === 'confirmMincer' && (
            <>
              <button className={styles.primary} type="button" onClick={() => install(true)}>
                Install and restart
              </button>
              <button className={styles.secondary} type="button" onClick={() => setPhase('ready')}>
                Cancel
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <button
                className={styles.primary}
                type="button"
                onClick={() => {
                  startedRef.current = false
                  triggerDownload()
                }}
              >
                Try again
              </button>
              {!mandatory && (
                <button className={styles.secondary} type="button" onClick={handleLater}>
                  Cancel
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
