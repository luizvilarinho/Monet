import { Mark, type Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { collectRuns, isRangeMarked, trimmedRange, type NoteMarkRun } from './NoteMark'

// Termo do Related content: trecho que o usuário sinalizou para ligar a nota
// às outras notas que citam o mesmo texto (src/lib/relatedTerms.ts).
//
// No markdown vira `<span data-related>`, no padrão do `<span data-bg>`. O
// parse pede o atributo: `<span>` colado da web não vira termo. O atributo
// não usa o prefixo `data-mark`: a extração e o storage das marcas de atenção
// procuram `data-mark` no conteúdo.
//
// Prioridade 999: abaixo do link (1000) e do `noteMark` (1001). Um termo que
// cobre só parte de uma marca (ou de um link) fica dentro dela e não a parte
// em dois `<mark>` — a lista Marks conta os runs pelo markdown e pelo editor,
// e os dois precisam bater. Negrito, itálico e highlight ficam dentro do termo.
export const RelatedTerm = Mark.create({
  name: 'relatedTerm',

  priority: 999,

  // Digitar logo depois do termo não o estende.
  inclusive: false,

  parseHTML() {
    return [{ tag: 'span[data-related]' }]
  },

  // Dentro de toggle o conteúdo é gravado como HTML: sai `data-related=""`,
  // que o parse também aceita.
  renderHTML() {
    return ['span', { 'data-related': '' }, 0]
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open: () => '<span data-related>',
          close: () => '</span>',
        },
        parse: {},
      },
    }
  },
})

// A seleção está inteira dentro de termos (estado ativo do botão "Related").
export function isSelectionRelated(state: EditorState): boolean {
  const { from, to, empty } = state.selection
  if (empty) return false
  const r = trimmedRange(state.doc, from, to)
  return r.from < r.to && isRangeMarked(state.doc, r.from, r.to, state.schema.marks.relatedTerm)
}

// Botão "Related": seleção dentro de termos remove os termos inteiros que ela
// toca (desmarcar uma palavra não deixa o resto como outro termo); senão
// marca a seleção, sem os espaços das bordas.
export function toggleRelatedTerm(editor: Editor): boolean {
  const { state } = editor
  const { from, to, empty } = state.selection
  if (empty) return false
  const r = trimmedRange(state.doc, from, to)
  if (r.from >= r.to) return false
  const type = state.schema.marks.relatedTerm
  if (!type) return false
  if (!isSelectionRelated(state)) {
    return editor.chain().focus().setTextSelection(r).setMark('relatedTerm').run()
  }
  const runs: NoteMarkRun[] = []
  state.doc.nodesBetween(r.from, r.to, (node, pos) => {
    if (!node.isTextblock) return true
    collectRuns(node, pos + 1, type, runs)
    return false
  })
  const touched = runs.filter((run) => run.from < r.to && run.to > r.from)
  const start = Math.min(r.from, ...touched.map((run) => run.from))
  const end = Math.max(r.to, ...touched.map((run) => run.to))
  return editor
    .chain()
    .focus()
    .setTextSelection({ from: start, to: end })
    .unsetMark('relatedTerm')
    .setTextSelection(r)
    .run()
}
