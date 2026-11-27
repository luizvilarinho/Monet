import { useEffect, useState } from 'react'
import type { LanguageToolsMode } from '../lib/language'
import {
  LANGUAGE_SETTINGS_EVENT,
  getLanguageToolsMode,
  getNativeLanguage,
  getTranslateModel,
  getTtsModel,
  getTtsShowText,
  getTtsSkipHeaders,
  getTtsSpeed,
  getVocabHideSenses,
  getVocabMarks,
} from '../lib/languageSettings'

export interface LanguageSettings {
  nativeLanguage: string
  toolsMode: LanguageToolsMode
  translateModel: string
  ttsModel: string
  ttsSpeed: number
  ttsShowText: boolean
  ttsSkipHeaders: boolean
  // "Hide meanings" da aba Vocabulary.
  vocabHideSenses: boolean
  // "Mark in text": o pontilhado das palavras guardadas na página.
  vocabMarks: boolean
}

function read(): LanguageSettings {
  return {
    nativeLanguage: getNativeLanguage(),
    toolsMode: getLanguageToolsMode(),
    translateModel: getTranslateModel(),
    ttsModel: getTtsModel(),
    ttsSpeed: getTtsSpeed(),
    ttsShowText: getTtsShowText(),
    ttsSkipHeaders: getTtsSkipHeaders(),
    vocabHideSenses: getVocabHideSenses(),
    vocabMarks: getVocabMarks(),
  }
}

// Re-renderiza quando o Settings (ou o popover de Translate, ou o menu do
// player) muda a configuração: é o que faz as ferramentas de língua aparecerem
// e sumirem na hora, com o leitor aberto.
export function useLanguageSettings(): LanguageSettings {
  const [settings, setSettings] = useState(read)
  useEffect(() => {
    const onChange = () => setSettings(read())
    window.addEventListener(LANGUAGE_SETTINGS_EVENT, onChange)
    return () => window.removeEventListener(LANGUAGE_SETTINGS_EVENT, onChange)
  }, [])
  return settings
}
