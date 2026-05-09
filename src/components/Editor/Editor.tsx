import {
  acceptCompletion,
  autocompletion,
  completionStatus,
  type Completion,
  type CompletionContext,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, insertNewlineAndIndent } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorSelection, EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  placeholder,
  type DecorationSet,
} from '@codemirror/view'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { findClosestHeading, parseHeadings } from '../../lib/headingParser'
import { renderMarkdown } from '../../lib/markdown'
import { spellCheckEnforcer } from '../../lib/spellcheck'
import type { AiResponse, CommandExecutionRequest } from '../../types'
import { HeadingNavigator } from '../HeadingNavigator/HeadingNavigator'
import {
  buildCommandExecutionDraft,
  extractCommandId,
  getCommandLineStatus,
  getCommandSuggestions,
  getEmbeddedCommandIds,
  getToggleTitle,
  insertEmbeddedBlock,
  isPotentialCommandLine,
  parseCommandLine,
  removeEmbeddedBlock,
  type CommandLineStatus,
} from './commandParser'
import styles from './Editor.module.css'
import { detectActiveFormats, type ActiveFormat } from './formatting'
import { FormattingToolbar } from './FormattingToolbar'

export interface EditorProps {
  title: string
  onTitleChange: (value: string) => void
  tags: string[]
  onTagsChange: (tags: string[]) => void
  value: string
  onChange: (value: string) => void
  onCommand?: (request: CommandExecutionRequest) => Promise<boolean> | boolean
  onNavigateToCard?: (executionIndex: number) => void
  onDeleteCommand?: (commandId: string) => void
  executedCommandIds?: Set<string>
  commandLineToRemove?: { id: string; ts: number } | null
  responses?: AiResponse[]
  relatedContent?: ReactNode
}

