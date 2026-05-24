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

export interface StartStreamMessagesInput {
  requestId: string
  model: string
  messages: ChatMessageInput[]
  thinking?: boolean
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
