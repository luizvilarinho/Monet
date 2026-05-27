import { invoke } from '@tauri-apps/api/core'
import { webSearch, type SearchResult } from './search'

const INTERMEDIATE_MODEL = 'openai/gpt-4.1-mini'
const RERANK_MODEL = 'cohere/rerank-4-fast'

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

async function generateSubQueries(
  query: string,
  results: SearchResult[]
): Promise<string[]> {
  const snippetsSummary = results
    .slice(0, 6)
    .map((r, i) => `${i + 1}. ${r.title}`)
    .join('\n')

  try {
    const subQueries = await invoke<string[]>('deep_research_generate_sub_queries', {
      query,
      snippetsSummary,
      model: INTERMEDIATE_MODEL,
    })
    return Array.isArray(subQueries) ? subQueries.slice(0, 3) : []
  } catch {
    return []
  }
}

async function rerankResults(
  query: string,
  results: SearchResult[],
  topN: number
): Promise<SearchResult[]> {
  const documents = results.map((r) => (r.rawContent ?? r.content).slice(0, 3000))

  const indices = await invoke<number[]>('deep_research_rerank', {
    query,
    documents,
    model: RERANK_MODEL,
    topN,
  })

  return indices
    .map((i) => results[i])
    .filter((r): r is SearchResult => r !== undefined)
}

export async function runDeepResearch(
  query: string,
  onPhase: (phase: DeepResearchPhase) => void
): Promise<DeepResearchResult> {
  // Stage 1: initial search
  onPhase('searching')
  const initialResults = await webSearch(query, 7, true)

  // Stage 2: generate sub-queries via haiku
  onPhase('expanding')
  const subQueries = await generateSubQueries(query, initialResults).catch(() => [] as string[])

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
  const topResults = await rerankResults(query, deduplicated, 8).catch(
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
