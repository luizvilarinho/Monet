import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropic(apiKey?: string): Anthropic {
  if (!client) {
    const key = apiKey ?? import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!key) throw new Error('VITE_ANTHROPIC_API_KEY is not set')
    client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })
  }
  return client
}

export const DEFAULT_MODEL = 'claude-sonnet-4-5'
