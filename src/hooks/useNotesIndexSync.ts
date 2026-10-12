import { useCallback, useEffect, useRef, useState } from 'react'
import type { Note, Notebook, Task } from '../types'
import {
  NOTES_INDEX_CHANGED_EVENT,
  notesIndexDelete,
  notesIndexGetDisabledNotebooks,
  notesIndexListState,
  notesIndexRemoveNotebook,
  notesIndexSetNotebookEnabled,
  notesIndexUpsert,
} from '../lib/documents'
import { buildNoteFileText, buildTasksSummaryText } from '../lib/noteFileText'
import { checklistProgress, tasksSummaryNoteId } from '../lib/tasks'

// Espelha as notas de cada caderno no RAG (pasta gerenciada `origin='notes'`).
// O sync vai só do app para o disco: o hook compara o array de notas com o que
// já foi enviado e enfileira os jobs numa fila serial (concorrência 1), o que
// garante que a última versão de cada nota prevaleça. Montado só na janela main.
// Tasks: a nota-corpo leva os metadados da task no texto, e cada caderno com
// tasks ganha um documento-resumo sintético (`note:tasks-<notebookId>`).

const DEBOUNCE_MS = 10_000

type Job =
  | { kind: 'upsert'; noteId: string }
  | { kind: 'delete'; noteId: string }
  | { kind: 'upsertTasksSummary'; notebookId: string }
  | { kind: 'removeNotebook'; notebookId: string }
  | { kind: 'setEnabled'; notebookId: string; enabled: boolean; done: () => void }

interface Params {
  notes: Note[]
  notesLoaded: boolean
  notebooks: Notebook[]
  notebooksLoaded: boolean
  tasks: Task[]
  tasksLoaded: boolean
  // A leitura de tasks falhou: a reconciliação das notas roda mesmo assim e só
  // pula os resumos de tasks (o diff de tasks cobre quando elas carregarem).
  tasksLoadFailed: boolean
  // A leitura inicial de notas ou cadernos falhou: as listas vazias não são
  // confiáveis e a reconciliação não roda (senão apagaria todas as cópias).
  loadFailed: boolean
  hasApiKey: boolean
  activeNoteId: string | null
}

function notifyChanged() {
  window.dispatchEvent(new CustomEvent(NOTES_INDEX_CHANGED_EVENT))
}

// Jobs sobre o mesmo documento se substituem na fila.
function jobDocKey(job: Job): string | null {
  if (job.kind === 'upsert' || job.kind === 'delete') return job.noteId
  if (job.kind === 'upsertTasksSummary') return tasksSummaryNoteId(job.notebookId)
  return null
}

// Tudo de uma task que entra no texto indexado (nota-corpo e resumo).
function taskSignature(task: Task, projectName: string | undefined): string {
  return JSON.stringify([
    task.title,
    task.status,
    task.notebookId,
    task.noteId,
    task.dueDate,
    task.scheduledDate,
    task.group,
    task.important,
    task.recurrence,
    task.rescheduleCount,
    task.createdAt,
    task.completedAt,
    task.sourceNoteId,
    projectName,
  ])
}

