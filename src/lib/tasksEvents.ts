import { emit, listen } from '@tauri-apps/api/event'
import { nanoid } from 'nanoid'

export const TASKS_CHANGED_EVENT = 'tasks-changed'
export const TRACKERS_CHANGED_EVENT = 'trackers-changed'

// Origem desta janela nos eventos `tasks-changed` e `trackers-changed`: todos os
// hooks (tasks, statuses, views, cor de projeto, trackers) compartilham o mesmo
// id, então uma janela só recarrega por mudanças feitas em OUTRAS janelas.
export const TASKS_ORIGIN = nanoid()

export function emitTasksChanged(): void {
  void emit(TASKS_CHANGED_EVENT, { origin: TASKS_ORIGIN })
}

export function emitTrackersChanged(): void {
  void emit(TRACKERS_CHANGED_EVENT, { origin: TASKS_ORIGIN })
}

// Registra `onForeign` para mudanças de `eventName` vindas de outras janelas;
// devolve o cleanup síncrono.
function onChangedElsewhere(eventName: string, onForeign: () => void): () => void {
  let cancelled = false
  let unlisten: (() => void) | undefined
  void listen<{ origin: string }>(eventName, (e) => {
    if (e.payload?.origin !== TASKS_ORIGIN) onForeign()
  }).then((fn) => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    unlisten?.()
  }
}

export function onTasksChangedElsewhere(onForeign: () => void): () => void {
  return onChangedElsewhere(TASKS_CHANGED_EVENT, onForeign)
}

// Leitura inicial dos registros (tasks, status, metadados, visões, tipos): no
// cold start as DDLs do ensure* disputam o lock do monet.db e a 1ª leitura pode
// falhar. `load` devolve false em falha; novas tentativas em 1, 2, 4 e 8 s.
// Devolve o cleanup síncrono.
const LOAD_RETRIES = 4

export function loadWithRetry(load: () => Promise<boolean>): () => void {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = (attempt: number) => {
    void load().then((ok) => {
      if (!ok && !cancelled && attempt < LOAD_RETRIES) {
        timer = setTimeout(() => run(attempt + 1), 1000 * 2 ** attempt)
      }
    })
  }
  run(0)
  return () => {
    cancelled = true
    clearTimeout(timer)
  }
}

// `loadWithRetry` na montagem e de novo a cada `eventName` vindo de outra
// janela: um reload que falha depois do 1º sucesso também ganha novas
// tentativas. Devolve o cleanup síncrono.
export function loadAndSyncWithRetry(
  load: () => Promise<boolean>,
  eventName: string = TASKS_CHANGED_EVENT
): () => void {
  let cancelLoad = loadWithRetry(load)
  const off = onChangedElsewhere(eventName, () => {
    cancelLoad()
    cancelLoad = loadWithRetry(load)
  })
  return () => {
    cancelLoad()
    off()
  }
}
