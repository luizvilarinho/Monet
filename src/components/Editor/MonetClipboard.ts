import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey, type Selection } from '@tiptap/pm/state'
import { Fragment, Slice, type Node as ProseMirrorNode, type Schema } from '@tiptap/pm/model'
import { CellSelection } from '@tiptap/pm/tables'
import { isBlankParagraph } from './blankParagraph'
import type { TasksQueryBlockStorage } from './TasksQueryBlock'

// Texto copiado (text/plain) do editor. Substitui o serializer do
// tiptap-markdown, que vazava `<br>` no texto: marcador de linha em branco do
// ParagraphWithBlankLines, hardBreak dentro de tabela e fallback HTML para
// tabelas/linhas de CellSelection. Regras:
// - seleção dentro de uma única célula → texto puro;
// - várias células / tabela inteira → tabela Markdown;
// - demais casos → Markdown, com hardBreak virando quebra de linha real.

interface MarkdownStorage {
  markdown: { serializer: { serialize(content: Fragment): string } }
}

function isCellNode(node: ProseMirrorNode): boolean {
  const role = node.type.spec.tableRole
  return role === 'cell' || role === 'header_cell'
}

// Seleção contida numa única célula (CellSelection de 1 célula ou seleção de
// texto cujas pontas estão na mesma célula).
function isSingleCellSelection(selection: Selection): boolean {
  if (selection instanceof CellSelection) {
    return selection.$anchorCell.pos === selection.$headCell.pos
  }
  const { $from, $to } = selection
  for (let d = $from.depth; d > 0; d--) {
    if (!isCellNode($from.node(d))) continue
    return $to.depth >= d && $to.before(d) === $from.before(d)
  }
  return false
}

function plainText(fragment: Fragment): string {
  return fragment.textBetween(0, fragment.size, '\n', (leaf) =>
    leaf.type.name === 'hardBreak' ? '\n' : (leaf.type.spec.leafText?.(leaf) ?? '')
  )
}

// Troca cada hardBreak por um text node '\n' (mesmas marcas): o state.text()
// do prosemirror-markdown quebra a linha respeitando a indentação de listas.
// hardBreaks finais são descartados (o tiptap-markdown também não os emite) e
// parágrafos só-de-hardBreak ficam intactos para virar o marcador `<br>`.
function replaceHardBreaks(fragment: Fragment, schema: Schema): Fragment {
  const nodes: ProseMirrorNode[] = []
  let lastContent = -1
  fragment.forEach((node, _offset, index) => {
    if (node.type.name !== 'hardBreak') lastContent = index
  })
  fragment.forEach((node, _offset, index) => {
    if (node.type.name === 'hardBreak') {
      if (index < lastContent) nodes.push(schema.text('\n', node.marks))
      return
    }
    if (node.isLeaf || isBlankParagraph(node)) {
      nodes.push(node)
      return
    }
    nodes.push(node.copy(replaceHardBreaks(node.content, schema)))
  })
  return Fragment.fromArray(nodes)
}

const TASKS_QUERY_RE = /<tasks-query\b[^>]*\bdata-filter="([^"]*)"[^>]*><\/tasks-query>/g

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function serializeBlocks(editor: Editor, fragment: Fragment): string {
  const { serializer } = (editor.storage as unknown as MarkdownStorage).markdown
  const tasksQuery = (editor.storage as unknown as Record<string, TasksQueryBlockStorage | undefined>)
    .tasksQueryBlock
  return serializer
    .serialize(replaceHardBreaks(fragment, editor.schema))
    // Bloco `/tasks` sai como a lista legível (não como o filtro).
    .replace(TASKS_QUERY_RE, (match, filter: string) =>
      tasksQuery?.resolveText ? tasksQuery.resolveText(decodeAttr(filter)) : match
    )
    // Marcador de linha em branco (`<br>` numa linha só, também dentro de
    // blockquote `> <br>`) vira linha vazia. Texto digitado `<br>` sai
    // escapado (&lt;br&gt;), então não colide.
    .replace(
      /^([ \t]*(?:>[ \t]*)*)<br>[ \t]*(\n(?:[ \t]*(?:>[ \t]*)*\n)?|$)/gm,
      (_match, prefix: string) => `${prefix.trimEnd()}\n`
    )
    .replace(/\s+$/, '')
}

function tableToMarkdown(editor: Editor, rows: ProseMirrorNode[]): string {
  const cells = rows.map((row) => {
    const line: string[] = []
    row.forEach((cell) => {
      line.push(
        serializeBlocks(editor, cell.content)
          .replace(/\n+/g, ' ')
          .trim()
          .replace(/\|/g, '\\|')
      )
    })
    return line
  })
  const width = Math.max(0, ...cells.map((line) => line.length))
  if (width === 0) return ''
  const toLine = (line: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => line[i] ?? '').join(' | ')} |`
  // GFM exige a linha delimitadora após a 1ª linha, mesmo sem header.
  const lines = cells.map(toLine)
  lines.splice(1, 0, toLine(Array.from({ length: width }, () => '---')))
  return lines.join('\n')
}

function serializeSlice(editor: Editor, fragment: Fragment): string {
  const parts: string[] = []
  let blocks: ProseMirrorNode[] = []
  let rows: ProseMirrorNode[] = []
  const flushBlocks = () => {
    if (blocks.length) parts.push(serializeBlocks(editor, Fragment.fromArray(blocks)))
    blocks = []
  }
  const flushRows = () => {
    if (rows.length) parts.push(tableToMarkdown(editor, rows))
    rows = []
  }
  fragment.forEach((node) => {
    // CellSelection parcial gera tableRows soltos, sem o node table.
    if (node.type.spec.tableRole === 'row') {
      flushBlocks()
      rows.push(node)
      return
    }
    flushRows()
    if (node.type.spec.tableRole === 'table') {
      flushBlocks()
      const tableRows: ProseMirrorNode[] = []
      node.forEach((row) => tableRows.push(row))
      parts.push(tableToMarkdown(editor, tableRows))
      return
    }
    blocks.push(node)
  })
  flushBlocks()
  flushRows()
  return parts.filter(Boolean).join('\n\n')
}

// Prioridade acima de 100 para rodar antes do MarkdownClipboard do
// tiptap-markdown (o ProseMirror usa a primeira prop que responder).
export const MonetClipboard = Extension.create({
  name: 'monetClipboard',
  priority: 110,

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('monetClipboard'),
        props: {
          // Uma célula copiada (CellSelection 1×1) leva só o conteúdo dela,
          // também no text/html — colar fora da tabela dá texto, não tabela.
          transformCopied(slice, view) {
            const sel = view.state.selection
            if (!(sel instanceof CellSelection)) return slice
            if (sel.$anchorCell.pos !== sel.$headCell.pos) return slice
            const cell = sel.$anchorCell.nodeAfter
            return cell ? new Slice(cell.content, 1, 1) : slice
          },
          clipboardTextSerializer(slice, view) {
            if (isSingleCellSelection(view.state.selection)) {
              return plainText(slice.content)
            }
            return serializeSlice(editor, slice.content)
          },
        },
      }),
    ]
  },
})