const commandStatusTheme = EditorView.baseTheme({
  '.cm-editor': {
    height: '100%',
    backgroundColor: 'var(--bg-app, #0e0e10)',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '20px 32px 24px',
  },
  '.cm-content': {
    minHeight: '100%',
    color: 'var(--text-primary, #e8e8f0)',
    caretColor: 'var(--text-primary, #e8e8f0)',
  },
  '.cm-line': {
    padding: 0,
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--surface-1, #1e1e22)',
    border: '1px solid var(--border, #333340)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
  },
  '.cm-tooltip-autocomplete ul li': {
    color: 'var(--text-secondary, #a0a0b8)',
    padding: '8px 12px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'rgba(124, 106, 245, 0.16)',
    color: 'var(--text-primary, #e8e8f0)',
  },
  '.cm-completionDetail': {
    color: 'var(--text-muted, #606070)',
  },
  '.cm-commandDraft': {
    color: 'var(--accent, #7c6af5)',
  },
  '.cm-commandExecuted': {
    color: 'var(--accent-ai, #5dcaa5)',
    backgroundColor: 'rgba(93, 202, 165, 0.12)',
    borderLeft: '2px solid var(--accent-ai, #5dcaa5)',
    paddingLeft: '10px',
    cursor: 'pointer',
    position: 'relative',
  },
  '.cm-commandError': {
    color: '#ff8b8b',
    backgroundColor: 'rgba(239, 79, 79, 0.1)',
    borderLeft: '2px solid #ef4f4f',
    paddingLeft: '10px',
  },
  '.cm-cmdDelete': {
    fontSize: '15px',
    color: 'var(--text-muted, #606070)',
    cursor: 'pointer',
    opacity: '0.5',
    lineHeight: 'inherit',
    userSelect: 'none',
    padding: '0 2px',
  },
  '.cm-cmdDelete:hover': {
    color: '#ff6b6b',
    opacity: '1',
  },
  '.cm-cmdInsert': {
    fontSize: '11px',
    color: 'var(--accent-ai, #5dcaa5)',
    cursor: 'pointer',
    opacity: '0.7',
    lineHeight: 'inherit',
    userSelect: 'none',
    padding: '0 4px',
    fontFamily: 'system-ui, sans-serif',
  },
  '.cm-cmdInsert:hover': {
    opacity: '1',
    textDecoration: 'underline',
  },
  '.cm-cmdRemove': {
    fontSize: '11px',
    color: 'var(--text-muted, #606070)',
    cursor: 'pointer',
    opacity: '0.7',
    lineHeight: 'inherit',
    userSelect: 'none',
    padding: '0 4px',
    fontFamily: 'system-ui, sans-serif',
  },
  '.cm-cmdRemove:hover': {
    color: '#ff6b6b',
    opacity: '1',
  },
  '.cm-todo-check': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '13px',
    height: '13px',
    border: '1.5px solid var(--border, #333340)',
    borderRadius: '3px',
    verticalAlign: 'middle',
    marginRight: '3px',
    cursor: 'pointer',
    fontSize: '9px',
    lineHeight: '1',
    color: 'transparent',
    userSelect: 'none',
    flexShrink: '0',
  },
  '.cm-todo-check-done': {
    borderColor: 'var(--accent, #7c6af5)',
    backgroundColor: 'var(--accent, #7c6af5)',
    color: '#fff',
  },
  '.cm-todo-done-line': {
    color: 'var(--text-muted, #606070)',
    textDecoration: 'line-through',
  },
  '.cm-embedToggle': {
    background: 'var(--surface-1, #1e1e22)',
    border: '1px solid var(--border, #333340)',
    borderRadius: '6px',
    margin: '4px 0 4px 10px',
    overflow: 'hidden',
    position: 'relative',
    display: 'block',
    whiteSpace: 'normal',
  },
  '.cm-embedToggleHeader': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--text-secondary, #a0a0b8)',
    userSelect: 'none',
  },
  '.cm-embedToggleHeader:hover': {
    background: 'var(--surface-2, #26262c)',
  },
  '.cm-embedToggleChevron': {
    fontSize: '12px',
    color: 'var(--text-muted, #606070)',
    transition: 'transform 0.15s ease',
    display: 'inline-block',
  },
  '.cm-embedToggleChevronOpen': {
    transform: 'rotate(90deg)',
  },
  '.cm-embedToggleBody': {
    padding: '0 10px 8px 28px',
    fontSize: '13px',
    lineHeight: '1.55',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: 'var(--text-primary, #e8e8f0)',
  },
  '.cm-embedToggleBody p': { margin: '0.4em 0' },
  '.cm-embedToggleBody p:first-child': { marginTop: 0 },
  '.cm-embedToggleBody p:last-child': { marginBottom: 0 },
  '.cm-embedToggleBody h1, .cm-embedToggleBody h2, .cm-embedToggleBody h3': {
    fontWeight: 600,
    color: 'var(--text-primary, #e8e8f0)',
    lineHeight: '1.3',
    margin: '0.8em 0 0.3em',
  },
  '.cm-embedToggleBody h1': { fontSize: '1.2em' },
  '.cm-embedToggleBody h2': { fontSize: '1.1em' },
  '.cm-embedToggleBody h3': { fontSize: '1em' },
  '.cm-embedToggleBody strong': { fontWeight: 700 },
  '.cm-embedToggleBody em': { fontStyle: 'italic', color: 'var(--text-secondary, #a0a0b8)' },
  '.cm-embedToggleBody del': { color: 'var(--text-muted, #606070)', textDecoration: 'line-through' },
  '.cm-embedToggleBody code': {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '0.85em',
    background: 'var(--surface-2, #26262c)',
    borderRadius: '3px',
    padding: '0.1em 0.35em',
    color: 'var(--accent-ai, #5dcaa5)',
  },
  '.cm-embedToggleBody pre': {
    background: 'var(--surface-2, #26262c)',
    borderRadius: '6px',
    padding: '10px 12px',
    overflowX: 'auto',
    margin: '0.5em 0',
  },
  '.cm-embedToggleBody pre code': {
    background: 'none',
    padding: 0,
    fontSize: '12px',
    color: 'var(--text-primary, #e8e8f0)',
  },
  '.cm-embedToggleBody blockquote': {
    margin: '0.5em 0',
    padding: '0.3em 0.8em',
    borderLeft: '2px solid var(--accent-ai, #5dcaa5)',
    color: 'var(--text-secondary, #a0a0b8)',
  },
  '.cm-embedToggleBody blockquote p': { margin: '0' },
  '.cm-embedToggleBody ul, .cm-embedToggleBody ol': {
    margin: '0.3em 0',
    paddingLeft: '1.4em',
  },
  '.cm-embedToggleBody li': { margin: '0.15em 0' },
  '.cm-embedToggleBody li p': { margin: '0' },
  '.cm-embedToggleBody a': { color: 'var(--accent, #7c6af5)', textDecoration: 'none' },
  '.cm-embedToggleBody a:hover': { textDecoration: 'underline' },
  '.cm-embedToggleBody hr': {
    border: 'none',
    borderTop: '1px solid var(--border, #333340)',
    margin: '0.8em 0',
  },
  '.cm-embedToggleBody table': {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '0.5em 0',
    fontSize: '12px',
  },
  '.cm-embedToggleBody th, .cm-embedToggleBody td': {
    border: '1px solid var(--border, #333340)',
    padding: '4px 8px',
    textAlign: 'left',
  },
  '.cm-embedToggleBody th': {
    background: 'var(--surface-2, #26262c)',
    fontWeight: 600,
  },
  '.cm-cmdActionContainer': {
    display: 'inline-flex',
    gap: '8px',
    alignItems: 'center',
    flex: '0 0 auto',
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  },
  '.cm-commandActionLine': {
    display: 'flex',
    gap: '12px',
    alignItems: 'start',
  },
  '.cm-commandText': {
    flex: '1 1 0',
    minWidth: '0',
    overflowWrap: 'anywhere',
  },
  '.cm-commandActionLine > .cm-widgetBuffer': {
    width: '0',
    minWidth: '0',
    flex: '0 0 0',
    overflow: 'hidden',
  },
  '.cm-embedLoading': {
    fontStyle: 'italic',
    color: 'var(--text-muted, #606070)',
  },
  '.cm-embedError': {
    fontStyle: 'italic',
    color: 'var(--text-muted, #606070)',
  },
})

class TodoCheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) { super() }
  eq(other: WidgetType) {
    return other instanceof TodoCheckboxWidget && this.checked === other.checked
  }
  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span')
    span.className = `cm-todo-check${this.checked ? ' cm-todo-check-done' : ''}`
    span.textContent = this.checked ? 'x' : ' '
    span.setAttribute('aria-hidden', 'true')
    span.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false)
      const line = view.state.doc.lineAt(pos)
      const m = line.text.match(/^- \[([ x])\] /)
      if (!m) return
      const charPos = line.from + 3
      view.dispatch({ changes: { from: charPos, to: charPos + 1, insert: m[1] === 'x' ? ' ' : 'x' } })
    })
    return span
  }
  ignoreEvent() { return false }
}

function buildTodoDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    const m = line.text.match(/^- \[([ x])\] /)
    if (!m) continue
    const checked = m[1] === 'x'
    if (checked) {
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-todo-done-line' }))
    }
    builder.add(
      line.from + 2,
      line.from + 5,
      Decoration.replace({ widget: new TodoCheckboxWidget(checked) })
    )
  }
  return builder.finish()
}

const todoDecorationsField = StateField.define<DecorationSet>({
  create: (state) => buildTodoDecorations(state),
  update: (deco, tr) => tr.docChanged ? buildTodoDecorations(tr.state) : deco,
  provide: (f) => EditorView.decorations.from(f),
})

const MARKER_RE = / <!--monet:[a-zA-Z0-9_-]+-->/g
const MARKER_ID_RE = /<!--monet:([a-zA-Z0-9_-]+)-->/

const EMBED_START_RE = /<!--monet-embed:([a-zA-Z0-9_-]+)-->/

// ── Toggle block (embedded AI response) ──────────────────

const embedRenderCache = new Map<string, string>()

const toggleOpenEffect = StateEffect.define<{ commandId: string; open: boolean }>()

const toggleOpenState = StateField.define<Map<string, boolean>>({
  create: () => new Map(),
  update: (value, tr) => {
    let next = value
    for (const effect of tr.effects) {
      if (effect.is(toggleOpenEffect)) {
        if (next === value) next = new Map(value)
        next.set(effect.value.commandId, effect.value.open)
      }
    }
    return next
  },
})

class ToggleBlockWidget extends WidgetType {
  constructor(
    readonly commandId: string,
    readonly title: string,
    readonly body: string,
    readonly open: boolean,
    readonly getView: () => EditorView | null
  ) { super() }

