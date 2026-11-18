import { Table, TableView } from '@tiptap/extension-table'
import { getHTMLFromFragment } from '@tiptap/core'
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { MarkdownSerializerState } from 'prosemirror-markdown'

// Tabela que grava a largura das colunas no Markdown da nota. O tiptap-markdown
// grava a tabela em pipes (GFM) e descarta o `colwidth` que o arrasto da borda
// põe nas células, então a largura sumia ao reabrir a nota. Aqui a tabela
// continua em pipes e, quando alguma coluna tem largura, ganha uma linha antes:
//   <!-- monet:colwidths 229,151,0 -->   (px por coluna; 0 = sem largura)
// O comentário some no preview e nos leitores de Markdown, e o
// `cleanNoteContentForAi` o tira da busca, do RAG e do chat. Tabela sem largura
// sai como antes. A que não cabe em GFM (célula mesclada, sem cabeçalho, célula
// com mais de um parágrafo) segue em HTML, que já grava o `colwidth`.
//
// O serializer é cópia do `nodes/table.js` do tiptap-markdown (MIT), que não
// exporta o original, com o comentário e o escape do `|` acrescentados.

type TableSerializerState = MarkdownSerializerState & {
  out: string
  // Do estado do tiptap-markdown: com `inTable` o hardBreak sai como `<br>`;
  // `inlines` guarda posições de negrito/itálico em `out` para ajustá-las depois.
  inTable: boolean
  inlines?: { start?: number; end?: number }[]
}

const COLWIDTHS_COMMENT_RE = /^\s*monet:colwidths\s+(\d+(?:,\d+)*)\s*$/

function hasSpan(cell: ProseMirrorNode): boolean {
  return cell.attrs.colspan > 1 || cell.attrs.rowspan > 1
}

function isMarkdownSerializable(node: ProseMirrorNode): boolean {
  const rows: ProseMirrorNode[] = []
  node.forEach((row) => rows.push(row))
  const [firstRow, ...bodyRows] = rows
  const cells = (row: ProseMirrorNode) => {
    const out: ProseMirrorNode[] = []
    row.forEach((cell) => out.push(cell))
    return out
  }
  if (cells(firstRow).some((cell) => cell.type.name !== 'tableHeader' || hasSpan(cell) || cell.childCount > 1)) {
    return false
  }
  return !bodyRows.some((row) =>
    cells(row).some((cell) => cell.type.name === 'tableHeader' || hasSpan(cell) || cell.childCount > 1)
  )
}

// Fallback HTML do tiptap-markdown (`nodes/html.js`): no topo do documento, o
// bloco vai no formato do CommonMark, com o conteúdo entre quebras de linha.
function writeHTML(state: TableSerializerState, node: ProseMirrorNode, parent: ProseMirrorNode | Fragment) {
  const schema = node.type.schema
  let html = getHTMLFromFragment(Fragment.from(node), schema)
  if (parent instanceof Fragment || parent.type.name === schema.topNodeType.name) {
    const element = new window.DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
      .firstElementChild as HTMLElement
    element.innerHTML = element.innerHTML.trim() ? `\n${element.innerHTML}\n` : '\n'
    html = element.outerHTML
  }
  state.write(html)
  state.closeBlock(node)
}

// Largura de cada coluna pela 1ª linha (a mesma que o Tiptap usa para desenhar);
// null quando nenhuma coluna tem largura.
function columnWidths(node: ProseMirrorNode): number[] | null {
  const widths: number[] = []
  node.firstChild?.forEach((cell) => {
    widths.push(Math.round((cell.attrs.colwidth as number[] | null)?.[0] ?? 0))
  })
  return widths.some((w) => w > 0) ? widths : null
}

// `|` da célula sai como `\|` (o markdown-it tira a barra ao separar as
// células), também em código inline, link e atributo HTML. Sem isso a célula
// `1 | 2` virava duas e um valor sumia na 2ª abertura. As posições de `inlines`
// desta célula andam com as barras inseridas antes delas.
function escapeCellPipes(state: TableSerializerState, from: number) {
  const cell = state.out.slice(from)
  if (!cell.includes('|')) return
  const shift = (pos: number) => pos + cell.slice(0, pos - from).split('|').length - 1
  state.inlines?.forEach((inline) => {
    if (inline.start !== undefined && inline.start >= from) inline.start = shift(inline.start)
    if (inline.end !== undefined && inline.end >= from) inline.end = shift(inline.end)
  })
  state.out = state.out.slice(0, from) + cell.replace(/\|/g, '\\|')
}

function writePipes(state: TableSerializerState, node: ProseMirrorNode) {
  state.inTable = true
  node.forEach((row, _offset, i) => {
    state.write('| ')
    row.forEach((cell, _cellOffset, j) => {
      if (j) state.write(' | ')
      const cellContent = cell.firstChild
      if (cellContent?.textContent.trim()) {
        const from = state.out.length
        state.renderInline(cellContent)
        escapeCellPipes(state, from)
      }
    })
    state.write(' |')
    state.ensureNewLine()
    if (!i) {
      const delimiterRow = Array.from({ length: row.childCount }, () => '---').join(' | ')
      state.write(`| ${delimiterRow} |`)
      state.ensureNewLine()
    }
  })
  state.closeBlock(node)
  state.inTable = false
}

// O `updateColumns` do Tiptap põe `min-width` na coluna que perdeu a largura
// (Ctrl+Z depois do arrasto, nota trocada por fora) mas não limpa o `width`
// antigo: a coluna ficava larga na tela até remontar a nota.
class TableViewClearingWidth extends TableView {
  update(node: ProseMirrorNode) {
    if (!super.update(node)) return false
    let col = this.colgroup.firstElementChild as HTMLElement | null
    node.firstChild?.forEach((cell) => {
      const colwidth = cell.attrs.colwidth as number[] | null
      for (let j = 0; j < (cell.attrs.colspan as number); j++) {
        if (col && !colwidth?.[j]) col.style.removeProperty('width')
        col = (col?.nextElementSibling as HTMLElement | null) ?? null
      }
    })
    return true
  }
}

export const TableWithWidths = Table.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: TableSerializerState, node: ProseMirrorNode, parent: ProseMirrorNode | Fragment) {
          if (!isMarkdownSerializable(node)) {
            writeHTML(state, node, parent)
            return
          }
          const widths = columnWidths(node)
          if (widths) {
            state.write(`<!-- monet:colwidths ${widths.join(',')} -->`)
            state.ensureNewLine()
          }
          writePipes(state, node)
        },
        parse: {
          // A largura vai para todas as células da coluna, não só o cabeçalho:
          // com células diferentes, o `fixTables` do prosemirror-tables
          // corrigiria numa transação extra e a nota seria gravada só por abrir.
          // Comentário sem tabela logo abaixo é descartado.
          updateDOM(element: HTMLElement) {
            const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_COMMENT)
            const comments: Comment[] = []
            while (walker.nextNode()) comments.push(walker.currentNode as Comment)
            for (const comment of comments) {
              const match = COLWIDTHS_COMMENT_RE.exec(comment.data)
              if (!match) continue
              const table = comment.nextElementSibling
              if (table?.tagName === 'TABLE') {
                const widths = match[1].split(',').map(Number)
                table.querySelectorAll('tr').forEach((tr) => {
                  Array.from(tr.children).forEach((cell, i) => {
                    if (widths[i] > 0) cell.setAttribute('colwidth', String(widths[i]))
                  })
                })
              }
              comment.remove()
            }
          },
        },
      },
    }
  },
}).configure({ resizable: true, View: TableViewClearingWidth })
