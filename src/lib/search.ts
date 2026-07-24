import { invoke } from '@tauri-apps/api/core'

export interface SearchResult {
  title: string
  url: string
  content: string
  rawContent?: string
  imageUrl?: string
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

export async function webSearch(query: string, maxResults = 5, includeRawContent = false): Promise<SearchResult[]> {
  const key = await getTavilyKey()
  if (!key) throw new Error('Tavily key not configured')

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      include_raw_content: includeRawContent,
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
      rawContent: typeof r.raw_content === 'string' && r.raw_content ? r.raw_content : undefined,
      imageUrl: typeof r.image === 'string' && r.image ? r.image : undefined,
    }
    return isSearchResult(normalized) ? [normalized] : []
  })
}

export async function tavilyExtract(url: string): Promise<{ url: string; rawContent: string } | null> {
  const key = await getTavilyKey()
  if (!key) throw new Error('Tavily key not configured')

  const res = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      urls: [url],
      format: 'markdown',
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

  const results = (data as { results: unknown[] }).results
  const first = results[0]
  if (!first || typeof first !== 'object') return null
  const r = first as Record<string, unknown>
  const rawContent = typeof r.raw_content === 'string' ? r.raw_content : ''
  if (!rawContent) return null
  return {
    url: typeof r.url === 'string' ? r.url : url,
    rawContent,
  }
}

export async function hashUrlToFilename(url: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex}.md`
}

export function formatSearchResults(results: SearchResult[]): string {
  if (!results.length) return ''
  const lines = results.map((r, i) => {
    const image = r.imageUrl ? `\n   Image: ${r.imageUrl}` : ''
    return `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}${image}`
  })
  return `Web search results:\n\n${lines.join('\n\n')}`
}
