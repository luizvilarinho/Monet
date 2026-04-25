const STORAGE_KEY = 'tavilyKey'

export interface SearchResult {
  title: string
  url: string
  content: string
}

export function getTavilyKey(): string | null {
  return localStorage.getItem(STORAGE_KEY) || null
}

export function saveTavilyKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim())
}

export function clearTavilyKey(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasTavilyKey(): boolean {
  const k = getTavilyKey()
  return !!k && k.length > 0
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  const key = getTavilyKey()
  if (!key) throw new Error('Chave Tavily não configurada')

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
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Tavily ${res.status}: ${text}`)
  }

  const data = await res.json() as {
    results: Array<{ title: string; url: string; content: string }>
  }
  return (data.results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
  }))
}

export function formatSearchResults(results: SearchResult[]): string {
  if (!results.length) return ''
  const lines = results.map(
    (r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}`
  )
  return `Resultados de busca na web:\n\n${lines.join('\n\n')}`
}
