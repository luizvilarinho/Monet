import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { ArrowLineDown, ArrowLineUp, Trash } from '@phosphor-icons/react'
import { commandLineHint, getCommandLineStatus, isPotentialCommandLine, parseCommandLine } from './commandParser'
import { iconMarkup } from './iconMarkup'
import { CHAT_AGENTS, GENERAL_AGENT_ID } from '../../lib/agents/chat'
import type { AiResponse } from '../../types'

export type CommandPersistedStatus = 'executed' | 'invalid' | 'incomplete'

// Execução da linha pelo Enter: liga a linha à resposta dela em qualquer
// status (preparo, streaming, erro). `pending` até o onCommand terminar.
export interface CommandRun {
  commandId: string
  pending: boolean
}

interface MarkEntry {
  text: string
  status: CommandPersistedStatus
  run?: CommandRun
}

export interface CommandPluginState {
  marks: Map<number, MarkEntry>
  responsesVersion: number
}

interface SetMarkMeta {
  type: 'setMark'
  pos: number
  text: string
  status: CommandPersistedStatus
  run?: CommandRun
}

interface SyncExecutedMeta {
  type: 'syncExecuted'
  texts: Set<string>
}

interface BumpResponsesMeta {
  type: 'bumpResponses'
}

// O onCommand terminou: `ok` false = não rodou, e a linha volta a rascunho.
interface SettleRunMeta {
  type: 'settleRun'
  commandId: string
  ok: boolean
}

type Meta = SetMarkMeta | SyncExecutedMeta | BumpResponsesMeta | SettleRunMeta

export const commandPluginKey = new PluginKey<CommandPluginState>('monet-commands')

export interface CommandExtensionOptions {
  getResponses: () => AiResponse[]
}

// Ícones dos botões da linha (widgets em DOM puro), desenhados uma vez.
const ICON_INSERT = iconMarkup(ArrowLineDown)
const ICON_REMOVE = iconMarkup(ArrowLineUp)
const ICON_DELETE = iconMarkup(Trash)

// Agentes do chat digitados no editor: a linha avisa onde eles moram.
const CHAT_ONLY_AGENTS = CHAT_AGENTS.filter((a) => a.id !== GENERAL_AGENT_ID)

const NESTED_HINT = 'Commands run on their own line'

function isParagraph(node: PMNode): boolean {
  return node.type.name === 'paragraph'
}

function paragraphText(node: PMNode): string {
  return node.textContent
}

function commandTextFromResponse(r: AiResponse): string {
  return r.query.trim() ? `${r.command} ${r.query.trim()}` : r.command
}

// For !takesQuery commands, the stored query is always '' so the executed key is
// just the command name. Normalize the paragraph text to the same form so that
// '/mindmap extra instructions' correctly matches the '/mindmap' entry in the set.
function resolveExecutedKey(text: string): string {
  const parsed = parseCommandLine(text)
  if (parsed?.definition && !parsed.definition.takesQuery) return parsed.commandName
  return text
}

function chatAgentHint(text: string): string | null {
  const name = parseCommandLine(text)?.commandName
  const agent = CHAT_ONLY_AGENTS.find((a) => a.command === name)
  return agent ? `${agent.label} is a chat agent — open it in Chat` : null
}

function syncExecutedMarks(
  doc: PMNode,
  current: Map<number, MarkEntry>,
  texts: Set<string>
): Map<number, MarkEntry> {
  const next = new Map(current)
  doc.descendants((node, pos) => {
    if (!isParagraph(node)) return true
    const text = paragraphText(node).trim()
    if (text && isPotentialCommandLine(text)) {
      const existing = next.get(pos)
      // Linha rodada nesta sessão: o status vem da resposta dela.
      if (existing?.run && existing.text === text) return false
      if (texts.has(resolveExecutedKey(text))) {
        next.set(pos, { text, status: 'executed' })
      } else if (existing?.status === 'executed' && !texts.has(resolveExecutedKey(existing.text))) {
        next.delete(pos)
      }
    }
    return false
  })
  return next
}

function settleRun(marks: Map<number, MarkEntry>, commandId: string, ok: boolean): Map<number, MarkEntry> {
  const next = new Map(marks)
  for (const [pos, entry] of marks) {
    if (entry.run?.commandId !== commandId) continue
    if (ok) next.set(pos, { ...entry, run: { ...entry.run, pending: false } })
    else next.delete(pos)
  }
  return next
}

