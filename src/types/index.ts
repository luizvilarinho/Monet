export interface Notebook {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  // Cor do projeto nas visões de Tasks (token da paleta); null = neutro.
  color?: string | null
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
  // Tipo de nota (`note_types`); null/ausente = sem tipo. Tipo, propriedades e
  // arquivamento são gravados só pelos setters (setNoteType/setNoteProperties/
  // setNoteArchived), nunca pelo saveNote.
  typeId?: string | null
  // Valores das propriedades: chave = id da MetadataDef (scope 'note'). Chaves
  // de defs de outro tipo ficam guardadas (voltam se o tipo voltar).
  properties?: Record<string, MetadataValue>
  // Arquivada em (ms); null/ausente = ativa. Gravado só pelo setter
  // `setNoteArchived`, nunca pelo saveNote.
  archivedAt?: number | null
}

// Nota sem o conteúdo (listas e títulos de notas linkadas).
export type NoteSummary = Pick<
  Note,
  'id' | 'notebookId' | 'title' | 'date' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

// Id de um status do registro `task_statuses`: built-ins (todo/doing/done/
// dropped) ou custom (`st_<id>`).
export type TaskStatus = string

export interface TaskStatusDef {
  id: string
  name: string
  color: string | null
  sortOrder: number
  wipLimit: number | null
  builtin: boolean
}

// Visão salva: base + filtros da TasksView.
export interface TaskViewConfig {
  base: string
  project: string | null
  summary: string | null
  text: string
  groupBy: string | null
}

export interface TaskView {
  id: string
  name: string
  config: TaskViewConfig
  sortOrder: number
}

export type TaskRecurrence =
  | { freq: 'daily' }
  | { freq: 'weekly'; days: number[] } // 0 = domingo … 6 = sábado, ordenado, ≥ 1 dia
  | { freq: 'monthly'; day?: number } // mesmo dia do mês da data-âncora; `day` guarda o dia original (31 → 28 → 31)

// `dueDate` é chave de dia local `YYYY-MM-DD`; os timestamps são epoch ms.
export interface Task {
  id: string
  title: string
  status: TaskStatus
  // Projeto = caderno. `noteId` é a nota-corpo da task (no subject "Tasks"
  // desse caderno).
  notebookId: string
  noteId: string | null
  // `dueDate` = deadline (entrega); `scheduledDate` = quando vou fazer.
  dueDate: string | null
  scheduledDate: string | null
  // Nota TODOS (entregável) à qual a task pertence; null = sem TODOS. A
  // origem (`sourceNoteId`) é outra coisa: governa o sync de título (D6).
  parentNoteId: string | null
  // Prioridade leve: ordena primeiro dentro do grupo.
  important: boolean
  recurrence: TaskRecurrence | null
  // Ocorrência já gerada ao concluir esta task (evita gerar outra).
  recurrenceNextId: string | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
  sourceNoteId: string | null
  rescheduleCount: number
  sortOrder: number
  // Quando entrou em `doing` (epoch ms); null fora de doing ou sem registro.
  doingSince: number | null
  // Dia (YYYY-MM-DD) em que a task foi planejada em "Plan today".
  plannedDay: string | null
  // Metadados personalizados: chave = id da MetadataDef; ausente = não anexado.
  metadata: Record<string, MetadataValue>
}

export type MetadataType = 'text' | 'number' | 'date' | 'checkbox' | 'select'

// Text: string; Number: number; Date: YYYY-MM-DD; Checkbox: boolean;
// Select: id da opção. null = propriedade anexada e sem valor.
export type MetadataValue = string | number | boolean | null

export interface SelectOption {
  id: string
  name: string
  color: string | null
}

// Definição de metadado. `scope` separa os metadados custom de task das
// propriedades de tipo de nota (D2); cada picker lista só o seu escopo.
export interface MetadataDef {
  id: string
  name: string
  type: MetadataType
  sortOrder: number
  createdAt: number
  scope: 'task' | 'note'
  // Tipo de nota dono da propriedade (só scope 'note').
  noteTypeId: string | null
  // Opções do select (null nos demais tipos).
  options: SelectOption[] | null
  // Mostrar o valor na lista de notas (máx. MAX_LIST_PROPERTIES por tipo).
  showInList: boolean
}

// Tipo de nota global e opcional. `builtin` não é renomeado nem excluído.
export interface NoteType {
  id: string
  name: string
  // Nome de ícone do conjunto fixo (TypeIcon); null = ícone padrão.
  icon: string | null
  color: string | null
  // Markdown aplicado em nota vazia ou em "New <tipo>".
  template: string | null
  sortOrder: number
  builtin: boolean
  createdAt: number
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
  origin: 'user' | 'ai' | 'notes'
  // Apelido de exibição de pasta indexada (folder_aliases); ausente = `name`.
  alias?: string
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
  // Tratado pelo próprio editor (não chama a IA).
  local?: boolean
}

export interface CommandExecutionRequest {
  cmd: string
  query: string
  commandId: string
}
