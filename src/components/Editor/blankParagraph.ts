import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// Parágrafo em branco: vazio ou contendo apenas hardBreaks. O segundo caso é
// a forma round-tripped do primeiro (ver ParagraphWithBlankLines em extensions.ts).
export function isBlankParagraph(node: ProseMirrorNode): boolean {
  for (let i = 0; i < node.childCount; i++) {
    if (node.child(i).type.name !== 'hardBreak') return false
  }
  return true
}
