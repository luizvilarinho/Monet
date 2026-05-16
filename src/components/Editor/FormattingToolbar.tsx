import { BubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import styles from './FormattingToolbar.module.css'

interface Props {
  editor: Editor
}

type FormatId =
  | 'h1' | 'h2' | 'h3'
  | 'bold' | 'italic'
  | 'ul' | 'ol' | 'todo'
  | 'blockquote' | 'code' | 'codeBlock' | 'link' | 'hr' | 'table' | 'image'
  | 'colBefore' | 'colAfter' | 'delCol'
  | 'rowBefore' | 'rowAfter' | 'delRow'
  | 'delTable'

type ButtonDef = { id: FormatId; label: string; title: string; cls?: string }

const FORMATTING_GROUPS: ButtonDef[][] = [
  [
    { id: 'h1', label: 'H1', title: 'Título H1' },
    { id: 'h2', label: 'H2', title: 'Subtítulo H2' },
    { id: 'h3', label: 'H3', title: 'Subtítulo H3' },
  ],
  [
    { id: 'bold', label: 'B', title: 'Negrito (Ctrl+B)', cls: 'bold' },
    { id: 'italic', label: 'I', title: 'Itálico (Ctrl+I)', cls: 'italic' },
  ],
  [
    { id: 'ul', label: '≡', title: 'Lista' },
    { id: 'ol', label: '1.', title: 'Lista Numerada' },
    { id: 'todo', label: '☐', title: 'TODO' },
  ],
  [
    { id: 'blockquote', label: '"', title: 'Citação' },
    { id: 'code', label: '</>', title: 'Código inline' },
    { id: 'codeBlock', label: '{ }', title: 'Bloco de código (multilinha)' },
    { id: 'table', label: '⊞', title: 'Inserir tabela 3×3' },
    { id: 'image', label: '🖼', title: 'Inserir imagem (também aceita colar / arrastar)' },
    { id: 'link', label: '🔗', title: 'Link' },
    { id: 'hr', label: '―', title: 'Separador' },
  ],
]

const TABLE_GROUPS: ButtonDef[][] = [
  [
    { id: 'colBefore', label: '+◀', title: 'Adicionar coluna à esquerda' },
    { id: 'colAfter', label: '▶+', title: 'Adicionar coluna à direita' },
    { id: 'delCol', label: '× col', title: 'Excluir coluna atual' },
  ],
  [
    { id: 'rowBefore', label: '+▲', title: 'Adicionar linha acima' },
    { id: 'rowAfter', label: '▼+', title: 'Adicionar linha abaixo' },
    { id: 'delRow', label: '× lin', title: 'Excluir linha atual' },
  ],
  [
    { id: 'delTable', label: '× tabela', title: 'Excluir tabela inteira' },
  ],
]

function isActive(editor: Editor, id: FormatId): boolean {
  switch (id) {
    case 'h1': return editor.isActive('heading', { level: 1 })
    case 'h2': return editor.isActive('heading', { level: 2 })
    case 'h3': return editor.isActive('heading', { level: 3 })
    case 'bold': return editor.isActive('bold')
    case 'italic': return editor.isActive('italic')
    case 'ul': return editor.isActive('bulletList')
    case 'ol': return editor.isActive('orderedList')
    case 'todo': return editor.isActive('taskList')
    case 'blockquote': return editor.isActive('blockquote')
    case 'code': return editor.isActive('code')
    case 'codeBlock': return editor.isActive('codeBlock')
    case 'link': return editor.isActive('link')
    case 'hr': return false
    case 'table': return editor.isActive('table')
    case 'image': return false
    case 'colBefore':
    case 'colAfter':
    case 'delCol':
    case 'rowBefore':
    case 'rowAfter':
    case 'delRow':
    case 'delTable':
      return false
  }
}

function isSafeLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function runAction(editor: Editor, id: FormatId) {
  const chain = editor.chain().focus()
  switch (id) {
    case 'h1': chain.toggleHeading({ level: 1 }).run(); return
    case 'h2': chain.toggleHeading({ level: 2 }).run(); return
    case 'h3': chain.toggleHeading({ level: 3 }).run(); return
    case 'bold': chain.toggleBold().run(); return
    case 'italic': chain.toggleItalic().run(); return
    case 'ul': chain.toggleBulletList().run(); return
    case 'ol': chain.toggleOrderedList().run(); return
    case 'todo': chain.toggleTaskList().run(); return
    case 'blockquote': chain.toggleBlockquote().run(); return
    case 'code': chain.toggleCode().run(); return
    case 'codeBlock': chain.toggleCodeBlock().run(); return
    case 'link': {
      if (editor.isActive('link')) {
        chain.unsetLink().run()
      } else {
        const url = window.prompt('URL do link:')?.trim()
        if (url && isSafeLinkUrl(url)) chain.setLink({ href: url }).run()
        else chain.run()
      }
      return
    }
    case 'hr': chain.setHorizontalRule().run(); return
    case 'table':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      return
    case 'image': {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          editor.chain().focus().setImage({ src: dataUrl }).run()
        }
        reader.onerror = () => console.error('failed to read image', reader.error)
        reader.readAsDataURL(file)
      }
      input.click()
      return
    }
    case 'colBefore': chain.addColumnBefore().run(); return
    case 'colAfter': chain.addColumnAfter().run(); return
    case 'delCol': chain.deleteColumn().run(); return
    case 'rowBefore': chain.addRowBefore().run(); return
    case 'rowAfter': chain.addRowAfter().run(); return
    case 'delRow': chain.deleteRow().run(); return
    case 'delTable': chain.deleteTable().run(); return
  }
}