  eq(other: WidgetType) {
    return other instanceof ToggleBlockWidget &&
      this.commandId === other.commandId &&
      this.title === other.title &&
      this.body === other.body &&
      this.open === other.open
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-embedToggle'

    const header = document.createElement('div')
    header.className = 'cm-embedToggleHeader'

    const chevron = document.createElement('span')
    chevron.className = `cm-embedToggleChevron${this.open ? ' cm-embedToggleChevronOpen' : ''}`
    chevron.textContent = '›'
    chevron.setAttribute('aria-hidden', 'true')

    const title = document.createElement('span')
    title.textContent = this.title

    header.appendChild(chevron)
    header.appendChild(title)

    header.addEventListener('click', () => {
      const view = this.getView()
      if (view) {
        view.dispatch({ effects: toggleOpenEffect.of({ commandId: this.commandId, open: !this.open }) })
      }
    })

    wrapper.appendChild(header)

    if (this.open) {
      const bodyDiv = document.createElement('div')
      bodyDiv.className = 'cm-embedToggleBody'
      const cached = embedRenderCache.get(this.body)
      if (cached !== undefined) {
        bodyDiv.innerHTML = cached
      } else {
        bodyDiv.innerHTML = '<em class="cm-embedLoading">carregando...</em>'
        renderMarkdown(this.body).then((html) => {
          embedRenderCache.set(this.body, html)
          bodyDiv.innerHTML = html
        }).catch(() => {
          bodyDiv.innerHTML = '<em class="cm-embedError">erro ao renderizar</em>'
        })
      }
      wrapper.appendChild(bodyDiv)
    }

    return wrapper
  }

  ignoreEvent() { return false }
}

interface EmbedSpec {
  from: number
  to: number
  deco: Decoration
}

function buildEmbedDecorations(
  state: EditorState,
  openMap: Map<string, boolean>,
  getView: () => EditorView | null
): DecorationSet {
  const text = state.doc.toString()
  const specs: EmbedSpec[] = []

  // 1. Ocultar os blocos embed no texto (invisíveis, não-editáveis)
  const startRe = new RegExp(EMBED_START_RE.source, 'g')
  let startMatch: RegExpExecArray | null
  while ((startMatch = startRe.exec(text)) !== null) {
    const cmdId = startMatch[1]
    const endMarker = `<!--monet-embed-end:${cmdId}-->`
    const endIdx = text.indexOf(endMarker, startMatch.index + startMatch[0].length)
    if (endIdx === -1) continue
    specs.push({
      from: startMatch.index,
      to: endIdx + endMarker.length,
      deco: Decoration.replace({}),
    })
  }

  // 2. Inserir widgets externos abaixo da linha de comando correspondente
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    const cmdId = extractCommandId(line.text)
    if (!cmdId) continue

    const blockStart = text.indexOf(`<!--monet-embed:${cmdId}-->`)
    if (blockStart === -1) continue
    const blockEndMarker = `<!--monet-embed-end:${cmdId}-->`
    const blockEnd = text.indexOf(blockEndMarker, blockStart)
    if (blockEnd === -1) continue

    const content = text.slice(blockStart + `<!--monet-embed:${cmdId}-->`.length, blockEnd)
    const lines = content.split('\n')
    const bodyLines = lines.map((l) => l.replace(/^> /, ''))
    const bodyText = bodyLines.join('\n').trim()
    const titleMatch = bodyText.match(/^\*\*([^*]+)\*\*/)
    const title = titleMatch ? titleMatch[1] : 'Resposta gerada pela IA'
    const body = bodyText.replace(/^\*\*[^*]+\*\*\n\n?/, '')
    const isOpen = openMap.get(cmdId) ?? false

    specs.push({
      from: line.to,
      to: line.to,
      deco: Decoration.widget({
        widget: new ToggleBlockWidget(cmdId, title, body, isOpen, getView),
        block: true,
        side: 1,
      }),
    })
  }

  // Sort by from position; widget side=1 must come after replace at same position
  specs.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from
    const aSide = (a.deco as any).startSide ?? 0
    const bSide = (b.deco as any).startSide ?? 0
    return aSide - bSide
  })

  const builder = new RangeSetBuilder<Decoration>()
  for (const s of specs) {
    builder.add(s.from, s.to, s.deco)
  }
  return builder.finish()
}

// ── Command markers (delete + insert/remove buttons) ─────

