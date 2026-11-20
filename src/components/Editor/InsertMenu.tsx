import { useEffect, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import {
  CaretRight,
  ClipboardText,
  Clock,
  FlowArrow,
  Image,
  LinkSimple,
  ListChecks,
  Minus,
  Table,
  type IconProps,
} from '@phosphor-icons/react'
import { formatLocalTimestamp } from '../../lib/calendar'
import { insertBlock, type InsertKind } from './formattingActions'
import { useAnchoredPosition, type PopoverAnchor } from './anchoredPosition'
import styles from './InsertMenu.module.css'

interface Props {
  editor: Editor
  anchor: PopoverAnchor
  // "Link note": o Editor abre o seletor de nota no cursor.
  onLinkNote: () => void
  onClose: () => void
}

interface Item {
  id: 'paste' | 'linkNote' | 'dateTime' | InsertKind
  label: string
  icon: ComponentType<IconProps>
  hint?: string
}

const PASTE: Item = { id: 'paste', label: 'Paste', icon: ClipboardText, hint: 'Ctrl+V' }
const INSERT_ITEMS: Item[] = [
  { id: 'linkNote', label: 'Link note', icon: LinkSimple, hint: '[[' },
  { id: 'dateTime', label: 'Date and time', icon: Clock },
  { id: 'table', label: 'Table', icon: Table },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'divider', label: 'Divider', icon: Minus },
  { id: 'toggle', label: 'Toggle', icon: CaretRight },
  { id: 'diagram', label: 'Diagram', icon: FlowArrow, hint: '/diagram' },
  { id: 'tasks', label: 'Tasks block', icon: ListChecks, hint: '/tasks' },
]
const ITEMS = [PASTE, ...INSERT_ITEMS]

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('failed to read image'))
    reader.readAsDataURL(blob)
  })
}

// Cola pelo pipeline do editor (o mesmo do Ctrl+V): HTML, texto ou imagem.
// Sem acesso à área de transferência, devolve false.
async function pasteFromClipboard(editor: Editor): Promise<boolean> {
  const { view } = editor
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'))
      if (imageType) {
        const src = await readAsDataUrl(await item.getType(imageType))
        const node = view.state.schema.nodes.image?.create({ src })
        if (node) view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
        return true
      }
      if (item.types.includes('text/html')) {
        const html = await (await item.getType('text/html')).text()
        if (html.trim()) return view.pasteHTML(html)
      }
      if (item.types.includes('text/plain')) {
        return view.pasteText(await (await item.getType('text/plain')).text())
      }
    }
    return true
  } catch {
    try {
      const text = await navigator.clipboard.readText()
      return text ? view.pasteText(text) : true
    } catch {
      return false
    }
  }
}

// Menu do botão direito: Paste e os blocos que entram no cursor. A formatação
// fica na régua da seleção. O foco fica no editor (cursor visível); ↑↓, Enter
// e Esc navegam pelo teclado.
export function InsertMenu({ editor, anchor, onLinkNote, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(active)
  activeRef.current = active
  const [pasteBlocked, setPasteBlocked] = useState(false)
  const pos = useAnchoredPosition(ref, anchor)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const runRef = useRef<(item: Item) => void>(() => {})

  runRef.current = (item: Item) => {
    switch (item.id) {
      case 'paste':
        editor.commands.focus()
        void pasteFromClipboard(editor).then((ok) => {
          if (ok) onCloseRef.current()
          else setPasteBlocked(true)
        })
        return
      case 'linkNote':
        onLinkNote()
        return
      case 'dateTime':
        editor
          .chain()
          .focus()
          .insertContent(formatLocalTimestamp(new Date(), { hour24: true, separator: ' - ' }))
          .run()
        onClose()
        return
      default:
        insertBlock(editor, item.id)
        onClose()
    }
  }

  // Em captura: as teclas do menu não chegam ao editor nem ao modal da task.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setActive((i) => (i + step + ITEMS.length) % ITEMS.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        runRef.current(ITEMS[activeRef.current])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
      } else {
        // Qualquer outra tecla volta à digitação.
        onCloseRef.current()
      }
    }
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown, true)
    }
  }, [])

  const renderItem = (item: Item, idx: number) => {
    const IconCmp = item.icon
    return (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        className={`${styles.item} ${idx === active ? styles.active : ''}`}
        onMouseEnter={() => setActive(idx)}
        // Sem tirar o foco do editor: o conteúdo entra no cursor.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => runRef.current(item)}
      >
        <IconCmp size={15} aria-hidden />
        <span className={styles.label}>{item.label}</span>
        {item.hint && <span className={styles.hint}>{item.hint}</span>}
      </button>
    )
  }

  return createPortal(
    <div
      ref={ref}
      className={styles.menu}
      style={{ top: pos.top, left: pos.left }}
      role="menu"
      aria-label="Insert"
    >
      {renderItem(PASTE, 0)}
      {pasteBlocked && <div className={styles.note}>Clipboard blocked — press Ctrl+V</div>}
      <div className={styles.sep} role="separator" />
      <div className={styles.heading}>Insert</div>
      {INSERT_ITEMS.map((item, i) => renderItem(item, i + 1))}
    </div>,
    document.body
  )
}
