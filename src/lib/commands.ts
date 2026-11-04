import type { CommandDef } from '../types'
import { AGENTS } from './agents'

// `/tasks` é local: tratado pelo próprio editor, sem agente.
const TASKS_COMMAND: CommandDef = { name: '/tasks', description: 'Live list of tasks (this week, today, overdue, all, #project)', example: '/tasks this week #PORTO', takesQuery: false, local: true }

export const COMMANDS: CommandDef[] = [...AGENTS.map((a) => a.command), TASKS_COMMAND]

export function findCommand(name: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.name.toLowerCase() === name.toLowerCase())
}
