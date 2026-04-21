export interface Note {
  id: string
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

export interface AiResponse {
  id: string
  noteId: string | null
  command: string
  query: string
  response: string
  createdAt: number
}

export interface CommandDef {
  name: string
  description: string
  example: string
  takesQuery: boolean
}

export interface CommandContext {
  cmd: string
  query: string
  noteContent: string
  ragChunks?: RagChunk[]
}
