import type { Notebook, NoteType } from '../../types'
import { CALENDAR_NOTEBOOK_ID } from '../calendar'
import { tagKey } from '../noteTags'
import { nameKey } from '../plan'
import { bookKey } from '../planNotes'
import { normalizeName } from '../tasks'
import type { AgentContextInput } from './chat'

// Escopo dos agentes (tutor, Radar, Papers): o caderno da pasta da conversa,
// ou o que a mensagem cita (caderno, tag, board ou "tudo"). Recalculado a cada
// mensagem. Módulo puro (sem storage).

export type ScopeSource = 'folder' | 'folderName' | 'message'

export const SCOPE_SOURCE_TEXT: Record<ScopeSource, string> = {
  folder: 'from the chat folder',
  folderName: 'from the folder name',
  message: 'from your message',
}

export type AgentScope =
  | { kind: 'notebook'; notebook: Notebook; source: ScopeSource }
  | { kind: 'tag'; tag: string } // forma de exibição (summarizeTags)
  | { kind: 'board'; type: NoteType } // tipo com `board` configurado
  | { kind: 'all'; source: 'default' | 'message' }

type ScopeInput = Pick<AgentContextInput, 'notebookId' | 'folderName' | 'userMessages'>

export interface ScopeContext {
  notebooks: Notebook[]
  tags: string[] // forma de exibição (summarizeTags)
  boardTypes: NoteType[] // só tipos com board configurado
}

const FOLDER_NAME_RE = /^Notebook - (.+)$/

// Texto entre aspas (retas, curvas ou angulares).
const QUOTED_RE = /["“”'‘’«»]([^"“”'‘’«»\n]{3,90})["“”'‘’«»]/g
// Palavras que, antes do nome, marcam o caderno ("caderno de X", "notebook X").
const NOTEBOOK_WORDS = ['caderno', 'caderno de', 'caderno do', 'caderno da', 'notebook']
const TAG_WORDS = ['tag', 'the tag', 'a tag', 'com a tag', 'marcadas com']
const BOARD_WORDS = ['board', 'the board', 'o board', 'board de', 'board do', 'board da', 'quadro', 'quadro de']
const ALL_WORDS = ['everything', 'all notebooks', 'all my notes', 'all my notebooks', 'tudo', 'todos os cadernos',
  'todas as notas', 'todos os meus cadernos']

// Item cujo nome aparece no texto como palavras inteiras (chave com 3+
// caracteres); com vários, o nome mais longo ganha.
export function namedIn<T>(text: string, items: T[], name: (item: T) => string): T | null {
  const haystack = ` ${bookKey(text)} `
  let best: { item: T; key: string } | null = null
  for (const item of items) {
    const key = bookKey(name(item))
    if (key.length < 3 || !haystack.includes(` ${key} `)) continue
    if (!best || key.length > best.key.length) best = { item, key }
  }
  return best?.item ?? null
}

function quotedKeys(text: string): Set<string> {
  return new Set([...text.matchAll(QUOTED_RE)].map((m) => bookKey(m[1])))
}

