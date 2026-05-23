import { createContext, useContext } from 'react'
import type { Note } from '../../types'

export interface EditorNotesContextValue {
  notes: Note[]
  onNavigateToNote: (noteId: string) => void
}

const Ctx = createContext<EditorNotesContextValue>({
  notes: [],
  onNavigateToNote: () => {},
})

export const EditorNotesProvider = Ctx.Provider

export function useEditorNotes(): EditorNotesContextValue {
  return useContext(Ctx)
}
