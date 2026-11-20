import { nanoid } from 'nanoid'
import { storage } from '../storage'
import type { Note, Task } from '../types'
import { TASKS_SUBJECT_NAME, tasksSubjectId, uncheckChecklist } from './tasks'

// Nota-corpo de task fora da janela principal (a keep). A main tem a mesma
// lógica no App (`ensureTasksSubject`, `createTaskNote`, `copyBodyNoteRef`),
// que também atualiza o estado dela; aqui é só o banco.

// Subject "Tasks" do caderno, criado na primeira nota-corpo (id derivado do
// caderno: UPSERT idempotente).
async function ensureTasksSubject(notebookId: string): Promise<string> {
  const id = tasksSubjectId(notebookId)
  const existing = await storage.getSubjects(notebookId)
  if (existing.some((s) => s.id === id)) return id
  const now = Date.now()
  await storage.saveSubject({
    id,
    notebookId,
    name: TASKS_SUBJECT_NAME,
    sortOrder: existing.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

// Recorrente concluída: a ocorrência nova leva uma cópia da nota-corpo, com o
// checklist desmarcado. Corpo vazio não é copiado (a nota nasce ao abrir).
// Devolve a nota criada, ou null sem corpo; quem chama liga o `noteId`.
export async function copyBodyNoteForOccurrence(from: Task, occurrence: Task): Promise<Note | null> {
  if (!from.noteId) return null
  const body = await storage.getNote(from.noteId)
  if (!body?.content.trim()) return null
  const subjectId = await ensureTasksSubject(occurrence.notebookId)
  const now = Date.now()
  const note: Note = {
    id: nanoid(),
    notebookId: occurrence.notebookId,
    subjectId,
    title: occurrence.title,
    content: uncheckChecklist(body.content),
    tags: [],
    createdAt: now,
    updatedAt: now,
  }
  await storage.saveNote(note)
  return note
}
