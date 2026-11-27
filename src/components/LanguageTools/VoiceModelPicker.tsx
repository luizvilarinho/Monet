import type { ReactNode } from 'react'
import { getTtsVoice } from '../../lib/languageSettings'
import type { TtsModel } from '../../lib/speech'
import { modelOptionLabel, voiceFor, voicesByLanguage } from '../../lib/ttsCost'
import styles from './VoiceModelPicker.module.css'

export interface VoiceModelPickerProps {
  // Lista lida do catálogo do OpenRouter; vazia sem rede.
  models: TtsModel[]
  loading: boolean
  modelId: string
  voice: string | null
  // Língua do livro: as vozes dela vêm primeiro e valem como padrão. '' sem livro.
  language: string
  onChange: (modelId: string, voice: string | null) => void
  // Versão do menu ⋯ do player: rótulos em cima, 248 px.
  compact?: boolean
  // Settings: as classes de rótulo e de campo da seção, para o seletor se
  // misturar ao formulário. Sem elas vale o estilo do menu do player.
  labelClassName?: string
  selectClassName?: string
  // Ao lado do campo de voz (o "Test voice" do Settings).
  voiceExtra?: ReactNode
  // Prefixo dos ids de campo, para os rótulos (dois seletores na mesma tela).
  idPrefix?: string
}

// Modelo e voz da leitura em voz alta. Nada é fixo no código: os modelos, as vozes
// e os preços vêm do catálogo. O modelo salvo que não está na lista (sem rede, ou
// removido do OpenRouter) aparece como única opção extra.
export function VoiceModelPicker({
  models,
  loading,
  modelId,
  voice,
  language,
  onChange,
  compact = false,
  labelClassName,
  selectClassName,
  voiceExtra,
  idPrefix = 'voice-picker',
}: VoiceModelPickerProps) {
  const model = models.find((m) => m.id === modelId)
  // Sem o modelo no catálogo, a voz lembrada é a única que se conhece.
  const voices = model ? voicesByLanguage(model.voices, language) : voice ? [voice] : []
  const voiceValue = model ? (voiceFor(model, voice, language) ?? '') : (voice ?? '')

  function handleModelChange(nextId: string) {
    const next = models.find((m) => m.id === nextId)
    const saved = getTtsVoice(nextId, language)
    onChange(nextId, next ? voiceFor(next, saved, language) : saved)
  }

  const labelClass = labelClassName ?? styles.label
  const selectClass = selectClassName ?? styles.select
  const hint = loading
    ? 'Loading the voice models…'
    : models.length === 0
      ? "Couldn't load the voice models. The saved one is used."
      : null

  const fields = (
    <>
      <label className={labelClass} htmlFor={`${idPrefix}-model`}>
        Voice model
      </label>
      <select
        id={`${idPrefix}-model`}
        className={selectClass}
        value={modelId}
        onChange={(e) => handleModelChange(e.target.value)}
      >
        {!model && <option value={modelId}>{modelId} (saved)</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {modelOptionLabel(m)}
          </option>
        ))}
      </select>
      {hint && <p className={styles.hint}>{hint}</p>}
      <label className={labelClass} htmlFor={`${idPrefix}-voice`}>
        Voice
      </label>
      <div className={styles.line}>
        <select
          id={`${idPrefix}-voice`}
          className={`${selectClass} ${styles.grow}`}
          value={voiceValue}
          disabled={voices.length === 0}
          onChange={(e) => onChange(modelId, e.target.value || null)}
        >
          {voices.length === 0 && <option value="">Default voice</option>}
          {voices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {voiceExtra}
      </div>
    </>
  )

  return compact ? <div className={styles.compact}>{fields}</div> : fields
}
