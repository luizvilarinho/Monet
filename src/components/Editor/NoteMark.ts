import { Mark, markInputRule, type Editor } from '@tiptap/core'
import type { Mark as ProseMirrorMark, MarkType, Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { MarkdownSerializerState } from 'prosemirror-markdown'
import type { EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { normalizeMarkLabel } from '../../lib/noteMarks'

// Marca de atenção (spec: DOCS/specs/notemark.md): trecho que o usuário marcou
// para voltar a ele, com rótulo opcional ("Pesquisar", "Revisar"...).
//
// No markdown vira `<mark data-mark="Rótulo">` (vazio = sem rótulo), como o
// highlight vira `<span data-bg>`. HTML e não `==`: o `==` não voltava no
// round-trip quando a borda da marca tinha espaço (o clique duplo do Windows
// seleciona o espaço depois da palavra), perdia o `=` vizinho e não tem onde
// guardar o rótulo. O parse pede o `data-mark`: `<mark>` colado da web não
// vira marca. `==texto==` fica como atalho de digitação (input rule) e é a
// forma que a IA lê (markTagsToAiText).
//
// A input rule não aplica dentro de código inline: o mark `code` exclui todos
// os outros (`excludes: '_'`) e o `markInputRule` do core aborta quando um
// mark existente no range exclui o novo.

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const NoteMark = Mark.create({
  name: 'noteMark',

  // Acima do link (1000): a marca é o mark mais externo, então cada trecho é
  // um <mark> só no DOM e no markdown (negrito e link ficam dentro dela).
  priority: 1001,

  // Digitar logo depois da marca não a estende.
  inclusive: false,

  addAttributes() {
    return {
      label: {
        default: null,
        parseHTML: (element) => normalizeMarkLabel(element.getAttribute('data-mark') ?? ''),
        renderHTML: (attributes) => ({ 'data-mark': attributes.label ?? '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'mark[data-mark]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', HTMLAttributes, 0]
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open: (_state: MarkdownSerializerState, mark: ProseMirrorMark) =>
            `<mark data-mark="${escapeAttr((mark.attrs.label as string | null) ?? '')}">`,
          close: () => '</mark>',
        },
        parse: {},
      },
    }
  },

  addInputRules() {
    return [
      markInputRule({
        find: /==([^=\s](?:[^=]*[^=\s])?)==$/,
        type: this.type,
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => toggleNoteMark(this.editor),
    }
  },
})

// ─── Runs ───────────────────────────────────────────────────────────────────

// Trecho contíguo com a mesma marca (o texto marcado pode estar em vários nós:
// negrito dentro da marca, um chip no meio).
export interface NoteMarkRun {
  from: number
  to: number
  label: string | null
}

function markTypeOf(doc: ProseMirrorNode): MarkType | undefined {
  return doc.type.schema.marks.noteMark
}

function collectRuns(block: ProseMirrorNode, start: number, type: MarkType, out: NoteMarkRun[]) {
  let current = null as { run: NoteMarkRun; mark: ProseMirrorMark } | null
  block.forEach((child, offset) => {
    const mark = type.isInSet(child.marks)
    const from = start + offset
    if (!mark) {
      current = null
      return
    }
    if (current && current.run.to === from && current.mark.eq(mark)) {
      current.run.to = from + child.nodeSize
      return
    }
    current = { run: { from, to: from + child.nodeSize, label: (mark.attrs.label as string | null) ?? null }, mark }
    out.push(current.run)
  })
}

// Texto visível do run, com espaços colapsados (mesma regra da extração em
// src/lib/noteMarks.ts: quebra de linha vale um espaço).
export function noteMarkRunText(doc: ProseMirrorNode, run: { from: number; to: number }): string {
  return doc
    .textBetween(run.from, run.to, ' ', (leaf) => (leaf.type.name === 'hardBreak' ? ' ' : ''))
    .replace(/\s+/g, ' ')
    .trim()
}

// Runs em ordem de documento — a mesma ordem e o mesmo descarte (só espaço)
// de extractNoteMarks, para o índice da lista apontar o run certo.
export function noteMarkRuns(doc: ProseMirrorNode): NoteMarkRun[] {
  const type = markTypeOf(doc)
  if (!type) return []
  const runs: NoteMarkRun[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    collectRuns(node, pos + 1, type, runs)
    return false
  })
  return runs.filter((r) => noteMarkRunText(doc, r) !== '')
}

// Run sob a posição (bordas incluídas: o cursor logo antes/depois da marca).
export function noteMarkRunAt(state: EditorState, pos: number): NoteMarkRun | null {
  const type = markTypeOf(state.doc)
  if (!type) return null
  const $pos = state.doc.resolve(pos)
  if (!$pos.parent.isTextblock) return null
  const runs: NoteMarkRun[] = []
  collectRuns($pos.parent, $pos.start(), type, runs)
  return runs.find((r) => r.from < pos && pos < r.to) ?? runs.find((r) => r.from <= pos && pos <= r.to) ?? null
}

// Índice do run entre os da nota (o mesmo índice da lista de marcas).
export function noteMarkRunIndex(doc: ProseMirrorNode, run: NoteMarkRun): number {
  return noteMarkRuns(doc).findIndex((r) => r.from === run.from)
}

// Elemento <mark> do run no DOM do editor (âncora do menu e do flash). Mira o
// 1º caractere: na posição exata do início o DOM ainda é o do bloco pai.
export function noteMarkElement(view: EditorView, run: NoteMarkRun): HTMLElement | null {
  const { node, offset } = view.domAtPos(Math.min(run.from + 1, run.to))
  const target = node.nodeType === Node.TEXT_NODE ? node : (node.childNodes[offset] ?? node)
  const el = target.nodeType === Node.TEXT_NODE ? target.parentElement : (target as Element)
  return (el?.closest?.('mark[data-mark]') as HTMLElement | null) ?? null
}

// ─── Ações ──────────────────────────────────────────────────────────────────

// Seleção sem espaço (nem fronteira de bloco) nas bordas: a marca cobre só o
// texto — o clique duplo do Windows inclui o espaço depois da palavra.
function trimmedRange(doc: ProseMirrorNode, from: number, to: number): { from: number; to: number } {
  const at = (a: number, b: number) => doc.textBetween(a, b, '\n', '\n')
  while (from < to && /^\s?$/.test(at(from, from + 1))) from++
  while (to > from && /^\s?$/.test(at(to - 1, to))) to--
  return { from, to }
}

// Todo o texto (sem contar espaço) do intervalo já tem a marca.
function isRangeMarked(doc: ProseMirrorNode, from: number, to: number): boolean {
  const type = markTypeOf(doc)
  if (!type) return false
  let any = false
  let all = true
  doc.nodesBetween(from, to, (node) => {
    if (!node.isInline) return true
    if (node.isText && !node.text?.trim()) return false
    if (type.isInSet(node.marks)) any = true
    else all = false
    return false
  })
  return any && all
}

// Primeiro rótulo de marca no intervalo (estender uma marca mantém o rótulo).
function labelInRange(doc: ProseMirrorNode, from: number, to: number): string | null {
  const type = markTypeOf(doc)
  let label: string | null = null
  if (!type) return null
  doc.nodesBetween(from, to, (node) => {
    if (label) return false
    const mark = type.isInSet(node.marks)
    if (mark?.attrs.label) label = mark.attrs.label as string
    return true
  })
  return label
}

// Marca a seleção (ou `range`) com o rótulo. Sem rótulo explícito, mantém o
// de uma marca que já esteja no trecho.
export function applyNoteMark(
  editor: Editor,
  label: string | null | undefined,
  range?: { from: number; to: number }
): boolean {
  const sel = range ?? editor.state.selection
  const r = trimmedRange(editor.state.doc, sel.from, sel.to)
  if (r.from >= r.to) return false
  const next = label === undefined ? labelInRange(editor.state.doc, r.from, r.to) : normalizeMarkLabel(label ?? '')
  return editor.chain().focus().setTextSelection(r).setMark('noteMark', { label: next }).run()
}

// Desfaz a marca do run (o texto fica).
export function removeNoteMarkRun(editor: Editor, run: NoteMarkRun, caret = run.to): boolean {
  return editor.chain().focus().setTextSelection(run).unsetMark('noteMark').setTextSelection(caret).run()
}

export function setNoteMarkLabel(editor: Editor, run: NoteMarkRun, label: string | null, caret?: number): boolean {
  const pos = caret ?? editor.state.selection.from
  return editor
    .chain()
    .focus()
    .setTextSelection(run)
    .setMark('noteMark', { label: normalizeMarkLabel(label ?? '') })
    .setTextSelection(pos)
    .run()
}

// Botão "Mark" e Ctrl+Shift+M: seleção já marcada desmarca; senão marca. Sem
// seleção, desmarca o run sob o cursor.
export function toggleNoteMark(editor: Editor): boolean {
  const { state } = editor
  const { from, to, empty } = state.selection
  if (empty) {
    const run = noteMarkRunAt(state, from)
    return run ? removeNoteMarkRun(editor, run, from) : false
  }
  const r = trimmedRange(state.doc, from, to)
  if (r.from >= r.to) return false
  if (isRangeMarked(state.doc, r.from, r.to)) {
    return editor.chain().focus().setTextSelection(r).unsetMark('noteMark').run()
  }
  return applyNoteMark(editor, undefined, r)
}

// A seleção está inteira dentro de marcas (estado ativo do botão "Mark").
export function isSelectionMarked(state: EditorState): boolean {
  const { from, to, empty } = state.selection
  if (empty) return noteMarkRunAt(state, from) !== null
  const r = trimmedRange(state.doc, from, to)
  return r.from < r.to && isRangeMarked(state.doc, r.from, r.to)
}