function pruneStaleMarks(
  marks: Map<number, MarkEntry>,
  tr: Transaction
): Map<number, MarkEntry> {
  const next = new Map<number, MarkEntry>()
  for (const [pos, entry] of marks) {
    const mappedPos = tr.mapping.map(pos, -1)
    if (mappedPos < 0 || mappedPos >= tr.doc.content.size) continue
    let node: PMNode | null = null
    try {
      const resolved = tr.doc.resolve(mappedPos)
      if (resolved.depth >= 1) {
        node = resolved.node(1)
      } else if (mappedPos < tr.doc.content.size) {
        node = tr.doc.nodeAt(mappedPos)
      }
    } catch {
      continue
    }
    if (!node || !isParagraph(node)) continue
    if (paragraphText(node).trim() !== entry.text) continue
    next.set(mappedPos, entry)
  }
  return next
}

// Resposta da execução, pelo commandId (o card de erro do preparo também o leva).
function runResponse(run: CommandRun, responses: AiResponse[]): AiResponse | undefined {
  return responses.find((r) => r.id === run.commandId || r.commandId === run.commandId)
}

// Linha já executada que o Enter roda de novo: só quando a execução desta
// sessão falhou (ou terminou sem resposta).
export function canRunAgain(state: EditorState, pos: number, responses: AiResponse[]): boolean {
  const mark = commandPluginKey.getState(state)?.marks.get(pos)
  if (!mark || mark.status !== 'executed') return true
  if (!mark.run || mark.run.pending) return false
  const response = runResponse(mark.run, responses)
  return !response || response.status === 'error'
}

interface ParagraphCommandInfo {
  pos: number
  end: number
  text: string
  response: AiResponse
  hasEmbed: boolean
}

function buildCommandIndex(
  doc: PMNode,
  responses: AiResponse[],
  marks?: Map<number, MarkEntry>
): ParagraphCommandInfo[] {
  const result: ParagraphCommandInfo[] = []

  // Map response.id -> response
  const byId = new Map<string, AiResponse>()
  // Map text -> responses (oldest first): concluídas e, à parte, as paradas
  // ou em andamento (sem erro).
  const byText = new Map<string, AiResponse[]>()
  const otherByText = new Map<string, AiResponse[]>()
  const ordered = [...responses].sort((a, b) => a.createdAt - b.createdAt)
  for (const r of ordered) {
    byId.set(r.id, r)
    if (r.status === 'error') continue
    const map = r.status === 'completed' ? byText : otherByText
    const text = commandTextFromResponse(r)
    const arr = map.get(text) ?? []
    arr.push(r)
    map.set(text, arr)
  }

  const consumed = new Set<string>()
  const take = (candidates: AiResponse[] | undefined): AiResponse | undefined => {
    const r = candidates?.find((c) => !consumed.has(c.id))
    if (r) consumed.add(r.id)
    return r
  }

  doc.descendants((node, pos) => {
    if (!isParagraph(node)) return true
    const text = paragraphText(node).trim()
    if (!text || !isPotentialCommandLine(text)) return false

    const nodeEnd = pos + node.nodeSize
    const afterNode = nodeEnd < doc.content.size ? doc.nodeAt(nodeEnd) : null

    let response: AiResponse | undefined
    let hasEmbed = false

    if (afterNode && afterNode.type.name === 'embedBlock') {
      const cmdId = afterNode.attrs.commandId as string | null
      if (cmdId) {
        response = byId.get(cmdId)
        if (response) {
          hasEmbed = true
          consumed.add(response.id)
        }
      }
    }

    const mark = marks?.get(pos)
    if (!response && mark?.run && mark.text === text) {
      const own = runResponse(mark.run, responses)
      if (own && !consumed.has(own.id)) {
        response = own
        consumed.add(own.id)
      }
    }

    if (!response) response = take(byText.get(resolveExecutedKey(text)))
    if (!response) response = take(otherByText.get(resolveExecutedKey(text)))

    if (response) {
      result.push({ pos, end: nodeEnd, text, response, hasEmbed })
    }
    return false
  })

  return result
}

