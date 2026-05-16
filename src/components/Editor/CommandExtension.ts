import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { getCommandLineStatus, isPotentialCommandLine } from './commandParser'
import type { AiResponse } from '../../types'

export type CommandPersistedStatus = 'executed' | 'invalid' | 'incomplete'

interface MarkEntry {
  text: string
  status: CommandPersistedStatus
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
}

interface SyncExecutedMeta {
  type: 'syncExecuted'
  texts: Set<string>
}

interface ClearMarksMeta {
  type: 'clearMarks'
}

interface BumpResponsesMeta {
  type: 'bumpResponses'
}

type Meta = SetMarkMeta | SyncExecutedMeta | ClearMarksMeta | BumpResponsesMeta

export const commandPluginKey = new PluginKey<CommandPluginState>('monet-commands')

export interface CommandExtensionOptions {
  getResponses: () => AiResponse[]
  onRemoveResponse: (id: string) => void
}

function isParagraph(node: PMNode): boolean {
  return node.type.name === 'paragraph'
}

function paragraphText(node: PMNode): string {
  return node.textContent
}

function commandTextFromResponse(r: AiResponse): string {
  return r.query.trim() ? `${r.command} ${r.query.trim()}` : r.command
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
    if (text && isPotentialCommandLine(text) && texts.has(text)) {
      next.set(pos, { text, status: 'executed' })
    } else {
      const existing = next.get(pos)
      if (existing?.status === 'executed' && !texts.has(existing.text)) {
        next.delete(pos)
      }
    }
    return false
  })
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

interface ParagraphCommandInfo {
  pos: number
  end: number
  text: string
  response: AiResponse
  hasEmbed: boolean
}

function buildCommandIndex(doc: PMNode, responses: AiResponse[]): ParagraphCommandInfo[] {
  const result: ParagraphCommandInfo[] = []

  // Map response.id -> response
  const byId = new Map<string, AiResponse>()
  // Map text -> responses (oldest first)
  const byText = new Map<string, AiResponse[]>()
  const ordered = [...responses].sort((a, b) => a.createdAt - b.createdAt)
  for (const r of ordered) {
    byId.set(r.id, r)
    if (r.status !== 'completed') continue
    const text = commandTextFromResponse(r)
    const arr = byText.get(text) ?? []
    arr.push(r)
    byText.set(text, arr)
  }

  const consumed = new Set<string>()

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

    if (!response) {
      const candidates = byText.get(text) ?? []
      for (const r of candidates) {
        if (!consumed.has(r.id)) {
          response = r
          consumed.add(r.id)
          break
        }
      }
    }

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
  doc: PMNode,
  responseId: string,
  responseText: string,
  responses: AiResponse[]
): { pos: number; end: number } | null {
  const idx = buildCommandIndex(doc, responses)
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

  if (status === 'streaming') {
    const dots = document.createElement('span')
    dots.className = 'monetCmdDots'
    dots.setAttribute('aria-label', 'respondendo')
    dots.textContent = '...'
    wrap.appendChild(dots)
    return wrap
  }

  // ↓ inserir / ↑ remover — only for completed responses
  if (status === 'completed') {
    const toggleBtn = document.createElement('button')
    toggleBtn.type = 'button'
    toggleBtn.className = 'monetCmdBtn ' + (entry.hasEmbed ? 'monetCmdBtnRemove' : 'monetCmdBtnInsert')
    toggleBtn.textContent = entry.hasEmbed ? '↑ remover' : '↓ inserir'
    toggleBtn.title = entry.hasEmbed
      ? 'remover bloco da nota'
      : 'inserir bloco com a resposta na nota'
    toggleBtn.addEventListener('mousedown', (e) => e.preventDefault())
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const responses = options.getResponses()
      if (entry.hasEmbed) {
        removeEmbedByCommandId(view, response.id)
      } else {
        // Re-resolve paragraph end at click time
        const found = findCommandParagraph(view.state.doc, response.id, entry.text, responses)
        const endPos = found ? found.end : entry.end
        insertEmbedAfter(view, endPos, response.id)
      }
    })
    wrap.appendChild(toggleBtn)
  }

  // × — para qualquer status finalizado (completed, interrupted, error)
  const delBtn = document.createElement('button')
  delBtn.type = 'button'
  delBtn.className = 'monetCmdBtn monetCmdBtnDelete'
  delBtn.textContent = '×'
  delBtn.title = 'remover linha do /comando, bloco e card no painel IA'
  delBtn.addEventListener('mousedown', (e) => e.preventDefault())
  delBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const responses = options.getResponses()
    const found = findCommandParagraph(view.state.doc, response.id, entry.text, responses)
    const paraPos = found ? found.pos : entry.pos
    const paraEnd = found ? found.end : entry.end
    deleteCommandLine(view, paraPos, paraEnd, response.id)
    options.onRemoveResponse(response.id)
  })
  wrap.appendChild(delBtn)

  return wrap
}

function buildDecorations(
  state: EditorState,
  pluginState: CommandPluginState,
  responses: AiResponse[],
  view: EditorView | null,
  options: CommandExtensionOptions
): DecorationSet {
  const decorations: Decoration[] = []
  const index = buildCommandIndex(state.doc, responses)
  const byPos = new Map<number, ParagraphCommandInfo>()
  for (const entry of index) byPos.set(entry.pos, entry)

  state.doc.descendants((node, pos) => {
    if (!isParagraph(node)) return true
    const text = paragraphText(node).trim()
    if (!text || !isPotentialCommandLine(text)) return false

    const persisted = pluginState.marks.get(pos)
    const indexEntry = byPos.get(pos)
    let className: string
    if (persisted) {
      switch (persisted.status) {
        case 'executed':
          className = 'monetCmdExecuted'
          break
        case 'invalid':
        case 'incomplete':
          className = 'monetCmdError'
          break
      }
    } else if (indexEntry && indexEntry.response.status !== 'error') {
      className = 'monetCmdExecuted'
    } else {
      className = 'monetCmdDraft'
    }

    const nodeEnd = pos + node.nodeSize
    decorations.push(
      Decoration.node(pos, nodeEnd, {
        class: className,
        spellcheck: 'false',
      })
    )

    if (indexEntry && view) {
      const widgetPos = nodeEnd - 1
      decorations.push(
        Decoration.widget(widgetPos, () => makeButtonsWidget(view, indexEntry, options), {
          side: 1,
          ignoreSelection: true,
          key: `cmdbtn-${indexEntry.response.id}-${indexEntry.hasEmbed ? '1' : '0'}-${indexEntry.response.status}`,
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
      onRemoveResponse: () => {},
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
                  next.set(meta.pos, { text: meta.text, status: meta.status })
                  marks = next
                  break
                }
                case 'syncExecuted': {
                  marks = syncExecutedMarks(tr.doc, marks, meta.texts)
                  break
                }
                case 'clearMarks': {
                  marks = new Map()
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
            return buildDecorations(state, pluginState, responses, viewRef.current, ext.options)
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

export function getCurrentCommandLine(state: EditorState): CommandLineInfo | null {
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
    status: getCommandLineStatus(text),
    paragraphPos,
    paragraphEnd,
  }
}
