import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type MincerKind = 'file' | 'paste' | 'record' | 'youtube' | 'web_summary' | 'web_capture'
export type MincerStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled' | 'interrupted'

export interface MincerItemSummary {
  id: string
  kind: MincerKind
  title: string
  status: MincerStatus
  stage: string | null
  progressCurrent: number
  progressTotal: number
  error: string | null
  createdAt: number
  updatedAt: number
  // Terminou (done/error) e ainda não foi aberto.
  unseen: boolean
  sentToNotebookAt: number | null
}

export interface MincerItem {
  id: string
  kind: MincerKind
  title: string
  source: string | null
  status: MincerStatus
  stage: string | null
  progressCurrent: number
  progressTotal: number
  error: string | null
  preset: string | null
  summaryPrompt: string | null
  transcriptionModel: string | null
  summaryModel: string | null
  transcript: string | null
  summary: string | null
  createdAt: number
  updatedAt: number
  unseen: boolean
  sentToNotebookAt: number | null
}

export interface MincerJobOptions {
  transcriptionModel?: string | null
  summaryModel?: string | null
  preset?: string | null
  summaryPrompt?: string | null
}

export interface MincerStartInput {
  kind: MincerKind
  source?: string | null
  text?: string | null
  options: MincerJobOptions
}

export interface MincerModel {
  id: string
  name: string
}

export interface MincerProgress {
  itemId: string
  stage: string
  current: number
  total: number
}

// Pico de cada faixa (0..1) desde o último evento; mic null sem microfone.
export interface MincerLevel {
  system: number
  mic: number | null
}

export interface MincerRecordStatus {
  active: boolean
  startedAt: number | null
  // Regras da gravação em curso (0 = desligada); o teto inclui os "+30 min".
  silenceStopMinutes: number
  maxMinutes: number
  errors: string[]
}

export const MINCER_TRANSCRIPTION_MODEL_KEY = 'monet:mincer-transcription-model'
export const MINCER_SUMMARY_MODEL_KEY = 'monet:mincer-summary-model'
export const MINCER_SAVE_FOLDER_KEY = 'monet:mincer-save-folder'
export const MINCER_SELECTED_ID_KEY = 'monet:mincer-selected-id'
export const MINCER_SILENCE_STOP_KEY = 'monet:mincer-silence-stop-min'
export const MINCER_MAX_RECORD_KEY = 'monet:mincer-max-record-hours'
export const DEFAULT_SILENCE_STOP_MINUTES = 10
export const DEFAULT_MAX_RECORD_HOURS = 3

// Parada automática da gravação; 0 em silenceStopMinutes desliga a regra.
export interface MincerRecordLimits {
  silenceStopMinutes: number
  maxMinutes: number
}

