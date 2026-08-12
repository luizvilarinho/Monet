import type { Editor } from '@tiptap/core'

export type FormatId =
  | 'h1' | 'h2' | 'h3'
  | 'bold' | 'italic'
  | 'ul' | 'ol' | 'todo' | 'toggle'
  | 'blockquote' | 'code' | 'codeBlock' | 'link' | 'hr' | 'table' | 'image'
  | 'colBefore' | 'colAfter' | 'delCol'
  | 'rowBefore' | 'rowAfter' | 'delRow'
  | 'delTable'

export type ButtonDef = { id: FormatId; label: string; title: string; cls?: string }

export const FORMATTING_GROUPS: ButtonDef[][] = [
  [
    { id: 'h1', label: 'H1', title: 'Heading H1' },
    { id: 'h2', label: 'H2', title: 'Heading H2' },
    { id: 'h3', label: 'H3', title: 'Heading H3' },
  ],
  [
    { id: 'bold', label: 'B', title: 'Bold (Ctrl+B)', cls: 'bold' },
    { id: 'italic', label: 'I', title: 'Italic (Ctrl+I)', cls: 'italic' },
  ],
  [
    { id: 'ul', label: '≡', title: 'List' },
    { id: 'ol', label: '1.', title: 'Numbered List' },
    { id: 'todo', label: '☐', title: 'TODO' },
    { id: 'toggle', label: '▶', title: 'Toggle block' },
  ],
  [
    { id: 'blockquote', label: '"', title: 'Quote' },
    { id: 'code', label: '</>', title: 'Inline code' },
    { id: 'codeBlock', label: '{ }', title: 'Code block (multiline)' },
    { id: 'table', label: '⊞', title: 'Insert 3×3 table' },
    { id: 'image', label: '🖼', title: 'Insert image (also supports paste / drag)' },
    { id: 'link', label: '🔗', title: 'Link' },
    { id: 'hr', label: '―', title: 'Divider' },
  ],
]

export const TABLE_GROUPS: ButtonDef[][] = [
  [
    { id: 'colBefore', label: '+◀', title: 'Add column to the left' },
    { id: 'colAfter', label: '▶+', title: 'Add column to the right' },
    { id: 'delCol', label: '× col', title: 'Delete current column' },
  ],
  [
    { id: 'rowBefore', label: '+▲', title: 'Add row above' },
    { id: 'rowAfter', label: '▼+', title: 'Add row below' },
    { id: 'delRow', label: '× lin', title: 'Delete current row' },
  ],
  [
    { id: 'delTable', label: '× table', title: 'Delete entire table' },
  ],
]

export function isActive(editor: Editor, id: FormatId): boolean {
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
    case 'toggle': return editor.isActive('toggleBlock')
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

export function isSafeLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function runAction(editor: Editor, id: FormatId) {
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
    case 'toggle': {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to, ' ')
      const { schema } = editor.state
      const toggleType = schema.nodes['toggleBlock']
      const paraType = schema.nodes['paragraph']
      if (!toggleType || !paraType) return
      const node = toggleType.create(
        { title: selectedText, collapsed: false },
        paraType.create()
      )
      editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) { tr.replaceSelectionWith(node); dispatch(tr) }
        return true
      }).run()
      return
    }
    case 'blockquote': chain.toggleBlockquote().run(); return
    case 'code': chain.toggleCode().run(); return
    case 'codeBlock': chain.toggleCodeBlock().run(); return
    case 'link': {
      if (editor.isActive('link')) {
        chain.unsetLink().run()
      } else {
        const url = window.prompt('Link URL:')?.trim()
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

/**
 * Cria uma nova linha vazia abaixo da posição atual do cursor e aplica a
 * formatação escolhida. Usado pelo menu de contexto (botão direito) para
 * inserir blocos já formatados sem precisar digitar e selecionar antes.
 *
 * Para formatações de bloco (headings, listas, blockquote, codeBlock, etc.)
 * a abordagem é:
 *   1. Inserir um parágrafo vazio abaixo do bloco atual (Enter)
 *   2. Aplicar o comando de formatação (toggleHeading, toggleBulletList, etc.)
 *
 * Para toggleBlock e table, que criam nodes estruturados, inserimos
 * diretamente o node no final do bloco atual.
 *
 * Para marks inline (bold, italic, code, link) e image, criamos um
 * parágrafo novo sem aplicação automática (o usuário digita e depois
 * aplica a mark, ou anexa o link).
 */
export function insertNewFormattedLine(editor: Editor, id: FormatId) {
  const chain = editor.chain().focus()

  switch (id) {
    case 'h1':
    case 'h2':
    case 'h3': {
      chain
        .createParagraphNear()
        .run()
      const level = id === 'h1' ? 1 : id === 'h2' ? 2 : 3
      editor.chain().focus().setHeading({ level }).run()
      return
    }

    case 'ul': {
      chain.createParagraphNear().run()
      editor.chain().focus().toggleBulletList().run()
      return
    }

    case 'ol': {
      chain.createParagraphNear().run()
      editor.chain().focus().toggleOrderedList().run()
      return
    }

    case 'todo': {
      chain.createParagraphNear().run()
      editor.chain().focus().toggleTaskList().run()
      return
    }

    case 'toggle': {
      const { schema } = editor.state
      const toggleType = schema.nodes['toggleBlock']
      const paraType = schema.nodes['paragraph']
      if (!toggleType || !paraType) return
      const node = toggleType.create(
        { title: '', collapsed: false },
        paraType.create()
      )
      editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) {
          // Insere o toggleBlock abaixo do bloco atual
          const { $from } = editor.state.selection
          const blockEnd = $from.end($from.depth) + 1
          tr.insert(blockEnd, node)
          dispatch(tr)
        }
        return true
      }).run()
      return
    }

    case 'blockquote': {
      chain.createParagraphNear().run()
      editor.chain().focus().toggleBlockquote().run()
      return
    }

    case 'codeBlock': {
      chain.createParagraphNear().run()
      editor.chain().focus().toggleCodeBlock().run()
      return
    }

    case 'table': {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      return
    }

    case 'hr': {
      editor.chain().focus().setHorizontalRule().run()
      return
    }

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

    // Para marks inline, criamos um novo parágrafo e focamos nele — o
    // usuário digita o conteúdo e o mark pode ser aplicado depois.
    case 'bold':
    case 'italic':
    case 'code':
    case 'link': {
      chain.createParagraphNear().run()
      return
    }

    default:
      return
  }
}