function findEmbedPosByCommandId(doc: PMNode, commandId: string): { pos: number; nodeSize: number } | null {
  let found: { pos: number; nodeSize: number } | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'embedBlock' && node.attrs.commandId === commandId) {
      found = { pos, nodeSize: node.nodeSize }
      return false
    }
    return true
  })
  return found
}

function findCommandParagraph(
  state: EditorState,
  responseId: string,
  responseText: string,
  responses: AiResponse[]
): { pos: number; end: number } | null {
  const { doc } = state
  const idx = buildCommandIndex(doc, responses, commandPluginKey.getState(state)?.marks)
  // Prefer exact match by response.id
  for (const entry of idx) {
    if (entry.response.id === responseId) {
      return { pos: entry.pos, end: entry.end }
    }
  }
  // Fallback: first paragraph matching text
  let result: { pos: number; end: number } | null = null
  doc.descendants((node, pos) => {
    if (result) return false
    if (!isParagraph(node)) return true
    if (paragraphText(node).trim() === responseText) {
      result = { pos, end: pos + node.nodeSize }
      return false
    }
    return false
  })
  return result
}

function insertEmbedAfter(
  view: EditorView,
  paragraphEnd: number,
  commandId: string
): void {
  const schema = view.state.schema
  const embedType = schema.nodes['embedBlock']
  if (!embedType) {
    console.warn('embedBlock node type not registered')
    return
  }
  const node = embedType.create({ commandId, collapsed: true })
  const tr = view.state.tr.insert(paragraphEnd, node)
  view.dispatch(tr)
}

function removeEmbedByCommandId(view: EditorView, commandId: string): void {
  const found = findEmbedPosByCommandId(view.state.doc, commandId)
  if (!found) return
  const tr = view.state.tr.delete(found.pos, found.pos + found.nodeSize)
  view.dispatch(tr)
}

function deleteCommandLine(
  view: EditorView,
  paragraphPos: number,
  paragraphEnd: number,
  commandId: string
): void {
  const embed = findEmbedPosByCommandId(view.state.doc, commandId)
  let tr = view.state.tr
  // Remove embed first if present (and is positioned after the paragraph, but
  // do deletes back-to-front to keep offsets valid)
  if (embed && embed.pos >= paragraphEnd) {
    tr = tr.delete(embed.pos, embed.pos + embed.nodeSize)
    tr = tr.delete(paragraphPos, paragraphEnd)
  } else if (embed && embed.pos < paragraphPos) {
    tr = tr.delete(paragraphPos, paragraphEnd)
    tr = tr.delete(embed.pos, embed.pos + embed.nodeSize)
  } else {
    tr = tr.delete(paragraphPos, paragraphEnd)
  }
  view.dispatch(tr)
}

function lineButton(className: string, icon: string, label: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `monetCmdBtn ${className}`
  btn.innerHTML = icon
  const text = document.createElement('span')
  text.textContent = label
  btn.appendChild(text)
  btn.title = title
  btn.addEventListener('mousedown', (e) => e.preventDefault())
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  })
  return btn
}

// Status curto da linha: o que a resposta está fazendo, ou por que falhou.
function statusNote(text: string, className: string, title?: string): HTMLElement {
  const note = document.createElement('span')
  note.className = `monetCmdStatus ${className}`
  note.textContent = text
  if (title) note.title = title
  return note
}

// `preparing` (montando o contexto) e `streaming` estão em andamento.
function isRunning(status: AiResponse['status']): boolean {
  return status === 'preparing' || status === 'streaming'
}

// Em `preparing`, a etapa que o useAi expõe ("Searching the web…").
function progressLabel(response: AiResponse): string {
  if (response.status === 'streaming') return 'Responding…'
  return response.statusText ?? 'Preparing…'
}

