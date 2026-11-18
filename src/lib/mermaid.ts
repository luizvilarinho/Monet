import type { Mermaid } from 'mermaid'

// Diagramas Mermaid (blocos ```mermaid na nota, no chat e no preview de nota
// linkada). A lib (~800 KB, mais ~1,5 MB do ELK) entra por import() dinâmico
// na primeira vez que um diagrama aparece, para não pesar a abertura do app.

// Cores por seção (mindmap, timeline, journey…) e fatias da pizza. No modo
// escuro o tema `base` escurece as derivadas quase até o preto (e as fatias
// saem quase iguais); estas são tons escuros e distintos dos acentos do app,
// com o texto claro.
const SECTION_COLORS = [
  '#3b3480', '#1e5a4a', '#6a4718', '#24497a', '#6a2a3c', '#3f5a22',
  '#4f2e70', '#1d5160', '#5e4f1c', '#2d3e66', '#64302a', '#2a5a3e',
]

// Tema fixo: o app só tem tema escuro. As cores vêm dos tokens de src/App.css
// em hex (o Mermaid deriva outras cores delas e não lê var(--x)).
const THEME_VARIABLES = {
  ...Object.fromEntries(
    SECTION_COLORS.flatMap((color, i) => [
      [`cScale${i}`, color],
      [`cScaleLabel${i}`, '#ddddf1'],
      [`pie${i + 1}`, color],
    ])
  ),
  darkMode: true,
  background: '#1f1f2f',
  primaryColor: '#292959',
  primaryTextColor: '#ddddf1',
  primaryBorderColor: '#7b6ed4',
  secondaryColor: '#1d1d34',
  tertiaryColor: '#2e2e36',
  lineColor: '#9898a4',
  textColor: '#ddddf1',
  noteBkgColor: '#2e2e36',
  noteTextColor: '#ddddf1',
  noteBorderColor: '#7c7c93',
  edgeLabelBackground: '#1f1f2f',
  // A sombra padrão é clara (feita para fundo branco).
  dropShadow: 'drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.45))',
  fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: '14px',
}

// Chaves que o código do diagrama (`%%{init}%%` ou front-matter `config:`)
// não muda: as seis padrão do Mermaid mais as de tema, para o diagrama seguir
// legível no escuro.
const SECURE_KEYS = [
  'secure',
  'securityLevel',
  'startOnLoad',
  'maxTextSize',
  'suppressErrorRendering',
  'maxEdges',
  'theme',
  'themeVariables',
  'themeCSS',
  'darkMode',
]

// Abaixo desta fração da largura natural o texto fica pequeno demais: dali em
// diante o diagrama para de encolher e o contêiner rola.
const MIN_SCALE = 0.75

let loading: Promise<Mermaid> | null = null
let renderSeq = 0

function loadMermaid(): Promise<Mermaid> {
  if (!loading) {
    loading = import('mermaid')
      .then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          // Conteúdo vem da IA e de colagem.
          securityLevel: 'strict',
          // O erro volta para quem chamou; o Mermaid não desenha o dele.
          suppressErrorRendering: true,
          theme: 'base',
          themeVariables: THEME_VARIABLES,
          darkMode: true,
          fontFamily: THEME_VARIABLES.fontFamily,
          secure: SECURE_KEYS,
        })
        return mermaid
      })
      .catch((err) => {
        loading = null
        throw err
      })
  }
  return loading
}

export type MermaidResult = { svg: string } | { error: string }

function errorMessage(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'str' in err
        ? String((err as { str: unknown }).str)
        : String(err)
  return raw.trim() || 'Could not draw this diagram.'
}

// Diagrama só leitura: no `strict` o Mermaid ainda desenha `click A "url"`
// como link (`<a xlink:href>`), e o clique levaria a janela do app para o
// site. O link sai e o conteúdo dele fica.
function stripLinks(svg: string): string {
  const template = document.createElement('template')
  template.innerHTML = svg
  const links = template.content.querySelectorAll('a')
  if (links.length === 0) return svg
  links.forEach((a) => a.replaceWith(...a.childNodes))
  return template.innerHTML
}

// Desenha o código e devolve o SVG (já sanitizado pelo Mermaid em `strict`,
// sem links) ou a mensagem de erro. Cada chamada usa um id novo: vários
// diagramas na mesma tela não dividem estilos nem marcadores de seta.
export async function renderMermaid(code: string): Promise<MermaidResult> {
  try {
    const mermaid = await loadMermaid()
    renderSeq += 1
    const { svg } = await mermaid.render(`monet-mermaid-${renderSeq}`, code)
    return { svg: stripLinks(svg) }
  } catch (err) {
    return { error: errorMessage(err) }
  }
}

// O SVG do Mermaid tem width 100% e max-width igual à largura natural: encolhe
// para caber na coluna. A largura mínima limita o encolhimento (ver MIN_SCALE).
export function fitDiagram(host: HTMLElement): void {
  const svg = host.querySelector('svg')
  const natural = svg ? parseFloat(svg.style.maxWidth) : NaN
  if (svg && natural > 0) svg.style.minWidth = `${Math.round(natural * MIN_SCALE)}px`
}
