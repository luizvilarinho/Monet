import { storage } from '../storage'
import type { Note } from '../types'
import type { PaperItem } from './agentItems'
import {
  paperSaveChanges,
  readingListKeys,
  readingListMatch,
  type PaperSaveIds,
  type ReadingListKeys,
} from './papers'
import { emitTasksChanged } from './tasksEvents'

// Evento de janela local: uma nota Paper foi criada (a lista de itens relê a fila).
export const READING_LIST_CHANGED_EVENT = 'monet:reading-list-changed'

// "Add to reading list": cria ou completa o tipo Paper (só o que falta, relido
// do banco: a gravação é idempotente) com o board por Status. Uma execução por
// linha, sem BEGIN/COMMIT (pool sqlx). Ordem das gravações: o tipo novo sem board,
// depois as propriedades e por último o tipo com o board (o mesmo de
// `setUpPracticeType`). Assim nenhuma propriedade fica órfã (apontando para um tipo
// que não existe) e uma falha no meio deixa no máximo um Paper sem board, que a
// próxima chamada completa (o board só é escrito quando ainda é null). Quem chama
// relê os próprios tipos; as outras janelas releem pelo evento.
export async function setUpPaperType(): Promise<{ typeId: string; ids: PaperSaveIds; warnings: string[] }> {
  const [types, defs] = await Promise.all([storage.getNoteTypes(), storage.getMetadataDefs()])
  const plan = paperSaveChanges(types, defs.filter((d) => d.scope === 'note'))
  if (plan.newType) await storage.saveNoteType({ ...plan.type, board: null })
  for (const def of [...plan.newDefs, ...plan.changedDefs]) await storage.saveMetadataDef(def)
  // `newType` implica `typeChanged`: o tipo novo nasce sem o board.
  if (plan.typeChanged) await storage.saveNoteType(plan.type)
  if (plan.newType || plan.typeChanged || plan.newDefs.length > 0 || plan.changedDefs.length > 0) emitTasksChanged()
  return { typeId: plan.type.id, ids: plan.ids, warnings: plan.warnings }
}

// O tipo Paper antes de gravar a nota (o modal do "Add to reading list" lê, sem
// gravar nada): se ele já existe (falso = a gravação vai criá-lo) e os avisos de
// conflito (propriedade de mesmo nome com outro tipo de dado), que são os mesmos
// do `setUpPaperType`. O modal os mostra no estágio de sucesso.
export async function inspectPaperType(): Promise<{ exists: boolean; warnings: string[] }> {
  const [types, defs] = await Promise.all([storage.getNoteTypes(), storage.getMetadataDefs()])
  const plan = paperSaveChanges(types, defs.filter((d) => d.scope === 'note'))
  return { exists: !plan.newType, warnings: plan.warnings }
}

// A fila de leitura (notas Paper ativas e arquivadas) por chave de dedupe, relida
// do storage.
export async function loadReadingList(): Promise<ReadingListKeys> {
  const [notes, types, defs] = await Promise.all([storage.getNotes(), storage.getNoteTypes(), storage.getMetadataDefs()])
  return readingListKeys(notes, types, defs.filter((d) => d.scope === 'note'))
}

// A nota Paper (ativa ou arquivada) que já guarda o artigo, relida do storage; null
// = fora da fila. É a conferência de quem grava (a main): com o modal aberto nas
// duas janelas, a leitura do clique de uma delas pode estar velha.
export async function findReadingListNote(paper: Pick<PaperItem, 'doi' | 'openalexId'>): Promise<Note | null> {
  const match = readingListMatch(paper, await loadReadingList())
  return match ? storage.getNote(match.noteId) : null
}
