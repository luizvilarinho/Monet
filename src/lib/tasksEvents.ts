import { emit, listen } from '@tauri-apps/api/event'
import { nanoid } from 'nanoid'

// Origem desta janela no evento `tasks-changed`: todos os hooks de tasks
// (tasks, statuses, views, cor de projeto) compartilham o mesmo id, então uma
// janela só recarrega por mudanças feitas em OUTRAS janelas.
export const TASKS_ORIGIN = nanoid()

export function emitTasksChanged(): void {
  void emit('tasks-changed', { origin: TASKS_ORIGIN })
}

// Registra `onForeign` para mudanças vindas de outras janelas; devolve o
// cleanup síncrono.
export function onTasksChangedElsewhere(onForeign: () => void): () => void {
  let cancelled = false
  let unlisten: (() => void) | undefined
  void listen<{ origin: string }>('tasks-changed', (e) => {
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
