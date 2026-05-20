import { useEffect, useRef, useState } from 'react'
import type { Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import styles from './UpdaterDialog.module.css'

type Phase = 'prompt' | 'downloading' | 'ready' | 'error'

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
  const startedRef = useRef(false)

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
    } catch (err) {
      startedRef.current = false
      setErrorMsg(err instanceof Error ? err.message : 'Download failed.')
      setPhase('error')
    }
  }

  async function handleInstallAndRestart() {
    try {
      await update.install()
      await relaunch()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to install update.')
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
    if (mandatory) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && phase === 'prompt') {
        onLater()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, mandatory, onLater, onClose])

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
          {!mandatory && phase === 'prompt' && (
            <button
              className={styles.close}
              onClick={handleLater}
              aria-label="close"
              type="button"
            >
              ×
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
                  <p className={styles.downloadingText}>Downloading update…</p>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                  <span className={styles.progressPct}>{progress}%</span>
                </div>
              )}
            </>
          )}

          {phase === 'ready' && (
            <p className={styles.readyText}>
              Update downloaded. Restart the app to apply version {update.version}.
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
            <button className={styles.primary} type="button" disabled>
              Downloading…
            </button>
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
