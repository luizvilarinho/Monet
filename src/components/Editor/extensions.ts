import { Placeholder } from '@tiptap/extensions'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import Code from '@tiptap/extension-code'
import Paragraph from '@tiptap/extension-paragraph'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'
import type { MarkdownSerializerState } from 'prosemirror-markdown'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { AnyExtension } from '@tiptap/core'
import { EmbedBlock } from './EmbedBlock'
import { ToggleBlock } from './ToggleBlock'
import { LinkedNoteBlock } from './LinkedNoteBlock'
import { ReminderChip } from './ReminderChip'

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

// Parágrafo em branco: vazio ou contendo apenas hardBreaks. O segundo caso é
// a forma round-tripped do primeiro (ver comentário abaixo).
function isBlankParagraph(node: ProseMirrorNode): boolean {
  for (let i = 0; i < node.childCount; i++) {
    if (node.child(i).type.name !== 'hardBreak') return false
  }
  return true
}

// Markdown puro não representa parágrafo vazio: o serializer padrão emite
// nada e a linha em branco some no próximo parse (ex.: linha em branco criada
// na janela keep desaparecia ao abrir a nota na main). Serializamos parágrafo
// em branco INTERIOR como `<br>` — o Markdown roda com `html: true`, então o
// parse devolve a linha como parágrafo com um hardBreak (visualmente
// idêntico). Como o hardBreak "trailing" também serializa vazio no
// tiptap-markdown, o parágrafo só-de-hardBreak é tratado como em branco,
// mantendo o round-trip estável (vazio → `<br>` → hardBreak → `<br>` → ...).
// O parágrafo em branco FINAL (último filho do pai) segue o comportamento
// antigo (descartado): quase toda nota termina com um parágrafo vazio após
// Enter, e emitir marcador ali mudaria o markdown persistido de todas as
// notas e faria nota visualmente vazia contar como "com conteúdo" (dots do
// CalendarView). Notas antigas, sem o marcador, parseiam exatamente como
// antes.
const ParagraphWithBlankLines = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(
          state: MarkdownSerializerState,
          node: ProseMirrorNode,
          parent: ProseMirrorNode,
          index: number
        ) {
          if (isBlankParagraph(node) && index < parent.childCount - 1) {
            state.write('<br>')
            state.closeBlock(node)
            return
          }
          defaultMarkdownSerializer.nodes.paragraph(state, node, parent, index)
        },
        parse: {
          // markdown-it renderiza o marcador de linha em branco como um
          // <br> "solto" (não envolto em <p>). O DOMParser do ProseMirror
          // envolve vários <br> soltos consecutivos num ÚNICO parágrafo com
          // vários hardBreaks, e o serializer acima colapsa N hardBreaks de
          // volta a um único <br> — o round-trip fica instável (1 blank
          // duplica/colapsa a cada troca de nota). Aqui cada <br> solto de
          // topo é embrulhado num <p></p> próprio, parseando para exatamente
          // um parágrafo vazio. <br> já dentro de <p> (hardBreak legítimo
          // entre texto) é preservado inalterado.
          updateDOM(element: HTMLElement) {
            element.querySelectorAll('br').forEach((br) => {
              if (br.parentElement?.tagName === 'P') return
              const p = br.ownerDocument.createElement('p')
              br.replaceWith(p)
            })
          },
        },
      },
    }
  },
})

// Conjunto base de extensões compartilhado entre o Editor principal e a
// janela keep. CRÍTICO: os dois editores precisam registrar os MESMOS nodes
// custom (embed/toggle/linked-note/reminder-chip) — um editor sem eles
// descartaria esses nodes no parse e o autosave destruiria o conteúdo.
// Qualquer node novo deve entrar aqui, não inline em um dos editores.
export function buildBaseExtensions(placeholder: string): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: true, autolink: false },
      code: false,
      paragraph: false,
    }),
    InlineCode,
    ParagraphWithBlankLines,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({ inline: false, allowBase64: true }),
    Placeholder.configure({
      placeholder,
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
    ReminderChip,
  ]
}
