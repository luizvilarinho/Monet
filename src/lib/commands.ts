import type { CommandDef } from '../types'

export const COMMANDS: CommandDef[] = [
  { name: '/search', description: 'Quick search, objective answer', example: '/search Delta Sharing', takesQuery: true, usesSearch: true },
  { name: '/profile', description: 'Professional profile of a person', example: '/profile Adriana Silva, Banco Inter', takesQuery: true, usesSearch: true },
  { name: '/define', description: 'Concise technical definition', example: '/define RAG', takesQuery: true },
  { name: '/summarize', description: 'Summarizes the current note', example: '/summarize', takesQuery: false },
  { name: '/opinion', description: 'Direct opinionated answer', example: '/opinion using RAG vs fine-tuning', takesQuery: true },
  { name: '/table', description: 'Response formatted as markdown table', example: '/table REST vs GraphQL', takesQuery: true },
  { name: '/expand', description: 'Add only new and useful information not already in the note', example: '/expand', takesQuery: true },
  { name: '/explain', description: 'Explains a concept simply, using the Feynman technique', example: '/explain quantum entanglement', takesQuery: true, usesSearch: true },
  { name: '/guide', description: 'Creates a study roadmap with topics and logical sequence', example: '/guide differential calculus', takesQuery: true, usesSearch: true },
  { name: '/mindmap', description: 'Generates a hierarchical mindmap of the current note in markdown', example: '/mindmap', takesQuery: false },
  { name: '/ask', description: 'Ask a free question to the AI model', example: '/ask what is the difference between HTTP/1.1 and HTTP/2?', takesQuery: true, usesSearch: true },
  { name: '/docs', description: 'Answer using only the notebook documents', example: '/docs which companies did the person work for?', takesQuery: true },
]

export function findCommand(name: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.name.toLowerCase() === name.toLowerCase())
}
