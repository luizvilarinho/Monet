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
  origin: 'user' | 'ai'
}

// PDF e EPUB dividem a MESMA tabela `books`; `format` é o discriminante que
// obriga o compilador a fazer cada consumidor dizer com qual dos dois está
// lidando (é isso que substitui a separação em tabelas).
//
// `totalPages`/`lastPage` são o ordinal de leitura nos dois formatos: número
// de página no PDF, índice de *location* no EPUB. `zoom` é a escala de
// visualização persistida, comum aos dois.
interface BookBase {
  id: string
  title: string
  author: string | null
  filePath: string
  totalPages: number
  lastPage: number
  addedAt: number
  lastOpenedAt: number | null
  zoom: number
}

export interface PdfBook extends BookBase {
  format: 'pdf'
}

export interface EpubBook extends BookBase {
  format: 'epub'
  // Posição exata de retomada. `lastPage` é só o ordinal aproximado; é o CFI
  // que devolve o leitor ao ponto certo dentro da location.
  cfi: string | null
  // Cache do `locations.save()` do epubjs — regerar as locations a cada
  // abertura custa tempo proporcional ao tamanho do livro.
  locationsJson: string | null
}

export type Book = PdfBook | EpubBook

export interface BookHighlightRect {
  x: number
  y: number
  w: number
  h: number
}

export interface BookHighlight {
  id: string
  bookId: string
  page: number
  text: string
  color: string
  rects: BookHighlightRect[]
  // Âncora real do grifo no EPUB (CFI range; `rects` vai vazio nesse formato).
  // Ausente/null no PDF, onde a âncora é `page` + `rects`.
  cfi?: string | null
  createdAt: number
}

export interface BookQuote {
  id: string
  bookId: string
  page: number
  text: string
  targetNoteId: string | null
  createdAt: number
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
  calendarOnly?: boolean
}

export interface CommandExecutionRequest {
  cmd: string
  query: string
  commandId: string
}