function createMarkerDecorations(
  getView: () => EditorView | null,
  getOnDelete: () => ((id: string) => void) | undefined,
  getOnInsert: () => ((id: string) => void) | undefined,
  getOnRemove: () => ((id: string) => void) | undefined,
  getCompletedIds: () => Set<string>,
): StateField<DecorationSet> {

  class CommandActionsWidget extends WidgetType {
    constructor(readonly commandId: string, readonly hasEmbed: boolean, readonly canInsert: boolean) { super() }

    toDOM() {
      const container = document.createElement('span')
      container.className = 'cm-cmdActionContainer'

      if (this.hasEmbed) {
        const removeBtn = document.createElement('span')
        removeBtn.className = 'cm-cmdRemove'
        removeBtn.textContent = '↑ remover'
        removeBtn.title = 'remover bloco da nota'
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          getOnRemove()?.(this.commandId)
        })
        container.appendChild(removeBtn)
      } else if (this.canInsert) {
        const insertBtn = document.createElement('span')
        insertBtn.className = 'cm-cmdInsert'
        insertBtn.textContent = '↓ inserir'
        insertBtn.title = 'inserir resposta na nota'
        insertBtn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          getOnInsert()?.(this.commandId)
        })
        container.appendChild(insertBtn)
      }

      const deleteBtn = document.createElement('span')
      deleteBtn.className = 'cm-cmdDelete'
      deleteBtn.textContent = '×'
      deleteBtn.title = 'apagar comando e resposta'
      deleteBtn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const view = getView()
        if (view) {
          let newText = view.state.doc.toString()
          // Remove embed block first
          newText = removeEmbeddedBlock(newText, this.commandId)
          // Remove command line
          const lines = newText.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`<!--monet:${this.commandId}-->`)) {
              lines.splice(i, 1)
              break
            }
          }
          newText = lines.join('\n')
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newText } })
        }
        getOnDelete()?.(this.commandId)
      })
      container.appendChild(deleteBtn)

      return container
    }

    eq(other: CommandActionsWidget) {
      return other.commandId === this.commandId && other.hasEmbed === this.hasEmbed && other.canInsert === this.canInsert
    }
  }

  function build(state: EditorState): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const text = state.doc.toString()
    const embeddedIds = getEmbeddedCommandIds(text)
    const completedIds = getCompletedIds()
    for (let i = 1; i <= state.doc.lines; i++) {
      const line = state.doc.line(i)
      MARKER_RE.lastIndex = 0
      const match = MARKER_RE.exec(line.text)
      if (!match) continue

      const cmdId = MARKER_ID_RE.exec(match[0])?.[1] ?? ''
      const hasEmbed = embeddedIds.has(cmdId)
      const canInsert = completedIds.has(cmdId)

      builder.add(line.from, line.from, Decoration.line({ class: 'cm-commandActionLine' }))
      if (match.index > 0) {
        builder.add(
          line.from,
          line.from + match.index,
          Decoration.mark({ class: 'cm-commandText' })
        )
      }
      builder.add(
        line.from + match.index,
        line.from + match.index + match[0].length,
        Decoration.replace({ widget: new CommandActionsWidget(cmdId, hasEmbed, canInsert) })
      )
    }
    return builder.finish()
  }

  return StateField.define<DecorationSet>({
    create: (state) => build(state),
    update: (deco, tr) => (
      tr.docChanged || tr.effects.some((effect) => effect.is(refreshCommandDecorations))
        ? build(tr.state)
        : deco
    ),
    provide: (f) => EditorView.decorations.from(f),
  })
}

const refreshCommandDecorations = StateEffect.define<null>()

function createCommandDecorations(
  getStatusByLine: () => Map<number, CommandLineStatus>
): StateField<DecorationSet> {

  function build(state: EditorState): DecorationSet {
    const statusByLine = getStatusByLine()
    const builder = new RangeSetBuilder<Decoration>()
    for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
      const line = state.doc.line(lineNumber)
      if (!isPotentialCommandLine(line.text)) continue
      const status = statusByLine.get(line.from) ?? getCommandLineStatus(line.text)
      const className =
        status === 'executed'
          ? 'cm-commandExecuted'
          : status === 'invalid' || status === 'incomplete'
            ? 'cm-commandError'
            : status === 'draft' || status === 'valid'
              ? 'cm-commandDraft'
              : null
      if (className) {
        builder.add(line.from, line.from, Decoration.line({ class: className }))
      }
    }
    return builder.finish()
  }

  return StateField.define<DecorationSet>({
    create(state) {
      return build(state)
    },
    update(decorations, transaction) {
      if (
        !transaction.docChanged &&
        !transaction.effects.some((effect) => effect.is(refreshCommandDecorations))
      ) {
        return decorations
      }
      return build(transaction.state)
    },
    provide(field) {
      return EditorView.decorations.from(field)
    },
  })
}

