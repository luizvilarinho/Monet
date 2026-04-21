import { useCallback, useState } from 'react'

export interface AiStreamState {
  text: string
  streaming: boolean
  error: string | null
}

export function useAi() {
  const [state, setState] = useState<AiStreamState>({
    text: '',
    streaming: false,
    error: null,
  })

  const stream = useCallback(
    async (_systemPrompt: string, _userMessage: string) => {
      setState({ text: '', streaming: true, error: null })
      throw new Error('useAi.stream not implemented')
    },
    []
  )

  return { ...state, stream }
}
