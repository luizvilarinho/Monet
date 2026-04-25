import {
  autocompletion,
  acceptCompletion,
  completionStatus,
  type Completion,
  type CompletionContext,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, insertNewlineAndIndent } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { EditorSelection, EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  placeholder,
  type DecorationSet,
} from '@codemirror/view'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import styles from './Editor.module.css'
import {
  buildCommandExecutionDraft,
  getCommandLineStatus,
  getCommandSuggestions,
  isPotentialCommandLine,
  parseCommandLine,
  type CommandLineStatus,
} from './commandParser'
import { detectActiveFormats, type ActiveFormat } from './formatting'
import { FormattingToolbar } from './FormattingToolbar'
import type { CommandExecutionRequest } from '../../types'

export interface EditorProps {
  title: string
  onTitleChange: (value: string) => void
  tags: string[]
  onTagsChange: (tags: string[]) => void
  value: string
  onChange: (value: string) => void
  onCommand?: (request: CommandExecutionRequest) => Promise<boolean> | boolean
  onNavigateToCard?: (executionIndex: number) => void
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
  },
  '.cm-commandError': {
    color: '#ff8b8b',
    backgroundColor: 'rgba(239, 79, 79, 0.1)',
    borderLeft: '2px solid #ef4f4f',
    paddingLeft: '10px',
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
    // replace the [ ] or [x] chars (positions 2-4 in line)
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
}: EditorProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [toolbarState, setToolbarState] = useState<{
    top: number
    left: number
    activeFormats: Set<ActiveFormat>
  } | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const commandStatusRef = useRef<Map<number, CommandLineStatus>>(new Map())
  const initialValueRef = useRef(value)
  const onCommandRef = useRef(onCommand)
  const onChangeRef = useRef(onChange)
  const onNavigateToCardRef = useRef(onNavigateToCard)
  const setToolbarRef = useRef(setToolbarState)
  onCommandRef.current = onCommand
  onChangeRef.current = onChange
  onNavigateToCardRef.current = onNavigateToCard
  setToolbarRef.current = setToolbarState

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return
    const syncListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString())
        const map = commandStatusRef.current
        const preserved = new Map<number, CommandLineStatus>()
        for (let lineNumber = 1; lineNumber <= update.state.doc.lines; lineNumber++) {
          const line = update.state.doc.line(lineNumber)
          if (!isPotentialCommandLine(line.text)) continue
          const previous = map.get(line.from)
          preserved.set(
            line.from,
            previous === 'executed' ? 'executed' : getCommandLineStatus(line.text)
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
      const allowed = await onCommandRef.current?.({
        cmd: draft.cmd,
        query: draft.query,
      })
      if (allowed) {
        commandStatusRef.current.set(draft.lineStart, 'executed')
      } else {
        commandStatusRef.current.set(
          draft.lineStart,
          getCommandLineStatus(view.state.doc.lineAt(draft.lineStart).text)
        )
      }
      view.dispatch({
        changes: { from: draft.lineEnd, to: draft.lineEnd, insert: '\n' },
        selection: EditorSelection.cursor(draft.nextSelection),
        effects: refreshCommandDecorations.of(null),
      })
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
        todoDecorationsField,
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
    const map = commandStatusRef.current
    map.clear()
    for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber++) {
      const line = view.state.doc.line(lineNumber)
      if (!isPotentialCommandLine(line.text)) continue
      map.set(line.from, getCommandLineStatus(line.text))
    }
    view.dispatch({ effects: refreshCommandDecorations.of(null) })
  }, [value])

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
      <div className={styles.body} ref={hostRef} />
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
