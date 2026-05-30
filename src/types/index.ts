export interface Notebook {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface Subject {
  id: string
  notebookId: string
  name: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface Note {
  id: string
  notebookId: string | null
  subjectId?: string | null
  title: string
  content: string
  tags: string[]
  date?: string | null
  createdAt: number
  updatedAt: number
}

export type DocumentStatus = 'indexing' | 'available' | 'error'

export interface Document {
  id: string
  name: string
  originalPath?: string
  mime: string
  size: number
  status: DocumentStatus
  errorMessage?: string
  createdAt: number
  updatedAt: number
  docType: 'file' | 'folder'
  parentFolderId?: string
  lastModifiedMs?: number
  isExternal: boolean
}

export type AiResponseStatus =
  | 'streaming'
  | 'completed'
  | 'interrupted'
  | 'error'

export interface AiSource {
  documentId: string
  documentName: string
  chunkIndex: number
  snippet: string
}

export interface AiResponse {
  id: string
  noteId: string | null
  command: string
  query: string
  model: string
  response: string
  status: AiResponseStatus
  createdAt: number
  commandId?: string | null
  sources?: AiSource[]
}

export interface AiModel {
  id: string
  name: string
  description?: string
  supportsVision?: boolean
  supportsTools?: boolean
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
  commandId: string
}