function makeButtonsWidget(
  view: EditorView,
  entry: ParagraphCommandInfo,
  options: CommandExtensionOptions
): HTMLElement {
  const wrap = document.createElement('span')
  wrap.className = 'monetCmdButtons'
  wrap.contentEditable = 'false'
  wrap.setAttribute('data-monet-cmd-buttons', '')

  const response = entry.response
  const status = response.status

  if (isRunning(status)) {
    const note = statusNote(progressLabel(response), 'monetCmdDots')
    note.setAttribute('role', 'status')
    wrap.appendChild(note)
    return wrap
  }

  // Insert / Remove block — only for completed responses
  if (status === 'completed') {
    const toggleBtn = entry.hasEmbed
      ? lineButton('monetCmdBtnRemove', ICON_REMOVE, 'Remove block', 'Remove the block from the note (the response stays in the AI panel)', () =>
          removeEmbedByCommandId(view, response.id)
        )
      : lineButton('monetCmdBtnInsert', ICON_INSERT, 'Insert', 'Insert the response into the note as a block', () => {
          // Re-resolve paragraph end at click time
          const found = findCommandParagraph(view.state, response.id, entry.text, options.getResponses())
          insertEmbedAfter(view, found ? found.end : entry.end, response.id)
        })
    wrap.appendChild(toggleBtn)
  } else if (status === 'error') {
    const message = response.response.trim().split('\n')[0] ?? ''
    wrap.appendChild(statusNote(message ? `Failed · ${message}` : 'Failed', 'monetCmdFailed', response.response))
  } else {
    wrap.appendChild(statusNote('Stopped', 'monetCmdStoppedNote'))
  }

  // Delete — para qualquer status finalizado (completed, interrupted, error).
  // Tira só a linha e o bloco da nota: a resposta fica no painel de IA, onde
  // a exclusão é explícita.
  wrap.appendChild(
    lineButton('monetCmdBtnDelete', ICON_DELETE, 'Delete', 'Delete the command line and its block. The response stays in the AI panel.', () => {
      const found = findCommandParagraph(view.state, response.id, entry.text, options.getResponses())
      deleteCommandLine(view, found ? found.pos : entry.pos, found ? found.end : entry.end, response.id)
    })
  )

  return wrap
}

function makePendingWidget(): HTMLElement {
  const wrap = document.createElement('span')
  wrap.className = 'monetCmdButtons'
  wrap.contentEditable = 'false'
  const note = statusNote('Running…', 'monetCmdDots')
  note.setAttribute('role', 'status')
  wrap.appendChild(note)
  return wrap
}

function makeHintWidget(text: string): HTMLElement {
  const hint = document.createElement('span')
  hint.className = 'monetCmdHint'
  hint.contentEditable = 'false'
  hint.textContent = text
  return hint
}

function lineClass(status: AiResponse['status']): string {
  if (status === 'completed') return 'monetCmdExecuted'
  if (status === 'error') return 'monetCmdError'
  if (status === 'interrupted') return 'monetCmdStopped'
  return 'monetCmdPending'
}

function buildDecorations(
  state: EditorState,
  pluginState: CommandPluginState,
  responses: AiResponse[],
  view: EditorView | null,
  options: CommandExtensionOptions
): DecorationSet {
  const decorations: Decoration[] = []
  const index = buildCommandIndex(state.doc, responses, pluginState.marks)
  const byPos = new Map<number, ParagraphCommandInfo>()
  for (const entry of index) byPos.set(entry.pos, entry)
  const { selection } = state
  const cursorLine = selection.empty && selection.$from.depth > 0 ? selection.$from.before() : -1

  state.doc.descendants((node, pos) => {
    if (!isParagraph(node)) return true
    const text = paragraphText(node).trim()
    if (!text || !isPotentialCommandLine(text)) return false

    const persisted = pluginState.marks.get(pos)
    const indexEntry = byPos.get(pos)
    const nodeEnd = pos + node.nodeSize
    const widgetPos = nodeEnd - 1
    // Só a linha de topo roda o comando; dentro de lista, toggle ou citação
    // ela fica como texto e ganha a dica com o cursor nela.
    const topLevel = state.doc.resolve(pos).depth === 0
    let className: string | null = null
    let hint: string | null = null
    if (indexEntry) {
      className = lineClass(indexEntry.response.status)
    } else if (persisted?.run?.pending) {
      className = 'monetCmdPending'
    } else if (persisted && persisted.status !== 'executed') {
      className = 'monetCmdError'
      hint = chatAgentHint(text) ?? commandLineHint(text, persisted.status)
    } else if (persisted && !persisted.run) {
      className = 'monetCmdExecuted'
    } else if (topLevel) {
      className = 'monetCmdDraft'
      hint = chatAgentHint(text)
    } else if (cursorLine === pos) {
      hint = NESTED_HINT
    }

    if (className) {
      decorations.push(
        Decoration.node(pos, nodeEnd, {
          class: className,
          spellcheck: 'false',
        })
      )
    }

    if (indexEntry && view) {
      decorations.push(
        Decoration.widget(widgetPos, () => makeButtonsWidget(view, indexEntry, options), {
          side: 1,
          ignoreSelection: true,
          key: `cmdbtn-${indexEntry.response.id}-${indexEntry.hasEmbed ? '1' : '0'}-${indexEntry.response.status}-${indexEntry.response.status === 'error' ? indexEntry.response.response.length : 0}-${indexEntry.response.statusText ?? ''}`,
        })
      )
    } else if (!indexEntry && persisted?.run?.pending) {
      decorations.push(
        Decoration.widget(widgetPos, makePendingWidget, {
          side: 1,
          ignoreSelection: true,
          key: `cmdpending-${persisted.run.commandId}`,
        })
      )
    }
    if (hint) {
      const text = hint
      decorations.push(
        Decoration.widget(widgetPos, () => makeHintWidget(text), {
          side: 1,
          ignoreSelection: true,
          key: `cmdhint-${text}`,
        })
      )
    }
    return false
  })

  return DecorationSet.create(state.doc, decorations)
}

