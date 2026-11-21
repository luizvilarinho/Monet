import { storage } from '../storage'
import { practiceSaveChanges, practiceSetupMessage } from './noteLog'
import { emitTasksChanged } from './tasksEvents'

// "Create 'Practice' type": cria ou completa o tipo Practice (só o que falta,
// relido do banco: a gravação é idempotente) com o Log ligado. Uma execução por
// linha, sem BEGIN/COMMIT (pool sqlx). Ordem das gravações: o tipo novo sem Log,
// depois as propriedades e por último o tipo com o Log. Assim nenhuma propriedade
// fica órfã (apontando para um tipo que não existe) e uma falha no meio deixa no
// máximo um Practice sem Log, que a próxima chamada completa (o Log só é ligado
// quando `log` ainda é null). Quem chama relê os próprios tipos; as outras janelas
// releem pelo evento. `message` diz o que foi criado ou reaproveitado.
export async function setUpPracticeType(): Promise<{ typeId: string; warnings: string[]; message: string }> {
  const [types, defs] = await Promise.all([storage.getNoteTypes(), storage.getMetadataDefs()])
  const plan = practiceSaveChanges(types, defs.filter((d) => d.scope === 'note'))
  if (plan.newType) await storage.saveNoteType({ ...plan.type, log: null })
  for (const def of plan.newDefs) await storage.saveMetadataDef(def)
  // `newType` implica `typeChanged`: o tipo novo nasce sem Log.
  if (plan.typeChanged) await storage.saveNoteType(plan.type)
  if (plan.typeChanged || plan.newDefs.length > 0) emitTasksChanged()
  return { typeId: plan.type.id, warnings: plan.warnings, message: practiceSetupMessage(plan) }
}
