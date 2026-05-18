import { invoke } from '@tauri-apps/api/core'

export interface SearchResult {
  title: string
  url: string
  content: string
}

export async function getTavilyKey(): Promise<string | null> {
  try {
    const k = await invoke<string | null>('get_tavily_key')
    return k && k.length > 0 ? k : null
  } catch {
    return null
  }
}

export async function saveTavilyKey(key: string): Promise<void> {
  await invoke('save_tavily_key', { key })
}

export async function clearTavilyKey(): Promise<void> {
  await invoke('clear_tavily_key')
}

export async function hasTavilyKey(): Promise<boolean> {
  try {
    return await invoke<boolean>('has_tavily_key')
  } catch {
    return false
  }
}

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.title === 'string' &&
    typeof r.url === 'string' &&
    typeof r.content === 'string'
  )
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  const key = await getTavilyKey()
  if (!key) throw new Error('Tavily key not configured')

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: 5,
      include_raw_content: false,
    }),
  })

  if (!res.ok) {
    throw new Error(`Tavily error ${res.status}`)
  }

  const data: unknown = await res.json()
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray((data as { results?: unknown }).results)
  ) {
    throw new Error('Tavily: unexpected response format')
  }

  const rawResults = (data as { results: unknown[] }).results
  return rawResults.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const r = item as Record<string, unknown>
    const normalized: SearchResult = {
      title: typeof r.title === 'string' ? r.title : '',
      url: typeof r.url === 'string' ? r.url : '',
      content: typeof r.content === 'string' ? r.content : '',
    }
    return isSearchResult(normalized) ? [normalized] : []
  })
}

export function formatSearchResults(results: SearchResult[]): string {
  if (!results.length) return ''
  const lines = results.map(
    (r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}`
  )
  return `Web search results:\n\n${lines.join('\n\n')}`
}
