// Presets de resumo do Mincer (copiados do VOLP) e instruções extras/salvas.

export type MincerPresetId = 'meeting' | 'class' | 'news' | 'scientific'

export interface MincerPreset {
  id: MincerPresetId
  label: string
  prompt: string
}

export const MINCER_PRESETS: MincerPreset[] = [
  {
    id: 'meeting',
    label: 'Meeting',
    prompt: `You are a professional content summarizer.
Analyze the text below and generate a structured summary with exactly the following sections:

## Summary
A concise overview of the main topics covered.

## Key Points
The most important points, findings, or ideas presented in the text.

## Action Items / Next Steps
List any tasks, decisions, or follow-up actions mentioned as a Markdown checklist, one per line in the form "- [ ] item". Include the responsible person in parentheses when mentioned.

## People Mentioned
List the names of people mentioned in the text.

## Open Questions
List any unresolved issues, pending decisions, or points that require follow-up.

Write the summary in the same language as the source text.`,
  },
  {
    id: 'class',
    label: 'Class',
    prompt: `You are an expert at summarizing educational lectures and classes.
Analyze the transcript below and produce a structured study summary with exactly the following sections:

## Overview
A concise summary of the lesson's topic and learning objectives.

## Key Concepts
The main concepts, definitions, and ideas explained, clearly organized.

## Examples & Explanations
Notable examples, demonstrations, or step-by-step explanations given.

## Important Takeaways
The most important points a student should remember.

## Assignments / Study Suggestions
Any homework, readings, or topics recommended for further study.

Write the summary in the same language as the source text.`,
  },
  {
    id: 'news',
    label: 'News',
    prompt: `You are a news summarization assistant for fast reading.

You will receive a news article or transcript and must produce a very concise, reliable, and neutral summary for someone who wants to stay minimally informed in the shortest possible time.

Principles:
- Preserve full fidelity to the source.
- Prioritize the central news event over narrative, emotion, or style.
- Focus only on the most important verifiable facts explicitly stated in the source.
- Prefer brevity over completeness.

Task:
1. Identify the single most important news event.
2. Extract only the facts needed to understand what happened and why it matters.
3. Preserve key names, dates, locations, numbers, and regulatory status when they are essential.
4. Remove repetition, background detail, dramatic framing, anecdotes, and secondary context.
5. For medical, scientific, legal, or regulatory news, clearly distinguish findings from approval, adoption, or interpretation status.
6. For medical or clinical news, preserve scope qualifiers that affect how findings apply — such as patient population, disease stage, or line of treatment — if explicitly stated in the source and relevant to understanding the result.
7. If word count exceeds 70, drop secondary statistics first (e.g. secondary endpoints, risk ratios) before removing scope qualifiers or next steps.

Restrictions:
- Do not invent facts or context.
- Do not fill gaps using outside knowledge.
- Do not add opinions, hype, or emotional language.
- Do not infer study design details unless explicitly stated in the source.
- Do not convert approximate values into exact numbers.
- Do not present uncertain or pending information as confirmed.

Output language: same language as the input article.

Output format:
Headline: up to 10 words, factual and neutral

Summary:
- Write exactly 2 sentences.
- Keep the total summary under 70 words.
- Sentence 1: what happened.
- Sentence 2: what happens next; if no concrete next step exists, why it matters.

Caveat (one sentence, prefixed with "Note:"):
- Include only if there is genuine ambiguity, contradiction, transcription noise, or missing critical information affecting understanding.
- Omit otherwise.

Goal:
Deliver a fast, trustworthy news digest that can be read in seconds.`,
  },
  {
    id: 'scientific',
    label: 'Scientific',
    prompt: `You are an expert research assistant specialized in scientific literature.
Analyze the text below and produce a structured summary with exactly the following sections:

## Objective
The research question or goal of the study.

## Methods
A brief description of the methodology, data, and approach used.

## Key Findings
The main results and findings reported.

## Conclusions
The authors' conclusions and their significance.

## Limitations & Future Work
Any limitations noted and suggested directions for future research.

Write the summary in the same language as the source text.`,
  },
]

const PRESET_KEY = 'monet:mincer-preset'
const EXTRA_KEY = 'monet:mincer-extra-prompt'
const MODE_KEY = 'monet:mincer-extra-mode'
const SAVED_KEY = 'monet:mincer-saved-prompts'

export interface SummarySettings {
  presetId: MincerPresetId
  extra: string
  mode: 'append' | 'replace'
}

export function resolveSummaryPrompt(s: SummarySettings): string {
  const preset = (MINCER_PRESETS.find((p) => p.id === s.presetId) ?? MINCER_PRESETS[0]).prompt
  const extra = s.extra.trim()
  if (!extra) return preset
  if (s.mode === 'replace') return extra
  return `${preset}\n\n${extra}`
}

// Reconstrói as opções que geraram o resumo do item (painel do Regenerate).
export function summarySettingsFromItem(preset: string | null, summaryPrompt: string | null): SummarySettings {
  const found = MINCER_PRESETS.find((p) => p.id === preset) ?? MINCER_PRESETS[0]
  const prompt = summaryPrompt ?? ''
  if (!prompt || prompt === found.prompt) return { presetId: found.id, extra: '', mode: 'append' }
  if (prompt.startsWith(`${found.prompt}\n\n`)) {
    return { presetId: found.id, extra: prompt.slice(found.prompt.length + 2), mode: 'append' }
  }
  return { presetId: found.id, extra: prompt, mode: 'replace' }
}

// Rótulo do que gerou o resumo atual: "Meeting", "Meeting + instructions" ou "Custom instructions".
export function describeSummarySettings(s: SummarySettings): string {
  const label = (MINCER_PRESETS.find((p) => p.id === s.presetId) ?? MINCER_PRESETS[0]).label
  if (!s.extra.trim()) return label
  return s.mode === 'replace' ? 'Custom instructions' : `${label} + instructions`
}

export function loadSummarySettings(): SummarySettings {
  try {
    const preset = localStorage.getItem(PRESET_KEY)
    return {
      presetId: MINCER_PRESETS.some((p) => p.id === preset) ? (preset as MincerPresetId) : 'meeting',
      extra: localStorage.getItem(EXTRA_KEY) ?? '',
      mode: localStorage.getItem(MODE_KEY) === 'replace' ? 'replace' : 'append',
    }
  } catch {
    return { presetId: 'meeting', extra: '', mode: 'append' }
  }
}

export function saveSummarySettings(s: SummarySettings): void {
  try {
    localStorage.setItem(PRESET_KEY, s.presetId)
    localStorage.setItem(EXTRA_KEY, s.extra)
    localStorage.setItem(MODE_KEY, s.mode)
  } catch {
    // sem storage: as opções valem só nesta sessão
  }
}

export interface SavedPrompt {
  id: string
  name: string
  text: string
}

export function loadSavedPrompts(): SavedPrompt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSavedPrompts(list: SavedPrompt[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list))
  } catch {
    // sem storage: a lista vale só nesta sessão
  }
}
