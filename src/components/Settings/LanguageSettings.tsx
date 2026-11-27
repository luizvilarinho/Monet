import { Notebook, SpeakerHigh, Trash } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLanguageSettings } from '../../hooks/useLanguageSettings'
import { useListenPlayer } from '../../hooks/useListenPlayer'
import { useTtsCatalog } from '../../hooks/useTtsCatalog'
import { LANGUAGE_CODES, languageName, type LanguageToolsMode } from '../../lib/language'
import {
  DEFAULT_TRANSLATE_MODEL,
  LANGUAGE_TOOLS_KEY,
  NATIVE_LANGUAGE_KEY,
  TRANSLATE_MODEL_KEY,
  TTS_SPEEDS,
  TTS_SPEED_KEY,
  VOCAB_MARKS_KEY,
  getSystemLanguage,
  getTranslateModel,
  getTtsVoice,
  isValidModelId,
  setLanguageToolsMode,
  setNativeLanguage,
  setTranslateModel,
  setTtsChoice,
  setTtsSpeed,
  setVocabMarks,
} from '../../lib/languageSettings'
import {
  TTS_ACTION_LABEL,
  ttsCacheSize,
  ttsClearAll,
  ttsErrorActions,
  ttsErrorSentence,
  ttsUsage,
  toTtsError,
  type TtsCacheSize,
  type TtsError,
  type TtsErrorAction,
  type TtsUsage,
} from '../../lib/speech'
import {
  CHARS_PER_HOUR,
  CHARS_PER_PAGE,
  estimateCost,
  formatUsd,
  hasPublishedPrice,
  sumUsageCost,
} from '../../lib/ttsCost'
import { pickTestLanguage, testSentenceFor } from '../../lib/voiceTest'
import { storage } from '../../storage'
import { VoiceModelPicker } from '../LanguageTools/VoiceModelPicker'
import type { SettingsSection } from './SettingsModal'
import styles from './SettingsModal.module.css'
import own from './LanguageSettings.module.css'

interface LanguageSettingsProps {
  // "Saved" ao lado do campo gravado (estado do SettingsModal, que o apaga em 2 s).
  savedBadge: (field: string) => ReactNode
  markSaved: (field: string) => void
  // Troca de seção (o erro de voz leva à chave do OpenRouter).
  onOpenSection: (section: SettingsSection) => void
  // Abre a nota de perfil de língua (cria, se ainda não existe). `bookLanguage` é a
  // língua que o template de uma nota nova traz.
  onOpenLanguageProfile: (input: { nativeLanguage: string; bookLanguage: string }) => Promise<ProfileOpenResult>
}

// O que a janela principal diz depois de "Open the note".
export type ProfileOpenResult = 'opened' | 'no-notebook' | 'failed'

const TOOLS_OPTIONS: Array<{ value: LanguageToolsMode; label: string }> = [
  { value: 'other', label: 'In books in another language' },
  { value: 'all', label: 'In every book' },
  { value: 'never', label: 'Never' },
]

const VOICE_PICKER_ID = 'settings-voice'
const NO_TOAST = () => {}