const PLUGIN_KEY = 'monetFormattingMenu'

function renderGroups(
  editor: Editor,
  groups: ButtonDef[][],
  startKey: string
) {
  return groups.map((group, gi) => (
    <div key={`${startKey}-${gi}`} className={styles.group}>
      {gi > 0 && <div className={styles.sep} />}
      {group.map(({ id, label, title, cls }) => (
        <button
          key={id}
          className={[
            styles.btn,
            isActive(editor, id) ? styles.active : '',
            cls === 'bold' ? styles.bold : '',
            cls === 'italic' ? styles.italic : '',
          ].join(' ')}
          title={title}
          onMouseDown={(e) => {
            e.preventDefault()
            runAction(editor, id)
          }}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  ))
}

export function FormattingToolbar({ editor }: Props) {
  const [hiddenByEscape, setHiddenByEscape] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHiddenByEscape(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (!hiddenByEscape) return
    const reset = () => setHiddenByEscape(false)
    editor.on('selectionUpdate', reset)
    return () => {
      editor.off('selectionUpdate', reset)
    }
  }, [editor, hiddenByEscape])

  const { inTable, hasSelection } = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const { from, to } = ed.state.selection
      return {
        inTable: ed.isActive('table'),
        hasSelection: from !== to,
      }
    },
  })

  const formattingGroups = inTable
    ? FORMATTING_GROUPS.map((g) => g.filter((b) => b.id !== 'table'))
    : FORMATTING_GROUPS

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={PLUGIN_KEY}
      shouldShow={({ editor: ed, from: f, to: t }) => {
        if (hiddenByEscape) return false
        const sel = f !== t
        const tbl = ed.isActive('table')
        return sel || tbl
      }}
      options={{ placement: 'top', offset: 8 }}
    >
      <div
        className={styles.toolbar}
        onMouseDown={(e) => e.preventDefault()}
      >
        {hasSelection && renderGroups(editor, formattingGroups, 'fmt')}
        {inTable && hasSelection && <div className={styles.sep} />}
        {inTable && renderGroups(editor, TABLE_GROUPS, 'tbl')}
      </div>
    </BubbleMenu>
  )
}
