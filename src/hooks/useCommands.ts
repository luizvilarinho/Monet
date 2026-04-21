import { useCallback } from 'react'
import type { CommandContext } from '../types'
import { executeCommand } from '../lib/commands'

export function useCommands() {
  const run = useCallback(
    async (ctx: CommandContext, onChunk: (text: string) => void) => {
      await executeCommand(ctx, onChunk)
    },
    []
  )

  return { run }
}
