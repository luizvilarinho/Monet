import type { ChatMessage } from '../hooks/useChat'
import type { Note } from '../types'
import { storage } from '../storage'
import { notesIndexGetDisabledNotebooks } from './documents'
import { extractPlanDraft, nameKey, type PlanDraft } from './plan'
import { bookKey, collectPlans, matchBook, type PlanEntry } from './planNotes'
import { extractProfileDraft, type ProfileDraft } from './studyProfile'

// Notas criadas a partir de respostas de agente ("Save as Plan note" do
// planner, "Save study profile" do tutor): o
// pedido gravado pela main, o rascunho detectado na resposta e o vínculo
// resposta → nota, que evita duplicar.

// Pedido de nota criada a partir de uma resposta de agente (gravado pela main).
export type AgentNoteRequest =
  | {
      kind: 'plan'
      notebookId: string
      title: string
      content: string
      start: string
      end: string
      capacity: number | null
      book: string | null
      // Plano antigo a arquivar (replanejamento); null = nenhum.
      archiveNoteId: string | null
    }
  | { kind: 'profile'; notebookId: string; title: string; content: string }

// Rascunho detectado numa resposta do assistant.
export type AgentNoteDraft =
  | { kind: 'plan'; messageId: string; plan: PlanDraft }
  | { kind: 'profile'; messageId: string; profile: ProfileDraft }

export function agentNoteDraft(message: ChatMessage, todayKey: string): AgentNoteDraft | null {
  if (message.role !== 'assistant') return null
  if (message.agentId === 'tutor') {
    const profile = extractProfileDraft(message.content)
    return profile ? { kind: 'profile', messageId: message.id, profile } : null
  }
  if (message.agentId !== 'planner') return null
  // Com `issue`, o botão aparece e o modal explica por que não dá para salvar.
  const plan = extractPlanDraft(message.content, todayKey)
  return plan ? { kind: 'plan', messageId: message.id, plan } : null
}

// Notas de plano (as mesmas do "Planner context": collectPlans, fora os
// cadernos com a IA desligada), lidas do storage: os candidatos do "Archive
// previous plan" nas três superfícies do chat.
export async function loadPlanEntries(todayKey: string): Promise<PlanEntry[]> {
  const [notes, defs, types, disabledIds] = await Promise.all([
    storage.getNotes(),
    storage.getMetadataDefs(),
    storage.getNoteTypes(),
    notesIndexGetDisabledNotebooks(),
  ])
  return collectPlans({
    notes,
    defs: defs.filter((d) => d.scope === 'note'),
    types,
    todayKey,
    disabledNotebookIds: new Set(disabledIds),
  })
}

// Plano que a resposta substitui ("Replaces: <título>" nas premissas), só
// entre as notas de plano: título igual ao citado (com vários, o mais
// recente); senão, o único plano ativo ou vencido do livro do rascunho ou do
// livro citado. `exceptId` = a nota já salva desta resposta.
export function replacedPlanNote(plan: PlanDraft, plans: PlanEntry[], exceptId: string | null): Note | null {
  if (!plan.replaces) return null
  const replaces = plan.replaces.replace(/^["'“”‘’]+|["'“”‘’.]+$/g, '')
  const wanted = nameKey(replaces)
  if (!wanted) return null
  const candidates = plans.filter((e) => e.note.id !== exceptId)
  const exact = candidates
    .filter((e) => nameKey(e.note.title) === wanted)
    .sort((a, b) => b.note.updatedAt - a.note.updatedAt)
  if (exact.length > 0) return exact[0].note
  const cited = ` ${bookKey(replaces)} `
  const byBook = candidates.filter((e) => {
    if (!e.info.book || (e.state !== 'active' && e.state !== 'overdue')) return false
    if (plan.book && matchBook(e.info.book, [{ title: plan.book }])) return true
    const key = bookKey(e.info.book)
    return key.length >= 6 && cited.includes(` ${key} `)
  })
  return byBook.length === 1 ? byBook[0].note : null
}

const AGENT_NOTE_KEY = 'monet:agent-note-by-message' // Record<messageId, noteId>
const AGENT_NOTE_LIMIT = 200

function loadMap(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(AGENT_NOTE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function savedAgentNoteId(messageId: string): string | null {
  const id = loadMap()[messageId]
  return typeof id === 'string' ? id : null
}

// Mais recente no fim; acima do limite, descarta as mais antigas.
export function rememberAgentNote(messageId: string, noteId: string): void {
  const map = loadMap()
  delete map[messageId]
  map[messageId] = noteId
  const keys = Object.keys(map)
  for (const k of keys.slice(0, Math.max(0, keys.length - AGENT_NOTE_LIMIT))) delete map[k]
  try {
    localStorage.setItem(AGENT_NOTE_KEY, JSON.stringify(map))
  } catch (err) {
    console.error('failed to persist agent note link', err)
  }
}
