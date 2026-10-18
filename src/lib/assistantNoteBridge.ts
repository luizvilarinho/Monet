import { emitTo, listen } from '@tauri-apps/api/event'
import type { Note, Notebook } from '../types'

// Ponte de "Save to note" entre a janela `assistant` e a main. A main é dona
// das notas abertas (estado + Editor), então é ela quem grava: assim a lista e
// a nota em edição refletem a mudança sem um autosave dela sobrescrever.

const REQUEST_EVENT = 'assistant-note-request'
const RESPONSE_EVENT = 'assistant-note-response'
const TIMEOUT_MS = 10_000
// Pedidos já atendidos pela main, por requestId (idempotência do "Try again").
const HANDLED_LIMIT = 50

export type AssistantNoteRequest =
  | { kind: 'create-notebook'; name: string }
  | { kind: 'create-note'; notebookId: string; title: string; content: string }
  | { kind: 'append'; noteId: string; block: string }

export interface AssistantNoteResult {
  note?: Note
  notebook?: Notebook
}

interface RequestPayload {
  requestId: string
  request: AssistantNoteRequest
}

interface ResponsePayload extends AssistantNoteResult {
  requestId: string
  ok: boolean
  error?: string
}

// ─── Lado da janela assistant ─────────────────────────────────────────────

// `requestId` é um por ação do usuário: o "Try again" reenvia o mesmo, e a
// main devolve o resultado anterior se já tiver gravado (resposta que chegou
// depois do timeout).
async function requestMain(request: AssistantNoteRequest, requestId: string): Promise<AssistantNoteResult> {
  let settle!: (res: ResponsePayload) => void
  const response = new Promise<ResponsePayload>((resolve) => {
    settle = resolve
  })
  const unlisten = await listen<ResponsePayload>(RESPONSE_EVENT, (e) => {
    if (e.payload?.requestId === requestId) settle(e.payload)
  })
  let timer: number | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(
        () => reject(new Error('The main window did not respond. Try again.')),
        TIMEOUT_MS
      )
    })
    const payload: RequestPayload = { requestId, request }
    await emitTo('main', REQUEST_EVENT, payload)
    const res = await Promise.race([response, timeout])
    if (!res.ok) throw new Error(res.error || 'Failed to save to note.')
    return res
  } finally {
    window.clearTimeout(timer)
    unlisten()
  }
}

export async function createNotebookViaMain(name: string, requestId: string): Promise<Notebook> {
  const { notebook } = await requestMain({ kind: 'create-notebook', name }, requestId)
  if (!notebook) throw new Error('Failed to create notebook.')
  return notebook
}

export async function createNoteViaMain(
  notebookId: string,
  title: string,
  content: string,
  requestId: string
): Promise<Note> {
  const { note } = await requestMain({ kind: 'create-note', notebookId, title, content }, requestId)
  if (!note) throw new Error('Failed to create note.')
  return note
}

export async function appendToNoteViaMain(noteId: string, block: string, requestId: string): Promise<void> {
  await requestMain({ kind: 'append', noteId, block }, requestId)
}

// ─── Lado da janela main ──────────────────────────────────────────────────

// No módulo (e não no listener), para sobreviver a um re-registro do listener.
const handled = new Map<string, Promise<AssistantNoteResult>>()

const isStr = (v: unknown): v is string => typeof v === 'string'

function isValidPayload(p: unknown): p is RequestPayload {
  if (!p || typeof p !== 'object') return false
  const { requestId, request } = p as { requestId?: unknown; request?: Record<string, unknown> }
  if (!isStr(requestId) || !request || typeof request !== 'object') return false
  switch (request.kind) {
    case 'create-notebook':
      return isStr(request.name)
    case 'create-note':
      return isStr(request.notebookId) && isStr(request.title) && isStr(request.content)
    case 'append':
      return isStr(request.noteId) && isStr(request.block)
    default:
      return false
  }
}

// Atende os pedidos da assistant com `handle` e responde com o resultado ou o
// erro. Um requestId repetido recebe o resultado do primeiro (ou espera por
// ele); um pedido que falhou pode ser refeito. Devolve o cleanup síncrono.
export function onAssistantNoteRequest(
  handle: (request: AssistantNoteRequest) => Promise<AssistantNoteResult>
): () => void {
  let cancelled = false
  let unlisten: (() => void) | undefined
  void listen<RequestPayload>(REQUEST_EVENT, (e) => {
    if (!isValidPayload(e.payload)) {
      console.warn('ignored invalid assistant note request')
      return
    }
    const { requestId, request } = e.payload
    const reply = (res: Omit<ResponsePayload, 'requestId'>) => {
      const payload: ResponsePayload = { requestId, ...res }
      void emitTo('assistant', RESPONSE_EVENT, payload)
    }
    let result = handled.get(requestId)
    if (!result) {
      result = handle(request)
      handled.set(requestId, result)
      result.catch(() => handled.delete(requestId))
      if (handled.size > HANDLED_LIMIT) handled.delete(handled.keys().next().value as string)
    }
    result.then(
      (res) => reply({ ok: true, ...res }),
      (err) => {
        console.error('assistant note request failed', err)
        reply({ ok: false, error: err instanceof Error ? err.message : String(err) })
      }
    )
  }).then((fn) => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    unlisten?.()
  }
}
