import { useCallback, useEffect, useRef, useState } from 'react'
import type { Note, Notebook } from '../types'
import {
  NOTES_INDEX_CHANGED_EVENT,
  notesIndexDelete,
  notesIndexGetDisabledNotebooks,
  notesIndexListState,
  notesIndexRemoveNotebook,
  notesIndexSetNotebookEnabled,
  notesIndexUpsert,
} from '../lib/documents'
import { buildNoteFileText } from '../lib/noteFileText'

// Espelha as notas de cada caderno no RAG (pasta gerenciada `origin='notes'`).
// O sync vai só do app para o disco: o hook compara o array de notas com o que
// já foi enviado e enfileira os jobs numa fila serial (concorrência 1), o que
// garante que a última versão de cada nota prevaleça. Montado só na janela main.

const DEBOUNCE_MS = 10_000

type Job =
  | { kind: 'upsert'; noteId: string }
  | { kind: 'delete'; noteId: string }
  | { kind: 'removeNotebook'; notebookId: string }
  | { kind: 'setEnabled'; notebookId: string; enabled: boolean; done: () => void }

interface Params {
  notes: Note[]
  notesLoaded: boolean
  notebooks: Notebook[]
  notebooksLoaded: boolean
  // A leitura inicial de notas ou cadernos falhou: as listas vazias não são
  // confiáveis e a reconciliação não roda (senão apagaria todas as cópias).
  loadFailed: boolean
  hasApiKey: boolean
  activeNoteId: string | null
}

function notifyChanged() {
  window.dispatchEvent(new CustomEvent(NOTES_INDEX_CHANGED_EVENT))
}

export function useNotesIndexSync({
  notes,
  notesLoaded,
  notebooks,
  notebooksLoaded,
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
  const hasApiKeyRef = useRef(hasApiKey)
  hasApiKeyRef.current = hasApiKey

  const disabledRef = useRef<Set<string>>(new Set())
  const lastSyncedRef = useRef(new Map<string, { notebookId: string; fileText: string }>())
  const lastSeenNoteRef = useRef(new Map<string, Note>())
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
    (note: Note) => buildNoteFileText(note, resolveNoteTitle),
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
            queueRef.current = queueRef.current.filter((j) => j.kind !== 'upsert')
            clearTimers()
            reconciledRef.current = false
            return
          }
          lastSyncedRef.current.set(note.id, { notebookId: notebook.id, fileText })
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
    [fileTextFor, clearTimers, forgetNotebook],
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
      if (job.kind === 'upsert' || job.kind === 'delete') {
        const i = queue.findIndex(
          (j) => (j.kind === 'upsert' || j.kind === 'delete') && j.noteId === job.noteId,
        )
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
    if (reconciledRef.current || reconcilingRef.current) return
    reconcilingRef.current = true
    notesIndexListState()
      .then((state) => {
        const currentNotes = notesRef.current
        const currentNotebooks = notebooksRef.current
        const disabled = disabledRef.current
        const noteById = new Map(currentNotes.map((n) => [n.id, n]))
        const notebookIds = new Set(currentNotebooks.map((nb) => nb.id))

        for (const entry of state.notes) {
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

        lastSeenNoteRef.current = new Map(noteById)
        knownNotebooksRef.current = new Map(currentNotebooks.map((nb) => [nb.id, nb.name]))
        reconciledRef.current = true
      })
      .catch((e) => console.warn('notes index reconciliation failed', e))
      .finally(() => {
        reconcilingRef.current = false
      })
  }, [hasApiKey, notesLoaded, notebooksLoaded, disabledLoaded, loadFailed, enqueue, clearTimers])

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
    }
    for (const noteId of [...seen.keys()]) {
      if (currentIds.has(noteId)) continue
      seen.delete(noteId)
      cancelDebounce(noteId)
      enqueue({ kind: 'delete', noteId })
    }
  }, [notes, enqueue, enqueueUpsertNow, scheduleUpsert, cancelDebounce])

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
    },
    [enqueue],
  )

  return { disabledNotebookIds, setNotebookIndexEnabled }
}