function speedLabel(speed: number): string {
  return `${speed === 1 ? '1.0' : speed}×`
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function approx(cost: number | null): string {
  return cost === null ? 'Price not published' : `~ ${formatUsd(cost)}`
}

// Settings › Language: a língua do usuário, quando as ferramentas de língua
// aparecem no leitor, o modelo da tradução e a leitura em voz alta (modelo, voz,
// velocidade e o custo). Cada campo grava na hora.
export function LanguageSettings({
  savedBadge,
  markSaved,
  onOpenSection,
  onOpenLanguageProfile,
}: LanguageSettingsProps) {
  const { nativeLanguage, toolsMode, ttsModel, ttsSpeed, vocabMarks } = useLanguageSettings()
  const [profileProblem, setProfileProblem] = useState<string | null>(null)
  const [model, setModel] = useState(getTranslateModel)
  const [modelInvalid, setModelInvalid] = useState(false)
  const catalog = useTtsCatalog()
  // O "Test voice" fala pelo mesmo motor do leitor, num player só desta tela, sem
  // livro: o áudio vai para o cache compartilhado.
  // A voz do teste e a do seletor são as da língua do livro aberto por último.
  const [testLanguage, setTestLanguage] = useState(() => pickTestLanguage([], nativeLanguage))
  const tester = useListenPlayer({
    bookId: null,
    mincerRecording: false,
    showToast: NO_TOAST,
    models: catalog.models,
    language: testLanguage,
  })
  const [test, setTest] = useState<{ playing: boolean; error: TtsError | null }>({ playing: false, error: null })
  const [usage, setUsage] = useState<TtsUsage | null>(null)
  const [cache, setCache] = useState<TtsCacheSize | null>(null)
  const [clearing, setClearing] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // O uso (contado no Rust) e o tamanho do áudio guardado: lidos ao abrir a seção e
  // depois de cada teste ou limpeza.
  const refreshCost = useCallback(async () => {
    const [nextUsage, nextCache] = await Promise.all([ttsUsage().catch(() => null), ttsCacheSize().catch(() => null)])
    if (!alive.current) return
    setUsage(nextUsage)
    setCache(nextCache)
  }, [])
  useEffect(() => {
    void refreshCost()
  }, [refreshCost])

  useEffect(() => {
    let cancelled = false
    storage
      .getBooks()
      .catch(() => [])
      .then((books) => {
        if (!cancelled) setTestLanguage(pickTestLanguage(books, nativeLanguage))
      })
    return () => {
      cancelled = true
    }
  }, [nativeLanguage])

  // A língua do sistema vem primeiro (é o padrão); uma língua salva fora da
  // lista aparece como está.
  const system = getSystemLanguage()
  const known: readonly string[] = LANGUAGE_CODES
  const codes = [
    system,
    ...known.filter((code) => code !== system),
    ...(nativeLanguage !== system && !known.includes(nativeLanguage) ? [nativeLanguage] : []),
  ]

  function handleModelChange(value: string) {
    setModel(value)
    const trimmed = value.trim()
    // Vazio volta ao padrão; id fora do formato `provedor/nome` não grava.
    if (trimmed && !isValidModelId(trimmed)) {
      setModelInvalid(true)
      return
    }
    setModelInvalid(false)
    setTranslateModel(trimmed)
    markSaved(TRANSLATE_MODEL_KEY)
  }

  async function runTest() {
    setTest({ playing: true, error: null })
    try {
      await tester.speakOnce(testSentenceFor(testLanguage), testLanguage)
      if (alive.current) setTest({ playing: false, error: null })
    } catch (e) {
      if (alive.current) setTest({ playing: false, error: toTtsError(e) })
    }
    void refreshCost()
  }

  function runErrorAction(action: TtsErrorAction) {
    if (action === 'settings') onOpenSection('openrouter')
    else if (action === 'retry') void runTest()
    else if (action === 'change-model') document.getElementById(`${VOICE_PICKER_ID}-model`)?.focus()
  }

  async function handleOpenProfile() {
    setProfileProblem(null)
    const books = await storage.getBooks().catch(() => [])
    const result = await onOpenLanguageProfile({
      nativeLanguage,
      bookLanguage: pickTestLanguage(books, nativeLanguage),
    })
    if (!alive.current) return
    if (result === 'no-notebook') setProfileProblem('Create a notebook first: the note goes into one.')
    else if (result === 'failed') setProfileProblem("Couldn't create the note. Try again.")
  }

  async function handleClearAudio() {
    setClearing(true)
    try {
      await ttsClearAll()
    } catch (e) {
      console.error('failed to clear the saved audio', e)
    }
    if (alive.current) setClearing(false)
    await refreshCost()
  }

  // Custo com a voz escolhida: preços do catálogo; modelo fora dele ou sem preço
  // publicado não tem estimativa.
  const selected = catalog.models.find((m) => m.id === ttsModel)
  const priced = selected && hasPublishedPrice(selected) ? selected : null
  const monthByModel = usage?.months[currentMonth()] ?? {}
  const monthChars = Object.values(monthByModel).reduce((total, chars) => total + chars, 0)
  const monthCost = sumUsageCost(monthByModel, catalog.models)
  const megabytes = cache ? (cache.bytes / (1024 * 1024)).toFixed(1) : '0.0'

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>Language</h3>
      <p className={styles.formHelp}>
        For books in a language you are learning: translation and reading aloud of what you select. Uses your
        OpenRouter key.
      </p>

      <label className={styles.label} htmlFor="language-native">
        Your language {savedBadge(NATIVE_LANGUAGE_KEY)}
      </label>
      <select
        id="language-native"
        className={styles.select}
        value={nativeLanguage}
        onChange={(e) => {
          setNativeLanguage(e.target.value)
          markSaved(NATIVE_LANGUAGE_KEY)
        }}
      >
        {codes.map((code) => (
          <option key={code} value={code}>
            {languageName(code)}
            {code === system ? ' (from the system)' : ''}
          </option>
        ))}
      </select>
      <p className={styles.footNote}>Translations and grammar notes are written in this language.</p>

      <label className={styles.label} htmlFor="language-tools">
        Show language tools {savedBadge(LANGUAGE_TOOLS_KEY)}
      </label>
      <select
        id="language-tools"
        className={styles.select}
        value={toolsMode}
        onChange={(e) => {
          setLanguageToolsMode(e.target.value as LanguageToolsMode)
          markSaved(LANGUAGE_TOOLS_KEY)
        }}
      >
        {TOOLS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className={styles.footNote}>
        Translate and Listen in the selection bar, Listen to page, and the T and L keys. The language of each book
        is set in the Library.
      </p>

      <label className={styles.label} htmlFor="language-translate-model">
        Translation model {savedBadge(TRANSLATE_MODEL_KEY)}
      </label>
      <input
        id="language-translate-model"
        className={styles.input}
        type="text"
        value={model}
        placeholder={DEFAULT_TRANSLATE_MODEL}
        onChange={(e) => handleModelChange(e.target.value)}
        // Campo vazio ou com id inválido volta ao modelo salvo ao sair.
        onBlur={() => {
          setModel(getTranslateModel())
          setModelInvalid(false)
        }}
        autoComplete="off"
        spellCheck={false}
      />
      {modelInvalid && <p className={styles.statusError}>Use the format provider/model, without spaces.</p>}
      <p className={styles.footNote}>OpenRouter model id. A small, fast model is enough.</p>

      <h4 className={own.sectionTitle}>Reading aloud</h4>
      <VoiceModelPicker
        models={catalog.models}
        loading={catalog.loading}
        modelId={ttsModel}
        voice={getTtsVoice(ttsModel, testLanguage)}
        language={testLanguage}
        idPrefix={VOICE_PICKER_ID}
        labelClassName={styles.label}
        selectClassName={styles.select}
        onChange={(modelId, voice) => setTtsChoice(modelId, voice, testLanguage)}
        voiceExtra={
          <button type="button" className={own.testButton} onClick={() => void runTest()} disabled={test.playing}>
            <SpeakerHigh size={13} aria-hidden />
            {test.playing ? 'Playing…' : 'Test voice'}
          </button>
        }
      />
      {test.error ? (
        <p className={own.testError} role="alert">
          <span>Couldn&apos;t play the test: {ttsErrorSentence(test.error)}</span>
          {ttsErrorActions(test.error)
            .filter((action) => action !== 'skip')
            .map((action) => (
              <button key={action} type="button" className={styles.linkBtn} onClick={() => runErrorAction(action)}>
                {action === 'settings' ? 'Go to the OpenRouter key' : TTS_ACTION_LABEL[action]}
              </button>
            ))}
        </p>
      ) : (
        <p className={styles.footNote}>Reads a short test paragraph. Costs about the price of one sentence.</p>
      )}

      <label className={styles.label} htmlFor="language-tts-speed">
        Default speed {savedBadge(TTS_SPEED_KEY)}
      </label>
      <select
        id="language-tts-speed"
        className={styles.select}
        value={ttsSpeed}
        onChange={(e) => {
          setTtsSpeed(Number(e.target.value))
          markSaved(TTS_SPEED_KEY)
        }}
      >
        {TTS_SPEEDS.map((speed) => (
          <option key={speed} value={speed}>
            {speedLabel(speed)}
          </option>
        ))}
      </select>
      <p className={styles.footNote}>Slowed in the player, so the same audio serves every speed.</p>

      <div className={own.costBox}>
        <span className={own.costTitle}>Cost of audio with this voice</span>
        <div className={own.costRow}>
          <span>One page (about 2,400 characters)</span>
          <span className={own.costValue}>{approx(priced ? estimateCost(priced, CHARS_PER_PAGE) : null)}</span>
        </div>
        <div className={own.costRow}>
          <span>One hour of listening</span>
          <span className={own.costValue}>{approx(priced ? estimateCost(priced, CHARS_PER_HOUR) : null)}</span>
        </div>
        <div className={own.costRow}>
          <span>This month: {monthChars.toLocaleString('en-US')} characters generated</span>
          <span className={own.costValue}>{approx(monthCost.cost)}</span>
        </div>
        {monthCost.unpriced && <p className={own.costNote}>Some models have no published price.</p>}
        <div className={own.costRow}>
          <span>Saved audio on this device</span>
          <span className={own.costValue}>
            {(cache?.files ?? 0).toLocaleString('en-US')} sentences · {megabytes} MB
          </span>
        </div>
        <p className={own.costNote}>
          You only pay for what you listen to, once: repeating a sentence or a page is free while its audio is
          saved. All figures are estimates.
        </p>
        <button
          type="button"
          className={own.clearButton}
          onClick={() => void handleClearAudio()}
          disabled={clearing || (cache?.files ?? 0) === 0}
        >
          <Trash size={13} aria-hidden />
          Clear saved audio
        </button>
      </div>

      <h4 className={own.sectionTitle}>Vocabulary</h4>
      <label className={own.checkRow}>
        <input
          type="checkbox"
          checked={vocabMarks}
          onChange={(e) => {
            setVocabMarks(e.target.checked)
            markSaved(VOCAB_MARKS_KEY)
          }}
        />
        Mark vocabulary items in the text of every book in the same language {savedBadge(VOCAB_MARKS_KEY)}
      </label>
      <p className={styles.footNote}>
        A dotted underline on the words and expressions you saved, and on the sentences where you saved them. The same
        switch is at the top of the Vocabulary tab in a book.
      </p>

      <h4 className={own.sectionTitle}>Language profile</h4>
      <p className={styles.formHelp}>
        A note tagged <b>language profile</b> tells the AI your level in each language and how you want explanations. The
        Language teacher in a book&apos;s chat reads it. Without the note, the teacher works without a level.
      </p>
      <div>
        <button type="button" className={own.testButton} onClick={() => void handleOpenProfile()}>
          <Notebook size={13} aria-hidden />
          Open the note
        </button>
      </div>
      {profileProblem && (
        <p className={own.testError} role="alert">
          {profileProblem}
        </p>
      )}
    </div>
  )
}