export function useNotesIndexSync({
  notes,
  notesLoaded,
  notebooks,
  notebooksLoaded,
  tasks,
  tasksLoaded,
  tasksLoadFailed,
  loadFailed,
  hasApiKey,
  activeNoteId,
}: Params) {
  const [disabledNotebookIds, setDisabledNotebookIds] = useState<Set<string>>(new Set())
  const [disabledLoaded, setDisabledLoaded] = useState(false)

  const notesRef = useRef(notes)
  notesRef.current = notes
  const notebooksRef = useRef(notebooks)
  notebooksRef.current = notebooks
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const hasApiKeyRef = useRef(hasApiKey)
  hasApiKeyRef.current = hasApiKey

  const disabledRef = useRef<Set<string>>(new Set())
  const lastSyncedRef = useRef(new Map<string, { notebookId: string; fileText: string }>())
  const lastSeenNoteRef = useRef(new Map<string, Note>())
  // taskId → { assinatura, caderno } da última versão vista.
  const lastSeenTaskRef = useRef(new Map<string, { sig: string; notebookId: string }>())
  const debounceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const knownNotebooksRef = useRef(new Map<string, string>())
  const reconciledRef = useRef(false)
  const reconcilingRef = useRef(false)
  const queueRef = useRef<Job[]>([])
  const runningRef = useRef(false)
  const prevActiveNoteIdRef = useRef<string | null>(activeNoteId)

  const resolveNoteTitle = useCallback(
    (noteId: string) => notesRef.current.find((n) => n.id === noteId)?.title,
    [],
  )

  const fileTextFor = useCallback(
    (note: Note) => {
      const task = tasksRef.current.find((t) => t.noteId === note.id)
      const projectName = task
        ? notebooksRef.current.find((nb) => nb.id === task.notebookId)?.name
        : undefined
      return buildNoteFileText(
        note,
        resolveNoteTitle,
        task ? { task, projectName: projectName ?? 'Unknown' } : undefined,
      )
    },
    [resolveNoteTitle],
  )

  const clearTimers = useCallback(() => {
    for (const t of debounceTimers.current.values()) clearTimeout(t)
    debounceTimers.current.clear()
  }, [])

  const cancelDebounce = useCallback((noteId: string) => {
    const t = debounceTimers.current.get(noteId)
    if (t === undefined) return false
    clearTimeout(t)
    debounceTimers.current.delete(noteId)
    return true
  }, [])

  const forgetNotebook = useCallback((notebookId: string) => {
    for (const [noteId, synced] of lastSyncedRef.current) {
      if (synced.notebookId === notebookId) lastSyncedRef.current.delete(noteId)
    }
  }, [])

  const runJob = useCallback(
    async (job: Job) => {
      switch (job.kind) {
        case 'upsert': {
          const note = notesRef.current.find((n) => n.id === job.noteId)
          const notebook = note?.notebookId
            ? notebooksRef.current.find((nb) => nb.id === note.notebookId)
            : undefined
          if (!note || !notebook) {
            await notesIndexDelete(job.noteId)
            lastSyncedRef.current.delete(job.noteId)
            return
          }
          const fileText = fileTextFor(note)
          const result = await notesIndexUpsert({
            notebookId: notebook.id,
            notebookName: notebook.name,
            noteId: note.id,
            title: note.title,
            fileText,
          })
          if (result === 'no_key') {
            // Sem chave nada indexa: descarta os upserts pendentes e deixa a
            // reconciliação rodar de novo quando a chave existir.
            queueRef.current = queueRef.current.filter(
              (j) => j.kind !== 'upsert' && j.kind !== 'upsertTasksSummary',
            )
            clearTimers()
            reconciledRef.current = false
            return
          }
          lastSyncedRef.current.set(note.id, { notebookId: notebook.id, fileText })
          return
        }
        case 'upsertTasksSummary': {
          const summaryId = tasksSummaryNoteId(job.notebookId)
          const notebook = notebooksRef.current.find((nb) => nb.id === job.notebookId)
          const nbTasks = tasksRef.current.filter((t) => t.notebookId === job.notebookId)
          if (!notebook || nbTasks.length === 0) {
            await notesIndexDelete(summaryId)
            lastSyncedRef.current.delete(summaryId)
            return
          }
          const fileText = buildTasksSummaryText(notebook.name, nbTasks, resolveNoteTitle, (t) => {
            const body = t.noteId ? notesRef.current.find((n) => n.id === t.noteId) : undefined
            return body ? checklistProgress(body.content) : null
          })
          const synced = lastSyncedRef.current.get(summaryId)
          if (synced && synced.notebookId === notebook.id && synced.fileText === fileText) return
          const result = await notesIndexUpsert({
            notebookId: notebook.id,
            notebookName: notebook.name,
            noteId: summaryId,
            title: `Tasks — ${notebook.name}`,
            fileText,
          })
          if (result === 'no_key') {
            queueRef.current = queueRef.current.filter(
              (j) => j.kind !== 'upsert' && j.kind !== 'upsertTasksSummary',
            )
            clearTimers()
            reconciledRef.current = false
            return
          }
          lastSyncedRef.current.set(summaryId, { notebookId: notebook.id, fileText })
          return
        }
        case 'delete':
          await notesIndexDelete(job.noteId)
          lastSyncedRef.current.delete(job.noteId)
          return
        case 'removeNotebook':
          await notesIndexRemoveNotebook(job.notebookId)
          forgetNotebook(job.notebookId)
          notifyChanged()
          return
        case 'setEnabled': {
          await notesIndexSetNotebookEnabled(job.notebookId, job.enabled)
          const next = new Set(disabledRef.current)
          if (job.enabled) next.delete(job.notebookId)
          else next.add(job.notebookId)
          disabledRef.current = next
          setDisabledNotebookIds(next)
          if (!job.enabled) forgetNotebook(job.notebookId)
          notifyChanged()
          return
        }
      }
    },
    [fileTextFor, resolveNoteTitle, clearTimers, forgetNotebook],
  )

  const drain = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      while (queueRef.current.length > 0) {
        const job = queueRef.current.shift()!
        try {
          await runJob(job)
        } catch (e) {
          // Falhas (ex.: embedding) não são exibidas ao usuário: a nota é
          // reenviada na próxima edição ou na reconciliação.
          console.warn('notes index job failed', job.kind, e)
        } finally {
          if (job.kind === 'setEnabled') job.done()
        }
      }
    } finally {
      runningRef.current = false
    }
  }, [runJob])

  const enqueue = useCallback(
    (job: Job) => {
      const queue = queueRef.current
      const key = jobDocKey(job)
      if (key !== null) {
        const i = queue.findIndex((j) => jobDocKey(j) === key)
        if (i >= 0) {
          queue[i] = job
          return
        }
      }
      // O toggle fura a fila para responder logo mesmo durante a carga
      // inicial; upserts já enfileirados daquele caderno viram "disabled".
      if (job.kind === 'setEnabled') queue.unshift(job)
      else queue.push(job)
      void drain()
    },
    [drain],
  )

  const enqueueUpsertNow = useCallback(
    (noteId: string) => {
      cancelDebounce(noteId)
      enqueue({ kind: 'upsert', noteId })
    },
    [cancelDebounce, enqueue],
  )

  const scheduleUpsert = useCallback(
    (noteId: string) => {
      cancelDebounce(noteId)
      debounceTimers.current.set(
        noteId,
        setTimeout(() => {
          debounceTimers.current.delete(noteId)
          // A comparação de conteúdo fica aqui (uma vez por debounce) e não no
          // diff por tecla: buildNoteFileText é caro em notas grandes.
          const note = notesRef.current.find((n) => n.id === noteId)
          const synced = lastSyncedRef.current.get(noteId)
          if (
            note &&
            synced &&
            synced.notebookId === note.notebookId &&
            synced.fileText === fileTextFor(note)
          ) {
            return
          }
          enqueue({ kind: 'upsert', noteId })
        }, DEBOUNCE_MS),
      )
    },
    [cancelDebounce, enqueue, fileTextFor],
  )

  // O resumo compara o texto no próprio job (barato), então o debounce só
  // agrupa rajadas de mudanças de tasks.
  const scheduleTasksSummary = useCallback(
    (notebookId: string) => {
      const key = tasksSummaryNoteId(notebookId)
      cancelDebounce(key)
      debounceTimers.current.set(
        key,
        setTimeout(() => {
          debounceTimers.current.delete(key)
          enqueue({ kind: 'upsertTasksSummary', notebookId })
        }, DEBOUNCE_MS),
      )
    },
    [cancelDebounce, enqueue],
  )

  // Toggle durável por caderno (tabela notebook_notes_index_disabled).
  useEffect(() => {
    let cancelled = false
    notesIndexGetDisabledNotebooks()
      .then((ids) => {
        if (cancelled) return
        disabledRef.current = new Set(ids)
        setDisabledNotebookIds(new Set(ids))
      })
      .catch((e) => console.warn('failed to load notes index toggles', e))
      .finally(() => {
        if (!cancelled) setDisabledLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Reconciliação: carga inicial, notas editadas com o app fechado ou pela
  // janela keep, e documentos deixados em error/indexing. Só roda depois de
  // `notesLoaded` — antes disso `notes=[]` e tudo pareceria apagado.
  useEffect(() => {
    if (!hasApiKey) {
      reconciledRef.current = false
      clearTimers()
      return
    }
    if (!notesLoaded || !notebooksLoaded || !disabledLoaded || loadFailed) return
    if (!tasksLoaded && !tasksLoadFailed) return
    if (reconciledRef.current || reconcilingRef.current) return
    reconcilingRef.current = true
    notesIndexListState()
      .then((state) => {
        const currentNotes = notesRef.current
        const currentNotebooks = notebooksRef.current
        const disabled = disabledRef.current
        const noteById = new Map(currentNotes.map((n) => [n.id, n]))
        const notebookIds = new Set(currentNotebooks.map((nb) => nb.id))
        const currentTasks = tasksRef.current
        const taskNotebookIds = new Set(currentTasks.map((t) => t.notebookId))

        for (const entry of state.notes) {
          // O resumo de tasks não corresponde a uma nota: fica enquanto o
          // caderno tiver tasks (é regravado abaixo).
          if (entry.noteId === tasksSummaryNoteId(entry.notebookId)) {
            if (tasksLoaded && !taskNotebookIds.has(entry.notebookId)) {
              enqueue({ kind: 'delete', noteId: entry.noteId })
            }
            continue
          }
          const note = noteById.get(entry.noteId)
          if (!note || !note.notebookId) enqueue({ kind: 'delete', noteId: entry.noteId })
        }
        for (const nbId of state.notebookIds) {
          if (!notebookIds.has(nbId) || disabled.has(nbId)) {
            enqueue({ kind: 'removeNotebook', notebookId: nbId })
          }
        }
        for (const note of currentNotes) {
          if (note.notebookId && !disabled.has(note.notebookId)) {
            enqueue({ kind: 'upsert', noteId: note.id })
          }
        }
        for (const nbId of taskNotebookIds) {
          if (notebookIds.has(nbId) && !disabled.has(nbId)) {
            enqueue({ kind: 'upsertTasksSummary', notebookId: nbId })
          }
        }

        const nameById = new Map(currentNotebooks.map((nb) => [nb.id, nb.name]))
        lastSeenTaskRef.current = new Map(
          currentTasks.map((t) => [
            t.id,
            { sig: taskSignature(t, nameById.get(t.notebookId)), notebookId: t.notebookId },
          ]),
        )
        lastSeenNoteRef.current = new Map(noteById)
        knownNotebooksRef.current = new Map(currentNotebooks.map((nb) => [nb.id, nb.name]))
        reconciledRef.current = true
      })
      .catch((e) => console.warn('notes index reconciliation failed', e))
      .finally(() => {
        reconcilingRef.current = false
      })
  }, [
    hasApiKey,
    notesLoaded,
    notebooksLoaded,
    tasksLoaded,
    tasksLoadFailed,
    disabledLoaded,
    loadFailed,
    enqueue,
    clearTimers,
  ])

  // Diff incremental das notas.
  useEffect(() => {
    if (!reconciledRef.current) return
    const seen = lastSeenNoteRef.current
    const disabled = disabledRef.current
    const currentIds = new Set<string>()
    for (const note of notes) {
      currentIds.add(note.id)
      if (seen.get(note.id) === note) continue
      seen.set(note.id, note)
      if (!note.notebookId) continue
      const synced = lastSyncedRef.current.get(note.id)
      if (synced && synced.notebookId !== note.notebookId) {
        // Move entre cadernos: imediato (o backend move o arquivo sem reembed).
        enqueueUpsertNow(note.id)
        continue
      }
      if (disabled.has(note.notebookId)) continue
      scheduleUpsert(note.id)
      // Nota-corpo: o checklist dela aparece no resumo de tasks do caderno.
      const task = tasksRef.current.find((t) => t.noteId === note.id)
      if (task && !disabled.has(task.notebookId)) scheduleTasksSummary(task.notebookId)
    }
    for (const noteId of [...seen.keys()]) {
      if (currentIds.has(noteId)) continue
      seen.delete(noteId)
      cancelDebounce(noteId)
      enqueue({ kind: 'delete', noteId })
    }
  }, [notes, enqueue, enqueueUpsertNow, scheduleUpsert, scheduleTasksSummary, cancelDebounce])

  // Diff de tasks (inclui renomear o caderno-projeto): reindexa a nota-corpo
  // e o resumo dos cadernos afetados (origem e destino num move).
  useEffect(() => {
    if (!reconciledRef.current) return
    const seen = lastSeenTaskRef.current
    const disabled = disabledRef.current
    const nameById = new Map(notebooks.map((nb) => [nb.id, nb.name]))
    const affected = new Set<string>()
    const currentIds = new Set<string>()
    for (const task of tasks) {
      currentIds.add(task.id)
      const sig = taskSignature(task, nameById.get(task.notebookId))
      const prev = seen.get(task.id)
      if (prev?.sig === sig) continue
      seen.set(task.id, { sig, notebookId: task.notebookId })
      affected.add(task.notebookId)
      if (prev) affected.add(prev.notebookId)
      if (task.noteId && !disabled.has(task.notebookId)) scheduleUpsert(task.noteId)
    }
    for (const [taskId, prev] of [...seen]) {
      if (currentIds.has(taskId)) continue
      seen.delete(taskId)
      affected.add(prev.notebookId)
    }
    for (const nbId of affected) {
      if (!disabled.has(nbId)) scheduleTasksSummary(nbId)
    }
  }, [tasks, notebooks, scheduleUpsert, scheduleTasksSummary])

  // Diff de cadernos: apagado → remove a pasta; renomeado → um upsert
  // atualiza o nome da pasta ("Notes — <Caderno>").
  useEffect(() => {
    if (!reconciledRef.current) return
    const known = knownNotebooksRef.current
    const currentIds = new Set(notebooks.map((nb) => nb.id))
    for (const nbId of [...known.keys()]) {
      if (currentIds.has(nbId)) continue
      known.delete(nbId)
      enqueue({ kind: 'removeNotebook', notebookId: nbId })
    }
    for (const nb of notebooks) {
      const prevName = known.get(nb.id)
      known.set(nb.id, nb.name)
      if (prevName === undefined || prevName === nb.name) continue
      if (disabledRef.current.has(nb.id)) continue
      for (const [noteId, synced] of lastSyncedRef.current) {
        // O resumo de tasks já é regravado pelo diff de tasks.
        if (noteId === tasksSummaryNoteId(nb.id)) continue
        if (synced.notebookId === nb.id && synced.fileText) {
          enqueue({ kind: 'upsert', noteId })
          break
        }
      }
    }
  }, [notebooks, enqueue])

  // Ao trocar de nota, envia já a anterior se havia debounce pendente.
  useEffect(() => {
    const prev = prevActiveNoteIdRef.current
    prevActiveNoteIdRef.current = activeNoteId
    if (prev && prev !== activeNoteId && cancelDebounce(prev)) {
      enqueue({ kind: 'upsert', noteId: prev })
    }
  }, [activeNoteId, cancelDebounce, enqueue])

  useEffect(() => clearTimers, [clearTimers])

  const setNotebookIndexEnabled = useCallback(
    async (notebookId: string, enabled: boolean) => {
      await new Promise<void>((resolve) => {
        enqueue({ kind: 'setEnabled', notebookId, enabled, done: resolve })
      })
      if (!enabled || !hasApiKeyRef.current) return
      // Carga inicial do caderno religado.
      for (const note of notesRef.current) {
        if (note.notebookId === notebookId) enqueue({ kind: 'upsert', noteId: note.id })
      }
      if (tasksRef.current.some((t) => t.notebookId === notebookId)) {
        enqueue({ kind: 'upsertTasksSummary', notebookId })
      }
    },
    [enqueue],
  )

  return { disabledNotebookIds, setNotebookIndexEnabled }
}
