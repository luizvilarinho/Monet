import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { Editor } from '@tiptap/core'
import { ArrowSquareOut, Check, LinkBreak, PencilSimple } from '@phosphor-icons/react'
import { isSafeLinkUrl } from './formattingActions'
import { useAnchoredPosition, type PopoverAnchor } from './anchoredPosition'
import styles from './LinkPopover.module.css'

export interface LinkPopoverState {
  mode: 'view' | 'edit'
  anchor: PopoverAnchor
}

interface Props {
  editor: Editor
  state: LinkPopoverState
  onEdit: () => void
  // `refocus`: devolve o foco ao editor (Esc, ação feita).
  onClose: (refocus: boolean) => void
}

// "example.com" vira "https://example.com"; endereço com esquema passa igual.
export function normalizeLinkUrl(raw: string): string {
  const url = raw.trim()
  if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  return `https://${url.replace(/^\/+/, '')}`
}

export function openLink(href: string): void {
  void openUrl(href).catch((err) => console.warn('failed to open link', err))
}

// Popover do link: com o cursor num link (clique), mostra o endereço com Open,
// Edit e Remove; no Ctrl+Shift+K ou no botão Link da régua, o campo do endereço.
export function LinkPopover({ editor, state, onEdit, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const current = (editor.getAttributes('link').href as string | undefined) ?? ''
  const [value, setValue] = useState(current)
  const [error, setError] = useState(false)
  const pos = useAnchoredPosition(ref, state.anchor)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (state.mode !== 'edit') return
    setValue((editor.getAttributes('link').href as string | undefined) ?? '')
    setError(false)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [state.mode, editor])

  // Clique fora fecha; Esc fecha e devolve o foco à nota.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      onCloseRef.current(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onCloseRef.current(true)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [])

  function apply() {
    const href = normalizeLinkUrl(value)
    if (!isSafeLinkUrl(href)) {
      setError(true)
      return
    }
    const chain = editor.chain().focus()
    if (editor.isActive('link')) chain.extendMarkRange('link').setLink({ href }).run()
    else if (!editor.state.selection.empty) chain.setLink({ href }).run()
    else chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
    onClose(false)
  }

  function remove() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onClose(false)
  }

  return createPortal(
    <div
      ref={ref}
      className={styles.popover}
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label="Link"
    >
      {state.mode === 'view' ? (
        <div className={styles.row}>
          <span className={styles.url} title={current}>{current}</span>
          <button type="button" className={styles.btn} onClick={() => { onClose(false); openLink(current) }} title="Open in the browser (Ctrl+click)">
            <ArrowSquareOut size={13} aria-hidden />
            Open
          </button>
          <button type="button" className={styles.btn} onClick={onEdit} title="Edit the link (Ctrl+Shift+K)">
            <PencilSimple size={13} aria-hidden />
            Edit
          </button>
          <button type="button" className={styles.btn} onClick={remove} title="Remove the link (keeps the text)">
            <LinkBreak size={13} aria-hidden />
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className={styles.row}>
            <input
              ref={inputRef}
              className={styles.input}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  apply()
                }
              }}
              placeholder="Paste or type a link"
              aria-label="Link address"
              aria-invalid={error || undefined}
            />
            <button type="button" className={styles.btn} onClick={apply} disabled={!value.trim()}>
              <Check size={13} aria-hidden />
              Apply
            </button>
            {current && (
              <button type="button" className={styles.btn} onClick={remove} title="Remove the link (keeps the text)">
                <LinkBreak size={13} aria-hidden />
                Remove
              </button>
            )}
          </div>
          {error && <div className={styles.error}>Enter a valid web address, like example.com</div>}
        </>
      )}
    </div>,
    document.body
  )
}
