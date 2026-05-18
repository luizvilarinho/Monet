import { useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import logoUrl from '../../assets/logo_monet_vector.svg'
import { saveOpenRouterKey } from '../../lib/openrouter'
import { saveTavilyKey } from '../../lib/search'
import styles from './Onboarding.module.css'

export interface OnboardingProps {
  onComplete: () => void
  onSkip: () => void
  onApiKeyChanged: (hasKey: boolean) => void
}

type Status = { kind: 'idle' | 'success' | 'error'; message: string }

const IDLE: Status = { kind: 'idle', message: '' }

async function validateOpenRouterKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://monet.local',
        'X-Title': 'Monet',
      },
    })
    if (res.status === 200) return { ok: true, message: 'Key is valid and saved locally.' }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Invalid key. Check it on openrouter.ai and try again.' }
    }
    return { ok: false, message: `OpenRouter responded ${res.status}. Try again later.` }
  } catch {
    return { ok: false, message: 'Network error. Check your internet connection and try again.' }
  }
}

async function validateTavilyKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: 'ping',
        max_results: 1,
        include_raw_content: false,
      }),
    })
    if (res.status === 200) return { ok: true, message: 'Key is valid and saved locally.' }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Invalid key. Check it on tavily.com and try again.' }
    }
    return { ok: false, message: `Tavily responded ${res.status}. Try again later.` }
  } catch {
    return { ok: false, message: 'Network error. Check your internet connection and try again.' }
  }
}

