import { Mark } from '@tiptap/core'
import type { Mark as ProseMirrorMark } from '@tiptap/pm/model'
import type { MarkdownSerializerState } from 'prosemirror-markdown'
import { DEFAULT_HIGHLIGHT_HEX } from '../../lib/highlight'

// Mark de destaque com cor (R1).
//
// A cor fica no atributo `color` do mark (o hex) e viaja no markdown como
// `<span data-bg="#RRGGBB">`. Nunca como atributo `style`: o ProseMirror
// normaliza `style` para `rgb(...)` ao ler de volta (e a cor deixaria de
// bater com a paleta) e `style` abriria risco de CSS inline nas superfícies
// que renderizam markdown.
//
// No DOM do editor a cor entra como `--hl` (só apresentação: não é lida de
// volta — o parse usa o `data-bg` — e não vai para o markdown). A regra em
// App.css transforma `--hl` numa tinta translúcida e o texto mantém a cor do
// tema: fundo sólido claro com texto claro ficava ilegível no tema escuro.
export const HighlightMark = Mark.create({
  name: 'highlight',

  addAttributes() {
    return {
      color: {
        default: DEFAULT_HIGHLIGHT_HEX,
        // O hex vem do `data-bg` do HTML.
        parseHTML: (element) => element.getAttribute('data-bg') ?? DEFAULT_HIGHLIGHT_HEX,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-bg]' }]
  },

  renderHTML({ mark }: { mark: ProseMirrorMark }) {
    const color = typeof mark.attrs.color === 'string' ? mark.attrs.color : DEFAULT_HIGHLIGHT_HEX
    return ['span', { 'data-bg': color, style: `--hl:${color}` }, 0]
  },

  addStorage() {
    return {
      markdown: {
        // Só o `data-bg` vai para o markdown (sem `style`): nas outras
        // superfícies o texto passa inteiro, mas sem cor.
        serialize: {
          open: (_state: MarkdownSerializerState, mark: ProseMirrorMark) =>
            `<span data-bg="${mark.attrs.color ?? DEFAULT_HIGHLIGHT_HEX}">`,
          close: () => '</span>',
        },
        parse: {},
      },
    }
  },
})