// Caderno citado de forma explícita: o nome entre aspas ou junto de
// "caderno"/"notebook". Com vários, o nome mais longo ganha.
export function explicitNotebookIn(text: string, notebooks: Notebook[]): Notebook | null {
  const quoted = quotedKeys(text)
  const haystack = ` ${bookKey(text)} `
  let best: { notebook: Notebook; key: string } | null = null
  for (const notebook of notebooks) {
    const key = bookKey(notebook.name)
    if (key.length < 3) continue
    const near =
      NOTEBOOK_WORDS.some((w) => haystack.includes(` ${w} ${key} `)) || haystack.includes(` ${key} notebook `)
    if (!quoted.has(key) && !near) continue
    if (!best || key.length > best.key.length) best = { notebook, key }
  }
  return best?.notebook ?? null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Tag citada de forma explícita: `#<tag>` no texto (sem caixa nem acento, seguida
// de fim, espaço ou pontuação), "tag <nome>" (TAG_WORDS) ou o nome entre aspas.
// Com várias, o nome mais longo ganha. Devolve a forma de exibição de `tags`.
export function explicitTagIn(text: string, tags: string[]): string | null {
  const quoted = quotedKeys(text)
  const haystack = ` ${bookKey(text)} `
  const hashes = normalizeName(text.replace(/\s+/g, ' '))
  let best: { tag: string; key: string } | null = null
  for (const tag of tags) {
    const key = tagKey(tag)
    if (!key) continue
    const hashed = new RegExp(`#${escapeRegExp(key)}(?=$|[\\s.,;:!?)\\]}"'’”»])`).test(hashes)
    const bare = bookKey(tag)
    const named = bare.length > 0 && (quoted.has(bare) || TAG_WORDS.some((w) => haystack.includes(` ${w} ${bare} `)))
    if (!hashed && !named) continue
    if (!best || key.length > best.key.length) best = { tag, key }
  }
  return best?.tag ?? null
}

// Tipo (com board) citado de forma explícita: o nome entre aspas, depois de
// uma das BOARD_WORDS ("board Paper") ou seguido de " board" ("Paper board").
// Com vários, o nome mais longo ganha.
export function explicitBoardIn(text: string, types: NoteType[]): NoteType | null {
  const quoted = quotedKeys(text)
  const haystack = ` ${bookKey(text)} `
  let best: { type: NoteType; key: string } | null = null
  for (const type of types) {
    const key = bookKey(type.name)
    if (key.length < 3) continue
    const near = BOARD_WORDS.some((w) => haystack.includes(` ${w} ${key} `)) || haystack.includes(` ${key} board `)
    if (!quoted.has(key) && !near) continue
    if (!best || key.length > best.key.length) best = { type, key }
  }
  return best?.type ?? null
}

export function mentionsAll(text: string): boolean {
  const haystack = ` ${bookKey(text)} `
  return ALL_WORDS.some((w) => haystack.includes(` ${bookKey(w)} `))
}

function scopeNotebooks(ctx: ScopeContext): Notebook[] {
  return ctx.notebooks.filter((nb) => nb.id !== CALENDAR_NOTEBOOK_ID)
}

// Escopo que a mensagem diz de forma explícita. Precedência: caderno, board,
// tag e "tudo". null = a mensagem não diz.
export function explicitScopeIn(text: string, ctx: ScopeContext): AgentScope | null {
  const notebook = explicitNotebookIn(text, scopeNotebooks(ctx))
  if (notebook) return { kind: 'notebook', notebook, source: 'message' }
  const type = explicitBoardIn(text, ctx.boardTypes)
  if (type) return { kind: 'board', type }
  const tag = explicitTagIn(text, ctx.tags)
  if (tag) return { kind: 'tag', tag }
  return mentionsAll(text) ? { kind: 'all', source: 'message' } : null
}

// Caderno da pasta da conversa: o vínculo da pasta, depois o nome "Notebook - X".
function notebookOfFolder(
  input: ScopeInput,
  candidates: Notebook[]
): { notebook: Notebook; source: ScopeSource } | null {
  const linked = input.notebookId ? candidates.find((nb) => nb.id === input.notebookId) : undefined
  if (linked) return { notebook: linked, source: 'folder' }
  const folder = input.folderName?.match(FOLDER_NAME_RE)
  if (folder) {
    const key = nameKey(folder[1])
    const named = candidates.find((nb) => nameKey(nb.name.trim().slice(0, 90)) === key)
    if (named) return { notebook: named, source: 'folderName' }
  }
  return null
}

// Caderno em escopo, recalculado a cada mensagem. A mensagem deste turno que
// cita outro caderno de forma explícita (entre aspas ou junto de
// "caderno"/"notebook") vence a pasta (a pergunta mudou de tema); senão,
// vínculo da pasta, depois o nome "Notebook - X", depois o caderno citado nas
// mensagens (da mais nova para a mais antiga). O Calendar fica fora.
export function resolveNotebookScope(
  input: ScopeInput,
  notebooks: Notebook[]
): { notebook: Notebook; source: ScopeSource } | null {
  const candidates = notebooks.filter((nb) => nb.id !== CALENDAR_NOTEBOOK_ID)
  const latest = input.userMessages[0] ? explicitNotebookIn(input.userMessages[0], candidates) : null
  const fromFolder = notebookOfFolder(input, candidates)
  if (latest && latest.id !== fromFolder?.notebook.id) return { notebook: latest, source: 'message' }
  if (fromFolder) return fromFolder

  for (const message of input.userMessages) {
    const named = namedIn(message, candidates, (nb) => nb.name)
    if (named) return { notebook: named, source: 'message' }
  }
  return null
}

// Escopo do Radar e do Papers, na mesma ordem do tutor: 1) o escopo explícito
// da mensagem mais nova, quando difere do caderno da pasta; 2) o caderno da
// pasta; 3) nas mensagens, da mais nova para a mais antiga, o escopo explícito
// ou o caderno citado; 4) tudo.
export function resolveAgentScope(input: ScopeInput, ctx: ScopeContext): AgentScope {
  const candidates = scopeNotebooks(ctx)
  const fromFolder = notebookOfFolder(input, candidates)
  const latest = input.userMessages[0] ? explicitScopeIn(input.userMessages[0], ctx) : null
  if (latest && !(latest.kind === 'notebook' && latest.notebook.id === fromFolder?.notebook.id)) return latest
  if (fromFolder) return { kind: 'notebook', ...fromFolder }

  for (const message of input.userMessages) {
    const explicit = explicitScopeIn(message, ctx)
    if (explicit) return explicit
    const named = namedIn(message, candidates, (nb) => nb.name)
    if (named) return { kind: 'notebook', notebook: named, source: 'message' }
  }
  return { kind: 'all', source: 'default' }
}

// 'notebook:<id>' | 'tag:<tagKey>' | 'board:<typeId>' | 'all'
export function scopeKey(scope: AgentScope): string {
  switch (scope.kind) {
    case 'notebook':
      return `notebook:${scope.notebook.id}`
    case 'tag':
      return `tag:${tagKey(scope.tag)}`
    case 'board':
      return `board:${scope.type.id}`
    default:
      return 'all'
  }
}

// 'notebook "X"' | 'tag #x' | 'board "Paper"' | 'all notebooks'
export function scopeLabel(scope: AgentScope): string {
  switch (scope.kind) {
    case 'notebook':
      return `notebook "${scope.notebook.name}"`
    case 'tag':
      return `tag #${scope.tag}`
    case 'board':
      return `board "${scope.type.name}"`
    default:
      return 'all notebooks'
  }
}
