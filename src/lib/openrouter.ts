import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { AiModel } from '../types'

export const OPENROUTER_KEY_MISSING = 'OPENROUTER_KEY_MISSING'

export interface StreamChunkPayload {
  requestId: string
  text: string
}

export interface StreamReasoningPayload {
  requestId: string
  text: string
}

export interface StreamDonePayload {
  requestId: string
  model?: string
  completionTokens?: number
  durationSecs?: number
}

export interface StreamErrorPayload {
  requestId: string
  code: string
  message: string
}

export interface StartStreamInput {
  requestId: string
  model: string
  systemPrompt: string
  userMessage: string
}

export interface TextContentBlock {
  type: 'text'
  text: string
}

export interface ImageContentBlock {
  type: 'image_url'
  image_url: { url: string }
}

export type ContentBlock = TextContentBlock | ImageContentBlock

export interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ToolCallItem {
  toolName: string
  argumentsJson: string
}

export interface StreamToolCallPayload {
  requestId: string
  toolCalls: ToolCallItem[]
}

export interface StreamToolCallStartedPayload {
  requestId: string
  // Nome da 1ª tool, quando já veio no 1º delta (senão vazio).
  toolName: string
}

export interface StartStreamMessagesInput {
  requestId: string
  model: string
  messages: ChatMessageInput[]
  thinking?: boolean
  tools?: object[]
}

export async function hasOpenRouterKey(): Promise<boolean> {
  try {
    return await invoke<boolean>('has_openrouter_key')
  } catch {
    return false
  }
}

export async function saveOpenRouterKey(key: string): Promise<void> {
  await invoke('save_openrouter_key', { key })
}

export async function clearOpenRouterKey(): Promise<void> {
  await invoke('clear_openrouter_key')
}

export async function listOpenRouterModels(): Promise<AiModel[]> {
  return await invoke<AiModel[]>('openrouter_list_models')
}

export async function startOpenRouterStream(input: StartStreamInput): Promise<void> {
  await invoke('openrouter_stream_chat', { ...input })
}

export async function startOpenRouterStreamMessages(
  input: StartStreamMessagesInput,
): Promise<void> {
  await invoke('openrouter_stream_messages', { ...input })
}

export async function cancelOpenRouterStream(requestId: string): Promise<void> {
  await invoke('openrouter_cancel', { requestId })
}

export function onOpenRouterChunk(
  handler: (p: StreamChunkPayload) => void
): Promise<UnlistenFn> {
  return listen<StreamChunkPayload>('openrouter://chunk', (e) => handler(e.payload))
}

export function onOpenRouterReasoning(
  handler: (p: StreamReasoningPayload) => void
): Promise<UnlistenFn> {
  return listen<StreamReasoningPayload>('openrouter://reasoning', (e) => handler(e.payload))
}

export function onOpenRouterDone(
  handler: (p: StreamDonePayload) => void
): Promise<UnlistenFn> {
  return listen<StreamDonePayload>('openrouter://done', (e) => handler(e.payload))
}

export function onOpenRouterError(
  handler: (p: StreamErrorPayload) => void
): Promise<UnlistenFn> {
  return listen<StreamErrorPayload>('openrouter://error', (e) => handler(e.payload))
}

export function onOpenRouterToolCall(
  handler: (p: StreamToolCallPayload) => void
): Promise<UnlistenFn> {
  return listen<StreamToolCallPayload>('openrouter://tool_call', (e) => handler(e.payload))
}

// Primeiro sinal de tool call na rodada: o backend para de emitir o conteúdo
// dela (a resposta final vem na rodada seguinte).
export function onOpenRouterToolCallStarted(
  handler: (p: StreamToolCallStartedPayload) => void
): Promise<UnlistenFn> {
  return listen<StreamToolCallStartedPayload>('openrouter://tool_call_started', (e) => handler(e.payload))
}

// Mensagem legível para os erros do chat, no padrão do Mincer. O Rust devolve
// um código (INVALID_MODEL, HTTP_ERROR, …) e uma mensagem técnica; o status
// HTTP vem dentro dela ("OpenRouter responded 402 Payment Required"). Quando o
// invoke rejeita, só a string do código chega, por isso o código também é
// aceito como mensagem. `settings` indica que a correção está no Settings.
export interface ReadableChatError {
  message: string
  settings: boolean
}

const KNOWN_CODES = new Set([
  OPENROUTER_KEY_MISSING,
  'INVALID_MODEL',
  'HTTP_ERROR',
  'NETWORK_ERROR',
  'STREAM_TIMEOUT',
  'STREAM_ERROR',
  'OPENROUTER_ERROR',
  'TOOL_CALL_INCOMPLETE',
])

// Status só no formato de status ("OpenRouter responded 429", "status 429",
// "HTTP 429"): um número solto ("max 500 tokens") não é erro HTTP.
function httpStatusOf(message: string): number | null {
  const m =
    /OpenRouter responded (\d{3})/.exec(message) ?? /\b(?:HTTP|status)[\s:]+([45]\d\d)\b/i.exec(message)
  return m ? Number(m[1]) : null
}

export function readableChatError(code: string | undefined, message: string): ReadableChatError {
  const raw = (message ?? '').trim()
  const effectiveCode = code ?? (KNOWN_CODES.has(raw) ? raw : undefined)

  if (effectiveCode === OPENROUTER_KEY_MISSING) {
    return { message: 'Add your OpenRouter key in Settings to chat with the AI.', settings: true }
  }
  if (effectiveCode === 'INVALID_MODEL') {
    return { message: 'This model is not valid. Choose another model and try again.', settings: false }
  }
  if (effectiveCode === 'NETWORK_ERROR') {
    return { message: 'Could not reach OpenRouter. Check your connection and try again.', settings: false }
  }
  if (effectiveCode === 'STREAM_TIMEOUT') {
    return { message: 'The model stopped responding. Try again.', settings: false }
  }
  if (effectiveCode === 'STREAM_ERROR') {
    return { message: 'The connection to OpenRouter was interrupted. Try again.', settings: false }
  }

  const status = effectiveCode === 'HTTP_ERROR' || effectiveCode === undefined ? httpStatusOf(raw) : null
  if (status !== null) {
    if (status === 401) {
      return { message: 'OpenRouter rejected your API key. Check it in Settings.', settings: true }
    }
    if (status === 402) {
      return { message: 'Your OpenRouter credits are out. Add credits, then try again.', settings: true }
    }
    if (status === 429) {
      return { message: 'Too many requests to OpenRouter. Wait a moment, then try again.', settings: false }
    }
    if (status >= 500) {
      return { message: 'OpenRouter is having trouble right now. Try again in a few minutes.', settings: false }
    }
    const detail = /OpenRouter responded (.+)$/.exec(raw)?.[1]?.trim() ?? String(status)
    return { message: `OpenRouter returned an error (${detail}).`, settings: false }
  }

  return { message: raw || 'Something went wrong. Try again.', settings: false }
}
