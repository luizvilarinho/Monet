import { EditorContent, useEditor } from '@tiptap/react'
import { Placeholder } from '@tiptap/extensions'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import Code from '@tiptap/extension-code'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { nanoid } from 'nanoid'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { findClosestHeading, parseHeadings, type Heading } from '../../lib/headingParser'
import { attachSpellCheckEnforcer } from '../../lib/spellcheck'
import { HeadingNavigator } from '../HeadingNavigator/HeadingNavigator'
import styles from './Editor.module.css'
import { FormattingToolbar } from './FormattingToolbar'
import { CommandAutocomplete, type AutocompleteState } from './CommandAutocomplete'
import {
  CommandExtension,
  commandPluginKey,
  getCurrentCommandLine,
} from './CommandExtension'
import { EmbedBlock } from './EmbedBlock'
import { ToggleBlock } from './ToggleBlock'
import { EditorResponsesProvider } from './EditorResponsesContext'
import { EditorNotesProvider } from './EditorNotesContext'
import { LinkedNoteBlock } from './LinkedNoteBlock'
import { NotePicker } from './NotePicker'
import { SearchInNote } from './SearchInNote'
import { getCommandSuggestions } from './commandParser'
import type { AiResponse, CommandExecutionRequest, Note } from '../../types'

export interface EditorProps {
  notebookName?: string
  title: string
  onTitleChange: (value: string) => void
  tags: string[]
  onTagsChange: (tags: string[]) => void
  value: string
  onChange: (value: string) => void
  onCommand?: (request: CommandExecutionRequest) => Promise<boolean> | boolean
  executedCommandTexts?: Set<string>
  responses?: AiResponse[]
  onRemoveResponse?: (id: string) => void
  relatedContent?: ReactNode
  notebookNotes?: Note[]
  onNavigateToNote?: (noteId: string) => void
}

function getMarkdown(editor: TiptapEditor): string {
  const storage = editor.storage as unknown as { markdown?: { getMarkdown(): string } }
  return storage.markdown?.getMarkdown() ?? editor.getText()
}

function findHeadingDomElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll('h1, h2, h3')) as HTMLElement[]
}

const HIDDEN_AUTOCOMPLETE: AutocompleteState = {
  visible: false,
  filter: '',
  suggestions: [],
  selectedIdx: 0,
  top: 0,
  left: 0,
}

// Custom inline-code mark — força serialização com um único backtick
// (defaultMarkdownSerializer.marks.code usa `backticksFor` que adiciona mais
// crases apenas quando o texto contém crases; texto comum vira `text`)
const InlineCode = Code.extend({
  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.marks.code,
        parse: {},
      },
    }
  },
})

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('failed to read file'))
    reader.readAsDataURL(file)
  })
}

function extractImageFile(items: ArrayLike<DataTransferItem> | null | undefined): File | null {
  if (!items) return null
  const arr = Array.from(items)
  for (const item of arr) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) return f
    }
  }
  return null
}