export const CommandExtension = Extension.create<CommandExtensionOptions>({
  name: 'monetCommands',

  addOptions() {
    return {
      getResponses: () => [],
    }
  },

  addProseMirrorPlugins() {
    const ext = this
    const viewRef: { current: EditorView | null } = { current: null }
    return [
      new Plugin<CommandPluginState>({
        key: commandPluginKey,
        state: {
          init: () => ({ marks: new Map(), responsesVersion: 0 }),
          apply: (tr, prev) => {
            let marks = prev.marks
            let responsesVersion = prev.responsesVersion
            if (tr.docChanged) {
              marks = pruneStaleMarks(marks, tr)
            }
            const meta = tr.getMeta(commandPluginKey) as Meta | undefined
            if (meta) {
              switch (meta.type) {
                case 'setMark': {
                  const next = new Map(marks)
                  next.set(meta.pos, { text: meta.text, status: meta.status, run: meta.run })
                  marks = next
                  break
                }
                case 'syncExecuted': {
                  marks = syncExecutedMarks(tr.doc, marks, meta.texts)
                  break
                }
                case 'settleRun': {
                  marks = settleRun(marks, meta.commandId, meta.ok)
                  break
                }
                case 'bumpResponses': {
                  responsesVersion = responsesVersion + 1
                  break
                }
              }
            }
            return { marks, responsesVersion }
          },
        },
        props: {
          decorations(state) {
            const pluginState = commandPluginKey.getState(state)
            if (!pluginState) return null
            const responses = ext.options.getResponses()
            return buildDecorations(
              state,
              pluginState,
              responses,
              viewRef.current,
              ext.options
            )
          },
        },
        view(editorView) {
          viewRef.current = editorView
          return {
            destroy() {
              viewRef.current = null
            },
          }
        },
      }),
    ]
  },
})

export interface CommandLineInfo {
  text: string
  cmd: string
  query: string
  status: ReturnType<typeof getCommandLineStatus>
  paragraphPos: number
  paragraphEnd: number
}

export function getCurrentCommandLine(state: EditorState, isCalendarNote = false): CommandLineInfo | null {
  const { selection } = state
  if (!selection.empty) return null
  const $pos = selection.$from
  if ($pos.depth < 1) return null
  const node = $pos.node(1)
  if (!isParagraph(node)) return null
  const text = paragraphText(node).trim()
  if (!text || !isPotentialCommandLine(text)) return null
  const paragraphPos = $pos.before(1)
  const paragraphEnd = $pos.after(1)
  const match = text.match(/^(\/[^\s]+)(?:\s+(.*))?$/)
  const cmd = match?.[1].toLowerCase() ?? text.toLowerCase()
  const query = (match?.[2] ?? '').trim()
  return {
    text,
    cmd,
    query,
    status: getCommandLineStatus(text, isCalendarNote),
    paragraphPos,
    paragraphEnd,
  }
}
