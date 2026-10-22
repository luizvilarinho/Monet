// Paleta do destaque de texto (R1). A cor vive DENTRO do editor: o markdown
// carrega só `<span data-bg="#RRGGBB">` e as outras superfícies (Chat, AI
// cards, `renderNoteContent`) mostram o texto inteiro, mas sem cor.
//
// A paleta é a mesma do leitor de livros (`src/components/Reader/Reader.tsx`)
// com uma cor a mais (roxo). O hex é a identidade da cor (é o que fica gravado);
// na tela ele vira tinta translúcida (regra `span[data-bg]` em App.css). A UI
// do projeto é em inglês, então os nomes acessíveis dos swatches também são.

export interface HighlightColor {
  /** Identificador estável da cor (usado pela UI e pelo botão ativo). */
  id: string
  /** Hexadecimal da cor — é o que vai no `data-bg` do markdown. */
  hex: string
  /** Nome acessível da cor, em inglês. */
  name: string
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { id: 'yellow', hex: '#FFEB3B', name: 'yellow' },
  { id: 'green', hex: '#A5D6A7', name: 'green' },
  { id: 'blue', hex: '#90CAF9', name: 'blue' },
  { id: 'pink', hex: '#F48FB1', name: 'pink' },
  { id: 'purple', hex: '#CE93D8', name: 'purple' },
]

/** Cor usada quando o usuário não escolhe nenhuma (aplicar/alternar sem cor). */
export const DEFAULT_HIGHLIGHT_ID = 'yellow'

export function highlightById(id: string): HighlightColor | null {
  return HIGHLIGHT_COLORS.find((c) => c.id === id) ?? null
}

/** Procura a cor pelo hex do mark (o atributo `color` guarda o hex). */
export function highlightByHex(hex: string | null | undefined): HighlightColor | null {
  if (!hex) return null
  const wanted = hex.trim().toUpperCase()
  return HIGHLIGHT_COLORS.find((c) => c.hex.toUpperCase() === wanted) ?? null
}

/** Hex da cor padrão — é o `default` do atributo `color` do mark. */
export const DEFAULT_HIGHLIGHT_HEX = HIGHLIGHT_COLORS[0].hex
