import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root, Element, Node } from 'hast'

const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost(?:[:\/]|$)/i,
  /^https?:\/\/127\.0\.0\.1(?:[:\/]|$)/,
  /^https?:\/\/\[?::1\]?(?:[:\/]|$)/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:[:\/]|$)/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(?:[:\/]|$)/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(?:[:\/]|$)/,
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
        children: [{ type: 'text', value: 'Não foi possível carregar a imagem' }],
      }
      parent.children.splice(index, 1, span)
    }
  }
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
  .use(rehypeStringify)

export async function renderMarkdown(md: string): Promise<string> {
  const file = await processor.process(md)
  return String(file)
}

const embedProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true })

export async function renderNoteContent(md: string): Promise<string> {
  const file = await embedProcessor.process(md)
  return String(file)
}