function commandCompletionSource(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos)
  const lineBeforeCursor = line.text.slice(0, context.pos - line.from)
  if (!/^\s*\/[^\s]*$/.test(lineBeforeCursor)) {
    return null
  }
  const from = line.from + lineBeforeCursor.search(/\//)
  const suggestions = getCommandSuggestions(lineBeforeCursor.trim()).map<Completion>((name) => ({
    label: name,
    type: 'keyword',
  }))
  return {
    from,
    options: suggestions,
    validFor: /^\/[a-z]*$/i,
  }
}


export function Editor({
  title,
  onTitleChange,
  tags,
  onTagsChange,
  value,
  onChange,
  onCommand,
  onNavigateToCard,
  onDeleteCommand,
  executedCommandIds,
  commandLineToRemove,
  responses,
  relatedContent,
}: EditorProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [toolbarState, setToolbarState] = useState<{
    top: number
    left: number
    activeFormats: Set<ActiveFormat>
  } | null>(null)
  const [activeOffset, setActiveOffset] = useState<number | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const commandStatusRef = useRef<Map<number, CommandLineStatus>>(new Map())
  const initialValueRef = useRef(value)
  const executedCommandIdsRef = useRef(executedCommandIds ?? new Set<string>())
  executedCommandIdsRef.current = executedCommandIds ?? new Set<string>()
  const onCommandRef = useRef(onCommand)
  const onDeleteCommandRef = useRef(onDeleteCommand)
  onDeleteCommandRef.current = onDeleteCommand
  const onChangeRef = useRef(onChange)
  const onNavigateToCardRef = useRef(onNavigateToCard)
  const setToolbarRef = useRef(setToolbarState)
  onCommandRef.current = onCommand
  onChangeRef.current = onChange
  onNavigateToCardRef.current = onNavigateToCard
  setToolbarRef.current = setToolbarState

  const responsesRef = useRef(responses)
  responsesRef.current = responses

  const syncCommandUi = useCallback(() => {
    const view = viewRef.current
    if (!view) return

    const map = commandStatusRef.current
    map.clear()
    const execIds = executedCommandIdsRef.current
    for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber++) {
      const line = view.state.doc.line(lineNumber)
      if (!isPotentialCommandLine(line.text)) continue
      const cmdId = extractCommandId(line.text)
      map.set(
        line.from,
        cmdId && execIds.has(cmdId) ? 'executed' : getCommandLineStatus(line.text)
      )
    }

    view.dispatch({ effects: refreshCommandDecorations.of(null) })
  }, [])

  const handleInsert = useCallback((commandId: string) => {
    const view = viewRef.current
    if (!view) return
    const response = responsesRef.current?.find((r) => r.commandId === commandId || r.id === commandId)
    if (!response) return
    const newContent = insertEmbeddedBlock(
      view.state.doc.toString(),
      commandId,
      getToggleTitle(response.command),
      response.response
    )
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newContent } })
    // Trigger decorations refresh so the insert button becomes remove
    view.dispatch({ effects: refreshCommandDecorations.of(null) })
  }, [])

  const handleRemove = useCallback((commandId: string) => {
    const view = viewRef.current
    if (!view) return
    const newContent = removeEmbeddedBlock(view.state.doc.toString(), commandId)
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newContent } })
    view.dispatch({ effects: refreshCommandDecorations.of(null) })
  }, [])

  const handleNavigateToHeading = useCallback((offset: number) => {
    const view = viewRef.current
    if (!view) return
    setActiveOffset(offset)
    view.dispatch({
      effects: EditorView.scrollIntoView(offset, { y: 'start' }),
    })
  }, [])

  const handleInsertRef = useRef(handleInsert)
  const handleRemoveRef = useRef(handleRemove)
  handleInsertRef.current = handleInsert
  handleRemoveRef.current = handleRemove

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return
    const syncListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString())
        const map = commandStatusRef.current

        // Build cmdId → status from old state so position shifts don't lose 'executed' status
        const idToStatus = new Map<string, CommandLineStatus>()
        for (let i = 1; i <= update.startState.doc.lines; i++) {
          const oldLine = update.startState.doc.line(i)
          const status = map.get(oldLine.from)
          if (!status) continue
          const cmdId = extractCommandId(oldLine.text)
          if (cmdId) idToStatus.set(cmdId, status)
        }

        const preserved = new Map<number, CommandLineStatus>()
        for (let lineNumber = 1; lineNumber <= update.state.doc.lines; lineNumber++) {
          const line = update.state.doc.line(lineNumber)
          if (!isPotentialCommandLine(line.text)) continue
          const cmdId = extractCommandId(line.text)
          const prevStatus = (cmdId && idToStatus.get(cmdId)) ?? map.get(line.from)
          preserved.set(
            line.from,
            prevStatus === 'executed' ? 'executed' : getCommandLineStatus(line.text)
          )
        }
        map.clear()
        for (const [from, status] of preserved) map.set(from, status)
      }

      if (update.selectionSet || update.docChanged || update.viewportChanged) {
        const sel = update.state.selection.main
        if (sel.empty) {
          setToolbarRef.current(null)
        } else {
          const fromCoords = update.view.coordsAtPos(sel.from)
          const toCoords = update.view.coordsAtPos(sel.to)
          if (!fromCoords) {
            setToolbarRef.current(null)
          } else {
            const midX = toCoords
              ? (fromCoords.left + toCoords.left) / 2
              : fromCoords.left
            setToolbarRef.current({
              top: fromCoords.top,
              left: midX,
              activeFormats: detectActiveFormats(update.view),
            })
          }
        }

        if (update.viewportChanged || update.docChanged) {
          const content = update.state.doc.toString()
          const headings = parseHeadings(content)
          const viewportTop = update.view.viewport.from
          const closest = findClosestHeading(headings, viewportTop)
          setActiveOffset(closest?.offset ?? null)
        }
      }
    })

    const runCommand = async (view: EditorView) => {
      const selection = view.state.selection.main
      const draft = buildCommandExecutionDraft(
        view.state.doc.toString(),
        selection.from,
        selection.to
      )
      if (!draft) {
        insertNewlineAndIndent(view)
        return
      }

      view.dispatch({
        changes: { from: draft.lineEnd, to: draft.lineEnd, insert: '\n' },
        selection: EditorSelection.cursor(draft.lineEnd + 1),
      })

      const commandId = nanoid()
      const allowed = await onCommandRef.current?.({
        cmd: draft.cmd,
        query: draft.query,
        commandId,
      })
      if (allowed) {
        commandStatusRef.current.set(draft.lineStart, 'executed')
        const marker = ` <!--monet:${commandId}-->`
        view.dispatch({
          changes: { from: draft.lineEnd, to: draft.lineEnd, insert: marker },
          effects: refreshCommandDecorations.of(null),
        })
      } else {
        commandStatusRef.current.set(
          draft.lineStart,
          getCommandLineStatus(view.state.doc.lineAt(draft.lineStart).text)
        )
        view.dispatch({ effects: refreshCommandDecorations.of(null) })
      }
    }

    const shouldHandleEnterAsCommand = (view: EditorView) => {
      if (!onCommandRef.current) return false
      const selection = view.state.selection.main
      if (!selection.empty) return false
      const line = view.state.doc.lineAt(selection.from)
      if (selection.from !== line.to) return false
      const parsed = parseCommandLine(line.text)
      if (!parsed?.definition) return false
      if (parsed.definition.takesQuery && parsed.query.length === 0) return false
      return true
    }

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          {
            key: 'Enter',
            run(view) {
              if (!shouldHandleEnterAsCommand(view)) return false
              void runCommand(view)
              return true
            },
          },
          {
            key: 'Tab',
            run(view) {
              if (completionStatus(view.state) !== 'active') {
                return false
              }
              return acceptCompletion(view)
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        autocompletion({
          override: [commandCompletionSource],
          activateOnTyping: true,
          icons: false,
          defaultKeymap: true,
        }),
        EditorView.lineWrapping,
        placeholder('Anote a impressão do momento...'),
        commandStatusTheme,
        EditorView.contentAttributes.of({ spellcheck: 'true' }),
        spellCheckEnforcer,
        todoDecorationsField,
        toggleOpenState,
        createMarkerDecorations(
          () => viewRef.current,
          () => onDeleteCommandRef.current,
          () => handleInsertRef.current,
          () => handleRemoveRef.current,
          () => new Set(responsesRef.current?.filter((r) => r.status === 'completed').map((r) => r.commandId ?? r.id) ?? [])
        ),
        StateField.define<DecorationSet>({
          create(state) {
            return buildEmbedDecorations(state, new Map(), () => viewRef.current)
          },
          update(deco, tr) {
            if (!tr.docChanged && !tr.effects.some((e) => e.is(toggleOpenEffect))) {
              return deco
            }
            return buildEmbedDecorations(tr.state, tr.state.field(toggleOpenState), () => viewRef.current)
          },
          provide: (f) => EditorView.decorations.from(f),
        }),
        createCommandDecorations(() => commandStatusRef.current),
        syncListener,
        EditorView.domEventHandlers({
          click(event, view) {
            const pos = view.posAtCoords(event)
            if (pos == null) return false
            const line = view.state.doc.lineAt(pos)
            const status = commandStatusRef.current.get(line.from)
            if (status !== 'executed') return false
            let execIndex = 0
            for (let i = 1; i < line.number; i++) {
              const prevLine = view.state.doc.line(i)
              if (commandStatusRef.current.get(prevLine.from) === 'executed') {
                execIndex++
              }
            }
            onNavigateToCardRef.current?.(execIndex)
            return true
          },
        }),
      ],
    })
    const execIds = executedCommandIdsRef.current
    for (let i = 1; i <= state.doc.lines; i++) {
      const line = state.doc.line(i)
      const cmdId = extractCommandId(line.text)
      if (cmdId && execIds.has(cmdId)) {
        commandStatusRef.current.set(line.from, 'executed')
      }
    }
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    const selection = view.state.selection.main
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: EditorSelection.single(
        Math.min(selection.from, value.length),
        Math.min(selection.to, value.length)
      ),
    })
    syncCommandUi()
  }, [value, syncCommandUi])

  useEffect(() => {
    syncCommandUi()
  }, [responses, executedCommandIds, syncCommandUi])

  useEffect(() => {
    if (!commandLineToRemove) return
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    let newText = removeEmbeddedBlock(current, commandLineToRemove.id)
    const lines = newText.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`<!--monet:${commandLineToRemove.id}-->`)) {
        lines.splice(i, 1)
        break
      }
    }
    newText = lines.join('\n')
    if (newText !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: newText } })
    }
  }, [commandLineToRemove])

  function commitTag() {
    const clean = draft.trim().replace(/^#/, '')
    if (clean && !tags.includes(clean)) {
      onTagsChange([...tags, clean])
    }
    setDraft('')
    setAdding(false)
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className={styles.editor}>
      <input
        className={styles.title}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="título da anotação"
      />
      <div className={styles.tagsRow}>
        <button
          className={styles.tagAdd}
          onClick={() => setAdding(true)}
          aria-label="adicionar tag"
          type="button"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <span>tag</span>
        </button>
        {tags.map((t) => (
          <span key={t} className={styles.tag}>
            #{t}
            <button
              className={styles.tagRemove}
              onClick={() => removeTag(t)}
              aria-label={`remover tag ${t}`}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        {adding && (
          <input
            className={styles.tagInput}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTag}
            onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') commitTag()
              if (e.key === 'Escape') {
                setDraft('')
                setAdding(false)
              }
            }}
            placeholder="nova tag"
          />
        )}
      </div>
      <div className={styles.bodyWrap}>
        <div className={styles.body}>
          <div ref={hostRef} />
        </div>
        <HeadingNavigator
          content={value}
          activeOffset={activeOffset}
          onNavigate={handleNavigateToHeading}
        />
      </div>
      {relatedContent}
      {toolbarState && viewRef.current && (
        <FormattingToolbar
          view={viewRef.current}
          activeFormats={toolbarState.activeFormats}
          position={{ top: toolbarState.top, left: toolbarState.left }}
        />
      )}
    </div>
  )
}
