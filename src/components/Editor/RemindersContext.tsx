import { createContext, useContext } from 'react'

export interface RemindersContextValue {
  firedIds: Set<string>
}

const EMPTY: RemindersContextValue = { firedIds: new Set<string>() }

const Ctx = createContext<RemindersContextValue>(EMPTY)

export const RemindersProvider = Ctx.Provider

export function useReminderState(): RemindersContextValue {
  return useContext(Ctx)
}
