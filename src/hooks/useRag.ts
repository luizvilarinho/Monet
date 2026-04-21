import { useCallback, useState } from 'react'
import type { RagChunk } from '../types'

export function useRag() {
  const [indexing, setIndexing] = useState(false)

  const indexFile = useCallback(async (_file: File, _noteId: string | null) => {
    setIndexing(true)
    try {
      throw new Error('useRag.indexFile not implemented')
    } finally {
      setIndexing(false)
    }
  }, [])

  const search = useCallback(async (_query: string, _topK = 4): Promise<RagChunk[]> => {
    throw new Error('useRag.search not implemented')
  }, [])

  return { indexing, indexFile, search }
}
