import { createContext, useContext } from 'react'
import type { AiResponse } from '../../types'

export interface EditorResponsesContextValue {
  responses: AiResponse[]
}

const Ctx = createContext<EditorResponsesContextValue>({ responses: [] })

export const EditorResponsesProvider = Ctx.Provider

export function useEditorResponses(): AiResponse[] {
  return useContext(Ctx).responses
}