function readNumber(key: string, fallback: number): number {
  const raw = readKey(key)
  const value = raw === null ? NaN : Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function getRecordLimits(): MincerRecordLimits {
  return {
    silenceStopMinutes: readNumber(MINCER_SILENCE_STOP_KEY, DEFAULT_SILENCE_STOP_MINUTES),
    maxMinutes: readNumber(MINCER_MAX_RECORD_KEY, DEFAULT_MAX_RECORD_HOURS) * 60,
  }
}

export const STAGE_LABELS: Record<string, string> = {
  mixing: 'Mixing audio',
  downloading: 'Downloading audio',
  extracting: 'Extracting audio',
  splitting: 'Splitting audio',
  transcribing: 'Transcribing',
  fetching: 'Reading page',
  reading_pdf: 'Reading PDF',
  summarizing: 'Summarizing',
}

export const KIND_LABELS: Record<MincerKind, string> = {
  file: 'File',
  paste: 'Pasted text',
  record: 'Recording',
  youtube: 'YouTube',
  web_summary: 'Web page',
  web_capture: 'Web capture',
}

function readKey(key: string): string | null {
  try {
    const value = localStorage.getItem(key)?.trim()
    return value ? value : null
  } catch {
    return null
  }
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function getTranscriptionModel(): string | null {
  return readKey(MINCER_TRANSCRIPTION_MODEL_KEY)
}

// Vazio usa o modelo do Chat e, sem ele, o último modelo usado.
export function resolveSummaryModel(): string | null {
  return readKey(MINCER_SUMMARY_MODEL_KEY) ?? readKey('monet:chat-model') ?? readKey('lastModelId')
}

// Arquivos de texto (inclui PDF): sem transcrição, não pedem modelo de áudio.
export function isTextFile(path: string): boolean {
  return /\.(txt|md|pdf)$/i.test(path)
}

// Áudio, vídeo e gravação têm transcrição; os outros kinds têm só texto.
export function isTranscriptKind(kind: MincerKind, source: string | null): boolean {
  if (kind === 'record' || kind === 'youtube') return true
  return kind === 'file' && !!source && !isTextFile(source)
}

// O Rust grava o erro como frase + linha em branco + detalhe técnico: a UI
// mostra a frase e recolhe o detalhe.
export function splitMincerError(raw: string): { message: string; detail: string | null } {
  if (raw === 'OPENROUTER_KEY_MISSING') return { message: 'Add your OpenRouter key in Settings.', detail: null }
  const at = raw.indexOf('\n\n')
  if (at < 0) return { message: raw, detail: null }
  return { message: raw.slice(0, at), detail: raw.slice(at + 2).trim() || null }
}

export function mincerList(): Promise<MincerItemSummary[]> {
  return invoke<MincerItemSummary[]>('mincer_list')
}

export function mincerGet(id: string): Promise<MincerItem | null> {
  return invoke<MincerItem | null>('mincer_get', { id })
}

export function mincerStart(input: MincerStartInput): Promise<string> {
  return invoke<string>('mincer_start', { input })
}

// Retoma com os modelos atuais do Settings (os vazios mantêm os do item).
export function mincerResume(id: string): Promise<void> {
  const options: MincerJobOptions = {
    transcriptionModel: getTranscriptionModel(),
    summaryModel: resolveSummaryModel(),
  }
  return invoke('mincer_resume', { id, options })
}

export function mincerCancel(id: string): Promise<void> {
  return invoke('mincer_cancel', { id })
}

export function mincerRegenerateSummary(id: string, options: MincerJobOptions): Promise<void> {
  return invoke('mincer_regenerate_summary', { id, options })
}

export function mincerRename(id: string, title: string): Promise<void> {
  return invoke('mincer_rename', { id, title })
}

export function mincerDelete(id: string): Promise<void> {
  return invoke('mincer_delete', { id })
}

export function mincerActiveJob(): Promise<string | null> {
  return invoke<string | null>('mincer_active_job')
}

export function mincerListTranscriptionModels(): Promise<MincerModel[]> {
  return invoke<MincerModel[]>('mincer_list_transcription_models')
}

export function mincerMarkSeen(id: string): Promise<void> {
  return invoke('mincer_mark_seen', { id })
}

export function mincerMarkSentToNotebook(id: string): Promise<void> {
  return invoke('mincer_mark_sent_to_notebook', { id })
}

export function mincerPickFiles(): Promise<string[]> {
  return invoke<string[]>('mincer_pick_files')
}

export function mincerPickFolder(): Promise<string | null> {
  return invoke<string | null>('documents_pick_folder')
}

export function mincerSaveFiles(id: string, folder: string): Promise<string> {
  return invoke<string>('mincer_save_files', { id, folder })
}

export function mincerRecordStart(options: MincerJobOptions): Promise<void> {
  return invoke('mincer_record_start', { options, limits: getRecordLimits() })
}

export function mincerRecordStop(): Promise<string> {
  return invoke<string>('mincer_record_stop')
}

// Estende o teto da gravação em 30 min; devolve o teto novo, em minutos.
export function mincerRecordExtend(): Promise<number> {
  return invoke<number>('mincer_record_extend')
}

export function mincerRecordDiscard(): Promise<void> {
  return invoke('mincer_record_discard')
}

export function mincerRecordStatus(): Promise<MincerRecordStatus> {
  return invoke<MincerRecordStatus>('mincer_record_status')
}

export function onMincerProgress(handler: (p: MincerProgress) => void): Promise<UnlistenFn> {
  return listen<MincerProgress>('mincer://progress', (e) => handler(e.payload))
}

export function onMincerDone(handler: (p: { itemId: string }) => void): Promise<UnlistenFn> {
  return listen<{ itemId: string }>('mincer://done', (e) => handler(e.payload))
}

export function onMincerError(
  handler: (p: { itemId: string; message: string; cancelled: boolean }) => void,
): Promise<UnlistenFn> {
  return listen<{ itemId: string; message: string; cancelled: boolean }>('mincer://error', (e) =>
    handler(e.payload),
  )
}

export function onMincerRecord(handler: (p: { active: boolean }) => void): Promise<UnlistenFn> {
  return listen<{ active: boolean }>('mincer://record', (e) => handler(e.payload))
}

export function onMincerLevel(handler: (p: MincerLevel) => void): Promise<UnlistenFn> {
  return listen<MincerLevel>('mincer://level', (e) => handler(e.payload))
}