export function Editor({
  notebookName,
  title,
  onTitleChange,
  tags,
  onTagsChange,
  value,
  onChange,
  onCommand,
  executedCommandTexts,
  responses,
  onRemoveResponse,
  relatedContent,
  notebookNotes = [],
  onNavigateToNote,
}: EditorProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [activeOffset, setActiveOffset] = useState<number | null>(null)
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(HIDDEN_AUTOCOMPLETE)
  const [searchVisible, setSearchVisible] = useState(false)
  const [notePickerVisible, setNotePickerVisible] = useState(false)
  const [notePickerPos, setNotePickerPos] = useState<{ top: number; left: number } | undefined>(undefined)
  const notePickerInsertPosRef = useRef<number>(0)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onCommandRef = useRef(onCommand)
  onCommandRef.current = onCommand
  const autocompleteRef = useRef(autocomplete)
  autocompleteRef.current = autocomplete
  const dismissedFingerprintRef = useRef<string | null>(null)
  const acceptSuggestionRef = useRef<(suggestion: string) => void>(() => {})

  const responsesRef = useRef<AiResponse[]>(responses ?? [])
  responsesRef.current = responses ?? []
  const onRemoveResponseRef = useRef(onRemoveResponse)
  onRemoveResponseRef.current = onRemoveResponse
  const onNavigateToNoteRef = useRef(onNavigateToNote)
  onNavigateToNoteRef.current = onNavigateToNote

  const contextValue = useMemo(
    () => ({ responses: responses ?? [] }),
    [responses]
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: true, autolink: false },
        code: false,
      }),
      InlineCode,
      TaskList,
      TaskItem.configure({ nested: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder: 'Capture your thoughts...',
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-',
        linkify: false,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      EmbedBlock,
      ToggleBlock,
      LinkedNoteBlock,
      CommandExtension.configure({
        getResponses: () => responsesRef.current,
        onRemoveResponse: (id) => {
          onRemoveResponseRef.current?.(id)
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: styles.proseEditor,
        spellcheck: 'true',
      },
      handlePaste: (view, event) => {
        const file = extractImageFile(event.clipboardData?.items)
        if (!file) return false
        event.preventDefault()
        fileToDataUrl(file)
          .then((dataUrl) => {
            const imageType = view.state.schema.nodes['image']
            if (!imageType) return
            const node = imageType.create({ src: dataUrl })
            view.dispatch(view.state.tr.replaceSelectionWith(node))
          })
          .catch((err) => console.error('paste image failed', err))
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const file = extractImageFile(event.dataTransfer?.items)
        if (!file) return false
        event.preventDefault()
        const coords = { left: event.clientX, top: event.clientY }
        const pos = view.posAtCoords(coords)
        fileToDataUrl(file)
          .then((dataUrl) => {
            const imageType = view.state.schema.nodes['image']
            if (!imageType) return
            const node = imageType.create({ src: dataUrl })
            const insertPos = pos?.pos ?? view.state.selection.from
            view.dispatch(view.state.tr.insert(insertPos, node))
          })
          .catch((err) => console.error('drop image failed', err))
        return true
      },
      handleKeyDown: (view, event) => {
        const ac = autocompleteRef.current
        if (ac.visible && ac.suggestions.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setAutocomplete((prev) =>
              prev.visible
                ? { ...prev, selectedIdx: (prev.selectedIdx + 1) % prev.suggestions.length }
                : prev
            )
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setAutocomplete((prev) =>
              prev.visible
                ? {
                    ...prev,
                    selectedIdx:
                      (prev.selectedIdx - 1 + prev.suggestions.length) %
                      prev.suggestions.length,
                  }
                : prev
            )
            return true
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            const info = getCurrentCommandLine(view.state)
            dismissedFingerprintRef.current = info?.text ?? null
            setAutocomplete(HIDDEN_AUTOCOMPLETE)
            return true
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            const selected = ac.suggestions[ac.selectedIdx]
            if (selected) {
              acceptSuggestionRef.current(selected)
            }
            return true
          }
        }

        if (event.key === '[') {
          const { from } = view.state.selection
          if (from > 0) {
            const textBefore = view.state.doc.textBetween(Math.max(0, from - 1), from)
            if (textBefore === '[') {
              event.preventDefault()
              const deleteTr = view.state.tr.delete(from - 1, from)
              view.dispatch(deleteTr)
              notePickerInsertPosRef.current = from - 1
              const coords = view.coordsAtPos(from - 1)
              setNotePickerPos({ top: coords.bottom + 4, left: coords.left })
              setNotePickerVisible(true)
              return true
            }
          }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
          const info = getCurrentCommandLine(view.state)
          if (!info) return false
          const { selection } = view.state
          const $from = selection.$from
          const atEnd = $from.parentOffset === $from.parent.content.size
          if (!atEnd) return false

          if (info.status === 'idle') return false

          const pluginState = commandPluginKey.getState(view.state)
          const existingMark = pluginState?.marks.get(info.paragraphPos)
          if (existingMark?.status === 'executed') {
            return false
          }

          if (info.status === 'valid') {
            view.dispatch(
              view.state.tr.setMeta(commandPluginKey, {
                type: 'setMark',
                pos: info.paragraphPos,
                text: info.text,
                status: 'executed',
              })
            )
            const commandId = nanoid()
            const fn = onCommandRef.current
            if (fn) {
              try {
                const result = fn({
                  cmd: info.cmd,
                  query: info.query,
                  commandId,
                })
                if (result && typeof (result as Promise<boolean>).then === 'function') {
                  ;(result as Promise<boolean>).catch((err) =>
                    console.error('command execution failed', err)
                  )
                }
              } catch (err) {
                console.error('command execution failed', err)
              }
            }
          } else if (info.status === 'invalid' || info.status === 'incomplete') {
            view.dispatch(
              view.state.tr.setMeta(commandPluginKey, {
                type: 'setMark',
                pos: info.paragraphPos,
                text: info.text,
                status: info.status,
              })
            )
          }
          return false
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      const md = getMarkdown(editor)
      onChangeRef.current(md)
    },
  })

  acceptSuggestionRef.current = (suggestion: string) => {
    if (!editor) return
    const info = getCurrentCommandLine(editor.state)
    if (!info) {
      setAutocomplete(HIDDEN_AUTOCOMPLETE)
      return
    }
    const from = info.paragraphPos + 1
    const to = info.paragraphEnd - 1
    const tr = editor.state.tr.insertText(suggestion, from, to)
    const newPos = from + suggestion.length
    tr.setSelection(TextSelection.create(tr.doc, newPos))
    editor.view.dispatch(tr)
    editor.view.focus()
    dismissedFingerprintRef.current = suggestion
    setAutocomplete(HIDDEN_AUTOCOMPLETE)
  }

  const updateAutocomplete = useCallback(() => {
    if (!editor) return
    const info = getCurrentCommandLine(editor.state)
    if (!info) {
      dismissedFingerprintRef.current = null
      if (autocompleteRef.current.visible) {
        setAutocomplete(HIDDEN_AUTOCOMPLETE)
      }
      return
    }
    if (info.text.includes(' ')) {
      if (autocompleteRef.current.visible) {
        setAutocomplete(HIDDEN_AUTOCOMPLETE)
      }
      return
    }
    const suggestions = getCommandSuggestions(info.text)
    if (suggestions.length === 0) {
      if (autocompleteRef.current.visible) {
        setAutocomplete(HIDDEN_AUTOCOMPLETE)
      }
      return
    }
    if (dismissedFingerprintRef.current === info.text) {
      return
    }
    dismissedFingerprintRef.current = null
    const coords = editor.view.coordsAtPos(editor.state.selection.from)
    setAutocomplete((prev) => {
      const sameSuggestions =
        prev.visible &&
        prev.suggestions.length === suggestions.length &&
        prev.suggestions.every((s, i) => s === suggestions[i])
      const selectedIdx = sameSuggestions
        ? Math.min(prev.selectedIdx, suggestions.length - 1)
        : 0
      return {
        visible: true,
        filter: info.text,
        suggestions,
        selectedIdx,
        top: coords.bottom + 4,
        left: coords.left,
      }
    })
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const handler = () => updateAutocomplete()
    const blurHandler = () => setAutocomplete(HIDDEN_AUTOCOMPLETE)
    editor.on('transaction', handler)
    editor.on('blur', blurHandler)
    updateAutocomplete()
    return () => {
      editor.off('transaction', handler)
      editor.off('blur', blurHandler)
    }
  }, [editor, updateAutocomplete])

  useEffect(() => {
    if (!editor) return
    const texts = executedCommandTexts ?? new Set<string>()
    editor.view.dispatch(
      editor.state.tr.setMeta(commandPluginKey, {
        type: 'syncExecuted',
        texts,
      })
    )
  }, [editor, executedCommandTexts])

  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(commandPluginKey, { type: 'bumpResponses' })
    )
  }, [editor, responses])

  useEffect(() => {
    if (!editor) return
    const current = getMarkdown(editor)
    if (current === value) return
    editor.commands.setContent(value, { emitUpdate: false })
  }, [value, editor])

  useEffect(() => {
    if (!editor) return
    const detach = attachSpellCheckEnforcer(editor.view.dom)
    return detach
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (href.startsWith('monet://note/')) {
        e.preventDefault()
        e.stopPropagation()
        const noteId = href.slice('monet://note/'.length)
        if (noteId) onNavigateToNoteRef.current?.(noteId)
      }
    }
    dom.addEventListener('click', handler, true)
    return () => dom.removeEventListener('click', handler, true)
  }, [editor])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setSearchVisible(v => !v)
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const handler = (e: MouseEvent) => {
      e.preventDefault()
      setContextMenuPos({ x: e.clientX, y: e.clientY })
    }
    dom.addEventListener('contextmenu', handler)
    return () => dom.removeEventListener('contextmenu', handler)
  }, [editor])

  useEffect(() => {
    if (!contextMenuPos) return
    const handler = () => setContextMenuPos(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenuPos])

  function handleNotePickerSelect(note: Note) {
    if (!editor) return
    const pos = notePickerInsertPosRef.current
    editor.chain().focus().insertContentAt(pos, {
      type: 'linkedNoteBlock',
      attrs: { noteId: note.id, collapsed: false },
    }).run()
    setNotePickerVisible(false)
    setNotePickerPos(undefined)
    setContextMenuPos(null)
  }

  const headings: Heading[] = parseHeadings(value)

  const updateActiveHeading = useCallback(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || headings.length === 0) {
      setActiveOffset(null)
      return
    }
    const headingEls = findHeadingDomElements(scrollEl)
    if (headingEls.length === 0) {
      setActiveOffset(null)
      return
    }
    const scrollTop = scrollEl.getBoundingClientRect().top
    let visibleIndex = 0
    for (let i = 0; i < headingEls.length; i++) {
      const rect = headingEls[i].getBoundingClientRect()
      if (rect.top - scrollTop <= 8) {
        visibleIndex = i
      } else {
        break
      }
    }
    const matched = headings[visibleIndex] ?? findClosestHeading(headings, 0)
    setActiveOffset(matched?.offset ?? null)
  }, [headings])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    updateActiveHeading()
    scrollEl.addEventListener('scroll', updateActiveHeading, { passive: true })
    return () => scrollEl.removeEventListener('scroll', updateActiveHeading)
  }, [updateActiveHeading])

  useEffect(() => {
    if (title === '' && value === '') {
      titleRef.current?.focus()
    }
  }, [])

  const handleNavigateToHeading = useCallback(
    (offset: number) => {
      const scrollEl = scrollRef.current
      if (!scrollEl) return
      const idx = headings.findIndex((h) => h.offset === offset)
      if (idx < 0) return
      const headingEls = findHeadingDomElements(scrollEl)
      const target = headingEls[idx]
      if (!target) return
      const scrollRect = scrollEl.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      scrollEl.scrollBy({ top: targetRect.top - scrollRect.top - 12, behavior: 'smooth' })
      setActiveOffset(offset)
    },
    [headings]
  )

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
      {notebookName && (
        <span className={styles.notebookLabel}>{notebookName}</span>
      )}
      <input
        ref={titleRef}
        className={styles.title}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="note title"
      />
      <div className={styles.tagsRow}>
        <button
          className={styles.tagAdd}
          onClick={() => setAdding(true)}
          aria-label="add tag"
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
              aria-label={`remove tag ${t}`}
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
            placeholder="new tag"
          />
        )}
      </div>
      <div className={styles.bodyWrap}>
        <div className={styles.body} ref={scrollRef}>
          <SearchInNote
            editor={editor}
            visible={searchVisible}
            onClose={() => setSearchVisible(false)}
          />
          <EditorNotesProvider value={{ notes: notebookNotes, onNavigateToNote: onNavigateToNote ?? (() => {}) }}>
            <EditorResponsesProvider value={contextValue}>
              <EditorContent editor={editor} />
            </EditorResponsesProvider>
          </EditorNotesProvider>
        </div>
        <HeadingNavigator
          content={value}
          activeOffset={activeOffset}
          onNavigate={handleNavigateToHeading}
        />
      </div>
      {notePickerVisible && (
        <NotePicker
          notes={notebookNotes}
          onSelect={handleNotePickerSelect}
          onClose={() => { setNotePickerVisible(false); setNotePickerPos(undefined) }}
          position={notePickerPos}
        />
      )}
      {contextMenuPos && (
        <div
          style={{
            position: 'fixed',
            top: contextMenuPos.y,
            left: contextMenuPos.x,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            zIndex: 300,
            minWidth: 140,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              textAlign: 'left',
              fontSize: 13,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onMouseDown={() => {
              if (!editor) return
              const { from } = editor.state.selection
              notePickerInsertPosRef.current = from
              const coords = editor.view.coordsAtPos(from)
              setNotePickerPos({ top: coords.bottom + 4, left: coords.left })
              setNotePickerVisible(true)
              setContextMenuPos(null)
            }}
            type="button"
          >
            Link note
          </button>
        </div>
      )}
      {relatedContent}
      {editor && <FormattingToolbar editor={editor as TiptapEditor} />}
      <CommandAutocomplete
        state={autocomplete}
        onSelect={(s) => acceptSuggestionRef.current(s)}
        onHover={(idx) =>
          setAutocomplete((prev) => (prev.visible ? { ...prev, selectedIdx: idx } : prev))
        }
      />
    </div>
  )
}
