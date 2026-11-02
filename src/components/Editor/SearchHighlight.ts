import { Editor, Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import styles from './SearchInNote.module.css'

export interface MatchRange {
  from: number
  to: number
}

interface SearchHighlightMeta {
  matches: MatchRange[]
  current: number
}

interface SearchHighlightState extends SearchHighlightMeta {
  decorations: DecorationSet
}

const searchHighlightKey = new PluginKey<SearchHighlightState>('monetSearchInNote')
const NO_HIGHLIGHT: SearchHighlightMeta = { matches: [], current: -1 }

// O set é montado só quando a busca ou o documento mudam, não a cada
// mudança de seleção (o decorations() roda em toda atualização da view).
function buildState(doc: ProseMirrorNode, { matches, current }: SearchHighlightMeta): SearchHighlightState {
  const decorations =
    matches.length === 0
      ? DecorationSet.empty
      : DecorationSet.create(
          doc,
          matches.map((m, i) =>
            Decoration.inline(m.from, m.to, { class: i === current ? styles.matchCurrent : styles.match })
          )
        )
  return { matches, current, decorations }
}

/**
 * Destaque das ocorrências da busca na nota (Ctrl+F). A seleção do editor já
 * vai para a ocorrência atual, mas não aparece com o foco no campo de busca;
 * a decoração mostra todas e marca a atual no tom da seleção.
 *
 * Plugin fixo, controlado por meta (como o PreviewMode): registrar e
 * desregistrar plugin em runtime reconfigura o estado e recria as views dos
 * plugins, e a régua (BubbleMenu) voltava com as opções da montagem e parava
 * de esconder no Esc.
 */
export const SearchHighlight = Extension.create({
  name: 'monetSearchHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchHighlightState>({
        key: searchHighlightKey,
        state: {
          init: (_config, state) => buildState(state.doc, NO_HIGHLIGHT),
          apply(tr, value) {
            const meta = tr.getMeta(searchHighlightKey) as SearchHighlightMeta | undefined
            if (meta) return buildState(tr.doc, meta)
            if (!tr.docChanged || value.matches.length === 0) return value
            return buildState(tr.doc, {
              current: value.current,
              matches: value.matches.map((m) => ({ from: tr.mapping.map(m.from), to: tr.mapping.map(m.to) })),
            })
          },
        },
        props: {
          decorations(state) {
            return searchHighlightKey.getState(state)?.decorations ?? null
          },
        },
      }),
    ]
  },
})

// Seleciona a ocorrência `current` e destaca todas (lista vazia limpa).
export function setSearchHighlight(editor: Editor, matches: MatchRange[], current: number): void {
  if (editor.isDestroyed) return
  const chain = editor.chain()
  if (matches.length > 0) {
    const match = matches[current]
    chain.setTextSelection({ from: match.from, to: match.to })
  }
  chain.setMeta(searchHighlightKey, matches.length > 0 ? { matches, current } : NO_HIGHLIGHT).setMeta('addToHistory', false).run()
}
