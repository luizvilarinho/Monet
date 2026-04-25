export interface Notebook {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface Note {
  id: string
  notebookId: string | null
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface RagChunk {
  id: string
  noteId: string | null
  sourceName: string
  content: string
  embedding: Float32Array
  chunkIndex: number
}

export type AiResponseStatus =
  | 'streaming'
  | 'completed'
  | 'interrupted'
  | 'error'

export interface AiResponse {
  id: string
  noteId: string | null
  command: string
  query: string
  model: string
  response: string
  status: AiResponseStatus
  createdAt: number
}

export interface AiModel {
  id: string
  name: string
  description?: string
}

export interface CommandDef {
  name: string
  description: string
  example: string
  takesQuery: boolean
  usesSearch?: boolean
}

export interface CommandExecutionRequest {
  cmd: string
  query: string
}

export interface CommandContext {
  cmd: string
  query: string
  noteContent: string
  ragChunks?: RagChunk[]
}
