import { useEffect, useState } from 'react'
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
import styles from './SettingsModal.module.css'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onApiKeyChanged: (hasKey: boolean) => void
}

type Section = 'openrouter' | 'search'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'openrouter', label: 'Integração OpenRouter' },
  { id: 'search', label: 'Busca Web' },
]

export function SettingsModal({
  open,
  onClose,
  onApiKeyChanged,
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
      setStatus({ kind: 'error', message: 'Informe uma chave válida.' })
      return
    }
    if (!trimmed.startsWith('sk-or-v1-')) {
      setStatus({
        kind: 'error',
        message: 'Chave OpenRouter inválida (deve começar com sk-or-v1-).',
      })
      return
    }
    setSaving(true)
    try {
      await saveOpenRouterKey(trimmed)
      setHasKey(true)
      setKeyValue('')
      setStatus({ kind: 'success', message: 'Chave salva com segurança.' })
      onApiKeyChanged(true)
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao salvar chave.',
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
      setStatus({ kind: 'success', message: 'Chave removida.' })
      onApiKeyChanged(false)
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao remover chave.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleTavilySave() {
    const trimmed = tavilyValue.trim()
    if (!trimmed) {
      setTavStatus({ kind: 'error', message: 'Informe uma chave válida.' })
      return
    }
    if (!trimmed.startsWith('tvly-')) {
      setTavStatus({
        kind: 'error',
        message: 'Chave Tavily inválida (deve começar com tvly-).',
      })
      return
    }
    setTavSaving(true)
    try {
      await saveTavilyKey(trimmed)
      setHasTavily(true)
      setTavilyValue('')
      setTavStatus({ kind: 'success', message: 'Chave salva.' })
    } catch (err) {
      setTavStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao salvar chave.',
      })
    } finally {
      setTavSaving(false)
    }
  }

  async function handleTavilyClear() {
    try {
      await clearTavilyKey()
      setHasTavily(false)
      setTavStatus({ kind: 'success', message: 'Chave removida.' })
    } catch (err) {
      setTavStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao remover chave.',
      })
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Configurações">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Configurações</h2>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="fechar"
            type="button"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>
          <nav className={styles.sidebar} aria-label="seções">
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
                <h3 className={styles.formTitle}>Integração OpenRouter</h3>
                <p className={styles.formHelp}>
                  Sua chave é salva em arquivo local pelo app. Ela nunca é
                  exposta ao frontend depois de salva.
                </p>
                <label className={styles.label} htmlFor="or-key">
                  Chave de API
                </label>
                <input
                  id="or-key"
                  className={styles.input}
                  type="password"
                  value={keyValue}
                  placeholder={
                    hasKey
                      ? 'chave configurada — digite para substituir'
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
                    {saving ? 'salvando...' : 'salvar chave'}
                  </button>
                  {hasKey && (
                    <button
                      className={styles.secondary}
                      type="button"
                      onClick={handleClear}
                      disabled={saving}
                    >
                      remover chave
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
                    ? 'Uma chave já está configurada neste app.'
                    : 'Nenhuma chave configurada. Sem a chave, o painel IA não inicia solicitações.'}
                </p>
              </div>
            )}

            {section === 'search' && (
              <div className={styles.form}>
                <h3 className={styles.formTitle}>Busca Web (Tavily)</h3>
                <p className={styles.formHelp}>
                  A chave Tavily habilita os comandos <code>/pesquisa</code> e <code>/quem</code> a consultar a internet antes de responder. Crie uma conta gratuita em{' '}
                  <strong>tavily.com</strong> (1.000 buscas/mês grátis).
                </p>
                <label className={styles.label} htmlFor="tav-key">
                  Chave de API
                </label>
                <input
                  id="tav-key"
                  className={styles.input}
                  type="password"
                  value={tavilyValue}
                  placeholder={
                    hasTavily
                      ? 'chave configurada — digite para substituir'
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
                    salvar chave
                  </button>
                  {hasTavily && (
                    <button
                      className={styles.secondary}
                      type="button"
                      onClick={handleTavilyClear}
                      disabled={tavSaving}
                    >
                      remover chave
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
                    ? 'Busca web ativa. Comandos /pesquisa e /quem consultam a internet.'
                    : 'Sem a chave, /pesquisa e /quem usam apenas o conhecimento do modelo.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
