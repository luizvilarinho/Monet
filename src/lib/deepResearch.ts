import { invoke } from '@tauri-apps/api/core'
import { webSearch, type SearchResult } from './search'

const INTERMEDIATE_MODEL = 'openai/gpt-5.4-mini'
const RERANK_MODEL = 'cohere/rerank-4-fast'
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export type DeepResearchPhase =
  | 'searching'
  | 'expanding'
  | 'broadening'
  | 'ranking'
  | 'synthesizing'

export interface DeepResearchResult {
  formattedContext: string
  sources: Array<{ title: string; url: string }>
  subQueries: string[]
}

async function getOpenRouterKey(): Promise<string | null> {
  try {
    return await invoke<string | null>('get_openrouter_key')
  } catch {
    return null
  }
}

async function generateSubQueries(
  query: string,
  results: SearchResult[],
  apiKey: string
): Promise<string[]> {
  const snippetsSummary = results
    .slice(0, 6)
    .map((r, i) => `${i + 1}. ${r.title}`)
    .join('\n')

  const prompt = `You are a research query strategist. Given a user question and initial search results, generate 3 search queries that deliberately explore DIFFERENT angles not yet covered.

User question: ${query}

Initial results already cover:
${snippetsSummary}

Analyze what dimensions are missing from the initial results (e.g. pricing, benchmarks, real-world usage, criticism, historical context, technical details, comparisons, case studies) and generate 3 queries that fill the most important gaps for this specific question.

Return ONLY a JSON array of 3 strings, nothing else.`

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: INTERMEDIATE_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    }),
  })

  if (!res.ok) return []

  const data: unknown = await res.json()
  const content =
    (data as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content ?? ''

  try {
    const parsed: unknown = JSON.parse(content.trim())
    if (Array.isArray(parsed)) {
      return (parsed as unknown[])
        .filter((q): q is string => typeof q === 'string')
        .slice(0, 3)
    }
  } catch {
    const match = content.match(/\[[\s\S]*?\]/)
    if (match) {
      try {
        const parsed: unknown = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          return (parsed as unknown[])
            .filter((q): q is string => typeof q === 'string')
            .slice(0, 3)
        }
      } catch { /* fall through */ }
    }
  }

  return []
}

async function rerankResults(
  query: string,
  results: SearchResult[],
  apiKey: string,
  topN: number
): Promise<SearchResult[]> {
  const res = await fetch(`${OPENROUTER_BASE}/rerank`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents: results.map((r) => (r.rawContent ?? r.content).slice(0, 3000)),
      top_n: topN,
    }),
  })

  if (!res.ok) return results.slice(0, topN)

  const data: unknown = await res.json()
  const ranked = (data as { results?: Array<{ index: number; relevance_score: number }> })?.results ?? []

  return ranked
    .map((r) => results[r.index])
    .filter((r): r is SearchResult => r !== undefined)
}

export async function runDeepResearch(
  query: string,
  onPhase: (phase: DeepResearchPhase) => void
): Promise<DeepResearchResult> {
  const apiKey = await getOpenRouterKey()
  if (!apiKey) throw new Error('OpenRouter key not configured')

  // Stage 1: initial search
  onPhase('searching')
  const initialResults = await webSearch(query, 7, true)

  // Stage 2: generate sub-queries via haiku
  onPhase('expanding')
  const subQueries = await generateSubQueries(query, initialResults, apiKey).catch(() => [] as string[])

  // Stage 3: parallel searches
  onPhase('broadening')
  let allResults = [...initialResults]
  if (subQueries.length > 0) {
    const parallel = await Promise.all(
      subQueries.map((q) => webSearch(q, 6, true).catch(() => [] as SearchResult[]))
    )
    allResults = [...allResults, ...parallel.flat()]
  }

  // Stage 4: deduplicate by URL
  const seen = new Set<string>()
  const deduplicated = allResults.filter((r) => {
    if (!r.content || !r.url) return false
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  // Stage 5: rerank
  onPhase('ranking')
  const topResults = await rerankResults(query, deduplicated, apiKey, 8).catch(
    () => deduplicated.slice(0, 8)
  )

  const formattedContext = topResults
    .map((r, i) => {
      const body = (r.rawContent ?? r.content).slice(0, 5000)
      return `${i + 1}. **${r.title}**\n   ${r.url}\n   ${body}`
    })
    .join('\n\n')

  const sources = topResults.map((r) => ({ title: r.title, url: r.url }))

  return { formattedContext, sources, subQueries }
}