export function Onboarding({ onComplete, onSkip, onApiKeyChanged }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [orKey, setOrKey] = useState('')
  const [orStatus, setOrStatus] = useState<Status>(IDLE)
  const [orSaving, setOrSaving] = useState(false)
  const [orSaved, setOrSaved] = useState(false)

  const [tavKey, setTavKey] = useState('')
  const [tavStatus, setTavStatus] = useState<Status>(IDLE)
  const [tavSaving, setTavSaving] = useState(false)
  const [tavSaved, setTavSaved] = useState(false)

  const goNext = () => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))

  async function handleSaveOpenRouter() {
    const trimmed = orKey.trim()
    if (!trimmed) {
      setOrStatus({ kind: 'error', message: 'Please paste your API key.' })
      return
    }
    setOrSaving(true)
    setOrStatus(IDLE)
    const result = await validateOpenRouterKey(trimmed)
    if (result.ok) {
      try {
        await saveOpenRouterKey(trimmed)
        setOrSaved(true)
        setOrStatus({ kind: 'success', message: result.message })
        onApiKeyChanged(true)
      } catch (err) {
        setOrStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to save key locally.',
        })
      }
    } else {
      setOrStatus({ kind: 'error', message: result.message })
    }
    setOrSaving(false)
  }

  async function handleSaveTavily() {
    const trimmed = tavKey.trim()
    if (!trimmed) {
      setTavStatus({ kind: 'error', message: 'Please paste your API key.' })
      return
    }
    setTavSaving(true)
    setTavStatus(IDLE)
    const result = await validateTavilyKey(trimmed)
    if (result.ok) {
      try {
        await saveTavilyKey(trimmed)
        setTavSaved(true)
        setTavStatus({ kind: 'success', message: result.message })
      } catch (err) {
        setTavStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to save key locally.',
        })
      }
    } else {
      setTavStatus({ kind: 'error', message: result.message })
    }
    setTavSaving(false)
  }

  const openExternal = (url: string) => {
    void openUrl(url)
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Welcome to Monet">
      <div className={styles.modal}>
        <header className={styles.header}>
          <img src={logoUrl} alt="Monet" className={styles.logo} />
          <div className={styles.progress} aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={n === step ? styles.dotActive : n < step ? styles.dotDone : styles.dot}
                aria-current={n === step ? 'step' : undefined}
              />
            ))}
            <span className={styles.progressLabel}>Step {step} of 3</span>
          </div>
        </header>

        <div className={styles.body}>
          {step === 1 && (
            <section className={styles.section}>
              <h1 className={styles.title}>Capture knowledge as it happens</h1>
              <p className={styles.lead}>
                Monet is a note-taking app for active learning. Write while you watch a lecture,
                read a book, or attend a meeting — and call the AI inline with{' '}
                <code>/commands</code> only when you actually need it. The AI stays silent until
                you ask.
              </p>

              <div className={styles.diagram} aria-label="App layout overview">
                <div className={styles.col} data-col="notebooks">
                  <div className={styles.colLabel}>Notebooks</div>
                  <div className={styles.colHint}>Group notes by topic</div>
                  <div className={styles.itemList}>
                    <span className={styles.itemLine} />
                    <span className={styles.itemLine} />
                    <span className={styles.itemLineActive} />
                    <span className={styles.itemLine} />
                  </div>
                </div>
                <div className={styles.col} data-col="notes">
                  <div className={styles.colLabel}>Notes</div>
                  <div className={styles.colHint}>List for the current notebook</div>
                  <div className={styles.itemList}>
                    <span className={styles.itemLineActive} />
                    <span className={styles.itemLine} />
                    <span className={styles.itemLine} />
                  </div>
                </div>
                <div className={`${styles.col} ${styles.colEditor}`} data-col="editor">
                  <div className={styles.colLabel}>Editor</div>
                  <div className={styles.colHint}>Markdown with /commands</div>
                  <div className={styles.editorMock}>
                    <span className={styles.editorLine} style={{ width: '80%' }} />
                    <span className={styles.editorLine} style={{ width: '65%' }} />
                    <span className={styles.editorLine} style={{ width: '90%' }} />
                    <span className={styles.editorLineCmd}>/expand quantum tunneling</span>
                    <span className={styles.editorLine} style={{ width: '70%' }} />
                  </div>
                </div>
                <div className={styles.col} data-col="ai">
                  <div className={styles.colLabel}>AI panel</div>
                  <div className={styles.colHint}>Answers without breaking focus</div>
                  <div className={styles.aiCardMock}>
                    <span className={styles.aiCardTag}>/expand</span>
                    <span className={styles.itemLine} />
                    <span className={styles.itemLine} />
                    <span className={styles.itemLine} style={{ width: '60%' }} />
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.skipBtn} onClick={onSkip}>
                  Skip
                </button>
                <button type="button" className={styles.primaryBtn} onClick={goNext}>
                  Next
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className={styles.section}>
              <h1 className={styles.title}>Connect your AI</h1>
              <p className={styles.lead}>
                Monet uses <strong>OpenRouter</strong> to talk to AI models (GPT, Claude, Gemini
                and more) through a single key. Create a free account, top up a few dollars in
                credits, then paste your key below.
              </p>

              <ol className={styles.steps}>
                <li>
                  Go to{' '}
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => openExternal('https://openrouter.ai/keys')}
                  >
                    openrouter.ai/keys
                  </button>{' '}
                  and create an account.
                </li>
                <li>Click <em>Create Key</em> and copy the value that starts with <code>sk-or-v1-</code>.</li>
                <li>Paste it below and click <em>Save key</em>.</li>
              </ol>

              <label className={styles.label} htmlFor="onb-or-key">OpenRouter API key</label>
              <input
                id="onb-or-key"
                className={styles.input}
                type="password"
                value={orKey}
                placeholder="sk-or-v1-..."
                onChange={(e) => {
                  setOrKey(e.target.value)
                  if (orStatus.kind !== 'idle') setOrStatus(IDLE)
                  if (orSaved) setOrSaved(false)
                }}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveOpenRouter() }}
              />

              {orStatus.kind !== 'idle' && (
                <p className={orStatus.kind === 'success' ? styles.statusOk : styles.statusError}>
                  {orStatus.message}
                </p>
              )}

              <p className={styles.note}>
                Your key is stored only on this computer, in a file managed by the app. Monet
                never sends it anywhere except to OpenRouter.
              </p>

              <div className={styles.actions}>
                <button type="button" className={styles.skipBtn} onClick={onSkip}>
                  Skip
                </button>
                <div className={styles.actionsRight}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={handleSaveOpenRouter}
                    disabled={orSaving}
                  >
                    {orSaving ? 'Testing...' : orSaved ? 'Saved' : 'Save key'}
                  </button>
                  <button type="button" className={styles.primaryBtn} onClick={goNext}>
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className={styles.section}>
              <h1 className={styles.title}>Enable web search <span className={styles.optional}>(optional)</span></h1>
              <p className={styles.lead}>
                The <code>/search</code> and <code>/profile</code> commands rely on{' '}
                <strong>Tavily</strong> to look things up on the web. The free tier includes{' '}
                <strong>1,000 searches/month</strong> and does not require a credit card.
              </p>

              <ol className={styles.steps}>
                <li>
                  Go to{' '}
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => openExternal('https://app.tavily.com/home')}
                  >
                    tavily.com
                  </button>{' '}
                  and sign up.
                </li>
                <li>Copy your API key (starts with <code>tvly-</code>).</li>
                <li>Paste it below and click <em>Save key</em>.</li>
              </ol>

              <label className={styles.label} htmlFor="onb-tav-key">Tavily API key</label>
              <input
                id="onb-tav-key"
                className={styles.input}
                type="password"
                value={tavKey}
                placeholder="tvly-..."
                onChange={(e) => {
                  setTavKey(e.target.value)
                  if (tavStatus.kind !== 'idle') setTavStatus(IDLE)
                  if (tavSaved) setTavSaved(false)
                }}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveTavily() }}
              />

              {tavStatus.kind !== 'idle' && (
                <p className={tavStatus.kind === 'success' ? styles.statusOk : styles.statusError}>
                  {tavStatus.message}
                </p>
              )}

              <p className={styles.note}>
                Without a Tavily key, <code>/search</code> and <code>/profile</code> still work,
                but they rely only on what the model already knows. No live results.
              </p>

              <div className={styles.actions}>
                <button type="button" className={styles.skipBtn} onClick={onComplete}>
                  Skip for now
                </button>
                <div className={styles.actionsRight}>
                  {!tavSaved && (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={handleSaveTavily}
                      disabled={tavSaving}
                    >
                      {tavSaving ? 'Testing...' : 'Save key'}
                    </button>
                  )}
                  {tavSaved && (
                    <button type="button" className={styles.primaryBtn} onClick={onComplete}>
                      Get started
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
